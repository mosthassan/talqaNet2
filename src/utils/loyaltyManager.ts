import { 
  LoyaltyBurnedCard, 
  LoyaltyPrizeTier, 
  LoyaltyPrizeVoucher, 
  LoyaltyTransaction 
} from '../types';
import { getCardsLedger, saveCardsLedger, generateDeterministicCard, inspectCardLive } from './cardsDatabase';
import { getStoredPackages } from './packagesStorage';

const BURNED_CARDS_STORAGE_KEY = 'talqa_loyalty_burned_cards';
const PRIZE_VAULT_STORAGE_KEY = 'talqa_loyalty_prize_vault';
const PRIZE_TIERS_STORAGE_KEY = 'talqa_loyalty_prize_tiers';
const USER_WALLET_STORAGE_KEY = 'talqa_loyalty_user_wallet';
const TRANSACTIONS_STORAGE_KEY = 'talqa_loyalty_transactions';

// Default Loyalty Prize Tiers with balanced marketing probability
export const DEFAULT_PRIZE_TIERS: LoyaltyPrizeTier[] = [
  {
    id: 'tier_1000',
    name: 'كرت 1000 ريال طلقة',
    price: 1000,
    color: '#0ea5e9', // Sky blue
    textColor: '#ffffff',
    probabilityWeight: 45, // 45%
    dataLabel: '1.5 جيجابايت',
    durationLabel: '6 ساعات تصفح',
    iconName: 'Zap'
  },
  {
    id: 'tier_2000',
    name: 'كرت 2000 ريال برو',
    price: 2000,
    color: '#10b981', // Emerald green
    textColor: '#ffffff',
    probabilityWeight: 30, // 30%
    dataLabel: '3 جيجابايت',
    durationLabel: '15 ساعة تصفح',
    iconName: 'Sparkles'
  },
  {
    id: 'tier_5gb',
    name: 'باقة 5GB إكسترا',
    price: 2500,
    color: '#8b5cf6', // Violet
    textColor: '#ffffff',
    probabilityWeight: 15, // 15%
    dataLabel: '5 جيجابايت',
    durationLabel: '24 ساعة تصفح',
    iconName: 'Layers'
  },
  {
    id: 'tier_4000',
    name: 'كرت 4000 VIP الذهبي',
    price: 4000,
    color: '#f59e0b', // Amber gold
    textColor: '#0f172a',
    probabilityWeight: 10, // 10%
    dataLabel: '30 جيجابايت فايبر',
    durationLabel: '30 يوم مفتوح',
    iconName: 'Crown'
  }
];

// Initial seeded vouchers in the vault so the user can test and play immediately
const INITIAL_SEEDED_VAULT: LoyaltyPrizeVoucher[] = [
  {
    id: 'pv_101',
    tierId: 'tier_1000',
    tierName: 'كرت 1000 ريال طلقة',
    code: 'TLQ-1000-' + Math.floor(100000 + Math.random() * 900000),
    price: 1000,
    dataLabel: '1.5 جيجابايت',
    durationLabel: '6 ساعات تصفح',
    claimed: false
  },
  {
    id: 'pv_102',
    tierId: 'tier_1000',
    tierName: 'كرت 1000 ريال طلقة',
    code: 'TLQ-1000-' + Math.floor(100000 + Math.random() * 900000),
    price: 1000,
    dataLabel: '1.5 جيجابايت',
    durationLabel: '6 ساعات تصفح',
    claimed: false
  },
  {
    id: 'pv_201',
    tierId: 'tier_2000',
    tierName: 'كرت 2000 ريال برو',
    code: 'TLQ-2000-' + Math.floor(100000 + Math.random() * 900000),
    price: 2000,
    dataLabel: '3 جيجابايت',
    durationLabel: '15 ساعة تصفح',
    claimed: false
  },
  {
    id: 'pv_501',
    tierId: 'tier_5gb',
    tierName: 'باقة 5GB إكسترا',
    code: 'TLQ-5GB-' + Math.floor(100000 + Math.random() * 900000),
    price: 2500,
    dataLabel: '5 جيجابايت',
    durationLabel: '24 ساعة تصفح',
    claimed: false
  },
  {
    id: 'pv_401',
    tierId: 'tier_4000',
    tierName: 'كرت 4000 VIP الذهبي',
    code: 'TLQ-VIP-' + Math.floor(100000 + Math.random() * 900000),
    price: 4000,
    dataLabel: '30 جيجابايت فايبر',
    durationLabel: '30 يوم مفتوح',
    claimed: false
  }
];

// Read burned cards ledger (anti-duplicate)
export function getBurnedCardsLedger(): Record<string, LoyaltyBurnedCard> {
  try {
    const raw = localStorage.getItem(BURNED_CARDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBurnedCardsLedger(ledger: Record<string, LoyaltyBurnedCard>): void {
  try {
    localStorage.setItem(BURNED_CARDS_STORAGE_KEY, JSON.stringify(ledger));
  } catch {}
}

// Check if a card has already been burned/redeemed in the loyalty system
export function isCardBurned(code: string): boolean {
  const clean = code.trim().toUpperCase();
  const ledger = getBurnedCardsLedger();
  return Boolean(ledger[clean]);
}

// Get prize tiers
export function getLoyaltyPrizeTiers(): LoyaltyPrizeTier[] {
  try {
    const raw = localStorage.getItem(PRIZE_TIERS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRIZE_TIERS;
    const tiers = JSON.parse(raw);
    return Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_PRIZE_TIERS;
  } catch {
    return DEFAULT_PRIZE_TIERS;
  }
}

export function saveLoyaltyPrizeTiers(tiers: LoyaltyPrizeTier[]): void {
  try {
    localStorage.setItem(PRIZE_TIERS_STORAGE_KEY, JSON.stringify(tiers));
  } catch {}
}

// Get admin prize vault
export function getPrizeVault(): LoyaltyPrizeVoucher[] {
  try {
    const raw = localStorage.getItem(PRIZE_VAULT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PRIZE_VAULT_STORAGE_KEY, JSON.stringify(INITIAL_SEEDED_VAULT));
      return INITIAL_SEEDED_VAULT;
    }
    const vault = JSON.parse(raw);
    return Array.isArray(vault) ? vault : INITIAL_SEEDED_VAULT;
  } catch {
    return INITIAL_SEEDED_VAULT;
  }
}

export function savePrizeVault(vault: LoyaltyPrizeVoucher[]): void {
  try {
    localStorage.setItem(PRIZE_VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {}
}

// Get user won wallet
export function getUserWonWallet(): LoyaltyPrizeVoucher[] {
  try {
    const raw = localStorage.getItem(USER_WALLET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserWonWallet(wallet: LoyaltyPrizeVoucher[]): void {
  try {
    localStorage.setItem(USER_WALLET_STORAGE_KEY, JSON.stringify(wallet));
  } catch {}
}

// Get transactions log
export function getLoyaltyTransactions(): LoyaltyTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLoyaltyTransactions(txs: LoyaltyTransaction[]): void {
  try {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(txs));
  } catch {}
}

// Verification result interface for a single loyalty voucher
export interface VoucherVerificationResult {
  code: string;
  valid: boolean;
  reason?: 'valid' | 'burned' | 'not_found' | 'unused_fresh' | 'invalid_format';
  message: string;
  details?: {
    packageName: string;
    price: number;
    usedBytesFormatted?: string;
    usedTimeFormatted?: string;
    burnedAtDate?: string;
  };
}

/**
 * Verify a single voucher card for loyalty redemption
 */
export function verifyVoucherForLoyalty(rawCode: string): VoucherVerificationResult {
  const clean = rawCode.trim().toUpperCase();
  if (!clean || clean.length < 3) {
    return {
      code: clean,
      valid: false,
      reason: 'invalid_format',
      message: 'كود الكرت غير مكتمل أو فارغ'
    };
  }

  // 1. Check if card was ALREADY burned/redeemed in loyalty program
  const burnedLedger = getBurnedCardsLedger();
  if (burnedLedger[clean]) {
    const record = burnedLedger[clean];
    const dateStr = new Date(record.redeemedAt).toLocaleDateString('ar-YE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      code: clean,
      valid: false,
      reason: 'burned',
      message: `هذا الكرت تم استبداله مسبقاً في برنامج الولاء بتاريخ (${dateStr})`,
      details: {
        packageName: record.packageName || 'كرت طلقة نت',
        price: record.price || 0,
        burnedAtDate: dateStr
      }
    };
  }

  // 2. Check local network database ledger
  const ledger = getCardsLedger();
  const dbRecord = ledger[clean];

  if (dbRecord) {
    // If the card is completely fresh/unused, warn the user to protect their active money
    const isBrandNew = (dbRecord.usedBytes || 0) === 0 && (dbRecord.usedSeconds || 0) === 0 && dbRecord.status === 'new';
    
    // We allow used or exhausted or expired cards, but if brand new we still permit it with notification
    return {
      code: clean,
      valid: true,
      reason: 'valid',
      message: isBrandNew 
        ? 'كرت معتمد في الشبكة (جاهز للاستبدال)' 
        : 'كرت مستهلك معتمد في الشبكة',
      details: {
        packageName: dbRecord.packageName,
        price: dbRecord.price,
        usedBytesFormatted: dbRecord.usedBytes > 0 ? `${Math.round(dbRecord.usedBytes / (1024 * 1024))} MB` : 'مستهلك بالكامل',
        usedTimeFormatted: `${Math.round(dbRecord.usedSeconds / 60)} دقيقة`
      }
    };
  }

  // 3. Fallback: Check if the card exists in network inspection or test vouchers
  const liveCheck = inspectCardLive(clean);
  if (liveCheck && liveCheck.valid) {
    return {
      code: clean,
      valid: true,
      reason: 'valid',
      message: 'كرت معتمد في شبكة طلقة نت',
      details: {
        packageName: liveCheck.planName || 'كرت طلقة نت',
        price: liveCheck.price || 500,
        usedBytesFormatted: liveCheck.usedDataFormatted || 'مستهلك في الشبكة',
        usedTimeFormatted: liveCheck.usedTimeFormatted
      }
    };
  }

  return {
    code: clean,
    valid: false,
    reason: 'not_found',
    message: 'هذا الكرت غير مسجل في شبكة طلقة نت ولم يصدر من سيرفراتنا'
  };
}

/**
 * Execute the Weighted Random Draw to select a prize tier based on odds
 */
export function spinFortuneWheel(): LoyaltyPrizeTier {
  const tiers = getLoyaltyPrizeTiers();
  const totalWeight = tiers.reduce((sum, t) => sum + (t.probabilityWeight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const tier of tiers) {
    if (random < tier.probabilityWeight) {
      return tier;
    }
    random -= tier.probabilityWeight;
  }

  return tiers[0] || DEFAULT_PRIZE_TIERS[0];
}

/**
 * Redeem 10 cards and claim the won prize voucher
 */
export function redeemLoyaltyReward(
  cards: string[], 
  wonTier: LoyaltyPrizeTier
): { success: boolean; voucher: LoyaltyPrizeVoucher; transaction: LoyaltyTransaction } {
  const timestamp = Date.now();
  const transactionId = 'TRX-' + Math.floor(10000000 + Math.random() * 90000000);
  const cleanCards = cards.map(c => c.trim().toUpperCase());

  // 1. Burn all 10 cards in the permanent ledger
  const burnedLedger = getBurnedCardsLedger();
  cleanCards.forEach(c => {
    burnedLedger[c] = {
      code: c,
      redeemedAt: timestamp,
      transactionId,
      packageName: wonTier.name,
      price: wonTier.price
    };
  });
  saveBurnedCardsLedger(burnedLedger);

  // 2. Select or generate prize voucher from vault
  const vault = getPrizeVault();
  // Find unclaimed voucher matching the tier
  const availableIdx = vault.findIndex(v => v.tierId === wonTier.id && !v.claimed);
  
  let wonVoucher: LoyaltyPrizeVoucher;

  if (availableIdx >= 0) {
    // Claim existing voucher from inventory
    vault[availableIdx].claimed = true;
    vault[availableIdx].claimedAt = timestamp;
    vault[availableIdx].wonByTransactionId = transactionId;
    wonVoucher = vault[availableIdx];
    savePrizeVault(vault);
  } else {
    // Generate an authentic guaranteed digital voucher for this tier
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    wonVoucher = {
      id: 'won_' + timestamp,
      tierId: wonTier.id,
      tierName: wonTier.name,
      code: `TLQ-${wonTier.price}-${randomDigits}`,
      price: wonTier.price,
      dataLabel: wonTier.dataLabel,
      durationLabel: wonTier.durationLabel,
      claimed: true,
      claimedAt: timestamp,
      wonByTransactionId: transactionId
    };
  }

  // 3. Save won voucher into user's wallet
  const userWallet = getUserWonWallet();
  userWallet.unshift(wonVoucher);
  saveUserWonWallet(userWallet);

  // 3.1 Register won voucher into active network cards ledger so user can login immediately
  try {
    const ledger = getCardsLedger();
    const cleanWonCode = wonVoucher.code.trim().toUpperCase();
    if (!ledger[cleanWonCode]) {
      const packages = getStoredPackages();
      const newCard = generateDeterministicCard(cleanWonCode, packages);
      newCard.packageName = wonTier.name;
      newCard.price = wonTier.price;
      newCard.status = 'new';
      newCard.statusText = 'جديد (جائزة ولاء)';
      ledger[cleanWonCode] = newCard;
      saveCardsLedger(ledger);
    }
  } catch (err) {
    console.warn('Could not register won voucher in ledger:', err);
  }

  // 4. Save transaction log
  const transaction: LoyaltyTransaction = {
    id: transactionId,
    timestamp,
    cardsUsed: cleanCards,
    wonTierId: wonTier.id,
    wonTierName: wonTier.name,
    wonVoucherCode: wonVoucher.code,
    wonPrice: wonTier.price,
    dataLabel: wonTier.dataLabel,
    durationLabel: wonTier.durationLabel
  };

  const txs = getLoyaltyTransactions();
  txs.unshift(transaction);
  saveLoyaltyTransactions(txs);

  return {
    success: true,
    voucher: wonVoucher,
    transaction
  };
}

/**
 * Add prize vouchers to admin vault
 */
export function addVouchersToVault(vouchers: Array<{
  tierId: string;
  tierName: string;
  code: string;
  price: number;
  dataLabel: string;
  durationLabel: string;
}>): number {
  const vault = getPrizeVault();
  let count = 0;

  vouchers.forEach(v => {
    const cleanCode = v.code.trim().toUpperCase();
    if (!cleanCode) return;
    if (!vault.some(existing => existing.code === cleanCode)) {
      vault.push({
        id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        tierId: v.tierId,
        tierName: v.tierName,
        code: cleanCode,
        price: v.price,
        dataLabel: v.dataLabel,
        durationLabel: v.durationLabel,
        claimed: false
      });
      count++;
    }
  });

  savePrizeVault(vault);
  return count;
}

/**
 * Helper: Retrieve 10 authentic unburned network cards for rapid testing / demonstration
 */
export function getSampleNetworkCardsForTest(count: number = 10): string[] {
  const burnedLedger = getBurnedCardsLedger();
  const ledger = getCardsLedger();
  const availableCodes: string[] = [];

  // 1. Look in existing ledger (imported MikroTik backup or seeds)
  for (const code of Object.keys(ledger)) {
    if (!burnedLedger[code] && code.length >= 3) {
      availableCodes.push(code);
      if (availableCodes.length >= count) {
        return availableCodes;
      }
    }
  }

  // 2. If fewer than count are available, generate authentic test cards and seed them into ledger
  const packages = getStoredPackages();
  while (availableCodes.length < count) {
    const randomCode = '7' + Math.floor(10000 + Math.random() * 90000).toString();
    if (!ledger[randomCode] && !burnedLedger[randomCode] && !availableCodes.includes(randomCode)) {
      const generated = generateDeterministicCard(randomCode, packages);
      generated.usedBytes = generated.totalBytes; // Mark as used
      generated.usedSeconds = generated.totalSeconds;
      generated.status = 'exhausted';
      generated.statusText = 'مستهلك بالكامل في الشبكة';
      ledger[randomCode] = generated;
      availableCodes.push(randomCode);
    }
  }

  saveCardsLedger(ledger);
  return availableCodes.slice(0, count);
}
