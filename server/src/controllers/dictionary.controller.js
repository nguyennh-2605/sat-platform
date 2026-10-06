const dictionaryService = require('../services/dictionary.service');

exports.lookup = async (req, res, next) => {
  try {
    const data = await dictionaryService.lookup(req.params.word);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, message: data.found ? 'Definition found.' : 'No definition found.', data });
  } catch (error) { return next(error); }
};
