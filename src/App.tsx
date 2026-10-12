import React, { useState, useEffect } from 'react';
import { UserSession, CardPackage, DistributorPoint, SpeedTier } from './types';
import { 
  getStoredSession, 
  clearSession, 
  createSessionFromVoucher, 
  requestEmergencyLoanSession,
  parseMikrotikParams 
} from './utils/mikrotikBridge';
import { INITIAL_ANNOUNCEMENTS } from './data/initialData';
import {
  getStoredPackages,
  saveStoredPackages,
  getStoredNetworkConfig,
  saveStoredNetworkConfig,
  getStoredDistributors,
  saveStoredDistributors,
  resetAllToDefaults,
  NetworkConfig
} from './utils/packagesStorage';
import { Header } from './components/Header';
import { NetworkAnnouncementBar } from './components/NetworkAnnouncementBar';
import { HotspotLoginCard } from './components/HotspotLoginCard';
import { ActiveSessionDashboard } from './components/ActiveSessionDashboard';
import { PackagesGrid } from './components/PackagesGrid';
import { DistributorsMapList } from './components/DistributorsMapList';
import { SpeedTestWidget } from './components/SpeedTestWidget';
import { LoyaltyRewardView } from './components/LoyaltyRewardView';
import { QRScannerModal } from './components/QRScannerModal';
import { BalanceCheckModal } from './components/BalanceCheckModal';
import { EmergencyLoanModal } from './components/EmergencyLoanModal';
import { LiveStreamModal } from './components/LiveStreamModal';
import { MikrotikExporterModal } from './components/MikrotikExporterModal';
import { AdminPackagesManagerModal } from './components/AdminPackagesManagerModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { Footer } from './components/Footer';
import { soundManager } from './utils/audio';
import confetti from 'canvas-confetti';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'packages' | 'distributors' | 'speedtest' | 'admin' | 'loyalty'>('login');
  
  // Persistent Packages, Network Config, and Distributors
  const [packages, setPackages] = useState<CardPackage[]>(() => getStoredPackages());
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>(() => getStoredNetworkConfig());
  const [distributors, setDistributors] = useState<DistributorPoint[]>(() => getStoredDistributors());
  const [announcements] = useState(INITIAL_ANNOUNCEMENTS);

  // Modals state
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBalanceCheckOpen, setIsBalanceCheckOpen] = useState(false);
  const [isEmergencyLoanOpen, setIsEmergencyLoanOpen] = useState(false);
  const [isLiveStreamOpen, setIsLiveStreamOpen] = useState(false);
  const [isExporterOpen, setIsExporterOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [voucherPrefill, setVoucherPrefill] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(soundManager.soundEnabled);
  const [expiredSessionNotice, setExpiredSessionNotice] = useState<{
    reason: 'time' | 'quota';
    message: string;
    voucherCode: string;
  } | null>(null);

  // On initial mount: restore stored session or parse URL params + Secret Keyboard Shortcuts
  useEffect(() => {
    const existing = getStoredSession();
    if (existing && existing.status === 'connected') {
      if (existing.remainingSeconds <= 0 || (existing.expiresAt && existing.expiresAt <= Date.now())) {
        clearSession();
        setExpiredSessionNotice({
          reason: 'time',
          message: 'هذا الكرت انتهى رصيده: لقد انتهت صلاحية ووقت جلسة الكرت السابق.',
          voucherCode: existing.voucherCode
        });
      } else {
        setSession(existing);
      }
    } else {
      const urlParams = parseMikrotikParams();
      if (urlParams.username) {
        setVoucherPrefill(urlParams.username);
      }
      if (window.location.search.includes('admin=true') || window.location.search.includes('admin=1')) {
        setIsAdminOpen(true);
      }
    }

    // Secret Admin Shortcut: Ctrl + Shift + A  OR  Alt + P
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        soundManager.playTap();
        setIsAdminOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save Packages Handler
  const handleSavePackages = (updated: CardPackage[]) => {
    setPackages(updated);
    saveStoredPackages(updated);
  };

  // Save Network Config Handler
  const handleSaveNetworkConfig = (updated: NetworkConfig) => {
    setNetworkConfig(updated);
    saveStoredNetworkConfig(updated);
  };

  // Save Distributors Handler
  const handleSaveDistributors = (updated: DistributorPoint[]) => {
    setDistributors(updated);
    saveStoredDistributors(updated);
  };

  // Reset to Factory Defaults Handler
  const handleResetDefaults = () => {
    const defaults = resetAllToDefaults();
    setPackages(defaults.packages);
    setNetworkConfig(defaults.config);
    setDistributors(defaults.distributors);
  };

  // Login handler
  const handleLogin = async (voucherCode: string, speedTier: SpeedTier = 'ultra'): Promise<boolean> => {
    await new Promise((res) => setTimeout(res, 600));

    if (!voucherCode || voucherCode.length < 3) {
      return false;
    }

    const newSession = createSessionFromVoucher(voucherCode, speedTier);
    setSession(newSession);
    setExpiredSessionNotice(null);
    setActiveTab('login');
    return true;
  };

  // Emergency Loan (سلفني) Handler
  const handleRequestEmergencyLoan = async (type: 'time' | 'data' | 'combo') => {
    await new Promise((res) => setTimeout(res, 600));
    const result = requestEmergencyLoanSession('D4:38:9C:7A:B2:10', type);
    if (result.success && result.session) {
      setSession(result.session);
      setIsEmergencyLoanOpen(false);
      soundManager.playSuccess();
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#f97316', '#e11d48']
      });
    }
  };

  // Logout handler
  const handleLogout = () => {
    clearSession();
    try {
      localStorage.removeItem('netflow_saved_voucher');
    } catch {}
    setSession(null);
    setVoucherPrefill('');
    setExpiredSessionNotice(null);
    setActiveTab('login');
  };

  // Session expired handler (انتهى الوقت أو الرصيد -> الانتقال لصفحة الدخول وإشعار الكرت انتهى رصيده)
  const handleSessionExpired = (reason: 'time' | 'quota', expiredVoucher?: string) => {
    const code = expiredVoucher || session?.voucherCode || '';
    clearSession();
    try {
      localStorage.removeItem('netflow_saved_voucher');
    } catch {}
    setSession(null);
    setVoucherPrefill('');
    setActiveTab('login');
    const msg = reason === 'quota'
      ? 'هذا الكرت انتهى رصيده: لقد تم استهلاك كامل رصيد الميجابايت المخصصة للكرت (0 MB متبقية).'
      : 'هذا الكرت انتهى رصيده: لقد انتهى الوقت والصلاحية المحددة للكرت بالكامل.';
    setExpiredSessionNotice({
      reason,
      message: msg,
      voucherCode: code
    });
    soundManager.playError();
  };

  // Top up / switch voucher handler
  const [balanceCheckCode, setBalanceCheckCode] = useState<string>('');

  const handleOpenBalanceCheck = (code?: string) => {
    setBalanceCheckCode(code || voucherPrefill || '');
    setIsBalanceCheckOpen(true);
  };

  const handleTopUp = () => {
    handleOpenBalanceCheck(session?.voucherCode || '');
  };

  // QR scan success handler
  const handleQrScanSuccess = (scannedCode: string) => {
    setIsQrOpen(false);
    setVoucherPrefill(scannedCode);
    handleLogin(scannedCode);
  };

  // Use code from balance checker
  const handleUseCodeFromCheck = (code: string) => {
    setVoucherPrefill(code);
    setActiveTab('login');
    handleLogin(code);
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      {/* Background Decorative Cyberpunk Grid & Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top cyan glow */}
        <div className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]"></div>
        {/* Bottom orange glow */}
        <div className="absolute bottom-[5%] left-[5%] w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-[140px]"></div>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e908_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e908_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      </div>

      {/* Main Top Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={Boolean(session && session.status === 'connected')}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        networkConfig={networkConfig}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenLiveStream={() => setIsLiveStreamOpen(true)}
      />

      {/* Network News and Announcement Banner */}
      <NetworkAnnouncementBar
        announcements={announcements}
        onOpenPackages={() => setActiveTab('packages')}
        networkConfig={networkConfig}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 z-10">
        {activeTab === 'login' && (
          <div className="py-4 sm:py-8">
            {session && session.status === 'connected' ? (
              <ActiveSessionDashboard
                session={session}
                onLogout={handleLogout}
                onTopUp={handleTopUp}
                onOpenSpeedTest={() => setActiveTab('speedtest')}
                onOpenDistributors={() => setActiveTab('distributors')}
                onOpenPackages={() => setActiveTab('packages')}
                onOpenLiveStream={() => setIsLiveStreamOpen(true)}
                networkConfig={networkConfig}
                onSessionExpired={handleSessionExpired}
              />
            ) : (
              <HotspotLoginCard
                onLogin={handleLogin}
                onOpenQR={() => setIsQrOpen(true)}
                onOpenBalanceCheck={handleOpenBalanceCheck}
                onOpenEmergencyLoan={() => setIsEmergencyLoanOpen(true)}
                onOpenLiveStream={() => setIsLiveStreamOpen(true)}
                initialCode={voucherPrefill}
                onSelectTab={setActiveTab}
                networkConfig={networkConfig}
                packages={packages}
                expiredSessionNotice={expiredSessionNotice}
                onClearExpiredNotice={() => setExpiredSessionNotice(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="py-4">
            <PackagesGrid
              packages={packages}
              onOpenDistributors={() => setActiveTab('distributors')}
              whatsappNumber={networkConfig.whatsappNumber}
              networkName={networkConfig.networkName}
            />
          </div>
        )}

        {activeTab === 'distributors' && (
          <div className="py-4">
            <DistributorsMapList 
              distributors={distributors} 
              networkName={networkConfig.networkName} 
              networkConfig={networkConfig}
              onSelectTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'speedtest' && (
          <div className="py-4">
            <SpeedTestWidget />
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="py-4">
            <LoyaltyRewardView
              networkConfig={networkConfig}
              onUseCode={(code) => {
                setVoucherPrefill(code);
                setActiveTab('login');
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer 
        networkConfig={networkConfig}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Secret Admin Packages & Network Manager Modal */}
      <AdminPackagesManagerModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        packages={packages}
        onSavePackages={handleSavePackages}
        networkConfig={networkConfig}
        onSaveNetworkConfig={handleSaveNetworkConfig}
        distributors={distributors}
        onSaveDistributors={handleSaveDistributors}
        onResetDefaults={handleResetDefaults}
        onOpenExporter={() => setIsExporterOpen(true)}
        onTestBalanceCode={(code) => {
          setVoucherPrefill(code);
          setIsBalanceCheckOpen(true);
        }}
      />

      {/* QR Scanner Camera Modal */}
      <QRScannerModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />

      {/* Quick Balance Inspection Modal */}
      <BalanceCheckModal
        isOpen={isBalanceCheckOpen}
        onClose={() => setIsBalanceCheckOpen(false)}
        onUseCode={handleUseCodeFromCheck}
        initialCode={balanceCheckCode || voucherPrefill}
      />

      {/* Emergency Loan (سلفني) Modal */}
      <EmergencyLoanModal
        isOpen={isEmergencyLoanOpen}
        onClose={() => setIsEmergencyLoanOpen(false)}
        onRequestLoan={handleRequestEmergencyLoan}
      />

      {/* Live Sports Stream Modal (استراحة طلقة) */}
      <LiveStreamModal
        isOpen={isLiveStreamOpen}
        onClose={() => setIsLiveStreamOpen(false)}
      />

      {/* MikroTik RouterOS Template Exporter Modal (Admin Only) */}
      <MikrotikExporterModal
        isOpen={isExporterOpen}
        onClose={() => setIsExporterOpen(false)}
        networkConfig={networkConfig}
      />

      {/* Offline Connectivity Status Indicator */}
      <OfflineIndicator />

      {/* Fixed Mobile & Desktop PWA Install Floating Button */}
      <PWAInstallButton variant="fixed" />
    </div>
  );
}
