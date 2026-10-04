import multer from 'multer';
import { BadRequestError } from '../../utils/errors';

export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
];

const storage = multer.memoryStorage();

function avatarFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only image files (jpeg, png, webp) are allowed for avatar', 'INVALID_FILE_TYPE'));
  }
}

function attachmentFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only images, PDFs, and common documents are allowed', 'INVALID_FILE_TYPE'));
  }
}

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: avatarFileFilter,
}).single('file');

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: attachmentFileFilter,
}).single('file');
