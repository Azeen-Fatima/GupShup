import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../../config/env';
import { BadRequestError, ServiceUnavailableError } from '../../utils/errors';

let isCloudinaryConfigured = false;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  isCloudinaryConfigured = true;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export class UploadsService {
  /**
   * Upload buffer to Cloudinary
   */
  async uploadImage(
    buffer: Buffer,
    folder: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      gravity?: string;
    } = {}
  ): Promise<UploadResult> {
    if (!isCloudinaryConfigured) {
      throw new ServiceUnavailableError(
        'Cloudinary image storage is not configured on this server.',
        'CLOUDINARY_NOT_CONFIGURED'
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [
            {
              width: options.width,
              height: options.height,
              crop: options.crop || 'limit',
              gravity: options.gravity,
              quality: 'auto',
              fetch_format: 'auto',
            },
          ],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(new BadRequestError(error?.message || 'Failed to upload image', 'IMAGE_UPLOAD_FAILED'));
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  /**
   * Delete image from Cloudinary by public ID
   */
  async deleteImage(publicId: string): Promise<void> {
    if (!isCloudinaryConfigured || !publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Ignore cleanup error
    }
  }
}

export const uploadsService = new UploadsService();
