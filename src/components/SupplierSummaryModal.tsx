import React, { useState, useMemo } from 'react';
import {
  X,
  Building2,
  Package,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Printer,
  Plus,
  Phone,
  Search,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { Product, Supplier } from '../types';

interface SupplierSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliersList?: Supplier[];
  onSelectSupplierFilter?: (supplierName: string) => void;
  onAddSupplier?: (supplier: Supplier) => void;
}

export const SupplierSummaryModal: React.FC<SupplierSummaryModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliersList = [],
  onSelectSupplierFilter,
  onAddSupplier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupBangla, setNewSupBangla] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupNotes, setNewSupNotes] = useState('');

  // Group and compute comprehensive summary per supplier
  const summaryList = useMemo(() => {
    const map: Record<
      string,
      {
        supplierName: string;
        productCount: number;
        totalStockUnits: number;
        totalCostValue: number;
        totalSalesValue: number;
        expectedProfit: number;
        lowStockCount: number;
        sampleProducts: string[];
      }
    > = {};

    products.forEach((p) => {
      const sup = p.supplier?.trim() || 'অন্যান্য / অনির্দিষ্ট';
      if (!map[sup]) {
        map[sup] = {
          supplierName: sup,
          productCount: 0,
          totalStockUnits: 0,
          totalCostValue: 0,
          totalSalesValue: 0,
          expectedProfit: 0,
          lowStockCount: 0,
          sampleProducts: [],
        };
      }
      const cost = p.costPrice || (p.unitPrice * 0.85);
      const stock = p.stock || 0;
      map[sup].productCount += 1;
      map[sup].totalStockUnits += stock;
      map[sup].totalCostValue += stock * cost;
      map[sup].totalSalesValue += stock * (p.unitPrice || 0);
      map[sup].expectedProfit += stock * ((p.unitPrice || 0) - cost);
      if (stock <= (p.minStockAlert || 5)) {
        map[sup].lowStockCount += 1;
      }
      if (map[sup].sampleProducts.length < 3) {
        map[sup].sampleProducts.push(p.banglaName || p.name);
      }
    });

    return Object.values(map).sort((a, b) => b.totalSalesValue - a.totalSalesValue);
  }, [products]);

  const filteredSummary = useMemo(() => {
    if (!searchTerm.trim()) return summaryList;
    return summaryList.filter((s) =>
      s.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [summaryList, searchTerm]);

  // Overall totals
  const totals = useMemo(() => {
    return summaryList.reduce(
      (acc, s) => {
        acc.totalSuppliers += 1;
        acc.totalProducts += s.productCount;
        acc.totalCost += s.totalCostValue;
        acc.totalSales += s.totalSalesValue;
        acc.totalProfit += s.expectedProfit;
        acc.totalLowStock += s.lowStockCount;
        return acc;
      },
      {
        totalSuppliers: 0,
        totalProducts: 0,
        totalCost: 0,
        totalSales: 0,
        totalProfit: 0,
        totalLowStock: 0,
      }
    );
  }, [summaryList]);

  if (!isOpen) return null;

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSupBangla.trim() || newSupName.trim();
    if (!name) return;

    if (onAddSupplier) {
      onAddSupplier({
        id: `sup-${Date.now()}`,
        name: newSupName.trim() || name,
        banglaName: name,
        phone: newSupPhone.trim(),
        contactPerson: newSupContact.trim(),
        notes: newSupNotes.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    setNewSupName('');
    setNewSupBangla('');
    setNewSupPhone('');
    setNewSupContact('');
    setNewSupNotes('');
    setIsAddingNew(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in overflow-hidden">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-neutral-200 max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-neutral-900 flex items-center gap-2">
                <span>সাপ্লায়ার ভিত্তিক স্টক ও ইনভেন্টরি সামারি</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                  {summaryList.length} টি সাপ্লায়ার
                </span>
              </h3>
              <p className="text-xs text-neutral-500">
                প্রতিটি সাপ্লায়ার ও কোম্পানির পণ্য সংখ্যা, মোট ক্রয়-বিক্রয় মূল্য ও লাভের পরিসংখ্যান
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-neutral-200"
              title="সামারি প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="p-4 sm:p-6 bg-neutral-50/70 border-b border-neutral-200 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
                <span>মোট সাপ্লায়ার</span>
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-neutral-900 mt-1">
                {totals.totalSuppliers} <span className="text-xs font-normal text-neutral-500">কোম্পানি</span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{totals.totalProducts} টি পণ্যে বিভক্ত</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
                <span>ইনভেন্টরি ক্রয় মূল্য</span>
                <DollarSign className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <div className="text-xl font-black text-neutral-900 mt-1">
                ৳{Math.round(totals.totalCost).toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">মোট ডিস্ট্রিবিউটর কস্ট</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
                <span>সম্ভাব্য বিক্রয় মূল্য</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                ৳{Math.round(totals.totalSales).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">বর্তমান বিক্রয় রেটে</div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
                <span>সম্ভাব্য মোট লাভ</span>
                <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 mt-1">
                ৳{Math.round(totals.totalProfit).toLocaleString()}
              </div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                গড় মার্জিন: {totals.totalCost > 0 ? Math.round((totals.totalProfit / totals.totalCost) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="সাপ্লায়ার বা কোম্পানির নাম দিয়ে খুঁজুন..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingNew ? 'ফর্ম বন্ধ করুন' : '+ নতুন সাপ্লায়ার যোগ'}</span>
            </button>
          </div>

          {/* Quick Add Supplier Form */}
          {isAddingNew && (
            <form
              onSubmit={handleSaveSupplier}
              className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-in fade-in text-xs"
            >
              <div className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" />
                <span>নতুন সাপ্লায়ার বা কোম্পানির তথ্য যোগ করুন</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    কোম্পানি / সাপ্লায়ারের নাম (বাংলা) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupBangla}
                    onChange={(e) => setNewSupBangla(e.target.value)}
                    placeholder="যেমন: সিটি গ্রুপ / তীর"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">ইংরেজি নাম (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    placeholder="City Group (Teer)"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">যোগাযোগের ফোন নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">যোগাযোগকারী প্রতিনিধি (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={newSupContact}
                    onChange={(e) => setNewSupContact(e.target.value)}
                    placeholder="ম্যানেজার / সেলস অফিসার"
                    className="w-full p-2.5 border border-neutral-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-xl font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          )}

          {/* Table / List */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">সাপ্লায়ার / কোম্পানি</th>
                    <th className="py-3 px-3 text-center">পণ্য সংখ্যা</th>
                    <th className="py-3 px-3 text-center">মোট স্টক</th>
                    <th className="py-3 px-3 text-right">ক্রয় মূল্য (৳)</th>
                    <th className="py-3 px-3 text-right">বিক্রয় মূল্য (৳)</th>
                    <th className="py-3 px-3 text-right">সম্ভাব্য লাভ (৳)</th>
                    <th className="py-3 px-3 text-center">স্টক অ্যালার্ট</th>
                    <th className="py-3 px-4 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-neutral-400">
                        কোনো সাপ্লায়ারের তথ্য পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((item, idx) => {
                      const marginPct =
                        item.totalCostValue > 0
                          ? Math.round((item.expectedProfit / item.totalCostValue) * 100)
                          : 0;

                      return (
                        <tr key={idx} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>{item.supplierName}</span>
                            </div>
                            {item.sampleProducts.length > 0 && (
                              <div className="text-[11px] text-neutral-500 truncate max-w-xs mt-0.5">
                                নমুনা: {item.sampleProducts.join(', ')}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-neutral-800">
                            {item.productCount} টি
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-neutral-800">
                            {item.totalStockUnits.toLocaleString()}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-neutral-600">
                            ৳{Math.round(item.totalCostValue).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                            ৳{Math.round(item.totalSalesValue).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                            <div>৳{Math.round(item.expectedProfit).toLocaleString()}</div>
                            <div className="text-[10px] text-blue-500 font-normal">+{marginPct}%</div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {item.lowStockCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                {item.lowStockCount} টি লো
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-[11px] font-medium">✓ স্টক পর্যাপ্ত</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {onSelectSupplierFilter && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSupplierFilter(item.supplierName);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                              >
                                <span>পণ্য দেখুন</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0 text-xs">
          <div className="text-neutral-500">
            * পণ্য তৈরি ও এডিট করার সময়ে সাপ্লায়ার নির্বাচন করলে সামারি স্বয়ংক্রিয়ভাবে আপডেট হয়
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl font-bold cursor-pointer transition"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
