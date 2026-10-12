import React from 'react';
import { BrandLogo } from './BrandLogo';
import { NetworkConfig } from '../utils/packagesStorage';
import { 
  Wifi, 
  ShieldCheck, 
  MessageCircle, 
  Phone, 
  Heart, 
  Radio, 
  Server, 
  Lock,
  Globe,
  MapPin,
  Clock,
  Zap
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { DeveloperFooter } from './DeveloperFooter';

interface FooterProps {
  networkConfig?: NetworkConfig;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  networkConfig,
  onOpenAdmin
}) => {
  const netName = networkConfig?.networkName || 'طلقة نت';
  const whatsapp = networkConfig?.whatsappNumber || '967718097168';
  const phone = networkConfig?.supportPhone || '718097168';
  const emergencyPhone = networkConfig?.emergencyPhone || '718097168';
  const workingHours = networkConfig?.workingHours || 'طوال أيام الأسبوع 24/7';
  const location = networkConfig?.networkLocation;
  const telegram = networkConfig?.telegramChannel;

  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-xl text-slate-400 py-10 px-4 mt-16 mb-16 md:mb-0 space-y-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: Brand & Details */}
        <div className="space-y-3 md:col-span-2">
          <BrandLogo 
            size="md" 
            networkName={networkConfig?.networkName}
            slogan={networkConfig?.slogan}
          />
          <p className="text-xs text-slate-400 leading-relaxed max-w-md">
            شبكة <span className="text-white font-bold">{netName}</span> — منظومة توزيع إنترنت فائق السرعة عبر شبكات الأقمارالصناعية ستارلينك وكروت ميكروتك الذكية. نقدم أفضل تجربة تصفح وألعاب مع ثبات عالي ودعم فني على مدار الساعة.
          </p>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-300 pt-1 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{location || 'الجمهورية اليمنية — مأرب'}</span>
          </div>

          <div className="flex items-center gap-3 pt-2 text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>أقمار صناعية Starlink</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>سيرفر {networkConfig?.mikrotikIdentity || 'MikroTik'}</span>
            </span>
          </div>
        </div>

        {/* Col 2: Quick Support */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white font-['Cairo']">الدعم الفني والخدمات</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <a
                href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>واتساب المبيعات: {whatsapp}</span>
              </a>
            </li>
            <li>
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
              >
                <Phone className="w-4 h-4 text-cyan-400" />
                <span>الخط الساخن: {phone}</span>
              </a>
            </li>
            {emergencyPhone && (
              <li>
                <a
                  href={`tel:${emergencyPhone}`}
                  className="flex items-center gap-2 hover:text-amber-400 transition-colors"
                >
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span>طوارئ الشبكة: {emergencyPhone}</span>
                </a>
              </li>
            )}
            {telegram && (
              <li>
                <a
                  href={telegram.startsWith('http') ? telegram : `https://${telegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-sky-400 transition-colors"
                >
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span>قناة التيليجرام الرسمية</span>
                </a>
              </li>
            )}
            <li className="text-slate-500 pt-1 flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{workingHours}</span>
            </li>
          </ul>
        </div>

        {/* Col 3: Subscriber Features & Mobile App */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white font-['Cairo']">مزايا شبكة {netName}</h4>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>سرعة استجابة فائقة</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                خطوط إنترنت مستقرة ومخصصة للألعاب والاتصال المباشر ومشاهدة الفيديو بجودة عالية.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span>تطبيق PWA مثبت على الهواتف الذكية للوصول السريع</span>
            </div>
          </div>
        </div>
      </div>

      {/* Developer & Software Company Signature Card */}
      <div className="max-w-7xl mx-auto">
        <DeveloperFooter />
      </div>

      {/* Bottom Copyright with Secret Admin Trigger */}
      <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          جميع الحقوق محفوظة © {new Date().getFullYear()} — شبكة <span className="text-cyan-400 font-bold">{netName}</span> & <span className="text-slate-300 font-semibold">سام تك للبرمجيات</span>
        </div>
        <div className="flex items-center gap-2">
          <span>صممت بأعلى معايير السرعة والأداء</span>
          <span className="text-orange-400">⚡</span>
          {onOpenAdmin && (
            <button
              onClick={() => {
                soundManager.playTap();
                onOpenAdmin();
              }}
              title="إدارة الباقات والشبكة"
              className="opacity-20 hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-cyan-400 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
