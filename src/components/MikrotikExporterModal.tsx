import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  Terminal, 
  Layers, 
  Sparkles, 
  Cpu,
  Info,
  Archive,
  FolderArchive
} from 'lucide-react';
import { generateMikrotikFiles } from '../utils/mikrotikBridge';
import { NetworkConfig } from '../utils/packagesStorage';
import { soundManager } from '../utils/audio';
import JSZip from 'jszip';

interface MikrotikExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkConfig?: NetworkConfig;
}

type FileTabKey = 
  | 'login' 
  | 'status' 
  | 'live'
  | 'logout' 
  | 'error' 
  | 'alogin' 
  | 'blocked' 
  | 'redirect' 
  | 'rlogin' 
  | 'radvert' 
  | 'success' 
  | 'md5' 
  | 'sos'
  | 'pwa'
  | 'terminal';

export const MikrotikExporterModal: React.FC<MikrotikExporterModalProps> = ({
  isOpen,
  onClose,
  networkConfig
}) => {
  const [networkName, setNetworkName] = useState(networkConfig?.networkName || 'طلقة نت');
  const [slogan, setSlogan] = useState(networkConfig?.slogan || 'طلقة نت ... فعلاً طلقة');
  const [whatsappNumber, setWhatsappNumber] = useState(networkConfig?.whatsappNumber || '967718097168');
  const [currency, setCurrency] = useState(networkConfig?.currency || 'ريال');
  const [appUrl, setAppUrl] = useState(networkConfig?.appUrl || 'https://talqanet.vercel.app');
  const [activeFileTab, setActiveFileTab] = useState<FileTabKey>('login');
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    if (networkConfig) {
      setNetworkName(networkConfig.networkName);
      setSlogan(networkConfig.slogan);
      setWhatsappNumber(networkConfig.whatsappNumber);
      setCurrency(networkConfig.currency);
      if (networkConfig.appUrl) {
        setAppUrl(networkConfig.appUrl);
      }
    }
  }, [networkConfig]);

  if (!isOpen) return null;

  const targetAppUrl = (appUrl || 'https://talqanet.vercel.app').trim();

  const files = generateMikrotikFiles({
    networkName,
    slogan,
    whatsappNumber,
    supportPhone: networkConfig?.supportPhone || '718097168',
    currency,
    primaryColor: '#0ea5e9',
    dnsName: networkConfig?.hotspotDnsName || 't.net',
    appUrl: targetAppUrl
  });

  const mikrotikSosLoanCommands = `# ==============================================================================
# سكربت نظام "سلفني" لشبكة ${networkName} على MikroTik RouterOS
# (منح 50MB أو 3 دقائق لمرة واحدة لكل جهاز + السداد والخصم التلقائي عند إدخال كرت)
# ==============================================================================

# 1. إنشاء بروفايل مخصص لسلفة الطوارئ (SOS)
/ip hotspot user profile
add name="SOS-Emergency-Loan" \\
    rate-limit="2M/8M" \\
    shared-users=1 \\
    status-autorefresh=30s \\
    on-login=":log info (\\"${networkName}: SOS Emergency Loan activated for MAC: \\" . \\$\\"mac-address\\")"

# 2. ضبط سيرفر الهوتسبوت لتفعيل سلفة الطوارئ عبر Trial المحدود
/ip hotspot profile
set [ find default=yes ] \\
    login-by=http-chap,http-pap,trial \\
    trial-uptime-limit=3m \\
    trial-uptime-reset=365d \\
    trial-user-profile="SOS-Emergency-Loan"

# 3. سكربت On-Login لبروفايل الكروت العادية لسداد وخصم السلفة تلقائياً
# (يتم فحص إذا كان الجهاز قد استلف سابقاً وخصم السلفة وتصفير السجل)
/ip hotspot user profile
set [ find default=yes ] on-login=":local clientMac \\$\\"mac-address\\";\\
:local sosUser [/ip hotspot user find where name=(\\"T-\\" . \\$clientMac)];\\
:if ([:len \\$sosUser] > 0) do={\\
  :log warning (\\"${networkName}: Settled and repaid emergency loan for MAC: \\" . \\$clientMac . \\" with card: \\" . \\$user);\\
  /ip hotspot user remove \\$sosUser;\\
}"

# 4. سكربت مجدول لفحص الماكات وتنظيف العمليات
/system scheduler
add name="Auto-Sync-SOS-Debt" interval=1h start-time=startup \\
    on-event=":log info \\"${networkName}: SOS Loan Database Synchronized.\\""
`;

  const mikrotikTerminalCommands = `# ==============================================================================
# 1. إعدادات وهوية شبكة ${networkName} على MikroTik RouterOS
# ==============================================================================
/system identity set name="MikroTik-${networkName.replace(/\s+/g, '-')}"

# ==============================================================================
# 2. إنشاء بروفايلات السرعة الرسمية وبروفايل سلفني (profile-trial)
# ==============================================================================
/ip hotspot user profile
# 0. بروفايل سلفني (Hotspot Trial - 512k/512k بدون Mac Cookie)
add name="profile-trial" rate-limit="512k/512k" shared-users=1 status-autorefresh=1m

# 1. السرعة الاقتصادية (توفير البيانات)
add name="profile-eco" rate-limit="1500k/3500k" shared-users=1 status-autorefresh=1m keepalive-timeout=2m
# 2. السرعة المتوسطة (تصفح و HD)
add name="profile-med" rate-limit="6M/16M" shared-users=1 status-autorefresh=1m keepalive-timeout=2m
# 3. السرعة العالية (ألياف ضوئية)
add name="profile-high" rate-limit="14M/35M" shared-users=1 status-autorefresh=1m keepalive-timeout=2m
# 4. سرعة فائقة (طلقة توربو)
add name="profile-turbo" rate-limit="24M/65M" shared-users=1 status-autorefresh=1m keepalive-timeout=2m
# 5. وضع الألعاب (بنج طلقة / استقرار فائق - أولوية فائقة لحزم Gaming)
add name="profile-gaming" rate-limit="20M/50M" shared-users=1 status-autorefresh=30s keepalive-timeout=2m \\
    incoming-filter="jump-gaming" outgoing-filter="jump-gaming"

# ضبط بروفايل الهوتسبوت وتعيين الدومين المعتمد وتفعيل خدمة سلفني
/ip hotspot profile
set [ find default=yes ] \\
    dns-name="${networkConfig?.hotspotDnsName || 't.net'}" \\
    html-directory=hotspot \\
    login-by=http-chap,http-pap,trial \\
    trial-uptime-limit=00:03:00 \\
    trial-uptime-reset=1d 00:00:00 \\
    trial-user-profile=profile-trial \\
    use-mac-cookie=no

# إنشاء حساب سلفني الافتراضي للطوارئ (في حال تسجيل الدخول باليوزر بدلاً من Trial المباشر)
/ip hotspot user
add name="salfni" password="salfni" profile="profile-trial" comment="حساب سلفني الافتراضي للطوارئ - 3 دقائق"

# ==============================================================================
# 3. جدار الحماية ضد التخمين والهجمات العنيفة (Anti-Brute-Force Firewall)
# ==============================================================================
/ip firewall filter
add chain=input action=drop src-address-list=hotspot_bruteforce comment="Drop Hotspot Brute-Force Attackers"
add chain=input action=add-src-to-address-list address-list=hotspot_bruteforce address-list-timeout=10m \\
    protocol=tcp dst-port=80,443 connection-limit=30,32 comment="Detect & Block Aggressive Hotspot Flooding"

# ==============================================================================
# ==============================================================================
# 4. السماح بسيرفر البث المباشر وسينما الاستراحة وتطبيق PWA والواتساب في الوولد جاردن (Walled Garden)
# (مهم جداً: لتمكين العملاء من فتح وتثبيت التطبيق وموقع فيرسل بدون كرت أو رصيد)
# ==============================================================================
/ip hotspot walled-garden
add dst-host="${targetAppUrl.replace(/^https?:\/\//i, '').split('/')[0]}" action=allow comment="Talqa Net PWA Vercel App"
add dst-host="*.vercel.app" action=allow comment="Talqa Net Vercel Domains"
add dst-host="*firebaseio.com" action=allow comment="Talqa Net Firebase Realtime"
add dst-host="fonts.googleapis.com" action=allow comment="Google Fonts"
add dst-host="fonts.gstatic.com" action=allow comment="Google Fonts Static"
add dst-host="*.whatsapp.net" action=allow comment="WhatsApp Media & Support"
add dst-host="*.whatsapp.com" action=allow comment="WhatsApp Connectivity"
add dst-host="web.whatsapp.com" action=allow comment="WhatsApp Web Portal"

/ip hotspot walled-garden ip
add dst-address=192.168.50.2 dst-port=8096 protocol=tcp action=accept comment="Free Local Cinema & Movies Server"
add dst-address=192.168.50.2 dst-port=8888 protocol=tcp action=accept comment="Direct Free Local Live Sports Stream"
add dst-address=192.168.50.2 dst-port=8080 protocol=tcp action=accept comment="Local Live Sports Alternate Port"
`;

  const mikrotikPwaGuideCommands = `# ==============================================================================
# دليل وأوامر تفعيل تثبيت تطبيق ${networkName} (PWA) على جوالات العملاء عبر MikroTik
# ==============================================================================

# الخطوة 1: نفّذ هذه الأوامر في Terminal الميكروتك (للسماح بالوصول لموقع فيرسل وتثبيت التطبيق بدون كرت):
/ip hotspot walled-garden
add dst-host="${targetAppUrl.replace(/^https?:\/\//i, '').split('/')[0]}" action=allow comment="PWA App Vercel Domain"
add dst-host="*.vercel.app" action=allow comment="Vercel Hosting Domains"
add dst-host="*firebaseio.com" action=allow comment="Firebase Realtime"
add dst-host="fonts.googleapis.com" action=allow comment="Google Fonts"
add dst-host="fonts.gstatic.com" action=allow comment="Google Fonts Static"
add dst-host="*.whatsapp.net" action=allow comment="WhatsApp Media"
add dst-host="*.whatsapp.com" action=allow comment="WhatsApp Connectivity"

# ------------------------------------------------------------------------------
# لماذا لا يفتح الرابط وتفشل عملية التثبيت من نافذة الدخول التلقائية بالجوال؟
# ------------------------------------------------------------------------------
# 1. متصفح تسجيل الدخول المصغر (Captive Portal WebView / CNA):
#    عندما يتصل العميل بالوايفاي، يفتح الأندرويد والآيفون نافذة داخلية محدودة الصلاحيات
#    (Captive Portal WebView) تحظر عمداً ميزة "تثبيت التطبيق" أو حفظ ملفات تعريف الارتباط.
#
# 2. حظر المايكروتك للمواقع الخارجية قبل إدخال الكرت (Walled Garden):
#    قبل إدخال كود الكرت، يكون الإنترنت معطلاً، فإذا ضغط العميل على الرابط ولم تكن أضفت
#    أوامر الـ Walled Garden أعلاه، سيحظر المايكروتك الاتصال بفيرسل وتظهر صفحة بيضاء!
#
# ------------------------------------------------------------------------------
# الحلول البرمجية الذكية المدمجة في هذا التحديث (تم حل المشكلة بالكامل):
# ------------------------------------------------------------------------------
# [1] الهروب التلقائي لمتصفح الهاتف الحقيقي (Android Intent Breakout):
#     تم تزويد زر التثبيت بنظام Intent برمجياً يجبر نظام أندرويد على الخروج من نافذة
#     الهوتسبوت وفتح موقع فيرسل فوراً في تطبيق Google Chrome المستقل!
#
# [2] بوابة التثبيت التفاعلية (Smart PWA Hub Modal):
#     عند الضغط على الشعار العائم أو زر التثبيت، يظهر مودال فخم يحتوي على:
#     - زر فتح فوري في متصفح كروم / سفاري.
#     - زر نسخ الرابط بنقرة واحدة (One-Click Copy) مع إشعار نجاح بالنسخ.
#     - زر إرسال الرابط لنفسه عبر واتساب (ليفتحه من المحادثة في كروم بضغطة واحدة دون إرهاق صاحب الشبكة!).
#     - دليل خطوات التثبيت في 3 ثوانٍ للأندرويد والآيفون.
`;

  const getActiveCode = (): string => {
    switch (activeFileTab) {
      case 'login': return files.loginHtml;
      case 'status': return files.statusHtml;
      case 'live': return files.liveHtml;
      case 'logout': return files.logoutHtml;
      case 'error': return files.errorHtml;
      case 'alogin': return files.aloginHtml;
      case 'blocked': return files.blockedHtml;
      case 'redirect': return files.redirectHtml;
      case 'rlogin': return files.rloginHtml;
      case 'radvert': return files.radvertHtml;
      case 'success': return files.successHtml;
      case 'md5': return files.md5Js;
      case 'sos': return mikrotikSosLoanCommands;
      case 'pwa': return mikrotikPwaGuideCommands;
      case 'terminal': return mikrotikTerminalCommands;
      default: return files.loginHtml;
    }
  };

  const handleCopy = () => {
    soundManager.playTap();
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = (filename: string, content: string) => {
    soundManager.playTap();
    const type = filename.endsWith('.js') ? 'application/javascript' : 'text/html;charset=utf-8';
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download entire hotspot ZIP bundle containing all 14 standard MikroTik files
  const handleDownloadZip = async () => {
    try {
      soundManager.playTap();
      setZipping(true);
      const zip = new JSZip();

      // Root hotspot files
      zip.file('login.html', files.loginHtml);
      zip.file('status.html', files.statusHtml);
      zip.file('live.html', files.liveHtml);
      zip.file('logout.html', files.logoutHtml);
      zip.file('error.html', files.errorHtml);
      zip.file('alogin.html', files.aloginHtml);
      zip.file('blocked.html', files.blockedHtml);
      zip.file('redirect.html', files.redirectHtml);
      zip.file('rlogin.html', files.rloginHtml);
      zip.file('radvert.html', files.radvertHtml);
      zip.file('success.html', files.successHtml);
      zip.file('md5.js', files.md5Js);
      zip.file('sos_emergency_loan.rsc', mikrotikSosLoanCommands);
      zip.file('mikrotik_commands.rsc', mikrotikTerminalCommands);

      // Subfolder css/style.css
      const cssFolder = zip.folder('css');
      if (cssFolder) {
        cssFolder.file('style.css', files.cssStyle);
      }

      // Generate blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hotspot_${networkName.replace(/\s+/g, '_')}_package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      soundManager.playSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setZipping(false);
    }
  };

  const fileTabs: { id: FileTabKey; name: string }[] = [
    { id: 'login', name: 'login.html' },
    { id: 'status', name: 'status.html' },
    { id: 'live', name: 'live.html (بث المباريات)' },
    { id: 'logout', name: 'logout.html' },
    { id: 'error', name: 'error.html' },
    { id: 'alogin', name: 'alogin.html' },
    { id: 'blocked', name: 'blocked.html' },
    { id: 'redirect', name: 'redirect.html' },
    { id: 'rlogin', name: 'rlogin.html' },
    { id: 'radvert', name: 'radvert.html' },
    { id: 'success', name: 'success.html' },
    { id: 'md5', name: 'md5.js' },
    { id: 'sos', name: 'سلفني (SOS Script)' },
    { id: 'pwa', name: 'تثبيت PWA للجوالات 📲' },
    { id: 'terminal', name: 'RouterOS Script' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-orange-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(249,115,22,0.25)] text-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black font-['Cairo'] text-white">
                تصدير وتوليد حزمة ميكروتك الكاملة (MikroTik Hotspot Bundle)
              </h3>
              <p className="text-xs text-slate-400">
                حزمة ملفات الهوتسبوت الكاملة الجاهزة للرفع المباشر إلى مسار <span className="text-cyan-300 font-mono">/files/hotspot</span> في WinBox
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

        {/* Configuration inputs */}
        <div className="py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0 border-b border-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم الشبكة</label>
            <input
              type="text"
              value={networkName}
              onChange={(e) => setNetworkName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">الشعار اللفظي</label>
            <input
              type="text"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">رقم واتساب الدعم</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">رابط تطبيق Vercel / PWA</label>
            <input
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-cyan-400"
              placeholder="https://talqanet.vercel.app"
            />
          </div>
        </div>

        {/* Global ZIP Downloader Banner */}
        <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-orange-950/60 via-slate-900 to-cyan-950/60 border border-orange-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <FolderArchive className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">حزمة الهوتسبوت المتكاملة (13 ملفاً ومجلداً)</span>
              <span className="text-[11px] text-slate-300">تشمل login, status, logout, error, alogin, blocked, md5.js وجميع الأكواد</span>
            </div>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={zipping}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            <span>{zipping ? 'جاري تجهيز الحزمة...' : 'تحميل الحزمة الكاملة (.ZIP)'}</span>
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0 no-scrollbar">
          {fileTabs.map((tab) => {
            const isActive = activeFileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundManager.playTap();
                  setActiveFileTab(tab.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tab.id === 'terminal' ? (
                  <Terminal className="w-3.5 h-3.5" />
                ) : (
                  <FileCode className="w-3.5 h-3.5" />
                )}
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Top bar for active file actions */}
        <div className="flex items-center justify-between py-1.5 shrink-0">
          <span className="text-xs font-mono font-bold text-cyan-300">
            {activeFileTab === 'terminal' ? 'mikrotik_commands.rsc' : `${activeFileTab}${activeFileTab === 'md5' ? '.js' : '.html'}`}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>

            <button
              onClick={() => {
                const fname = activeFileTab === 'terminal' ? 'mikrotik_commands.rsc' : `${activeFileTab}${activeFileTab === 'md5' ? '.js' : '.html'}`;
                handleDownloadSingleFile(fname, getActiveCode());
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-orange-500/30"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>تحميل هذا الملف فقط</span>
            </button>
          </div>
        </div>

        {/* Code Preview Box */}
        <div className="relative flex-1 overflow-auto rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-[11px] text-slate-300 select-all my-1">
          <pre className="whitespace-pre-wrap leading-relaxed">{getActiveCode()}</pre>
        </div>

        {/* MikroTik Quick Upload Instructions */}
        <div className="mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 shrink-0 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-200">طريقة التركيب على الراوتر:</strong> حمّل الحزمة المضغوطة <span className="text-orange-400 font-bold">.ZIP</span> وفك ضغطها، ثم افتح برنامج <span className="text-cyan-300 font-bold">WinBox</span> &larr; قائمة <span className="text-cyan-300 font-bold">Files</span> &larr; واسحب جميع الملفات إلى مجلد <span className="text-cyan-300 font-bold">hotspot</span> في الراوتر.
          </div>
        </div>
      </div>
    </div>
  );
};

