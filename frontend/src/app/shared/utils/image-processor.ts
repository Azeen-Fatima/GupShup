/**
 * Image processing utilities for avatar and chat attachments
 */

export async function processAvatarImage(file: File): Promise<File> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG, and WebP images are allowed for avatars.');
  }

  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxBytes) {
    throw new Error('Photo must be smaller than 10 MB');
  }

  const img = await loadImageFromFile(file);

  // Center-crop square, max 512x512
  const maxDim = 512;
  const minSide = Math.min(img.width, img.height);
  const targetSize = Math.min(maxDim, minSide);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context');
  }

  // Calculate center-crop coordinates
  const sx = (img.width - minSide) / 2;
  const sy = (img.height - minSide) / 2;

  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas image conversion failed'));
      },
      'image/jpeg',
      0.8
    );
  });

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export async function processChatImage(file: File): Promise<File> {
  const maxBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxBytes) {
    throw new Error('File must be smaller than 5 MB');
  }

  // Only process images; documents pass through
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Preserve animated GIFs
  if (file.type === 'image/gif') {
    return file;
  }

  const img = await loadImageFromFile(file);
  const maxDimension = 1600;

  // Determine if resize is necessary
  const longestSide = Math.max(img.width, img.height);
  if (longestSide <= maxDimension && file.type === 'image/jpeg') {
    return file;
  }

  let targetWidth = img.width;
  let targetHeight = img.height;

  if (longestSide > maxDimension) {
    if (img.width >= img.height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((img.height / img.width) * maxDimension);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((img.width / img.height) * maxDimension);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context');
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Preserve PNG if input is PNG (to keep potential alpha channel transparency)
  const isPng = file.type === 'image/png';
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const quality = isPng ? undefined : 0.8;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas image compression failed'));
      },
      mimeType,
      quality
    );
  });

  const extension = isPng ? '.png' : '.jpg';
  const newName = file.name.replace(/\.[^.]+$/, '') + extension;

  return new File([blob], newName, { type: mimeType });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };
    img.src = url;
  });
}
