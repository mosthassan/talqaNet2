import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { 
  Zap, 
  QrCode, 
  ShieldCheck, 
  ShieldAlert,
  Timer,
  Sparkles, 
  Clipboard, 
  X, 
  AlertCircle, 
  MessageCircle, 
  Radio,
  Lock,
  ArrowLeft,
  Flame,
  Gauge,
  Gamepad2,
  BookmarkCheck,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Loader2,
  Film,
  Phone,
  History,
  Clock,
  HardDrive,
  MapPin,
  Layers,
  Tv,
  ExternalLink,
  Wifi,
  Search,
  Send,
  PhoneCall,
  Gift
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { INITIAL_PACKAGES } from '../data/initialData';
import { SpeedTier, MIKROTIK_SPEED_PROFILES, CardPackage } from '../types';
import { NetworkConfig } from '../utils/packagesStorage';
import confetti from 'canvas-confetti';
import { DeveloperFooter } from './DeveloperFooter';
import { getActiveUnpaidLoan } from '../utils/mikrotikBridge';
import { evaluateVoucherCode, VOUCHER_TEST_CODES, VoucherStatusInfo } from '../utils/voucherValidator';

interface HotspotLoginCardProps {
  onLogin: (code: string, speedTier?: SpeedTier) => Promise<boolean>;
  onOpenQR: () => void;
  onOpenBalanceCheck: (initialCode?: string) => void;
  onOpenEmergencyLoan: () => void;
  onOpenLiveStream?: () => void;
  initialCode?: string;
  onSelectTab: (tab: 'packages' | 'distributors' | 'speedtest' | 'loyalty' | 'login') => void;
  networkConfig?: NetworkConfig;
  packages?: CardPackage[];
  expiredSessionNotice?: {
    reason: 'time' | 'quota';
    message: string;
    voucherCode: string;
  } | null;
  onClearExpiredNotice?: () => void;
}

export const HotspotLoginCard: React.FC<HotspotLoginCardProps> = ({
  onLogin,
  onOpenQR,
  onOpenBalanceCheck,
  onOpenEmergencyLoan,
  onOpenLiveStream,
  initialCode = '',
  onSelectTab,
  networkConfig,
  packages = INITIAL_PACKAGES,
  expiredSessionNotice,
  onClearExpiredNotice
}) => {
  // Remember card state from localStorage
  const [rememberCard, setRememberCard] = useState<boolean>(() => {
    try {
      const pref = localStorage.getItem('netflow_remember_card_pref');
      return pref !== 'false'; // default to true
    } catch {
      return true;
    }
  });

  // Recent 5 Cards History State
  const [recentCards, setRecentCards] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('netflow_recent_vouchers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: any) => typeof c === 'string' && c.trim().length >= 3).slice(0, 5);
        }
      }
      // Migrate old single saved voucher if exists
      const old = localStorage.getItem('netflow_saved_voucher');
      if (old && old.trim().length >= 3) {
        return [old.trim()];
      }
    } catch {}
    return [];
  });

  const [showRecentModal, setShowRecentModal] = useState<boolean>(false);

  // Card input field starts completely empty with NO default test card data
  const [voucherCode, setVoucherCode] = useState<string>(() => {
    if (initialCode) return initialCode;
    return '';
  });

  const [selectedSpeedTier, setSelectedSpeedTier] = useState<SpeedTier>('ultra');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardStatusAlert, setCardStatusAlert] = useState<VoucherStatusInfo | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // 24-Hour Cooldown for Emergency Loan ("سلفني")
  const [salafniRemainingMs, setSalafniRemainingMs] = useState<number>(() => {
    try {
      const COOLDOWN_24H = 24 * 60 * 60 * 1000;
      const lastClick = Number(localStorage.getItem('talqa_salafni_last_click') || '0');
      const unpaidLoan = getActiveUnpaidLoan();
      const loanTime = unpaidLoan ? unpaidLoan.borrowedAt : 0;
      const latest = Math.max(lastClick, loanTime);
      if (!latest) return 0;
      const elapsed = Date.now() - latest;
      return elapsed < COOLDOWN_24H ? COOLDOWN_24H - elapsed : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const checkCooldown = () => {
      try {
        const COOLDOWN_24H = 24 * 60 * 60 * 1000;
        const lastClick = Number(localStorage.getItem('talqa_salafni_last_click') || '0');
        const unpaidLoan = getActiveUnpaidLoan();
        const loanTime = unpaidLoan ? unpaidLoan.borrowedAt : 0;
        const latest = Math.max(lastClick, loanTime);
        if (!latest) {
          setSalafniRemainingMs(0);
          return;
        }
        const elapsed = Date.now() - latest;
        setSalafniRemainingMs(elapsed < COOLDOWN_24H ? COOLDOWN_24H - elapsed : 0);
      } catch {
        setSalafniRemainingMs(0);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 10000);
    window.addEventListener('focus', checkCooldown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkCooldown);
    };
  }, []);

  const formatSalafniCooldown = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours} ساعة${minutes > 0 ? ` و ${minutes} د` : ''}`;
    }
    return `${Math.max(1, minutes)} دقيقة`;
  };

  const handleSalafniClick = () => {
    if (salafniRemainingMs > 0) return;

    const COOLDOWN_24H = 24 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      localStorage.setItem('talqa_salafni_last_click', now.toString());
    } catch {}
    setSalafniRemainingMs(COOLDOWN_24H);

    soundManager.playTap();
    onOpenEmergencyLoan();
  };

  const saveToRecentCards = (code: string) => {
    const trimmed = code.trim();
    if (trimmed.length < 3) return;
    setRecentCards((prev) => {
      const filtered = prev.filter((c) => c !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('netflow_recent_vouchers', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSelectRecentCard = (code: string) => {
    setVoucherCode(code);
    setError(null);
    soundManager.playTap();
    setShowRecentModal(false);
  };

  const handleRemoveSingleRecentCard = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playTap();
    setRecentCards((prev) => {
      const updated = prev.filter((c) => c !== code);
      try {
        localStorage.setItem('netflow_recent_vouchers', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearAllRecentCards = () => {
    soundManager.playTap();
    setRecentCards([]);
    try {
      localStorage.removeItem('netflow_recent_vouchers');
      localStorage.removeItem('netflow_saved_voucher');
    } catch {}
  };

  // Rate Limiting Anti-Brute-Force State (strictly 3 consecutive failed attempts)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('netflow_hotspot_fails') || '0', 10);
    } catch {
      return 0;
    }
  });

  const [lockUntil, setLockUntil] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('netflow_hotspot_lock_until');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const isLocked = lockUntil > Date.now();

  // Timer Effect for Rate Limiting
  useEffect(() => {
    if (!lockUntil || lockUntil <= Date.now()) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.ceil((lockUntil - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        setLockUntil(0);
        setFailedAttempts(0);
        setError(null);
        try {
          localStorage.removeItem('netflow_hotspot_lock_until');
          localStorage.setItem('netflow_hotspot_fails', '0');
        } catch {}
      } else {
        setRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleFailedAttempt = (customMsg?: string) => {
    try {
      const currentFails = parseInt(localStorage.getItem('netflow_hotspot_fails') || '0', 10) + 1;
      setFailedAttempts(currentFails);
      localStorage.setItem('netflow_hotspot_fails', currentFails.toString());

      if (currentFails >= 3) {
        // Lock only after 3 consecutive failures
        const currentLevel = parseInt(localStorage.getItem('netflow_hotspot_lock_level') || '0', 10);
        const durationSec = currentLevel >= 1 ? 300 : 60;
        const newLockUntil = Date.now() + durationSec * 1000;

        localStorage.setItem('netflow_hotspot_lock_until', newLockUntil.toString());
        localStorage.setItem('netflow_hotspot_lock_level', (currentLevel + 1).toString());
        localStorage.setItem('netflow_hotspot_fails', '0');

        setLockUntil(newLockUntil);
        setFailedAttempts(0);
        setError(`تم حظر الإدخال مؤقتاً لمدة ${durationSec === 60 ? 'دقيقة واحدة' : '5 دقائق'} لتجاوز 3 محاولات خاطئة متتالية.`);
        soundManager.playError();
      } else {
        setError(customMsg || `تأكد من رقم الكرت، هذا الرقم غير صحيح (محاولة ${currentFails} من 3) — يرجى مراجعة الأرقام وإدخال كرت جديد.`);
        soundManager.playError();
      }
    } catch {
      setError(customMsg || 'تأكد من رقم الكرت، هذا الرقم غير صحيح — يرجى مراجعة الأرقام المطبوعة على الكرت');
      soundManager.playError();
    }
  };

  useEffect(() => {
    if (initialCode) {
      setVoucherCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (expiredSessionNotice) {
      setVoucherCode('');
      setError(null);
      setCardStatusAlert(null);
    }
  }, [expiredSessionNotice]);

  const getSpeedTierLabel = (tier: SpeedTier) => {
    switch (tier) {
      case 'default': return 'كرت هوتسبوت (افتراضي)';
      case 'eco': return 'السرعة الاقتصادية (profile-eco)';
      case 'medium': return 'السرعة المتوسطة (profile-med)';
      case 'high': return 'السرعة العالية (profile-high)';
      case 'ultra': return 'سرعة فائقة / طلقة توربو (profile-turbo)';
      case 'gaming': return '🎮 وضع الألعاب - بنج طلقة 7ms (profile-gaming)';
    }
  };

  const handlePaste = async () => {
    if (isLocked) return;
    try {
      soundManager.playTap();
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.replace(/[^a-zA-Z0-9\-_]/g, '').trim();
        setVoucherCode(clean);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (isExternalHost) {
      const clean = voucherCode.trim();
      if (!clean || clean.length < 3) {
        setError('يرجى إدخال رقم الكرت أولاً');
        soundManager.playError();
        return;
      }
      handleDirectRouterLogin(clean);
      return;
    }

    // Send the exact code as entered without modifications or appended suffixes
    const clean = voucherCode.trim();
    if (!clean) {
      setError('يرجى إدخال كود الكرت أولاً');
      setCardStatusAlert(null);
      soundManager.playError();
      return;
    }

    // Evaluate voucher status against MikroTik rules
    const evaluation = evaluateVoucherCode(clean);
    if (evaluation.status !== 'valid') {
      setCardStatusAlert(evaluation);
      setError(null);
      soundManager.playError();
      if (evaluation.status === 'not_found') {
        handleFailedAttempt(evaluation.message);
      }
      return;
    }

    setCardStatusAlert(null);
    setError(null);
    setLoading(true);
    soundManager.playTap();

    try {
      const success = await onLogin(clean, selectedSpeedTier);
      if (success) {
        // Reset failures counter completely upon successful login
        try {
          localStorage.removeItem('netflow_hotspot_fails');
          localStorage.removeItem('netflow_hotspot_lock_level');
          localStorage.removeItem('netflow_hotspot_lock_until');
          setFailedAttempts(0);
          setLockUntil(0);

          // Save to Recent 5 Cards History
          if (rememberCard) {
            saveToRecentCards(clean);
          }
        } catch {}

        soundManager.playSuccess();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f2fe', '#0ea5e9', '#f97316', '#ffffff']
        });
      } else {
        const fallback = evaluateVoucherCode(clean);
        const finalAlert = fallback.status !== 'valid' ? fallback : {
          status: 'not_found' as const,
          title: '❌ رقم الكرت غير صحيح',
          message: 'تأكد من رقم الكرت، هذا الرقم غير مسجل في السيرفر أو توجد خانة مكتوبة بشكل خاطئ. يرجى مراجعة الأرقام المطبوعة على الكرت وتجنب الخلط بين الأرقام والحروف.',
          advice: 'يرجى التأكد من مطابقة الأرقام للكرت المطبوع، أو استخدام كاميرا الهاتف لمسح باركود الكرت (QR).'
        };
        setCardStatusAlert(finalAlert);
        if (finalAlert.status === 'not_found') {
          handleFailedAttempt('تأكد من رقم الكرت، هذا الرقم غير صحيح');
        }
      }
    } catch {
      setCardStatusAlert({
        status: 'not_found',
        title: '❌ خطأ في الاتصال بالسيرفر',
        message: 'حدث خطأ أثناء الاتصال بسيرفر ميكروتك. تأكد من اتصالك بالشبكة.',
        advice: 'أعد المحاولة أو قم بفحص سرعة الاتصال.'
      });
      soundManager.playError();
      handleFailedAttempt('حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  const isLocalRouter = typeof window !== 'undefined' && (
    window.location.hostname === 't.net' ||
    window.location.hostname === (networkConfig?.hotspotDnsName || 't.net') ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.')
  );
  const isExternalHost = !isLocalRouter;
  // Card input box is shown on local router, OR if admin explicitly enabled it in network settings
  const shouldShowVoucherBox = isLocalRouter || Boolean(networkConfig?.showVoucherBoxOnCloud);

  const handleDirectRouterLogin = (explicitCode?: string) => {
    const raw = typeof explicitCode === 'string' ? explicitCode : voucherCode;
    const clean = raw.trim();
    soundManager.playTap();
    const dns = networkConfig?.hotspotDnsName || 't.net';
    if (clean && clean.length >= 3) {
      window.location.href = `http://${dns}/login?username=${encodeURIComponent(clean)}&password=${encodeURIComponent(clean)}`;
    } else {
      window.location.href = `http://${dns}/login`;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative animate-fadeIn">
      {/* Background Outer Neon Glow */}
      <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/30 via-sky-600/20 to-orange-500/30 rounded-3xl blur-xl opacity-75 animate-pulse"></div>

      {/* Main Glassmorphic Card */}
      <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100">
        
        {/* Network Status Badge */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
            <span className="text-xs font-bold text-cyan-300">
              سيرفر ميكروتك {networkConfig?.networkName || 'طلقة'} نشط
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20 text-[11px] font-bold text-cyan-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>تغطية 5GHz & 2.4GHz</span>
          </div>
        </div>

        {/* Center Brand Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <BrandLogo 
            size="lg" 
            className="mb-2 justify-center" 
            networkName={networkConfig?.networkName}
            slogan={networkConfig?.slogan}
          />
          <p className="text-xs text-slate-400 max-w-[320px] mt-1 font-medium leading-relaxed">
            {shouldShowVoucherBox
              ? 'أدخل كود الكرت المطبوع على القسيمة أو امسح الباركود للاتصال الفوري بالإنترنت'
              : 'البوابة السحابية الذكية لخدمات المشتركين، الباقات، ونقاط البيع المعتمدة'}
          </p>
        </div>

        {/* Islamic Spiritual Reminder Banner (استخدم الإنترنت فيما ينفعك) - تصميم جذاب ومميز بخط عربي بديع */}
        <div className="mb-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-950/70 via-slate-950 to-emerald-950/70 border-2 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.25)] group transition-all duration-300 hover:border-amber-300">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="relative z-10 px-4 py-3.5 flex flex-col items-center justify-center text-center">
            {/* Header Tag with Decorative Arabesque Badges */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-400/80"></span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-black text-amber-300 tracking-wider shadow-sm">
                ۝ تذكير وموعظة ۝
              </span>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-400/80"></span>
            </div>

            {/* Glowing Quranic / Spiritual Calligraphy Quote */}
            <p className="font-['Amiri',serif] text-base sm:text-[17px] font-bold text-amber-200 leading-[1.8] tracking-wide drop-shadow-[0_2px_8px_rgba(245,158,11,0.4)] selection:bg-amber-500 selection:text-slate-950">
              « استخدم الإنترنت فيما ينفعك .. واحذر أن تجعل الله أهون الناظرين إليك »
            </p>
          </div>
        </div>

        {/* Quick Navigation Menu Bar (القوائم السريعة: فحص السرعة، نقاط البيع، الاستراحة، الباقات) */}
        <div className="mb-5 p-1.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 grid grid-cols-4 gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onSelectTab('speedtest');
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-slate-900/90 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group"
          >
            <Gauge className="w-4 h-4 mb-1 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold">فحص السرعة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onSelectTab('distributors');
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-slate-900/90 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group"
          >
            <MapPin className="w-4 h-4 mb-1 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold">نقاط البيع</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              if (onOpenLiveStream) onOpenLiveStream();
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="relative">
              <Tv className="w-4 h-4 mb-1 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
            </div>
            <span className="text-[11px] font-bold">الاستراحة 🎮</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onSelectTab('packages');
            }}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-slate-900/90 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group"
          >
            <Layers className="w-4 h-4 mb-1 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold">باقات الكروت</span>
          </button>
        </div>

        {/* Anti-Brute-Force Rate Limiting Alert Box */}
        {isLocked && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-rose-950/90 via-rose-900/60 to-rose-950/90 border-2 border-rose-500/80 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-pulse text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-rose-300 font-black text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>تنبيه أمني: حظر مؤقت</span>
            </div>
            <p className="text-xs font-bold text-rose-200 leading-relaxed">
              لقد تم حظرك مؤقتاً لتجاوز عدد المحاولات المسموحة. يرجى الانتظار حتى انتهاء الوقت.
            </p>
            <div className="inline-flex items-center justify-center gap-2.5 bg-slate-950/90 border border-rose-500/60 px-5 py-2 rounded-xl text-rose-300 font-mono font-black text-base shadow-inner">
              <Timer className="w-4 h-4 text-rose-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span>
                متبقي: {Math.floor(remainingSeconds / 60) < 10 ? `0${Math.floor(remainingSeconds / 60)}` : Math.floor(remainingSeconds / 60)}:
                {remainingSeconds % 60 < 10 ? `0${remainingSeconds % 60}` : remainingSeconds % 60}
              </span>
            </div>
          </div>
        )}

        {/* Expired Session Notice (انتهى الوقت والرصيد ويطلب من العميل إدخال كرت جديد) */}
        {expiredSessionNotice && !isLocked && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-amber-950/95 via-slate-950 to-rose-950/95 border-2 border-amber-500/80 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.35)] animate-fadeIn space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-sm text-amber-300 font-['Cairo']">
                      ⚠️ هذا الكرت انتهى رصيده
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">
                      {expiredSessionNotice.reason === 'quota' ? 'نفد رصيد الميجا' : 'انتهى الوقت'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed font-medium">
                    {expiredSessionNotice.message}
                  </p>
                  {expiredSessionNotice.voucherCode && (
                    <p className="text-[11px] text-amber-300/80 font-mono mt-1">
                      كود الكرت المنتهي: {expiredSessionNotice.voucherCode}
                    </p>
                  )}
                </div>
              </div>
              {onClearExpiredNotice && (
                <button
                  type="button"
                  onClick={onClearExpiredNotice}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>يرجى إدخال كرت جديد في الحقل بالأسفل لاستئناف التصفح، أو اختيار نقطة بيع قريبة.</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onSelectTab('distributors');
                }}
                className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>أقرب نقطة بيع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onSelectTab('packages');
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>باقات الكروت</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onOpenEmergencyLoan();
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-300 border border-orange-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>سلفني طوارئ</span>
              </button>
            </div>
          </div>
        )}

        {/* Specific Voucher Status Alert Banner (منتهي الصلاحية / منتهي الرصيد / كود غير موجود) */}
        {cardStatusAlert && !isLocked && (
          <div className={`mb-5 p-4 rounded-2xl border-2 animate-fadeIn space-y-3 shadow-xl ${
            cardStatusAlert.status === 'expired'
              ? 'bg-gradient-to-br from-amber-950/90 via-slate-950 to-amber-950/80 border-amber-500/70 text-amber-100 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
              : cardStatusAlert.status === 'zero_balance'
              ? 'bg-gradient-to-br from-rose-950/90 via-slate-950 to-rose-950/80 border-rose-500/70 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.25)]'
              : 'bg-gradient-to-br from-red-950/90 via-slate-950 to-red-950/80 border-red-500/70 text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border shrink-0 ${
                  cardStatusAlert.status === 'expired'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : cardStatusAlert.status === 'zero_balance'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-red-500/20 border-red-500/40 text-red-400'
                }`}>
                  {cardStatusAlert.status === 'expired' && <Clock className="w-5 h-5 animate-pulse" />}
                  {cardStatusAlert.status === 'zero_balance' && <HardDrive className="w-5 h-5 animate-pulse" />}
                  {cardStatusAlert.status === 'not_found' && <AlertCircle className="w-5 h-5 animate-pulse" />}
                </div>

                <div>
                  <h4 className="font-black text-sm font-['Cairo'] flex items-center gap-2">
                    <span>{cardStatusAlert.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      cardStatusAlert.status === 'expired'
                        ? 'bg-amber-500/30 text-amber-300'
                        : cardStatusAlert.status === 'zero_balance'
                        ? 'bg-rose-500/30 text-rose-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}>
                      {cardStatusAlert.badgeText || cardStatusAlert.status.toUpperCase()}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
                    {cardStatusAlert.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCardStatusAlert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Advice notice */}
            {cardStatusAlert.advice && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{cardStatusAlert.advice}</span>
              </div>
            )}

            {/* Contextual Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {cardStatusAlert.status === 'expired' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onSelectTab('distributors');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>أقرب نقطة بيع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onOpenEmergencyLoan();
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>سلفني طوارئ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onSelectTab('packages');
                    }}
                    className="col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>الباقات</span>
                  </button>
                </>
              )}

              {cardStatusAlert.status === 'zero_balance' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onSelectTab('packages');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>تصفح الباقات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onSelectTab('distributors');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>نقاط البيع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onOpenEmergencyLoan();
                    }}
                    className="col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>سلفني طوارئ</span>
                  </button>
                </>
              )}

              {cardStatusAlert.status === 'not_found' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      onOpenQR();
                    }}
                    className="py-2 px-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>مسح الباركود (QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setShowRecentModal(true);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>الكروت السابقة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setVoucherCode('');
                      setCardStatusAlert(null);
                    }}
                    className="col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>مسح الكود</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Generic Error Notification */}
        {error && !isLocked && !cardStatusAlert && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CLOUD / VERCEL MODE vs ROUTER MODE */}
        {!shouldShowVoucherBox ? (
          /* CLOUD / VERCEL MODE: Complete Subscriber Services Portal (بوابة خدمات المشتركين) */
          <div className="space-y-4 animate-fadeIn">
            {/* 1. Direct Router Action Card for Connected Users */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-cyan-500/40 shadow-[0_0_30px_rgba(14,165,233,0.15)] text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-sky-500/20 to-emerald-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-inner">
                <Wifi className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>متصل بشبكة الواي فاي؟</span>
                </div>
                <h3 className="text-lg font-black font-['Cairo'] text-white">
                  تسجيل الدخول إلى راوتر {networkConfig?.networkName || 'طلقة نت'}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-sm mx-auto">
                  إذا كنت متصلاً بشبكة الواي فاي وتريد إدخال كرت وتفعيل الإنترنت في هاتفك، اضغط على الزر بالأسفل لفتح صفحة الراوتر المحلي (<span className="text-cyan-300 font-mono font-bold">{networkConfig?.hotspotDnsName || 't.net'}</span>).
                </p>
              </div>

              {/* Big Direct Action Button */}
              <button
                type="button"
                onClick={() => handleDirectRouterLogin()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black font-['Cairo'] text-base shadow-[0_0_25px_rgba(14,165,233,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>فتح صفحة تسجيل الدخول بالراوتر ({networkConfig?.hotspotDnsName || 't.net'})</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>تفتح صفحة الراوتر فوراً للعملاء المتواجدين في نطاق تغطية الشبكة</span>
              </div>
            </div>

            {/* 2. Interactive Subscriber Hub (6 Services Grid) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>بوابة خدمات المشتركين السريعة</span>
                </span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-500/20 font-mono">
                  Cloud / PWA
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* 1. Packages */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onSelectTab('packages');
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-cyan-400 group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">باقات الكروت</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">الأسعار، الأحجام والصلاحيات</p>
                </button>

                {/* 2. Distributors / POS */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onSelectTab('distributors');
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-amber-400 group-hover:scale-105 transition-transform">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">نقاط البيع</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">المواقع وأرقام الموزعين</p>
                </button>

                {/* 3. Check Balance */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onOpenBalanceCheck(voucherCode.trim() || undefined);
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-sky-400 group-hover:scale-105 transition-transform">
                    <Search className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">فحص الرصيد</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">معرفة رصيد كرتك المتبقي</p>
                </button>

                {/* 4. Emergency Loan */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onOpenEmergencyLoan();
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-orange-400 group-hover:scale-105 transition-transform">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">سلفني طوارئ</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">رصيد فوري وسداده لاحقاً</p>
                </button>

                {/* 5. Speed Test */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onSelectTab('speedtest');
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Gauge className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">قياس السرعة</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">فحص سرعة الخط والبنج</p>
                </button>

                {/* 6. Live Stream */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onOpenLiveStream?.();
                  }}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-right transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-cyan-400 group-hover:scale-105 transition-transform">
                    <Tv className="w-4 h-4" />
                    <span className="text-xs font-bold text-white">البث المباشر</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">المباريات والقنوات مجاناً</p>
                </button>

                {/* 7. Loyalty Rewards */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    onSelectTab('loyalty');
                  }}
                  className="col-span-2 sm:col-span-3 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/40 hover:from-amber-900/50 hover:to-slate-800 border border-amber-500/40 hover:border-amber-400 text-right transition-all cursor-pointer group shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 group-hover:scale-105 transition-transform">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">مكافأة الانتماء لشبكة طلقة نت</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">10 = كرت مجاني</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">اجمع 10 كروت مستهلكة واستبدلها بكرت جديد فوراً عبر عجلة الحظ ⚡</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 shrink-0">
                    أدر العجلة 🎁
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Direct Contact & Support Bar */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <a
                href={`https://wa.me/${(networkConfig?.whatsappNumber || '967718097168').replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundManager.playTap()}
                className="py-2.5 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 font-bold flex items-center justify-center gap-2 transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>واتساب الدعم</span>
              </a>

              <a
                href={networkConfig?.telegramChannel || 'https://t.me/talqanet'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundManager.playTap()}
                className="py-2.5 px-3 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/40 text-sky-300 font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>قناة التلجرام</span>
              </a>
            </div>
          </div>
        ) : (
          /* LOCAL ROUTER MODE: Login Form (shown on router or when explicitly enabled in admin settings) */
          <form onSubmit={handleSubmit} className="space-y-4">
            {isExternalHost && (
              <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-between gap-2 text-xs">
                <span className="text-cyan-300 font-medium">وضع إدخال الكرت مفعل في الرابط السحابي</span>
                <span className="text-[10px] text-slate-400">إعدادات الإدارة</span>
              </div>
            )}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <label htmlFor="voucher-input" className="flex items-center gap-1.5 text-cyan-300">
                <Lock className="w-3.5 h-3.5" />
                <span>رقم الكرت / كود الشحن</span>
              </label>

              <div className="flex items-center gap-2">
                {/* Prominent Recent Cards Button */}
                <button
                  type="button"
                  id="btn-recent-cards-toggle"
                  onClick={() => {
                    soundManager.playTap();
                    setShowRecentModal(!showRecentModal);
                  }}
                  disabled={isLocked}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-sky-950 hover:from-cyan-900 hover:to-sky-900 border border-cyan-400/60 text-cyan-200 text-xs font-black transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
                  title="عرض سجل آخر 5 كروت تم إدخالها"
                >
                  <History className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>الكروت السابقة</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black">
                    {recentCards.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isLocked}
                  className="text-[11px] text-slate-400 hover:text-cyan-300 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center gap-1 transition-colors px-1.5 py-1 rounded-lg hover:bg-slate-800"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>{isCopied ? 'تم اللصق!' : 'لصق'}</span>
                </button>
                {voucherCode && (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setVoucherCode('');
                    }}
                    disabled={isLocked}
                    className="text-[11px] text-slate-400 hover:text-rose-400 disabled:opacity-40 flex items-center gap-0.5 transition-colors px-1.5 py-1 rounded-lg hover:bg-rose-950/40"
                  >
                    <X className="w-3 h-3" />
                    <span>مسح</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recent Cards Dropdown Modal (سجل آخر 5 كروت) */}
            {showRecentModal && (
              <div className="mb-3 p-3.5 rounded-2xl bg-slate-900/95 border border-cyan-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.2)] animate-fadeIn space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-white text-xs font-black">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>سجل الكروت السابقة (آخر 5 كروت)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecentModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  انقر على أي كرت لتعبئته مباشرة في خانة الدخول ⚡
                </p>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {recentCards.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 font-medium">
                      لا توجد كروت سابقة محفوظة حتى الآن.<br />ستظهر كروتك هنا تلقائياً بعد استخدامها.
                    </div>
                  ) : (
                    recentCards.map((card, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div
                          key={card}
                          className={`flex items-center justify-between p-2 rounded-xl transition-all border ${
                            isLatest
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => handleSelectRecentCard(card)}
                            className="flex-1 flex items-center gap-2.5 cursor-pointer overflow-hidden"
                          >
                            <span className="font-mono text-sm font-bold text-cyan-300 tracking-wider">
                              {card}
                            </span>
                            {isLatest ? (
                              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black shadow-[0_0_8px_rgba(245,158,11,0.4)] whitespace-nowrap">
                                ⭐ آخر كرت استخدمته
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold whitespace-nowrap">
                                كرت سابق #{idx + 1}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectRecentCard(card)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              تعبئة ↵
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveSingleRecentCard(card, e)}
                              title="حذف من السجل"
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {recentCards.length > 0 && (
                  <div className="flex justify-end pt-1.5 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleClearAllRecentCards}
                      className="text-[10px] text-slate-500 hover:text-rose-400 font-bold transition-colors cursor-pointer"
                    >
                      مسح السجل بالكامل 🗑️
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Input Box with Camera QR Button */}
            <div className="relative flex items-center">
              <input
                id="voucher-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isLocked}
                value={voucherCode}
                onKeyDown={(e) => {
                  if (isLocked) return;
                  // Allow navigation, control keys, and keyboard shortcuts (Backspace, Delete, Arrow keys, Tab, Enter, Ctrl/Cmd+A/C/V/X)
                  if (
                    e.key === 'Backspace' ||
                    e.key === 'Delete' ||
                    e.key === 'Tab' ||
                    e.key === 'Enter' ||
                    e.key === 'ArrowLeft' ||
                    e.key === 'ArrowRight' ||
                    e.key === 'ArrowUp' ||
                    e.key === 'ArrowDown' ||
                    e.ctrlKey ||
                    e.metaKey
                  ) {
                    return;
                  }
                  // Allow alphanumeric characters and hyphens/underscores
                  if (!/^[a-zA-Z0-9\-_]$/.test(e.key)) {
                    e.preventDefault();
                    soundManager.playTap();
                  }
                }}
                onPaste={(e) => {
                  if (isLocked) return;
                  e.preventDefault();
                  const pastedData = e.clipboardData.getData('text');
                  const clean = pastedData.replace(/[^a-zA-Z0-9\-_]/g, '').trim();
                  if (clean) {
                    setVoucherCode(clean);
                    setError(null);
                  }
                }}
                onChange={(e) => {
                  if (isLocked) return;
                  const clean = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '');
                  setVoucherCode(clean);
                  setError(null);
                }}
                placeholder={isLocked ? "مغلق مؤقتاً بسبب تكرار المحاولات" : expiredSessionNotice ? "أدخل كود الكرت الجديد هنا" : "مثال: 77885421 أو A554"}
                autoComplete="off"
                autoFocus={!isLocked}
                className="w-full bg-slate-950/90 border-2 border-slate-700/80 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,242,254,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:border-rose-900/60 rounded-2xl py-3.5 pr-4 pl-12 font-bold text-cyan-300 disabled:text-slate-500 text-xl tracking-widest placeholder:text-slate-600 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal outline-none transition-all text-center font-mono"
              />

              {/* QR Scanner Trigger */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  soundManager.playTap();
                  onOpenQR();
                }}
                title="مسح رمز الاستجابة السريعة (QR) عبر الكاميرا"
                className="absolute left-2.5 p-2 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none text-cyan-400 border border-slate-700 hover:border-cyan-500/40 transition-all group cursor-pointer"
              >
                <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Quick Card Action Buttons: فحص الرصيد المباشر + مسح الباركود */}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-inspect-voucher-direct"
                onClick={() => {
                  soundManager.playTap();
                  onOpenBalanceCheck(voucherCode.trim() || undefined);
                }}
                disabled={isLocked}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-950/90 to-blue-950/90 hover:from-sky-900 hover:to-blue-900 border border-sky-400/60 hover:border-sky-300 text-sky-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(14,165,233,0.25)] cursor-pointer disabled:opacity-40 active:scale-[0.98]"
              >
                <Search className="w-4 h-4 text-sky-400 shrink-0" />
                <span>فحص رصيد الكرت 🔍</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  onOpenQR();
                }}
                disabled={isLocked}
                className="py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/50 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98]"
              >
                <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>مسح باركود QR 📷</span>
              </button>
            </div>

            {/* Quick Strip of Recent Cards Directly Under Input */}
            {recentCards.length > 0 ? (
              <div className="mt-2.5 p-2.5 px-3 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                  <span className="text-[11px] font-black text-cyan-300 flex items-center gap-1 shrink-0">
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الكروت السابقة:</span>
                  </span>
                  {recentCards.map((card, idx) => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => handleSelectRecentCard(card)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                        idx === 0
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                      }`}
                      title="انقر لتعبئة هذا الكرت مباشرة"
                    >
                      {idx === 0 && <span className="text-[10px] text-amber-400 font-sans font-black">⭐ الأخير:</span>}
                      <span>{card}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecentModal(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold shrink-0 underline decoration-cyan-500/40 cursor-pointer whitespace-nowrap"
                >
                  إدارة السجل
                </button>
              </div>
            ) : (
              <div className="mt-2 p-2 px-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <History className="w-3.5 h-3.5 text-cyan-400/70 shrink-0" />
                  <span>سجل الكروت: سيتم حفظ كروتك هنا تلقائياً بعد استخدامها لسهولة تعبئتها</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecentModal(true)}
                  className="px-2 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold hover:bg-cyan-900 transition-all cursor-pointer whitespace-nowrap"
                >
                  فتح السجل 🕒
                </button>
              </div>
            )}

            {/* Quick Status Test Codes Pills */}
            <div className="mt-2.5 p-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400">تجربة الحالات السريعة:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {VOUCHER_TEST_CODES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setVoucherCode(item.code);
                      setError(null);
                      setCardStatusAlert(null);
                      soundManager.playTap();
                    }}
                    title={`انقر لتجربة: ${item.label}`}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      item.status === 'valid'
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                        : item.status === 'expired'
                        ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/50'
                        : item.status === 'zero_balance'
                        ? 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Remember Card Option Toggle (حفظ وتذكر الكرت) */}
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-cyan-500/30 transition-all">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl transition-colors ${rememberCard ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  <BookmarkCheck className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <span>حفظ وتذكر رقم الكرت على هذا الجهاز</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">💾 تلقائي</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    يحفظ كود الكرت تلقائياً حتى لا تفقد رصيدك عند رمي القسيمة الورقية
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={rememberCard}
                onChange={(e) => {
                  soundManager.playTap();
                  setRememberCard(e.target.checked);
                  try {
                    localStorage.setItem('netflow_remember_card_pref', e.target.checked ? 'true' : 'false');
                    if (!e.target.checked) {
                      localStorage.removeItem('netflow_recent_vouchers');
                      localStorage.removeItem('netflow_saved_voucher');
                      setRecentCards([]);
                    }
                  } catch {}
                }}
                className="w-5 h-5 accent-cyan-500 rounded-lg cursor-pointer shrink-0"
              />
            </label>
          </div>

          {/* Speed Tier Selection Section (Before Login) */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-slate-400">تحديد سرعة الكرت والبروفايل :</span>
                <div className="text-xs font-black text-orange-400 font-['Cairo'] flex items-center gap-1.5">
                  <span>{getSpeedTierLabel(selectedSpeedTier)}</span>
                </div>
              </div>
              <div className="p-1.5 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30">
                <Gauge className="w-4 h-4" />
              </div>
            </div>

            {/* Hidden Input for standard MikroTik form integration */}
            <input 
              type="hidden" 
              name="profile" 
              value={MIKROTIK_SPEED_PROFILES[selectedSpeedTier]?.profile || 'profile-turbo'} 
            />

            {/* 2x2 Speed Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* 1. Eco Speed -> profile-eco */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setSelectedSpeedTier('eco');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  selectedSpeedTier === 'eco'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <span>السرعة الاقتصادية</span>
                <span className={`text-[10px] ${selectedSpeedTier === 'eco' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>profile-eco</span>
              </button>

              {/* 2. Medium Speed -> profile-med */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setSelectedSpeedTier('medium');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  selectedSpeedTier === 'medium'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <span>السرعة المتوسطة</span>
                <span className={`text-[10px] ${selectedSpeedTier === 'medium' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>profile-med</span>
              </button>

              {/* 3. High Speed -> profile-high */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setSelectedSpeedTier('high');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  selectedSpeedTier === 'high'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <span>السرعة العالية</span>
                <span className={`text-[10px] ${selectedSpeedTier === 'high' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>profile-high</span>
              </button>

              {/* 4. Turbo / Ultra Speed -> profile-turbo */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playSuccess();
                  setSelectedSpeedTier('ultra');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                  selectedSpeedTier === 'ultra'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-current text-orange-400" />
                  <span>طلقة توربو</span>
                </div>
                <span className={`text-[10px] ${selectedSpeedTier === 'ultra' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>profile-turbo</span>
              </button>
            </div>

            {/* 5. Gaming Mode -> profile-gaming (Full-Width Button) */}
            <button
              type="button"
              onClick={() => {
                soundManager.playSuccess();
                setSelectedSpeedTier('gaming');
              }}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center justify-between gap-2 ${
                selectedSpeedTier === 'gaming'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.5)] scale-[1.01]'
                  : 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border-emerald-800/60 hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${selectedSpeedTier === 'gaming' ? 'bg-slate-950/30 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <div className="font-['Cairo'] font-black">🎮 وضع الألعاب (بنج طلقة / استقرار فائق)</div>
                  <div className={`text-[10px] font-mono ${selectedSpeedTier === 'gaming' ? 'text-slate-900 font-bold' : 'text-emerald-400/80'}`}>
                    بروفايل الميكروتك: profile-gaming
                  </div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                selectedSpeedTier === 'gaming' 
                  ? 'bg-slate-950 text-emerald-300' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                بنج 7ms ⚡
              </span>
            </button>
          </div>

          {/* Big Glow Login Button */}
          <button
            type="submit"
            disabled={loading || isLocked}
            className="relative w-full overflow-hidden rounded-2xl p-[1px] group transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-500 to-orange-500 rounded-2xl transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(14,165,233,0.7)]"></div>
            
            <div className={`relative ${isLocked ? 'bg-rose-950/80 text-rose-300' : 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950'} py-3.5 px-6 rounded-2xl font-black font-['Cairo'] text-base flex items-center justify-center gap-2.5 transition-all`}>
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>جارٍ التحقق والاتصال بالسيرفر...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-5 h-5 text-rose-400" />
                  <span>محظور مؤقتاً (انتظر انتهاء العداد)</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-slate-950 fill-slate-950 group-hover:scale-110 transition-transform" />
                  <span>تسجيل الدخول الفوري</span>
                </>
              )}
            </div>
          </button>

          {/* Direct Local MikroTik Router Login (for when browsing on Vercel / PWA) */}
          {isExternalHost && (
            <button
              type="button"
              onClick={() => handleDirectRouterLogin()}
              disabled={isLocked}
              className="w-full mt-2.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-teal-950/60 hover:from-emerald-900/60 hover:to-teal-900/60 border border-emerald-500/50 text-emerald-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-40"
              title="تسجيل دخول الجوال والإنترنت مباشرة في راوتر ميكروتك المحلي"
            >
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>دخول وتفعيل الإنترنت في الميكروتك مباشرة ({networkConfig?.hotspotDnsName || 't.net'})</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </button>
          )}
        </form>
        )}

        {/* Secondary Quick Actions: Emergency Loan (سلفني), Talqa Lounge (استراحة طلقة) & Check Balance */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
          {/* Unified Lounge Button: 🎮 استراحة طلقة (بث مباشر ومسلسلات مجاناً) */}
          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onOpenLiveStream?.();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 hover:from-emerald-900/70 hover:to-cyan-900/70 border-2 border-emerald-500/60 hover:border-cyan-400 text-white transition-all duration-300 group flex items-center justify-between shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] cursor-pointer text-right"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-4 w-4 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </div>
              <div className="text-right">
                <div className="font-['Cairo'] font-black text-sm text-emerald-300 group-hover:text-white flex items-center gap-1.5">
                  <span className="text-base">🎮</span>
                  <span>استراحة طلقة (بث مباشر وأفلام)</span>
                </div>
                <div className="text-[11px] text-slate-400 group-hover:text-slate-300 font-medium">
                  مباريات beIN & SSC مشفرة + سينما ومسلسلات 4K
                </div>
              </div>
            </div>
            
            <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-400/50 text-xs font-black text-emerald-200 group-hover:from-emerald-500 group-hover:to-cyan-500 group-hover:text-slate-950 transition-all flex items-center gap-1.5 shadow-sm shrink-0">
              <span>ترفيه مجاني</span>
              <span>🍿⚽</span>
            </span>
          </button>

          {/* Emergency SOS Hotspot Trial Button (سلفني) */}
          <button
            id="salafni-loan-btn"
            type="button"
            disabled={salafniRemainingMs > 0}
            onClick={handleSalafniClick}
            className={
              salafniRemainingMs > 0
                ? "w-full py-3 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500 opacity-40 grayscale cursor-not-allowed transition-all duration-200 flex items-center justify-between shadow-none select-none"
                : "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-400/60 text-amber-200 hover:text-white transition-all duration-200 group flex items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.08)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] cursor-pointer"
            }
          >
            <div className="flex items-center gap-2.5">
              <span
                className={
                  salafniRemainingMs > 0
                    ? "p-1.5 rounded-xl bg-slate-800/80 text-slate-500 border border-slate-700/50"
                    : "p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-105 group-hover:bg-amber-500/30 transition-transform"
                }
              >
                <Zap className="w-4 h-4 fill-current" />
              </span>
              <span
                className={
                  salafniRemainingMs > 0
                    ? "font-['Cairo'] font-black text-sm tracking-wide text-slate-500"
                    : "font-['Cairo'] font-black text-sm tracking-wide text-amber-300 group-hover:text-amber-200"
                }
              >
                سلفني
              </span>
            </div>
            
            {salafniRemainingMs > 0 ? (
              <span className="px-2.5 py-1 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                <Timer className="w-3 h-3 text-slate-500" />
                <span>متاح بعد {formatSalafniCooldown(salafniRemainingMs)}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] font-black text-amber-300 group-hover:bg-amber-500/25 group-hover:text-amber-200 transition-colors">
                للطوارئ مجاناً ⚡
              </span>
            )}
          </button>

          {/* Balance Check */}
          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onOpenBalanceCheck(voucherCode.trim() || undefined);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-orange-500/40 text-slate-300 hover:text-orange-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-orange-400" />
            <span>فحص رصيد الكرت دون استهلاكه</span>
          </button>
        </div>

        {/* Official Approved Cards & Packages Showcase */}
        <div className="mt-5 pt-4 border-t border-slate-800/60">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-['Cairo'] text-white">فئات كروت الإنترنت المعتمدة:</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">
              {packages.length} فئات
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 text-right transition-all"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                  <div className="text-[11px] font-black text-white font-['Cairo']">
                    {pkg.price} <span className="text-[9px] text-orange-400 font-normal">{pkg.currency || 'ريال'}</span>
                  </div>
                  <div className="text-[10px] text-orange-400 font-bold font-mono">
                    {pkg.dataLimitLabel}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                  <span className="text-slate-300">{pkg.durationLabel}</span>
                  <span className="text-emerald-400 text-[9px] font-bold">{pkg.validityDaysLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Direct Links to Pricing & Distributors */}
        <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs">
          <button
            onClick={() => {
              soundManager.playTap();
              onSelectTab('packages');
            }}
            className="py-2 px-3 rounded-xl bg-slate-950/50 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors border border-slate-800/60 flex items-center justify-center gap-1"
          >
            <span>شراء كرت جديد</span>
            <ArrowLeft className="w-3 h-3 text-cyan-400" />
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              onSelectTab('distributors');
            }}
            className="py-2 px-3 rounded-xl bg-slate-950/50 hover:bg-slate-800 text-slate-300 hover:text-orange-300 transition-colors border border-slate-800/60 flex items-center justify-center gap-1"
          >
            <span>أماكن ونقاط البيع</span>
            <ArrowLeft className="w-3 h-3 text-orange-400" />
          </button>
        </div>

        {/* WhatsApp & Call Customer Care Quick Links */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
          <a
            href={`https://wa.me/${(networkConfig?.whatsappNumber || '967718097168').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
              `مرحبا خدمة عملاء شبكة ${networkConfig?.networkName || 'طلقة نت'}، أحتاج مساعدة بخصوص تسجيل الدخول وشراء كروت الإنترنت`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>واتساب الدعم الفني ({networkConfig?.supportPhone || '718097168'})</span>
          </a>
          <span className="text-slate-600">•</span>
          <a
            href={`tel:${networkConfig?.supportPhone || '718097168'}`}
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-cyan-400" />
            <span>اتصال ({networkConfig?.supportPhone || '718097168'})</span>
          </a>
        </div>

      </div>

      {/* Developer Signature & Copyright */}
      <div className="mt-4">
        <DeveloperFooter compact />
      </div>
    </div>
  );
};
