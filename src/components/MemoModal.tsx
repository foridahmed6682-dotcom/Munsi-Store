import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  Share2,
  Copy,
  Check,
  X,
  Phone,
  MapPin,
  Edit3,
  Trash2,
  Plus,
  Save,
  Send
} from 'lucide-react';
import { Order, OrderItem, Product } from '../types';
import { getBusinessInfo } from '../lib/firebase';

interface MemoModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  isAdmin?: boolean;
  products?: Product[];
  initialEditMode?: boolean;
}

export const MemoModal: React.FC<MemoModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateOrder,
  onDeleteOrder,
  isAdmin = false,
  products = [],
  initialEditMode = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable state
  const [editShopName, setEditShopName] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopRoute, setEditShopRoute] = useState('');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');

  useEffect(() => {
    if (order && isOpen) {
      setIsEditing(initialEditMode);
      setEditShopName(order.shopName || '');
      setEditShopPhone(order.shopPhone || '');
      setEditShopAddress(order.shopAddress || '');
      setEditShopRoute(order.shopRoute || '');
      setEditItems(order.items.map((it) => ({ ...it })));
    }
  }, [order, isOpen, initialEditMode]);

  if (!isOpen || !order) return null;

  const biz = getBusinessInfo();

  const handlePrint = () => {
    window.print();
  };

  const normalizePhoneForWhatsApp = (rawPhone: string) => {
    const banglaToEng = (rawPhone || '').replace(/[০-৯]/g, (d) =>
      '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()
    );
    const digitsOnly = banglaToEng.replace(/[^0-9]/g, '');
    if (!digitsOnly) return '';
    if (digitsOnly.startsWith('880')) return digitsOnly;
    if (digitsOnly.startsWith('0')) return `88${digitsOnly}`;
    return `880${digitsOnly}`;
  };

  const getMemoShareText = () => {
    const lines = [
      `*${biz.banglaName} - সেলস অর্ডার মেমো*`,
      `মেমো নং: ${order.memoNumber}`,
      `তারিখ: ${new Date(order.orderDate).toLocaleString('en-GB')}`,
      `---------------------------------`,
      `দোকান/ক্রেতা: ${order.shopName}`,
      `মোবাইল: ${order.shopPhone}`,
      `ঠিকানা: ${order.shopAddress}`,
      `---------------------------------`,
      `পণ্যসমূহ:`,
      ...order.items.map(
        (it, idx) =>
          `${idx + 1}. ${it.productName} - ${it.quantity} ${it.unit} @ ৳${it.unitPrice} = ৳${it.lineTotal}`
      ),
      `---------------------------------`,
      `*মোট: ৳${order.netTotal}*`,
      `অগ্রিম: `,
      `বাঁকী: `,
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
    const cleanPhone = normalizePhoneForWhatsApp(order.shopPhone || order.customerPhone || '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  // Edit Item Handlers
  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    setEditItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : item.unitPrice) || 0;
        item.quantity = qty;
        item.unitPrice = price;
        item.lineTotal = qty * price;
      }
      next[index] = item;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (editItems.length <= 1) {
      alert('মেমোতে অন্তত ১টি পণ্য থাকতে হবে।');
      return;
    }
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProductToMemo = () => {
    if (!selectedAddProductId) return;
    const prod = products.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    const existingIdx = editItems.findIndex((i) => i.productId === prod.id);
    if (existingIdx >= 0) {
      handleItemChange(existingIdx, 'quantity', editItems[existingIdx].quantity + 1);
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.banglaName || prod.name,
          unit: prod.unit,
          unitPrice: prod.unitPrice,
          quantity: 1,
          lineTotal: prod.unitPrice,
        },
      ]);
    }
    setSelectedAddProductId('');
  };

  const handleAddCustomRow = () => {
    setEditItems((prev) => [
      ...prev,
      {
        productId: `custom-${Date.now()}`,
        productName: 'নতুন পণ্য',
        unit: 'পিস',
        unitPrice: 100,
        quantity: 1,
        lineTotal: 100,
      },
    ]);
  };

  const editedNetTotal = editItems.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0);

  const handleSaveMemoEdits = () => {
    if (!editShopName.trim()) {
      alert('দোকান বা ক্রেতার নাম লিখুন');
      return;
    }
    if (editItems.length === 0) {
      alert('অন্তত ১টি পণ্য যোগ করুন');
      return;
    }

    const updatedOrder: Order = {
      ...order,
      shopName: editShopName.trim(),
      shopPhone: editShopPhone.trim(),
      shopAddress: editShopAddress.trim(),
      shopRoute: editShopRoute.trim() || order.shopRoute,
      items: editItems,
      subTotal: editedNetTotal,
      netTotal: editedNetTotal,
      dueAmount: Math.max(0, editedNetTotal - (order.paidAmount || 0)),
      totalOutstandingAfterOrder:
        (order.previousDueAtBooking || 0) + Math.max(0, editedNetTotal - (order.paidAmount || 0)),
      syncedWithSheets: false,
    };

    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Action Bar (Hidden in Print) */}
        <div className="bg-neutral-800 text-white px-4 py-3 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold bg-emerald-600 px-2 py-0.5 rounded text-white shrink-0">
              {isEditing ? 'মেমো এডিট মোড' : 'অর্ডার মেমো'}
            </span>
            <span className="text-sm font-semibold text-neutral-200 truncate">{order.memoNumber}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {onUpdateOrder && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs flex items-center gap-1 font-extrabold shadow-xs shrink-0 cursor-pointer"
                title="মেমো এডিট করুন"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>মেমো এডিট</span>
              </button>
            )}
            <button
              onClick={handleCopyText}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              title="মেমো কপি করুন"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="p-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0 cursor-pointer"
              title="এক ক্লিকে হোয়াটসঅ্যাপে মেমো পাঠান"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>হোয়াটসঅ্যাপ</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0 cursor-pointer"
              title="সরাসরি প্রিন্ট বা পিডিএফ সেভ করুন"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>
            {isAdmin && onDeleteOrder && (
              <button
                onClick={() => {
                  if (window.confirm(`আপনি কি নিশ্চিত যে মেমো #${order.memoNumber} স্থায়ীভাবে ডিলিট করতে চান?`)) {
                    onDeleteOrder(order.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs flex items-center gap-1 font-bold shadow-xs shrink-0 cursor-pointer"
                title="মেমো ডিলিট করুন (এডমিন)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1-Click WhatsApp Prominent Quick Banner right after Order Creation (Hidden in Print & Edit) */}
        {!isEditing && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
            <div className="text-xs text-emerald-900 font-semibold flex items-center gap-1.5">
              <Send className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>অর্ডার মেমোটি সরাসরি হোয়াটসঅ্যাপে পাঠাতে ক্লিক করুন:</span>
            </div>
            <button
              onClick={handleShareWhatsApp}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>এক ক্লিকে হোয়াটসঅ্যাপে মেমো দিন ({order.shopPhone || 'WhatsApp'})</span>
            </button>
          </div>
        )}

        {/* EDIT MODE VIEW */}
        {isEditing ? (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
              <span className="font-bold text-amber-900">
                ✏️ মেমো #{order.memoNumber} এডিট করছেন — পরিবর্তন শেষে নিচে সেভ বাটনে ক্লিক করুন
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-neutral-600 hover:text-neutral-900 font-bold underline"
              >
                বাতিল
              </button>
            </div>

            {/* Customer / Shop Metadata Edit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">দোকান / ক্রেতার নাম *</label>
                <input
                  type="text"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 mb-1">মোবাইল নম্বর *</label>
                <input
                  type="text"
                  value={editShopPhone}
                  onChange={(e) => setEditShopPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 mb-1">ঠিকানা</label>
                <input
                  type="text"
                  value={editShopAddress}
                  onChange={(e) => setEditShopAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                />
              </div>
            </div>

            {/* Items Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-neutral-900 text-sm">মেমোর পণ্য তালিকা এডিট করুন</h4>
                <button
                  type="button"
                  onClick={handleAddCustomRow}
                  className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> কাস্টম সারি যোগ
                </button>
              </div>

              {products.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedAddProductId}
                    onChange={(e) => setSelectedAddProductId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-medium"
                  >
                    <option value="">-- ক্যাটালগ থেকে নতুন পণ্য মেমোতে যোগ করুন --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.banglaName || p.name} (৳{p.unitPrice}/{p.unit})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProductToMemo}
                    disabled={!selectedAddProductId}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold disabled:opacity-50 cursor-pointer"
                  >
                    + যোগ করুন
                  </button>
                </div>
              )}

              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-200">
                    <tr>
                      <th className="p-2">পণ্যের নাম</th>
                      <th className="p-2 w-20 text-center">পরিমাণ</th>
                      <th className="p-2 w-20 text-center">একক</th>
                      <th className="p-2 w-24 text-right">দর (৳)</th>
                      <th className="p-2 w-24 text-right">মোট (৳)</th>
                      <th className="p-2 w-10 text-center">বাদ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {editItems.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={it.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded font-medium"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-center font-bold"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={it.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-center"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min="0"
                            value={it.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-right font-mono"
                          />
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-neutral-900">
                          ৳{it.lineTotal.toLocaleString()}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="আইটেম মুছুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 font-black text-sm text-neutral-900">
                <span>পরিবর্তিত সর্বমোট বিল:</span>
                <span className="text-emerald-700 font-mono text-base">৳{editedNetTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveMemoEdits}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>মেমো সেভ করুন</span>
              </button>
            </div>
          </div>
        ) : (
          /* PRINTABLE MEMO CONTENT */
          <div id="printable-memo" className="p-4 sm:p-6 overflow-y-auto font-sans text-neutral-800">
            {/* Slip Header */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-300">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">{biz.banglaName}</h2>
              <p className="text-xs text-neutral-600 font-medium">{biz.tagline}</p>
              <p className="text-[11px] text-neutral-500">
                {biz.address} | হটলাইন: {biz.hotline}
              </p>
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
                  {new Date(order.orderDate).toLocaleDateString('en-GB')}{' '}
                  {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

            {/* Financial Breakdown: Only Total calculated, Advance & Due blank */}
            <div className="border-t border-neutral-200 pt-3 text-xs">
              <div className="flex justify-end">
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
                      <td className="px-3 py-1.5 text-right font-mono text-sm h-7"></td>
                    </tr>
                    <tr>
                      <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left">
                        বাঁকী
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm h-7"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Signature Only - Placed further down below Total, with Buyer & Seller signature */}
            <div className="mt-24 pt-6 grid grid-cols-2 text-center text-xs text-neutral-800 font-bold">
              <div>
                <div className="w-32 border-b border-neutral-500 mx-auto mb-1.5"></div>
                <span>ক্রেতার স্বাক্ষর</span>
              </div>
              <div>
                <div className="w-32 border-b border-neutral-500 mx-auto mb-1.5"></div>
                <span>বিক্রেতার স্বাক্ষর</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="bg-neutral-50 border-t border-neutral-200 p-3 flex flex-wrap items-center justify-between gap-2 no-print">
          <button
            onClick={handleShareWhatsApp}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>হোয়াটসঅ্যাপে মেমো পাঠান</span>
          </button>

          <div className="flex items-center gap-2">
            {onUpdateOrder && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>এডিট</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              সম্পন্ন / বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
