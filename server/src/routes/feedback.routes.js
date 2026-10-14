const router = require('express').Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rate-limit.middleware');
const controller = require('../controllers/feedback.controller');
const { MAX_IMAGE_BYTES } = require('../services/feedback.service');

const accountKey = req => String(req.user.userId);
const submitLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, key: accountKey, message: 'You have sent several feedback reports. Please try again later.' });
const imageLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30, key: accountKey, message: 'Too many image uploads. Please try again later.' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 } }).single('image');

router.use(authenticateToken);
router.post('/', submitLimit, controller.submit);
router.post('/images', imageLimit, (req, res, next) => {
  upload(req, res, error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or less.' : 'Upload one image at a time using the image field.' });
    next();
  });
}, controller.uploadImage);
router.get('/images/:fileAssetId', controller.getImage);

module.exports = router;
