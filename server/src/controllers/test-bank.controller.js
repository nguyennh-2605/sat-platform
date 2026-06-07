const ApiError = require('../utils/ApiError');
const testBankService = require('../services/test-bank.service');

exports.createFolder = async (req, res) => {
  try {
    const newFolder = await testBankService.createFolder({
      name: req.body.name,
      parentId: req.body.parentId,
      userId: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: 'Tạo thư mục thành công',
      data: newFolder
    });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error('Lỗi khi tạo thư mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo thư mục' });
  }
};

exports.getFolderContent = async (req, res) => {
  try {
    const data = await testBankService.getFolderContent({
      folderId: req.params.folderId || req.query.folderId,
      userId: req.user.userId,
    });
    return res.status(200).json({ success: true, message: 'Lấy dũ liệu thành công', data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi khi lấy dữ liệu Folder", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi lấy dữ liệu" });
  }
};

exports.getAllFolders = async (req, res) => {
  try {
    const folders = await testBankService.getAllFolders({ userId: req.user.userId });
    return res.status(200).json({ success: true, message: "Lấy danh sách thư mục thành công", data: folders });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi khi lấy tất cả Folder:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi lấy dữ liệu" });
  }
};

exports.deleteItems = async (req, res) => {
  try {
    await testBankService.deleteItems({
      folderIds: req.body.folderIds,
      testIds: req.body.testIds,
      userId: req.user.userId,
    });
    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi khi xóa", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi xóa dữ liệu" });
  }
};

exports.moveItems = async (req, res) => {
  try {
    await testBankService.moveItems({
      folderIds: req.body.folderIds,
      testIds: req.body.testIds,
      destinationFolderId: req.body.destinationFolderId,
      userId: req.user.userId,
    });
    return res.status(200).json({ success: true, message: "Di chuyển thành công" });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
    console.error("Lỗi khi di chuyển", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi di chuyển" });
  }
};
