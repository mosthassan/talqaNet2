import React, { useState } from 'react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  HardDrive, 
  Zap, 
  ShieldCheck, 
  Activity, 
  RotateCw, 
  Store, 
  Hash, 
  Share2, 
  Check,
  Wifi
} from 'lucide-react';
import { checkVoucherBalance, checkVoucherBalanceAsync } from '../utils/mikrotikBridge';
import { QuickBalanceResult } from '../types';
import { soundManager } from '../utils/audio';

interface BalanceCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseCode: (code: string) => void;
  initialCode?: string;
}

const QUICK_TEST_CODES = [
  { code: '1234', label: '1234 (نشط 38%)', type: 'active' },
  { code: '500500', label: '500500 (جديد 100%)', type: 'new' },
  { code: '10001000', label: '10001000 (ألترا 79%)', type: 'active' },
  { code: '40004000', label: '40004000 (شهري VIP)', type: 'vip' },
  { code: '0000', label: '0000 (مستنفد 0 MB)', type: 'empty' },
  { code: '9999', label: '9999 (منتهي الصلاحية)', type: 'expired' },
  { code: '998877', label: '998877 (غير مسجل ❌)', type: 'invalid' }
];

export const BalanceCheckModal: React.FC<BalanceCheckModalProps> = ({
  isOpen,
  onClose,
  onUseCode,
  initialCode = ''
}) => {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<QuickBalanceResult | null>(() => {
    if (initialCode) {
      return checkVoucherBalance(initialCode);
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const clean = (initialCode || '').trim();
      setCode(clean);
      if (clean) {
        performInspection(clean);
      } else {
        setResult(null);
      }
    }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  const performInspection = async (targetCode: string) => {
    const clean = targetCode.trim();
    if (!clean) return;

    soundManager.playTap();
    setLoading(true);
    try {
      const res = await checkVoucherBalanceAsync(clean);
      setResult(res);
      if (res.valid) {
        soundManager.playSuccess();
      } else {
        soundManager.playError();
      }
    } catch {
      const fallback = checkVoucherBalance(clean);
      setResult(fallback);
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    performInspection(code);
  };

  const handleSelectQuickCode = (quickCode: string) => {
    setCode(quickCode);
    performInspection(quickCode);
  };

  const handleCopyCode = (text: string) => {
    soundManager.playTap();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(14,165,233,0.25)] text-slate-100 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black font-['Cairo'] text-white">نظام فحص الرصيد الذكي</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-black border border-cyan-500/40">
                  2026 AI
                </span>
              </div>
              <p className="text-xs text-slate-400">استعلام حقيقي مباشر عن رصيد الكرت وصلاحيته بدون استهلاك الوقت</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleCheck} className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                أدخل كود الكرت المطبوع على القسيمة
              </label>
              {code && (
                <button
                  type="button"
                  onClick={() => {
                    setCode('');
                    setResult(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  مسح الخانة ✕
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="أدخل رقم الكرت (مثال: 1234)"
                className="w-full bg-slate-950/90 border-2 border-slate-800 focus:border-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] rounded-2xl py-3.5 pr-4 pl-28 text-center font-black text-cyan-400 tracking-widest text-xl outline-none transition-all font-mono"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="absolute left-2 top-2 bottom-2 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ الفحص...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>فحص الرصيد ⚡</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Test Codes Bar */}
          <div>
            <div className="text-[11px] text-slate-400 font-bold mb-1.5 flex items-center justify-between">
              <span>كروت تجريبية لاختبار الحالات المختلفة:</span>
              <span className="text-[10px] text-cyan-400 font-normal">انقر للتجربة الفورية ⚡</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEST_CODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelectQuickCode(item.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all border ${
                    code === item.code
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : item.type === 'active'
                      ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
                      : item.type === 'new'
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-700/50 text-emerald-300'
                      : item.type === 'vip'
                      ? 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-700/50 text-purple-300'
                      : item.type === 'empty'
                      ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-700/50 text-amber-300'
                      : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-700/50 text-rose-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Results view */}
        {result && (
          <div className="mt-4 animate-fadeIn">
            {result.valid ? (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 space-y-3.5 shadow-[inset_0_0_20px_rgba(14,165,233,0.05)]">
                
                {/* Status Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-black text-emerald-400">{result.statusText}</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30">
                    {result.planName}
                  </span>
                </div>

                {/* Data Source Badge */}
                {result.dataSourceText && (
                  <div className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-between border ${
                    result.dataSource === 'mikrotik_live'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : result.dataSource === 'hotspot_active'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                  }`}>
                    <span>مصدر الفحص:</span>
                    <span className="font-mono text-[10.5px]">{result.dataSourceText}</span>
                  </div>
                )}

                {/* Voucher Meta Info (Serial & Code) */}
                <div className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-slate-400">كود الكرت:</span>
                    <strong className="font-mono text-cyan-300 font-bold">{result.code}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(result.code)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="نسخ الكود"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                    </button>
                  </div>
                  {result.serialNumber && (
                    <div className="text-slate-400 font-mono text-[11px]">
                      سيريال: <span className="text-slate-200 font-semibold">{result.serialNumber}</span>
                    </div>
                  )}
                </div>

                {/* Progress 1: Data Quota */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                      <HardDrive className="w-4 h-4 text-orange-400" />
                      <span>رصيد البيانات المتبقي:</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-orange-400 font-mono text-sm">{result.remainingDataFormatted}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({result.remainingDataPercent}%)</span>
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        result.remainingDataPercent > 50 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : result.remainingDataPercent > 20
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-rose-500 to-red-400'
                      }`}
                      style={{ width: `${Math.max(4, result.remainingDataPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>الرصيد الكلي: <strong className="text-slate-300 font-mono">{result.totalDataFormatted || '2,700 ميجابايت'}</strong></span>
                    {result.usedDataFormatted && (
                      <span>المستهلك: <strong className="text-slate-400 font-mono">{result.usedDataFormatted}</strong></span>
                    )}
                  </div>
                </div>

                {/* Progress 2: Time Quota */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>الوقت المتبقي للاتصال:</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-cyan-300 font-mono text-sm">{result.remainingTimeFormatted}</span>
                      {result.remainingTimePercent !== undefined && (
                        <span className="text-[11px] text-slate-400 font-mono">({result.remainingTimePercent}%)</span>
                      )}
                    </div>
                  </div>

                  {/* Time Progress Meter */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
                      style={{ width: `${Math.max(4, result.remainingTimePercent ?? 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>الوقت الكلي للباقة: <strong className="text-slate-300 font-mono">{result.totalTimeFormatted || '15 ساعة'}</strong></span>
                    {result.usedTimeFormatted && (
                      <span>الوقت المستهلك: <strong className="text-slate-400 font-mono">{result.usedTimeFormatted}</strong></span>
                    )}
                  </div>
                </div>

                {/* Fresh Card vs Active Card Explanation Notice */}
                {((result.usedBytes || 0) === 0 && (result.usedSeconds || 0) === 0) ? (
                  <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-[11px] text-cyan-200/90 leading-relaxed flex items-start gap-2">
                    <span className="text-cyan-400 text-sm leading-none shrink-0 mt-0.5">💡</span>
                    <span>
                      <strong>كرت جديد برصيده الكامل (100%):</strong> الكرت معتمد برصيده الكامل ولم يُسجل دخوله للشبكة بعد، ولذلك فإن المستهلك حالياً (0 ميجابايت). يبدأ خصم الرصيد تلقائياً فور بدء التصفح.
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      <span>استهلاك فعلي مسجل:</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      تم استهلاك {result.usedDataFormatted} ({100 - (result.remainingDataPercent ?? 0)}%)
                    </span>
                  </div>
                )}

                {/* Real Network Profile Card */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200 font-['Cairo']">
                        مواصفات بروفايل ميكروتك (Hotspot Profile)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                      {result.maxSpeed || 'Rate: 30M/30M'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-850">
                      <span className="text-slate-400 block text-[10px] mb-0.5">حالة الكرت بالسيرفر</span>
                      <strong className="text-emerald-400 font-bold">
                        {result.cardState === 'new' ? 'جديد (جاهز للاتصال)' : 'نشط في ميكروتك'}
                      </strong>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-850">
                      <span className="text-slate-400 block text-[10px] mb-0.5">صلاحية الاستخدام</span>
                      <strong className="text-slate-200 font-mono">
                        {result.expirationDate || '10 أيام من أول تسجيل دخول'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Distributor and Validity Details */}
                {result.distributorName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800">
                    <Store className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>نقطة التوزيع: <strong className="text-slate-300">{result.distributorName}</strong></span>
                  </div>
                )}

                {/* Direct Connect Button */}
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onUseCode(result.code);
                    onClose();
                  }}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-sm transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>تسجيل الدخول بهذا الكرت الآن ⚡</span>
                </button>
              </div>
            ) : (
              /* Invalid or Exhausted Card State */
              <div className={`p-4 rounded-2xl border text-right space-y-3 ${
                result.statusText.includes('استنفدت') || result.planName?.includes('منتهي')
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 font-black text-sm">
                    {result.statusText.includes('استنفدت') || result.planName?.includes('منتهي') ? (
                      <span className="text-xl">🪫</span>
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className={result.statusText.includes('استنفدت') || result.planName?.includes('منتهي') ? 'text-amber-300' : 'text-rose-400'}>
                      {result.statusText}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    result.statusText.includes('استنفدت') || result.planName?.includes('منتهي')
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {result.statusText.includes('استنفدت') || result.planName?.includes('منتهي') ? '0 MB متبقية' : 'كود غير مسجل'}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300 font-medium">
                  {result.error}
                </p>

                {result.statusText.includes('استنفدت') || result.planName?.includes('منتهي') ? (
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/20 text-xs text-amber-300/90 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>💡</span>
                      <span>حلول للمتابعة الفورية:</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      يمكنك طلب خدمة "سلفني إنترنت طوارئ 3 دقائق" مجاناً، أو التوجه لأقرب بقالة لشراء كرت جديد.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-rose-500/20 text-xs text-rose-300/90 flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>تأكد من كتابة الأرقام الإنجليزية المطبوعة على الكرت دون مسافات، أو استخدم زر مسح الكود QR.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
