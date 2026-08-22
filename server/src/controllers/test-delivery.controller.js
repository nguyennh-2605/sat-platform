const ApiError = require('../utils/ApiError');
const testDeliveryService = require('../services/test-delivery.service');

const handleError = (res, error, fallback) => {
  if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
};

exports.create = async (req, res) => {
  try {
    const deliveries = await testDeliveryService.createDeliveries({
      ...req.body,
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.status(201).json({ deliveries });
  } catch (error) {
    handleError(res, error, 'Unable to assign the selected tests.');
  }
};

exports.listForClass = async (req, res) => {
  try {
    const deliveries = await testDeliveryService.listClassDeliveries({
      classId: String(req.params.classId),
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(deliveries);
  } catch (error) {
    handleError(res, error, 'Unable to load assigned tests.');
  }
};

exports.performance = async (req, res) => {
  try {
    const report = await testDeliveryService.getDeliveryPerformance({
      deliveryId: String(req.params.deliveryId),
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(report);
  } catch (error) {
    handleError(res, error, 'Unable to load test performance.');
  }
};

exports.studentPerformance = async (req, res) => {
  try {
    const report = await testDeliveryService.getStudentPerformance({
      deliveryId: String(req.params.deliveryId),
      studentId: Number(req.params.studentId),
      userId: req.user.userId,
      userRole: req.user.role,
    });
    res.json(report);
  } catch (error) {
    handleError(res, error, 'Unable to load student performance.');
  }
};
