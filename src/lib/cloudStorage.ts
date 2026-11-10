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

// Helper function to enforce strict timeout so uploads NEVER hang indefinitely
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

// Flag to avoid repeatedly waiting on inactive Firebase Storage buckets
let isFirebaseStorageDisabled = false;

/**
 * Uploads a Data URL (base64) or File object to permanent lightweight storage.
 * Prioritizes high-speed zero-cost server image storage (/uploads/) for Firebase Free Plan (Spark),
 * with seamless Firebase Cloud Storage support if available.
 */
export async function uploadImageToCloudStorage(
  imageSource: string | File | Blob,
  folder: string = 'products',
  customId?: string
): Promise<string> {
  // If it's already an external or server-hosted clean URL, don't re-upload
  if (typeof imageSource === 'string' && isCloudStorageUrl(imageSource)) {
    return imageSource;
  }

  const timestamp = Date.now();
  const safeId = (customId || `img-${timestamp}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}_${timestamp.toString().slice(-5)}.webp`;
  const storagePath = `${folder}/${filename}`;

  // Cache in browser IndexedDB for 100% zero-latency offline loading
  if (customId && imageSource) {
    saveProductImageToIndexedDB(customId, imageSource as any).catch(() => {});
  }

  // Convert File / Blob to Data URL if needed
  let dataUrlString: string | null = null;
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    dataUrlString = imageSource;
  } else if (imageSource instanceof File || imageSource instanceof Blob) {
    try {
      dataUrlString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageSource);
      });
    } catch {
      dataUrlString = null;
    }
  }

  // ATTEMPT 1: High-Speed Server Storage Bridge (/api/images/upload)
  // 100% free on Firebase Spark plan, zero cloud bills, saves 99% Firestore space
  if (dataUrlString) {
    try {
      const fetchPromise = fetch('/api/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: dataUrlString,
          customId: safeId,
        }),
      });

      const res = await withTimeout(fetchPromise, 6000, 'Server image upload timed out');
      if (res.ok) {
        const data = await res.json();
        if (data.url && typeof data.url === 'string') {
          return data.url;
        }
      }
    } catch (serverErr) {
      console.warn('[Server Storage] Direct bridge unavailable, attempting cloud storage fallback:', serverErr);
    }
  }

  // ATTEMPT 2: Direct Firebase Cloud Storage Upload (if bucket is active)
  if (storage && !isFirebaseStorageDisabled) {
    try {
      const storageRef = ref(storage, storagePath);

      if (dataUrlString) {
        const match = dataUrlString.match(/^data:([^;]+);base64,/);
        const contentType = match ? match[1] : 'image/webp';

        await withTimeout(
          uploadString(storageRef, dataUrlString, 'data_url', {
            contentType,
            cacheControl: 'public, max-age=31536000',
          }),
          3500,
          'Firebase Cloud Storage upload timed out'
        );
      } else if (imageSource instanceof File || imageSource instanceof Blob) {
        await withTimeout(
          uploadBytes(storageRef, imageSource, {
            contentType: imageSource.type || 'image/webp',
            cacheControl: 'public, max-age=31536000',
          }),
          3500,
          'Firebase Cloud Storage upload timed out'
        );
      }

      const downloadUrl = await withTimeout(
        getDownloadURL(storageRef),
        2500,
        'Firebase Storage getDownloadURL timed out'
      );
      return downloadUrl;
    } catch (err: any) {
      console.warn(`[Cloud Storage] Firebase Storage not active on free plan:`, err?.message || err);
      if (err?.message?.includes('bucket') || err?.message?.includes('404') || err?.message?.includes('timed out')) {
        isFirebaseStorageDisabled = true;
      }
    }
  }

  // If server bridge already saved or dataUrl exists, return dataUrl fallback
  if (dataUrlString) {
    return dataUrlString;
  }

  throw new Error('ছবি সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
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

  // Pre-flight check on the first item to verify storage bridge
  let firstCleanUrl: string | null = null;
  try {
    const testProd = needsMigration[0];
    const testUrl = await uploadImageToCloudStorage(testProd.imageUrl!, 'products', testProd.id);
    if (isCloudStorageUrl(testUrl)) {
      firstCleanUrl = testUrl;
    }
  } catch (err: any) {
    console.warn('[Cloud Storage Migration] Preflight check failed:', err?.message || err);
  }

  const updatedProducts = [...products];
  let migratedCount = 0;
  let failedCount = 0;
  let bucketNeedsActivation = false;

  // Apply the preflight URL for item 0 if successful
  if (firstCleanUrl && needsMigration[0]) {
    const firstIdx = updatedProducts.findIndex((p) => p.id === needsMigration[0].id);
    if (firstIdx >= 0) {
      updatedProducts[firstIdx] = { ...updatedProducts[firstIdx], imageUrl: firstCleanUrl };
      migratedCount++;
    }
  }

  const startIndex = firstCleanUrl ? 1 : 0;
  for (let i = startIndex; i < needsMigration.length; i++) {
    const prod = needsMigration[i];
    if (onProgress) {
      onProgress(i + 1, needsMigration.length, prod.banglaName || prod.name);
    }

    try {
      // 1. Upload to Cloud Storage or Server Bridge
      const cleanUrl = await uploadImageToCloudStorage(prod.imageUrl!, 'products', prod.id);

      // Verify that the returned URL is an actual clean link and NOT the original Base64
      if (isCloudStorageUrl(cleanUrl)) {
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
      if (err?.message?.includes('404') || err?.message?.includes('unknown') || err?.message?.includes('timed out')) {
        bucketNeedsActivation = true;
        // Don't keep hammering if storage is unreachable
        break;
      }
    }

    // Small delay between uploads
    await new Promise((r) => setTimeout(r, 60));
  }

  return { updatedProducts, migratedCount, failedCount, bucketNeedsActivation };
}
