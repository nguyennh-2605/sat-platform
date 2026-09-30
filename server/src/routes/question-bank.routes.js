const router = require('express').Router();
const controller = require('../controllers/question-bank.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.listQuestions);
router.post('/', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.createQuestion);
router.post('/random-quizzes', authenticateToken, authorizeRole(['STUDENT']), controller.createRandomQuiz);
router.put('/:id', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.updateQuestion);
router.patch('/:id/status', authenticateToken, authorizeRole(['TEACHER', 'ADMIN']), controller.updateStatus);

module.exports = router;
