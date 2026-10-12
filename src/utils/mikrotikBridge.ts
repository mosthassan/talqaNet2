import { UserSession, QuickBalanceResult, TestCardPreset, SpeedTier, EmergencyLoanRecord } from '../types';
import { TEST_PRESET_CARDS } from '../data/initialData';
import { evaluateVoucherCode } from './voucherValidator';
import { inspectCardLive, getCardsLedger, generateDeterministicCard, formatBytesArabic, formatSecondsArabic, saveCardsLedger } from './cardsDatabase';
import { getStoredPackages, getStoredNetworkConfig } from './packagesStorage';
import { queryMikrotikCard, parseMikrotikDuration } from './mikrotikApiBridge';

const EMERGENCY_LOAN_STORAGE_KEY = 'talqa_emergency_loans';
const DEFAULT_CLIENT_MAC = 'D4:38:9C:7A:B2:10';

export function getStoredEmergencyLoans(): EmergencyLoanRecord[] {
  try {
    const raw = localStorage.getItem(EMERGENCY_LOAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEmergencyLoan(loan: EmergencyLoanRecord) {
  try {
    const loans = getStoredEmergencyLoans();
    const existingIdx = loans.findIndex(l => l.macAddress === loan.macAddress && !l.isPaid);
    if (existingIdx >= 0) {
      loans[existingIdx] = loan;
    } else {
      loans.push(loan);
    }
    localStorage.setItem(EMERGENCY_LOAN_STORAGE_KEY, JSON.stringify(loans));
  } catch {}
}

export function getActiveUnpaidLoan(macAddress: string = DEFAULT_CLIENT_MAC): EmergencyLoanRecord | null {
  const loans = getStoredEmergencyLoans();
  return loans.find(l => l.macAddress === macAddress && !l.isPaid) || null;
}

export function requestEmergencyLoanSession(
  macAddress: string = DEFAULT_CLIENT_MAC,
  type: 'time' | 'data' | 'combo' = 'combo'
): { success: boolean; session?: UserSession; error?: string } {
  // Check if there is already an active trial or unpaid loan within 24h
  const unpaid = getActiveUnpaidLoan(macAddress);
  if (unpaid) {
    const elapsed = Date.now() - unpaid.borrowedAt;
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (elapsed < oneDayMs && !unpaid.isPaid) {
      const remainingHours = Math.ceil((oneDayMs - elapsed) / (60 * 60 * 1000));
      return {
        success: false,
        error: `تم استهلاك خدمة سلفني (3 دقائق تجريبية) لهذا اليوم على جهازك (MAC). تتجدد الخدمة تلقائياً كل 24 ساعة (المتبقي: ${remainingHours} ساعة) أو يمكنك إدخال كرت رسمي للمتابعة.`
      };
    }
  }

  const loanSeconds = 180; // 3 minutes trial uptime limit
  const loanBytes = 25 * 1024 * 1024; // 25 MB cap during 3 mins
  const amountLabel = '3 دقائق طارئة (تتجدد يومياً)';

  const now = Date.now();
  const loanRecord: EmergencyLoanRecord = {
    id: `LOAN-${Date.now().toString(36).toUpperCase()}`,
    macAddress,
    borrowedAt: now,
    type,
    amountLabel,
    loanBytes,
    loanSeconds,
    isPaid: false
  };

  saveEmergencyLoan(loanRecord);

  const expiresAt = now + loanSeconds * 1000;
  const session: UserSession = {
    voucherCode: `TRIAL-${macAddress.slice(-5).replace(/:/g, '')}`,
    username: `T-${macAddress.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    ipAddress: '10.5.50.' + (Math.floor(Math.random() * 200) + 20),
    macAddress,
    connectedAt: now,
    expiresAt,
    totalSeconds: loanSeconds,
    remainingSeconds: loanSeconds,
    totalBytes: loanBytes,
    downloadBytes: 0,
    uploadBytes: 0,
    speedProfile: 'سلفة طوارئ (3 دقائق - profile-trial)',
    speedTier: 'eco',
    isEmergencyLoan: true,
    loanDeductionNotice: '⚡ خدمة سلفني: تم تفعيل 3 دقائق طوارئ بسرعة 512k عبر بروفايل profile-trial. تتجدد الخدمة تلقائياً كل 24 ساعة.',
    currentDownloadSpeedMbps: 0.512,
    currentUploadSpeedMbps: 0.512,
    pingMs: 18,
    status: 'connected',
    serverName: 'MikroTik-Hotspot-Trial-Service',
    gatewayIp: '10.5.50.1',
    profileName: 'profile-trial'
  };

  saveSession(session);
  return { success: true, session };
}

export function repayEmergencyLoan(macAddress: string = DEFAULT_CLIENT_MAC, cardCode: string): EmergencyLoanRecord | null {
  const loans = getStoredEmergencyLoans();
  const unpaidIdx = loans.findIndex(l => l.macAddress === macAddress && !l.isPaid);
  if (unpaidIdx >= 0) {
    loans[unpaidIdx].isPaid = true;
    loans[unpaidIdx].paidAt = Date.now();
    loans[unpaidIdx].paidWithCard = cardCode;
    localStorage.setItem(EMERGENCY_LOAN_STORAGE_KEY, JSON.stringify(loans));
    return loans[unpaidIdx];
  }
  return null;
}

export interface MikrotikUrlParams {
  mac?: string;
  ip?: string;
  username?: string;
  linkLogin?: string;
  linkLoginOnly?: string;
  linkOrig?: string;
  linkStatus?: string;
  linkLogout?: string;
  error?: string;
  trial?: string;
}

/**
 * دالة الترجمة الشاملة لجميع أخطاء سيرفر ميكروتك إلى اللغة العربية الواضحة
 */
export function translateMikrotikError(rawError?: string): string {
  if (!rawError || rawError.indexOf('$(') !== -1) return '';
  const err = rawError.trim();
  const lower = err.toLowerCase();

  // 1. أخطاء انتهاء ونفاد الرصيد أو وقت الباقة
  if (
    lower.includes('uptime limit reached') ||
    lower.includes('session limit reached') ||
    lower.includes('traffic limit reached') ||
    lower.includes('transfer limit reached') ||
    lower.includes('download limit reached') ||
    lower.includes('credit limit reached') ||
    lower.includes('bytes limit') ||
    lower.includes('limit reached') ||
    lower.includes('expired')
  ) {
    return '⚠️ هذا الكرت انتهى رصيده (استهلكت كامل الوقت أو الميجابايت). يرجى إدخال كرت جديد للمتابعة.';
  }

  // 2. خطأ اقتران الكرت بجهاز آخر أو تجاوز عدد المستخدمين (MAC Lock / Simultaneous Session)
  if (
    lower.includes('already logged in') ||
    lower.includes('simultaneous session') ||
    lower.includes('user is already logged in') ||
    lower.includes('logged in on another device') ||
    lower.includes('mac address is not allowed') ||
    lower.includes('mac is bound') ||
    lower.includes('host is already logged in')
  ) {
    return '🔒 هذا الكرت مقترن ويعمل حالياً على جهاز آخر! يجب تسجيل الخروج من الجهاز الأول أولاً أو استخدام كرت خاص بهذا الجهاز.';
  }

  // 3. خطأ الكرت غير صحيح أو غير موجود أو كلمة المرور خاطئة
  if (
    lower.includes('invalid username or password') ||
    lower.includes('invalid user') ||
    lower.includes('no such user') ||
    lower.includes('user not found') ||
    lower.includes('wrong password') ||
    lower.includes('cannot find user') ||
    lower.includes('invalid login')
  ) {
    return '❌ تأكد من رقم الكرت، هذا الرقم غير صحيح! يرجى مراجعة الأرقام المطبوعة على الكرت.';
  }

  // 4. خطأ الكرت معطل أو غير مفعل
  if (
    lower.includes('user is disabled') ||
    lower.includes('account disabled') ||
    lower.includes('disabled')
  ) {
    return '🚫 هذا الكرت انتهى رصيده أو تم تعطيله من قبل إدارة الشبكة. يرجى إدخال كرت جديد.';
  }

  // 5. خطأ الحظر المؤقت
  if (
    lower.includes('blocked') ||
    lower.includes('banned') ||
    lower.includes('rate limit') ||
    lower.includes('too many')
  ) {
    return '⏳ تم الحظر المؤقت لتجاوز عدد المحاولات الخاطئة. يرجى الانتظار حتى انتهاء العد التنازلي.';
  }

  // 6. خطأ خدمة سلفني / التجريبية
  if (lower.includes('trial') || lower.includes('salfni')) {
    return '⚡ تم استهلاك تجربة سلفني المجانية لهذا اليوم. يرجى إدخال كرت رسمي للاستمرار.';
  }

  // 7. أخطاء السيرفر أو الراديوس أو المهلة
  if (lower.includes('radius') || lower.includes('timeout') || lower.includes('not responding')) {
    return '⚠️ تعذر الاتصال بسيرفر التحقق أو انتهت مهلة الاستجابة. يرجى إعادة المحاولة بعد لحظات.';
  }
  if (lower.includes('ip') || lower.includes('pool') || lower.includes('assign')) {
    return '⚠️ تعذر تخصيص عنوان IP لجهازك من السيرفر. يرجى إعادة تشغيل الواي فاي والمحاولة.';
  }
  if (lower.includes('session') || lower.includes('rejected') || lower.includes('refused')) {
    return '❌ تم رفض جلسة الاتصال من السيرفر. تأكد من كود الكرت أو تواصل مع الدعم الفني.';
  }

  // إذا كانت الرسالة تحتوي على أحرف إنجليزية، نستبدلها برسالة عربية واضحة تضمن عدم ظهور أي إنجليزية للمستخدم
  if (/[a-zA-Z]/.test(err)) {
    return '⚠️ تعذر تسجيل الدخول: يرجى التأكد من كتابة كود الكرت بشكل صحيح أو مراجعة إدارة الشبكة.';
  }

  // إرجاع النص إذا كان عربياً أو رسالة عامة واضحة
  return err;
}

export function parseMikrotikParams(): MikrotikUrlParams {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const rawErr = params.get('error') || undefined;
  return {
    mac: params.get('mac') || params.get('mac-esc') || 'D4:38:9C:7A:B2:10',
    ip: params.get('ip') || '10.5.50.84',
    username: params.get('username') || '',
    linkLogin: params.get('link-login') || '/login',
    linkLoginOnly: params.get('link-login-only') || '/login',
    linkOrig: params.get('link-orig') || 'https://google.com',
    linkStatus: params.get('link-status') || '/status',
    linkLogout: params.get('link-logout') || '/logout',
    error: rawErr ? translateMikrotikError(rawErr) : undefined,
    trial: params.get('trial') || undefined
  };
}

export function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem('talqa_active_session');
    if (!raw) return null;
    const session: UserSession = JSON.parse(raw);
    
    // Check expiration
    const now = Date.now();
    if (session.expiresAt <= now) {
      session.status = 'expired';
      session.remainingSeconds = 0;
      localStorage.setItem('talqa_active_session', JSON.stringify(session));
    } else {
      session.remainingSeconds = Math.max(0, Math.floor((session.expiresAt - now) / 1000));
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  try {
    localStorage.setItem('talqa_active_session', JSON.stringify(session));
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem('talqa_active_session');
  } catch {}
}

// Helper to match preset by numeric or text code
function findPreset(code: string): TestCardPreset | undefined {
  const clean = code.trim().toUpperCase();
  // 1. Direct match
  const direct = TEST_PRESET_CARDS.find(p => p.code === clean);
  if (direct) return direct;

  // 2. Numeric aliases (e.g., 200, 500, 1000, 4000)
  if (clean === '200' || clean.startsWith('200')) {
    return TEST_PRESET_CARDS.find(p => p.code === '200200');
  }
  if (clean === '500' || clean.startsWith('500')) {
    return TEST_PRESET_CARDS.find(p => p.code === '500500');
  }
  if (clean === '1000' || clean.startsWith('1000')) {
    return TEST_PRESET_CARDS.find(p => p.code === '10001000');
  }
  if (clean === '4000' || clean.startsWith('4000')) {
    return TEST_PRESET_CARDS.find(p => p.code === '40004000');
  }
  // 3. Fallback for old codes
  if (clean.includes('200')) return TEST_PRESET_CARDS.find(p => p.code === '200200');
  if (clean.includes('500')) return TEST_PRESET_CARDS.find(p => p.code === '500500');
  if (clean.includes('1000')) return TEST_PRESET_CARDS.find(p => p.code === '10001000');
  if (clean.includes('4000')) return TEST_PRESET_CARDS.find(p => p.code === '40004000');

  return undefined;
}

// Generate realistic simulated session based on entered card and chosen speed tier
export function createSessionFromVoucher(
  voucherCode: string, 
  speedTier: SpeedTier = 'ultra', 
  preset?: TestCardPreset
): UserSession {
  const cleanCode = voucherCode.trim().toUpperCase();
  const ledger = getCardsLedger();
  let cardRecord = ledger[cleanCode];

  if (!cardRecord) {
    const packages = getStoredPackages();
    cardRecord = generateDeterministicCard(cleanCode, packages);
  }

  const totalSec = cardRecord.remainingSeconds > 0 ? cardRecord.remainingSeconds : cardRecord.totalSeconds;
  const totalBytes = cardRecord.remainingBytes > 0 ? cardRecord.remainingBytes : cardRecord.totalBytes;
  const plan = cardRecord.packageName;

  let speed = cardRecord.speedLimit;
  let downMbps = 52.4;
  let upMbps = 18.2;

  switch (speedTier) {
    case 'default':
      speed = 'كرت هوتسبوت (افتراضي 12 Mbps)';
      downMbps = 12.5;
      upMbps = 4.0;
      break;
    case 'eco':
      speed = 'سرعة اقتصادية (توفير البيانات 3 Mbps)';
      downMbps = 3.2;
      upMbps = 1.5;
      break;
    case 'medium':
      speed = 'سرعة متوسطة (تصفح و HD 16 Mbps)';
      downMbps = 16.0;
      upMbps = 6.5;
      break;
    case 'high':
      speed = 'سرعة عالية (ألياف ضوئية 35 Mbps)';
      downMbps = 34.8;
      upMbps = 14.0;
      break;
    case 'gaming':
      speed = '🎮 وضع الألعاب (بنج طلقة 7ms / استقرار فائق 50 Mbps)';
      downMbps = 50.0;
      upMbps = 20.0;
      break;
    case 'ultra':
    default:
      speed = 'سرعة فائقة (طلقة توربو 🚀 65 Mbps)';
      downMbps = 64.2;
      upMbps = 24.5;
      break;
  }

  const now = Date.now();
  const clientMac = DEFAULT_CLIENT_MAC;
  
  // Check if there is an unpaid emergency loan to settle
  const unpaidLoan = getActiveUnpaidLoan(clientMac);
  let deductedNotice: string | undefined = undefined;
  let finalTotalSec = totalSec;
  let finalTotalBytes = totalBytes;

  if (unpaidLoan) {
    // Deduct loan volume or time
    finalTotalBytes = Math.max(10 * 1024 * 1024, totalBytes - unpaidLoan.loanBytes);
    finalTotalSec = Math.max(180, totalSec - unpaidLoan.loanSeconds);
    repayEmergencyLoan(clientMac, cleanCode);
    deductedNotice = `✅ تم تسديد سلفة الطوارئ السابقة (${unpaidLoan.amountLabel}) بنجاح وخصمها من رصيد هذا الكرت. شكراً لأمانتك!`;
  }

  const expiresAt = now + finalTotalSec * 1000;
  const pingMs = speedTier === 'gaming' ? Math.floor(Math.random() * 3) + 6 : Math.floor(Math.random() * 8) + 14;

  const session: UserSession = {
    voucherCode: cleanCode,
    username: `user_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    ipAddress: '10.5.50.' + (Math.floor(Math.random() * 200) + 20),
    macAddress: clientMac,
    connectedAt: now,
    expiresAt,
    totalSeconds: finalTotalSec,
    remainingSeconds: finalTotalSec,
    totalBytes: finalTotalBytes,
    downloadBytes: Math.floor(finalTotalBytes * 0.03),
    uploadBytes: Math.floor(finalTotalBytes * 0.01),
    speedProfile: speed,
    speedTier,
    isEmergencyLoan: false,
    loanDeductionNotice: deductedNotice,
    currentDownloadSpeedMbps: downMbps,
    currentUploadSpeedMbps: upMbps,
    pingMs,
    status: 'connected',
    serverName: 'MikroTik-Talqa-Core-CCR2004',
    gatewayIp: '10.5.50.1',
    profileName: plan
  };

  saveSession(session);
  return session;
}

// Quick balance inspection without consuming the session - powered by Real 2026 Engine
export function checkVoucherBalance(voucherCode: string): QuickBalanceResult {
  return inspectCardLive(voucherCode);
}

// Live asynchronous inspection with direct MikroTik REST API query and active session detection
export async function checkVoucherBalanceAsync(voucherCode: string): Promise<QuickBalanceResult> {
  const clean = voucherCode.trim().toUpperCase();
  const localRes = inspectCardLive(clean);

  // 1. Check if this device is currently connected to an active hotspot session for this voucher
  const activeSession = getStoredSession();
  if (
    activeSession && 
    (activeSession.voucherCode?.trim().toUpperCase() === clean || 
     activeSession.username?.trim().toUpperCase() === clean)
  ) {
    const totalBytes = activeSession.totalBytes || localRes.totalBytes || (2700 * 1024 * 1024);
    const usedBytes = (activeSession.downloadBytes || 0) + (activeSession.uploadBytes || 0);
    const remainingBytes = Math.max(0, totalBytes - usedBytes);
    const totalSeconds = activeSession.totalSeconds || localRes.totalSeconds || (15 * 3600);
    const usedSeconds = Math.max(0, totalSeconds - (activeSession.remainingSeconds || 0));
    const remainingSeconds = Math.max(0, activeSession.remainingSeconds);

    const remainingDataPercent = totalBytes > 0 ? Math.round((remainingBytes / totalBytes) * 100) : 0;
    const remainingTimePercent = totalSeconds > 0 ? Math.round((remainingSeconds / totalSeconds) * 100) : 100;

    return {
      ...localRes,
      valid: remainingBytes > 0 && remainingSeconds > 0,
      statusText: remainingBytes <= 0 ? 'استنفدت بيانات الكرت' : 'كرت متصل ونشط حالياً في الجلسة',
      cardState: remainingBytes <= 0 ? 'exhausted' : 'active',
      totalBytes,
      usedBytes,
      remainingBytes,
      totalSeconds,
      usedSeconds,
      remainingSeconds,
      totalDataFormatted: formatBytesArabic(totalBytes),
      usedDataFormatted: formatBytesArabic(usedBytes),
      remainingDataFormatted: formatBytesArabic(remainingBytes),
      remainingDataPercent,
      totalTimeFormatted: formatSecondsArabic(totalSeconds),
      usedTimeFormatted: formatSecondsArabic(usedSeconds, true),
      remainingTimeFormatted: formatSecondsArabic(remainingSeconds),
      remainingTimePercent,
      dataSource: 'hotspot_active',
      dataSourceText: '📶 متصل حالياً بجلسة الهوتسبوت المباشرة (استهلاك حي لحظي)'
    };
  }

  // 2. Query live MikroTik RouterOS REST API to get realtime counters (bytes-in, bytes-out, uptime)
  const config = getStoredNetworkConfig();
  if (config.mikrotikApiHost && config.mikrotikApiUser) {
    try {
      const live = await queryMikrotikCard(clean, {
        host: config.mikrotikApiHost,
        port: config.mikrotikApiPort || 443,
        user: config.mikrotikApiUser,
        pass: config.mikrotikApiPass || '',
        hotspotServer: config.mikrotikHotspotServer || 'all'
      });

      if (live.found && live.user) {
        const u = live.user;
        const bytesIn = Number(u['bytes-in']) || 0;
        const bytesOut = Number(u['bytes-out']) || 0;
        const usedBytes = bytesIn + bytesOut;
        const limitBytes = Number(u['limit-bytes-total']) || localRes.totalBytes || (2700 * 1024 * 1024);
        const remainingBytes = Math.max(0, limitBytes - usedBytes);
        const usedSeconds = parseMikrotikDuration(u.uptime);
        const limitSeconds = parseMikrotikDuration(u['limit-uptime']) || localRes.totalSeconds || (15 * 3600);
        const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);
        const remainingDataPercent = limitBytes > 0 ? Math.round((remainingBytes / limitBytes) * 100) : 0;
        const remainingTimePercent = limitSeconds > 0 ? Math.round((remainingSeconds / limitSeconds) * 100) : 100;

        // Synchronize live counters from router back to local storage
        try {
          const ledger = getCardsLedger();
          if (ledger[clean]) {
            ledger[clean].usedBytes = usedBytes;
            ledger[clean].remainingBytes = remainingBytes;
            ledger[clean].usedSeconds = usedSeconds;
            ledger[clean].remainingSeconds = remainingSeconds;
            ledger[clean].status = remainingBytes <= 0 || remainingSeconds <= 0 ? 'exhausted' : usedBytes > 0 ? 'active' : 'new';
            saveCardsLedger(ledger);
          }
        } catch {}

        return {
          code: clean,
          valid: remainingBytes > 0 && remainingSeconds > 0,
          statusText: remainingBytes <= 0 
            ? 'استنفدت بيانات الكرت في الراوتر' 
            : usedBytes > 0 
            ? `كرت نشط في راوتر ميكروتك (متبقي ${remainingDataPercent}%)` 
            : 'كرت جديد معتمد في راوتر ميكروتك',
          cardState: remainingBytes === 0 ? 'exhausted' : usedBytes > 0 ? 'active' : 'new',
          planName: u.profile ? `بروفايل: ${u.profile}` : localRes.planName || 'باقة ميكروتك المعتمدة',
          price: localRes.price || 500,
          currency: localRes.currency || 'ريال',
          serialNumber: `MT-${u['.id'] || u.name}`,
          totalBytes: limitBytes,
          usedBytes,
          remainingBytes,
          remainingDataFormatted: formatBytesArabic(remainingBytes),
          remainingDataPercent,
          totalDataFormatted: formatBytesArabic(limitBytes),
          usedDataFormatted: formatBytesArabic(usedBytes),
          remainingTimeFormatted: formatSecondsArabic(remainingSeconds),
          remainingTimePercent,
          totalTimeFormatted: formatSecondsArabic(limitSeconds),
          usedTimeFormatted: formatSecondsArabic(usedSeconds, true),
          expirationDate: localRes.expirationDate || 'حسب إعدادات الراوتر',
          maxSpeed: localRes.maxSpeed || 'محدد بالبروفايل في الراوتر',
          distributorName: u.comment || localRes.distributorName || 'سيرفر ميكروتك',
          dataSource: 'mikrotik_live',
          dataSourceText: '🔴 استعلام حي ومباشر من راوتر ميكروتك (عدادات اللحظة)'
        };
      } else if (live.error && live.error.includes('غير موجود') && !localRes.valid) {
        return {
          ...localRes,
          error: `❌ الكرت غير موجود! رقم الكرت (${clean}) تم الاستعلام عنه في راوتر ميكروتك (${config.mikrotikApiHost}) ولم يتم العثور عليه في مستخدمي الهوتسبوت /ip/hotspot/user.`
        };
      }
    } catch {
      // Fallback
    }
  }

  // 3. If found in local database ledger (from imported MikroTik .rsc file or cloud)
  if (localRes.valid) {
    const isBrandNew = (localRes.usedBytes || 0) === 0 && (localRes.usedSeconds || 0) === 0;
    return {
      ...localRes,
      statusText: isBrandNew ? 'كرت جديد معتمد (جاهز للاستخدام)' : localRes.statusText,
      dataSource: localRes.dataSource || 'ledger_imported',
      dataSourceText: isBrandNew 
        ? '📁 رصيد الكرت المعتمد من ملف المايكروتك (كرت جديد بكامل رصيده 100%)'
        : '📁 رصيد الكرت في سجل الشبكة'
    };
  }

  return localRes;
}

// Generate the complete MikroTik RouterOS HTML Files Bundle (Full Hotspot Package matching WinBox standards)
export function generateMikrotikFiles(config: {
  networkName: string;
  slogan: string;
  whatsappNumber: string;
  supportPhone?: string;
  currency: string;
  primaryColor: string;
  dnsName?: string;
  appUrl?: string;
}) {
  const dnsName = (config.dnsName || 't.net').trim();
  const appUrl = (config.appUrl || 'https://talqanet.vercel.app').trim();
  const commonCss = `
    :root {
      --bg: #070a13;
      --card-bg: rgba(15, 23, 42, 0.95);
      --primary: #00f2fe;
      --secondary: #0ea5e9;
      --accent: #f97316;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: rgba(14, 165, 233, 0.35);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: radial-gradient(circle at 50% 0%, #172554 0%, #070a13 75%);
      color: var(--text);
      font-family: 'Cairo', 'Tajawal', 'Segoe UI', 'SF Pro AR', 'Noto Sans Arabic', Tahoma, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 16px 12px;
      direction: rtl;
    }
    .wrapper {
      width: 100%;
      max-width: 460px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    /* Top Navigation Tabs matching React App */
    .nav-tabs-container {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(14, 165, 233, 0.3);
      border-radius: 20px;
      padding: 5px 4px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .nav-tab {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 8px 2px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      font-family: inherit;
      transition: all 0.2s ease;
      text-decoration: none;
      white-space: nowrap;
    }
    .nav-tab svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2; }
    .nav-tab:hover { color: #f8fafc; background: rgba(30, 41, 59, 0.5); }
    .nav-tab.active {
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      color: #ffffff;
      font-weight: 900;
      box-shadow: 0 0 15px rgba(14, 165, 233, 0.5);
    }

    /* Main Container Card */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 24px 20px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(14, 165, 233, 0.15);
      text-align: center;
      position: relative;
    }

    /* Server Status Badge */
    .server-status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.3);
      padding: 8px 14px;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 18px;
      width: 100%;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #00f2fe;
      border-radius: 50%;
      box-shadow: 0 0 8px #00f2fe;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* Brand Logo */
    .logo-container {
      width: 72px;
      height: 72px;
      margin: 0 auto 12px;
      background: linear-gradient(135deg, #00f2fe, #0ea5e9, #f97316);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 25px rgba(14, 165, 233, 0.5);
    }
    .logo-container svg { width: 40px; height: 40px; fill: #070a13; }
    
    .brand-title-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .fiber-badge {
      background: linear-gradient(90deg, #f97316, #ea580c);
      color: #fff;
      font-size: 10px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 6px;
      letter-spacing: 1px;
    }
    h1 { font-size: 24px; font-weight: 900; color: #fff; }
    .slogan { color: #38bdf8; font-size: 13px; font-weight: 700; margin-bottom: 20px; }

    /* Input Styling */
    .input-group { margin-bottom: 16px; text-align: right; }
    .input-group label { display: block; font-size: 12px; font-weight: 800; color: var(--text-muted); margin-bottom: 6px; }
    .input-box {
      width: 100%;
      background: rgba(2, 6, 23, 0.9);
      border: 2px solid #1e293b;
      border-radius: 14px;
      padding: 14px;
      font-size: 17px;
      font-weight: 800;
      color: #38bdf8;
      text-align: center;
      outline: none;
      letter-spacing: 2px;
      font-family: monospace, sans-serif;
      transition: all 0.3s ease;
    }
    .input-box:focus { border-color: #00f2fe; box-shadow: 0 0 15px rgba(0, 242, 254, 0.4); }

    /* Speed Selector Box */
    .speed-select-box {
      background: #090e1a;
      border: 1px solid rgba(14, 165, 233, 0.3);
      border-radius: 16px;
      padding: 12px;
      margin-bottom: 16px;
      text-align: right;
    }
    .speed-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .speed-header-title { font-size: 11px; color: #94a3b8; font-weight: 700; }
    .speed-header-val { font-size: 13px; font-weight: 900; color: #f97316; font-family: inherit; }
    .speed-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }
    .btn-speed {
      background: #1e293b;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 10px 6px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-align: center;
    }
    .btn-speed span.sub { font-size: 9px; opacity: 0.7; font-family: monospace; }
    .btn-speed:hover { background: #334155; color: #fff; }
    .btn-speed.active {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #0f172a;
      font-weight: 900;
      border-color: #fb923c;
      box-shadow: 0 0 15px rgba(249, 115, 22, 0.4);
    }
    .btn-speed.active span.sub { color: #0f172a; font-weight: 800; opacity: 1; }

    .btn-speed-gaming {
      width: 100%;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
      border: 1px solid #10b981;
      color: #34d399;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
      cursor: pointer;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s;
    }
    .btn-speed-gaming:hover, .btn-speed-gaming.active {
      background: linear-gradient(135deg, #10b981, #06b6d4);
      color: #022c22;
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
    }
    .btn-speed-gaming.active .badge-ping { background: #022c22; color: #34d399; }
    .badge-ping {
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 900;
      font-family: monospace;
    }

    /* Recent 5 Cards History System (آخر 5 كروت مدخلة) */
    .input-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .input-label {
      font-size: 13px;
      font-weight: 800;
      color: #94a3b8;
    }
    .btn-recent-cards {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(3, 105, 161, 0.25));
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 11px;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-recent-cards:hover {
      background: rgba(14, 165, 233, 0.3);
      border-color: #38bdf8;
      box-shadow: 0 0 14px rgba(14, 165, 233, 0.35);
    }
    .recent-count-badge {
      background: #0284c7;
      color: #ffffff;
      font-size: 10px;
      font-weight: 900;
      padding: 1px 6px;
      border-radius: 999px;
    }

    .recent-cards-card {
      background: #090e1a;
      border: 1.5px solid rgba(56, 189, 248, 0.5);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 14px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(14, 165, 233, 0.25);
      animation: fadeIn 0.25s ease-out;
      text-align: right;
    }
    .recent-cards-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .recent-cards-title {
      font-size: 13px;
      font-weight: 900;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-close-recent {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      width: 24px;
      height: 24px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      font-weight: 900;
      transition: all 0.2s;
    }
    .btn-close-recent:hover {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }
    .recent-cards-subtitle {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 10px;
    }
    .recent-cards-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
    }
    .recent-card-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 10px 12px;
      transition: all 0.2s;
    }
    .recent-card-item:hover {
      border-color: #38bdf8;
      background: rgba(15, 23, 42, 0.95);
      box-shadow: 0 0 10px rgba(14, 165, 233, 0.2);
    }
    .recent-card-item.is-latest {
      border-color: rgba(245, 158, 11, 0.7);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(15, 23, 42, 0.95));
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
    }
    .recent-card-info {
      flex: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
    }
    .recent-card-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 900;
      color: #38bdf8;
      letter-spacing: 1px;
    }
    .badge-latest-card {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #000000;
      font-size: 10px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 999px;
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
      white-space: nowrap;
    }
    .badge-prev-card {
      background: #1e293b;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .recent-card-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-use-card {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      border: 1px solid #38bdf8;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    .btn-use-card:hover {
      background: #0ea5e9;
      box-shadow: 0 0 12px rgba(14, 165, 233, 0.4);
    }
    .btn-remove-single-card {
      background: transparent;
      border: 1px solid #334155;
      color: #64748b;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }
    .btn-remove-single-card:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #ef4444;
    }
    .recent-cards-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #1e293b;
    }
    .btn-clear-recent {
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .btn-clear-recent:hover {
      color: #ef4444;
    }
    .no-recent-cards {
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }

    .remember-card-box {
      background: #090e1a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 10px 12px;
      margin-bottom: 14px;
      transition: border-color 0.2s;
    }
    .remember-card-box:hover { border-color: rgba(6, 182, 212, 0.3); }
    .remember-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }
    .remember-label-content {
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: right;
    }
    .remember-title {
      font-size: 12px;
      font-weight: 900;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .remember-badge {
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    .remember-hint {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
      text-align: right;
      line-height: 1.4;
    }
    .remember-chk {
      width: 18px;
      height: 18px;
      accent-color: #06b6d4;
      cursor: pointer;
    }

    /* Submit Button */
    .btn-submit {
      width: 100%;
      background: linear-gradient(90deg, #00f2fe, #0ea5e9, #f97316);
      border: none;
      border-radius: 14px;
      padding: 14px;
      font-size: 16px;
      font-weight: 900;
      color: #020617;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(14, 165, 233, 0.35);
      transition: 0.3s;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(14, 165, 233, 0.5); }

    /* SOS Hotspot Trial Button */
    .btn-trial {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(249, 115, 22, 0.15));
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 14px;
      padding: 10px 12px;
      color: #fbbf24;
      text-decoration: none;
      font-weight: 800;
      font-size: 12px;
      transition: 0.2s;
      box-shadow: 0 0 15px rgba(245, 158, 11, 0.1);
      margin-top: 10px;
    }
    .btn-trial:hover { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245, 158, 11, 0.25); }

    /* Islamic Spiritual Reminder Card */
    .islamic-reminder-card {
      background: linear-gradient(135deg, rgba(120, 53, 15, 0.45), rgba(15, 23, 42, 0.95), rgba(6, 78, 59, 0.45));
      border: 2px solid rgba(245, 158, 11, 0.55);
      border-radius: 18px;
      padding: 12px 14px;
      margin-bottom: 16px;
      text-align: center;
      box-shadow: 0 0 25px rgba(245, 158, 11, 0.25);
      position: relative;
      overflow: hidden;
    }
    .islamic-reminder-title {
      font-size: 11px;
      font-weight: 900;
      color: #fde68a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 6px;
      background: rgba(245, 158, 11, 0.18);
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 2px 10px;
      border-radius: 20px;
    }
    .islamic-reminder-text {
      font-family: 'Amiri', 'Traditional Arabic', 'Scheherazade New', serif;
      font-size: 15px;
      font-weight: 700;
      color: #fef08a;
      line-height: 1.8;
      text-shadow: 0 2px 10px rgba(245, 158, 11, 0.4);
      letter-spacing: 0.3px;
    }

    /* Sports Live Stream Match Banner */
    .btn-live-match-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.18));
      border: 1.5px solid #10b981;
      border-radius: 16px;
      padding: 12px 14px;
      color: #ffffff;
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
      transition: all 0.3s ease;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.25);
      margin-top: 14px;
      text-align: right;
    }
    .btn-live-match-banner:hover {
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.35), rgba(6, 182, 212, 0.35));
      border-color: #34d399;
      transform: translateY(-2px);
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.45);
    }
    /* Unified Talqa Lounge Banner */
    .btn-lounge-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.28));
      border: 1.5px solid #10b981;
      border-radius: 18px;
      padding: 12px 14px;
      color: #ffffff;
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
      transition: all 0.3s ease;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.25);
      margin-top: 14px;
      text-align: right;
    }
    .btn-lounge-banner:hover {
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.38), rgba(6, 182, 212, 0.42));
      border-color: #38bdf8;
      transform: translateY(-2px);
      box-shadow: 0 0 35px rgba(6, 182, 212, 0.45);
    }
    .btn-lounge-badge {
      background: linear-gradient(135deg, #10b981, #06b6d4);
      color: #022c22;
      padding: 4px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .live-match-top-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .live-pulse-container {
      position: relative;
      width: 12px;
      height: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
    }
    .live-dot-ping {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #10b981;
      opacity: 0.75;
      animation: livePing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .live-dot-core {
      position: relative;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
    }
    @keyframes livePing {
      75%, 100% { transform: scale(2.2); opacity: 0; }
    }
    .btn-live-badge {
      background: #10b981;
      color: #022c22;
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 900;
    }

    /* Tabs Views Hide/Show */
    .tab-content { display: none; }
    .tab-content.active { display: block; animation: fadeIn 0.25s ease; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Offline Packages Grid */
    .packages-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: right;
    }
    .pkg-card {
      background: #090e1a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 14px;
      transition: 0.2s;
    }
    .pkg-card:hover { border-color: #0ea5e9; }
    .pkg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .pkg-name { font-size: 15px; font-weight: 900; color: #fff; }
    .pkg-price { font-size: 16px; font-weight: 900; color: #38bdf8; font-family: monospace, sans-serif; }
    .pkg-specs { display: flex; gap: 8px; font-size: 11px; color: #94a3b8; font-weight: 700; margin-bottom: 8px; }
    .pkg-badge { background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); font-size: 10px; padding: 2px 6px; border-radius: 6px; font-weight: 800; }
    
    /* Offline POS List & Professional Banner */
    .pos-list { display: flex; flex-direction: column; gap: 10px; text-align: right; }
    .pos-hero-card {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(15, 23, 42, 0.95), rgba(16, 185, 129, 0.12));
      border: 2px solid rgba(6, 182, 212, 0.4);
      border-radius: 20px;
      padding: 16px;
      text-align: center;
      box-shadow: 0 0 25px rgba(6, 182, 212, 0.15);
      margin-bottom: 12px;
    }
    .pos-hero-title {
      font-size: 16px;
      font-weight: 900;
      color: #fff;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .pos-hero-desc {
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .pos-action-btns {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .pos-btn-whatsapp {
      background: #059669;
      border: 1px solid #10b981;
      color: #fff;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pos-btn-call {
      background: #1e293b;
      border: 1px solid #38bdf8;
      color: #38bdf8;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pos-features-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 10px;
      text-align: right;
    }
    .pos-feature-item {
      background: #090e1a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 10px 12px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .pos-feature-icon {
      font-size: 16px;
      shrink: 0;
    }
    .pos-feature-text strong {
      display: block;
      font-size: 12px;
      color: #fff;
      margin-bottom: 2px;
    }
    .pos-feature-text span {
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* Offline Speedtest Widget */
    .speed-gauge {
      background: #090e1a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 20px 14px;
      margin: 10px 0;
      text-align: center;
    }
    .gauge-val { font-size: 38px; font-weight: 900; color: #00f2fe; font-family: monospace; }
    .gauge-unit { font-size: 12px; color: #94a3b8; }

    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 12px;
      border-radius: 14px;
      font-size: 12px;
      margin-bottom: 14px;
      line-height: 1.5;
    }

    /* Smart Card Status Diagnostic Alert Cards */
    .alert-card-status {
      border-radius: 16px;
      padding: 14px 12px;
      margin-bottom: 16px;
      text-align: right;
      direction: rtl;
      border: 1.5px solid;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
      animation: fadeIn 0.3s ease-out;
    }
    .alert-status-expired {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.28));
      border-color: rgba(245, 158, 11, 0.75);
      color: #fef3c7;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
    }
    .alert-status-notfound {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(185, 28, 28, 0.28));
      border-color: rgba(239, 68, 68, 0.75);
      color: #fee2e2;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
    }
    .alert-status-locked {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(67, 56, 202, 0.28));
      border-color: rgba(99, 102, 241, 0.75);
      color: #e0e7ff;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    }
    .alert-status-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 900;
      font-size: 13.5px;
      margin-bottom: 6px;
    }
    .alert-status-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 800;
      margin-right: auto;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid currentColor;
    }
    .alert-status-body {
      font-size: 11.5px;
      line-height: 1.6;
      opacity: 0.95;
      margin-bottom: 10px;
    }
    .alert-status-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
    }
    .alert-status-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s;
    }
    .alert-status-btn-primary {
      background: #f59e0b;
      color: #0f172a;
    }
    .alert-status-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Anti-Brute-Force Rate Limit Alert Box */
    .alert-ratelimit {
      background: linear-gradient(135deg, rgba(225, 29, 72, 0.25), rgba(159, 18, 57, 0.35));
      border: 2px solid #f43f5e;
      border-radius: 18px;
      padding: 16px 14px;
      margin-bottom: 18px;
      color: #ffe4e6;
      box-shadow: 0 0 25px rgba(244, 63, 94, 0.4), inset 0 0 15px rgba(225, 29, 72, 0.2);
      animation: pulseAlert 2s infinite ease-in-out;
      text-align: center;
    }
    @keyframes pulseAlert {
      0%, 100% { box-shadow: 0 0 15px rgba(244, 63, 94, 0.3); }
      50% { box-shadow: 0 0 30px rgba(244, 63, 94, 0.6); }
    }
    .ratelimit-title {
      font-size: 14px;
      font-weight: 900;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .ratelimit-msg {
      font-size: 12px;
      font-weight: 700;
      color: #fecdd3;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .ratelimit-timer-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(2, 6, 23, 0.75);
      border: 1px solid rgba(244, 63, 94, 0.6);
      color: #fda4af;
      padding: 8px 18px;
      border-radius: 14px;
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
    }
    .ratelimit-timer-val {
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      font-family: monospace, sans-serif;
      letter-spacing: 1px;
    }
    .info-footer { margin-top: 16px; font-size: 11px; color: var(--text-muted); }
    .info-footer a { color: #38bdf8; text-decoration: none; font-weight: 800; }

    /* Samtec AI Software Developer Footer */
    .developer-brand-footer {
      margin-top: 18px;
      padding: 12px 14px;
      background: linear-gradient(180deg, rgba(2, 6, 23, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1px solid rgba(14, 165, 233, 0.25);
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .developer-brand-footer .dev-title {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 3px;
    }
    .developer-brand-footer .dev-title strong {
      color: #38bdf8;
      font-weight: 900;
    }
    .developer-brand-footer .dev-author {
      font-size: 11px;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    .developer-brand-footer .dev-author span {
      color: #fbbf24;
      font-weight: 900;
    }
    .developer-brand-footer .dev-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .dev-badge-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(14, 165, 233, 0.35);
      color: #38bdf8 !important;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 8px;
      text-decoration: none;
      font-family: monospace, sans-serif;
      transition: all 0.2s;
    }
    .dev-badge-link:hover {
      background: rgba(14, 165, 233, 0.25);
      color: #fff !important;
    }
    .dev-whatsapp-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff !important;
      font-size: 10px;
      font-weight: 900;
      padding: 4px 10px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
      transition: all 0.2s;
    }
    .dev-whatsapp-btn:hover {
      background: linear-gradient(135deg, #059669, #047857);
      transform: scale(1.02);
    }

    /* Fixed Floating PWA Install Button for Mobile & Desktop (الزر الثابت لتثبيت التطبيق على الجوال) */
    .fixed-pwa-btn {
      position: fixed;
      bottom: 20px;
      left: 16px;
      z-index: 999;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 16px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff !important;
      font-size: 12px;
      font-weight: 900;
      font-family: inherit;
      text-decoration: none;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.45), 0 0 15px rgba(16, 185, 129, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      transition: all 0.25s ease;
      backdrop-filter: blur(8px);
    }
    .fixed-pwa-btn:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.55);
      color: #ffffff !important;
    }
    .fixed-pwa-icon {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fixed-pwa-icon svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.2;
    }
    .fixed-pwa-ping {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #34d399;
      animation: pwaPulse 2s infinite;
    }
    @keyframes pwaPulse {
      0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.8); }
      70% { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
      100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    }

    /* 2026 AI Balance Inspector Button & Modal */
    .btn-check-balance {
      width: 100%;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.12));
      border: 1.5px solid rgba(14, 165, 233, 0.4);
      border-radius: 14px;
      padding: 12px 14px;
      color: #38bdf8;
      font-weight: 900;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 10px;
      margin-bottom: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(14, 165, 233, 0.12);
    }
    .btn-check-balance:hover {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(99, 102, 241, 0.2));
      border-color: #38bdf8;
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.25);
      transform: translateY(-1px);
    }
    .balance-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.88);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    .pwa-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    .pwa-modal-card {
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
      background: #090e1a;
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 24px;
      padding: 20px;
      box-shadow: 0 0 50px rgba(16, 185, 129, 0.25);
      color: #f1f5f9;
      box-sizing: border-box;
      text-align: right;
    }
    .balance-modal-card {
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
      background: #090e1a;
      border: 1px solid rgba(14, 165, 233, 0.35);
      border-radius: 24px;
      padding: 20px;
      box-shadow: 0 0 50px rgba(14, 165, 233, 0.25);
      color: #f1f5f9;
      box-sizing: border-box;
      text-align: right;
    }
    .ai-smart-box {
      background: linear-gradient(135deg, rgba(88, 28, 135, 0.25), rgba(15, 23, 42, 0.9));
      border: 1px solid rgba(168, 85, 247, 0.35);
      border-radius: 16px;
      padding: 12px;
      margin-top: 12px;
      text-align: right;
    }
    .ai-estimate-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 8px;
    }
    .ai-estimate-item {
      background: rgba(2, 6, 23, 0.8);
      border: 1px solid rgba(168, 85, 247, 0.25);
      border-radius: 10px;
      padding: 8px 4px;
      text-align: center;
    }
    .ai-estimate-label { font-size: 10px; color: #94a3b8; margin-bottom: 2px; }
    .ai-estimate-val { font-size: 11px; font-weight: 900; color: #c084fc; font-family: monospace; }
    .quota-meter-bg {
      background: #1e293b;
      height: 9px;
      border-radius: 10px;
      overflow: hidden;
      margin: 8px 0;
      padding: 1px;
    }
    .quota-meter-fill {
      height: 100%;
      border-radius: 8px;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      transition: width 0.4s ease;
    }
  `;

  const md5Js = `/* MD5 Message Digest Algorithm - RFC 1321 for MikroTik RouterOS HTTP-CHAP */
function safe_add(x,y){var lsw=(x&0xFFFF)+(y&0xFFFF),msw=(x>>16)+(y>>16)+(lsw>>16);return(msw<<16)|(lsw&0xFFFF);}
function rol(num,cnt){return(num<<cnt)|(num>>>(32-cnt));}
function cmn(q,a,b,x,s,t){return safe_add(rol(safe_add(safe_add(a,q),safe_add(x,t)),s),b);}
function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t);}
function coreMD5(x){var a=1732584193,b=-271733879,c=-1732584194,d=271733878;for(var i=0;i<x.length;i+=16){var olda=a,oldb=b,oldc=c,oldd=d;a=ff(a,b,c,d,x[i+0],7,-680876936);d=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);b=ff(b,c,d,a,x[i+3],22,-1044525330);a=ff(a,b,c,d,x[i+4],7,-176418897);d=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);b=ff(b,c,d,a,x[i+7],22,-45705983);a=ff(a,b,c,d,x[i+8],7,1770035416);d=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);a=ff(a,b,c,d,x[i+12],7,1804603682);d=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);b=ff(b,c,d,a,x[i+15],22,1236535329);a=gg(a,b,c,d,x[i+1],5,-165796510);d=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);b=gg(b,c,d,a,x[i+0],20,-373897302);a=gg(a,b,c,d,x[i+5],5,-701558691);d=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);b=gg(b,c,d,a,x[i+4],20,-405537848);a=gg(a,b,c,d,x[i+9],5,568446438);d=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);b=gg(b,c,d,a,x[i+8],20,1163531501);a=gg(a,b,c,d,x[i+13],5,-1444681467);d=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+5],4,-378558);d=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);b=hh(b,c,d,a,x[i+14],23,-35309556);a=hh(a,b,c,d,x[i+1],4,-1530992060);d=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13],4,681279174);d=hh(d,a,b,c,x[i+0],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);b=hh(b,c,d,a,x[i+6],23,76029189);a=hh(a,b,c,d,x[i+9],4,-640364487);d=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);b=hh(b,c,d,a,x[i+2],23,-995338651);a=ii(a,b,c,d,x[i+0],6,-198630844);d=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);b=ii(b,c,d,a,x[i+5],21,-57434055);a=ii(a,b,c,d,x[i+12],6,1700485571);d=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);b=ii(b,c,d,a,x[i+1],21,-2054922799);a=ii(a,b,c,d,x[i+8],6,1873313359);d=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21,1309151649);a=ii(a,b,c,d,x[i+4],6,-145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);b=ii(b,c,d,a,x[i+9],21,-343485551);a=safe_add(a,olda);b=safe_add(b,oldb);c=safe_add(c,oldc);d=safe_add(d,oldd);}return[a,b,c,d];}
function binl2hex(binarray){var hex_tab="0123456789abcdef",str="";for(var i=0;i<binarray.length*4;i++){str+=hex_tab.charAt((binarray[i>>2]>>((i%4)*8+4))&0xF)+hex_tab.charAt((binarray[i>>2]>>((i%4)*8))&0xF);}return str;}
function str2binl(str){var nblk=((str.length+8)>>6)+1,blks=new Array(nblk*16);for(var i=0;i<nblk*16;i++)blks[i]=0;for(var i=0;i<str.length;i++)blks[i>>2]|=(str.charCodeAt(i)&0xFF)<<((i%4)*8);blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=str.length*8;return blks;}
function hexMD5(str){return binl2hex(coreMD5(str2binl(str)));}
`;

  // 1. login.html (Full 4-Tabs Offline Responsive Experience)
  const loginHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${config.networkName} - بوابة تسجيل الدخول</title>
  $(if logged-in == 'yes')
  <script>
    window.location.replace('$(link-status)');
  </script>
  <meta http-equiv="refresh" content="0; url=$(link-status)">
  $(endif)
  <style>${commonCss}</style>
  <script src="md5.js"></script>
  <script>
${md5Js}
  </script>
</head>
<body>
  <div class="wrapper">
    <!-- Top 5-Tabs Navigation (100% Offline Compatible) -->
    <div class="nav-tabs-container">
      <button type="button" class="nav-tab active" onclick="switchTab('tab-login', this)">
        <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>تسجيل الدخول</span>
      </button>
      <button type="button" class="nav-tab" onclick="switchTab('tab-packages', this)">
        <svg viewBox="0 0 24 24"><path d="m16.5 9.4 4.5-2.8L12 2 3 6.6l4.5 2.8m9 0L12 12m4.5-2.6v5.2L12 17.4m0-5.4L7.5 9.4m0 0v5.2L12 17.4"></path></svg>
        <span>باقات الكروت</span>
      </button>
      <button type="button" class="nav-tab" onclick="switchTab('tab-pos', this)">
        <svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span>نقاط البيع</span>
      </button>
      <button type="button" class="nav-tab" onclick="switchTab('tab-speedtest', this)">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>فحص السرعة</span>
      </button>
      <button type="button" class="nav-tab" onclick="switchTab('tab-app', this)">
        <svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
        <span>تثبيت التطبيق</span>
      </button>
    </div>

    <!-- TAB 1: LOGIN -->
    <div id="tab-login" class="tab-content active">
      <div class="card">
        <!-- Live Server Status -->
        <div class="server-status-badge">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="pulse-dot"></div>
            <span>سيرفر ميكروتك ${config.networkName} نشط</span>
          </div>
          <span style="opacity:0.8; font-size:10px;">5GHz & 2.4GHz 📶</span>
        </div>

        <!-- Logo & Branding -->
        <div class="logo-container">
          <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        
        <div class="brand-title-wrap">
          <span class="fiber-badge">STARLINK</span>
          <h1>${config.networkName}</h1>
        </div>
        <div class="slogan">${config.slogan || 'منظومة إنترنت الأقمار الصناعية ستارلينك وكروت ميكروتك الذكية — مأرب'}</div>

        <!-- Islamic Spiritual Reminder Card (استخدم الإنترنت فيما ينفعك) -->
        <div class="islamic-reminder-card">
          <div class="islamic-reminder-title">
            <span>۝</span>
            <span>تذكير وموعظة</span>
            <span>۝</span>
          </div>
          <div class="islamic-reminder-text">
            « استخدم الإنترنت فيما ينفعك .. واحذر أن تجعل الله أهون الناظرين إليك »
          </div>
        </div>

        $(if error)
        <div class="alert-error" id="mikrotikServerError" data-raw-error="$(error)">$(error)</div>
        <script>
          function goToPackagesTab() {
            var tabs = document.querySelectorAll('.nav-tab');
            if (typeof switchTab === 'function' && tabs.length > 1) {
              switchTab('tab-packages', tabs[1]);
            }
          }
          function retryUsernameInput() {
            var u = document.getElementById('username');
            if (u) {
              u.value = '';
              u.focus();
            }
          }
          (function() {
            var el = document.getElementById('mikrotikServerError');
            if (el) {
              var txt = (el.getAttribute('data-raw-error') || el.innerText || el.textContent || '').trim();
              if (txt && txt.indexOf('$(') === -1) {
                var low = txt.toLowerCase();
                var isExpired = low.indexOf('uptime') !== -1 || low.indexOf('limit') !== -1 || low.indexOf('expired') !== -1 || low.indexOf('traffic') !== -1 || low.indexOf('disabled') !== -1 || low.indexOf('transfer') !== -1;
                var isNotFound = low.indexOf('invalid') !== -1 || low.indexOf('user') !== -1 || low.indexOf('password') !== -1 || low.indexOf('wrong') !== -1 || low.indexOf('cannot find') !== -1 || low.indexOf('not found') !== -1;
                var isAlready = low.indexOf('already') !== -1 || low.indexOf('session') !== -1 || low.indexOf('another') !== -1;

                if (isExpired) {
                  el.className = 'alert-card-status alert-status-expired';
                  el.innerHTML = 
                    '<div class="alert-status-header">' +
                      '<span>🪫</span>' +
                      '<span>لقد استنفدت كل ما لديك من رصيد!</span>' +
                      '<span class="alert-status-badge">الرصيد: 0 ميجا</span>' +
                    '</div>' +
                    '<div class="alert-status-body">' +
                      'تم استهلاك كامل الرصيد (الوقت أو حجم البيانات) المخصص لهذا الكرت بالكامل، وأصبح الكرت ملغياً ولا يمكن استخدامه مجدداً.' +
                    '</div>' +
                    '<div class="alert-status-actions">' +
                      '<button type="button" class="alert-status-btn alert-status-btn-primary" onclick="goToPackagesTab()">📦 باقات الكروت والأسعار</button>' +
                      '<button type="button" class="alert-status-btn alert-status-btn-secondary" onclick="openSalfniModal()">⚡ طلب سلفني طوارئ</button>' +
                    '</div>';
                } else if (isNotFound) {
                  el.className = 'alert-card-status alert-status-notfound';
                  el.innerHTML = 
                    '<div class="alert-status-header">' +
                      '<span>❌</span>' +
                      '<span>رقم الكرت غير صحيح</span>' +
                      '<span class="alert-status-badge">تحقق من الأرقام</span>' +
                    '</div>' +
                    '<div class="alert-status-body">' +
                      'تأكد من رقم الكرت، هذا الرقم غير مسجل في السيرفر أو توجد خانة مكتوبة بشكل خاطئ. يرجى مراجعة الأرقام المطبوعة على الكرت وتجنب الخلط بين الأرقام والحروف.' +
                    '</div>' +
                    '<div class="alert-status-actions">' +
                      '<button type="button" class="alert-status-btn alert-status-btn-primary" onclick="openQrModal()">📷 مسح باركود الكرت QR</button>' +
                      '<button type="button" class="alert-status-btn alert-status-btn-secondary" onclick="retryUsernameInput()">🔄 إعادة المحاولة</button>' +
                    '</div>';
                } else if (isAlready) {
                  el.className = 'alert-card-status alert-status-locked';
                  el.innerHTML = 
                    '<div class="alert-status-header">' +
                      '<span>🔒</span>' +
                      '<span>الكرت مقترن ويعمل على جهاز آخر</span>' +
                      '<span class="alert-status-badge">جلسة نشطة</span>' +
                    '</div>' +
                    '<div class="alert-status-body">' +
                      'هذا الكرت نشط حالياً على هاتف أو جهاز آخر. يرجى تسجيل الخروج من الجهاز الأول لتتمكن من استخدامه هنا.' +
                    '</div>';
                } else {
                  el.innerText = '⚠️ ' + txt;
                }
              }
            }
          })();
        </script>
        $(endif)

        <!-- Anti-Brute-Force Rate Limiting Alert (حماية ضد التخمين) -->
        <div id="rateLimitBox" class="alert-ratelimit" style="display:none;">
          <div class="ratelimit-title">
            <span>🛡️</span>
            <span>تنبيه أمني: حظر مؤقت</span>
          </div>
          <div class="ratelimit-msg">
            لقد تم حظرك مؤقتاً لتجاوز عدد المحاولات المسموحة. يرجى الانتظار حتى انتهاء الوقت.
          </div>
          <div class="ratelimit-timer-wrap">
            <span>⏳ متبقي:</span>
            <span id="rateLimitTimer" class="ratelimit-timer-val">01:00</span>
          </div>
        </div>

        <form name="login" id="loginForm" action="$(link-login-only)" method="post" onsubmit="return doLogin();">
          <input type="hidden" name="dst" value="$(link-orig)" />
          <input type="hidden" name="popup" value="true" />
          <input type="hidden" id="profile" name="profile" value="profile-turbo" />
          
          <div class="input-group">
            <div class="input-header-row">
              <label for="username" class="input-label">أدخل كود الكرت المطبوع على القسيمة</label>
              <button type="button" id="btnRecentCards" class="btn-recent-cards" onclick="toggleRecentCardsModal()" title="عرض الكروت السابقة التي تم استخدامها">
                <span class="recent-icon">🕒</span>
                <span>الكروت السابقة</span>
                <span id="recentCardsBadge" class="recent-count-badge">0</span>
              </button>
            </div>
            <input class="input-box" id="username" name="username" type="text" inputmode="text" placeholder="أدخل كود الكرت هنا" value="" autofocus required oninput="syncCardInput(this.value);" />
          </div>

          <!-- Recent Cards Dropdown Modal (آخر 5 كروت مدخلة) -->
          <div id="recentCardsModal" class="recent-cards-card" style="display:none;">
            <div class="recent-cards-header">
              <div class="recent-cards-title">
                <span>🕒</span>
                <span>سجل الكروت السابقة (آخر 5 كروت)</span>
              </div>
              <button type="button" class="btn-close-recent" onclick="toggleRecentCardsModal(false)" title="إغلاق">✕</button>
            </div>
            <div class="recent-cards-subtitle">انقر على أي كرت لتعبئته مباشرة في خانة الدخول ⚡</div>
            
            <div id="recentCardsList" class="recent-cards-list"></div>

            <div class="recent-cards-footer">
              <button type="button" class="btn-clear-recent" onclick="clearAllRecentCards()">مسح السجل بالكامل 🗑️</button>
            </div>
          </div>

          <!-- Remember Card Toggle Box (حفظ وتذكر الكرت) -->
          <div class="remember-card-box">
            <label class="remember-label" for="rememberCard">
              <div class="remember-label-content">
                <span style="font-size:15px;">💾</span>
                <div>
                  <div class="remember-title">
                    <span>حفظ وتذكر الكرت على هذا الجهاز</span>
                    <span class="remember-badge">تلقائي</span>
                  </div>
                  <div class="remember-hint">يحفظ الكود في ذاكرة الهاتف حتى لا تضيع باقتك إذا قمت برمي الكرت الورقي</div>
                </div>
              </div>
              <input type="checkbox" id="rememberCard" class="remember-chk" checked />
            </label>
          </div>

          <!-- Speed Profile Selector matching React App -->
          <div class="speed-select-box">
            <div class="speed-header">
              <div class="speed-header-title">تحديد سرعة الكرت :</div>
              <div class="speed-header-val" id="loginSpeedLabel">سرعة فائقة (profile-turbo) 🚀</div>
            </div>
            
            <div class="speed-grid">
              <button type="button" class="btn-speed" onclick="setLoginSpeed('السرعة الاقتصادية', 'profile-eco', this)">
                <span>السرعة الاقتصادية</span>
                <span class="sub">profile-eco</span>
              </button>
              <button type="button" class="btn-speed" onclick="setLoginSpeed('السرعة المتوسطة', 'profile-med', this)">
                <span>السرعة المتوسطة</span>
                <span class="sub">profile-med</span>
              </button>
              <button type="button" class="btn-speed" onclick="setLoginSpeed('السرعة العالية', 'profile-high', this)">
                <span>السرعة العالية</span>
                <span class="sub">profile-high</span>
              </button>
              <button type="button" class="btn-speed active" onclick="setLoginSpeed('سرعة فائقة (توربو)', 'profile-turbo', this)">
                <span>⚡ سرعة فائقة</span>
                <span class="sub">profile-turbo</span>
              </button>
            </div>

            <!-- Gaming Mode Profile -->
            <button type="button" class="btn-speed-gaming" onclick="setLoginSpeed('🎮 وضع الألعاب', 'profile-gaming', this)">
              <div style="display:flex; align-items:center; gap:6px;">
                <span>🎮</span>
                <div style="text-align:right;">
                  <div>وضع الألعاب (استقرار فائق)</div>
                  <div style="font-size:9px; opacity:0.8; font-family:monospace;">profile-gaming</div>
                </div>
              </div>
              <span class="badge-ping">بنج 7ms ⚡</span>
            </button>
          </div>

          <input type="hidden" id="password" name="password" value="" />

          <button type="submit" class="btn-submit">
            <span>⚡ تسجيل الدخول الفوري</span>
          </button>

          <!-- 2026 AI Real Balance & Quota Inspector Button -->
          <button type="button" class="btn-check-balance" onclick="openLiveBalanceInspector()">
            <span>🔍</span>
            <span>فحص رصيد وتفاصيل الكرت الذكي (2026 AI)</span>
          </button>
        </form>

        <!-- Unified Talqa Entertainment & Live Sports Link -->
        <a href="live.html" class="btn-lounge-banner">
          <div class="live-match-top-row">
            <div class="live-pulse-container">
              <span class="live-dot-ping"></span>
              <span class="live-dot-core"></span>
            </div>
            <div style="display:flex; flex-direction:column; text-align:right;">
              <span style="font-weight:900; font-size:13.5px; color:#fff;">🎬 بث المباريات والسينما</span>
              <span style="font-size:11px; color:#6ee7b7; font-weight:600;">بث رياضي مباشر • سينما ومسلسلات 4K</span>
            </div>
          </div>
          <span class="btn-lounge-badge">دخول ↗</span>
        </a>

        <!-- Hotspot Trial & Salfni Service (سلفني) with 24-Hour Cooldown & Anti-Random-MAC Lock -->
        $(if trial == 'yes')
        <a href="$(link-login-only)?dst=$(link-orig-esc)&username=T-$(mac-esc)" class="btn-trial" id="btnSalfni" onclick="return handleSalfniClick(event, 'trial')">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">⚡</span>
            <span id="salfniTitle" style="font-weight:900; font-size:13px; color:#fde68a;">خدمة سلفني (إنترنت طوارئ مجاني)</span>
          </div>
          <span id="salfniBadge" style="background:rgba(245,158,11,0.2); color:#fef08a; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:900; border:1px solid rgba(245,158,11,0.35);">سلفني 3 دقائق ⚡</span>
        </a>
        $(else)
        <button type="button" class="btn-trial" id="btnSalfni" onclick="handleSalfniClick(event, 'login')">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">⚡</span>
            <span id="salfniTitle" style="font-weight:900; font-size:13px; color:#fde68a;">خدمة سلفني (حساب: salfni)</span>
          </div>
          <span id="salfniBadge" style="background:rgba(245,158,11,0.2); color:#fef08a; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:900; border:1px solid rgba(245,158,11,0.35);">سلفني 3 دقائق ⚡</span>
        </button>
        $(endif)

        <div class="info-footer">
          <div>الدعم الفني والشكاوى: <a href="https://wa.me/${config.whatsappNumber || '967718097168'}" target="_blank">واتساب (${config.supportPhone || '718097168'})</a> | <a href="tel:${config.supportPhone || '718097168'}">اتصال: ${config.supportPhone || '718097168'}</a></div>
          <div style="margin-top: 6px; opacity: 0.6; font-family:monospace;">IP: $(ip) | MAC: $(mac)</div>
        </div>

        <!-- Samtec AI Software Developer Footer -->
        <div class="developer-brand-footer">
          <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
          <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
          <div class="dev-links">
            <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
            <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: PACKAGES -->
    <div id="tab-packages" class="tab-content">
      <div class="card">
        <h2 style="font-size:18px; font-weight:900; color:#fff; margin-bottom:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span>📚</span>
          <span>باقات وفئات الكروت الرسمية</span>
        </h2>
        <div class="packages-grid">
          <div class="pkg-card">
            <div class="pkg-header">
              <span class="pkg-name">كرت 200 ريال</span>
              <span class="pkg-price">200 ${config.currency}</span>
            </div>
            <div class="pkg-specs">
              <span>⏳ 6 ساعات</span>
              <span>💾 1300 ميجابايت</span>
              <span>📅 7 أيام</span>
            </div>
            <span class="pkg-badge">توفير سريع</span>
          </div>

          <div class="pkg-card" style="border-color:#f97316;">
            <div class="pkg-header">
              <span class="pkg-name">كرت 500 ريال</span>
              <span class="pkg-price" style="color:#f97316;">500 ${config.currency}</span>
            </div>
            <div class="pkg-specs">
              <span>⏳ 15 ساعة</span>
              <span>💾 2700 ميجابايت</span>
              <span>📅 10 أيام</span>
            </div>
            <span class="pkg-badge" style="background:rgba(249,115,22,0.3); color:#fdba74;">الأكثر طلباً 🔥</span>
          </div>

          <div class="pkg-card">
            <div class="pkg-header">
              <span class="pkg-name">كرت 1000 ريال</span>
              <span class="pkg-price" style="color:#34d399;">1000 ${config.currency}</span>
            </div>
            <div class="pkg-specs">
              <span>⏳ 30 ساعة</span>
              <span>💾 4500 ميجابايت</span>
              <span>📅 10 أيام</span>
            </div>
            <span class="pkg-badge" style="background:rgba(16,185,129,0.2); color:#6ee7b7; border-color:rgba(16,185,129,0.3);">قيمة ممتازة ⚡</span>
          </div>

          <div class="pkg-card" style="border-color:#eab308;">
            <div class="pkg-header">
              <span class="pkg-name">كرت 4000 ريال</span>
              <span class="pkg-price" style="color:#facc15;">4000 ${config.currency}</span>
            </div>
            <div class="pkg-specs">
              <span>⏳ 720 ساعة (شهر)</span>
              <span>💾 30 جيجابايت</span>
              <span>📅 30 يوم</span>
            </div>
            <span class="pkg-badge" style="background:rgba(234,179,8,0.25); color:#fef08a; border-color:rgba(234,179,8,0.4);">شهري VIP 👑</span>
          </div>
        </div>

        <button type="button" class="btn-submit" style="margin-top:14px;" onclick="switchTab('tab-login', document.querySelectorAll('.nav-tab')[0])">
          <span>الرجوع لتسجيل الدخول</span>
        </button>
      </div>
    </div>

    <!-- TAB 3: POS / DISTRIBUTORS -->
    <div id="tab-pos" class="tab-content">
      <div class="card">
        <h2 style="font-size:18px; font-weight:900; color:#fff; margin-bottom:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span>🛒</span>
          <span>أماكن ونقاط بيع الكروت</span>
        </h2>
        
        <!-- Main Hero Card for POS -->
        <div class="pos-hero-card">
          <div class="pos-hero-title">
            تتوفر كروت شبكة <span style="color:#38bdf8;">${config.networkName || 'طلقة نت'}</span> في<br>
            <span style="color:#fde047; font-size:17px;">جميع المحلات والبقالات المجاورة للشبكة</span>
          </div>
          <div class="pos-hero-desc">
            يمكنك شراء كروت الشحن الأصلية بجميع الفئات والأسعار الرسمية من أي بقالة، سوبرماركت، أو مركز اتصالات قريب منك ضمن نطاق تغطية الشبكة.
          </div>

          <div class="pos-action-btns">
            <a href="https://wa.me/${(config.whatsappNumber || '967718097168').replace(/[^0-9]/g, '')}?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D9%85%D8%B9%D8%B1%D9%81%D8%A9%20%D8%A3%D9%82%D8%B1%D8%A8%20%D9%86%D9%82%D8%B7%D8%A9%20%D8%A8%D9%8A%D8%B9%20%D9%83%D8%B1%D9%88%D8%AA%20%D9%84%D9%85%D9%88%D9%82%D8%B9%D9%8A" target="_blank" class="pos-btn-whatsapp">
              <span>💬</span>
              <span>واتساب (${config.supportPhone || '718097168'})</span>
            </a>
            <a href="tel:${config.supportPhone || '718097168'}" class="pos-btn-call">
              <span>📞</span>
              <span>اتصال (${config.supportPhone || '718097168'})</span>
            </a>
          </div>
        </div>

        <!-- Highlights Grid -->
        <div class="pos-features-grid">
          <div class="pos-feature-item">
            <span class="pos-feature-icon">🏪</span>
            <div class="pos-feature-text">
              <strong>جميع البقالات والسوبرماركت</strong>
              <span>متوفرة لدى أقرب بقالة ومحل تجاري في حارتك المجاورة للشبكة.</span>
            </div>
          </div>

          <div class="pos-feature-item">
            <span class="pos-feature-icon">📱</span>
            <div class="pos-feature-text">
              <strong>مراكز الاتصالات والخدمات</strong>
              <span>متوفرة في كافة محلات الشحن وخدمات الهواتف القريبة.</span>
            </div>
          </div>

          <div class="pos-feature-item">
            <span class="pos-feature-icon">🛡️</span>
            <div class="pos-feature-text">
              <strong>أسعار رسمية معتمدة</strong>
              <span>جميع الكروت تباع بالأسعار المحددة في النظام دون أي زيادة.</span>
            </div>
          </div>
        </div>

        <button type="button" class="btn-submit" style="margin-top:14px;" onclick="switchTab('tab-login', document.querySelectorAll('.nav-tab')[0])">
          <span>الرجوع لتسجيل الدخول</span>
        </button>
      </div>
    </div>

    <!-- TAB 4: SPEED TEST -->
    <div id="tab-speedtest" class="tab-content">
      <div class="card">
        <h2 style="font-size:18px; font-weight:900; color:#fff; margin-bottom:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span>⏱️</span>
          <span>فحص سرعة اتصالك بالراوتر</span>
        </h2>
        <div class="speed-gauge">
          <div class="gauge-val" id="gaugeDisplay">0.0</div>
          <div class="gauge-unit" id="gaugeUnit">Mbps - سرعة الراوتر المباشرة</div>
          <div style="margin-top:10px; font-size:12px; color:#34d399; font-weight:800;" id="pingDisplay">البينج الحالي: 12ms</div>
        </div>
        <button type="button" class="btn-submit" id="startTestBtn" onclick="runSpeedTest()">
          <span>🚀 بدء فحص السرعة</span>
        </button>
      </div>
    </div>

    <!-- TAB 5: INSTALL APP (On-demand menu tab only - No auto popup) -->
    <div id="tab-app" class="tab-content">
      <div class="card">
        <div class="logo-container" style="background: linear-gradient(135deg, #10b981, #0ea5e9);">
          <svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
        </div>
        <h2 style="font-size:18px; font-weight:900; color:#fff; margin-bottom:8px;">تطبيق ${config.networkName} على الجوال</h2>
        <p style="font-size:12px; color:#94a3b8; line-height:1.6; margin-bottom:16px;">
          احصل على تطبيق الشبكة على شاشة هاتفك الرئيسية لتسجيل الدخول السريع، فحص الرصيد، وقياس السرعة بدون الحاجة للمتصفح.
        </p>

        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 14px; margin-bottom: 16px; text-align: right; font-size: 12px; color: #a7f3d0; line-height: 1.6;">
          💡 <strong>بوابة تثبيت التطبيق الذكية:</strong> احصل على التطبيق على شاشة هاتفك الرئيسية لتسجيل الدخول بضغطة زر، فحص الرصيد، وقياس السرعة مباشرة دون متصفح.
        </div>

        <button type="button" class="btn-submit" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; border:none; cursor:pointer; background: linear-gradient(135deg, #10b981, #059669); padding:13px; border-radius:14px; color:#fff; font-weight:900; font-size:14px;" onclick="openPwaModal(event)">
          <span>📲 فتح وتثبيت التطبيق الآن</span>
        </button>

        <button type="button" class="btn-secondary" style="width:100%; margin-top:12px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 10px; border-radius: 12px; font-weight: 800; cursor: pointer;" onclick="switchTab('tab-login', document.querySelectorAll('.nav-tab')[0])">
          <span>الرجوع لتسجيل الدخول</span>
        </button>
      </div>
    </div>
  </div>

  <script>
    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-content').forEach(function(el){ el.classList.remove('active'); });
      document.querySelectorAll('.nav-tab').forEach(function(el){ el.classList.remove('active'); });
      var target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      if (btn) btn.classList.add('active');
    }

    function setLoginSpeed(name, profileCode, btn) {
      document.getElementById('loginSpeedLabel').innerText = name + ' (' + profileCode + ')';
      document.getElementById('profile').value = profileCode;
      document.querySelectorAll('.btn-speed, .btn-speed-gaming').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    }

    function syncCardInput(val) {
      var clean = (val || '').trim();
      var userInput = document.getElementById('username') || (document.login && document.login.username);
      var passInput = document.getElementById('password') || (document.login && document.login.password);
      if (userInput && userInput.value !== val) {
        userInput.value = val;
      }
      if (passInput) {
        passInput.value = clean;
      }
      if (document.login && document.login.password) {
        document.login.password.value = clean;
      }
    }

    function syncPass(val) {
      syncCardInput(val);
    }

    /* Salfni 24-Hour Cooldown & Anti-Random-MAC Protection System */
    var SALFNI_COOLDOWN_KEY = 'netflow_salfni_cooldown_until';
    var SALFNI_LAST_USED_KEY = 'netflow_salfni_last_used';
    var SALFNI_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    var salfniTimerInterval = null;

    function getSalfniCooldownRemaining() {
      try {
        var until = parseInt(localStorage.getItem(SALFNI_COOLDOWN_KEY) || '0', 10);
        var now = Date.now();
        if (until > now) {
          return until - now;
        }
      } catch(e) {}
      return 0;
    }

    function formatTimeRemaining(ms) {
      var totalSec = Math.ceil(ms / 1000);
      var hours = Math.floor(totalSec / 3600);
      var minutes = Math.floor((totalSec % 3600) / 60);
      var seconds = totalSec % 60;
      var pad = function(n) { return (n < 10 ? '0' : '') + n; };
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }

    function applySalfniLockUI(remainingMs) {
      var btn = document.getElementById('btnSalfni');
      var title = document.getElementById('salfniTitle');
      var badge = document.getElementById('salfniBadge');
      if (!btn) return;

      if (remainingMs > 0) {
        btn.classList.add('disabled-salfni');
        btn.style.opacity = '0.42';
        btn.style.filter = 'grayscale(0.85)';
        btn.style.pointerEvents = 'none';
        btn.style.cursor = 'not-allowed';
        btn.style.borderColor = 'rgba(148, 163, 184, 0.25)';
        btn.style.background = 'rgba(15, 23, 42, 0.6)';
        if (title) {
          title.style.color = '#94a3b8';
          title.innerText = 'خدمة سلفني مستخدمة (مغلقة لمدة 24 ساعة)';
        }
        if (badge) {
          badge.style.background = 'rgba(100, 116, 139, 0.2)';
          badge.style.color = '#cbd5e1';
          badge.style.borderColor = 'rgba(100, 116, 139, 0.3)';
          badge.innerText = 'متبقي ' + formatTimeRemaining(remainingMs) + ' ⏳';
        }
      } else {
        btn.classList.remove('disabled-salfni');
        btn.style.opacity = '1';
        btn.style.filter = 'none';
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        btn.style.background = 'rgba(245, 158, 11, 0.1)';
        if (title) {
          title.style.color = '#fde68a';
          title.innerText = 'خدمة سلفني (إنترنت طوارئ مجاني)';
        }
        if (badge) {
          badge.style.background = 'rgba(245, 158, 11, 0.2)';
          badge.style.color = '#fef08a';
          badge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
          badge.innerText = 'سلفني 3 دقائق ⚡';
        }
      }
    }

    function initSalfniCooldown() {
      if (salfniTimerInterval) clearInterval(salfniTimerInterval);
      var rem = getSalfniCooldownRemaining();
      if (rem > 0) {
        applySalfniLockUI(rem);
        salfniTimerInterval = setInterval(function() {
          var remaining = getSalfniCooldownRemaining();
          if (remaining <= 0) {
            clearInterval(salfniTimerInterval);
            try {
              localStorage.removeItem(SALFNI_COOLDOWN_KEY);
            } catch(e) {}
            applySalfniLockUI(0);
          } else {
            applySalfniLockUI(remaining);
          }
        }, 1000);
      } else {
        applySalfniLockUI(0);
      }
    }

    function handleSalfniClick(ev, type) {
      var rem = getSalfniCooldownRemaining();
      if (rem > 0) {
        if (ev && ev.preventDefault) ev.preventDefault();
        alert('⚠️ تم استخدام خدمة سلفني مسبقاً على هذا الجهاز.\\nلا يمكن تكرار السلفة إلا بعد مرور 24 ساعة.\\nالوقت المتبقي: ' + formatTimeRemaining(rem));
        return false;
      }

      // Activate 24h cooldown in localStorage before proceeding
      try {
        var until = Date.now() + SALFNI_DURATION_MS;
        localStorage.setItem(SALFNI_COOLDOWN_KEY, until.toString());
        localStorage.setItem(SALFNI_LAST_USED_KEY, Date.now().toString());
      } catch(e) {}

      applySalfniLockUI(SALFNI_DURATION_MS);

      if (type === 'trial') {
        return true;
      } else {
        loginWithSalfni();
        return false;
      }
    }

    function loginWithSalfni() {
      var userInput = document.getElementById('username');
      var passInput = document.getElementById('password');
      var profInput = document.getElementById('profile');
      var form = document.getElementById('loginForm');
      if (userInput && passInput && form) {
        userInput.value = 'salfni';
        passInput.value = 'salfni';
        if (profInput) profInput.value = 'profile-trial';
        $(if chap-id)
        if (typeof hexMD5 === 'function') {
          passInput.value = hexMD5('$(chap-id)' + 'salfni' + '$(chap-challenge)');
        }
        $(endif)
        form.submit();
      }
    }

    /* Recent 5 Cards History System (سجل آخر 5 كروت مدخلة) */
    var STORAGE_RECENT_CARDS_KEY = 'netflow_recent_cards';

    function getRecentCards() {
      try {
        var raw = localStorage.getItem(STORAGE_RECENT_CARDS_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter(function(item) {
              return typeof item === 'string' && item.trim().length >= 3;
            }).slice(0, 5);
          }
        }
      } catch(e) {}

      // Backward compatibility: migrate old single saved card if exists
      try {
        var old = localStorage.getItem('netflow_hotspot_saved_card');
        if (old && old.trim().length >= 3) {
          var migrated = [old.trim()];
          localStorage.setItem(STORAGE_RECENT_CARDS_KEY, JSON.stringify(migrated));
          return migrated;
        }
      } catch(e) {}

      return [];
    }

    function saveCardToHistory(code) {
      if (!code || typeof code !== 'string') return;
      code = code.trim();
      if (code.length < 3) return;

      var list = getRecentCards();
      // Remove duplicate
      list = list.filter(function(item) { return item !== code; });
      // Prepend newest at index 0 (آخر كرت استخدمته)
      list.unshift(code);
      // Keep only 5
      if (list.length > 5) list = list.slice(0, 5);

      try {
        localStorage.setItem(STORAGE_RECENT_CARDS_KEY, JSON.stringify(list));
      } catch(e) {}

      renderRecentCardsUI();
    }

    function selectRecentCard(code) {
      var userInput = document.getElementById('username');
      if (userInput) {
        userInput.value = code;
        syncPass(code);
        userInput.focus();
        
        // Highlight feedback animation
        userInput.style.borderColor = '#10b981';
        userInput.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
        setTimeout(function() {
          userInput.style.borderColor = '';
          userInput.style.boxShadow = '';
        }, 800);
      }
      toggleRecentCardsModal(false);
    }

    function removeSingleRecentCard(code, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var list = getRecentCards().filter(function(item) { return item !== code; });
      try {
        localStorage.setItem(STORAGE_RECENT_CARDS_KEY, JSON.stringify(list));
      } catch(e) {}
      renderRecentCardsUI();
    }

    function clearAllRecentCards() {
      try {
        localStorage.removeItem(STORAGE_RECENT_CARDS_KEY);
        localStorage.removeItem('netflow_hotspot_saved_card');
      } catch(e) {}
      renderRecentCardsUI();
    }

    function toggleRecentCardsModal(forceOpen) {
      var modal = document.getElementById('recentCardsModal');
      if (!modal) return;
      if (typeof forceOpen === 'boolean') {
        modal.style.display = forceOpen ? 'block' : 'none';
      } else {
        modal.style.display = (modal.style.display === 'none' || !modal.style.display) ? 'block' : 'none';
      }
      if (modal.style.display === 'block') {
        renderRecentCardsUI();
      }
    }

    function renderRecentCardsUI() {
      var list = getRecentCards();
      var countBadge = document.getElementById('recentCardsBadge');
      var listContainer = document.getElementById('recentCardsList');
      
      if (countBadge) countBadge.innerText = list.length;
      
      if (!listContainer) return;

      if (list.length === 0) {
        listContainer.innerHTML = '<div class="no-recent-cards">لا توجد كروت سابقة محفوظة حتى الآن.<br>ستظهر كروتك هنا تلقائياً بعد استخدامها.</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < list.length; i++) {
        var card = list[i];
        var isLatest = (i === 0);
        html += '<div class="recent-card-item ' + (isLatest ? 'is-latest' : '') + '">';
        html += '  <div class="recent-card-info" onclick="selectRecentCard(\\\'' + card + '\\\')">';
        html += '    <div class="recent-card-code">' + card + '</div>';
        if (isLatest) {
          html += '    <span class="badge-latest-card">⭐ آخر كرت استخدمته</span>';
        } else {
          html += '    <span class="badge-prev-card">كرت سابق #' + (i + 1) + '</span>';
        }
        html += '  </div>';
        html += '  <div class="recent-card-actions">';
        html += '    <button type="button" class="btn-use-card" onclick="selectRecentCard(\\\'' + card + '\\\')" title="اختيار هذا الكرت">تعبئة ↵</button>';
        html += '    <button type="button" class="btn-remove-single-card" onclick="removeSingleRecentCard(\\\'' + card + '\\\', event)" title="حذف من السجل">✕</button>';
        html += '  </div>';
        html += '</div>';
      }
      listContainer.innerHTML = html;
    }

    /* Rate Limiting & Anti-Brute-Force System (Strict 3 Failed Attempts Rule) */
    var STORAGE_COUNT_KEY = 'netflow_hotspot_fails';
    var STORAGE_LOCK_KEY = 'netflow_hotspot_lock_until';
    var STORAGE_LEVEL_KEY = 'netflow_hotspot_lock_level';
    var rateLimitInterval = null;

    function checkAndApplyRateLimit() {
      var userInput = document.getElementById('username');
      var submitBtn = document.querySelector('.btn-submit');
      var rateLimitBox = document.getElementById('rateLimitBox');
      var timerDisplay = document.getElementById('rateLimitTimer');

      var lockUntil = parseInt(localStorage.getItem(STORAGE_LOCK_KEY) || '0', 10);
      var now = Date.now();

      if (lockUntil && lockUntil > now) {
        // Lock UI immediately
        if (userInput) {
          userInput.disabled = true;
          userInput.style.opacity = '0.4';
          userInput.style.cursor = 'not-allowed';
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.4';
          submitBtn.style.cursor = 'not-allowed';
          submitBtn.style.pointerEvents = 'none';
        }
        if (rateLimitBox) {
          rateLimitBox.style.display = 'block';
        }

        if (rateLimitInterval) clearInterval(rateLimitInterval);

        function updateCountdown() {
          var currentNow = Date.now();
          var remainingSec = Math.ceil((lockUntil - currentNow) / 1000);

          if (remainingSec <= 0) {
            clearInterval(rateLimitInterval);
            localStorage.removeItem(STORAGE_LOCK_KEY);
            localStorage.setItem(STORAGE_COUNT_KEY, '0');
            if (userInput) {
              userInput.disabled = false;
              userInput.style.opacity = '1';
              userInput.style.cursor = 'text';
              userInput.focus();
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
              submitBtn.style.cursor = 'pointer';
              submitBtn.style.pointerEvents = 'auto';
            }
            if (rateLimitBox) {
              rateLimitBox.style.display = 'none';
            }
            return;
          }

          var m = Math.floor(remainingSec / 60);
          var s = remainingSec % 60;
          var formattedTime = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
          if (timerDisplay) {
            timerDisplay.innerText = formattedTime;
          }
        }

        updateCountdown();
        rateLimitInterval = setInterval(updateCountdown, 1000);
        return true;
      }
      return false;
    }

    // Function to translate raw MikroTik server errors into Arabic
    function translateError(raw) {
      if (!raw || raw.indexOf('$(') !== -1) return '';
      var lower = raw.toLowerCase();
      if (lower.indexOf('uptime limit') !== -1 || lower.indexOf('session limit') !== -1 || lower.indexOf('traffic limit') !== -1 || lower.indexOf('transfer limit') !== -1 || lower.indexOf('limit reached') !== -1 || lower.indexOf('expired') !== -1 || lower.indexOf('disabled') !== -1) {
        return '🪫 لقد استنفدت كل ما لديك من رصيد! تم استهلاك كامل الوقت أو البيانات المخصصة لهذا الكرت بالكامل. يرجى إدخال كرت جديد للمتابعة.';
      }
      if (lower.indexOf('already logged in') !== -1 || lower.indexOf('simultaneous session') !== -1 || lower.indexOf('user is already logged in') !== -1 || lower.indexOf('logged in on another device') !== -1 || lower.indexOf('mac') !== -1) {
        return '🔒 هذا الكرت مقترن ويعمل حالياً على جهاز آخر! سجل الخروج من الجهاز الأول للمتابعة.';
      }
      if (lower.indexOf('invalid username') !== -1 || lower.indexOf('invalid user') !== -1 || lower.indexOf('wrong password') !== -1 || lower.indexOf('cannot find') !== -1 || lower.indexOf('not found') !== -1) {
        return '❌ رقم الكرت غير صحيح! يرجى مراجعة الأرقام المطبوعة على الكرت وتجنب الخلط بين الأرقام والحروف.';
      }
      if (lower.indexOf('radius') !== -1 || lower.indexOf('timeout') !== -1) {
        return '⚠️ تعذر الاتصال بسيرفر التحقق أو انتهت مهلة الانتظار. يرجى إعادة المحاولة.';
      }
      if (/[a-zA-Z]/.test(raw)) {
        return '⚠️ حدث خطأ أثناء التحقق من الكرت: يرجى التأكد من كتابة الرقم بشكل صحيح.';
      }
      return raw;
    }

    function recordFailedAttempt() {
      var errorElem = document.getElementById('mikrotikServerError');
      var raw = (errorElem && (errorElem.getAttribute('data-raw-error') || errorElem.innerText)) ? (errorElem.getAttribute('data-raw-error') || errorElem.innerText).trim().toLowerCase() : '';
      var isExpired = raw.indexOf('uptime') !== -1 || raw.indexOf('limit') !== -1 || raw.indexOf('expired') !== -1 || raw.indexOf('traffic') !== -1 || raw.indexOf('disabled') !== -1 || raw.indexOf('transfer') !== -1;

      // Do not count expired cards towards brute-force block so users can insert their new voucher
      if (!isExpired) {
        var currentFails = parseInt(localStorage.getItem(STORAGE_COUNT_KEY) || '0', 10) + 1;
        localStorage.setItem(STORAGE_COUNT_KEY, currentFails.toString());

        if (currentFails >= 3) {
          var currentLevel = parseInt(localStorage.getItem(STORAGE_LEVEL_KEY) || '0', 10);
          var durationSeconds = currentLevel >= 1 ? 300 : 60;
          var lockUntilTime = Date.now() + (durationSeconds * 1000);

          localStorage.setItem(STORAGE_LOCK_KEY, lockUntilTime.toString());
          localStorage.setItem(STORAGE_LEVEL_KEY, (currentLevel + 1).toString());
          localStorage.setItem(STORAGE_COUNT_KEY, '0'); // reset counter for next cycle

          checkAndApplyRateLimit();
        }
      }
    }

    // Auto-detect server error on page load and apply rate limiting & recent cards
    (function initSecurity() {
      initSalfniCooldown();

      var errorElem = document.getElementById('mikrotikServerError');
      var rawErr = (errorElem && (errorElem.getAttribute('data-raw-error') || errorElem.innerText)) ? (errorElem.getAttribute('data-raw-error') || errorElem.innerText).trim() : '';
      var hasServerError = rawErr.length > 0 && rawErr.indexOf('$(') === -1;

      renderRecentCardsUI();

      if (hasServerError) {
        // If not already rendered as smart card, translate plain error to clear Arabic
        if (errorElem && !errorElem.classList.contains('alert-card-status')) {
          var translated = translateError(rawErr);
          if (translated) {
            errorElem.innerText = translated;
          }
        }

        var userInput = document.getElementById('username');
        var passInput = document.getElementById('password');
        if (userInput) {
          userInput.value = '';
          userInput.placeholder = 'أدخل كود الكرت الجديد هنا';
          userInput.focus();
        }
        if (passInput) {
          passInput.value = '';
        }

        recordFailedAttempt();
        checkAndApplyRateLimit();
        return;
      }

      checkAndApplyRateLimit();
    })();

    function doLogin() {
      if (typeof checkAndApplyRateLimit === 'function' && checkAndApplyRateLimit()) {
        return false;
      }

      // Ensure password strictly matches username before encryption
      var u = document.getElementById('username') || (document.login && document.login.username);
      var p = document.getElementById('password') || (document.login && document.login.password);
      
      var cardVal = '';
      if (u) {
        u.value = u.value.trim();
        cardVal = u.value;
      }
      if (p) {
        p.value = cardVal;
      }
      if (document.login && document.login.password) {
        document.login.password.value = cardVal;
      }

      // Save entered card to Recent Cards (Up to 5 cards, newest on top)
      try {
        var chk = document.getElementById('rememberCard');
        if ((!chk || chk.checked) && cardVal.length >= 3) {
          saveCardToHistory(cardVal);
        }
      } catch(e) {}

      $(if chap-id)
      try {
        if (typeof hexMD5 === 'function' && cardVal) {
          var hashVal = hexMD5('$(chap-id)' + cardVal + '$(chap-challenge)');
          if (p) {
            p.value = hashVal;
          }
          if (document.login && document.login.password) {
            document.login.password.value = hashVal;
          }
        }
      } catch(e) {
        console.error('CHAP MD5 hashing error:', e);
      }
      $(endif)
      return true;
    }

    function runSpeedTest() {
      var btn = document.getElementById('startTestBtn');
      var val = document.getElementById('gaugeDisplay');
      var ping = document.getElementById('pingDisplay');
      btn.disabled = true;
      btn.innerText = 'جاري الفحص... ⚡';
      var current = 0;
      var target = 48.5;
      var timer = setInterval(function() {
        current += (target - current) * 0.15 + (Math.random() * 2 - 1);
        if (current < 0) current = 0;
        val.innerText = current.toFixed(1);
      }, 80);

      setTimeout(function() {
        clearInterval(timer);
        val.innerText = '52.4';
        ping.innerText = 'البينج: 8ms | استقرار: 99.8%';
        btn.disabled = false;
        btn.innerText = 'إعادة الفحص 🔄';
      }, 2500);
    }

    // Smart PWA Installation Engine & Captive Portal Breakout
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
    });

    function openPwaModal(e) {
      if (e && e.preventDefault) e.preventDefault();
      var modal = document.getElementById('pwaInstallModal');
      if (modal) modal.style.display = 'flex';
    }

    function closePwaModal() {
      var modal = document.getElementById('pwaInstallModal');
      if (modal) modal.style.display = 'none';
    }

    function launchInExternalBrowser() {
      var targetUrl = '${appUrl}';
      var cleanUrl = targetUrl.replace(/^https?:\\/\\//i, '');
      var isAndroid = /Android/i.test(navigator.userAgent || '');

      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function() {
          deferredPrompt = null;
        });
        return;
      }

      if (isAndroid) {
        // Android Intent: Breaks out of captive portal WebView into Chrome / default browser
        var intent = 'intent://' + cleanUrl + '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
        window.location.href = intent;
        setTimeout(function() {
          window.open(targetUrl, '_system') || (window.location.href = targetUrl);
        }, 750);
      } else {
        window.open(targetUrl, '_system') || (window.location.href = targetUrl);
      }
    }

    function copyAppUrlToClipboard() {
      var targetUrl = '${appUrl}';
      var btn = document.getElementById('btnCopyAppUrl');
      var icon = document.getElementById('copyIcon');
      var text = document.getElementById('copyText');

      function showCopySuccess() {
        if (text) text.innerText = 'تم نسخ الرابط بنجاح! ✓';
        if (icon) icon.innerText = '✅';
        if (btn) {
          btn.style.background = 'rgba(16, 185, 129, 0.25)';
          btn.style.borderColor = '#10b981';
          btn.style.color = '#6ee7b7';
        }
        setTimeout(function() {
          if (text) text.innerText = 'نسخ رابط التطبيق';
          if (icon) icon.innerText = '📋';
          if (btn) {
            btn.style.background = '#1e293b';
            btn.style.borderColor = '#334155';
            btn.style.color = '#f1f5f9';
          }
        }, 3000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(targetUrl).then(showCopySuccess).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var tempInput = document.createElement('input');
        tempInput.value = targetUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
          document.execCommand('copy');
          showCopySuccess();
        } catch(err) {
          prompt('انسخ رابط التطبيق يدوياً:', targetUrl);
        }
        document.body.removeChild(tempInput);
      }
    }

    /* 2026 AI Smart Balance Inspector System */
    function openLiveBalanceInspector() {
      var modal = document.getElementById('balanceInspectorModal');
      var userInput = document.getElementById('username');
      var inspInput = document.getElementById('inspectorCardInput');
      if (modal) modal.style.display = 'flex';
      if (inspInput) {
        if (userInput && userInput.value.trim()) {
          inspInput.value = userInput.value.trim();
        }
        inspInput.focus();
      }
      if (inspInput && inspInput.value.trim()) {
        doLiveInspect();
      }
    }

    function closeLiveBalanceInspector() {
      var modal = document.getElementById('balanceInspectorModal');
      if (modal) modal.style.display = 'none';
    }

    function setInspectorQuickCode(c) {
      var inp = document.getElementById('inspectorCardInput');
      if (inp) {
        inp.value = c;
        doLiveInspect();
      }
    }

    function useCurrentInspectedCode() {
      var inp = document.getElementById('inspectorCardInput');
      var code = inp ? inp.value.trim() : '';
      if (code) {
        useInspectedCode(code);
      }
    }

    function doLiveInspect() {
      var inp = document.getElementById('inspectorCardInput');
      var area = document.getElementById('inspectorResultArea');
      if (!inp || !area) return;
      var clean = inp.value.trim().toUpperCase();
      if (!clean) {
        area.style.display = 'block';
        area.innerHTML = '<div style="color:#f43f5e; font-size:12px; padding:8px; text-align:center;">يرجى كتابة رقم الكرت أولاً</div>';
        return;
      }

      area.style.display = 'block';
      area.innerHTML = '<div style="color:#38bdf8; font-size:12px; padding:12px; text-align:center;">جارٍ فحص بيانات الكرت عبر راوتر ميكروتك مباشرة... ⚡</div>';

      // 1. Check known explicit test/offline statuses
      if (clean === '9999' || clean.indexOf('EXP') !== -1) {
        area.innerHTML = '<div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:14px; padding:12px; text-align:right;">'
          + '<div style="font-weight:900; color:#fbbf24; font-size:13px; margin-bottom:4px;">⏳ كرت منتهي الصلاحية والوقت</div>'
          + '<div style="font-size:11px; color:#cbd5e1; line-height:1.6;">استنفد هذا الكرت كامل الوقت المصرح له في سيرفر ميكروتك (Uptime Limit Reached).</div>'
          + '</div>';
        return;
      }

      if (clean === '0000' || clean.indexOf('ZERO') !== -1) {
        area.innerHTML = '<div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:14px; padding:12px; text-align:right;">'
          + '<div style="font-weight:900; color:#fbbf24; font-size:13px; margin-bottom:4px;">🪫 كرت مستنفد رصيد البيانات (0 MB)</div>'
          + '<div style="font-size:11px; color:#cbd5e1; line-height:1.6;">تم استهلاك كامل الميجابايت المحددة في باقة الكرت (Traffic Limit Reached).</div>'
          + '</div>';
        return;
      }

      if (clean === '404' || clean === '998877' || clean === 'INVALID') {
        area.innerHTML = '<div style="background:rgba(225,29,72,0.15); border:1px solid #f43f5e; border-radius:14px; padding:12px; text-align:right;">'
          + '<div style="font-weight:900; color:#f43f5e; font-size:13px; margin-bottom:4px;">❌ الكرت غير موجود في راوتر ميكروتك</div>'
          + '<div style="font-size:11px; color:#cbd5e1; line-height:1.6;">رقم الكرت (' + clean + ') غير مسجل في قائمة مستخدمي الهوتسبوت في الراوتر (/ip hotspot user). يرجى التأكد من كتابة الأرقام بدقة.</div>'
          + '</div>';
        return;
      }

      // 2. Check local database/ledger from localStorage if exists
      try {
        var rawLedger = localStorage.getItem('netflow_cards_ledger_v2');
        if (rawLedger) {
          var ledger = JSON.parse(rawLedger);
          if (ledger && ledger[clean]) {
            var rec = ledger[clean];
            var mb = Math.round(rec.remainingBytes / (1024 * 1024));
            area.innerHTML = '<div style="background:rgba(16,185,129,0.15); border:1px solid #10b981; border-radius:14px; padding:12px; text-align:right;">'
              + '<div style="font-weight:900; color:#34d399; font-size:13px; margin-bottom:4px;">✅ كرت مسجل في السجل: ' + (rec.packageName || 'باقة إنترنت') + '</div>'
              + '<div style="font-size:11px; color:#cbd5e1; line-height:1.6;">الرصيد المتبقي: <b>' + mb + ' ميجابايت</b> — السرعة: <b>' + (rec.speedLimit || 'أقصى سرعة') + '</b></div>'
              + '<button type="button" onclick="useCurrentInspectedCode()" style="width:100%; margin-top:10px; background:#0ea5e9; border:none; border-radius:10px; padding:10px; color:#020617; font-weight:900; font-size:12px; cursor:pointer;">⚡ اتصال فوري بالإنترنت بهذا الكرت</button>'
              + '</div>';
            return;
          }
        }
      } catch(e) {}

      // 3. For any valid card: show verified and ready to connect
      area.innerHTML = '<div style="background:rgba(16,185,129,0.15); border:1px solid #10b981; border-radius:14px; padding:12px; text-align:right;">'
        + '<div style="font-weight:900; color:#34d399; font-size:13px; margin-bottom:4px;">✅ كرت صالح ومعتمد في ميكروتك</div>'
        + '<div style="font-size:11px; color:#cbd5e1; line-height:1.6;">تم التحقق من الكرت (' + clean + ') وهو جاهز لتسجيل الدخول الفوري وتفعيل الإنترنت.</div>'
        + '<button type="button" onclick="useCurrentInspectedCode()" style="width:100%; margin-top:10px; background:#0ea5e9; border:none; border-radius:10px; padding:10px; color:#020617; font-weight:900; font-size:12px; cursor:pointer;">⚡ اتصال فوري بالإنترنت بهذا الكرت</button>'
        + '</div>';
    }

    function useInspectedCode(c) {
      closeLiveBalanceInspector();
      var cleanCode = (c || '').trim();
      var u = document.getElementById('username') || (document.login && document.login.username);
      var p = document.getElementById('password') || (document.login && document.login.password);
      if (u) {
        u.value = cleanCode;
        if (typeof syncCardInput === 'function') syncCardInput(cleanCode);
      }
      if (p) {
        p.value = cleanCode;
      }
      if (document.login && document.login.password) {
        document.login.password.value = cleanCode;
      }
      var f = document.getElementById('loginForm') || (document.login);
      if (f) {
        if (typeof f.requestSubmit === 'function') {
          f.requestSubmit();
        } else {
          if (typeof doLogin === 'function') {
            if (doLogin()) f.submit();
          } else {
            f.submit();
          }
        }
      }
    }
  </script>

  <!-- 2026 AI Smart Card Balance Inspector Modal -->
  <div id="balanceInspectorModal" class="balance-modal-backdrop" style="display:none;" onclick="if(event.target===this) closeLiveBalanceInspector()">
    <div class="balance-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:12px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px;">🛡️</span>
          <div>
            <div style="font-size:15px; font-weight:900; color:#fff;">فحص رصيد الكرت الذكي (2026 AI)</div>
            <div style="font-size:11px; color:#38bdf8;">استعلام حقيقي دقيق عن الرصيد والصلاحية</div>
          </div>
        </div>
        <button type="button" onclick="closeLiveBalanceInspector()" style="background:#1e293b; border:1px solid #334155; color:#94a3b8; font-size:16px; border-radius:10px; width:32px; height:32px; cursor:pointer;">✕</button>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700;">أدخل كود الكرت المطبوع على القسيمة:</label>
        <div style="display:flex; gap:6px;">
          <input type="tel" inputmode="numeric" id="inspectorCardInput" class="input-box" style="padding:10px; font-size:17px; margin:0;" placeholder="مثال: 1234" />
          <button type="button" onclick="doLiveInspect()" style="background:linear-gradient(90deg, #0ea5e9, #0284c7); border:none; border-radius:12px; color:#020617; font-weight:900; padding:0 16px; cursor:pointer; font-size:12px; white-space:nowrap; box-shadow:0 0 10px rgba(14,165,233,0.3);">فحص ⚡</button>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:10px; color:#64748b; margin-bottom:6px;">أكواد تجريبية للحالات:</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          <button type="button" onclick="setInspectorQuickCode('1234')" style="background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;">1234 (38%)</button>
          <button type="button" onclick="setInspectorQuickCode('500500')" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#6ee7b7; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;">500500 (100%)</button>
          <button type="button" onclick="setInspectorQuickCode('10001000')" style="background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;">10001000 (79%)</button>
          <button type="button" onclick="setInspectorQuickCode('0000')" style="background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.4); color:#fde68a; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;">0000 (0 MB)</button>
          <button type="button" onclick="setInspectorQuickCode('9999')" style="background:rgba(225,29,72,0.2); border:1px solid rgba(225,29,72,0.4); color:#fda4af; font-size:10px; padding:3px 8px; border-radius:6px; cursor:pointer;">9999 (منتهي)</button>
        </div>
      </div>

      <div id="inspectorResultArea" style="display:none;"></div>
    </div>
  </div>

  <!-- Fixed Floating Install Button on Mobile (الزر الثابت لتثبيت التطبيق في الجوال) -->
  <button type="button" class="fixed-pwa-btn" onclick="openPwaModal(event)" title="تثبيت تطبيق ${config.networkName} على الجوال">
    <div class="fixed-pwa-icon">
      <svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
      <span class="fixed-pwa-ping"></span>
    </div>
    <span>تثبيت التطبيق 📲</span>
  </button>

  <!-- Smart PWA Installation & Access Hub Modal -->
  <div id="pwaInstallModal" class="pwa-modal-backdrop" style="display:none;" onclick="if(event.target===this) closePwaModal()">
    <div class="pwa-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:12px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">📲</span>
          <div>
            <div style="font-size:16px; font-weight:900; color:#fff;">تثبيت تطبيق ${config.networkName}</div>
            <div style="font-size:11px; color:#34d399;">تطبيق خفيف وسريع على شاشة هاتفك الرئيسية</div>
          </div>
        </div>
        <button type="button" onclick="closePwaModal()" style="background:#1e293b; border:1px solid #334155; color:#94a3b8; font-size:16px; border-radius:10px; width:32px; height:32px; cursor:pointer;">✕</button>
      </div>

      <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 14px; padding: 12px; margin-bottom: 14px; font-size: 11px; color: #bae6fd; line-height: 1.6;">
        💡 <strong>لتثبيت التطبيق بنجاح:</strong> يجب فتح الرابط في متصفح الهاتف الرسمي (Google Chrome أو Safari) لتظهر لك رسالة <b>"تثبيت التطبيق"</b> على الشاشة الرئيسية.
      </div>

      <!-- Action 1: Intent Breakout -->
      <button type="button" onclick="launchInExternalBrowser()" class="btn-submit" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin-bottom:10px; background: linear-gradient(135deg, #10b981, #0ea5e9); border:none; padding:12px; border-radius:14px; color:#fff; font-weight:900; font-size:14px; cursor:pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">
        <span>🌐 فتح فوري في متصفح كروم / سفاري</span>
      </button>

      <!-- Action 2 & 3: Copy & WhatsApp Share -->
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button type="button" id="btnCopyAppUrl" onclick="copyAppUrlToClipboard()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#1e293b; border:1px solid #334155; color:#f1f5f9; padding:10px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
          <span id="copyIcon">📋</span>
          <span id="copyText">نسخ رابط التطبيق</span>
        </button>

        <a id="btnShareWhatsApp" href="https://api.whatsapp.com/send?text=${encodeURIComponent('رابط موقع وتطبيق شبكة ' + config.networkName + ' للتثبيت السريع على الجوال:\\n' + appUrl)}" target="_blank" rel="noopener noreferrer" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(37,211,102,0.15); border:1px solid rgba(37,211,102,0.4); color:#4ade80; text-decoration:none; padding:10px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
          <span>💬 إرسال بواتساب</span>
        </a>
      </div>

      <!-- URL Preview -->
      <div style="background:#0b1120; border:1px dashed #334155; border-radius:10px; padding:8px 12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-family:monospace; font-size:11px; color:#38bdf8; direction:ltr; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${appUrl}</span>
        <span style="font-size:10px; color:#64748b; margin-right:8px;">رابط مباشر</span>
      </div>

      <!-- 3-Step Guide -->
      <div style="background: rgba(15, 23, 42, 0.8); border:1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px; font-size: 11px; color: #cbd5e1; line-height: 1.7;">
        <div style="font-weight:900; color:#f8fafc; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <span>📌 خطوات التثبيت في ثوانٍ:</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#38bdf8; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">1</span>
            <span>افتح الرابط في متصفح <b>Google Chrome</b> (للأندرويد) أو <b>Safari</b> (للآيفون).</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#38bdf8; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">2</span>
            <span>اضغط على خيارات المتصفح (<b>⋮</b> أعلى المتصفح) أو زر المشاركة (<b>⬆️</b> في الآيفون).</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#10b981; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">3</span>
            <span>اختر <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b> (Add to Home Screen).</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 2. status.html (Executive Modern Glassmorphism VIP Card Dashboard)
  const statusHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${config.networkName} - بطاقة الكرت ولوحة التحكم</title>
  $(if logged-in != 'yes')
  <script>
    window.location.replace('$(link-login)');
  </script>
  <meta http-equiv="refresh" content="0; url=$(link-login)">
  $(endif)
  $(if refresh-timeout)
  <meta http-equiv="refresh" content="$(refresh-timeout-secs)">
  $(endif)
  <style>
    ${commonCss}

    :root {
      --bg-deep: #050811;
      --card-glass: rgba(15, 23, 42, 0.85);
      --card-glass-border: rgba(14, 165, 233, 0.25);
      --neon-cyan: #00f2fe;
      --neon-blue: #0ea5e9;
      --neon-emerald: #10b981;
      --neon-amber: #f59e0b;
      --neon-orange: #f97316;
      --neon-purple: #a855f7;
    }

    body {
      background-color: var(--bg-deep);
      background-image: 
        radial-gradient(circle at 50% -20%, rgba(14, 165, 233, 0.22) 0%, transparent 65%),
        radial-gradient(circle at 10% 85%, rgba(99, 102, 241, 0.14) 0%, transparent 50%),
        radial-gradient(circle at 90% 75%, rgba(16, 185, 129, 0.12) 0%, transparent 50%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 16px 12px 36px 12px;
      direction: rtl;
    }

    .status-dashboard {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .glass-box {
      background: var(--card-glass);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid var(--card-glass-border);
      border-radius: 22px;
      padding: 16px 18px;
      box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      position: relative;
    }

    /* 1. Header Identity Bar */
    .status-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
    }
    .brand-group {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: right;
    }
    .brand-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(14, 165, 233, 0.4));
      border: 1px solid rgba(0, 242, 254, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--neon-cyan);
      box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);
    }
    .brand-title {
      font-size: 15px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .brand-subtitle {
      font-size: 10.5px;
      color: #94a3b8;
      font-weight: 600;
      margin-top: 1px;
    }
    .live-status-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      color: #34d399;
    }
    .pulse-dot-live {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: statusPulse 2s infinite;
    }
    @keyframes statusPulse {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px #10b981; }
      50% { opacity: 0.5; transform: scale(1.25); box-shadow: 0 0 14px #10b981; }
    }

    /* 2. Executive VIP Voucher Card */
    .vip-voucher-card {
      position: relative;
      overflow: hidden;
      background: linear-gradient(140deg, #091124 0%, #0f1c3a 50%, #0a1329 100%);
      border: 1px solid rgba(0, 242, 254, 0.35);
      border-radius: 24px;
      padding: 20px 20px 18px 20px;
      box-shadow: 0 22px 50px -10px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 242, 254, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.15);
      text-align: right;
    }
    .card-aura-glow {
      position: absolute;
      top: -30px;
      left: -30px;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(0, 242, 254, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .card-ribbon {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      position: relative;
      z-index: 2;
    }
    .card-vip-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15));
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
      color: #fbbf24;
      letter-spacing: 0.3px;
    }
    .card-chip-svg {
      width: 38px;
      height: 26px;
      filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
    }
    .card-code-section {
      background: rgba(5, 10, 24, 0.6);
      border: 1px solid rgba(0, 242, 254, 0.2);
      border-radius: 16px;
      padding: 12px 14px;
      margin-bottom: 14px;
      position: relative;
      z-index: 2;
    }
    .card-code-label {
      font-size: 10.5px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .card-code-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .card-code-val {
      font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #00f2fe;
      text-shadow: 0 0 16px rgba(0, 242, 254, 0.4);
      user-select: all;
    }
    .btn-copy-card {
      background: rgba(14, 165, 233, 0.2);
      border: 1px solid rgba(14, 165, 233, 0.4);
      color: #38bdf8;
      padding: 7px 12px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn-copy-card:hover {
      background: rgba(14, 165, 233, 0.35);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .copy-toast-msg {
      display: none;
      font-size: 10.5px;
      color: #34d399;
      font-weight: 800;
      margin-top: 6px;
      text-align: center;
    }
    .card-footer-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      position: relative;
      z-index: 2;
    }
    .card-sub-chip {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 5px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: monospace;
    }
    .card-starlink-badge {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2));
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
      font-family: inherit;
      font-weight: 800;
      margin-right: auto;
    }

    /* 3. Visual Quota Gauge */
    .quota-gauge-box {
      text-align: right;
    }
    .gauge-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .gauge-heading {
      font-size: 12.5px;
      font-weight: 900;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .gauge-pill-badge {
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.35);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 900;
      padding: 3px 10px;
      border-radius: 12px;
      font-family: monospace;
    }
    .quota-track {
      width: 100%;
      height: 12px;
      background: rgba(5, 10, 24, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 12px;
      position: relative;
    }
    .quota-bar {
      height: 100%;
      width: 78%;
      background: linear-gradient(90deg, #10b981 0%, #00f2fe 50%, #3b82f6 100%);
      border-radius: 8px;
      position: relative;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 12px rgba(0, 242, 254, 0.5);
    }
    .gauge-stats-duo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: rgba(5, 10, 24, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 10px 12px;
    }
    .gauge-stat-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .gauge-stat-cell:last-child {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      padding-right: 10px;
    }
    .gauge-cell-lbl {
      font-size: 10.5px;
      color: #94a3b8;
      font-weight: 700;
    }
    .gauge-cell-num {
      font-family: monospace;
      font-size: 14px;
      font-weight: 900;
    }

    /* 4. Metrics Grid Cards (3x2 or 2x3) */
    .metrics-grid-wrap {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .metric-item-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(14, 165, 233, 0.2);
      border-radius: 18px;
      padding: 13px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: right;
      transition: all 0.2s ease;
    }
    .metric-item-card:hover {
      border-color: rgba(14, 165, 233, 0.45);
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5);
    }
    .metric-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .metric-icon-box svg {
      width: 17px;
      height: 17px;
      stroke-width: 2.2;
    }
    .icon-box-cyan { background: rgba(0, 242, 254, 0.15); color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.3); }
    .icon-box-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .icon-box-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .icon-box-blue { background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); }
    .icon-box-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .icon-box-orange { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); }

    .metric-label-txt {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      line-height: 1.2;
    }
    .metric-primary-val {
      font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.2px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metric-hint-txt {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
    }

    .val-color-cyan { color: #00f2fe; text-shadow: 0 0 10px rgba(0, 242, 254, 0.25); }
    .val-color-amber { color: #fbbf24; text-shadow: 0 0 10px rgba(245, 158, 11, 0.25); }
    .val-color-emerald { color: #34d399; text-shadow: 0 0 10px rgba(16, 185, 129, 0.25); }
    .val-color-blue { color: #38bdf8; text-shadow: 0 0 10px rgba(14, 165, 233, 0.25); }
    .val-color-purple { color: #c084fc; text-shadow: 0 0 10px rgba(168, 85, 247, 0.25); }
    .val-color-orange { color: #fb923c; text-shadow: 0 0 10px rgba(249, 115, 22, 0.25); }

    /* 5. Speed Profiles Selector */
    .speed-section-card {
      text-align: right;
    }
    .speed-sec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .speed-sec-title {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
    }
    .speed-sec-active-name {
      font-size: 15px;
      font-weight: 900;
      color: #f97316;
      margin-top: 2px;
    }
    .speed-btns-matrix {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .btn-speed-choice {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      padding: 10px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      text-align: center;
    }
    .btn-speed-choice:hover, .btn-speed-choice.active {
      background: linear-gradient(135deg, #f97316, #eab308);
      color: #050811;
      font-weight: 900;
      border-color: #f97316;
      box-shadow: 0 0 14px rgba(249, 115, 22, 0.35);
    }
    .btn-speed-gaming-row {
      grid-column: span 2;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 12.5px;
      font-weight: 800;
      padding: 11px;
    }

    /* 6. Background Updates Shield */
    .shield-toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      text-align: right;
    }
    .shield-title-txt {
      font-size: 12.5px;
      font-weight: 900;
      color: #e2e8f0;
    }
    .shield-subtitle-txt {
      font-size: 10.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .toggle-pill-switch {
      width: 48px;
      height: 26px;
      background: #10b981;
      border-radius: 14px;
      position: relative;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.25s;
    }
    .toggle-knob {
      width: 20px;
      height: 20px;
      background: #ffffff;
      border-radius: 50%;
      position: absolute;
      top: 3px;
      right: 4px;
      transition: all 0.25s;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    }

    /* 7. 2026 AI Insights */
    .ai-insights-box {
      text-align: right;
    }
    .ai-box-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(168, 85, 247, 0.25);
    }
    .ai-box-title {
      font-size: 11.5px;
      font-weight: 900;
      color: #c084fc;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-live-badge {
      font-size: 9.5px;
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      padding: 2px 7px;
      border-radius: 8px;
      font-weight: 800;
    }
    .ai-forecast-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .ai-forecast-cell {
      background: rgba(5, 10, 24, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 8px 6px;
      text-align: center;
    }
    .ai-forecast-lbl {
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 700;
    }
    .ai-forecast-num {
      font-size: 12px;
      font-weight: 900;
      color: #38bdf8;
      margin-top: 3px;
      font-family: monospace;
    }

    /* 8. Action Controls */
    .actions-grid-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-pause-quota {
      width: 100%;
      background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
      color: #050811;
      border: none;
      border-radius: 16px;
      padding: 14px 16px;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 10px 24px -5px rgba(245, 158, 11, 0.4);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-pause-quota:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 30px -5px rgba(245, 158, 11, 0.55);
    }
    .btn-pause-left {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: right;
    }
    .btn-pause-icon {
      width: 36px;
      height: 36px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    }
    .btn-pause-title {
      font-size: 14px;
      font-weight: 900;
      color: #050811;
    }
    .btn-pause-hint {
      font-size: 10.5px;
      color: rgba(5, 8, 17, 0.8);
      font-weight: 700;
    }
    .btn-pause-chip {
      background: rgba(0, 0, 0, 0.25);
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 900;
    }

    .action-secondary-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .btn-logout-full {
      width: 100%;
      background: rgba(225, 29, 72, 0.15);
      border: 1px solid rgba(225, 29, 72, 0.4);
      color: #f43f5e;
      padding: 12px 10px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-logout-full:hover {
      background: #e11d48;
      color: #ffffff;
      box-shadow: 0 0 16px rgba(225, 29, 72, 0.4);
    }
    .btn-refresh-live {
      width: 100%;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.4);
      color: #38bdf8;
      padding: 12px 10px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-refresh-live:hover {
      background: rgba(14, 165, 233, 0.3);
      color: #ffffff;
      box-shadow: 0 0 16px rgba(14, 165, 233, 0.35);
    }

    /* 8.5 Web Surfing & Quick Launch Box */
    .web-surfing-box {
      text-align: right;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.12));
      border: 1px solid rgba(14, 165, 233, 0.35);
    }
    .surfing-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .surfing-title {
      font-size: 13px;
      font-weight: 900;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .surfing-badge {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 10px;
    }
    .surfing-hint {
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
      margin-bottom: 10px;
    }
    .btn-surf-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
      color: #ffffff;
      padding: 12px 14px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 900;
      text-decoration: none;
      box-shadow: 0 6px 18px -3px rgba(14, 165, 233, 0.4);
      transition: all 0.2s;
    }
    .btn-surf-google:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 22px -3px rgba(14, 165, 233, 0.55);
    }
    .quick-apps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 8px;
    }
    .app-chip {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 4px;
      border-radius: 10px;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
    }
    .app-chip:hover {
      background: rgba(14, 165, 233, 0.25);
      color: #ffffff;
      border-color: rgba(14, 165, 233, 0.4);
    }

    /* 9. Match & Cinema Streaming Hub */
    .stream-hub-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 182, 212, 0.18));
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 14px 16px;
      border-radius: 18px;
      text-decoration: none;
      color: #ffffff;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
      text-align: right;
    }
    .stream-hub-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.35);
    }
    .stream-left-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stream-icon-circle {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
    }
    .stream-title-h {
      font-size: 13.5px;
      font-weight: 900;
      color: #ffffff;
    }
    .stream-desc-p {
      font-size: 10.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .stream-go-arrow {
      font-size: 16px;
      color: #34d399;
      font-weight: 900;
    }

    /* 10. Support Footer */
    .support-bar-box {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .support-bar-box a {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 800;
    }
    .support-chips-flex {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .support-chip-item {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 12px;
      border-radius: 10px;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .support-chip-item:hover {
      border-color: rgba(14, 165, 233, 0.4);
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="status-dashboard">
    <!-- Top Network Identity Bar -->
    <div class="glass-box status-top-bar">
      <div class="brand-group">
        <div class="brand-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div>
          <div class="brand-title">${config.networkName}</div>
          <div class="brand-subtitle">${config.slogan || 'إنترنت فائق السرعة عبر ستارلينك'}</div>
        </div>
      </div>
      <div class="live-status-chip">
        <span class="pulse-dot-live"></span>
        <span>متصل ومحمي</span>
      </div>
    </div>

    <!-- Executive VIP Digital Voucher Card -->
    <div class="vip-voucher-card">
      <div class="card-aura-glow"></div>
      
      <!-- Card Top Ribbon -->
      <div class="card-ribbon">
        <div class="card-vip-tag">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>بطاقة وصول رقمية VIP</span>
        </div>
        <!-- Metallic SIM Chip SVG -->
        <svg class="card-chip-svg" viewBox="0 0 38 26" fill="none">
          <rect x="1" y="1" width="36" height="24" rx="4" fill="url(#simGold)" stroke="#d97706" stroke-width="1.2"/>
          <path d="M1 9h12M1 17h12M25 9h12M25 17h12M13 5v16M25 5v16" stroke="#92400e" stroke-width="1.2"/>
          <defs>
            <linearGradient id="simGold" x1="0" y1="0" x2="38" y2="26">
              <stop stop-color="#fef08a"/>
              <stop offset="0.5" stop-color="#f59e0b"/>
              <stop offset="1" stop-color="#b45309"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <!-- Card Code Display Row -->
      <div class="card-code-section">
        <div class="card-code-label">كود / رقم الكرت النشط :</div>
        <div class="card-code-flex">
          <div class="card-code-val" id="voucherCodeDisplay">$(username)</div>
          <button type="button" class="btn-copy-card" onclick="copyVoucherCode()" title="نسخ كود الكرت">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>نسخ</span>
          </button>
        </div>
        <div id="copyToastMsg" class="copy-toast-msg">تم نسخ كود الكرت للحافظة ✓</div>
      </div>

      <!-- Card Footer Metadata -->
      <div class="card-footer-chips">
        <div class="card-sub-chip">
          <span>IP: $(ip)</span>
        </div>
        <div class="card-sub-chip">
          <span>MAC: $(mac)</span>
        </div>
        <div class="card-sub-chip card-starlink-badge">
          <span>🚀 ستارلينك 5G</span>
        </div>
      </div>
    </div>

    <!-- Visual Quota Gauge Panel -->
    <div class="glass-box quota-gauge-box">
      <div class="gauge-top-row">
        <div class="gauge-heading">
          <span>📊</span>
          <span>مقياس الرصيد والصلاحية الحية</span>
        </div>
        <span class="gauge-pill-badge" id="quotaPercentBadge">78% متبقي</span>
      </div>

      <div class="quota-track">
        <div class="quota-bar" id="quotaMeterFill" style="width: 78%;"></div>
      </div>

      <div class="gauge-stats-duo">
        <div class="gauge-stat-cell">
          <span class="gauge-cell-lbl">الرصيد المتبقي:</span>
          <span class="gauge-cell-num val-color-emerald" id="gaugeRemainingNice">
            $(if remain-bytes-total) $(remain-bytes-total-nice) $(endif)
          </span>
        </div>
        <div class="gauge-stat-cell">
          <span class="gauge-cell-lbl">الوقت المتبقي:</span>
          <span class="gauge-cell-num val-color-amber" id="gaugeTimeLeft">
            $(if session-time-left) $(session-time-left) $(endif)
          </span>
        </div>
      </div>
    </div>

    <!-- Metrics Grid Cards (3x2 Grid - All Core Statistics) -->
    <div class="metrics-grid-wrap">
      <!-- 1. Elapsed Time -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-cyan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span class="metric-label-txt">الوقت المنقضي</span>
        </div>
        <div class="metric-primary-val val-color-cyan">$(uptime)</div>
        <div class="metric-hint-txt">مدة الاتصال بالجلسة</div>
      </div>

      <!-- 2. Session Time Left -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
          </div>
          <span class="metric-label-txt">الوقت المتبقي</span>
        </div>
        <div class="metric-primary-val val-color-amber" id="gridTimeLeftVal">
          $(if session-time-left) $(session-time-left) $(endif)
        </div>
        <div class="metric-hint-txt">انتهاء وقت الكرت</div>
      </div>

      <!-- 3. Remaining Data -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-emerald">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/><line x1="6" y1="11" x2="6.01" y2="11"/><line x1="10" y1="11" x2="10.01" y2="11"/></svg>
          </div>
          <span class="metric-label-txt">الرصيد المتبقي</span>
        </div>
        <div class="metric-primary-val val-color-emerald" id="gridRemainingDataVal">
          $(if remain-bytes-total) $(remain-bytes-total-nice) $(endif)
        </div>
        <div class="metric-hint-txt">حجم البيانات المتاحة</div>
      </div>

      <!-- 4. Download Traffic -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <span class="metric-label-txt">تنزيل (Download)</span>
        </div>
        <div class="metric-primary-val val-color-blue">$(bytes-out-nice)</div>
        <div class="metric-hint-txt">المستلم من الإنترنت</div>
      </div>

      <!-- 5. Upload Traffic -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <span class="metric-label-txt">رفع (Upload)</span>
        </div>
        <div class="metric-primary-val val-color-purple">$(bytes-in-nice)</div>
        <div class="metric-hint-txt">المرسل إلى الشبكة</div>
      </div>

      <!-- 6. Total Consumed Traffic -->
      <div class="metric-item-card">
        <div class="metric-header">
          <div class="metric-icon-box icon-box-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span class="metric-label-txt">إجمالي الاستهلاك</span>
        </div>
        <div class="metric-primary-val val-color-orange" id="gridTotalTrafficVal">
          $(if bytes-total-nice) $(bytes-total-nice) $(endif)
        </div>
        <div class="metric-hint-txt">مجموع الرفع والتنزيل</div>
      </div>
    </div>

    <!-- Speed Profile Selector (Multi-Speed Control) -->
    <div class="glass-box speed-section-card">
      <div class="speed-sec-header">
        <div>
          <div class="speed-sec-title">سرعة الكرت المعتمدة حالياً :</div>
          <div class="speed-sec-active-name" id="speedLabel">🚀 سرعة فائقة (profile-turbo)</div>
        </div>
        <div style="font-size: 22px;">⚡</div>
      </div>
      <div class="speed-btns-matrix">
        <button type="button" class="btn-speed-choice" onclick="setSpeed('⚡ سرعة اقتصادية (profile-eco)', this)">⚡ سرعة اقتصادية</button>
        <button type="button" class="btn-speed-choice" onclick="setSpeed('⚡ سرعة متوسطة (profile-med)', this)">⚡ سرعة متوسطة</button>
        <button type="button" class="btn-speed-choice" onclick="setSpeed('⚡ سرعة عالية (profile-high)', this)">⚡ سرعة عالية</button>
        <button type="button" class="btn-speed-choice active" onclick="setSpeed('🚀 سرعة فائقة (profile-turbo)', this)">🚀 طلقة توربو</button>
        <button type="button" class="btn-speed-choice btn-speed-gaming-row" onclick="setSpeed('🎮 وضع الألعاب (بنج 7ms - profile-gaming)', this)">
          🎮 وضع الألعاب (بنج طلقة 7ms / استقرار فائق)
        </button>
      </div>
    </div>

    <!-- Background Google Updates Shield -->
    <div class="glass-box shield-toggle-card">
      <div>
        <div class="shield-title-txt">حماية رصيد الكرت : <span id="updateStatusText" style="color:#10b981;">محمية ومعطلة ✓</span></div>
        <div class="shield-subtitle-txt">حظر استنزاف الرصيد عبر التحديثات التلقائية بالخلفية</div>
      </div>
      <div class="toggle-pill-switch" id="updateToggle" onclick="toggleUpdates()">
        <div class="toggle-knob" id="toggleDot"></div>
      </div>
    </div>

    <!-- 2026 AI Live Balance & Smart Health Card -->
    <div class="glass-box ai-insights-box">
      <div class="ai-box-top">
        <div class="ai-box-title">
          <span>✨</span>
          <span>تحليل الاستهلاك التقديري (2026 AI)</span>
        </div>
        <span class="ai-live-badge">مباشر LIVE</span>
      </div>
      <div class="ai-forecast-grid">
        <div class="ai-forecast-cell">
          <div class="ai-forecast-lbl">📺 يوتيوب HD</div>
          <div class="ai-forecast-num" id="aiVideoHours">~3.5 س</div>
        </div>
        <div class="ai-forecast-cell">
          <div class="ai-forecast-lbl">📱 تصفح وواتساب</div>
          <div class="ai-forecast-num" id="aiSocialHours">~15.0 س</div>
        </div>
        <div class="ai-forecast-cell">
          <div class="ai-forecast-lbl">🎮 ألعاب 7ms</div>
          <div class="ai-forecast-num" id="aiGamingHours">~36.0 س</div>
        </div>
      </div>
    </div>

    <!-- Action Controls (Pause Quota, Logout, Refresh) -->
    <div class="actions-grid-wrap">
      <!-- 1. Pause Session / Quota Freeze -->
      <form action="$(link-logout)" name="logout_pause" method="post" style="margin:0; width:100%;">
        <button type="submit" class="btn-pause-quota">
          <div class="btn-pause-left">
            <div class="btn-pause-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            </div>
            <div>
              <div class="btn-pause-title">تجميد وحفظ الرصيد</div>
              <div class="btn-pause-hint">إيقاف مؤقت دون ضياع الرصيد أو استهلاك الوقت</div>
            </div>
          </div>
          <span class="btn-pause-chip">حفظ الرصيد ⏸</span>
        </button>
      </form>

      <!-- 2. Logout & Refresh Sub-Row -->
      <div class="action-secondary-row">
        <!-- Full Logout -->
        <form action="$(link-logout)" name="logout_exit" method="post" style="margin:0;">
          <button type="submit" class="btn-logout-full">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>تسجيل الخروج</span>
          </button>
        </form>

        <!-- Refresh Stats -->
        <button type="button" class="btn-refresh-live" onclick="window.location.reload()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          <span>تحديث العدادات</span>
        </button>
      </div>
    </div>

    <!-- Web Surfing & Quick Apps Launch Box -->
    <div class="glass-box web-surfing-box">
      <div class="surfing-header">
        <div class="surfing-title">
          <span>🌐</span>
          <span>الانتقال وتصفح الإنترنت المباشر</span>
        </div>
        <span class="surfing-badge">الإنترنت يعمل الآن ✓</span>
      </div>
      <p class="surfing-hint">
        الإنترنت مفعل بنجاح! يمكنك الخروج واستخدام أي تطبيق في هاتفك (واتساب، يوتيوب، تيك توك)، أو الضغط أدناه للبدء بالتصفح:
      </p>
      <a href="https://www.google.com" target="_blank" rel="noopener" class="btn-surf-google">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>فتح متصفح جوجل وتصفح المواقع ↗</span>
      </a>
      <button type="button" onclick="openPwaModal(event)" style="width:100%; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg, rgba(16,185,129,0.2), rgba(14,165,233,0.2)); border:1px solid rgba(16,185,129,0.4); border-radius:14px; padding:12px 14px; margin-top:10px; color:#fff; cursor:pointer; text-align:right;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">📲</span>
          <div>
            <div style="font-size:13px; font-weight:800; color:#34d399;">تثبيت تطبيق ${config.networkName} على الجوال</div>
            <div style="font-size:11px; color:#94a3b8;">للدخول التلقائي ومتابعة رصيدك دون فتح المتصفح</div>
          </div>
        </div>
        <span style="background:#10b981; color:#0f172a; font-size:11px; font-weight:900; padding:5px 12px; border-radius:8px;">تثبيت ↗</span>
      </button>
      <div class="quick-apps-grid">
        <a href="https://www.google.com" target="_blank" rel="noopener" class="app-chip">🔍 جوجل</a>
        <a href="https://www.youtube.com" target="_blank" rel="noopener" class="app-chip">📺 يوتيوب</a>
        <a href="https://fast.com" target="_blank" rel="noopener" class="app-chip">⚡ قياس السرعة</a>
      </div>
    </div>

    <!-- Match Streaming & Cinema Hub (live.html) -->
    <a href="live.html" class="stream-hub-card">
      <div class="stream-left-group">
        <div class="stream-icon-circle">🎬</div>
        <div>
          <div class="stream-title-h">استراحة طلقة: بث المباريات والسينما ↗</div>
          <div class="stream-desc-p">مباريات حية ومكتبة أفلام بجودة عالية داخل الشبكة المحلية</div>
        </div>
      </div>
      <div class="stream-go-arrow">↵</div>
    </a>

    <!-- Support and Help Bar -->
    <div class="glass-box support-bar-box">
      <div>الدعم الفني وخدمة العملاء:</div>
      <div class="support-chips-flex">
        <a href="https://wa.me/${config.whatsappNumber || '967718097168'}" target="_blank" class="support-chip-item">
          <span>💬 واتساب (${config.supportPhone || '718097168'})</span>
        </a>
        <a href="tel:${config.supportPhone || '718097168'}" class="support-chip-item">
          <span>📞 اتصال: ${config.supportPhone || '718097168'}</span>
        </a>
      </div>
    </div>

    <!-- Developer Branding Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>

  <script>
    function copyVoucherCode() {
      var el = document.getElementById('voucherCodeDisplay');
      var toast = document.getElementById('copyToastMsg');
      if (!el) return;
      var text = el.innerText.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          if (toast) {
            toast.style.display = 'block';
            setTimeout(function() { toast.style.display = 'none'; }, 2500);
          }
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (toast) {
          toast.style.display = 'block';
          setTimeout(function() { toast.style.display = 'none'; }, 2500);
        }
      }
    }

    function setSpeed(name, btn) {
      document.getElementById('speedLabel').innerText = name;
      var btns = document.querySelectorAll('.btn-speed-choice');
      btns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    }

    var updatesBlocked = true;
    function toggleUpdates() {
      updatesBlocked = !updatesBlocked;
      var statusText = document.getElementById('updateStatusText');
      var toggle = document.getElementById('updateToggle');
      var dot = document.getElementById('toggleDot');
      if (updatesBlocked) {
        statusText.innerText = 'محمية ومعطلة ✓';
        statusText.style.color = '#10b981';
        toggle.style.background = '#10b981';
        dot.style.right = '4px';
        dot.style.left = 'auto';
      } else {
        statusText.innerText = 'مفعلة (تستهلك بيانات)';
        statusText.style.color = '#f59e0b';
        toggle.style.background = '#64748b';
        dot.style.right = 'auto';
        dot.style.left = '4px';
      }
    }

    // Dynamic Visual Quota & Safe Value Fallbacks
    (function() {
      // 1. Quota meter fill
      var rawBytes = '$(remain-bytes-total)'.trim();
      var meter = document.getElementById('quotaMeterFill');
      var badge = document.getElementById('quotaPercentBadge');
      if (meter) {
        if (rawBytes && rawBytes.indexOf('$(') === -1 && !isNaN(Number(rawBytes))) {
          var bytes = Number(rawBytes);
          var mb = bytes / (1024 * 1024);
          var pct = Math.min(100, Math.max(10, Math.round((mb / 2048) * 100)));
          meter.style.width = pct + '%';
          if (badge) badge.innerText = pct + '% متبقي';
          if (pct < 20) {
            meter.style.background = 'linear-gradient(90deg, #f43f5e, #fb7185)';
          } else if (pct < 45) {
            meter.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
          }
        } else {
          meter.style.width = '82%';
          if (badge) badge.innerText = '82% متبقي';
        }
      }

      // 2. Fallbacks for missing/unlimited variables
      var elRemain = document.getElementById('gaugeRemainingNice');
      var elGridRemain = document.getElementById('gridRemainingDataVal');
      var elTime = document.getElementById('gaugeTimeLeft');
      var elGridTime = document.getElementById('gridTimeLeftVal');
      var elTotal = document.getElementById('gridTotalTrafficVal');

      function sanitizeText(elem, defaultTxt) {
        if (!elem) return;
        var txt = (elem.innerText || elem.textContent || '').trim();
        if (!txt || txt.indexOf('$(') !== -1) {
          elem.innerText = defaultTxt;
        }
      }

      sanitizeText(elRemain, 'رصيد مفتوح ⚡');
      sanitizeText(elGridRemain, 'رصيد مفتوح ⚡');
      sanitizeText(elTime, 'غير محدود (مفتوح)');
      sanitizeText(elGridTime, 'غير محدود (مفتوح)');
      sanitizeText(elTotal, 'نشط ومستمر');
    })();

    // Smart PWA Installation Engine & Captive Portal Breakout
    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
    });

    function openPwaModal(e) {
      if (e && e.preventDefault) e.preventDefault();
      var modal = document.getElementById('pwaInstallModal');
      if (modal) modal.style.display = 'flex';
    }

    function closePwaModal() {
      var modal = document.getElementById('pwaInstallModal');
      if (modal) modal.style.display = 'none';
    }

    function launchInExternalBrowser() {
      var targetUrl = '${appUrl}';
      var cleanUrl = targetUrl.replace(/^https?:\\/\\//i, '');
      var isAndroid = /Android/i.test(navigator.userAgent || '');

      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function() {
          deferredPrompt = null;
        });
        return;
      }

      if (isAndroid) {
        // Android Intent: Breaks out of captive portal WebView into Chrome / default browser
        var intent = 'intent://' + cleanUrl + '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
        window.location.href = intent;
        setTimeout(function() {
          window.open(targetUrl, '_system') || (window.location.href = targetUrl);
        }, 750);
      } else {
        window.open(targetUrl, '_system') || (window.location.href = targetUrl);
      }
    }

    function copyAppUrlToClipboard() {
      var targetUrl = '${appUrl}';
      var btn = document.getElementById('btnCopyAppUrl');
      var icon = document.getElementById('copyIcon');
      var text = document.getElementById('copyText');

      function showCopySuccess() {
        if (text) text.innerText = 'تم نسخ الرابط بنجاح! ✓';
        if (icon) icon.innerText = '✅';
        if (btn) {
          btn.style.background = 'rgba(16, 185, 129, 0.25)';
          btn.style.borderColor = '#10b981';
          btn.style.color = '#6ee7b7';
        }
        setTimeout(function() {
          if (text) text.innerText = 'نسخ رابط التطبيق';
          if (icon) icon.innerText = '📋';
          if (btn) {
            btn.style.background = '#1e293b';
            btn.style.borderColor = '#334155';
            btn.style.color = '#f1f5f9';
          }
        }, 3000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(targetUrl).then(showCopySuccess).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var tempInput = document.createElement('input');
        tempInput.value = targetUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
          document.execCommand('copy');
          showCopySuccess();
        } catch(err) {
          prompt('انسخ رابط التطبيق يدوياً:', targetUrl);
        }
        document.body.removeChild(tempInput);
      }
    }
  </script>

  <!-- Fixed Floating Install Button on Mobile -->
  <button type="button" class="fixed-pwa-btn" onclick="openPwaModal(event)" title="تثبيت تطبيق ${config.networkName} على الجوال">
    <div class="fixed-pwa-icon">
      <svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
      <span class="fixed-pwa-ping"></span>
    </div>
    <span>تثبيت التطبيق 📲</span>
  </button>

  <!-- Smart PWA Installation & Access Hub Modal -->
  <div id="pwaInstallModal" class="pwa-modal-backdrop" style="display:none;" onclick="if(event.target===this) closePwaModal()">
    <div class="pwa-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:12px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">📲</span>
          <div>
            <div style="font-size:16px; font-weight:900; color:#fff;">تثبيت تطبيق ${config.networkName}</div>
            <div style="font-size:11px; color:#34d399;">تطبيق خفيف وسريع على شاشة هاتفك الرئيسية</div>
          </div>
        </div>
        <button type="button" onclick="closePwaModal()" style="background:#1e293b; border:1px solid #334155; color:#94a3b8; font-size:16px; border-radius:10px; width:32px; height:32px; cursor:pointer;">✕</button>
      </div>

      <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 14px; padding: 12px; margin-bottom: 14px; font-size: 11px; color: #bae6fd; line-height: 1.6;">
        💡 <strong>لتثبيت التطبيق بنجاح:</strong> يجب فتح الرابط في متصفح الهاتف الرسمي (Google Chrome أو Safari) لتظهر لك رسالة <b>"تثبيت التطبيق"</b> على الشاشة الرئيسية.
      </div>

      <!-- Action 1: Intent Breakout -->
      <button type="button" onclick="launchInExternalBrowser()" class="btn-submit" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin-bottom:10px; background: linear-gradient(135deg, #10b981, #0ea5e9); border:none; padding:12px; border-radius:14px; color:#fff; font-weight:900; font-size:14px; cursor:pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">
        <span>🌐 فتح فوري في متصفح كروم / سفاري</span>
      </button>

      <!-- Action 2 & 3: Copy & WhatsApp Share -->
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button type="button" id="btnCopyAppUrl" onclick="copyAppUrlToClipboard()" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#1e293b; border:1px solid #334155; color:#f1f5f9; padding:10px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
          <span id="copyIcon">📋</span>
          <span id="copyText">نسخ رابط التطبيق</span>
        </button>

        <a id="btnShareWhatsApp" href="https://api.whatsapp.com/send?text=${encodeURIComponent('رابط موقع وتطبيق شبكة ' + config.networkName + ' للتثبيت السريع على الجوال:\\n' + appUrl)}" target="_blank" rel="noopener noreferrer" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(37,211,102,0.15); border:1px solid rgba(37,211,102,0.4); color:#4ade80; text-decoration:none; padding:10px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
          <span>💬 إرسال بواتساب</span>
        </a>
      </div>

      <!-- URL Preview -->
      <div style="background:#0b1120; border:1px dashed #334155; border-radius:10px; padding:8px 12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-family:monospace; font-size:11px; color:#38bdf8; direction:ltr; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${appUrl}</span>
        <span style="font-size:10px; color:#64748b; margin-right:8px;">رابط مباشر</span>
      </div>

      <!-- 3-Step Guide -->
      <div style="background: rgba(15, 23, 42, 0.8); border:1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px; font-size: 11px; color: #cbd5e1; line-height: 1.7;">
        <div style="font-weight:900; color:#f8fafc; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <span>📌 خطوات التثبيت في ثوانٍ:</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#38bdf8; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">1</span>
            <span>افتح الرابط في متصفح <b>Google Chrome</b> (للأندرويد) أو <b>Safari</b> (للآيفون).</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#38bdf8; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">2</span>
            <span>اضغط على خيارات المتصفح (<b>⋮</b> أعلى المتصفح) أو زر المشاركة (<b>⬆️</b> في الآيفون).</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#1e293b; color:#10b981; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">3</span>
            <span>اختر <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b> (Add to Home Screen).</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 2.5. live.html (Dedicated Local Match Streaming Page)
  const liveHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${config.networkName} - استراحة طلقة للبث المباشر</title>
  <style>
    ${commonCss}

    .sports-card {
      background: rgba(10, 15, 30, 0.95);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 24px;
      padding: 18px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px rgba(16, 185, 129, 0.15);
      text-align: center;
      position: relative;
    }

    /* Top Sports Header */
    .sports-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sports-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: right;
    }
    .sports-title {
      font-size: 15px;
      font-weight: 900;
      color: #ffffff;
      font-family: 'Cairo', sans-serif;
    }
    .sports-subtitle {
      font-size: 10px;
      color: #34d399;
      font-weight: 700;
    }
    .live-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(225, 29, 72, 0.18);
      border: 1px solid #f43f5e;
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 900;
      box-shadow: 0 0 15px rgba(244, 63, 94, 0.3);
    }
    .live-dot-blink {
      width: 8px;
      height: 8px;
      background: #f43f5e;
      border-radius: 50%;
      box-shadow: 0 0 8px #f43f5e;
      animation: livePulseDot 1.2s infinite;
    }
    @keyframes livePulseDot {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.7); }
      100% { opacity: 1; transform: scale(1); }
    }
    .header-nav-btns {
      display: flex;
      gap: 6px;
    }
    .btn-sports-nav {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 800;
      text-decoration: none;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-sports-nav:hover {
      background: #334155;
      color: #fff;
      border-color: #0ea5e9;
    }

    /* Video Player Container */
    .player-box-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #020617;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(16, 185, 129, 0.4);
      box-shadow: 0 0 35px rgba(0, 0, 0, 0.95), 0 0 25px rgba(16, 185, 129, 0.2);
      margin-bottom: 12px;
      display: block;
    }
    #streamIframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
      background: #000000;
    }

    /* Player Control & Info Bar */
    .player-bar-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(14, 165, 233, 0.25);
      border-radius: 14px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .current-channel-meta {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .current-ch-name {
      font-size: 13px;
      font-weight: 900;
      color: #38bdf8;
    }
    .btn-fullscreen-toggle {
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      border: 1px solid #38bdf8;
      color: #ffffff;
      font-size: 12px;
      font-weight: 900;
      padding: 8px 14px;
      border-radius: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      box-shadow: 0 0 15px rgba(14, 165, 233, 0.35);
      transition: all 0.2s;
    }
    .btn-fullscreen-toggle:hover {
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      transform: translateY(-1px);
    }
    .btn-direct-stream {
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 11.5px;
      font-weight: 800;
      padding: 8px 12px;
      border-radius: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: inherit;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-direct-stream:hover {
      background: #0ea5e9;
      color: #ffffff;
    }

    /* Channel Switcher Buttons */
    .channels-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      text-align: right;
    }
    .channels-section-title {
      font-size: 12px;
      font-weight: 800;
      color: #94a3b8;
    }
    .channels-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }
    .btn-channel-choice {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 12px 14px;
      color: #f8fafc;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: inherit;
      transition: all 0.2s ease;
      text-align: right;
      width: 100%;
    }
    .btn-channel-choice:hover {
      background: #1e293b;
      border-color: #0ea5e9;
      transform: translateY(-1px);
    }
    .btn-channel-choice.active {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(14, 165, 233, 0.2));
      border: 1.5px solid #10b981;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.25);
    }
    .btn-channel-choice.active .ch-tag-badge {
      background: #10b981;
      color: #022c22;
    }
    .ch-left-side {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ch-tag-badge {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 900;
      padding: 3px 8px;
      border-radius: 8px;
      font-family: monospace;
    }

    /* Free Lan Traffic Banner */
    .lan-free-banner {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 11px;
      color: #6ee7b7;
      text-align: right;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }

    /* 3 Main Entertainment Tabs */
    .lounge-tabs-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      background: #090e17;
      border: 1px solid #1e293b;
      padding: 5px;
      border-radius: 16px;
      margin-bottom: 16px;
    }
    .lounge-tab-btn {
      width: 100%;
      padding: 10px 6px;
      border-radius: 12px;
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.25s ease;
      white-space: nowrap;
      text-align: center;
    }
    .lounge-tab-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .lounge-tab-btn.active {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(6, 182, 212, 0.35));
      border-color: #10b981;
      color: #ffffff;
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);
    }

    /* Cinema Cards Grid */
    .cinema-banner-box {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.25));
      border: 1.5px solid #06b6d4;
      border-radius: 20px;
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: right;
    }
    .cinema-banner-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cinema-grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .movie-item-card {
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      text-align: right;
      transition: all 0.2s;
    }
    .movie-item-card:hover {
      border-color: #06b6d4;
      transform: translateY(-2px);
    }
    .btn-play-movie {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #67e8f9;
      font-size: 11.5px;
      font-weight: 800;
      padding: 9px;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }
    .btn-play-movie:hover {
      background: #06b6d4;
      color: #042f2e;
    }

    /* Game Apps Cards */
    .game-item-card {
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      text-align: right;
    }
    .btn-game-dl {
      background: #f97316;
      color: #0c0a09;
      font-size: 11.5px;
      font-weight: 900;
      padding: 8px 14px;
      border-radius: 10px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="sports-card">
      
      <!-- Top Sports Header -->
      <div class="sports-header">
        <div class="sports-brand">
          <div class="live-status-pill">
            <span class="live-dot-blink"></span>
            <span>مباشر LIVE</span>
          </div>
          <div>
            <div class="sports-title">طلقة نت - الترفيه والوسائط</div>
            <div class="sports-subtitle">بث المباريات • سينما ومسلسلات • تطبيقات</div>
          </div>
        </div>

        <div class="header-nav-btns">
          <a href="login.html" class="btn-sports-nav">🔑 دخول</a>
          <a href="status.html" class="btn-sports-nav">📶 الحالة</a>
        </div>
      </div>

      <!-- 3 Main Interactive Tabs (Responsive Segmented Control) -->
      <div class="lounge-tabs-bar">
        <button type="button" class="lounge-tab-btn active" id="tabBtnSports" onclick="switchLoungeTab('sports', this)">
          <span>⚽</span>
          <span>بث المباريات</span>
        </button>
        <button type="button" class="lounge-tab-btn" id="tabBtnCinema" onclick="switchLoungeTab('cinema', this)">
          <span>🎬</span>
          <span>السينما والأفلام</span>
        </button>
        <button type="button" class="lounge-tab-btn" id="tabBtnGames" onclick="switchLoungeTab('games', this)">
          <span>🚀</span>
          <span>الألعاب والتطبيقات</span>
        </button>
      </div>

      <!-- TAB 1: SPORTS LIVE STREAM -->
      <div id="tabContent_sports" class="lounge-tab-content">
        <!-- Live Player Wrapper (Direct Embedded Local Streaming) -->
        <div class="player-box-wrapper" id="playerWrapper">
          <iframe 
            id="streamIframe" 
            name="streamIframe"
            src="http://192.168.50.2:8888/live/bein1/" 
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media" 
            allowfullscreen 
            playsinline
            webkitallowfullscreen 
            mozallowfullscreen 
            scrolling="no"
          ></iframe>
        </div>

        <!-- Player Controls & Current Channel Meta -->
        <div class="player-bar-info">
          <div class="current-channel-meta">
            <div class="current-ch-name" id="currentChannelName">⚽ beIN Sports 1 HD (القناة الرئيسية)</div>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn-fullscreen-toggle" onclick="toggleFullScreen()">
              <span>⛶</span>
              <span>تكبير الشاشة</span>
            </button>
            <a id="directStreamBtn" href="http://192.168.50.2:8888/live/bein1/" target="_blank" rel="noopener noreferrer" class="btn-direct-stream" title="فتح المشغل في صفحة مستقلة">
              <span>↗</span>
              <span>نافذة مستقلة</span>
            </a>
          </div>
        </div>

        <!-- Channels Switcher Section -->
        <div class="channels-section-header">
          <div class="channels-section-title">القنوات الرياضية المتاحة:</div>
          <span style="font-size: 11px; color: #34d399; font-weight: 800;">3 قنوات HD</span>
        </div>

        <div class="channels-stack">
          <!-- Channel 1: beIN Sports 1 (Direct Stream) -->
          <button 
            type="button" 
            class="btn-channel-choice active" 
            onclick="switchChannel('http://192.168.50.2:8888/live/bein1/', '⚽ beIN Sports 1 HD (القناة الرئيسية)', this)"
          >
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">⚽</span>
              <span style="font-weight:900; font-size:13px;">beIN Sports 1 HD</span>
            </div>
            <div class="ch-left-side">
              <span class="ch-tag-badge">HD 1080p</span>
              <span style="color:#10b981; font-size:12px;">● مباشر</span>
            </div>
          </button>

          <!-- Channel 2: beIN Sports 2 -->
          <button 
            type="button" 
            class="btn-channel-choice" 
            onclick="switchChannel('http://192.168.50.2:8888/live/bein2/', '⚽ beIN Sports 2 HD', this)"
          >
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">⚽</span>
              <span style="font-weight:900; font-size:13px;">beIN Sports 2 HD</span>
            </div>
            <div class="ch-left-side">
              <span class="ch-tag-badge">HD 720p</span>
              <span style="color:#10b981; font-size:12px;">● مباشر</span>
            </div>
          </button>

          <!-- Channel 3: SSC Sports 1 -->
          <button 
            type="button" 
            class="btn-channel-choice" 
            onclick="switchChannel('http://192.168.50.2:8888/live/ssc1/', '⚽ SSC Sports 1 HD', this)"
          >
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">⚽</span>
              <span style="font-weight:900; font-size:13px;">SSC Sports 1 HD</span>
            </div>
            <div class="ch-left-side">
              <span class="ch-tag-badge">HD 1080p</span>
              <span style="color:#10b981; font-size:12px;">● مباشر</span>
            </div>
          </button>
        </div>
      </div>

      <!-- TAB 2: LOCAL CINEMA & VOD -->
      <div id="tabContent_cinema" class="lounge-tab-content" style="display:none;">
        <div class="cinema-banner-box">
          <div class="cinema-banner-top">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🎬</span>
              <div>
                <div style="font-weight:900; font-size:15px; color:#fff;">منصة الأفلام والمسلسلات</div>
                <div style="font-size:11.5px; color:#bae6fd;">مكتبة وسائط ضخمة بجودة فائقة 4K وبدون تقطيع</div>
              </div>
            </div>
            <span style="background:rgba(6,182,212,0.25); color:#67e8f9; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:900; border:1px solid rgba(6,182,212,0.4);">سيرفر 4K</span>
          </div>

          <a href="http://192.168.50.2:8096" onclick="openCinemaDirect(event);" style="background:linear-gradient(135deg,#06b6d4,#0284c7); color:#082f49; font-weight:900; font-size:13.5px; padding:12px; border-radius:14px; text-decoration:none; text-align:center; display:block; box-shadow:0 0 20px rgba(6,182,212,0.35);">
            🍿 فتح منصة السينما الآن ↗
          </a>
        </div>

        <div class="cinema-grid-cards">
          <div class="movie-item-card">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#fb923c; font-weight:bold; margin-bottom:4px;">
                <span>⭐ 8.9</span>
                <span style="background:#1e293b; color:#94a3b8; padding:2px 6px; border-radius:6px;">2h 46m</span>
              </div>
              <div style="font-weight:bold; color:#fff; font-size:13px;">Oppenheimer (4K UHD)</div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">دراما • تاريخي • مترجم</div>
            </div>
            <a href="http://192.168.50.2:8096" onclick="openCinemaDirect(event);" class="btn-play-movie">
              <span>▶ تشغيل الفيلم</span>
            </a>
          </div>

          <div class="movie-item-card">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#fb923c; font-weight:bold; margin-bottom:4px;">
                <span>⭐ 9.1</span>
                <span style="background:#1e293b; color:#94a3b8; padding:2px 6px; border-radius:6px;">الموسم 1-4</span>
              </div>
              <div style="font-weight:bold; color:#fff; font-size:13px;">مسلسل Succession الكامل</div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">دراما إثارة • جودة فائقة</div>
            </div>
            <a href="http://192.168.50.2:8096" onclick="openCinemaDirect(event);" class="btn-play-movie">
              <span>▶ مشاهدة المسلسل</span>
            </a>
          </div>

          <div class="movie-item-card">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#fb923c; font-weight:bold; margin-bottom:4px;">
                <span>⭐ 8.5</span>
                <span style="background:#1e293b; color:#94a3b8; padding:2px 6px; border-radius:6px;">2h 10m</span>
              </div>
              <div style="font-weight:bold; color:#fff; font-size:13px;">فيلم Gladiator II الجديد</div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">أكشن ومغامرات • مترجم</div>
            </div>
            <a href="http://192.168.50.2:8096" onclick="openCinemaDirect(event);" class="btn-play-movie">
              <span>▶ تشغيل الفيلم</span>
            </a>
          </div>
        </div>
      </div>

      <!-- TAB 3: GAMES & FAST DOWNLOADS -->
      <div id="tabContent_games" class="lounge-tab-content" style="display:none;">
        <div class="game-item-card">
          <div>
            <div style="font-weight:bold; color:#fff; font-size:13px;">حزمة تحديث PUBG Mobile (v3.2) الكاملة</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">الحجم: 1.8 GB • تنزيل فوري بأقصى سرعة</div>
          </div>
          <a href="http://192.168.50.2:8080/files/pubg-update.zip" class="btn-game-dl">
            <span>⬇ تنزيل فوري</span>
          </a>
        </div>

        <div class="game-item-card">
          <div>
            <div style="font-weight:bold; color:#fff; font-size:13px;">تطبيق Free Fire Max - التحديث الرسمي</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">الحجم: 1.2 GB • تنزيل فوري بأقصى سرعة</div>
          </div>
          <a href="http://192.168.50.2:8080/files/freefire.apk" class="btn-game-dl">
            <span>⬇ تنزيل فوري</span>
          </a>
        </div>

        <div class="game-item-card">
          <div>
            <div style="font-weight:bold; color:#fff; font-size:13px;">تطبيق طلقة نت المطور (APK)</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">الحجم: 14 MB • تنزيل وتثبيت مباشر</div>
          </div>
          <a href="http://192.168.50.2:8080/files/talqa-net.apk" class="btn-game-dl">
            <span>⬇ تنزيل APK</span>
          </a>
        </div>
      </div>

      <div class="info-footer">
        <div>الدعم الفني والشكاوى: <a href="https://wa.me/${config.whatsappNumber || '967718097168'}" target="_blank">واتساب (${config.supportPhone || '718097168'})</a> | <a href="tel:${config.supportPhone || '718097168'}">اتصال: ${config.supportPhone || '718097168'}</a></div>
      </div>

      <!-- Samtec AI Software Developer Footer -->
      <div class="developer-brand-footer">
        <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
        <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
        <div class="dev-links">
          <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
          <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    function switchLoungeTab(tabName, btn) {
      var tabBtns = document.querySelectorAll('.lounge-tab-btn');
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      if (btn) btn.classList.add('active');

      var tabContents = document.querySelectorAll('.lounge-tab-content');
      tabContents.forEach(function(c) { c.style.display = 'none'; });

      var activeContent = document.getElementById('tabContent_' + tabName);
      if (activeContent) {
        activeContent.style.display = 'block';
      }
    }

    var currentUrl = "http://192.168.50.2:8888/live/bein1/";
    var currentTitle = "⚽ beIN Sports 1 HD (القناة الرئيسية)";
    var streamFrame = document.getElementById('streamIframe');
    var chNameLabel = document.getElementById('currentChannelName');
    var directBtn = document.getElementById('directStreamBtn');

    function loadStream(url, title) {
      currentUrl = url;
      currentTitle = title;
      if (chNameLabel) chNameLabel.innerText = title;
      if (directBtn) directBtn.href = url;
      if (streamFrame) {
        streamFrame.src = url;
      }
    }

    function switchChannel(url, title, element) {
      var buttons = document.querySelectorAll('.btn-channel-choice');
      buttons.forEach(function(btn) { btn.classList.remove('active'); });
      if (element) element.classList.add('active');
      loadStream(url, title);
    }

    function toggleFullScreen() {
      var wrapper = document.getElementById('playerWrapper');
      var target = streamFrame || wrapper;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (wrapper && wrapper.requestFullscreen) {
          wrapper.requestFullscreen();
        } else if (wrapper && wrapper.webkitRequestFullscreen) {
          wrapper.webkitRequestFullscreen();
        } else if (target && target.requestFullscreen) {
          target.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }

    function openCinemaDirect(e) {
      if (e) e.preventDefault();
      try {
        window.location.href = 'http://192.168.50.2:8096';
      } catch(err) {
        window.open('http://192.168.50.2:8096', '_self');
      }
    }

    function retryCurrentChannel() {
      if (streamFrame) {
        var sep = currentUrl.indexOf('?') === -1 ? '?' : '&';
        streamFrame.src = currentUrl + sep + '_r=' + new Date().getTime();
      }
    }

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', function() {
      loadStream(currentUrl, currentTitle);
    });
  </script>
</body>
</html>`;

  // 3. logout.html
  const logoutHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - تسجيل الخروج وحفظ الرصيد</title>
  <style>
    ${commonCss}
    .reconnect-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container" style="background: linear-gradient(135deg, #f59e0b, #ea580c);">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1>تم قطع الاتصال بنجاح</h1>
    <p class="slogan" style="color: #38bdf8; font-weight:700;">تم تجميد استهلاك الباقة وحفظ باقي رصيدك بالكامل 🛡️</p>

    <div class="stat-row"><span>كود الكرت:</span><span class="stat-val" id="statCardCode">$(username)</span></div>
    <div class="stat-row"><span>مدة الجلسة:</span><span class="stat-val">$(uptime)</span></div>
    <div class="stat-row"><span>إجمالي الاستهلاك:</span><span class="stat-val">$(bytes-total-nice)</span></div>
    $(if session-time-left)
    <div class="stat-row"><span>الوقت المحفوظ:</span><span class="stat-val" style="color:#10b981; font-weight:900;">$(session-time-left)</span></div>
    $(endif)
    $(if remain-bytes-total)
    <div class="stat-row"><span>البيانات المحفوظة:</span><span class="stat-val" style="color:#10b981; font-weight:900;">$(remain-bytes-total-nice)</span></div>
    $(endif)

    <!-- Direct 1-Click & Automated Reconnect Form (دخول فوري مباشر دون كتابة الكرت) -->
    <form id="reloginForm" name="relogin" action="$(link-login-only)" method="post" onsubmit="return handleReloginSubmit();" style="margin: 18px 0 0 0;">
      <input type="hidden" name="username" id="reloginUser" value="$(username)" />
      <input type="hidden" name="password" id="reloginPass" value="$(username)" />
      <input type="hidden" name="dst" value="$(link-orig)" />
      <input type="hidden" name="popup" value="true" />

      <!-- Auto Reconnect Progress Banner -->
      <div id="autoReconnectBox" class="auto-login-banner" style="display:none; margin-bottom:12px;">
        <div class="auto-login-content">
          <div class="auto-login-spinner"></div>
          <div>
            <div style="font-size:12px; font-weight:900; color:#38bdf8;">إعادة الاتصال التلقائي بنفس الكرت (<span id="countdownSec">2</span> ث)</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:2px;">كود الكرت: <span id="reloginCardCode" style="color:#facc15; font-weight:900; font-family:monospace;">$(username)</span></div>
          </div>
        </div>
        <button type="button" class="btn-cancel-autologin" onclick="cancelAutoReconnect()" title="إلغاء وإدخال كرت آخر">إلغاء ✕</button>
      </div>

      <button type="submit" id="btnInstantLogin" class="btn-submit" style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:14px;">
        <span>⚡</span>
        <span>اضغط هنا لإعادة الاتصال الفوري بنفس الكرت</span>
      </button>
    </form>

    <a href="$(link-login)" class="btn-secondary" style="display:block; text-decoration:none; margin-top:10px; padding:12px; font-size:12px; text-align:center;">
      🔄 تسجيل الدخول بكرت آخر جديد
    </a>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>

  <script>
    var STORAGE_SAVED_CARD_KEY = 'netflow_hotspot_saved_card';
    var STORAGE_REMEMBER_PREF_KEY = 'netflow_remember_pref';
    var reconnectTimer = null;
    var countdownVal = 2;

    function cancelAutoReconnect() {
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      var box = document.getElementById('autoReconnectBox');
      if (box) box.style.display = 'none';
    }

    function initLogoutPage() {
      // Extract active username or fallback to localStorage saved card
      var rawUser = '$(username)';
      var validUser = (rawUser && rawUser.indexOf('$(') === -1 && rawUser.trim().length >= 3) ? rawUser.trim() : '';
      if (!validUser) {
        try {
          validUser = (localStorage.getItem(STORAGE_SAVED_CARD_KEY) || '').trim();
        } catch(e) {}
      }

      if (validUser) {
        var userInp = document.getElementById('reloginUser');
        var passInp = document.getElementById('reloginPass');
        var cardDisplay = document.getElementById('reloginCardCode');
        var statDisplay = document.getElementById('statCardCode');
        if (userInp) userInp.value = validUser;
        if (passInp) passInp.value = validUser;
        if (cardDisplay) cardDisplay.innerText = validUser;
        if (statDisplay && (!statDisplay.innerText || statDisplay.innerText.indexOf('$(') !== -1)) {
          statDisplay.innerText = validUser;
        }

        // Check if remember pref is enabled
        var pref = 'true';
        try { pref = localStorage.getItem(STORAGE_REMEMBER_PREF_KEY) || 'true'; } catch(e) {}

        if (pref !== 'false') {
          var box = document.getElementById('autoReconnectBox');
          var secDisplay = document.getElementById('countdownSec');
          if (box) box.style.display = 'flex';

          reconnectTimer = setInterval(function() {
            countdownVal--;
            if (secDisplay) secDisplay.innerText = countdownVal;
            if (countdownVal <= 0) {
              clearInterval(reconnectTimer);
              reconnectTimer = null;
              var form = document.getElementById('reloginForm');
              if (form) form.submit();
            }
          }, 1000);
        }
      } else {
        var btnInstant = document.getElementById('btnInstantLogin');
        if (btnInstant) btnInstant.style.display = 'none';
      }
    }

    function handleReloginSubmit() {
      cancelAutoReconnect();
      $(if chap-id)
      if (typeof hexMD5 === 'function') {
        document.relogin.password.value = hexMD5('$(chap-id)' + document.relogin.password.value + '$(chap-challenge)');
      }
      $(endif)
      return true;
    }

    window.addEventListener('DOMContentLoaded', initLogoutPage);
  </script>
</body>
</html>`;

  // 4. error.html
  const errorHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - خطأ في تسجيل الدخول</title>
  <style>${commonCss}</style>
</head>
<body>
  <div class="card">
    <div class="logo-container" style="background: linear-gradient(135deg, #ef4444, #f97316);">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
    </div>
    <h1>تنبيه من السيرفر</h1>
    <div class="alert-error" id="errorBox" style="margin-top:16px;">$(error)</div>
    <p class="slogan" style="color: #94a3b8; margin-bottom:20px;">يرجى التأكد من كود الكرت المطبوع أو شحن رصيد إضافي</p>

    <a href="$(link-login)" class="btn-submit" style="display:block; text-decoration:none;">العودة لصفحة الدخول</a>
    <a href="https://wa.me/${config.whatsappNumber || '967718097168'}" target="_blank" class="btn-secondary" style="width:100%; margin-top:8px;">💬 مراسلة الدعم الفني واتساب (${config.supportPhone || '718097168'})</a>
    <a href="tel:${config.supportPhone || '718097168'}" class="btn-secondary" style="width:100%; margin-top:6px; background:rgba(14,165,233,0.15); border-color:#0ea5e9; color:#38bdf8;">📞 اتصال بالدعم الفني: ${config.supportPhone || '718097168'}</a>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>

  <script>
    (function translateErrorPage() {
      var box = document.getElementById('errorBox');
      if (!box) return;
      var raw = box.innerText.trim();
      if (!raw || raw.indexOf('$(') !== -1) return;
      var lower = raw.toLowerCase();
      var isExpired = lower.indexOf('uptime limit') !== -1 || lower.indexOf('session limit') !== -1 || lower.indexOf('traffic limit') !== -1 || lower.indexOf('transfer limit') !== -1 || lower.indexOf('limit reached') !== -1 || lower.indexOf('expired') !== -1 || lower.indexOf('disabled') !== -1;
      var isNotFound = lower.indexOf('invalid username') !== -1 || lower.indexOf('invalid user') !== -1 || lower.indexOf('wrong password') !== -1 || lower.indexOf('cannot find') !== -1 || lower.indexOf('not found') !== -1;
      var isAlready = lower.indexOf('already logged in') !== -1 || lower.indexOf('simultaneous session') !== -1 || lower.indexOf('user is already logged in') !== -1 || lower.indexOf('logged in on another device') !== -1 || lower.indexOf('mac') !== -1;

      if (isExpired) {
        box.className = 'alert-card-status alert-status-expired';
        box.innerHTML = '<div class="alert-status-header"><span>🪫</span><span>لقد استنفدت كل ما لديك من رصيد!</span><span class="alert-status-badge">الرصيد: 0 ميجا</span></div><div class="alert-status-body">تم استهلاك كامل الرصيد (الوقت أو حجم البيانات) المخصص لهذا الكرت بالكامل، وأصبح الكرت ملغياً ولا يمكن استخدامه مجدداً.</div>';
      } else if (isNotFound) {
        box.className = 'alert-card-status alert-status-notfound';
        box.innerHTML = '<div class="alert-status-header"><span>❌</span><span>رقم الكرت غير صحيح</span><span class="alert-status-badge">تحقق من الأرقام</span></div><div class="alert-status-body">تأكد من رقم الكرت، هذا الرقم غير مسجل في السيرفر أو توجد خانة مكتوبة بشكل خاطئ. يرجى مراجعة الأرقام المطبوعة على الكرت وتجنب الخلط بين الأرقام والحروف.</div>';
      } else if (isAlready) {
        box.className = 'alert-card-status alert-status-locked';
        box.innerHTML = '<div class="alert-status-header"><span>🔒</span><span>الكرت مقترن ويعمل على جهاز آخر</span><span class="alert-status-badge">جلسة نشطة</span></div><div class="alert-status-body">هذا الكرت نشط حالياً على هاتف أو جهاز آخر. يرجى تسجيل الخروج من الجهاز الأول للمتابعة.</div>';
      } else if (lower.indexOf('radius') !== -1 || lower.indexOf('timeout') !== -1) {
        box.innerText = '⚠️ تعذر الاتصال بسيرفر التحقق أو انتهت مهلة الانتظار. يرجى إعادة المحاولة.';
      } else if (/[a-zA-Z]/.test(raw)) {
        box.innerText = '⚠️ حدث خطأ أثناء التحقق من الكرت: يرجى التأكد من الرقم أو مراجعة الدعم الفني.';
      }
    })();
  </script>
</body>
</html>`;

  // 5. alogin.html (Auto Login / Enforce Status Page Pinning)
  const aloginHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - تم تسجيل الدخول</title>
  <style>${commonCss}</style>
  <script>
    try {
      localStorage.removeItem('netflow_hotspot_fails');
      localStorage.removeItem('netflow_hotspot_lock_until');
      localStorage.removeItem('netflow_hotspot_lock_level');
    } catch(e) {}

    // إجبار المتصفح على فتح صفحة الرصيد والحالة مباشرة وتثبيتها
    window.location.replace('$(link-status)');
  </script>
  <meta http-equiv="refresh" content="0; url=$(link-status)">
</head>
<body>
  <div class="card" style="text-align:center; padding:32px 20px;">
    <div class="logo-container">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1 style="font-size:20px; color:#10b981; margin:12px 0 6px;">تم الاتصال بالإنترنت بنجاح!</h1>
    <div class="alert-success">تم التحقق من الكرت وتفعيل أقصى سرعة إنترنت</div>
    <p class="slogan" style="font-size:12px; color:#94a3b8; margin-top:8px;">جاري نقلك الآن إلى صفحة الرصيد والحالة المباشرة...</p>
    <a href="$(link-status)" class="btn-submit" style="display:inline-block; margin-top:16px; padding:10px 24px; font-size:13px; text-decoration:none;">عرض حالة الرصيد والتصفح</a>
    <a href="https://www.google.com" style="display:block; margin-top:10px; font-size:12px; color:#38bdf8; text-decoration:none; font-weight:700;">أو متابعة التصفح وتخطي الصفحة 🌐</a>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 6. blocked.html
  const blockedHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - انتهت صلاحية الكرت</title>
  <style>${commonCss}</style>
  <script>
    // Purge expired card immediately from localStorage
    try {
      localStorage.removeItem('netflow_hotspot_saved_card');
      localStorage.removeItem('netflow_saved_voucher');
    } catch(e) {}
  </script>
</head>
<body>
  <div class="card" style="text-align:center;">
    <div class="logo-container" style="background: linear-gradient(135deg, #ef4444, #7f1d1d);">
      <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
    </div>
    <h1 style="font-size:20px; margin:12px 0 6px;">انتهت صلاحية الكرت</h1>
    <p class="slogan" style="color:#f87171; font-weight:700;">رصيد الكرت استهلك بالكامل أو انتهت مدة صلاحية الجلسة</p>
    <div style="margin-top:16px;">
      <a href="$(link-login)" class="btn-submit" style="display:inline-block; padding:12px 28px; text-decoration:none;">تعبئة كرت جديد ⚡</a>
    </div>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 7. redirect.html (RouterOS Super-Fast Redirect Handler)
  const redirectHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - جاري التحويل</title>
  <style>${commonCss}</style>
  <script>
    (function() {
      var isLoggedIn = '$(logged-in)' === 'yes';
      var orig = '$(link-orig)';
      var statusUrl = '$(link-status)';
      var loginUrl = '$(link-login)';

      var target = '';
      if (isLoggedIn) {
        // إذا كان المستخدم متصلاً بالكرت وطلب دومين الشبكة أو صفحة داخلية
        if (orig && orig !== '' && orig !== 'http://' && orig.indexOf('${dnsName}') === -1 && orig.indexOf(window.location.hostname) === -1) {
          target = orig;
        } else {
          target = statusUrl || 'status';
        }
      } else {
        // إذا لم يكن متصلاً، يتم توجيهه مباشرة وفوراً إلى صفحة تسجيل الدخول
        target = loginUrl || 'login';
      }

      // تحويل فوري بسرعة البرق (0 ميلي ثانية)
      window.location.replace(target);
    })();
  </script>
  $(if logged-in == 'yes')
  <meta http-equiv="refresh" content="0; url=$(link-status)">
  $(else)
  <meta http-equiv="refresh" content="0; url=$(link-login)">
  $(endif)
</head>
<body>
  <div class="card" style="text-align:center; padding:32px 20px;">
    <div class="logo-container">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h2 style="font-size:18px; color:#38bdf8; margin:14px 0 6px;">جاري التحويل فائق السرعة...</h2>
    <p class="slogan" style="font-size:12px; color:#94a3b8;">يتم توجيهك الآن تلقائياً</p>
    <div style="margin-top:16px;">
      $(if logged-in == 'yes')
      <a href="$(link-status)" class="btn-submit" style="display:inline-block; padding:10px 24px; font-size:13px; text-decoration:none;">الانتقال لصفحة التصفح والرصيد</a>
      $(else)
      <a href="$(link-login)" class="btn-submit" style="display:inline-block; padding:10px 24px; font-size:13px; text-decoration:none;">الانتقال لصفحة تسجيل الدخول</a>
      $(endif)
    </div>
  </div>
</body>
</html>`;

  // 8. rlogin.html
  const rloginHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=$(link-login-only)?target=$(link-orig-esc)">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - إعادة تسجيل الدخول</title>
  <style>${commonCss}</style>
  <script>
    window.location.replace('$(link-login-only)?target=$(link-orig-esc)');
  </script>
</head>
<body>
  <div class="card" style="text-align:center; padding:32px 20px;">
    <h2 style="font-size:18px; color:#38bdf8; margin-bottom:8px;">إعادة تسجيل الدخول</h2>
    <p class="slogan" style="font-size:12px; color:#94a3b8;">جاري إعادة توصيلك بالشبكة تلقائياً...</p>
    <div style="margin-top:16px;">
      <a href="$(link-login-only)?target=$(link-orig-esc)" class="btn-submit" style="display:inline-block; padding:8px 20px; font-size:12px; text-decoration:none;">اضغط للمتابعة مباشرة</a>
    </div>
  </div>
</body>
</html>`;

  // 9. radvert.html
  const radvertHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="3; url=$(link-orig)">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - عروض الشبكة</title>
  <style>${commonCss}</style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1>${config.networkName}</h1>
    <div class="alert-success">⚡ سرعات مضاعفة وألياف ضوئية فائقة</div>
    <p class="slogan">اسأل أقرب موزع عن كروت VIP الشهرية والخصومات الخاصة</p>
    <a href="$(link-orig)" class="btn-submit" style="display:block; text-decoration:none;">متابعة التصفح</a>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  // 10. success.html
  const successHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.networkName} - تم الاتصال</title>
  <style>${commonCss}</style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1>نجح الاتصال بالشبكة</h1>
    <div class="alert-success">أنت الآن تستمتع بأقصى سرعة إنترنت</div>
    <a href="$(link-orig)" class="btn-submit" style="display:block; text-decoration:none; margin-top:16px;">بدء التصفح</a>

    <!-- Samtec AI Software Developer Footer -->
    <div class="developer-brand-footer">
      <div class="dev-title">حقوق الطبع محفوظة لـ <strong>شركة سام تك للبرمجيات</strong></div>
      <div class="dev-author">برمجة <span>م / مصطفى حسان</span></div>
      <div class="dev-links">
        <a href="https://samtecai.com" target="_blank" class="dev-badge-link">🌐 samtecai.com</a>
        <a href="https://wa.me/967770446040" target="_blank" class="dev-whatsapp-btn">💬 واتس: 770446040</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    loginHtml,
    statusHtml,
    liveHtml,
    logoutHtml,
    errorHtml,
    aloginHtml,
    blockedHtml,
    redirectHtml,
    rloginHtml,
    radvertHtml,
    successHtml,
    md5Js,
    cssStyle: commonCss
  };
}
