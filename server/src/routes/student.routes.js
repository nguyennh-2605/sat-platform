const express = require('express');
const controller = require('../controllers/student-overview.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/overview', authenticateToken, authorizeRole(['STUDENT']), controller.getOverview);
router.get('/tasks', authenticateToken, authorizeRole(['STUDENT']), controller.getTasks);
router.post('/tasks', authenticateToken, authorizeRole(['STUDENT']), controller.createTask);
router.put('/tasks/order', authenticateToken, authorizeRole(['STUDENT']), controller.reorderTasks);
router.put('/tasks/state', authenticateToken, authorizeRole(['STUDENT']), controller.updateTaskState);
router.patch('/tasks/:id', authenticateToken, authorizeRole(['STUDENT']), controller.updateTask);
router.delete('/tasks/:id', authenticateToken, authorizeRole(['STUDENT']), controller.deleteTask);

module.exports = router;
