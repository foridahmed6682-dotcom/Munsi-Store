import React, { useState } from 'react';
import {
  Sparkles,
  Brain,
  TrendingUp,
  AlertOctagon,
  PackageCheck,
  Send,
  HelpCircle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Store,
  DollarSign
} from 'lucide-react';
import { Product, Shop, Order } from '../types';

interface AiAdvisorViewProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  isOnline: boolean;
}

export const AiAdvisorView: React.FC<AiAdvisorViewProps> = ({
  products,
  shops,
  orders,
  isOnline,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [showThoughts, setShowThoughts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suggested strategic prompts
  const strategicPrompts = [
    {
      title: 'বকেয়া টাকা আদায়ের কৌশল',
      desc: 'কোন কোন দোকানের কাছে দ্রুত তাগাদা দিয়ে টাকা আদায় করতে হবে?',
      prompt: 'আমাদের রেজিস্টার্ড দোকানগুলোর মধ্যে কাদের বকেয়া সীমা ছাড়িয়েছে এবং কার কাছ থেকে কীভাবে দ্রুত টাকা আদায় করব তার বিস্তারিত পরিকল্পনা দাও।',
      icon: DollarSign,
    },
    {
      title: 'কম স্টক ও রি-অর্ডার পরামর্শ',
      desc: 'কোন কোন পণ্যের স্টক অবিলম্বে রি-অর্ডার করা প্রয়োজন?',
      prompt: 'বর্তমানে ইনভেন্টরিতে কোন কোন পণ্যের স্টক বিপজ্জনক লেভেলে নেমে গেছে এবং ডিস্ট্রিবিউটর বা মিল থেকে কত কার্টুন রি-অর্ডার করা উচিত?',
      icon: PackageCheck,
    },
    {
      title: 'রুট ভিজিট অপটিমাইজেশন',
      desc: 'আগামীকালের জন্য সবচেয়ে লাভজনক রুট কোনটি হবে?',
      prompt: 'চকবাজার, মিরপুর, কারওয়ান বাজার, নিউ মার্কেট রুটের দোকানগুলোর আগের অর্ডার হিস্ট্রি ও বকেয়া দেখে আগামীকালের সেলস ভিজিট রুট প্ল্যান করে দাও।',
      icon: TrendingUp,
    },
    {
      title: 'ক্রেডিট রিস্ক ও বাকী নিয়ন্ত্রণ',
      desc: 'কোন দোকানদারকে আর বাকীতে পণ্য দেওয়া ঝুঁকিপূর্ণ?',
      prompt: 'যে দোকানগুলো দীর্ঘদিন ধরে বকেয়া রেখেছে তাদের ক্রেডিট রিস্ক রেটিং করে দাও এবং নতুন অর্ডারে কী শর্ত দেওয়া যায় বলো।',
      icon: AlertOctagon,
    },
  ];

  const handleAskAI = async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setThoughts(null);

    // Business context snapshot
    const totalDues = shops.reduce((sum, s) => sum + s.previousDue, 0);
    const lowStock = products.filter((p) => p.stock <= p.minStockAlert);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter((o) => o.orderDate.startsWith(todayStr));

    const contextData = {
      summary: {
        totalShops: shops.length,
        totalMarketDueBDT: totalDues,
        totalInventoryProducts: products.length,
        lowStockItemsCount: lowStock.length,
        todayOrdersCount: todayOrders.length,
        todayTotalSalesBDT: todayOrders.reduce((sum, o) => sum + o.netTotal, 0),
        todayCashCollectedBDT: todayOrders.reduce((sum, o) => sum + o.paidAmount, 0),
      },
      topDebtorShops: [...shops]
        .sort((a, b) => b.previousDue - a.previousDue)
        .slice(0, 5)
        .map((s) => ({ name: s.name, owner: s.ownerName, route: s.routeArea, dueBDT: s.previousDue })),
      criticalLowStockItems: lowStock.map((p) => ({
        name: p.banglaName,
        stock: p.stock,
        unit: p.unit,
        minAlert: p.minStockAlert,
        price: p.unitPrice,
      })),
      recentOrdersSample: orders.slice(0, 5).map((o) => ({
        memo: o.memoNumber,
        shop: o.shopName,
        totalBDT: o.netTotal,
        dueBDT: o.dueAmount,
        payment: o.paymentMethod,
        date: o.orderDate,
      })),
    };

    try {
      const res = await fetch('/api/ai/deep-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          contextData,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'এআই অ্যাডভাইজার উত্তর দিতে পারেনি');
      }

      const data = await res.json();
      setAnswer(data.answer);
      setThoughts(data.thoughts || null);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 'অনুরোধ ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    handleAskAI(promptInput);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* High Thinking AI Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-emerald-950 rounded-2xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1 text-[11px] font-extrabold bg-purple-500/30 text-purple-200 border border-purple-400/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <Brain className="w-3.5 h-3.5 text-purple-300" />
                Gemini 3.1 Pro • High Thinking Mode
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              স্মার্ট সেলস ও ইনভেন্টরি বিজনেস অ্যাডভাইজর
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-2xl leading-relaxed">
              আপনার দোকানের বকেয়া খাতা, প্রোডাক্ট স্টক এবং অর্ডার হিস্ট্রি গভীর বিশ্লেষণ করে সেলস বৃদ্ধির
              বাস্তবধর্মী পরিকল্পনা ও সঠিক সিদ্ধান্ত নিতে সহায়তা করে।
            </p>
          </div>

          <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-xs space-y-1">
            <p className="text-purple-200 font-medium">রিয়েল-টাইম মার্কেট ডাটাবেজ:</p>
            <p className="text-white font-bold">
              • {shops.length}টি দোকান | ৳{shops.reduce((s, sh) => s + sh.previousDue, 0).toLocaleString()} বকেয়া
            </p>
            <p className="text-white font-bold">• {products.length}টি ইনভেন্টরি SKU আইটেম</p>
          </div>
        </div>
      </div>

      {/* Strategic Prompt Cards */}
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
          দ্রুত এআই বিশ্লেষণের বিষয়সমূহ (ক্লিক করুন):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {strategicPrompts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  setPromptInput(item.prompt);
                  handleAskAI(item.prompt);
                }}
                disabled={isLoading}
                className="bg-white hover:bg-purple-50/50 p-3.5 rounded-2xl border border-neutral-200 hover:border-purple-300 text-left transition-all shadow-xs flex flex-col justify-between group disabled:opacity-50"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-neutral-900 leading-snug">{item.title}</h4>
                  <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">{item.desc}</p>
                </div>
                <span className="text-[10px] font-bold text-purple-700 mt-2 flex items-center gap-1">
                  <span>বিশ্লেষণ করুন</span> &rarr;
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Query Input */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-neutral-200 shadow-xs">
        <form onSubmit={handleCustomSubmit} className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700">
            যেকোনো প্রশ্ন বা ব্যবসায়িক পরামর্শের জন্য লিখুন:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="যেমন: এই সপ্তাহে কোন কোন দোকানে তেল ও চিনির অর্ডার বাড়ানো সম্ভব?"
              className="flex-1 text-xs sm:text-sm p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-hidden text-neutral-900"
            />
            <button
              type="submit"
              disabled={isLoading || !promptInput.trim()}
              className="px-5 py-3 bg-purple-900 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-purple-300" />
                  <span>চিন্তা করছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>জিজ্ঞাসা করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-6 text-center space-y-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-purple-200 text-purple-800 flex items-center justify-center mx-auto">
            <Brain className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-purple-950">
              Gemini 3.1 Pro হাই থিংকিং মোডে বিশ্লেষণ চলছে...
            </h4>
            <p className="text-xs text-purple-700 max-w-md mx-auto mt-1">
              দোকানের বাকি খাতা, সেলস ট্রেন্ড এবং ইনভেন্টরি স্টক মূল্যায়ন করে সুনির্দিষ্ট পরামর্শ সাজানো হচ্ছে।
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs">
          <strong>ত্রুটি:</strong> {error}
        </div>
      )}

      {/* Result Container */}
      {answer && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden space-y-0">
          {/* Answer Header */}
          <div className="bg-neutral-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm">এআই বিশেষজ্ঞ পরামর্শ ও দিকনির্দেশনা</h3>
            </div>
            <span className="text-[11px] text-neutral-400">gemini-3.1-pro-preview</span>
          </div>

          {/* Collapsible Thoughts Block */}
          {thoughts && (
            <div className="border-b border-purple-100 bg-purple-50/50 p-3 sm:p-4 text-xs">
              <button
                type="button"
                onClick={() => setShowThoughts(!showThoughts)}
                className="flex items-center justify-between w-full font-bold text-purple-900 hover:text-purple-950"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-700" />
                  <span>মডেলের চিন্তাভাবনা ও যুক্তি বিশ্লেষণ (Thinking Process)</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-purple-700 font-semibold">
                  <span>{showThoughts ? 'সংকোচন করুন' : 'বিস্তারিত দেখুন'}</span>
                  {showThoughts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showThoughts && (
                <div className="mt-2.5 p-3 bg-white/90 rounded-xl border border-purple-200 font-mono text-[11px] text-neutral-700 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                  {thoughts}
                </div>
              )}
            </div>
          )}

          {/* Main Formatted Advice */}
          <div className="p-4 sm:p-6 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed space-y-2">
            {answer}
          </div>

          {/* Footer */}
          <div className="bg-neutral-50 px-4 py-2.5 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500">
            <span>মুন্সী স্টোর রিয়েল-টাইম ডাটা বিশ্লেষণ</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(answer);
                alert('পরামর্শ কপি করা হয়েছে!');
              }}
              className="text-purple-800 hover:text-purple-950 font-bold"
            >
              কপি করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
