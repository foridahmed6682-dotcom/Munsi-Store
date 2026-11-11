import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import {
  getCachedOfflineObjectUrl,
  getProductImageFromIndexedDB,
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
  const rawUrl = product?.imageUrl && !product.imageUrl.startsWith('blob:') ? product.imageUrl : '';
  const initialBlobUrl =
    product?._offlineBlobUrl || (productId ? getCachedOfflineObjectUrl(productId) : undefined) || '';

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [idbBlobUrl, setIdbBlobUrl] = useState<string>(initialBlobUrl);
  const [preferBlob, setPreferBlob] = useState<boolean>(false);
  const [failedAll, setFailedAll] = useState<boolean>(false);

  // Sync network online/offline status
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setFailedAll(false);
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

  // Keep in sync with product props & IndexedDB background Blob cache
  useEffect(() => {
    setFailedAll(false);
    setPreferBlob(false);

    const memUrl =
      product?._offlineBlobUrl || (productId ? getCachedOfflineObjectUrl(productId) : undefined) || '';
    if (memUrl) {
      setIdbBlobUrl(memUrl);
    } else if (productId) {
      let active = true;
      getProductImageFromIndexedDB(productId).then((url) => {
        if (active && url) {
          setIdbBlobUrl(url);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [productId, rawUrl, product?._offlineBlobUrl]);

  useEffect(() => {
    if (!productId) return;
    return subscribeOfflineImageCache(() => {
      const latest = getCachedOfflineObjectUrl(productId);
      if (latest) {
        setIdbBlobUrl(latest);
        setFailedAll(false);
      }
    });
  }, [productId]);

  const effectiveBlob =
    idbBlobUrl || product?._offlineBlobUrl || (productId ? getCachedOfflineObjectUrl(productId) : '') || '';

  let activeSrc = '';
  if (!isOnline || preferBlob) {
    activeSrc = effectiveBlob || (isOnline ? rawUrl : '');
  } else {
    activeSrc = rawUrl || effectiveBlob;
  }

  // If offline and blob isn't loaded into state yet, try fetching from IndexedDB directly
  useEffect(() => {
    if (!isOnline && !effectiveBlob && productId) {
      let active = true;
      getProductImageFromIndexedDB(productId).then((url) => {
        if (active && url) {
          setIdbBlobUrl(url);
          setFailedAll(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [isOnline, effectiveBlob, productId]);

  const handleImgError = async () => {
    // If we were trying remote/raw URL and haven't tried the offline Blob yet
    if (activeSrc && activeSrc !== effectiveBlob) {
      if (effectiveBlob) {
        setPreferBlob(true);
        return;
      }
      if (productId) {
        const fetchedBlob = await getProductImageFromIndexedDB(productId);
        if (fetchedBlob) {
          setIdbBlobUrl(fetchedBlob);
          setPreferBlob(true);
          return;
        }
      }
    }
    setFailedAll(true);
  };

  if (!activeSrc || failedAll) {
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
      onError={handleImgError}
    />
  );
};
