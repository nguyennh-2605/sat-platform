const ApiError = require('../utils/ApiError');
const adminOverviewService = require('../services/admin-overview.service');
const auditEventService = require('../services/audit-event.service');

const respond = async (res, action, fallbackMessage) => {
  try {
    res.json(await action());
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
  }
};

exports.getOverview = (req, res) => respond(
  res,
  () => adminOverviewService.getOverview({ range: req.query.range }),
  'Unable to load the admin overview.',
);

exports.getActivity = (req, res) => respond(
  res,
  () => adminOverviewService.getActivity({ range: req.query.range }),
  'Unable to load platform activity.',
);

exports.getRecentActivity = (req, res) => respond(
  res,
  () => auditEventService.getRecentActivity({ limit: req.query.limit, cursor: req.query.cursor }),
  'Unable to load recent activity.',
);
