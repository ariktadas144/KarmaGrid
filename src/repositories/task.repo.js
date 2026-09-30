const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createTask = async (data) => {
  return prisma.task.create({ data });
};

const updateTask = async (id, data) => {
  return prisma.task.update({
    where: { id },
    data
  });
};

const findTaskById = async (id) => {
  return prisma.task.findUnique({
    where: { id },
    include: {
      organization: {
        select: { id: true, name: true, email: true }
      },
      _count: {
        select: { registrations: true }
      }
    }
  });
};

const findTasks = async (filters = {}) => {
  return prisma.task.findMany({
    where: filters,
    include: {
      organization: {
        select: { id: true, name: true }
      },
      _count: {
        select: { registrations: true }
      }
    }
  });
};

const cancelTask = async (id) => {
  return prisma.$transaction([
    prisma.registration.deleteMany({ where: { taskId: id } }),
    prisma.task.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })
  ]);
};

const findTasksByVolunteerId = async (volunteerId) => {
  const registrations = await prisma.registration.findMany({
    where: { volunteerId },
    include: {
      task: {
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { registrations: true } }
        }
      }
    }
  });
  return registrations.map(r => r.task);
};

module.exports = {
  createTask,
  updateTask,
  findTaskById,
  findTasks,
  cancelTask,
  findTasksByVolunteerId,
  prisma 
};
