const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');

const { authenticateToken } = require('../middleware/auth.middleware'); 

router.delete('/:id', authenticateToken, assignmentController.deleteAssignment);
router.put('/:id', authenticateToken, assignmentController.updateAssignment);
router.get('/:id', authenticateToken, assignmentController.getAssignmentById);

module.exports = router;