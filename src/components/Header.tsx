import React, { useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { soundManager } from '../utils/audio';
import { NetworkConfig } from '../utils/packagesStorage';
import { 
  Volume2, 
  VolumeX, 
  Wifi, 
  Zap, 
  MapPin, 
  Gauge, 
  Info,
  Layers,
  Tv,
  Gift
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'login' | 'packages' | 'distributors' | 'speedtest' | 'admin' | 'loyalty';
  setActiveTab: (tab: 'login' | 'packages' | 'distributors' | 'speedtest' | 'admin' | 'loyalty') => void;
  isConnected: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  networkConfig?: NetworkConfig;
  onOpenAdmin?: () => void;
  onOpenLiveStream?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  soundEnabled,
  setSoundEnabled,
  networkConfig,
  onOpenAdmin,
  onOpenLiveStream
}) => {
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<any>(null);

  const toggleAudio = () => {
    const newState = soundManager.toggleSound();
    setSoundEnabled(newState);
  };

  const handleSecretLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 4) {
      clickCountRef.current = 0;
      soundManager.playSuccess();
      if (onOpenAdmin) onOpenAdmin();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 1500);
    }
  };

  const navItems = [
    { id: 'login', label: isConnected ? 'لوحة الحالة' : 'تسجيل الدخول', icon: isConnected ? Wifi : Zap },
    { id: 'loyalty', label: 'مكافأة الانتماء', icon: Gift },
    { id: 'speedtest', label: 'فحص السرعة', icon: Gauge },
    { id: 'distributors', label: 'نقاط البيع', icon: MapPin },
    { id: 'lounge', label: 'الاستراحة', icon: Tv, isAction: true },
    { id: 'packages', label: 'باقات الكروت', icon: Layers },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/80 border-b border-cyan-500/15 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-18 sm:h-20 flex items-center justify-between gap-2">
        {/* Brand Identity with Secret Admin Click Trigger */}
        <div 
          onClick={() => {
            soundManager.playTap();
            handleSecretLogoClick();
            if (clickCountRef.current < 4) {
              setActiveTab('login');
            }
          }}
          className="cursor-pointer"
        >
          <BrandLogo 
            size="md" 
            networkName={networkConfig?.networkName}
            slogan={networkConfig?.slogan}
          />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isLounge = item.id === 'lounge';
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundManager.playTap();
                  if (isLounge) {
                    onOpenLiveStream?.();
                  } else {
                    setActiveTab(item.id as any);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 shadow-[0_0_15px_rgba(14,165,233,0.4)]'
                    : isLounge
                    ? 'text-emerald-300 hover:text-white hover:bg-emerald-950/40 border border-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : isLounge ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
                <span>{item.label}</span>
                {item.id === 'login' && isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
                {isLounge && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold">بث</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Live Router Status */}
          <div 
            onClick={handleSecretLogoClick}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 select-none cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">سيرفر ميكروتك {networkConfig?.networkName || 'طلقة'} متصل</span>
          </div>

          {/* PWA Install Mobile App Button */}
          <PWAInstallButton variant="navbar" />

          {/* Sound Toggle */}
          <button
            onClick={toggleAudio}
            title={soundEnabled ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-slate-950/95 border-t border-cyan-500/20 px-1 py-1.5 shadow-[0_-5px_20px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-6 gap-0.5 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isLounge = item.id === 'lounge';
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundManager.playTap();
                  if (isLounge) {
                    onOpenLiveStream?.();
                  } else {
                    setActiveTab(item.id as any);
                  }
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-bold transition-all ${
                  isActive
                    ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : isLounge
                    ? 'text-emerald-300 hover:text-white bg-emerald-950/20 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-cyan-400' : isLounge ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.id === 'login' && isConnected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                  {isLounge && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  )}
                </div>
                <span className="truncate max-w-[56px] text-center leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
