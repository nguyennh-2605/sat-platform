const router = require('express').Router();
const controller = require('../controllers/roadmap.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, authorizeRole(['ADMIN']), controller.list);
router.post('/', authenticateToken, authorizeRole(['ADMIN']), controller.create);
router.patch('/:id', authenticateToken, authorizeRole(['ADMIN']), controller.update);
router.post('/:id/milestones', authenticateToken, authorizeRole(['ADMIN']), controller.createMilestone);
router.patch('/:id/milestones/:milestoneId', authenticateToken, authorizeRole(['ADMIN']), controller.updateMilestone);
router.post('/:id/publish', authenticateToken, authorizeRole(['ADMIN']), controller.publish);

module.exports = router;
