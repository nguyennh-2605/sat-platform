const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');

const { authenticateToken } = require('../middleware/authMiddleware'); 

router.delete('/:id', authenticateToken, assignmentController.deleteAssignment);
router.put('/:id', authenticateToken, assignmentController.updateAssignment);
router.get('/:id', authenticateToken, assignmentController.getAssignmentById);

module.exports = router;