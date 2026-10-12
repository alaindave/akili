import multer from "multer";

export default multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 2 * 1024 * 1024,
    fileSize: 10 * 1024 * 1024,
    files: 100,
  },
});
