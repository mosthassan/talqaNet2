import React, { useState } from 'react';
import { CardPackage } from '../types';
import { 
  Zap, 
  Clock, 
  HardDrive, 
  Calendar,
  Check, 
  MessageCircle, 
  Sparkles, 
  Flame, 
  Crown,
  ShieldCheck,
  Tag,
  ArrowLeft,
  Smartphone
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface PackagesGridProps {
  packages: CardPackage[];
  onOpenDistributors?: () => void;
  whatsappNumber?: string;
  networkName?: string;
}

export const PackagesGrid: React.FC<PackagesGridProps> = ({
  packages,
  onOpenDistributors,
  whatsappNumber = '967718097168',
  networkName = 'طلقة نت'
}) => {
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<number | 'all'>('all');

  const filteredPackages = packages.filter((pkg) => {
    if (selectedPriceFilter === 'all') return true;
    return pkg.price === selectedPriceFilter;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-8">
      {/* Header Section */}
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold shadow-[0_0_15px_rgba(14,165,233,0.15)]">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>الأسعار الرسمية المعتمدة لشبكة {networkName}</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black font-['Cairo'] text-white tracking-wide">
          أسعار وباقات <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-orange-400 bg-clip-text text-transparent">كروت الإنترنت</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          جميع الكروت مزودة بأعلى سرعات منظومة الأقمار الصناعية ستارلينك وكروت ميكروتك الذكية مع أولوية بث بدون تقطيع وصلاحية واضحة للرصيد والوقت.
        </p>
      </div>

      {/* Quick Price Selector Filters */}
      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
        <button
          onClick={() => {
            soundManager.playTap();
            setSelectedPriceFilter('all');
          }}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            selectedPriceFilter === 'all'
              ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          جميع الكروت ({packages.length})
        </button>

        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => {
              soundManager.playTap();
              setSelectedPriceFilter(pkg.price);
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedPriceFilter === pkg.price
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-105'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Tag className="w-3 h-3" />
            <span>كرت {pkg.price} ريال</span>
          </button>
        ))}
      </div>

      {/* Cards Grid with Premium Luxury Aesthetic */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
        {filteredPackages.map((pkg) => {
          const isPopular = pkg.popular;
          const isVip = pkg.price >= 4000;
          
          return (
            <div
              key={pkg.id}
              className={`relative rounded-3xl backdrop-blur-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 ${
                isVip
                  ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-2 border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.2)]'
                  : isPopular
                  ? 'bg-gradient-to-b from-orange-950/40 via-slate-900 to-slate-950 border-2 border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.22)]'
                  : 'bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 shadow-xl'
              }`}
            >
              {/* Top Badge */}
              {pkg.badge && (
                <div className="absolute -top-3 right-5">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-md flex items-center gap-1 font-['Cairo'] ${
                      isVip
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-300'
                        : isPopular
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 border-orange-300'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {isVip ? <Crown className="w-3.5 h-3.5 fill-slate-950" /> : isPopular ? <Flame className="w-3.5 h-3.5 fill-slate-950" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{pkg.badge}</span>
                  </span>
                </div>
              )}

              {/* Card Header & Price */}
              <div>
                <div className="pt-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">فئة الكرت</span>
                    {isVip && (
                      <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                        MONTHLY VIP
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black font-['Cairo'] text-white mt-1">
                    {pkg.name}
                  </h3>

                  <div className="flex items-baseline gap-1.5 mt-2.5 pb-3 border-b border-slate-800/80">
                    <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 font-mono">
                      {pkg.price}
                    </span>
                    <span className="text-xs text-orange-400 font-bold font-['Cairo']">{pkg.currency} يمني</span>
                  </div>
                </div>

                {/* Main 3 Specifications Blocks (Exact User Spec) */}
                <div className="space-y-2 mb-4">
                  {/* Data Volume */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/20">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-slate-400 font-bold">الرصيد / الحجم:</span>
                    </div>
                    <span className="text-xs font-black text-orange-400 font-mono tracking-wide">
                      {pkg.dataLimitLabel}
                    </span>
                  </div>

                  {/* Time Duration */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-slate-400 font-bold">الوقت المتاح:</span>
                    </div>
                    <span className="text-xs font-black text-cyan-300 font-['Cairo']">
                      {pkg.durationLabel}
                    </span>
                  </div>

                  {/* Validity Days */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-slate-400 font-bold">الصلاحية:</span>
                    </div>
                    <span className="text-xs font-black text-emerald-400 font-['Cairo']">
                      {pkg.validityDaysLabel}
                    </span>
                  </div>
                </div>

                {/* Speed tag */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800 mb-4 font-bold">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>السرعة: <strong className="text-white">{pkg.speedLimitLabel}</strong></span>
                </div>

                {/* Features List */}
                <div className="space-y-1.5 mb-5">
                  {pkg.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300 leading-tight">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `مرحباً شبكة ${networkName}، أريد شراء ${pkg.name} بسعر ${pkg.price} ${pkg.currency} (رصيد: ${pkg.dataLimitLabel} - وقت: ${pkg.durationLabel} - صلاحية: ${pkg.validityDaysLabel})`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    isVip
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : isPopular
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                      : 'bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>طلب الكرت عبر واتساب</span>
                </a>

                {onOpenDistributors && (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onOpenDistributors();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-orange-300 text-[11px] font-bold transition-colors text-center border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                    <span>أماكن ونقاط البيع المتوفر بها هذا الكرت</span>
                    <ArrowLeft className="w-3 h-3 text-orange-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassurance Info Strip */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span>تنبيه: يتم احتساب الصلاحية (بالأيام) من أول تسجيل دخول للكرت في الشبكة.</span>
        </div>
        <div className="flex items-center gap-2 text-orange-400 font-bold">
          <Smartphone className="w-4 h-4" />
          <span>متوفرة أيضاً لدى جميع نقاط التوزيع المعتمدة</span>
        </div>
      </div>
    </div>
  );
};
