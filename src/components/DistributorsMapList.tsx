import React from 'react';
import { 
  Store, 
  MapPin, 
  Phone, 
  MessageCircle, 
  CheckCircle2, 
  Sparkles, 
  Radio, 
  ShoppingBag, 
  Smartphone, 
  ShieldCheck, 
  Layers, 
  CreditCard,
  ArrowLeft
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { NetworkConfig } from '../utils/packagesStorage';

interface DistributorsMapListProps {
  distributors?: any[];
  networkName?: string;
  networkConfig?: NetworkConfig;
  onSelectTab?: (tab: string) => void;
}

export const DistributorsMapList: React.FC<DistributorsMapListProps> = ({ 
  networkName = 'طلقة نت',
  networkConfig,
  onSelectTab
}) => {
  const whatsappNum = (networkConfig?.whatsappNumber || '967718097168').replace(/[^0-9]/g, '');
  const supportPhone = networkConfig?.supportPhone || '718097168';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>تغطية شاملة وانتشار واسع</span>
        </div>
        
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-['Cairo'] text-white">
          أماكن ونقاط بيع <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">كروت {networkName}</span>
        </h2>
        
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          جميع كروت الشحن الأصلية متوفرة بسهولة في متناول يدك على مدار الساعة
        </p>
      </div>

      {/* Main Showcase Hero Card (البطاقة الاحترافية الرئيسية) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#0c1527] to-slate-900/95 border-2 border-cyan-500/40 p-6 sm:p-8 shadow-[0_0_40px_rgba(6,182,212,0.18)]">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e90a_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e90a_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-5">
          {/* Decorative Icon Badge */}
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border-2 border-cyan-400/50 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.35)]">
              <Store className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />
            </div>
          </div>

          {/* The Hero Statement (النص الرئيسي المطلوب) */}
          <div className="space-y-3 max-w-2xl">
            <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-black">
              🛒 متوفرة الآن في كافة أرجاء الحي
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-black font-['Cairo'] text-white leading-snug">
              تتوفر كروت شبكة <span className="text-cyan-400">{networkName}</span> في{' '}
              <span className="text-amber-300 underline decoration-amber-400/50 decoration-wavy decoration-2 underline-offset-8">
                جميع المحلات والبقالات المجاورة
              </span>
            </h3>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed pt-1">
              أينما كنت ضمن نطاق تغطية الشبكة، يمكنك التوجه إلى أقرب بقالة، سوبرماركت، أو مركز اتصالات في حارتك وشراء كروت الشحن الأصلية بجميع الفئات والأسعار الرسمية المعتمدة.
            </p>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 w-full max-w-md">
            <a
              href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
                `مرحبا إدارة شبكة ${networkName}، أريد الاستفسار عن كروت الإنترنت وأقرب محل متوفر لديه الكروت في موقعي`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => soundManager.playTap()}
              className="flex-1 min-w-[150px] py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-200"
            >
              <MessageCircle className="w-4 h-4" />
              <span>مراسلة واتساب للدعم</span>
            </a>

            <a
              href={`tel:${supportPhone}`}
              onClick={() => soundManager.playTap()}
              className="flex-1 min-w-[150px] py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all duration-200"
            >
              <Phone className="w-4 h-4 text-cyan-400" />
              <span>اتصال ({supportPhone})</span>
            </a>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Groceries & Supermarkets */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 flex flex-col gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-base font-['Cairo'] mb-1">جميع البقالات والسوبرماركت</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              متوفرة في كافة البقالات والمتاجر الغذائية في شوارع وأحياء التغطية المحيطة بأبراج الشبكة.
            </p>
          </div>
        </div>

        {/* Card 2: Telecom & Service Centers */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-200 flex flex-col gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-base font-['Cairo'] mb-1">مراكز الاتصالات والخدمات</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              تجدها متوفرة لدى محلات بيع الهواتف، خدمات الشحن، والمراكز الإلكترونية المجاورة.
            </p>
          </div>
        </div>

        {/* Card 3: All Categories Available */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-200 flex flex-col gap-3 group sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-base font-['Cairo'] mb-1">جميع الفئات والباقات متوفرة</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              كروت الساعات، اليومية، الأسبوعية، والشهرية متوفرة دائماً وبأسعار رسمية ومحددة.
            </p>
          </div>
        </div>
      </div>

      {/* Official Pricing & Protection Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-emerald-950/40 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-white">ضمان الأسعار الرسمية:</strong> جميع كروت الشبكة تباع بالأسعار المحددة في النظام دون أي زيادة.
          </span>
        </div>

        {onSelectTab && (
          <button
            onClick={() => {
              soundManager.playTap();
              onSelectTab('packages');
            }}
            className="self-end sm:self-auto px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>استعراض جدول الباقات والأسعار</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
