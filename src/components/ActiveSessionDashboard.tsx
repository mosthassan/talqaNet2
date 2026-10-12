import React, { useState, useEffect } from 'react';
import { UserSession, SpeedTier, MIKROTIK_SPEED_PROFILES } from '../types';
import { 
  Wifi, 
  LogOut, 
  PauseCircle,
  PlayCircle,
  RefreshCw, 
  Clock, 
  HardDrive, 
  Zap, 
  Activity, 
  Smartphone, 
  Globe, 
  Server, 
  ShieldCheck, 
  MessageCircle, 
  Phone,
  PlusCircle, 
  Share2, 
  Check, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Tv,
  Gamepad2,
  Sliders,
  Sparkles,
  Layers,
  Flame,
  Radio,
  MapPin,
  Gauge,
  Copy,
  CheckCheck,
  Cpu,
  Key,
  AlertCircle
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { LiveStreamModal } from './LiveStreamModal';
import { BalanceCheckModal } from './BalanceCheckModal';
import { NetworkConfig } from '../utils/packagesStorage';
import { syncLiveSessionUsage } from '../utils/cardsDatabase';

interface ActiveSessionDashboardProps {
  session: UserSession;
  onLogout: () => void;
  onTopUp: () => void;
  onOpenSpeedTest: () => void;
  onOpenDistributors?: () => void;
  onOpenPackages?: () => void;
  onOpenLiveStream?: () => void;
  networkConfig?: NetworkConfig;
  onSessionExpired?: (reason: 'time' | 'quota', voucherCode: string) => void;
}

export const ActiveSessionDashboard: React.FC<ActiveSessionDashboardProps> = ({
  session,
  onLogout,
  onTopUp,
  onOpenSpeedTest,
  onOpenDistributors,
  onOpenPackages,
  onOpenLiveStream,
  networkConfig,
  onSessionExpired
}) => {
  const [secondsLeft, setSecondsLeft] = useState(session.remainingSeconds);
  const [uptimeSeconds, setUptimeSeconds] = useState(90); // default 1 min 30 sec as in reference
  const [downloadBytes, setDownloadBytes] = useState(session.downloadBytes);
  const [uploadBytes, setUploadBytes] = useState(session.uploadBytes);
  const [copied, setCopied] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiveStreamOpen, setIsLiveStreamOpen] = useState(false);
  const [isBalanceCheckOpen, setIsBalanceCheckOpen] = useState(false);

  // Speed Profile State (from screenshot)
  const initialTier: SpeedTier = session.speedTier || 'ultra';
  const getInitialLabel = (tier: SpeedTier) => {
    switch (tier) {
      case 'default': return 'كرت هوتسبوت (افتراضي)';
      case 'eco': return 'السرعة الاقتصادية (profile-eco)';
      case 'medium': return 'السرعة المتوسطة (profile-med)';
      case 'high': return 'السرعة العالية (profile-high)';
      case 'ultra': return 'سرعة فائقة (طلقة توربو 🚀 - profile-turbo)';
      case 'gaming': return '🎮 وضع الألعاب (بنج طلقة / استقرار فائق - profile-gaming)';
    }
  };

  const [activeSpeedTier, setActiveSpeedTier] = useState<SpeedTier>(initialTier);
  const [currentSpeedLabel, setCurrentSpeedLabel] = useState(getInitialLabel(initialTier));
  const [simulatedDownload, setSimulatedDownload] = useState(
    session.speedTier === 'gaming' ? 50.0 : session.currentDownloadSpeedMbps || 52.4
  );
  const [simulatedUpload, setSimulatedUpload] = useState(
    session.speedTier === 'gaming' ? 20.0 : session.currentUploadSpeedMbps || 18.2
  );
  const [currentPing, setCurrentPing] = useState(session.speedTier === 'gaming' ? 7 : session.pingMs || 15);

  // Smart Data Savers & Firewalls (from screenshot: Google Updates toggle)
  const [googleUpdatesEnabled, setGoogleUpdatesEnabled] = useState(false);
  const [videoSaverEnabled, setVideoSaverEnabled] = useState(true);
  const [gamingBoosterEnabled, setGamingBoosterEnabled] = useState(true);

  // Notification Banner
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Live countdown timer, uptime counter, and simulated active bandwidth
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onSessionExpired) {
            onSessionExpired('time', session.voucherCode);
          } else {
            onLogout();
          }
          return 0;
        }
        return prev - 1;
      });

      setUptimeSeconds((prev) => prev + 1);

      // Speed-dependent traffic increment
      const multiplier = activeSpeedTier === 'eco' ? 0.3 : activeSpeedTier === 'medium' ? 0.7 : activeSpeedTier === 'high' ? 1.2 : 1.8;
      const dlInc = Math.floor((Math.random() * 60000 + 30000) * multiplier);
      const ulInc = Math.floor((Math.random() * 15000 + 8000) * multiplier);
      setDownloadBytes((prev) => prev + dlInc);
      setUploadBytes((prev) => prev + ulInc);

      // Real-time synchronization back to cards database
      if (session.voucherCode) {
        syncLiveSessionUsage(session.voucherCode, dlInc + ulInc, 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, activeSpeedTier]);

  const handleSpeedChange = (tier: SpeedTier) => {
    soundManager.playTap();
    setActiveSpeedTier(tier);

    switch (tier) {
      case 'default':
        setCurrentSpeedLabel('كرت هوتسبوت (افتراضي)');
        setSimulatedDownload(12.5);
        setSimulatedUpload(4.0);
        setCurrentPing(18);
        showNotification('تم تفعيل سرعة الكرت الافتراضية (12 Mbps)');
        break;
      case 'eco':
        setCurrentSpeedLabel('السرعة الاقتصادية (profile-eco)');
        setSimulatedDownload(3.2);
        setSimulatedUpload(1.5);
        setCurrentPing(22);
        showNotification('تم تفعيل الوضع الاقتصادي (profile-eco) لتوفير رصيد الميجابايت');
        break;
      case 'medium':
        setCurrentSpeedLabel('السرعة المتوسطة (profile-med)');
        setSimulatedDownload(16.0);
        setSimulatedUpload(6.5);
        setCurrentPing(16);
        showNotification('تم ضبط السرعة على المستوى المتوسط (profile-med)');
        break;
      case 'high':
        setCurrentSpeedLabel('السرعة العالية (profile-high)');
        setSimulatedDownload(34.8);
        setSimulatedUpload(14.0);
        setCurrentPing(12);
        showNotification('تم تفعيل السرعة العالية للألياف الضوئية (profile-high)');
        break;
      case 'gaming':
        setCurrentSpeedLabel('🎮 وضع الألعاب (بنج طلقة 7ms - profile-gaming)');
        setSimulatedDownload(50.0);
        setSimulatedUpload(20.0);
        setCurrentPing(7);
        soundManager.playSuccess();
        showNotification('🎮 تم إرسال profile-gaming للميكروتك: بنج 7ms واستقرار فائق!');
        break;
      case 'ultra':
      default:
        setCurrentSpeedLabel('سرعة فائقة (طلقة توربو 🚀 - profile-turbo)');
        setSimulatedDownload(64.2);
        setSimulatedUpload(24.5);
        setCurrentPing(10);
        soundManager.playSuccess();
        showNotification('⚡ تم تفعيل أقصى طاقة سرعة فايبر بدون قيود (profile-turbo)!');
        break;
    }
  };

  const handleToggleGoogleUpdates = () => {
    soundManager.playTap();
    const nextState = !googleUpdatesEnabled;
    setGoogleUpdatesEnabled(nextState);
    if (!nextState) {
      showNotification('🛡️ تم إيقاف تحديثات جوجل وحماية رصيد الكرت من الاستهلاك بالخلفية');
    } else {
      showNotification('⚠️ تم تفعيل تحديثات متجر جوجل وتطبيقات النظام');
    }
  };

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return {
      hrs: String(hrs).padStart(2, '0'),
      mins: String(mins).padStart(2, '0'),
      secs: String(secs).padStart(2, '0')
    };
  };

  const formatUptimeArabic = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs} ساعة و ${mins} دقيقة و ${secs} ثانية`;
    }
    return `${mins} دقيقة ${secs} ثانية`;
  };

  const timeParts = formatTime(secondsLeft);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [copiedIp, setCopiedIp] = useState(false);

  const handleCopyIp = () => {
    soundManager.playTap();
    navigator.clipboard.writeText(session.ipAddress);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const totalUsedBytes = downloadBytes + uploadBytes;
  const remainingBytes = Math.max(0, session.totalBytes - totalUsedBytes);
  const usedPercent = Math.min(100, Math.round((totalUsedBytes / session.totalBytes) * 100));
  const remainingPercent = Math.max(0, 100 - usedPercent);
  const remainingMB = Math.max(0, Math.round(remainingBytes / (1024 * 1024)));
  const totalMB = Math.round(session.totalBytes / (1024 * 1024));
  const usedMB = Math.round(totalUsedBytes / (1024 * 1024));

  // Auto-redirect to login screen if time or quota ends
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onSessionExpired) {
        onSessionExpired('time', session.voucherCode);
      } else {
        onLogout();
      }
    }
  }, [secondsLeft, onSessionExpired, onLogout, session.voucherCode]);

  useEffect(() => {
    if (session.totalBytes > 0 && remainingBytes <= 0) {
      if (onSessionExpired) {
        onSessionExpired('quota', session.voucherCode);
      } else {
        onLogout();
      }
    }
  }, [remainingBytes, session.totalBytes, onSessionExpired, onLogout, session.voucherCode]);

  const handleCopySessionInfo = () => {
    soundManager.playTap();
    const text = `جلسة إنترنت طلقة نت:\nكود الكرت: ${session.voucherCode}\nعنوان IP: ${session.ipAddress}\nالوقت المتصل: ${formatUptimeArabic(uptimeSeconds)}\nالوقت المتبقي: ${timeParts.hrs}:${timeParts.mins}:${timeParts.secs}\nالميجا المتبقي: ${remainingMB.toLocaleString('en-US')} MB (${formatBytes(remainingBytes)})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {statusNotification && (
        <div className="p-3 rounded-2xl bg-cyan-500/90 text-slate-950 text-xs font-black shadow-2xl flex items-center justify-between animate-fadeIn border border-cyan-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{statusNotification}</span>
          </div>
          <Check className="w-4 h-4" />
        </div>
      )}

      {/* Global Quick Navigation Bar (فحص السرعة، نقاط البيع، الاستراحة، باقات الكروت) */}
      <div className="p-1.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 grid grid-cols-4 gap-1.5 shadow-xl">
        <button
          type="button"
          onClick={() => {
            soundManager.playTap();
            onOpenSpeedTest();
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
            if (onOpenDistributors) onOpenDistributors();
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
            else setIsLiveStreamOpen(true);
          }}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer group"
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
            if (onOpenPackages) onOpenPackages();
          }}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-slate-900/90 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group"
        >
          <Layers className="w-4 h-4 mb-1 text-sky-400 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold">باقات الكروت</span>
        </button>
      </div>

      {/* Top Bar: Connected Since Uptime widget & Live Status */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
          </span>
          <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <span className="text-slate-400">متصل منذ :</span>
            <span className="font-mono text-emerald-400 font-black text-sm">{formatUptimeArabic(uptimeSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentPing}ms</span>
          </div>

          <button
            onClick={handleCopySessionInfo}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copied ? 'تم النسخ' : 'مشاركة'}</span>
          </button>
        </div>
      </div>

      {/* Emergency Loan Active Session Banner */}
      {session.isEmergencyLoan && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/50 shadow-lg flex items-start gap-3 animate-fadeIn">
          <div className="p-2 rounded-xl bg-amber-500/30 text-amber-300 border border-amber-500/40 shrink-0">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-black text-amber-300 flex items-center gap-2 font-['Cairo']">
              <span>جلسة إنترنت طوارئ نشطة (سلفني)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-[10px] font-bold">SOS</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              لديك رصيد طوارئ محدود للمواقف العاجلة. عند إدخال كرت رسمي، سيتم خصم حجم السلفة تلقائياً وتفعيل كرتك.
            </p>
          </div>
        </div>
      )}

      {/* Loan Repaid Notice */}
      {session.loanDeductionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 shadow-lg flex items-start gap-3 animate-fadeIn">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-black text-emerald-400 font-['Cairo']">
              تم تسوية سلفة الطوارئ السابقة
            </div>
            <p className="text-slate-300 text-[11px]">
              {session.loanDeductionNotice}
            </p>
          </div>
        </div>
      )}

      {/* LUXURY HERO CARD: الميجا المتبقي ورصيد الباقة الفائق الأناقة */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border-2 border-cyan-500/30 p-5 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.18)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16"></div>

        <div className="relative z-10 space-y-5">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <HardDrive className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>رصيد وحجم البيانات المتبقية</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-xs shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{remainingPercent}% متبقي</span>
            </div>
          </div>

          {/* Central Hero Display: الميجا المتبقي */}
          <div className="text-center py-2 space-y-1">
            <div className="text-xs text-slate-400 font-medium">الميجابايت المتبقية المتاحة للاستخدام:</div>
            <div className="flex items-baseline justify-center gap-2 font-mono">
              <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)] tracking-tight">
                {remainingMB.toLocaleString('en-US')}
              </span>
              <span className="text-lg sm:text-xl font-bold text-cyan-400 font-sans">ميجابايت (MB)</span>
            </div>
            <div className="text-xs font-bold text-slate-300">
              ما يعادل تقريباً: <span className="text-cyan-300 font-mono">{formatBytes(remainingBytes)}</span>
            </div>
          </div>

          {/* High-Tech Progress Meter */}
          <div className="space-y-2">
            <div className="w-full bg-slate-950/80 rounded-full h-3 p-0.5 border border-slate-800 relative overflow-hidden shadow-inner">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={{ width: `${remainingPercent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span>0 MB</span>
              <span className="font-sans text-slate-300">مستهلك: {usedMB.toLocaleString('en-US')} MB ({usedPercent}%)</span>
              <span>{totalMB.toLocaleString('en-US')} MB</span>
            </div>
          </div>

          {/* Detailed Statistics 4-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-cyan-500/20 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>المستهلك تنزيل</span>
              </div>
              <div className="font-mono font-black text-sm text-cyan-300">
                {formatBytes(downloadBytes)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-orange-500/20 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <ArrowUp className="w-3.5 h-3.5 text-orange-400" />
                <span>المستهلك رفع</span>
              </div>
              <div className="font-mono font-black text-sm text-orange-300">
                {formatBytes(uploadBytes)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>سعة الكرت الكلية</span>
              </div>
              <div className="font-mono font-black text-sm text-white">
                {formatBytes(session.totalBytes)}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/20 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>حالة الرصيد</span>
              </div>
              <div className="font-bold text-xs text-emerald-300">
                {remainingPercent > 20 ? 'وفير ومستقر ✅' : 'قارب على الانتهاء ⚠️'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2026 AI Smart Card Balance & Ledger Inspector Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-900 to-blue-950/70 border border-cyan-500/30 p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-right w-full sm:w-auto">
          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white font-['Cairo']">فحص رصيد الكرت الذكي</h4>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-black border border-cyan-500/40">
                2026 AI LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">استعلام لحظي عن الرصيد، السيريال، نقطة التوزيع ونمط الاستهلاك</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundManager.playTap();
            setIsBalanceCheckOpen(true);
          }}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>فحص رصيد هذا الكرت الآن ⚡</span>
        </button>
      </div>

      {/* TECHNICAL IDENTITY & ADDRESSING CARD: عنوان IP والمعرفات الاحترافية */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400">
            <Globe className="w-4 h-4" />
            <span>بيانات الاتصال والعنوان التقني للجهاز (Network Identity)</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            متصل ونشط
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* IP Address with 1-Click Copy */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-cyan-400" />
                <span>عنوان IP جهازك:</span>
              </div>
              <div className="font-mono font-black text-sm text-cyan-300">
                {session.ipAddress}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyIp}
              title="نسخ عنوان IP"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
            >
              {copiedIp ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedIp ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          {/* MAC Address */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Radio className="w-3 h-3 text-orange-400" />
                <span>عنوان الماك (MAC Address):</span>
              </div>
              <div className="font-mono font-bold text-xs text-slate-200">
                {session.macAddress}
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 font-bold">مقترن</span>
          </div>

          {/* MikroTik Gateway */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Server className="w-3 h-3 text-emerald-400" />
                <span>سيرفر وبوابة ميكروتك (Gateway):</span>
              </div>
              <div className="font-mono font-bold text-xs text-emerald-300">
                {session.gatewayIp || '10.5.50.1'} (router.hotspot)
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 font-bold">FastPath</span>
          </div>

          {/* Voucher Code */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Key className="w-3 h-3 text-amber-400" />
                <span>كود الكرت النشط:</span>
              </div>
              <div className="font-mono font-bold text-xs text-amber-300">
                {session.voucherCode}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySessionInfo}
              className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
            >
              نسخ البيانات
            </button>
          </div>
        </div>
      </div>

      {/* Time Countdown Digital Cyber Clock */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Clock className="w-4 h-4" />
            <span>الوقت المتبقي للجلسة</span>
          </span>
          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded-lg text-slate-300">تنازلي حي</span>
        </div>

        <div className="my-2 flex items-center justify-center gap-2 font-mono">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center text-2xl font-black text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              {timeParts.hrs}
            </div>
            <span className="text-[10px] text-slate-400 font-sans mt-1 font-bold">ساعة</span>
          </div>

          <span className="text-2xl font-black text-cyan-400 animate-pulse -mt-4">:</span>

          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center text-2xl font-black text-cyan-300 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
              {timeParts.mins}
            </div>
            <span className="text-[10px] text-slate-400 font-sans mt-1 font-bold">دقيقة</span>
          </div>

          <span className="text-2xl font-black text-cyan-400 animate-pulse -mt-4">:</span>

          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-orange-500/40 flex items-center justify-center text-2xl font-black text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
              {timeParts.secs}
            </div>
            <span className="text-[10px] text-slate-400 font-sans mt-1 font-bold">ثانية</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>حالة الاتصال بالبوابة:</span>
          <span className="font-bold text-emerald-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>مستقر (5GHz Wi-Fi 6)</span>
          </span>
        </div>
      </div>

      {/* FEATURE 1: Speed Profile Controller (Card Speed as seen in screenshot) */}
      <div className="rounded-3xl bg-slate-900/95 border border-cyan-500/30 p-5 sm:p-6 shadow-[0_0_35px_rgba(14,165,233,0.18)] relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Speed Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">سرعة الكرت الحالية :</span>
            <div className="text-xl sm:text-2xl font-black text-orange-500 font-['Cairo'] tracking-wide">
              {currentSpeedLabel}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(14,165,233,0.35)] animate-pulse">
            <Zap className="w-6 h-6 fill-current" />
          </div>
        </div>

        {/* Grid of Speed Buttons matching user's layout and exact MikroTik profiles */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Eco Speed -> profile-eco */}
          <button
            onClick={() => handleSpeedChange('eco')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
              activeSpeedTier === 'eco'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
            }`}
          >
            <span>السرعة الاقتصادية</span>
            <span className={`text-[10px] ${activeSpeedTier === 'eco' ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>profile-eco</span>
          </button>

          {/* 2. Medium Speed -> profile-med */}
          <button
            onClick={() => handleSpeedChange('medium')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
              activeSpeedTier === 'medium'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
            }`}
          >
            <span>السرعة المتوسطة</span>
            <span className={`text-[10px] ${activeSpeedTier === 'medium' ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>profile-med</span>
          </button>

          {/* 3. High Speed -> profile-high */}
          <button
            onClick={() => handleSpeedChange('high')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
              activeSpeedTier === 'high'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
            }`}
          >
            <span>السرعة العالية</span>
            <span className={`text-[10px] ${activeSpeedTier === 'high' ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>profile-high</span>
          </button>

          {/* 4. Turbo Speed -> profile-turbo */}
          <button
            onClick={() => handleSpeedChange('ultra')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
              activeSpeedTier === 'ultra'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current text-orange-400" />
              <span>سرعة فائقة (توربو)</span>
            </div>
            <span className={`text-[10px] ${activeSpeedTier === 'ultra' ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>profile-turbo</span>
          </button>
        </div>

        {/* 5. Dedicated Gaming Mode -> profile-gaming */}
        <button
          onClick={() => handleSpeedChange('gaming')}
          className={`w-full mt-2.5 py-3 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer border flex items-center justify-between gap-2 ${
            activeSpeedTier === 'gaming'
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-[1.01]'
              : 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border-emerald-800/60 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-xl ${activeSpeedTier === 'gaming' ? 'bg-slate-950/30 text-slate-950' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="font-['Cairo'] font-black">🎮 وضع الألعاب (بنج طلقة / استقرار فائق)</div>
              <div className={`text-[10px] font-mono ${activeSpeedTier === 'gaming' ? 'text-slate-900 font-bold' : 'text-emerald-400/80'}`}>
                البروفايل: profile-gaming
              </div>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
            activeSpeedTier === 'gaming' 
              ? 'bg-slate-950 text-emerald-300' 
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            بنج 7ms ⚡
          </span>
        </button>
      </div>

      {/* FEATURE 2: Google Updates & System Protection Switch (Exact match to screenshot) */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">تحديثات جوجل :</span>
              <span className={`text-sm font-black flex items-center gap-1.5 ${googleUpdatesEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${googleUpdatesEnabled ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`}></span>
                <span>{googleUpdatesEnabled ? 'مفعلة' : 'معطلة (محمية وموفرة)'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {googleUpdatesEnabled 
                ? 'جوجل بلاي يقوم بتحديث التطبيقات تلقائياً (يستهلك بيانات)' 
                : 'تم إيقاف التحديثات التلقائية لحماية رصيد الميجابايت من النفاد'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggleGoogleUpdates}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none cursor-pointer shrink-0 ${
            googleUpdatesEnabled ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              googleUpdatesEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Speed Metrics Bar with Interactive Full Speed Test Button */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>مؤشرات سرعة الاتصال الحالية ومعدل النقل</span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onOpenSpeedTest();
            }}
            className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>بدء فحص السرعة الكامل ⚡</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 mb-0.5">Ping السيرفر</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
              {currentPing} <span className="text-[10px] text-slate-400 font-sans">ms</span>
            </div>
            <span className="text-[9px] text-emerald-400 font-bold">
              {activeSpeedTier === 'gaming' ? 'بنج طلقة ⚡' : 'بينج منخفض'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 mb-0.5">التنزيل الفعلي</div>
            <div className="text-base sm:text-lg font-black text-cyan-300 font-mono">
              {simulatedDownload.toFixed(1)} <span className="text-[10px] text-slate-400 font-sans">Mbps</span>
            </div>
            <span className="text-[9px] text-cyan-400 font-bold">4K متاح</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 mb-0.5">الرفع الفعلي</div>
            <div className="text-base sm:text-lg font-black text-orange-400 font-mono">
              {simulatedUpload.toFixed(1)} <span className="text-[10px] text-slate-400 font-sans">Mbps</span>
            </div>
            <span className="text-[9px] text-orange-400 font-bold">بث مباشر</span>
          </div>
        </div>
      </div>

      {/* FEATURE 3 & 4: Action Buttons (Exact Match to Reference: Disconnect, Logout, Live Stream) */}
      <div className="space-y-2.5 pt-1">
        {/* Row 1: Disconnect & Logout */}
        <div className="grid grid-cols-2 gap-3">
          {/* قطع الاتصال (Disconnect / Pause Session) */}
          <button
            onClick={() => {
              soundManager.playTap();
              setShowPauseModal(true);
            }}
            className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(249,115,22,0.35)] cursor-pointer active:scale-98"
          >
            <PauseCircle className="w-5 h-5" />
            <span>قطع الاتصال</span>
          </button>

          {/* تسجيل الخروج (Full Logout) */}
          <button
            onClick={() => {
              soundManager.playError();
              setShowLogoutConfirm(true);
            }}
            className="py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(225,29,72,0.35)] cursor-pointer active:scale-98"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Big Vibrant Button: استراحة طلقة (Entertainment & Streaming Hub) */}
        <button
          onClick={() => {
            soundManager.playTap();
            setIsLiveStreamOpen(true);
          }}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] cursor-pointer active:scale-98 border border-emerald-300/40"
        >
          <Tv className="w-6 h-6 animate-pulse" />
          <span>🎮 استراحة طلقة (بث مباشر وأفلام مجاناً)</span>
        </button>
      </div>

      {/* Secondary Actions: Top up & WhatsApp Support */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={() => {
            soundManager.playTap();
            onTopUp();
          }}
          className="py-3 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-cyan-400" />
          <span>شحن كرت إضافي</span>
        </button>

        <a
          href={`https://wa.me/${(networkConfig?.whatsappNumber || '967718097168').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
            `مرحبا، أنا متصل حالياً بشبكة ${networkConfig?.networkName || 'طلقة نت'} (كرت: ${session.voucherCode}) وأحتاج مساعدة أو استفسار`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="py-3 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400" />
          <span>واتساب ({networkConfig?.supportPhone || '718097168'})</span>
        </a>

        <a
          href={`tel:${networkConfig?.supportPhone || '718097168'}`}
          className="py-3 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Phone className="w-4 h-4 text-cyan-400" />
          <span>اتصال ({networkConfig?.supportPhone || '718097168'})</span>
        </a>
      </div>

      {/* Simulator Test Action: Instant Session & Balance Expiry Trigger */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            soundManager.playError();
            if (onSessionExpired) {
              onSessionExpired('quota', session.voucherCode);
            } else {
              onLogout();
            }
          }}
          className="w-full py-2.5 px-3 rounded-2xl bg-slate-950/70 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-[11px] text-slate-400 hover:text-rose-300 font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
          title="تجربة العودة التلقائية لصفحة الدخول عند انتهاء الرصيد والميجا"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>محاكاة انتهاء الرصيد والميجا (فحص التحويل المباشر لصفحة الدخول)</span>
        </button>
      </div>

      {/* Live Stream & Cinema Modal */}
      <LiveStreamModal
        isOpen={isLiveStreamOpen}
        onClose={() => setIsLiveStreamOpen(false)}
      />

      {/* Pause / Freeze Session Modal (قطع الاتصال مع حفظ الرصيد) */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-orange-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(249,115,22,0.3)]">
              <PauseCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white font-['Cairo']">قطع الاتصال وحفظ الرصيد</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                سيتم إيقاف استهلاك الباقة وتجميد الجلسة فوراً. يمكنك إعادة تسجيل الدخول بنفس كود الكرت <span className="text-cyan-400 font-bold font-mono">({session.voucherCode})</span> في أي وقت لاستكمال رصيدك.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowPauseModal(false);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowPauseModal(false);
                  onLogout();
                }}
                className="py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)] cursor-pointer"
              >
                تأكيد قطع الاتصال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <LogOut className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white font-['Cairo']">تأكيد تسجيل الخروج؟</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل تريد إنهاء هذه الجلسة والعودة لصفحة تسجيل الدخول الرئيسية لكرت آخر؟
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowLogoutConfirm(false);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer"
              >
                نعم، تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2026 Balance Check Modal */}
      <BalanceCheckModal
        isOpen={isBalanceCheckOpen}
        onClose={() => setIsBalanceCheckOpen(false)}
        onUseCode={() => {}}
        initialCode={session.voucherCode}
      />
    </div>
  );
};

