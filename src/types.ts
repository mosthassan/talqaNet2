export type SpeedTier = 'default' | 'eco' | 'medium' | 'high' | 'ultra' | 'gaming';

export const MIKROTIK_SPEED_PROFILES: Record<SpeedTier, { profile: string; label: string; speedDesc: string }> = {
  default: { profile: 'default', label: 'كرت هوتسبوت (افتراضي)', speedDesc: 'السرعة القياسية' },
  eco: { profile: 'profile-eco', label: 'السرعة الاقتصادية', speedDesc: 'توفير البيانات 3 Mbps' },
  medium: { profile: 'profile-med', label: 'السرعة المتوسطة', speedDesc: 'تصفح و HD 16 Mbps' },
  high: { profile: 'profile-high', label: 'السرعة العالية', speedDesc: 'ألياف ضوئية 35 Mbps' },
  ultra: { profile: 'profile-turbo', label: 'سرعة فائقة / طلقة توربو', speedDesc: 'أقصى سرعة فايبر 65 Mbps' },
  gaming: { profile: 'profile-gaming', label: 'وضع الألعاب (بنج طلقة)', speedDesc: 'استقرار فائق وبنج منخفض 50 Mbps' }
};

export interface EmergencyLoanRecord {
  id: string;
  macAddress: string;
  borrowedAt: number;
  type: 'time' | 'data' | 'combo';
  amountLabel: string;
  loanBytes: number;
  loanSeconds: number;
  isPaid: boolean;
  paidAt?: number;
  paidWithCard?: string;
}

export interface UserSession {
  voucherCode: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  connectedAt: number; // timestamp
  expiresAt: number; // timestamp
  totalSeconds: number;
  remainingSeconds: number;
  totalBytes: number; // in bytes
  downloadBytes: number;
  uploadBytes: number;
  speedProfile: string; // e.g. "طلقة فايبر 50Mbps"
  speedTier?: SpeedTier;
  isEmergencyLoan?: boolean;
  loanDeductionNotice?: string;
  currentDownloadSpeedMbps: number;
  currentUploadSpeedMbps: number;
  pingMs: number;
  status: 'connected' | 'idle' | 'expired' | 'blocked';
  serverName: string;
  gatewayIp: string;
  profileName: string;
}

export interface CardPackage {
  id: string;
  name: string;
  category: 'hours' | 'daily' | 'weekly' | 'monthly';
  price: number;
  currency: string;
  durationLabel: string;
  validityDaysLabel: string; // e.g. "7 أيام", "10 أيام", "30 يوم"
  dataLimitLabel: string;
  dataLimitMB: number; // e.g. 1300, 2700, 4500, 30720
  speedLimitLabel: string;
  badge?: string;
  popular?: boolean;
  features: string[];
  colorTheme: 'cyan' | 'orange' | 'emerald' | 'purple' | 'amber';
}

export interface DistributorPoint {
  id: string;
  name: string;
  ownerName?: string;
  neighborhood: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  openHours?: string;
  workingHours?: string;
  lat?: number;
  lng?: number;
  isVerified?: boolean;
  availableCards?: string[];
  availableCategories?: string[];
  isOpen?: boolean;
  hasStock?: boolean;
}

export interface NetworkAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'promotion' | 'maintenance';
  date: string;
  active: boolean;
  linkText?: string;
  linkAction?: string;
}

export interface QuickBalanceResult {
  code: string;
  serialNumber?: string;
  valid: boolean;
  statusText: string;
  cardState?: 'new' | 'active' | 'exhausted' | 'expired' | 'invalid' | 'blocked';
  planName: string;
  price?: number;
  currency?: string;
  totalBytes?: number;
  usedBytes?: number;
  remainingBytes?: number;
  totalSeconds?: number;
  usedSeconds?: number;
  remainingSeconds?: number;
  totalDataFormatted?: string;
  usedDataFormatted?: string;
  remainingTimeFormatted: string;
  totalTimeFormatted?: string;
  usedTimeFormatted?: string;
  remainingDataFormatted: string;
  remainingDataPercent: number;
  remainingTimePercent?: number;
  expirationDate: string;
  maxSpeed: string;
  distributorName?: string;
  dataSource?: 'mikrotik_live' | 'hotspot_active' | 'ledger_imported' | 'system_seed';
  dataSourceText?: string;
  error?: string;
  aiEstimate?: {
    videoHours: number;
    socialHours: number;
    gamingHours: number;
    matchesCount: number;
    healthScore: number;
    consumptionPace: string;
    advice: string;
  };
}

export interface TestCardPreset {
  code: string;
  name: string;
  price: number;
  durationLabel: string;
  validityDaysLabel: string;
  dataLabel: string;
  category: string;
  seconds: number;
  bytes: number;
  speed: string;
}

// 🎁 Talqa Loyalty Rewards Program Types
export interface LoyaltyBurnedCard {
  code: string;
  redeemedAt: number; // timestamp
  transactionId: string;
  packageName?: string;
  price?: number;
}

export interface LoyaltyPrizeTier {
  id: string;
  name: string;
  price: number;
  color: string;
  textColor: string;
  probabilityWeight: number; // percentage or weight
  dataLabel: string;
  durationLabel: string;
  iconName?: string;
}

export interface LoyaltyPrizeVoucher {
  id: string;
  tierId: string;
  tierName: string;
  code: string;
  price: number;
  dataLabel: string;
  durationLabel: string;
  claimed: boolean;
  claimedAt?: number;
  wonByTransactionId?: string;
}

export interface LoyaltyTransaction {
  id: string;
  timestamp: number;
  cardsUsed: string[];
  wonTierId: string;
  wonTierName: string;
  wonVoucherCode: string;
  wonPrice: number;
  dataLabel: string;
  durationLabel: string;
}
