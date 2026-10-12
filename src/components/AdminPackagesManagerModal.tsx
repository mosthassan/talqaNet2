import React, { useState, useEffect } from 'react';
import { CardPackage, DistributorPoint } from '../types';
import { NetworkConfig, DEFAULT_NETWORK_CONFIG } from '../utils/packagesStorage';
import { soundManager } from '../utils/audio';
import {
  ShieldCheck,
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  RotateCcw,
  Download,
  Upload,
  Layers,
  Settings,
  Database,
  Lock,
  KeyRound,
  AlertCircle,
  Clock,
  Calendar,
  Zap,
  Phone,
  MessageCircle,
  Radio,
  Globe,
  MapPin,
  Megaphone,
  Store,
  ExternalLink,
  Info,
  CheckCircle2,
  Sparkles,
  Cpu,
  FileCode,
  Terminal,
  Copy,
  CreditCard,
  Server,
  Activity,
  Wifi,
  LogIn,
  LogOut,
  Mail,
  Gift
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CardsRegistryManager } from './CardsRegistryManager';
import { AdminLoyaltyVaultTab } from './AdminLoyaltyVaultTab';
import { testMikrotikConnection, MikrotikTestResult } from '../utils/mikrotikApiBridge';
import { 
  auth, 
  loginWithGoogle, 
  loginWithEmail, 
  logoutFirebase, 
  isSuperAdminEmail,
  checkRedirectAuthResult 
} from '../utils/firebaseService';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AdminPackagesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: CardPackage[];
  onSavePackages: (updated: CardPackage[]) => void;
  networkConfig: NetworkConfig;
  onSaveNetworkConfig: (updated: NetworkConfig) => void;
  distributors: DistributorPoint[];
  onSaveDistributors: (updated: DistributorPoint[]) => void;
  onResetDefaults: () => void;
  onOpenExporter?: () => void;
  onTestBalanceCode?: (code: string) => void;
}

export const AdminPackagesManagerModal: React.FC<AdminPackagesManagerModalProps> = ({
  isOpen,
  onClose,
  packages,
  onSavePackages,
  networkConfig,
  onSaveNetworkConfig,
  distributors,
  onSaveDistributors,
  onResetDefaults,
  onOpenExporter,
  onTestBalanceCode
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('mosthassan.ye@gmail.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Monitor Firebase Auth State
  useEffect(() => {
    checkRedirectAuthResult().then((res) => {
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsAuthenticated(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    soundManager.playTap();
    setGoogleLoading(true);
    setAuthError(null);
    try {
      const { user, isAdmin } = await loginWithGoogle();
      setCurrentUser(user);
      setIsAuthenticated(true);
      soundManager.playSuccess();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      soundManager.playError();
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message || 'تعذر تسجيل الدخول عبر Google. يمكنك استخدام رمز PIN أو البريد الإلكتروني.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playTap();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setEmailLoading(true);
    setAuthError(null);
    try {
      const { user, isAdmin } = await loginWithEmail(emailInput, passwordInput);
      setCurrentUser(user);
      setIsAuthenticated(true);
      soundManager.playSuccess();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Email Sign-In Error:', err);
      soundManager.playError();
      setAuthError('فشل تسجيل الدخول. يرجى التحقق من صحة كلمة المرور أو استخدام الدخول عبر Google.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLogout = async () => {
    soundManager.playTap();
    await logoutFirebase();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Active Admin Sub-tab
  const [activeTab, setActiveTab] = useState<'packages' | 'cards' | 'contacts' | 'network' | 'distributors' | 'backup' | 'mikrotik' | 'loyalty'>('packages');
  const [copiedScript, setCopiedScript] = useState(false);

  // Package Editing State
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [draftPkg, setDraftPkg] = useState<Partial<CardPackage>>({});

  // Distributor Editing State
  const [editingDistId, setEditingDistId] = useState<string | null>(null);
  const [isAddingNewDist, setIsAddingNewDist] = useState(false);
  const [draftDist, setDraftDist] = useState<Partial<DistributorPoint>>({});

  // Network & Contact Settings Draft State
  const [draftConfig, setDraftConfig] = useState<NetworkConfig>(networkConfig);
  const [newPin, setNewPin] = useState('');
  const [configSavedToast, setConfigSavedToast] = useState(false);
  const [distSavedToast, setDistSavedToast] = useState(false);
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<MikrotikTestResult | null>(null);

  // Update draftConfig when networkConfig prop changes
  useEffect(() => {
    setDraftConfig(networkConfig);
  }, [networkConfig]);

  if (!isOpen) return null;

  // Handle PIN verification
  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = (networkConfig.adminPin && networkConfig.adminPin.trim().length > 0) 
      ? networkConfig.adminPin.trim() 
      : '7777';
    if (pinInput.trim() === correctPin) {
      soundManager.playSuccess();
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      soundManager.playError();
      setPinError(true);
      setPinInput('');
    }
  };

  const handleDigitClick = (digit: string) => {
    soundManager.playTap();
    if (pinInput.length < 6) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError(false);
      const correctPin = (networkConfig.adminPin && networkConfig.adminPin.trim().length > 0) 
        ? networkConfig.adminPin.trim() 
        : '7777';
      if (next === correctPin) {
        setTimeout(() => {
          soundManager.playSuccess();
          setIsAuthenticated(true);
        }, 150);
      }
    }
  };

  // Open add new package
  const handleOpenAddPackage = () => {
    soundManager.playTap();
    setIsAddingNew(true);
    setEditingPkgId(null);
    setDraftPkg({
      id: `pkg-${Date.now()}`,
      name: 'كرت باقة جديدة',
      category: 'hours',
      price: 300,
      currency: draftConfig.currency || 'ريال',
      durationLabel: '10 ساعات',
      validityDaysLabel: '5 أيام',
      dataLimitMB: 2000,
      dataLimitLabel: '2000 ميجا (2 جيجا)',
      speedLimitLabel: 'أقصى سرعة فايبر 50Mbps',
      badge: 'جديد 🌟',
      popular: false,
      colorTheme: 'cyan',
      features: ['رصيد 2000 ميجا', 'وقت اتصال 10 ساعات', 'صلاحية 5 أيام', 'سرعة فايبر فائقة']
    });
  };

  // Edit existing package
  const handleOpenEditPackage = (pkg: CardPackage) => {
    soundManager.playTap();
    setEditingPkgId(pkg.id);
    setIsAddingNew(false);
    setDraftPkg({ ...pkg });
  };

  // Save package changes
  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftPkg.price || Number(draftPkg.price) <= 0) {
      alert('يرجى تحديد سعر صالح للكرت');
      return;
    }

    soundManager.playSuccess();

    const dataMB = Number(draftPkg.dataLimitMB) || 1000;
    const dataLabel = dataMB >= 1024 
      ? `${(dataMB / 1024).toFixed(dataMB % 1024 === 0 ? 0 : 1)} جيجا (${dataMB} MB)` 
      : `${dataMB} ميجا`;

    const updatedPackage: CardPackage = {
      id: draftPkg.id || `pkg-${Date.now()}`,
      name: draftPkg.name || `كرت ${draftPkg.price} ${draftConfig.currency || 'ريال'}`,
      category: draftPkg.category || 'hours',
      price: Number(draftPkg.price),
      currency: draftPkg.currency || draftConfig.currency || 'ريال',
      durationLabel: draftPkg.durationLabel || '6 ساعات',
      validityDaysLabel: draftPkg.validityDaysLabel || '7 أيام',
      dataLimitLabel: draftPkg.dataLimitLabel || dataLabel,
      dataLimitMB: dataMB,
      speedLimitLabel: draftPkg.speedLimitLabel || 'حتى 30 ميجا/ثانية',
      badge: draftPkg.badge,
      popular: Boolean(draftPkg.popular),
      colorTheme: draftPkg.colorTheme || (draftPkg.price >= 4000 ? 'amber' : draftPkg.popular ? 'orange' : 'cyan'),
      features: draftPkg.features && draftPkg.features.length > 0 ? draftPkg.features : [
        `رصيد ${dataLabel}`,
        `وقت اتصال ${draftPkg.durationLabel}`,
        `صلاحية ${draftPkg.validityDaysLabel}`,
        'سرعة فائقة وثبات تام'
      ]
    };

    let newPackagesList: CardPackage[];
    if (isAddingNew) {
      newPackagesList = [...packages, updatedPackage];
    } else {
      newPackagesList = packages.map((p) => (p.id === editingPkgId ? updatedPackage : p));
    }

    onSavePackages(newPackagesList);
    setEditingPkgId(null);
    setIsAddingNew(false);

    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#0ea5e9', '#f97316', '#10b981']
    });
  };

  const handleDeletePackage = (id: string) => {
    soundManager.playTap();
    if (packages.length <= 1) {
      alert('يجب أن تحتوي الشبكة على كرت واحد على الأقل.');
      return;
    }
    if (confirm('هل أنت متأكد من حذف هذه الباقة نهائياً؟')) {
      const updated = packages.filter((p) => p.id !== id);
      onSavePackages(updated);
      if (editingPkgId === id) {
        setEditingPkgId(null);
      }
    }
  };

  // Distributor Operations
  const handleOpenAddDistributor = () => {
    soundManager.playTap();
    setIsAddingNewDist(true);
    setEditingDistId(null);
    setDraftDist({
      id: `dist-${Date.now()}`,
      name: 'مركز / بقالة جديدة',
      city: 'صنعاء',
      neighborhood: 'شارع جديد',
      address: 'بجوار المسجد أو المركز التجاري',
      phone: draftConfig.supportPhone || '718097168',
      whatsapp: draftConfig.whatsappNumber || '967718097168',
      workingHours: '8:00 ص - 12:00 م',
      availableCategories: ['200 ريال', '500 ريال', '1000 ريال'],
      isOpen: true,
      hasStock: true
    });
  };

  const handleOpenEditDistributor = (dist: DistributorPoint) => {
    soundManager.playTap();
    setEditingDistId(dist.id);
    setIsAddingNewDist(false);
    setDraftDist({ ...dist });
  };

  const handleSaveDistributor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftDist.name?.trim()) {
      alert('يرجى كتابة اسم نقطة البيع أو المحل');
      return;
    }

    soundManager.playSuccess();
    const updatedDist: DistributorPoint = {
      id: draftDist.id || `dist-${Date.now()}`,
      name: draftDist.name.trim(),
      city: draftDist.city?.trim() || 'صنعاء',
      neighborhood: draftDist.neighborhood?.trim() || 'المركز',
      address: draftDist.address?.trim() || 'العنوان الرئيسي',
      phone: draftDist.phone?.trim() || draftConfig.supportPhone,
      whatsapp: draftDist.whatsapp?.trim() || draftConfig.whatsappNumber,
      workingHours: draftDist.workingHours?.trim() || '8:00 ص - 11:00 م',
      availableCategories: draftDist.availableCategories || ['200 ريال', '500 ريال', '1000 ريال'],
      isOpen: draftDist.isOpen ?? true,
      hasStock: draftDist.hasStock ?? true
    };

    let updatedList: DistributorPoint[];
    if (isAddingNewDist) {
      updatedList = [...distributors, updatedDist];
    } else {
      updatedList = distributors.map((d) => (d.id === editingDistId ? updatedDist : d));
    }

    onSaveDistributors(updatedList);
    setEditingDistId(null);
    setIsAddingNewDist(false);
    setDistSavedToast(true);
    setTimeout(() => setDistSavedToast(false), 3000);
  };

  const handleDeleteDistributor = (id: string) => {
    soundManager.playTap();
    if (confirm('هل أنت متأكد من حذف نقطة البيع هذه؟')) {
      const updated = distributors.filter((d) => d.id !== id);
      onSaveDistributors(updated);
      if (editingDistId === id) {
        setEditingDistId(null);
      }
    }
  };

  // Save Network Settings & Contacts
  const handleSaveNetworkSettings = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playSuccess();
    const updated: NetworkConfig = {
      ...draftConfig,
      adminPin: newPin.trim() ? newPin.trim() : draftConfig.adminPin
    };
    onSaveNetworkConfig(updated);
    setConfigSavedToast(true);
    setNewPin('');
    setTimeout(() => setConfigSavedToast(false), 3000);
  };

  // Test MikroTik REST API live connection
  const handleTestMikrotikApi = async () => {
    soundManager.playTap();
    setApiTesting(true);
    setApiTestResult(null);

    const res = await testMikrotikConnection({
      host: draftConfig.mikrotikApiHost || 'router.samtecai.com',
      port: Number(draftConfig.mikrotikApiPort) || 443,
      user: draftConfig.mikrotikApiUser || 'mosthassan',
      pass: draftConfig.mikrotikApiPass || '',
      hotspotServer: draftConfig.mikrotikHotspotServer || 'all'
    });

    setApiTestResult(res);
    setApiTesting(false);

    if (res.success) {
      soundManager.playSuccess();
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
    } else {
      soundManager.playError();
    }
  };

  const handleSaveMikrotikSettings = () => {
    soundManager.playSuccess();
    onSaveNetworkConfig({ ...draftConfig });
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 3000);
  };

  // Export JSON backup
  const handleExportBackup = () => {
    soundManager.playTap();
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      config: networkConfig,
      packages,
      distributors
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${networkConfig.networkName || 'talqa'}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Safety check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      soundManager.playError();
      alert('حجم ملف النسخة الاحتياطية كبير جداً وغير مسموح به.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        // Validate and sanitize data
        if (data && typeof data === 'object') {
          if (Array.isArray(data.packages)) {
            const cleanPkgs = data.packages
              .filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string')
              .map((p: any) => ({
                id: String(p.id).slice(0, 50),
                name: String(p.name).slice(0, 100),
                price: Number(p.price) || 0,
                priceCurrency: String(p.priceCurrency || 'ريال').slice(0, 20),
                validityDays: Number(p.validityDays) || 1,
                validityDaysLabel: String(p.validityDaysLabel || '').slice(0, 50),
                durationLabel: String(p.durationLabel || '').slice(0, 50),
                durationHours: Number(p.durationHours) || 1,
                dataLimitMb: Number(p.dataLimitMb) || 0,
                dataLimitLabel: String(p.dataLimitLabel || '').slice(0, 50),
                speed: String(p.speed || '').slice(0, 50),
                category: String(p.category || 'hourly').slice(0, 30),
                color: String(p.color || '#0ea5e9').slice(0, 30),
                isPopular: Boolean(p.isPopular),
                isFeatured: Boolean(p.isFeatured),
                badgeText: p.badgeText ? String(p.badgeText).slice(0, 30) : undefined,
                description: p.description ? String(p.description).slice(0, 200) : undefined,
                devicesAllowed: Number(p.devicesAllowed) || 1,
                priority: Number(p.priority) || 1,
                discountBadge: p.discountBadge ? String(p.discountBadge).slice(0, 30) : undefined
              }));
            if (cleanPkgs.length > 0) {
              onSavePackages(cleanPkgs);
            }
          }

          if (data.config && typeof data.config === 'object') {
            const cleanConfig: NetworkConfig = {
              networkName: String(data.config.networkName || DEFAULT_NETWORK_CONFIG.networkName).slice(0, 80),
              slogan: String(data.config.slogan || DEFAULT_NETWORK_CONFIG.slogan).slice(0, 150),
              whatsappNumber: String(data.config.whatsappNumber || DEFAULT_NETWORK_CONFIG.whatsappNumber).replace(/[^0-9+]/g, '').slice(0, 20),
              supportPhone: String(data.config.supportPhone || DEFAULT_NETWORK_CONFIG.supportPhone).replace(/[^0-9+]/g, '').slice(0, 20),
              emergencyPhone: String(data.config.emergencyPhone || DEFAULT_NETWORK_CONFIG.emergencyPhone).replace(/[^0-9+]/g, '').slice(0, 20),
              telegramChannel: String(data.config.telegramChannel || DEFAULT_NETWORK_CONFIG.telegramChannel).slice(0, 100),
              facebookPage: String(data.config.facebookPage || DEFAULT_NETWORK_CONFIG.facebookPage).slice(0, 100),
              workingHours: String(data.config.workingHours || DEFAULT_NETWORK_CONFIG.workingHours).slice(0, 80),
              networkLocation: String(data.config.networkLocation || DEFAULT_NETWORK_CONFIG.networkLocation).slice(0, 100),
              currency: String(data.config.currency || DEFAULT_NETWORK_CONFIG.currency).slice(0, 20),
              hotspotDnsName: String(data.config.hotspotDnsName || DEFAULT_NETWORK_CONFIG.hotspotDnsName).slice(0, 50),
              mikrotikIdentity: String(data.config.mikrotikIdentity || DEFAULT_NETWORK_CONFIG.mikrotikIdentity).slice(0, 60),
              announcementTitle: String(data.config.announcementTitle || DEFAULT_NETWORK_CONFIG.announcementTitle).slice(0, 100),
              announcementText: String(data.config.announcementText || DEFAULT_NETWORK_CONFIG.announcementText).slice(0, 300),
              announcementType: (['promotion', 'notice', 'maintenance'].includes(data.config.announcementType) ? data.config.announcementType : 'promotion'),
              adminPin: String(data.config.adminPin || DEFAULT_NETWORK_CONFIG.adminPin).slice(0, 12),
              appUrl: String(data.config.appUrl || DEFAULT_NETWORK_CONFIG.appUrl || 'https://talqanet.vercel.app').slice(0, 150),
              showVoucherBoxOnCloud: Boolean(data.config.showVoucherBoxOnCloud)
            };
            onSaveNetworkConfig(cleanConfig);
          }

          if (Array.isArray(data.distributors)) {
            const cleanDists = data.distributors
              .filter((d: any) => d && typeof d.id === 'string' && typeof d.name === 'string')
              .map((d: any) => ({
                id: String(d.id).slice(0, 50),
                name: String(d.name).slice(0, 100),
                ownerName: d.ownerName ? String(d.ownerName).slice(0, 100) : undefined,
                address: String(d.address || '').slice(0, 150),
                city: String(d.city || 'مأرب').slice(0, 50),
                phone: String(d.phone || '').slice(0, 25),
                whatsapp: d.whatsapp ? String(d.whatsapp).slice(0, 25) : undefined,
                availableCards: Array.isArray(d.availableCards) ? d.availableCards.map((c: any) => String(c).slice(0, 30)) : [],
                isOpen: d.isOpen !== false,
                workingHours: String(d.workingHours || '').slice(0, 50),
                distanceMeters: Number(d.distanceMeters) || 100,
                rating: Number(d.rating) || 5,
                verified: Boolean(d.verified)
              }));
            if (cleanDists.length > 0) {
              onSaveDistributors(cleanDists);
            }
          }

          soundManager.playSuccess();
          alert('تم استيراد النسخة الاحتياطية وتحديث بيانات الشبكة بنجاح وبأمان!');
        } else {
          throw new Error('Invalid JSON structure');
        }
      } catch (err) {
        console.error('Import error:', err);
        soundManager.playError();
        alert('الملف غير صالح أو تالف. يرجى اختيار ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border-2 border-cyan-500/40 rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(14,165,233,0.3)] flex flex-col overflow-hidden text-right font-['Cairo']">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  لوحة إدارة شبكة {networkConfig.networkName}
                </h3>
                {isAuthenticated && currentUser ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                    <span>👑</span>
                    <span className="font-bold">سوبر أدمن</span>
                    <span className="font-mono text-[10px] text-slate-300 hidden sm:inline">({currentUser.email})</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    ADMIN v2.0
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                إدارة الكروت، مزامنة سحابة سام تك، وتوليد وضبط سيرفر الميكروتك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && currentUser && (
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                title="تسجيل الخروج من الحساب"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            )}
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
        </div>

        {/* Authentication Screen if not authenticated */}
        {!isAuthenticated ? (
          <div className="py-6 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4">
            <div className="p-4 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_25px_rgba(14,165,233,0.25)]">
              <ShieldCheck className="w-9 h-9 animate-pulse text-cyan-400" />
            </div>

            <div>
              <h4 className="text-lg font-black text-white">تسجيل دخول المشرف العام</h4>
              <p className="text-xs text-slate-400 mt-1">
                متاح بنقرة واحدة عبر حساب المشرف المعتمد أو رمز PIN
              </p>
            </div>

            {authError && (
              <div className="w-full p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* 1. One-Click Google Sign-In (Recommended) */}
            <div className="w-full p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 space-y-2.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.09 3.66-5.17 3.66-9.12z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.27 21.36 7.35 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.43l4.02-3.14z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.57l4.02 3.14c.95-2.83 3.6-4.96 6.72-4.96z" />
                  </svg>
                )}
                <span>الدخول الفوري بنقرة واحدة عبر Google</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-cyan-300/90 px-1 font-mono">
                <span>الحساب المعتمد:</span>
                <span className="font-bold text-emerald-400">mosthassan.ye@gmail.com</span>
              </div>
            </div>

            {/* Collapsible Email Login & PIN Toggle */}
            <div className="w-full flex items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setShowEmailLogin(!showEmailLogin)}
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                {showEmailLogin ? 'إخفاء الدخول بالبريد' : 'دخول بحساب سام تك بالبريد وكلمة المرور'}
              </button>
            </div>

            {/* Email Form (Optional) */}
            {showEmailLogin && (
              <form onSubmit={handleEmailLogin} className="w-full space-y-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-right animate-fadeIn">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-cyan-400"
                    placeholder="mosthassan.ye@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {emailLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </button>
              </form>
            )}

            {/* PIN Keypad Option */}
            <div className="w-full border-t border-slate-800 pt-3 space-y-2">
              <div className="text-xs text-slate-400 font-bold">أو الدخول برمز PIN السريع للمدير:</div>
              <form onSubmit={handleVerifyPin} className="w-full space-y-2.5">
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="• • • •"
                  className={`w-full bg-slate-950 border text-center text-xl tracking-[0.4em] font-mono py-2 rounded-xl outline-none transition-all ${
                    pinError
                      ? 'border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : 'border-slate-800 focus:border-cyan-400 text-white'
                  }`}
                />

                {pinError && (
                  <div className="flex items-center justify-center gap-1 text-xs text-rose-400 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>رمز الـ PIN غير صحيح، يرجى المحاولة مجدداً</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'C') {
                          soundManager.playTap();
                          setPinInput('');
                          setPinError(false);
                        } else if (key === '✓') {
                          handleVerifyPin();
                        } else {
                          handleDigitClick(key);
                        }
                      }}
                      className={`py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                        key === '✓'
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-black'
                          : key === 'C'
                          ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                          : 'bg-slate-950 hover:bg-slate-800 text-white border border-slate-800'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-slate-500">
                  (رمز PIN المبدئي: <strong className="text-cyan-400 font-mono">7777</strong>)
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Authenticated Admin Management Interface */
          <div className="flex-1 flex flex-col overflow-hidden pt-3 space-y-3">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-800 pb-2.5 shrink-0 overflow-x-auto">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('packages');
                  setEditingPkgId(null);
                  setIsAddingNew(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'packages'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>الباقات والأسعار ({packages.length})</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('cards');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'cards'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.3)] font-black'
                    : 'bg-amber-950/40 text-amber-300 hover:text-white border border-amber-500/30'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>سجل الكروت وقاعدة البيانات ⚡</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('contacts');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'contacts'
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>أرقام التواصل والخدمات</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('network');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'network'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>هوية الشبكة والميكروتك</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('distributors');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'distributors'
                    ? 'bg-orange-500 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>نقاط البيع والموزعين ({distributors.length})</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('backup');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'backup'
                    ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>النسخ والضبط</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('mikrotik');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'mikrotik'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-amber-950/40 text-amber-300 hover:text-white border border-amber-500/30'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>قوالب وسكربتات MikroTik</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveTab('loyalty');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'loyalty'
                    ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] font-black'
                    : 'bg-gradient-to-r from-amber-950/40 to-slate-900 text-amber-300 hover:text-white border border-amber-500/40'
                }`}
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>صندوق جوائز الانتماء 🎁</span>
              </button>
            </div>

            {/* TAB 1: PACKAGES MANAGEMENT */}
            {activeTab === 'packages' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
                {/* Top Action Bar */}
                <div className="flex items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white">تعديل فوري للباقات:</span> حدد السعر، رصيد الميجا، الساعات والصلاحية لتنعكس تلقائياً في واجهة الزوار.
                  </div>

                  {!isAddingNew && !editingPkgId && (
                    <button
                      onClick={handleOpenAddPackage}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة كرت جديد</span>
                    </button>
                  )}
                </div>

                {/* Form to Add or Edit Package */}
                {(isAddingNew || editingPkgId) && (
                  <form onSubmit={handleSavePackage} className="p-4 rounded-2xl bg-slate-950 border-2 border-cyan-500/40 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        <span>{isAddingNew ? 'إضافة فئة كرت جديدة للشبكة' : `تعديل بيانات (${draftPkg.name})`}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNew(false);
                          setEditingPkgId(null);
                        }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        إلغاء
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم الكرت</label>
                        <input
                          type="text"
                          value={draftPkg.name || ''}
                          onChange={(e) => setDraftPkg({ ...draftPkg, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                          placeholder="مثال: كرت 500 ريال فايبر"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">السعر المالي</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="10"
                            step="10"
                            value={draftPkg.price || ''}
                            onChange={(e) => setDraftPkg({ ...draftPkg, price: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 outline-none focus:border-cyan-400"
                            placeholder="500"
                            required
                          />
                          <span className="absolute left-3 top-2 text-[11px] text-slate-400 font-bold">
                            {draftPkg.currency || draftConfig.currency || 'ريال'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">رصيد البيانات بالميجا (MB)</label>
                        <input
                          type="number"
                          min="50"
                          step="50"
                          value={draftPkg.dataLimitMB || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDraftPkg({ 
                              ...draftPkg, 
                              dataLimitMB: val,
                              dataLimitLabel: val >= 1024 ? `${(val / 1024).toFixed(val % 1024 === 0 ? 0 : 1)} جيجا (${val}MB)` : `${val} ميجا`
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 outline-none focus:border-cyan-400"
                          placeholder="2700"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">وقت الاتصال المسموح</label>
                        <input
                          type="text"
                          value={draftPkg.durationLabel || ''}
                          onChange={(e) => setDraftPkg({ ...draftPkg, durationLabel: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                          placeholder="مثال: 12 ساعة / يوم كامل"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">مدة الصلاحية بالأيام</label>
                        <input
                          type="text"
                          value={draftPkg.validityDaysLabel || ''}
                          onChange={(e) => setDraftPkg({ ...draftPkg, validityDaysLabel: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                          placeholder="مثال: 14 يوم / شهر"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">حد السرعة (Fiber Speed)</label>
                        <input
                          type="text"
                          value={draftPkg.speedLimitLabel || ''}
                          onChange={(e) => setDraftPkg({ ...draftPkg, speedLimitLabel: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                          placeholder="مثال: حتى 40 ميجا/ثانية"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">شارة التمييز (Badge)</label>
                        <input
                          type="text"
                          value={draftPkg.badge || ''}
                          onChange={(e) => setDraftPkg({ ...draftPkg, badge: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-orange-400 outline-none focus:border-cyan-400"
                          placeholder="مثال: الأكثر طلباً 🔥"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(draftPkg.popular)}
                            onChange={(e) => setDraftPkg({ ...draftPkg, popular: e.target.checked })}
                            className="w-4 h-4 accent-cyan-500 rounded"
                          />
                          <span className="text-xs font-bold text-white">تمييز كباقة رئيسية (Popular)</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNew(false);
                          setEditingPkgId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(14,165,233,0.4)] cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>حفظ بيانات الباقة</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Packages List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        editingPkgId === pkg.id
                          ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-sm border border-cyan-500/30">
                            {pkg.price}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{pkg.name}</span>
                              {pkg.badge && (
                                <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded font-bold">
                                  {pkg.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-cyan-300 font-mono font-bold">
                              رصيد: {pkg.dataLimitLabel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditPackage(pkg)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-300 transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-slate-400 font-['Cairo']">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{pkg.durationLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 font-['Cairo']">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          <span>{pkg.validityDaysLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 font-bold">
                          <span>{pkg.price} {pkg.currency || draftConfig.currency || 'ريال'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: CARDS REGISTRY & REAL DATABASE */}
            {activeTab === 'cards' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
                <CardsRegistryManager
                  packages={packages}
                  onTestBalanceCode={(code) => {
                    onClose();
                    if (onTestBalanceCode) {
                      onTestBalanceCode(code);
                    }
                  }}
                />
              </div>
            )}

            {/* TAB 2: CONTACTS & SUPPORT DETAILS */}
            {activeTab === 'contacts' && (
              <form onSubmit={handleSaveNetworkSettings} className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-black text-white font-['Cairo'] flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>تعديل أرقام وقنوات التواصل الرسمية للشبكة</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">تنعكس فوراً في صفحة الدخول، الباقات، والفوتير</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>رقم واتساب المبيعات واستقبال طلبات الكروت</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.whatsappNumber}
                        onChange={(e) => setDraftConfig({ ...draftConfig, whatsappNumber: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-emerald-400"
                        placeholder="مثال: 967718097168"
                        required
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">يُفضل إدخال الرقم مع مفتاح الدولة (مثل 967) لفتح محادثات الواتساب مباشرة</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>هاتف الدعم الفني المباشر (الخط الساخن)</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.supportPhone}
                        onChange={(e) => setDraftConfig({ ...draftConfig, supportPhone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-400 outline-none focus:border-cyan-400"
                        placeholder="مثال: 718097168 أو 01234567"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                        <span>هاتف الطوارئ / رقم الإدارة البديل</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.emergencyPhone || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, emergencyPhone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 outline-none focus:border-cyan-400"
                        placeholder="مثال: 770000000"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        <span>مواعيد وساعات خدمة العملاء</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.workingHours || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, workingHours: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                        placeholder="مثال: خدمة 24/7 على مدار الساعة"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-sky-400" />
                        <span>رابط أو معرف قناة التيليجرام الرسمية</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.telegramChannel || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, telegramChannel: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-sky-300 outline-none focus:border-cyan-400"
                        placeholder="مثال: https://t.me/talqanet"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>رابط صفحة الفيسبوك</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.facebookPage || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, facebookPage: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-blue-300 outline-none focus:border-cyan-400"
                        placeholder="مثال: https://facebook.com/talqanet"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        <span>مقر إدارة الشبكة والنطاق الجغرافي للتغطية</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.networkLocation || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, networkLocation: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                        placeholder="مثال: الجمهورية اليمنية — صنعاء — شارع حدة والأحياء المجاورة"
                      />
                    </div>
                  </div>

                  {configSavedToast && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <Check className="w-4 h-4" />
                      <span>تم حفظ أرقام التواصل والتفاصيل بنجاح!</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ أرقام وتفاصيل التواصل</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 3: NETWORK IDENTITY & MIKROTIK SETTINGS */}
            {activeTab === 'network' && (
              <form onSubmit={handleSaveNetworkSettings} className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-black text-white font-['Cairo'] flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span>بيانات هوية الشبكة وسيرفر ميكروتك وشريط الإعلانات</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم الشبكة الرسمي</label>
                      <input
                        type="text"
                        value={draftConfig.networkName}
                        onChange={(e) => setDraftConfig({ ...draftConfig, networkName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">الشعار اللفظي (Slogan)</label>
                      <input
                        type="text"
                        value={draftConfig.slogan}
                        onChange={(e) => setDraftConfig({ ...draftConfig, slogan: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">عملة الأسعار في الكروت</label>
                      <input
                        type="text"
                        value={draftConfig.currency}
                        onChange={(e) => setDraftConfig({ ...draftConfig, currency: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                        placeholder="ريال / ريال يمني / ريال سعودي"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        اسم راوتر الميكروتك (RouterOS Identity)
                      </label>
                      <input
                        type="text"
                        value={draftConfig.mikrotikIdentity || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikIdentity: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-cyan-400"
                        placeholder="MikroTik-Talqa-Core-v7"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        عنوان صفحة الهوتسبوت (Hotspot DNS / URL)
                      </label>
                      <input
                        type="text"
                        value={draftConfig.hotspotDnsName || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, hotspotDnsName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-400 outline-none focus:border-cyan-400"
                        placeholder="t.net أو 10.0.0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        رابط التطبيق السحابي PWA (مثل Vercel)
                      </label>
                      <input
                        type="url"
                        value={draftConfig.appUrl || 'https://talqanet.vercel.app'}
                        onChange={(e) => setDraftConfig({ ...draftConfig, appUrl: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-cyan-400"
                        placeholder="https://talqanet.vercel.app"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        تغيير رمز الـ PIN السري للمدير
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-orange-400 outline-none focus:border-cyan-400"
                        placeholder="اتركه فارغاً للإبقاء على الرمز الحالي"
                      />
                    </div>

                    {/* Toggle: Show / Hide Card Box on Cloud & Vercel */}
                    <div className="sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 to-cyan-950/40 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-white">إظهار صندوق إدخال الكرت في موقع فيرسل (Vercel)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          افتراضياً (مغلق ومستحسن): يتم إخفاء صندوق الكرت في موقع فيرسل والتطبيق السحابي وتحويله إلى <strong>بوابة خدمات وباقات المشتركين</strong>، بينما <strong>يظل صندوق الكرت ظاهراً وأساسياً دائماً داخل راوتر ميكروتك (Hotspot)</strong> دون أي تغيير.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(draftConfig.showVoucherBoxOnCloud)}
                          onChange={(e) => setDraftConfig({ ...draftConfig, showVoucherBoxOnCloud: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>

                    {/* Announcement Section */}
                    <div className="sm:col-span-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-black text-white">نص شريط الإعلانات والأخبار المتحرك:</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-0.5">عنوان الإعلان</label>
                          <input
                            type="text"
                            value={draftConfig.announcementTitle || ''}
                            onChange={(e) => setDraftConfig({ ...draftConfig, announcementTitle: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
                            placeholder="🔥 مضاعفة سرعة كروت طلقة نت للألياف الضوئية!"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-0.5">تفاصيل نص الإعلان</label>
                          <input
                            type="text"
                            value={draftConfig.announcementText || ''}
                            onChange={(e) => setDraftConfig({ ...draftConfig, announcementText: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-cyan-400"
                            placeholder="تم ترقية خوادم الشبكة وزيادة رصيد كروت 500 و 1000 ريال..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {configSavedToast && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <Check className="w-4 h-4" />
                      <span>تم حفظ إعدادات الشبكة وهوية الميكروتك بنجاح!</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ هوية وإعدادات الشبكة</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 4: DISTRIBUTORS & POS MANAGEMENT */}
            {activeTab === 'distributors' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
                <div className="flex items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white">إدارة نقاط البيع والموزعين:</span> أضف المحلات والبقالات ومراكز الاتصالات المعتمدة لبيع الكروت وتحديث أرقام هواتفهم ومواقعهم.
                  </div>

                  {!isAddingNewDist && !editingDistId && (
                    <button
                      onClick={handleOpenAddDistributor}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة نقطة بيع جديدة</span>
                    </button>
                  )}
                </div>

                {/* Distributor Add/Edit Form */}
                {(isAddingNewDist || editingDistId) && (
                  <form onSubmit={handleSaveDistributor} className="p-4 rounded-2xl bg-slate-950 border-2 border-orange-500/40 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        <span>{isAddingNewDist ? 'إضافة نقطة بيع / موزع جديد' : `تعديل بيانات (${draftDist.name})`}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewDist(false);
                          setEditingDistId(null);
                        }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        إلغاء
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم المحل / المركز</label>
                        <input
                          type="text"
                          value={draftDist.name || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-400"
                          placeholder="مثال: مركز الأقصى للاتصالات"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">المدينة / المحافظة</label>
                        <input
                          type="text"
                          value={draftDist.city || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, city: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-400"
                          placeholder="صنعاء"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">الحي / المنطقة</label>
                        <input
                          type="text"
                          value={draftDist.neighborhood || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, neighborhood: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-400"
                          placeholder="شارع حدة / التحرير"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">رقم الهاتف للاتصال</label>
                        <input
                          type="text"
                          value={draftDist.phone || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, phone: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 outline-none focus:border-orange-400"
                          placeholder="718097168"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">رقم الواتساب للتواصل</label>
                        <input
                          type="text"
                          value={draftDist.whatsapp || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, whatsapp: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-orange-400"
                          placeholder="967718097168"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">أوقات وساعات العمل</label>
                        <input
                          type="text"
                          value={draftDist.workingHours || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, workingHours: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-400"
                          placeholder="8:00 ص - 12:00 م"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">العنوان التفصيلي ومكان التواجد</label>
                        <input
                          type="text"
                          value={draftDist.address || ''}
                          onChange={(e) => setDraftDist({ ...draftDist, address: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-400"
                          placeholder="شارع حدة — جوار بنك اليمن الدولي"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewDist(false);
                          setEditingDistId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>حفظ نقطة البيع</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Distributors Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {distributors.map((dist) => (
                    <div
                      key={dist.id}
                      className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-sm border border-orange-500/30">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{dist.name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-cyan-400" />
                              <span>{dist.neighborhood} — {dist.address}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditDistributor(dist)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-300 transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDistributor(dist.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono text-cyan-300">
                          <Phone className="w-3 h-3 text-cyan-400" />
                          {dist.phone}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-emerald-400">
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          {dist.whatsapp}
                        </span>
                        <span className="text-orange-300/90 text-[10px]">{dist.workingHours}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: BACKUP & RESTORE */}
            {activeTab === 'backup' && (
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-black text-white font-['Cairo'] flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>النسخ الاحتياطي وإعادة الضبط الشامل</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Export */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <h5 className="text-xs font-bold text-white">تصدير نسخة احتياطية شاملة (JSON)</h5>
                      <p className="text-[11px] text-slate-400">
                        قم بحفظ وتنزيل جميع باقات الشبكة، أرقام التواصل، نقاط البيع، والإعدادات في ملف لتتمكن من استيرادها على أي جهاز آخر.
                      </p>
                      <button
                        onClick={handleExportBackup}
                        className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل النسخة الاحتياطية (.JSON)</span>
                      </button>
                    </div>

                    {/* Import */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <h5 className="text-xs font-bold text-white">استيراد نسخة احتياطية</h5>
                      <p className="text-[11px] text-slate-400">
                        استرجاع الباقات، أرقام التواصل، ونقاط البيع المحفوظة مسبقاً من ملف JSON.
                      </p>
                      <label className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all">
                        <Upload className="w-4 h-4 text-orange-400" />
                        <span>اختيار ملف للاستيراد (.JSON)</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportBackup}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Reset to Factory Defaults */}
                  <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-bold text-rose-300">استعادة الإعدادات والتسعيرة الافتراضية</h5>
                        <p className="text-[11px] text-slate-400">
                          إعادة ضبط جميع الباقات، أرقام التواصل، والموزعين إلى القيم الأصلية للشبكة.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من استعادة جميع الإعدادات والباقات الافتراضية الأصلية؟')) {
                            onResetDefaults();
                            soundManager.playSuccess();
                            alert('تمت استعادة الإعدادات الافتراضية بنجاح.');
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة الكل افتراضي</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: MIKROTIK TEMPLATES & SCRIPTS (ADMIN ONLY) */}
            {activeTab === 'mikrotik' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
                {/* Admin Confidential Notice */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Cpu className="w-5 h-5 text-amber-400" />
                    <span>منطقة إدارة وتكامل راوتر MikroTik RouterOS (REST API v7)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    قسم خاص بإدارة الشبكة لتمكين المزامنة الحية مع راوتر ميكروتك عبر بروتوكول RouterOS REST API (Port 443 HTTPS)، فحص رصيد الكروت اللحظي، وحقن المستخدمين مباشرة في الراوتر.
                  </p>
                </div>

                {/* Direct RouterOS REST API Integration Card (Port 443 HTTPS) */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <span>إعدادات الاتصال المباشر عبر RouterOS REST API (Port 443 HTTPS)</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                            RB1100AHx4 / v7.14+
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          لتمكين المزامنة الحية وفحص رصيد الكروت لحظياً مباشرة من قلب راوتر ميكروتك
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestMikrotikApi}
                        disabled={apiTesting}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {apiTesting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>جارِ فحص الاتصال...</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4 text-cyan-200" />
                            <span>اختبار الاتصال بالراوتر ⚡</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveMikrotikSettings}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-white" />
                        <span>حفظ الإعدادات</span>
                      </button>
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {/* Host/Domain */}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>عنوان الراوتر (Host/Domain):</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.mikrotikApiHost || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikApiHost: e.target.value })}
                        placeholder="router.samtecai.com"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-slate-500">دومين الـ DNS الموجه للراوتر</span>
                    </div>

                    {/* Port */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>منفذ REST API (الافتراضي: 443 HTTPS):</span>
                      </label>
                      <input
                        type="number"
                        value={draftConfig.mikrotikApiPort || 443}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikApiPort: Number(e.target.value) || 443 })}
                        placeholder="443"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-emerald-400 font-mono">اتصال مشفر وآمن عبر https://</span>
                    </div>

                    {/* Hotspot Server */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-sky-400" />
                        <span>اسم خادم الهوتسبوت:</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.mikrotikHotspotServer || 'all'}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikHotspotServer: e.target.value })}
                        placeholder="all"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-slate-500">القيمة الافتراضية: all</span>
                    </div>

                    {/* API User */}
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>اسم مستخدم الـ API (المعتمد):</span>
                      </label>
                      <input
                        type="text"
                        value={draftConfig.mikrotikApiUser || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikApiUser: e.target.value })}
                        placeholder="mosthassan"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                    </div>

                    {/* API Password */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>كلمة مرور الـ API:</span>
                      </label>
                      <input
                        type="password"
                        value={draftConfig.mikrotikApiPass || ''}
                        onChange={(e) => setDraftConfig({ ...draftConfig, mikrotikApiPass: e.target.value })}
                        placeholder="••••••••••••••"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Live Test Result Banner (Matching Screenshot) */}
                  {apiTestResult && (
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      apiTestResult.success 
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}>
                      <div className="flex items-start sm:items-center gap-2.5">
                        {apiTestResult.success ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                        )}
                        <div>
                          <p className="font-bold">{apiTestResult.message}</p>
                          {apiTestResult.success && (
                            <p className="text-[11px] text-emerald-400/90 mt-0.5 font-mono">
                              الراوتر المكتشف: {apiTestResult.routerModel} (معمارية {apiTestResult.architecture}) — نظام {apiTestResult.routerOsVersion}
                            </p>
                          )}
                        </div>
                      </div>

                      {apiTestResult.success && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                            Ping: {apiTestResult.latencyMs}ms
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                            CPU: {apiTestResult.cpuLoad}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Action Card: Open Complete Exporter */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-cyan-400" />
                        <h4 className="text-sm font-black text-white">حزمة ملفات وقوالب الهوتسبوت (14 ملف HTML & CSS & JS)</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        توليد حزمة قوالب متكاملة (login.html, status.html, logout.html, alogin.html وغيرها) مطابقة لألوان وهوية وأسعار شبكتك وجاهزة للرفع المباشر عبر WinBox (مجلد hotspot).
                      </p>
                    </div>

                    {onOpenExporter && (
                      <button
                        onClick={() => {
                          soundManager.playTap();
                          onOpenExporter();
                        }}
                        className="py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(14,165,233,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
                      >
                        <Download className="w-4 h-4 text-slate-950" />
                        <span>فتح أداة تصدير القوالب وتنزيل ZIP 📦</span>
                      </button>
                    )}
                  </div>

                  {/* Summary Pills */}
                  <div className="pt-2 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-300">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>دومين الهوتسبوت: <strong className="text-cyan-300 font-mono">{networkConfig.hotspotDnsName || 't.net'}</strong></span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>هوية الراوتر: <strong className="text-white font-mono">{networkConfig.mikrotikIdentity || 'MikroTik-Talqa'}</strong></span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>تشفير الدخول: <strong className="text-amber-300 font-mono">HTTP-CHAP / PAP</strong></span>
                    </div>
                  </div>
                </div>

                {/* Terminal Commands: Full 1-Click MikroTik Setup Script */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span>سكربت تهيئة المايكروتك بنقرة واحدة (انسخ والصق في Terminal بالمايكروتك):</span>
                    </div>
                    <button
                      onClick={() => {
                        soundManager.playTap();
                        const apiUser = draftConfig.mikrotikApiUser || 'mosthassan';
                        const apiPass = draftConfig.mikrotikApiPass || 'TalqaNet@2026';
                        const script = `# ========================================================
# 🚀 سكربت تهيئة ميكروتك الكامل للربط المباشر مع طلقة نت
# ========================================================

# 1. تفعيل DDNS السحابي للحصول على رابط دائم مجاني للراوتر
/ip cloud set ddns-enabled=yes update-time=yes

# 2. تفعيل خدمة الـ REST API المشفرة عبر HTTPS (منفذ 443)
/ip service set www-ssl port=443 disabled=no
/ip service set www port=80 disabled=no

# 3. إنشاء مستخدم مخصص للاستعلام وقراءة الرصيد بأمان
/user group add name=talqa-api-reader policy=read,api,test,!write,!policy,!password comment="NetFlow Reader"
/user add name="${apiUser}" group=talqa-api-reader password="${apiPass}" comment="NetFlow Cloud API Integration"

# 4. السماح بدخول المشتركين للموقع حتى بدون كرت (Walled Garden)
/ip hotspot walled-garden
add dst-host=talqanet.vercel.app comment="NetFlow App"
add dst-host=*.vercel.app
add dst-host=*.firebaseio.com
add dst-host=*.googleapis.com
add dst-host=cdnjs.cloudflare.com
add dst-host=fonts.googleapis.com
add dst-host=fonts.gstatic.com

# 5. ضبط هوية الراوتر
/system identity set name="${networkConfig.mikrotikIdentity || 'MikroTik-Talqa'}"

# تم الانتهاء بنجاح! راوترك الآن جاهز للربط الفوري.`;
                        navigator.clipboard.writeText(script);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2500);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>تم نسخ السكربت بالكامل!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ السكربت الكامل للميكروتك 📋</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300/90 overflow-x-auto dir-ltr text-left leading-relaxed max-h-56">
{`# 1. تفعيل DDNS السحابي للحصول على رابط دائم مجاني للراوتر
/ip cloud set ddns-enabled=yes update-time=yes

# 2. تفعيل خدمة الـ REST API المشفرة عبر HTTPS (منفذ 443)
/ip service set www-ssl port=443 disabled=no

# 3. إنشاء مستخدم مخصص للاستعلام وقراءة الرصيد بأمان
/user group add name=talqa-api-reader policy=read,api,test,!write,!policy,!password
/user add name="${draftConfig.mikrotikApiUser || 'mosthassan'}" group=talqa-api-reader password="${draftConfig.mikrotikApiPass || 'كلمة_المرور'}"

# 4. السماح بدخول المشتركين للموقع لفحص الرصيد بدون كرت (Walled Garden)
/ip hotspot walled-garden
add dst-host=talqanet.vercel.app
add dst-host=*.vercel.app
add dst-host=*.firebaseio.com
add dst-host=*.googleapis.com`}
                  </pre>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <strong className="text-cyan-400 block font-bold">🌐 كيف تجد رابط الراوتر (Host)؟</strong>
                      <p className="text-slate-400 leading-relaxed">
                        بعد تشغيل السكربت، افتح في WinBox القائمة: <code className="text-amber-300 font-mono">IP ⬅️ Cloud</code> وانسخ الرابط الموجود في خانة <code className="text-emerald-300 font-mono">DNS Name</code> وضعه في خانة (Host) أعلاه.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <strong className="text-amber-400 block font-bold">📶 هل راوترك يعمل بدون إنترنت خارجي؟</strong>
                      <p className="text-slate-400 leading-relaxed">
                        استخدم زر <strong>«فتح أداة تصدير القوالب وتنزيل ZIP»</strong> أعلاه، وارفع ملفات القوالب مباشرة إلى مجلد <code className="text-emerald-300 font-mono">hotspot</code> في الراوتر، وسيعمل الفحص والاستعلام المحلي فوراً بدون حاجة لـ Static IP.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: LOYALTY REWARDS VAULT */}
            {activeTab === 'loyalty' && (
              <AdminLoyaltyVaultTab />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
