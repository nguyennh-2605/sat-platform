const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');

const { authenticateToken } = require('../middleware/auth.middleware'); 

router.delete('/:id', authenticateToken, assignmentController.deleteAssignment);
router.put('/:id', authenticateToken, assignmentController.updateAssignment);
router.get('/:id/student-work', authenticateToken, assignmentController.listStudentWork);
router.get('/:id/student-work/:studentId', authenticateToken, assignmentController.getStudentWork);
router.patch('/:id/student-work/:studentId/review', authenticateToken, assignmentController.reviewStudentWork);
router.get('/:id/my-submission', authenticateToken, assignmentController.getMySubmission);
router.patch('/:id/my-submission/draft', authenticateToken, assignmentController.updateDraft);
router.post('/:id/my-submission/edit', authenticateToken, assignmentController.editSubmission);
router.delete('/:id/my-submission/draft', authenticateToken, assignmentController.discardDraft);
router.post('/:id/my-submission/draft/items', authenticateToken, assignmentController.addDraftItem);
router.delete('/:id/my-submission/draft/items/:itemId', authenticateToken, assignmentController.removeDraftItem);
router.post('/:id/my-submission/submit', authenticateToken, assignmentController.submitDraft);
router.put('/:id/submission', authenticateToken, assignmentController.upsertSubmission);
router.get('/:id', authenticateToken, assignmentController.getAssignmentById);

module.exports = router;
