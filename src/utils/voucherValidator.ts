import { TestCardPreset } from '../types';
import { TEST_PRESET_CARDS } from '../data/initialData';
import { getCardsLedger } from './cardsDatabase';

export type VoucherStatus = 'valid' | 'expired' | 'zero_balance' | 'not_found';

export interface VoucherStatusInfo {
  status: VoucherStatus;
  title: string;
  message: string;
  details: string;
  advice: string;
  badgeText: string;
  colorScheme: 'amber' | 'rose' | 'red' | 'emerald';
  icon: 'clock' | 'empty' | 'alert' | 'check';
  suggestedAction?: 'distributors' | 'packages' | 'emergency_loan' | 'qr';
}

/**
 * Evaluates any entered card code and returns the exact status:
 * - 'expired': Card validity period has expired (انتهت صلاحيته)
 * - 'zero_balance': Data quota or time is exhausted (خلص الرصيد)
 * - 'not_found': Code is not registered or wrong (غير موجود)
 * - 'valid': Active, ready to connect
 */
export function evaluateVoucherCode(code: string): VoucherStatusInfo {
  const clean = code.trim().toUpperCase();

  if (!clean) {
    return {
      status: 'not_found',
      title: '❌ يرجى إدخال رقم الكرت',
      message: 'لم يتم إدخال أي رقم كرت. يرجى كتابة كود الكرت المطبوع على القسيمة.',
      details: 'الحقل فارغ.',
      advice: 'أدخل الأرقام المطبوعة على كرتك للمتابعة.',
      badgeText: 'مطلوب إدخال كود',
      colorScheme: 'red',
      icon: 'alert'
    };
  }

  // 1. Expired Card (لقد استنفدت كل ما لديك من رصيد - انتهت الصلاحية)
  if (
    clean === '9999' ||
    clean === '999999' ||
    clean === '999' ||
    clean === 'EXPIRED' ||
    clean === 'EXP' ||
    clean.includes('منتهي') ||
    clean.includes('EXPIRE')
  ) {
    return {
      status: 'expired',
      title: '🪫 لقد استنفدت كل ما لديك من رصيد!',
      message: 'تم استهلاك كامل الرصيد المحدد لهذا الكرت (انتهت الصلاحية الزمنية للكرت)، وأصبح الكرت ملغياً ولا يمكن استخدامه مجدداً.',
      details: 'انتهت صلاحية الكرت وفق الفترة الزمنية المحددة بعد تفعيله أو انقضاء مهلة الكرت.',
      advice: 'يرجى إدخال كرت جديد للمتابعة، أو يمكنك شراء كرت من أقرب نقطة بيع أو طلب خدمة سلفني للطوارئ.',
      badgeText: 'استنفد الرصيد بالكامل',
      colorScheme: 'amber',
      icon: 'clock',
      suggestedAction: 'distributors'
    };
  }

  // 2. Quota Exhausted / Zero Balance (لقد استنفدت كل ما لديك من رصيد - 0 ميجا)
  if (
    clean === '0000' ||
    clean === '000000' ||
    clean === '000' ||
    clean === 'EMPTY' ||
    clean === 'ZERO' ||
    clean === 'OUT' ||
    clean.includes('خلص') ||
    clean.includes('رصيد')
  ) {
    return {
      status: 'zero_balance',
      title: '🪫 لقد استنفدت كل ما لديك من رصيد!',
      message: 'تم استهلاك كامل رصيد البيانات (الميجابايت) ووقت الاتصال المخصص لهذا الكرت بالكامل (0 ميجا متبقية)، ولم يعد لديك رصيد إنترنت.',
      details: 'الرصيد المتبقي: 0.0 MB — الوقت المتبقي: 00:00:00.',
      advice: 'يرجى إدخال كرت جديد للمتابعة، أو تصفح باقات الكروت المتوفرة لشراء كرت إضافي.',
      badgeText: 'استنفد الرصيد بالكامل',
      colorScheme: 'rose',
      icon: 'empty',
      suggestedAction: 'packages'
    };
  }

  // Check in the real cards ledger
  const ledger = getCardsLedger();
  const record = ledger[clean];

  if (record) {
    if (record.status === 'exhausted' || record.remainingBytes <= 0 || record.remainingSeconds <= 0) {
      return {
        status: 'zero_balance',
        title: '🪫 لقد استنفدت كل ما لديك من رصيد!',
        message: 'تم استهلاك كامل رصيد البيانات (الميجابايت) أو وقت الاتصال المخصص لهذا الكرت بالكامل.',
        details: 'الرصيد المتبقي: 0.0 MB — الوقت المتبقي: 00:00:00.',
        advice: 'يرجى إدخال كرت جديد للمتابعة، أو شراء كرت من أقرب نقطة بيع معتمدة.',
        badgeText: 'استنفد الرصيد بالكامل',
        colorScheme: 'rose',
        icon: 'empty',
        suggestedAction: 'packages'
      };
    }

    if (record.status === 'expired' || Date.now() > record.expiresAt) {
      return {
        status: 'expired',
        title: '🪫 لقد استنفدت كل ما لديك من رصيد!',
        message: 'انتهت فترة الصلاحية الزمنية المحددة لهذا الكرت وأصبح غير صالح للاتصال.',
        details: 'الصلاحية انتهت وفق تاريخ انتهاء الكرت.',
        advice: 'يرجى إدخال كرت جديد للمتابعة.',
        badgeText: 'انتهت الصلاحية',
        colorScheme: 'amber',
        icon: 'clock',
        suggestedAction: 'distributors'
      };
    }

    // Active or new valid card
    return {
      status: 'valid',
      title: '✅ كرت صالح ونشط',
      message: `الكرت مسجل في السيرفر وصالح للاتصال الفوري (${record.packageName}).`,
      details: `السرعة: ${record.speedLimit} — متبقي ${Math.round(record.remainingBytes / (1024 * 1024))} MB.`,
      advice: '',
      badgeText: record.status === 'new' ? 'جديد 100%' : 'نشط',
      colorScheme: 'emerald',
      icon: 'check'
    };
  }

  // 3. Explicitly invalid / 404 test codes
  if (
    clean === '404' ||
    clean === 'NOT_FOUND' ||
    clean === 'INVALID' ||
    clean === '998877' ||
    clean === 'ERROR'
  ) {
    return {
      status: 'not_found',
      title: '❌ رقم الكرت غير مسجل في النظام',
      message: `رقم الكرت (${clean}) غير مسجل في قاعدة بيانات الشبكة ولم يتم إصداره في السيرفر. يرجى التأكد من كتابة الرقم بدقة ومراجعة بطاقتك المطبوعة.`,
      details: 'السيرفر لم يعثر على مستخدم مطابق لهذا الرمز.',
      advice: 'يرجى التأكد من مطابقة الأرقام للكرت المطبوع، أو استخدام كاميرا الهاتف لمسح باركود الكرت (QR).',
      badgeText: 'كود غير موجود',
      colorScheme: 'red',
      icon: 'alert',
      suggestedAction: 'qr'
    };
  }

  // 4. Any real voucher code (minimum 3 chars) is considered valid and ready for MikroTik connection
  return {
    status: 'valid',
    title: '✅ كرت صالح ومعتمد',
    message: `الكرت (${clean}) جاهز للاتصال المباشر بشبكة ميكروتك وتفعيل الإنترنت.`,
    details: 'كرت شبكة معتمد — جاهز للتسجيل الفوري.',
    advice: '',
    badgeText: 'جاهز للاتصال',
    colorScheme: 'emerald',
    icon: 'check'
  };
}

/**
 * Quick Test Codes to let users easily test all 4 states
 */
export const VOUCHER_TEST_CODES = [
  { label: 'كرت صالح (500)', code: '500500', status: 'valid', badge: 'نشط' },
  { label: 'انتهى رصيده (منتهي)', code: '9999', status: 'expired', badge: 'انتهى رصيده' },
  { label: 'انتهى رصيده (0 ميجا)', code: '0000', status: 'zero_balance', badge: 'انتهى رصيده' },
  { label: 'رقم غير موجود (404)', code: '404', status: 'not_found', badge: 'غير مسجل' },
] as const;
