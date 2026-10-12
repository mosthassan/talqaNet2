import React from 'react';
import { ShieldCheck, Globe, MessageCircle, Code2, Sparkles, ExternalLink } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface DeveloperFooterProps {
  compact?: boolean;
  className?: string;
}

export const DeveloperFooter: React.FC<DeveloperFooterProps> = ({ 
  compact = false,
  className = '' 
}) => {
  const whatsappNumber = '967770446040';
  const whatsappDisplay = '770446040';
  const websiteUrl = 'https://samtecai.com';
  const developerName = 'م / مصطفى حسان';
  const companyName = 'شركة سام تك للبرمجيات (SAMTEC AI)';

  if (compact) {
    return (
      <div className={`w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 backdrop-blur-md text-slate-400 text-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 ${className}`}>
        <div className="flex items-center gap-2 text-right">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          <span className="text-slate-300 font-medium">
            حقوق الطبع محفوظة لـ <span className="text-cyan-400 font-bold">سام تك للبرمجيات</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">برمجة <span className="text-amber-400 font-bold">{developerName}</span></span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundManager.playTap()}
            className="text-cyan-400 hover:text-cyan-300 font-bold font-mono flex items-center gap-1 hover:underline transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>samtecai.com</span>
          </a>

          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('السلام عليكم م/ مصطفى حسان، أود الاستفسار بخصوص حلول وبرمجيات سام تك للشبكات الذكية')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundManager.playTap()}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1.5 transition-all text-[11px]"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>واتس: {whatsappDisplay}</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/98 border border-cyan-500/30 p-5 sm:p-6 shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-slate-200 ${className}`}>
      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-48 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-48 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-5">
        {/* Left / Main Branding */}
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 p-0.5 shadow-[0_0_20px_rgba(14,165,233,0.4)] shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
              <Code2 className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-black text-white font-['Cairo'] tracking-tight">
                حقوق الطبع محفوظة لـ <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 font-extrabold">{companyName}</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>إصدار احترافي</span>
              </span>
            </div>
            
            <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>برمجة وتطوير :</span>
              <strong className="text-amber-400 font-bold">{developerName}</strong>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">هندسة أنظمة الشبكات والذكاء الاصطناعي</span>
            </p>
          </div>
        </div>

        {/* Right / Quick Interactive Badges */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
          {/* Website Link */}
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundManager.playTap()}
            className="group px-4 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(14,165,233,0.15)] cursor-pointer"
          >
            <Globe className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="font-mono tracking-wider">samtecai.com</span>
            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
          </a>

          {/* WhatsApp Direct Chat */}
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('السلام عليكم م/ مصطفى حسان، أود الاستفسار بخصوص حلول وبرمجيات سام تك للشبكات الذكية')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => soundManager.playTap()}
            className="group px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-white/20 group-hover:scale-110 transition-transform" />
            <span>للتواصل واتس :</span>
            <span className="font-mono font-bold tracking-wider">{whatsappDisplay}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
