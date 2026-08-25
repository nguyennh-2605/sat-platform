const express = require('express');
const controller = require('../controllers/vocabulary.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();
const staffOnly = authorizeRole(['TEACHER', 'ADMIN']);

router.use(authenticateToken);
router.get('/sets', controller.listSets);
router.post('/sets', controller.createSet);
router.get('/sets/:setId', controller.getSet);
router.patch('/sets/:setId', controller.updateSet);
router.put('/sets/:setId/terms', controller.replaceTerms);
router.patch('/sets/:setId/terms/:termId', controller.updateTerm);
router.delete('/sets/:setId', controller.deleteSet);
router.post('/sets/:setId/publish', authorizeRole(['ADMIN']), controller.publishSet);
router.post('/sets/:setId/archive', controller.archiveSet);
router.post('/sets/:setId/sessions', controller.createSession);
router.get('/sessions/:sessionId', controller.getSession);
router.post('/sessions/:sessionId/questions/:questionId/answer', controller.answerQuestion);
router.post('/activities', staffOnly, controller.assignSet);
router.get('/activities/class/:classId', controller.listClassActivities);
router.get('/activities/:activityId/performance', staffOnly, controller.performance);
router.get('/activities/:activityId', controller.getActivity);

module.exports = router;
