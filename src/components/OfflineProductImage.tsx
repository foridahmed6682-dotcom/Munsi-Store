import React, { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import {
  deleteItemFromIndexedDB,
  getCachedImageSourceUrl,
  getCachedOfflineObjectUrl,
  getProductImageFromIndexedDB,
  invalidateCachedOfflineObjectUrl,
  saveProductImageToIndexedDB,
  subscribeOfflineImageCache,
} from '../lib/indexedDb';

interface OfflineProductImageProps {
  product: {
    id?: string;
    imageUrl?: string;
    _offlineBlobUrl?: string;
    banglaName?: string;
    name?: string;
  };
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
  fallback?: React.ReactNode;
}

export const OfflineProductImage: React.FC<OfflineProductImageProps> = ({
  product,
  alt,
  className = 'w-full h-full object-contain',
  loading = 'lazy',
  draggable,
  fallback,
}) => {
  const productId = product?.id || '';
  const rawUrl = product?.imageUrl && !product.imageUrl.startsWith('blob:') ? product.imageUrl.trim() : '';

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [idbBlobUrl, setIdbBlobUrl] = useState<string>(() =>
    (productId ? getCachedOfflineObjectUrl(productId) : undefined) || product?._offlineBlobUrl || ''
  );
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const lastKeyRef = useRef<string>(`${productId}::${rawUrl}`);
  const recoveredBlobOnceRef = useRef<boolean>(false);

  // Sync network online/offline status
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setFailedSrcs([]);
      recoveredBlobOnceRef.current = false;
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Reset error tracking only when productId or rawUrl genuinely changes
  useEffect(() => {
    const nextKey = `${productId}::${rawUrl}`;
    if (lastKeyRef.current !== nextKey) {
      lastKeyRef.current = nextKey;
      setFailedSrcs([]);
      recoveredBlobOnceRef.current = false;
    }
  }, [productId, rawUrl]);

  // Hydrate from in-memory cache or IndexedDB, and proactively cache visible product if online
  useEffect(() => {
    let active = true;
    const memUrl =
      (productId ? getCachedOfflineObjectUrl(productId) : undefined) || product?._offlineBlobUrl || '';
    if (memUrl && !failedSrcs.includes(memUrl)) {
      setIdbBlobUrl(memUrl);
    }

    if (productId) {
      getProductImageFromIndexedDB(productId).then((url) => {
        if (!active) return;
        if (url) {
          setIdbBlobUrl(url);
          setFailedSrcs((prev) => prev.filter((s) => s !== url));
        } else if (isOnline && rawUrl) {
          // Proactively cache visible image in IndexedDB right away
          saveProductImageToIndexedDB(productId, rawUrl).then((ok) => {
            if (!active || !ok) return;
            const latest = getCachedOfflineObjectUrl(productId);
            if (latest) {
              setIdbBlobUrl(latest);
              setFailedSrcs((prev) => prev.filter((s) => s !== latest));
            }
          });
        }
      });
    }

    return () => {
      active = false;
    };
  }, [productId, rawUrl, product?._offlineBlobUrl, isOnline]);

  // Listen for background precacher completion
  useEffect(() => {
    if (!productId) return;
    return subscribeOfflineImageCache(() => {
      const latest = getCachedOfflineObjectUrl(productId);
      if (latest) {
        recoveredBlobOnceRef.current = false;
        setIdbBlobUrl(latest);
        setFailedSrcs((prev) => prev.filter((s) => s !== latest));
      }
    });
  }, [productId]);

  const memCachedBlob = productId ? getCachedOfflineObjectUrl(productId) || '' : '';
  const propBlob = product?._offlineBlobUrl || '';
  const candidateBlob = [memCachedBlob, idbBlobUrl, propBlob].find(
    (b) => b && !failedSrcs.includes(b)
  ) || '';

  const cachedSource = productId ? getCachedImageSourceUrl(productId) : undefined;
  const sourceChangedWhileOnline =
    Boolean(isOnline && rawUrl && cachedSource && cachedSource !== rawUrl);

  // Blob-first strategy: use local binary Blob whenever valid, fall back to rawUrl if online
  const candidates: string[] = [];
  if (sourceChangedWhileOnline) {
    if (rawUrl) candidates.push(rawUrl);
    if (candidateBlob) candidates.push(candidateBlob);
  } else {
    if (candidateBlob) candidates.push(candidateBlob);
    if (isOnline && rawUrl) candidates.push(rawUrl);
  }

  const activeSrc = candidates.find((src) => src && !failedSrcs.includes(src)) || '';

  const handleImgLoad = () => {
    if (productId && rawUrl && activeSrc === rawUrl && isOnline) {
      saveProductImageToIndexedDB(productId, rawUrl).catch(() => {});
    }
  };

  const handleImgError = async () => {
    if (!activeSrc) return;
    setFailedSrcs((prev) => (prev.includes(activeSrc) ? prev : [...prev, activeSrc]));

    if (activeSrc.startsWith('blob:') && productId) {
      invalidateCachedOfflineObjectUrl(productId);
      setIdbBlobUrl('');

      if (!recoveredBlobOnceRef.current) {
        recoveredBlobOnceRef.current = true;
        const refreshed = await getProductImageFromIndexedDB(productId);
        if (refreshed && refreshed !== activeSrc) {
          setIdbBlobUrl(refreshed);
          return;
        }
      }

      // Blob stored in IndexedDB is unreadable or corrupt; remove it so online fetch can replace it cleanly
      await deleteItemFromIndexedDB('productImages', productId).catch(() => false);
      if (isOnline && rawUrl) {
        saveProductImageToIndexedDB(productId, rawUrl).catch(() => {});
      }
    } else if (productId) {
      const fetchedBlob = await getProductImageFromIndexedDB(productId);
      if (fetchedBlob && !failedSrcs.includes(fetchedBlob)) {
        setIdbBlobUrl(fetchedBlob);
      }
    }
  };

  if (!activeSrc) {
    return (
      <>
        {fallback !== undefined ? (
          fallback
        ) : (
          <Package className="w-7 h-7 text-neutral-400" />
        )}
      </>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt || product?.banglaName || product?.name || 'Product'}
      className={className}
      loading={loading}
      draggable={draggable}
      referrerPolicy="no-referrer"
      onLoad={handleImgLoad}
      onError={handleImgError}
    />
  );
};
