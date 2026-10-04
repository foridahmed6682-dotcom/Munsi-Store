import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { Product } from '../types';

interface ProductImageLightboxModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (qty: number) => void;
  cartQty?: number;
  onOpenDetails?: () => void;
}

export const ProductImageLightboxModal: React.FC<ProductImageLightboxModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  cartQty = 0,
  onOpenDetails
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset zoom on product change or close
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setPosition({ x: 0, y: 0 });
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, product?.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(3, +(prev + 0.3).toFixed(1)));
      } else if (e.key === '-' || e.key === '_') {
        setZoomLevel((prev) => Math.max(1, +(prev - 0.3).toFixed(1)));
      } else if (e.key === '0') {
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const effectivePrice =
    product.discountPrice && product.discountPrice < product.unitPrice
      ? product.discountPrice
      : product.unitPrice;
  const hasDiscount = effectivePrice < product.unitPrice;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(3, +(prev + 0.4).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1, +(prev - 0.4).toFixed(1));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const toggleZoom = () => {
    if (zoomLevel === 1) {
      setZoomLevel(1.8);
    } else {
      setZoomLevel(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/92 backdrop-blur-xl animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="w-full flex items-center justify-between px-4 sm:px-8 py-3.5 bg-black/40 backdrop-blur-md border-b border-white/10 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-xl bg-[#E21E26]/20 border border-[#E21E26]/40 flex items-center justify-center shrink-0">
            <Maximize2 className="w-4 h-4 text-[#E21E26]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-white text-sm sm:text-base font-black truncate leading-tight">
              {product.banglaName}
            </h2>
            <p className="text-xs text-neutral-400 truncate flex items-center gap-2">
              <span>{product.category}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">
                ৳{effectivePrice.toLocaleString('en-IN')}{' '}
                <span className="text-[10px] text-neutral-400 font-normal">
                  / {product.unit || 'পিস'}
                </span>
              </span>
              {hasDiscount && (
                <span className="text-[11px] text-neutral-500 line-through">
                  ৳{product.unitPrice}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Zoom Controls & Close Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              title="জুম কমান"
              className="p-1.5 rounded-lg text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-white px-2 min-w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              title="জুম বাড়ান"
              className="p-1.5 rounded-lg text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                title="রিসেট"
                className="p-1.5 rounded-lg text-amber-400 hover:bg-white/15 transition-all ml-1 border-l border-white/10 pl-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-[#E21E26] text-white flex items-center justify-center transition-all border border-white/10"
            title="বন্ধ করুন (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center p-3 sm:p-6"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        {/* Soft Studio Background Pedestal */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleZoom();
          }}
          className="relative max-w-2xl max-h-[72vh] rounded-3xl p-3 sm:p-6 shadow-2xl flex items-center justify-center transition-transform duration-200"
          style={{
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0.98) 0%, rgba(246,248,251,0.95) 60%, rgba(235,239,245,0.92) 100%)',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.6)',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.banglaName}
              draggable={false}
              referrerPolicy="no-referrer"
              className="max-h-[62vh] max-w-[85vw] sm:max-w-xl object-contain drop-shadow-md select-none rounded-xl"
            />
          ) : (
            <div className="w-64 h-64 flex flex-col items-center justify-center text-[#E21E26]">
              <span className="font-black text-7xl mb-2">{product.banglaName[0]}</span>
              <span className="text-xs font-bold text-neutral-500">কোনো ছবি নেই</span>
            </div>
          )}

          {/* Studio Watermark / Brand Badge */}
          <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-xs border border-black/5 text-[9px] font-black text-neutral-600 flex items-center gap-1 shadow-2xs pointer-events-none">
            <Sparkles className="w-2.5 h-2.5 text-[#E21E26]" />
            <span>স্টুডিও ভিউ</span>
          </div>
        </div>

        {/* Mobile Zoom Hint */}
        {zoomLevel === 1 && (
          <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/80 text-[10px] px-3 py-1 rounded-full pointer-events-none backdrop-blur-xs">
            ছবিতে ট্যাপ করে বড় করুন
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div
        className="w-full bg-black/50 backdrop-blur-md border-t border-white/10 px-4 sm:px-8 py-3.5 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Details Button */}
          {onOpenDetails && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDetails();
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all border border-white/10 shrink-0"
            >
              <span>বিস্তারিত দেখুন</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Add to Cart CTA */}
          {onAddToCart && (
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => {
                onAddToCart(cartQty > 0 ? cartQty + 1 : 1);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#E21E26] hover:bg-[#c91820] active:scale-98 disabled:opacity-50 disabled:hover:bg-[#E21E26] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {product.stock <= 0
                  ? 'স্টক আউট'
                  : cartQty > 0
                  ? `ব্যাগে আরও যোগ করুন (${cartQty}টি আছে)`
                  : 'ব্যাগে যোগ করুন'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
