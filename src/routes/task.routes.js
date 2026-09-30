const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const taskController = require('../controllers/task.controller');

const router = Router();

router.post('/', verifyToken('ORG'), requireRole('ORG'), taskController.createTask);
router.patch('/:id', verifyToken('ORG'), requireRole('ORG'), taskController.updateTask);
router.delete('/:id', verifyToken('ORG'), requireRole('ORG'), taskController.cancelTask);
router.get('/', taskController.listTasks);
router.get('/:id', taskController.getTaskById);
router.post('/:id/register', verifyToken('VOLUNTEER'), requireRole('VOLUNTEER'), taskController.registerForTask);
router.delete('/:id/register', verifyToken('VOLUNTEER'), requireRole('VOLUNTEER'), taskController.cancelRegistration);
router.get('/:id/volunteers', verifyToken('ORG'), requireRole('ORG'), taskController.getTaskVolunteers);

router.get('/volunteers/me/tasks', verifyToken('VOLUNTEER'), requireRole('VOLUNTEER'), taskController.listMyTasks);

module.exports = router;
