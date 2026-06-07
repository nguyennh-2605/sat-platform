// Lỗi nghiệp vụ được ném từ tầng service. `body` chính là JSON sẽ trả về client,
// nên controller có thể giữ nguyên status code và payload như logic cũ.
class ApiError extends Error {
  constructor(statusCode, body) {
    const normalizedBody = typeof body === 'string' ? { error: body } : body;
    super(normalizedBody.message || normalizedBody.error || 'ApiError');
    this.statusCode = statusCode;
    this.body = normalizedBody;
  }
}

module.exports = ApiError;
