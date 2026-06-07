const ApiError = require('../utils/ApiError');
const aiParserService = require('../services/ai-parser.service');

// MAIN CONTROLLER: XỬ LÝ UPLOAD VÀ PARSE FILE
exports.parseDocumentController = async (req, res) => {
  try {
    const text = await aiParserService.parseDocument(req.file);
    return res.status(200).json({ success: true, text });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi hệ thống Parse Document:", error);
    return res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra trong quá trình xử lý file. Vui lòng thử lại.'
    });
  }
};
