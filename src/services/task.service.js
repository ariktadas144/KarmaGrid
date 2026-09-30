const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const taskRepo = require('../repositories/task.repo');

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  size: z.number().int().positive('Size must be positive'),
  location: z.string().min(1, 'Location is required'),
  date: z.string().datetime().or(z.date()),
  category: z.string().min(1, 'Category is required'),
});

const updateTaskSchema = createTaskSchema.partial();

const createTask = async (orgId, data) => {
  const validated = createTaskSchema.parse(data);
  return taskRepo.createTask({
    ...validated,
    organizationId: orgId
  });
};

const updateTask = async (orgId, taskId, data) => {
  const validated = updateTaskSchema.parse(data);
  
  const task = await taskRepo.findTaskById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }
  if (task.organizationId !== orgId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return taskRepo.updateTask(taskId, validated);
};

const cancelTask = async (orgId, taskId) => {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }
  if (task.organizationId !== orgId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  return taskRepo.cancelTask(taskId);
};

const listTasksForOrg = async (orgId) => {
  return taskRepo.findTasks({ organizationId: orgId });
};

const listTasksForVolunteer = async (filters = {}) => {
  return taskRepo.findTasks({ ...filters, status: 'OPEN' });
};

const listRegisteredTasksForVolunteer = async (volunteerId) => {
  return taskRepo.findTasksByVolunteerId(volunteerId);
};

const getTaskById = async (taskId) => {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.status = 404;
    throw err;
  }
  return task;
};

// Transaction requires Serializable isolation to prevent TOCTOU race conditions when checking task capacity.
// Concurrent transactions that read the same capacity and attempt to create a registration will trigger
// a Prisma P2034 serialization failure, which we catch and map to a 409 Conflict.
const registerForTask = async (taskId, volunteerId) => {
  try {
    return await taskRepo.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: { registrations: true }
      });

      if (!task) {
        const err = new Error('Task not found');
        err.status = 404;
        throw err;
      }

      if (task.status !== 'OPEN') {
        const err = new Error('Task is not open for registration');
        err.status = 400;
        throw err;
      }

      if (task.registrations.length >= task.size) {
        const err = new Error('Task is full');
        err.status = 409;
        throw err;
      }

      const isAlreadyRegistered = task.registrations.some(r => r.volunteerId === volunteerId);
      if (isAlreadyRegistered) {
        const err = new Error('Already registered');
        err.status = 409;
        throw err;
      }

      return tx.registration.create({
        data: {
          taskId,
          volunteerId
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error.code === 'P2034') {
      const err = new Error('Registration failed due to a concurrent update, please try again');
      err.status = 409;
      throw err;
    }
    if (error.code === 'P2002') {
      const err = new Error('Already registered');
      err.status = 409;
      throw err;
    }
    throw error;
  }
};

const cancelRegistration = async (taskId, volunteerId) => {
  return taskRepo.prisma.$transaction(async (tx) => {
    try {
      return await tx.registration.delete({
        where: {
          taskId_volunteerId: {
            taskId,
            volunteerId
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2025') {
        const err = new Error('Registration not found');
        err.status = 404;
        throw err;
      }
      throw error;
    }
  });
};

module.exports = {
  createTask,
  updateTask,
  cancelTask,
  listTasksForOrg,
  listTasksForVolunteer,
  listRegisteredTasksForVolunteer,
  getTaskById,
  registerForTask,
  cancelRegistration
};
