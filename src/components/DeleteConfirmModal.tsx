import React from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';

export interface DeletePermissionRequest {
  isOpen: boolean;
  title: string;
  message: string;
  itemLabel?: string;
  isBulk?: boolean;
  confirmButtonText?: string;
  onConfirm: () => void;
}

interface DeleteConfirmModalProps {
  request: DeletePermissionRequest | null;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  request,
  onCancel,
}) => {
  if (!request || !request.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border-2 border-rose-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Warning Header */}
        <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              {request.isBulk ? (
                <ShieldAlert className="w-6 h-6 text-white" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-black/25 px-2 py-0.5 rounded-full text-rose-100 block w-fit mb-0.5">
                ডিলিট পারমিশন ও নিশ্চিতকরণ
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                {request.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {request.itemLabel && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs sm:text-sm font-black text-rose-950 break-all">
                {request.itemLabel}
              </span>
            </div>
          )}

          <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
            {request.message}
          </p>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              সতর্কতা: আপনি কি নিশ্চিতভাবে এটি ডিলিট করার অনুমতি দিচ্ছেন? ডিলিট করার পর এটি তালিকা ও ক্লাউড থেকে মুছে যাবে।
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold text-xs transition-all cursor-pointer"
            >
              না, বাতিল করুন
            </button>
            <button
              type="button"
              onClick={() => {
                const fn = request.onConfirm;
                onCancel();
                fn();
              }}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{request.confirmButtonText || 'হ্যাঁ, ডিলিট করুন'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
