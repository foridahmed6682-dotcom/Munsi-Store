import React from 'react';
import { Download, Printer, Share2, Copy, Check, X, Store, Calendar, Phone, MapPin } from 'lucide-react';
import { Order } from '../types';
import { getBusinessInfo } from '../lib/firebase';

interface MemoModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemoModal: React.FC<MemoModalProps> = ({ order, isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !order) return null;

  const biz = getBusinessInfo();

  const handlePrint = () => {
    window.print();
  };

  const getMemoShareText = () => {
    const lines = [
      `*${biz.banglaName} - সেলস অর্ডার মেমো*`,
      `মেমো নং: ${order.memoNumber}`,
      `তারিখ: ${new Date(order.orderDate).toLocaleString('en-GB')}`,
      `---------------------------------`,
      `দোকানের নাম: ${order.shopName}`,
      `মোবাইল: ${order.shopPhone}`,
      `ঠিকানা: ${order.shopAddress}`,
      `---------------------------------`,
      `পণ্যসমূহ:`,
      ...order.items.map(
        (it, idx) => `${idx + 1}. ${it.productName} - ${it.quantity} ${it.unit} @ ৳${it.unitPrice} = ৳${it.lineTotal}`
      ),
      `---------------------------------`,
      `সাবটোটাল: ৳${order.subTotal}`,
      order.discountAmount > 0 ? `ছাড়/ডিসকাউন্ট: ৳${order.discountAmount}` : null,
      `নিট মোট: ৳${order.netTotal}`,
      `জমা/নগদ: ৳${order.paidAmount}`,
      `বর্তমান বাকী: ৳${order.dueAmount}`,
      `পূর্বের বকেয়া: ৳${order.previousDueAtBooking}`,
      `*মোট বকেয়া জের: ৳${order.totalOutstandingAfterOrder}*`,
      `পেমেন্ট ধরন: ${order.paymentMethod}`,
      `---------------------------------`,
      `${biz.banglaName} এর সাথে থাকার জন্য ধন্যবাদ!`,
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getMemoShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getMemoShareText());
    const phone = order.shopPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '88' + phone : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Action Bar (Hidden in Print) */}
        <div className="bg-neutral-800 text-white px-4 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-emerald-600 px-2 py-0.5 rounded text-white">
              অর্ডার কনফার্মড
            </span>
            <span className="text-sm font-semibold text-neutral-200">{order.memoNumber}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleCopyText}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs flex items-center gap-1"
              title="মেমো কপি করুন"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0"
              title="দোকানদারের হোয়াটসঅ্যাপে পাঠান"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">হোয়াটসঅ্যাপ</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0"
              title="মেমো পিডিএফ হিসেবে ডাউনলোড করুন"
            >
              <Download className="w-4 h-4" />
              <span>পিডিএফ ডাউনলোড</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0"
              title="সরাসরি প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span>সরাসরি প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Memo Content */}
        <div id="printable-memo" className="p-4 sm:p-6 overflow-y-auto font-sans text-neutral-800">
          {/* Slip Header */}
          <div className="text-center pb-3 border-b border-dashed border-neutral-300">
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">{biz.banglaName}</h2>
            <p className="text-xs text-neutral-600 font-medium">{biz.tagline}</p>
            <p className="text-[11px] text-neutral-500">{biz.address} | হটলাইন: {biz.hotline}</p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 py-3 text-xs border-b border-neutral-200">
            <div>
              <p className="font-bold text-neutral-900 text-sm">{order.shopName}</p>
              <p className="text-neutral-600 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-neutral-400" /> {order.shopPhone}
              </p>
              <p className="text-neutral-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-neutral-400" /> {order.shopAddress} ({order.shopRoute})
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="font-semibold text-neutral-900">মেমো: {order.memoNumber}</p>
              <p className="text-neutral-500">
                {new Date(order.orderDate).toLocaleDateString('en-GB')} {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[11px]">
                স্ট্যাটাস:{' '}
                <span className={`font-semibold ${order.deliveryStatus === 'DELIVERED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {order.deliveryStatus === 'DELIVERED' ? 'ডেলিভারি সম্পন্ন' : 'ডেলিভারি অপেক্ষমান'}
                </span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2.5">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-neutral-300 text-neutral-500 font-semibold">
                  <th className="py-1.5 w-6">#</th>
                  <th className="py-1.5">পণ্যের বিবরণ</th>
                  <th className="py-1.5 text-center">পরিমাণ</th>
                  <th className="py-1.5 text-right">দর (৳)</th>
                  <th className="py-1.5 text-right">মোট (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="py-1.5">
                    <td className="py-1.5 text-neutral-400">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-neutral-900">
                      {item.productName}
                      {item.tradeOfferQty ? (
                        <span className="block text-[10px] text-emerald-600 font-semibold">
                          + ফ্রি: {item.tradeOfferQty} {item.unit}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-center">
                      <span className="font-semibold text-neutral-800">{item.quantity}</span>{' '}
                      <span className="text-[10px] text-neutral-500">{item.unit}</span>
                    </td>
                    <td className="py-1.5 text-right text-neutral-700">৳{item.unitPrice}</td>
                    <td className="py-1.5 text-right font-semibold text-neutral-900">
                      ৳{item.lineTotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="border-t border-neutral-200 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>সাবটোটাল মূল্য:</span>
              <span className="font-semibold">৳{order.subTotal.toLocaleString()}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>ছাড় / ক্যাশ ডিসকাউন্ট ({order.discountPercent}%):</span>
                <span>-৳{order.discountAmount.toLocaleString()}</span>
              </div>
            )}

            {/* Layout as requested: Mot, Agrim, Baki formatted exactly like handwritten cash memo slip */}
            <div className="flex justify-end mt-3">
              <table className="w-56 border-collapse border border-neutral-400 text-xs font-bold">
                <tbody>
                  <tr className="border-b border-neutral-400">
                    <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left w-24">
                      মোট
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-neutral-900 text-sm">
                      ৳{order.netTotal.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-400">
                    <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left">
                      অগ্রিম
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-emerald-700 text-sm">
                      ৳{order.paidAmount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left">
                      বাঁকী
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono text-sm ${order.dueAmount > 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
                      ৳{order.dueAmount.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-between text-neutral-500 text-[11px] pt-2 border-t border-neutral-200">
              <span>পূর্বে অপরিশোধিত বকেয়া:</span>
              <span>৳{order.previousDueAtBooking.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-neutral-900 bg-neutral-100 p-2 rounded-lg mt-1.5">
              <span>মোট বকেয়া জের (Current Due):</span>
              <span className="text-rose-700">৳{order.totalOutstandingAfterOrder.toLocaleString()}</span>
            </div>
          </div>

          {order.notes && (
            <div className="mt-3 p-2 bg-neutral-50 rounded-lg text-xs text-neutral-600 border border-neutral-200">
              <span className="font-semibold text-neutral-700">বিশেষ দ্রষ্টব্য:</span> {order.notes}
            </div>
          )}

          {/* Footer Signature Notice */}
          <div className="mt-6 pt-4 border-t border-dashed border-neutral-300 grid grid-cols-2 text-center text-[10px] text-neutral-500">
            <div>
              <div className="w-24 border-b border-neutral-400 mx-auto mb-1"></div>
              <span>দোকানদারের স্বাক্ষর</span>
            </div>
            <div>
              <div className="w-24 border-b border-neutral-400 mx-auto mb-1"></div>
              <span>বিক্রয় প্রতিনিধির স্বাক্ষর</span>
            </div>
          </div>

          <p className="text-center text-[10px] text-neutral-400 mt-4">
            সফটওয়্যার জেনারেটেড মেমো | অফলাইন ও ক্লাউড সিঙ্কড
          </p>
        </div>

        {/* Modal Bottom Close */}
        <div className="bg-neutral-50 border-t border-neutral-200 p-3 flex justify-end gap-2 no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            সম্পন্ন / বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
