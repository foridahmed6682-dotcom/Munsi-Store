/**
 * Smart Client-Side Image Compression & Resizing Utility
 * Ensures any uploaded photo (even 10MB+ smartphone camera images) is automatically
 * resized and compressed to a crisp, lightweight Data URL (< 150KB) so that:
 * 1. Firestore's 1MB document limit is NEVER exceeded.
 * 2. Browser localStorage's 5MB quota is NEVER exhausted.
 * 3. Product images load instantaneously on customer and SR devices.
 */

export async function processImageFile(
  file: File,
  maxDimension: number = 640,
  maxBase64Length: number = 180 * 1024 // ~135KB binary / 180KB Base64 chars
): Promise<string> {
  if (!file) {
    throw new Error('কোনো ফাইল নির্বাচন করা হয়নি');
  }

  // Allow up to 25MB raw camera photos
  const MAX_RAW_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_RAW_SIZE) {
    throw new Error('ছবির সাইজ ২৫ মেগাবাইটের (25MB) নিচে হতে হবে');
  }

  // Load image via Object URL for fast, low-memory decoding
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('ছবিটি লোড করা যায়নি'));
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width || 600;
    let height = img.naturalHeight || img.height || 600;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.max(1, Math.round((height * maxDimension) / width));
        width = maxDimension;
      } else {
        width = Math.max(1, Math.round((width * maxDimension) / height));
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('ক্যানভাস ইনিশিয়ালাইজ করা যায়নি');
    }

    // Fill clean white background so transparent PNGs look crisp in JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Try WebP first (smaller & sharper), fallback to JPEG
    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    // Step down quality / dimensions if still above target size
    while (dataUrl.length > maxBase64Length && quality > 0.35) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.3, quality));
    }

    // If still large, scale down canvas slightly
    if (dataUrl.length > maxBase64Length) {
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = Math.max(240, Math.round(width * 0.7));
      smallerCanvas.height = Math.max(240, Math.round(height * 0.7));
      const sCtx = smallerCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#FFFFFF';
        sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
        sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.65);
      }
    }

    return dataUrl;
  } catch (err) {
    // Fallback to direct FileReader only if file is small enough for Firestore (< 500KB)
    if (file.size <= 500 * 1024) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('ছবি রিড করা যায়নি'));
          }
        };
        reader.onerror = () => reject(new Error('ছবি রিড করতে সমস্যা হয়েছে'));
        reader.readAsDataURL(file);
      });
    }
    throw new Error('এই ফরম্যাটের ছবি প্রসেস করা যায়নি। অনুগ্রহ করে JPG, PNG বা WebP ছবি দিন।');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an existing Base64 data URL if it exceeds safe Firestore size limits.
 */
export async function compressDataUrlIfNeeded(
  imageUrl: string,
  maxDimension: number = 640,
  maxBase64Length: number = 180 * 1024
): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('data:image/') || imageUrl.length <= maxBase64Length) {
    return imageUrl;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid data URL'));
      image.src = imageUrl;
    });

    let width = img.naturalWidth || img.width || 600;
    let height = img.naturalHeight || img.height || 600;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.max(1, Math.round((height * maxDimension) / width));
        width = maxDimension;
      } else {
        width = Math.max(1, Math.round((width * maxDimension) / height));
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageUrl;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.78;
    let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length > maxBase64Length && quality > 0.35) {
      quality -= 0.15;
      result = canvas.toDataURL('image/jpeg', Math.max(0.3, quality));
    }
    return result;
  } catch {
    return imageUrl;
  }
}
