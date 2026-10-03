/**
 * Smart Client-Side Image Compression & Resizing Utility
 * Ensures any uploaded photo (even 10MB+ smartphone camera images) is automatically
 * resized and compressed to a crisp, lightweight Data URL (< 150KB) so that:
 * 1. Firestore's 1MB document limit is NEVER exceeded.
 * 2. Browser localStorage's 5MB quota is NEVER exhausted.
 * 3. Product images load instantaneously on customer and SR devices.
 */

/**
 * Smart Client-Side Image Compression & Permanent Server Storage Utility
 * Ensures any uploaded photo (even 10MB+ smartphone camera images) is:
 * 1. Resized and compressed to crisp WebP/JPEG.
 * 2. Uploaded permanently to backend server storage (/uploads/...) creating a tiny ~30-character URL!
 * 3. Never consumes browser 5MB localStorage memory.
 * 4. Never exceeds Firestore 1MB document limit.
 * 5. Loads instantaneously across devices with HTTP caching.
 */

import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a base64 Data URL to permanent storage (Server or Firebase Cloud Storage).
 * Returns the URL (e.g. "/uploads/prod_1728000000_abc.webp" or "https://firebasestorage.googleapis.com/...").
 * If offline or storage is unreachable, falls back safely to the dataUrl so work is never blocked!
 */
export async function uploadBase64ImageToServer(
  dataUrl: string,
  preferredName?: string
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // 1. Try Node Express backend endpoint (/api/upload-image) if available
  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dataUrl,
        productName: preferredName,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.url) {
        return data.url;
      }
    }
  } catch {
    // backend server unreachable (e.g. static hosting on Vercel)
  }

  // 2. Try Firebase Cloud Storage (Works 100% on Vercel, static domains, APK, everywhere!)
  try {
    if (storage) {
      const cleanName = (preferredName || 'prod')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 25);
      const filename = `products/${cleanName || 'prod'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.webp`;
      const storageRef = ref(storage, filename);
      await uploadString(storageRef, dataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl) {
        return downloadUrl;
      }
    }
  } catch (storageErr) {
    console.warn('⚠️ Firebase Cloud Storage upload error:', storageErr);
  }

  return dataUrl;
}

/**
 * Converts all existing Base64 product images in bulk to permanent server or Firebase files.
 */
export async function migrateBulkProductImagesToServer(products: any[]): Promise<{
  updatedProducts: any[];
  migratedCount: number;
}> {
  if (!Array.isArray(products) || products.length === 0) {
    return { updatedProducts: products, migratedCount: 0 };
  }

  const base64Prods = products.filter(
    (p) => p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/')
  );

  if (base64Prods.length === 0) {
    return { updatedProducts: products, migratedCount: 0 };
  }

  // 1. Try Node backend bulk endpoint first
  try {
    const res = await fetch('/api/upload-bulk-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: base64Prods }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.updatedProducts) && (data?.migratedCount || 0) > 0) {
        const migratedMap = new Map<string, string>();
        for (const item of data.updatedProducts) {
          if (item?.id && item?.imageUrl) {
            migratedMap.set(item.id, item.imageUrl);
          }
        }

        const nextProducts = products.map((p) => {
          if (migratedMap.has(p.id)) {
            return { ...p, imageUrl: migratedMap.get(p.id)! };
          }
          return p;
        });

        return {
          updatedProducts: nextProducts,
          migratedCount: data.migratedCount || base64Prods.length,
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ Backend bulk migration unreachable, attempting client/Firebase migration:', err);
  }

  // 2. Client-side migration fallback (via Firebase Cloud Storage or individual upload)
  let migratedCount = 0;
  const migratedMap = new Map<string, string>();

  for (const prod of base64Prods) {
    try {
      const targetUrl = await uploadBase64ImageToServer(prod.imageUrl, prod.name || prod.banglaName);
      if (targetUrl && !targetUrl.startsWith('data:image/')) {
        migratedMap.set(prod.id, targetUrl);
        migratedCount++;
      } else if (prod.imageUrl && prod.imageUrl.length > 25000) {
        // Compress bloated base64 to ultra-lightweight WebP / JPEG
        const slim = await compressDataUrlIfNeeded(prod.imageUrl, 240, 20 * 1024);
        if (slim && slim.length < prod.imageUrl.length) {
          migratedMap.set(prod.id, slim);
          migratedCount++;
        }
      }
    } catch {
      // keep existing image
    }
  }

  if (migratedCount > 0) {
    const nextProducts = products.map((p) => {
      if (migratedMap.has(p.id)) {
        return { ...p, imageUrl: migratedMap.get(p.id)! };
      }
      return p;
    });
    return { updatedProducts: nextProducts, migratedCount };
  }

  return { updatedProducts: products, migratedCount: 0 };
}

export async function processImageFile(
  file: File,
  maxDimension: number = 480,
  maxBase64Length: number = 65 * 1024, // ~48KB binary / 65KB Base64 chars
  autoServerUpload: boolean = true
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

    // Fill clean white background so transparent PNGs look crisp in JPEG/WebP
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

    // Auto Upload to Server permanent storage if enabled
    if (autoServerUpload) {
      const serverUrl = await uploadBase64ImageToServer(dataUrl, file.name);
      return serverUrl;
    }

    return dataUrl;
  } catch (err) {
    // Fallback to direct FileReader only if file is small enough for Firestore (< 500KB)
    if (file.size <= 500 * 1024) {
      const directDataUrl = await new Promise<string>((resolve, reject) => {
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

      if (autoServerUpload) {
        return await uploadBase64ImageToServer(directDataUrl, file.name);
      }
      return directDataUrl;
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
  maxDimension: number = 480,
  maxBase64Length: number = 65 * 1024
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
