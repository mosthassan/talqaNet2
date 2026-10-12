import React, { useState } from 'react';
import { Download, Smartphone, Check, Loader2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundManager } from '../utils/audio';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'banner' | 'fixed';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { isInstalled, install } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // If already running as an installed standalone PWA, hide the button completely
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    soundManager.playTap();
    setIsInstalling(true);

    try {
      // If running inside an iframe (like AI Studio preview), the browser forbids native beforeinstallprompt.
      // In that case, open the direct URL in a new tab so the browser can trigger the native install prompt directly.
      if (window.self !== window.top) {
        window.open(window.location.href, '_blank');
        setIsInstalling(false);
        return;
      }

      const outcome = await install();
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        soundManager.playSuccess();
      }
    } catch (err) {
      console.error('PWA install error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  // Fixed floating button for mobile & desktop (الزر الثابت الخاص بتثبيت التطبيق في الجوال)
  if (variant === 'fixed') {
    return (
      <div className="fixed bottom-20 left-3 sm:left-5 z-40 animate-fadeIn">
        <button
          onClick={handleInstallClick}
          disabled={isInstalling || installedSuccess}
          className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs shadow-[0_8px_25px_rgba(16,185,129,0.45)] border border-emerald-400/50 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md disabled:opacity-80"
          title="تثبيت التطبيق على الجوال فوراً"
        >
          {installedSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span className="font-['Cairo'] tracking-wide">تم التثبيت! ✓</span>
            </>
          ) : isInstalling ? (
            <>
              <Loader2 className="w-4 h-4 text-white animate-spin" />
              <span className="font-['Cairo'] tracking-wide">جاري التثبيت...</span>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
                </span>
              </div>
              <span className="font-['Cairo'] tracking-wide">تثبيت التطبيق 📲</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Navbar compact button variant
  if (variant === 'navbar') {
    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling || installedSuccess}
        className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-75"
        title="تثبيت التطبيق على جوالك فوراً"
      >
        {installedSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-300" />
            <span>تم التثبيت</span>
          </>
        ) : isInstalling ? (
          <>
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>جاري التثبيت...</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 text-emerald-400 group-hover:animate-pulse" />
            <span>تثبيت التطبيق</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </>
        )}
      </button>
    );
  }

  // Banner variant for home / login page
  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-teal-950/60 border border-emerald-500/30 p-3.5 shadow-[0_0_30px_rgba(16,185,129,0.12)] flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-white text-xs sm:text-sm">تطبيق طلقة نت على جوالك</h4>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
              PWA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            تصفح أسرع وفحص رصيد فوري دون الحاجة لفتح المتصفح في كل مرة.
          </p>
        </div>
      </div>

      <button
        onClick={handleInstallClick}
        disabled={isInstalling || installedSuccess}
        className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-80"
      >
        {installedSuccess ? (
          <>
            <Check className="w-4 h-4 text-slate-950" />
            <span>تم التثبيت بنجاح!</span>
          </>
        ) : isInstalling ? (
          <>
            <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
            <span>جاري التثبيت...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-slate-950" />
            <span>تثبيت التطبيق الآن</span>
          </>
        )}
      </button>
    </div>
  );
};
