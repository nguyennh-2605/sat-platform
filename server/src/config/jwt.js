const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Please set it in the server environment.');
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};
