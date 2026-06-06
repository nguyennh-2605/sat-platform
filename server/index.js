const app = require('./src/app');

const PORT = process.env.PORT || 5000;

// --- KHỞI ĐỘNG SERVER ---
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});