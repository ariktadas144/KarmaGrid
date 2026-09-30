const taskService = require('../services/task.service');

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.auth.id, req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.auth.id, req.params.id, req.body);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

const cancelTask = async (req, res, next) => {
  try {
    await taskService.cancelTask(req.auth.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const listTasks = async (req, res, next) => {
  try {
    if (req.auth && req.auth.role === 'ORG') {
      const tasks = await taskService.listTasksForOrg(req.auth.id);
      return res.json(tasks);
    }
    const filters = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.location) filters.location = req.query.location;
    const tasks = await taskService.listTasksForVolunteer(filters);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
};

const registerForTask = async (req, res, next) => {
  try {
    await taskService.registerForTask(req.params.id, req.auth.id);
    res.status(201).json({ message: 'Successfully registered' });
  } catch (error) {
    next(error);
  }
};

const cancelRegistration = async (req, res, next) => {
  try {
    await taskService.cancelRegistration(req.params.id, req.auth.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const getTaskVolunteers = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (task.organizationId !== req.auth.id) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    res.json(task.registrations);
  } catch (error) {
    next(error);
  }
};

const listMyTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.listRegisteredTasksForVolunteer(req.auth.id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  updateTask,
  cancelTask,
  listTasks,
  getTaskById,
  registerForTask,
  cancelRegistration,
  getTaskVolunteers,
  listMyTasks
};
