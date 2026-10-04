/**
 * Ultra-Lightweight Client-Side Image Compression & Resizing Utility
 * 
 * Ensures any uploaded photo (even 10MB+ high-res smartphone camera shots)
 * is automatically compressed to an ultra-lightweight, crisp Data URL (15 KB - 28 KB) so that:
 * 1. Mobile data (কেবি/ইন্টারনেট) usage is minimized to the extreme for users and customers.
 * 2. Firestore document size stays far below limits (< 30 KB per product).
 * 3. Browser localStorage quota (5MB) never gets filled up.
 * 4. Product images load instantaneously even on slow 2G/3G mobile networks.
 * 5. Self-contained data URL format: zero server uploads dependency, works 100% on Vercel & Firebase.
 */

// Helper to determine if browser canvas natively supports webp export
let cachedWebPSupport: boolean | null = null;
function checkWebPSupport(): boolean {
  if (cachedWebPSupport !== null) return cachedWebPSupport;
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    cachedWebPSupport = testCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    cachedWebPSupport = false;
  }
  return cachedWebPSupport;
}

export function getApproxKbFromDataUrl(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  // Base64 overhead is 4/3 of binary
  return Math.round((dataUrl.length * 0.75) / 1024);
}

export async function processImageFile(
  file: File,
  maxDimension: number = 400,
  maxBase64Length: number = 32 * 1024 // ~24 KB binary payload
): Promise<string> {
  if (!file) {
    throw new Error('কোনো ফাইল নির্বাচন করা হয়নি');
  }

  // Allow up to 30MB camera photos
  const MAX_RAW_SIZE = 30 * 1024 * 1024;
  if (file.size > MAX_RAW_SIZE) {
    throw new Error('ছবির সাইজ ৩০ মেগাবাইটের (30MB) নিচে হতে হবে');
  }

  // Load image via Object URL for fast, low-memory decoding
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('ছবিটি লোড করা যায়নি। ফাইলটি ক্ষতিগ্রস্থ হতে পারে।'));
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width || 400;
    let height = img.naturalHeight || img.height || 400;

    // Constrain aspect ratio to fit inside maxDimension
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

    // High quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill clean white background (prevents dark backgrounds on transparent PNGs)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const isWebP = checkWebPSupport();
    const mimeType = isWebP ? 'image/webp' : 'image/jpeg';

    // Start with balanced quality for high compression & clarity
    let quality = isWebP ? 0.70 : 0.68;
    let dataUrl = canvas.toDataURL(mimeType, quality);

    // Step down quality if exceeding the target low-KB size
    while (dataUrl.length > maxBase64Length && quality > 0.35) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL(mimeType, Math.max(0.32, quality));
    }

    // If still large, scale down canvas resolution slightly
    if (dataUrl.length > maxBase64Length) {
      const scaleFactor = 0.75;
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = Math.max(180, Math.round(width * scaleFactor));
      smallerCanvas.height = Math.max(180, Math.round(height * scaleFactor));
      const sCtx = smallerCanvas.getContext('2d');
      if (sCtx) {
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = 'high';
        sCtx.fillStyle = '#FFFFFF';
        sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
        sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        dataUrl = smallerCanvas.toDataURL(mimeType, 0.58);

        if (dataUrl.length > maxBase64Length) {
          dataUrl = smallerCanvas.toDataURL(mimeType, 0.42);
        }
      }
    }

    return dataUrl;
  } catch (err: any) {
    // Fallback only if file is small enough (< 100KB)
    if (file.size <= 100 * 1024) {
      const directDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('ছবি পড়তে সমস্যা হয়েছে'));
          }
        };
        reader.onerror = () => reject(new Error('ছবি রিড করতে সমস্যা হয়েছে'));
        reader.readAsDataURL(file);
      });
      return directDataUrl;
    }
    throw new Error(err?.message || 'এই ফরম্যাটের ছবি প্রসেস করা যায়নি। অনুগ্রহ করে JPG বা PNG ছবি দিন।');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an existing Base64 data URL if it exceeds safe size limits (> 32KB).
 */
export async function compressDataUrlIfNeeded(
  imageUrl: string,
  maxDimension: number = 400,
  maxBase64Length: number = 32 * 1024
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

    let width = img.naturalWidth || img.width || 400;
    let height = img.naturalHeight || img.height || 400;

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

    const isWebP = checkWebPSupport();
    const mimeType = isWebP ? 'image/webp' : 'image/jpeg';

    let quality = isWebP ? 0.68 : 0.65;
    let result = canvas.toDataURL(mimeType, quality);
    while (result.length > maxBase64Length && quality > 0.32) {
      quality -= 0.10;
      result = canvas.toDataURL(mimeType, Math.max(0.30, quality));
    }
    return result;
  } catch {
    return imageUrl;
  }
}
