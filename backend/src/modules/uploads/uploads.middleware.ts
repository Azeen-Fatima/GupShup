import multer from 'multer';
import { BadRequestError } from '../../utils/errors';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.memoryStorage();

function fileFilter(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only image files (jpeg, png, webp, gif) are allowed', 'INVALID_FILE_TYPE'));
  }
}

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 2MB
  fileFilter,
}).single('file');

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
}).single('file');
