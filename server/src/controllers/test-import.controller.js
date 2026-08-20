const ApiError = require('../utils/ApiError');
const testImportService = require('../services/test-import.service');

exports.previewFile = async (req, res) => {
  try {
    const preview = await testImportService.previewImport({
      file: req.file,
      subject: req.body.subject,
      moduleCount: req.body.moduleCount,
    });
    res.json(preview);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Document import preview error:', error);
    res.status(500).json({ error: 'Unable to read this document. Try a searchable PDF or DOCX file.' });
  }
};

exports.extractFile = async (req, res) => {
  try {
    const result = await testImportService.extractImportFile({ file: req.file });
    res.json(result);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Document text extraction error:', error);
    res.status(500).json({ error: 'Unable to read this document. Try a searchable PDF or DOCX file.' });
  }
};

exports.previewText = async (req, res) => {
  try {
    const preview = testImportService.previewText({
      text: req.body.text,
      subject: req.body.subject,
      moduleCount: req.body.moduleCount,
    });
    res.json(preview);
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Text import preview error:', error);
    res.status(500).json({ error: 'Unable to parse the supplied text.' });
  }
};
