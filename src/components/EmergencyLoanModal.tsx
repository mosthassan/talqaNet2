import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Zap, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  HardDrive, 
  CheckCircle2, 
  Flame, 
  HelpCircle,
  Smartphone,
  CreditCard,
  PhoneCall,
  RefreshCw
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { getActiveUnpaidLoan } from '../utils/mikrotikBridge';

interface EmergencyLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestLoan: (type: 'time' | 'data' | 'combo') => Promise<void>;
}

export const EmergencyLoanModal: React.FC<EmergencyLoanModalProps> = ({
  isOpen,
  onClose,
  onRequestLoan
}) => {
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!isOpen) return null;

  const unpaidLoan = getActiveUnpaidLoan();
  const isWithinDailyReset = unpaidLoan && (Date.now() - unpaidLoan.borrowedAt) < (24 * 60 * 60 * 1000);

  const handleConfirm = async () => {
    if (isWithinDailyReset) return;
    soundManager.playTap();
    setLoading(true);
    try {
      await onRequestLoan('combo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white font-['Cairo']">
                  خدمة سلفني (إنترنت الطوارئ 3 دقائق)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  تجربة هوتسبوت فورية
                </span>
              </div>
              <p className="text-xs text-slate-400">
                اتصال فوري للمواقف العاجلة بدون كرت - يتجدد يومياً كل 24 ساعة
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If user already consumed trial within today */}
        {isWithinDailyReset ? (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2.5 animate-fadeIn">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Clock className="w-5 h-5 shrink-0" />
              <span>تم استهلاك السلفة اليومية لهذا الجهاز</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              لقد استفدت بالفعل من فترة السلفة الطارئة المجانية (3 دقائق) المخصصة لجهازك لهذا اليوم.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-slate-300 flex items-center justify-between">
              <span>فترة إعادة التجديد:</span>
              <span className="text-amber-400 font-bold">تتجدد تلقائياً كل 24 ساعة من وقت الاستخدام</span>
            </div>
            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
              }}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-[0_0_15px_rgba(14,165,233,0.3)]"
            >
              العودة وإدخال كرت رسمي للمتابعة
            </button>
          </div>
        ) : (
          <>
            {/* How it works Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <HelpCircle className="w-4 h-4" />
                <span>مواصفات خدمة سلفني المدمجة في الميكروتك:</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed list-disc list-inside">
                <li><span className="text-amber-300 font-bold">مدة الجلسة:</span> تمنحك <span className="text-white font-bold">3 دقائق طارئة كاملة</span> (Trial Uptime: 00:03:00) بدون الحاجة لكتابة كرت.</li>
                <li><span className="text-cyan-300 font-bold">السرعة المخصصة:</span> سرعة استقرار 512k/512k مخصصة للمراسلات الفورية وإرسال رسائل الواتساب العاجلة.</li>
                <li><span className="text-emerald-400 font-bold">التجديد التلقائي:</span> يتم إعادة ضبط السلفة والتجديد تلقائياً كل 24 ساعة (1d 00:00:00) لكل ماك أدرس (MAC).</li>
              </ul>
            </div>

            {/* Feature Highlight Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-white font-['Cairo']">3 دقائق طوارئ مجاناً</div>
                  <div className="text-[10px] text-amber-300 font-mono">بروفايل: profile-trial (512k/512k)</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                تتجدد كل 24 ساعة ⚡
              </span>
            </div>

            {/* Terms checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4"
              />
              <span className="text-[11px] text-slate-300 font-medium">
                أعلم أن الجلسة مدتها 3 دقائق طارئة تتجدد يومياً لنفس الجهاز.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onClose();
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={loading || !acceptedTerms}
                onClick={handleConfirm}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <span>جاري تفعيل السلفة...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>تفعيل 3 دقائق طوارئ الآن</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
