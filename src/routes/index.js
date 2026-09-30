const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/tasks', require('./task.routes'));
router.get('/volunteers/me/tasks', require('../middleware/auth').verifyToken('VOLUNTEER'), require('../middleware/roleGuard').requireRole('VOLUNTEER'), require('../controllers/task.controller').listMyTasks);

module.exports = router;