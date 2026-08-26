const PLATFORM_TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';
const configuredOffset = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES);
const PLATFORM_UTC_OFFSET_MINUTES = Number.isFinite(configuredOffset) ? configuredOffset : 420;

module.exports = { PLATFORM_TIME_ZONE, PLATFORM_UTC_OFFSET_MINUTES };
