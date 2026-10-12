import React, { useState, useEffect } from 'react';
import { 
  LoyaltyPrizeTier, 
  LoyaltyPrizeVoucher 
} from '../types';
import { NetworkConfig } from '../utils/packagesStorage';
import { 
  getLoyaltyPrizeTiers, 
  verifyVoucherForLoyalty, 
  redeemLoyaltyReward, 
  getUserWonWallet, 
  VoucherVerificationResult, 
  getBurnedCardsLedger,
  spinFortuneWheel,
  getSampleNetworkCardsForTest
} from '../utils/loyaltyManager';
import { soundManager } from '../utils/audio';
import { FortuneWheel } from './FortuneWheel';
import confetti from 'canvas-confetti';
import { 
  Gift, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Check, 
  Zap, 
  Trophy, 
  Clock, 
  Clipboard, 
  RotateCcw, 
  Wallet,
  ShieldCheck,
  Info
} from 'lucide-react';

interface LoyaltyRewardViewProps {
  networkConfig?: NetworkConfig;
  onUseCode: (code: string) => void;
}

export const LoyaltyRewardView: React.FC<LoyaltyRewardViewProps> = ({
  networkConfig,
  onUseCode
}) => {
  // 10 card codes input state
  const [cards, setCards] = useState<string[]>(Array(10).fill(''));
  const [verifications, setVerifications] = useState<(VoucherVerificationResult | null)[]>(Array(10).fill(null));
  
  // Game state
  const [isSpinning, setIsSpinning] = useState(false);
  const [pendingWonTier, setPendingWonTier] = useState<LoyaltyPrizeTier | null>(null);
  const [wonVoucher, setWonVoucher] = useState<LoyaltyPrizeVoucher | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  
  // Bulk paste modal
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  // Wallet of won vouchers
  const [userWallet, setUserWallet] = useState<LoyaltyPrizeVoucher[]>(() => getUserWonWallet());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Prize tiers
  const [prizeTiers] = useState<LoyaltyPrizeTier[]>(() => getLoyaltyPrizeTiers());

  // Count valid cards
  const validCount = verifications.filter(v => v !== null && v.valid).length;
  const isReadyToSpin = validCount === 10;

  // Single card change handler
  const handleCardChange = (index: number, val: string) => {
    const clean = val.trim().toUpperCase();
    const newCards = [...cards];
    newCards[index] = clean;
    setCards(newCards);

    // Verify if not empty
    if (clean) {
      // Check for duplicate in current batch
      const duplicateInBatch = newCards.some((c, i) => i !== index && c === clean && c !== '');
      if (duplicateInBatch) {
        const newVerifs = [...verifications];
        newVerifs[index] = {
          code: clean,
          valid: false,
          reason: 'burned',
          message: 'هذا الكرت مكرر في نفس القائمة أعلاه'
        };
        setVerifications(newVerifs);
        return;
      }

      const res = verifyVoucherForLoyalty(clean);
      const newVerifs = [...verifications];
      newVerifs[index] = res;
      setVerifications(newVerifs);
    } else {
      const newVerifs = [...verifications];
      newVerifs[index] = null;
      setVerifications(newVerifs);
    }
  };

  // Bulk paste handler
  const handleProcessBulkPaste = () => {
    soundManager.playTap();
    if (!bulkText.trim()) return;

    // Extract all alphanumeric tokens of length >= 3
    const extracted = bulkText
      .split(/[\n,\s\t,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length >= 3);

    const uniqueExtracted = Array.from(new Set(extracted)).slice(0, 10);
    const newCards = Array(10).fill('');
    const newVerifs: (VoucherVerificationResult | null)[] = Array(10).fill(null);

    uniqueExtracted.forEach((code: string, i: number) => {
      newCards[i] = code;
      newVerifs[i] = verifyVoucherForLoyalty(code);
    });

    setCards(newCards);
    setVerifications(newVerifs);
    setIsBulkPasteOpen(false);
    setBulkText('');

    const newValidCount = newVerifs.filter(v => v !== null && v.valid).length;
    if (newValidCount === 10) {
      soundManager.playSuccess();
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
    }
  };

  // Clear all cards
  const handleResetBatch = () => {
    soundManager.playTap();
    setCards(Array(10).fill(''));
    setVerifications(Array(10).fill(null));
  };

  // Quick Demo: Fill 10 authentic network cards with 1 click
  const handleQuickDemoFill = () => {
    soundManager.playTap();
    const demoCodes = getSampleNetworkCardsForTest(10);
    const newCards = Array(10).fill('');
    const newVerifs: (VoucherVerificationResult | null)[] = Array(10).fill(null);

    demoCodes.forEach((code, i) => {
      newCards[i] = code;
      newVerifs[i] = verifyVoucherForLoyalty(code);
    });

    setCards(newCards);
    setVerifications(newVerifs);
    soundManager.playSuccess();
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
  };

  // Start Fortune Wheel Spin with weighted probability draw
  const handleSpinStart = () => {
    if (!isReadyToSpin || isSpinning) return;
    soundManager.playTap();
    // 1. Draw prize using admin weighted probability
    const drawnPrizeTier = spinFortuneWheel();
    setPendingWonTier(drawnPrizeTier);
    setIsSpinning(true);
  };

  // Wheel Spin Completed
  const handleSpinComplete = (wonTier: LoyaltyPrizeTier) => {
    setIsSpinning(false);

    // Redeem cards and claim prize
    const { voucher } = redeemLoyaltyReward(cards, wonTier);
    setWonVoucher(voucher);
    setShowPrizeModal(true);

    // Refresh wallet
    setUserWallet(getUserWonWallet());

    // Trigger big victory confetti
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#00f2fe', '#0ea5e9', '#f59e0b', '#10b981']
    });

    // Reset input slots after successful claim
    setCards(Array(10).fill(''));
    setVerifications(Array(10).fill(null));
  };

  // Copy voucher code
  const handleCopyCode = (code: string) => {
    soundManager.playTap();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 p-5 sm:p-7 shadow-[0_0_35px_rgba(14,165,233,0.15)] text-slate-100">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
              <Gift className="w-3.5 h-3.5" />
              <span>برنامج الولاء الحصري — شبكة {networkConfig?.networkName || 'طلقة نت'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-['Cairo'] tracking-tight">
              مكافأة الانتماء: استبدل 10 كروت مستهلكة بكرت جديد مجاناً 🎁
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              وفاءً لعملائنا الدائمين: لا ترمِ كروتك القديمة! اجمع 10 كروت مستهلكة تابعة لشبكتنا وأدخلها هنا لتدوير عجلة المكافآت والحصول على كرت حقيقي مجاني فوراً.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleQuickDemoFill}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105"
              title="ملء الخانات تلقائياً بـ 10 كروت معتمدة للتجربة الفورية"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تجربة سريعة (10 كروت)</span>
            </button>

            <button
              onClick={() => {
                soundManager.playTap();
                setIsBulkPasteOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <Clipboard className="w-4 h-4" />
              <span>لصق 10 كروت دفعة واحدة</span>
            </button>

            {validCount > 0 && (
              <button
                onClick={handleResetBatch}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="إفراغ الخانات"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>حالة اكتمال الكروت المعتمدة:</span>
            </span>
            <span className="font-mono font-bold text-sm text-cyan-400">
              {validCount} / 10 كروت ({validCount * 10}%)
            </span>
          </div>

          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                validCount === 10
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-r from-cyan-500 to-sky-500'
              }`}
              style={{ width: `${validCount * 10}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Input Slots, Right is Fortune Wheel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 10 Card Inputs (7 cols on Desktop) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>سلة إدخال الكروت القديمة</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  10 Slots
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                أدخل أرقام الكروت العشرة المستهلكة المطبوعة على قسائمك
              </p>
            </div>

            {isReadyToSpin && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-pulse flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>جاهز للسحب!</span>
              </span>
            )}
          </div>

          {/* Slots 1 to 10 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cards.map((code, index) => {
              const verif = verifications[index];
              const isValid = verif?.valid;
              const hasError = verif && !verif.valid;

              return (
                <div 
                  key={index}
                  className={`p-2.5 rounded-2xl border transition-all ${
                    isValid
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : hasError
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-400 font-mono flex items-center gap-1">
                      <span>الكرت رقم {index + 1}</span>
                    </span>
                    {isValid ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>معتمد ({verif?.details?.packageName || 'طلقة'})</span>
                      </span>
                    ) : hasError ? (
                      <span className="text-[10px] font-bold text-rose-400 flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />
                        <span>مرفوض</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">في الانتظار...</span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={code}
                    onChange={(e) => handleCardChange(index, e.target.value)}
                    placeholder={`كود الكرت ${index + 1}`}
                    className={`w-full px-3 py-2 rounded-xl font-mono text-sm font-bold tracking-wider outline-none transition-all ${
                      isValid
                        ? 'bg-slate-900 text-emerald-300 border border-emerald-500/30'
                        : hasError
                        ? 'bg-slate-900 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-900/90 text-white border border-slate-800 focus:border-cyan-500'
                    }`}
                    dir="ltr"
                  />

                  {/* Error feedback line */}
                  {hasError && (
                    <p className="text-[10px] text-rose-400 font-semibold mt-1 truncate" title={verif.message}>
                      {verif.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Anti-Duplicate Notice Banner */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>ضوابط أمان مكافأة الانتماء:</span>
            </div>
            <p className="leading-relaxed">
              كل كرت يتم استبداله يُسجل ويُحرق برقم عملية رقمي فوري في السجل المركزي، ولا يمكن إعادة استخدام نفس الكرت مرة أخرى من أي شخص.
            </p>
          </div>
        </div>

        {/* Right: The Fortune Wheel (5 cols on Desktop) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col items-center justify-center text-center">
          <div className="w-full pb-3 border-b border-slate-800 mb-2">
            <h2 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>عجلة حظ جوائز الانتماء</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isReadyToSpin 
                ? '🟢 الكروت العشرة مكتملة! اضغط على منتصف العجلة لتدويرها' 
                : `🔒 مطلوب إكمال ${10 - validCount} كروت لفتح إمكانية التدوير`}
            </p>
          </div>

          {/* Fortune Wheel Canvas */}
          <FortuneWheel
            tiers={prizeTiers}
            isSpinning={isSpinning}
            targetTier={pendingWonTier}
            onSpinStart={handleSpinStart}
            onSpinComplete={handleSpinComplete}
            disabled={!isReadyToSpin}
          />

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={handleSpinStart}
            disabled={!isReadyToSpin || isSpinning}
            className={`w-full mt-4 py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
              isReadyToSpin && !isSpinning
                ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                : isSpinning
                ? 'bg-cyan-600 text-white opacity-80 cursor-wait'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>
              {isReadyToSpin ? 'أدر عجلة الحظ واستلم كرتك الآن ⚡' : `أكمل إدخال 10 كروت للبدء (${validCount}/10)`}
            </span>
          </button>
        </div>
      </div>

      {/* User Won Prize Wallet Section */}
      {userWallet.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Cairo']">محفظة كروتي الرابحة ({userWallet.length})</h3>
                <p className="text-xs text-slate-400">جميع الكروت التي ربحتها من مكافأة الانتماء محفوظة هنا ويمكنك استخدامها في أي وقت</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {userWallet.map((voucher) => (
              <div 
                key={voucher.id}
                className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-2.5 relative overflow-hidden shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">{voucher.tierName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {voucher.price} ريال
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">كود الكرت:</span>
                  <strong className="font-mono text-cyan-300 text-sm tracking-wider font-bold">{voucher.code}</strong>
                  <button
                    onClick={() => handleCopyCode(voucher.code)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="نسخ الكود"
                  >
                    {copiedCode === voucher.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>الرصيد: <strong className="text-slate-200">{voucher.dataLabel}</strong></span>
                  <span>المدة: <strong className="text-slate-200">{voucher.durationLabel}</strong></span>
                </div>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    onUseCode(voucher.code);
                  }}
                  className="w-full mt-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول بهذا الكرت ⚡</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-cyan-400" />
                <span>لصق الكروت العشرة دفعة واحدة</span>
              </h3>
              <button
                onClick={() => setIsBulkPasteOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              الصق أرقام الكروت مفصولة بأسطر أو مسافات أو فواصل، وسيقوم النظام بتوزيعها وفحصها تلقائياً:
            </p>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="مثال:&#10;795785&#10;760007&#10;649040&#10;..."
              rows={6}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white font-mono text-sm outline-none"
              dir="ltr"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBulkPasteOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleProcessBulkPaste}
                disabled={!bulkText.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 text-slate-950 font-black text-xs shadow-md disabled:opacity-50"
              >
                فحص واستيراد الكروت ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Won Prize Celebration Modal */}
      {showPrizeModal && wonVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.35)] text-center space-y-4">
            {/* Victory Badge */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-bounce">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono">
                مبروك! لقد ربحت معنا
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-['Cairo'] mt-1">
                {wonVoucher.tierName}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                تم استبدال الـ 10 كروت بنجاح، وها هو كرتك الجديد المعتمد جاهز للاستخدام!
              </p>
            </div>

            {/* Won Voucher Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-400/40 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="text-slate-400">القيمة المالية:</span>
                <strong className="text-amber-400 font-bold">{wonVoucher.price} ريال</strong>
              </div>

              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">رقم الكرت:</span>
                  <strong className="font-mono text-cyan-300 text-base font-black tracking-wider">
                    {wonVoucher.code}
                  </strong>
                </div>

                <button
                  onClick={() => handleCopyCode(wonVoucher.code)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  {copiedCode === wonVoucher.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                  <span className="text-[10px] text-slate-400 block">رصيد البيانات</span>
                  <strong className="text-white font-bold">{wonVoucher.dataLabel}</strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-850">
                  <span className="text-[10px] text-slate-400 block">صلاحية الاتصال</span>
                  <strong className="text-white font-bold">{wonVoucher.durationLabel}</strong>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowPrizeModal(false);
                  onUseCode(wonVoucher.code);
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>تسجيل الدخول بالكرت الرابح الآن ⚡</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowPrizeModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                حفظ في محفظتي وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
