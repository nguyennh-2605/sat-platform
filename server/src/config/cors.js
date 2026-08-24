const corsOptions = {
  origin: ["https://sonder-sat.vercel.app", "http://localhost:5173", "http://localhost:5174"],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Intent'],
  credentials: true
};

module.exports = corsOptions;
