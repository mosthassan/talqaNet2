import { VoucherRecord, calculateAIEstimate, getCardsLedger, saveCardsLedger } from './cardsDatabase';
import { CardPackage } from '../types';

export interface ParseResult {
  totalFound: number;
  added: number;
  updated: number;
  skipped: number;
  cards: VoucherRecord[];
  batchName?: string;
  errors: string[];
}

/**
 * Parses bytes string like "2G", "500M", "1073741824" into numeric bytes
 */
export function parseBytesString(val: string): number {
  if (!val) return 0;
  const clean = val.trim().toUpperCase();
  if (clean.endsWith('G') || clean.endsWith('GB')) {
    return parseFloat(clean) * 1024 * 1024 * 1024;
  }
  if (clean.endsWith('M') || clean.endsWith('MB')) {
    return parseFloat(clean) * 1024 * 1024;
  }
  if (clean.endsWith('K') || clean.endsWith('KB')) {
    return parseFloat(clean) * 1024;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses time string like "10h", "1d", "30m", "01:00:00" into numeric seconds
 */
export function parseSecondsString(val: string): number {
  if (!val) return 0;
  const clean = val.trim().toLowerCase();
  
  if (clean.includes(':')) {
    const parts = clean.split(':').map(Number);
    if (parts.length === 3) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    if (parts.length === 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
  }

  let total = 0;
  const daysMatch = clean.match(/(\d+)\s*d/);
  const hoursMatch = clean.match(/(\d+)\s*h/);
  const minsMatch = clean.match(/(\d+)\s*m/);
  const secsMatch = clean.match(/(\d+)\s*s/);

  if (daysMatch) total += parseInt(daysMatch[1], 10) * 86400;
  if (hoursMatch) total += parseInt(hoursMatch[1], 10) * 3600;
  if (minsMatch) total += parseInt(minsMatch[1], 10) * 60;
  if (secsMatch) total += parseInt(secsMatch[1], 10);

  if (total === 0) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return total;
}

export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
            .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

/**
 * Preprocesses MikroTik script lines:
 * - Converts Arabic digits to standard digits
 * - Merges multiline commands wrapped with backslash `\`
 * - Strips leading RouterOS CLI prefixes (`\=`, `\`, `/ip hotspot user`)
 */
export function preprocessMikrotikScript(content: string): string[] {
  const normalized = normalizeArabicDigits(content);
  const rawLines = normalized.split(/\r?\n/);
  const joinedLines: string[] = [];
  let current = '';

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line === '/ip hotspot user') {
      continue;
    }

    // Strip leading `\=` or `\` or RouterOS CLI prompt artifacts
    line = line.replace(/^[\\=]+/, '').trim();

    if (current) {
      current += ' ' + line;
    } else {
      current = line;
    }

    if (current.endsWith('\\')) {
      current = current.slice(0, -1).trim();
    } else {
      joinedLines.push(current);
      current = '';
    }
  }

  if (current) {
    joinedLines.push(current);
  }

  return joinedLines;
}

/**
 * Safely extracts a named attribute from a MikroTik RouterOS command line.
 * Handles both quoted: `comment="My Batch"` and unquoted: `comment=NetFlow-B-120`
 */
export function getMikrotikAttr(line: string, key: string): string | null {
  const regex = new RegExp(`(?:^|\\s)${key}\\s*=\\s*(?:"([^"]*)"|([^\\s]+))`, 'i');
  const match = line.match(regex);
  if (!match) return null;
  return (match[1] !== undefined ? match[1] : match[2])?.trim() ?? null;
}

/**
 * Smart MikroTik .rsc / CSV / Text Parser with full multiline and RouterOS v6/v7 support
 */
export function parseMikrotikFileContent(
  content: string, 
  defaultPackage: CardPackage,
  distributorName: string = 'استيراد مايكروتك',
  availablePackages?: CardPackage[]
): ParseResult {
  const lines = preprocessMikrotikScript(content);
  const cards: VoucherRecord[] = [];
  const errors: string[] = [];
  let totalFound = 0;
  let detectedBatchName: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: MikroTik RouterOS Script / command
    // e.g. \=add comment=NetFlow-B-120 limit-bytes-total=3000000000 name=1494170 profile=4000
    const codeFromAttr = getMikrotikAttr(line, 'name') || getMikrotikAttr(line, 'user') || getMikrotikAttr(line, 'code');
    const isMikrotikCmd = line.includes('add') || line.includes('name=') || line.includes('comment=') || !!codeFromAttr;

    if (isMikrotikCmd && codeFromAttr) {
      totalFound++;
      try {
        const code = codeFromAttr;
        const profile = getMikrotikAttr(line, 'profile') || defaultPackage.name;
        const rawBytes = getMikrotikAttr(line, 'limit-bytes-total') || getMikrotikAttr(line, 'bytes-out') || getMikrotikAttr(line, 'bytes');
        const rawUptime = getMikrotikAttr(line, 'limit-uptime') || getMikrotikAttr(line, 'uptime');
        const comment = getMikrotikAttr(line, 'comment') || '';

        if (comment && !detectedBatchName) {
          detectedBatchName = comment;
        }

        const totalBytes = rawBytes ? parseBytesString(rawBytes) : (defaultPackage.dataLimitMB * 1024 * 1024);
        const totalSeconds = rawUptime ? parseSecondsString(rawUptime) : (12 * 3600);

        // Resolve package and pricing
        let matchedPkg = defaultPackage;
        let price = defaultPackage.price;
        let packageName = profile;

        if (availablePackages && availablePackages.length > 0) {
          const found = availablePackages.find(
            (p) => p.name.toLowerCase() === profile.toLowerCase() ||
                   String(p.price) === profile ||
                   p.id === profile ||
                   p.name.includes(profile)
          );
          if (found) {
            matchedPkg = found;
            price = found.price;
            packageName = found.name;
          }
        }

        // Check if profile itself is numeric price (e.g. profile=4000 or 1000)
        if (price === defaultPackage.price && /^\d+$/.test(profile)) {
          const numPrice = parseInt(profile, 10);
          if (numPrice >= 100) {
            price = numPrice;
            if (packageName === defaultPackage.name) {
              packageName = `باقة ${numPrice} ريال`;
            }
          }
        }

        // Extract price from comment if mentioned
        if (comment) {
          const priceMatch = comment.match(/(\d+)\s*(?:ريال|ر\.ي|YER|YR)/i);
          if (priceMatch) price = parseInt(priceMatch[1], 10);
        }

        const est = calculateAIEstimate(totalBytes, totalSeconds, 30);
        cards.push({
          code,
          serialNumber: `MT-${code}`,
          packageId: matchedPkg.id,
          packageName,
          price,
          currency: matchedPkg.currency || 'ر.ي',
          totalBytes,
          usedBytes: 0,
          remainingBytes: totalBytes,
          totalSeconds,
          usedSeconds: 0,
          remainingSeconds: totalSeconds,
          speedLimit: matchedPkg.speedLimitLabel || 'أقصى سرعة فايبر',
          status: 'new',
          statusText: 'جاهز للاستخدام',
          expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
          validityDays: 30,
          distributorName: comment ? `${distributorName} (${comment})` : distributorName,
          source: 'mikrotik_file',
          batchNumber: comment || 'MT-IMPORT',
          aiEstimate: est
        });
      } catch (err: any) {
        errors.push(`السطر ${i + 1}: خطأ في تحليل الأمر - ${err.message}`);
      }
      continue;
    }

    // Pattern 2: CSV / Tab separated format
    // e.g. 1001,1001,كرت 500,2000MB,10h,500
    if (line.includes(',') || line.includes('\t') || line.includes(';')) {
      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 1 && parts[0].length >= 3) {
        totalFound++;
        const code = parts[0];
        const packageName = parts[2] || defaultPackage.name;
        const totalBytes = parts[3] ? parseBytesString(parts[3]) : (defaultPackage.dataLimitMB * 1024 * 1024);
        const totalSeconds = parts[4] ? parseSecondsString(parts[4]) : (12 * 3600);
        const price = parts[5] ? parseFloat(parts[5]) : defaultPackage.price;
        const est = calculateAIEstimate(totalBytes, totalSeconds, 30);

        cards.push({
          code,
          serialNumber: `CSV-${code}`,
          packageId: defaultPackage.id,
          packageName,
          price: isNaN(price) ? defaultPackage.price : price,
          currency: defaultPackage.currency || 'ر.ي',
          totalBytes,
          usedBytes: 0,
          remainingBytes: totalBytes,
          totalSeconds,
          usedSeconds: 0,
          remainingSeconds: totalSeconds,
          speedLimit: defaultPackage.speedLimitLabel || 'أقصى سرعة فايبر',
          status: 'new',
          statusText: 'جاهز للاستخدام',
          expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
          validityDays: 30,
          distributorName,
          source: 'mikrotik_file',
          batchNumber: 'CSV-IMPORT',
          aiEstimate: est
        });
        continue;
      }
    }

    // Pattern 3: Simple plain codes list (e.g. one code per line)
    // e.g. 50012345
    if (/^[a-zA-Z0-9_-]{3,20}$/.test(line)) {
      totalFound++;
      const code = line;
      const totalBytes = defaultPackage.dataLimitMB * 1024 * 1024;
      const totalSeconds = 12 * 3600;
      const est = calculateAIEstimate(totalBytes, totalSeconds, 30);

      cards.push({
        code,
        serialNumber: `SN-${code}`,
        packageId: defaultPackage.id,
        packageName: defaultPackage.name,
        price: defaultPackage.price,
        currency: defaultPackage.currency || 'ر.ي',
        totalBytes,
        usedBytes: 0,
        remainingBytes: totalBytes,
        totalSeconds,
        usedSeconds: 0,
        remainingSeconds: totalSeconds,
        speedLimit: defaultPackage.speedLimitLabel || 'أقصى سرعة فايبر',
        status: 'new',
        statusText: 'جاهز للاستخدام',
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
        validityDays: 30,
        distributorName,
        source: 'mikrotik_file',
        batchNumber: 'CODE-IMPORT',
        aiEstimate: est
      });
    }
  }

  // Merge into database (unlimited capacity)
  const existingLedger = getCardsLedger();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of cards) {
    if (existingLedger[c.code]) {
      existingLedger[c.code] = {
        ...existingLedger[c.code],
        packageName: c.packageName,
        price: c.price,
        totalBytes: c.totalBytes,
        remainingBytes: c.totalBytes - (existingLedger[c.code].usedBytes || 0),
        batchNumber: c.batchNumber || existingLedger[c.code].batchNumber,
        source: 'mikrotik_file'
      };
      updated++;
    } else {
      existingLedger[c.code] = c;
      added++;
    }
  }

  saveCardsLedger(existingLedger);

  return {
    totalFound,
    added,
    updated,
    skipped,
    cards,
    batchName: detectedBatchName,
    errors
  };
}
