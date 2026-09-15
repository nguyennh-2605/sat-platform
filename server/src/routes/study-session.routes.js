const express = require('express');
const controller = require('../controllers/study-session.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const studentOnly = [authenticateToken, authorizeRole(['STUDENT'])];

router.get('/active', ...studentOnly, controller.getActive);
router.get('/summary', ...studentOnly, controller.getSummary);
router.post('/', ...studentOnly, controller.start);
router.post('/:id/pause', ...studentOnly, controller.pause);
router.post('/:id/resume', ...studentOnly, controller.resume);
router.post('/:id/finish', ...studentOnly, controller.finish);
router.post('/:id/cancel', ...studentOnly, controller.cancel);

module.exports = router;
