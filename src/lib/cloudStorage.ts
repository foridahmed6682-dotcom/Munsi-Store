/**
 * ============================================================================
 * ☁️ Firebase Cloud Storage & Local Storage Image Integration
 * ============================================================================
 * 
 * Purpose:
 * 1. Upload heavy binary image assets to Firebase Cloud Storage (free of Firestore 1MB limits).
 * 2. Fall back to Server Image Storage (/uploads) if Firebase Cloud Storage bucket is not yet enabled in Console.
 * 3. Return lightweight, permanent URLs (< 100 bytes instead of 30,000+ byte Base64 strings).
 * 4. Cache images locally in IndexedDB so offline mode and fast rendering continue to work 100%.
 * ============================================================================
 */

import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { Product } from '../types';
import { saveProductImageToIndexedDB } from './indexedDb';

/**
 * Checks if an image URL is a remote Cloud, CDN, or server-hosted clean URL (not a heavy Base64 string)
 */
export function isCloudStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/');
}

/**
 * Uploads a Data URL (base64) or File object to Firebase Cloud Storage.
 * Falls back to local server image storage if Firebase Cloud Storage bucket is not yet active.
 */
export async function uploadImageToCloudStorage(
  imageSource: string | File | Blob,
  folder: string = 'products',
  customId?: string
): Promise<string> {
  // If it's already an external or server-hosted URL, don't re-upload
  if (typeof imageSource === 'string' && isCloudStorageUrl(imageSource)) {
    return imageSource;
  }

  const timestamp = Date.now();
  const safeId = (customId || `img-${timestamp}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}_${timestamp.toString().slice(-5)}.webp`;
  const storagePath = `${folder}/${filename}`;

  // Cache in browser IndexedDB for 100% zero-latency offline loading
  if (customId && typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    saveProductImageToIndexedDB(customId, imageSource).catch(() => {});
  }

  let firebaseStorageError: any = null;

  // ATTEMPT 1: Direct Firebase Cloud Storage Upload
  if (storage) {
    try {
      const storageRef = ref(storage, storagePath);

      if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
        const match = imageSource.match(/^data:([^;]+);base64,/);
        const contentType = match ? match[1] : 'image/webp';

        await uploadString(storageRef, imageSource, 'data_url', {
          contentType,
          cacheControl: 'public, max-age=31536000',
        });
      } else if (imageSource instanceof File || imageSource instanceof Blob) {
        await uploadBytes(storageRef, imageSource, {
          contentType: imageSource.type || 'image/webp',
          cacheControl: 'public, max-age=31536000',
        });
      }

      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`[Cloud Storage] Successfully uploaded to Firebase Storage -> ${downloadUrl.slice(0, 60)}...`);
      return downloadUrl;
    } catch (err: any) {
      firebaseStorageError = err;
      console.warn(`[Cloud Storage] Firebase direct upload failed:`, err?.message || err);
    }
  }

  // ATTEMPT 2: Server Storage Bridge Fallback (/api/images/upload)
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    try {
      const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: imageSource,
          customId: safeId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url && typeof data.url === 'string') {
          console.log(`[Server Storage] Successfully converted image to static URL -> ${data.url}`);
          return data.url;
        }
      }
    } catch (serverErr) {
      console.warn('[Server Storage] Local upload bridge unreachable:', serverErr);
    }
  }

  // If both failed, throw error with clear details
  const errMsg = firebaseStorageError?.message || 'Firebase Storage বাকেট এখনও সক্রিয় করা হয়নি।';
  throw new Error(errMsg);
}

/**
 * Batch-migrates all products that currently store base64 Data URLs into Cloud / Server Storage.
 * Permanently cleans Firestore documents and frees 99% of database payload size.
 */
export async function migrateAllProductImagesToCloudStorage(
  products: Product[],
  onProgress?: (completed: number, total: number, currentName: string) => void
): Promise<{
  updatedProducts: Product[];
  migratedCount: number;
  failedCount: number;
  bucketNeedsActivation: boolean;
}> {
  const needsMigration = products.filter(
    (p) => p.imageUrl && p.imageUrl.startsWith('data:')
  );

  if (needsMigration.length === 0) {
    return { updatedProducts: products, migratedCount: 0, failedCount: 0, bucketNeedsActivation: false };
  }

  let migratedCount = 0;
  let failedCount = 0;
  let bucketNeedsActivation = false;
  const updatedProducts = [...products];

  for (let i = 0; i < needsMigration.length; i++) {
    const prod = needsMigration[i];
    if (onProgress) {
      onProgress(i + 1, needsMigration.length, prod.banglaName || prod.name);
    }

    try {
      // 1. Upload to Cloud Storage or Server Bridge
      const cleanUrl = await uploadImageToCloudStorage(prod.imageUrl!, 'products', prod.id);

      // Verify that the returned URL is an actual clean link and NOT the original Base64
      if (isCloudStorageUrl(cleanUrl)) {
        // Also ensure original image stays in local IndexedDB for zero-latency offline display
        if (prod.imageUrl && prod.imageUrl.startsWith('data:')) {
          await saveProductImageToIndexedDB(prod.id, prod.imageUrl).catch(() => {});
        }

        const targetIndex = updatedProducts.findIndex((p) => p.id === prod.id);
        if (targetIndex >= 0) {
          updatedProducts[targetIndex] = {
            ...updatedProducts[targetIndex],
            imageUrl: cleanUrl,
          };
        }

        migratedCount++;
      } else {
        failedCount++;
      }
    } catch (err: any) {
      console.warn(`Failed to migrate product image ${prod.banglaName}:`, err);
      failedCount++;
      if (err?.message?.includes('404') || err?.message?.includes('unknown') || err?.message?.includes('not found')) {
        bucketNeedsActivation = true;
      }
    }

    // Small delay between uploads to avoid overloading network
    await new Promise((r) => setTimeout(r, 60));
  }

  return { updatedProducts, migratedCount, failedCount, bucketNeedsActivation };
}
