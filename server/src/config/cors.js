const corsOptions = {
  origin: ["https://sat-platform-two.vercel.app", "http://localhost:5173", "http://localhost:5174"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

module.exports = corsOptions;
