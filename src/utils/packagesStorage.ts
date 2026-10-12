import { CardPackage, DistributorPoint, NetworkAnnouncement } from '../types';
import { INITIAL_PACKAGES, INITIAL_DISTRIBUTORS, INITIAL_ANNOUNCEMENTS } from '../data/initialData';

export interface NetworkConfig {
  networkName: string;
  slogan: string;
  whatsappNumber: string;
  supportPhone: string;
  emergencyPhone: string;
  telegramChannel: string;
  facebookPage: string;
  workingHours: string;
  networkLocation: string;
  currency: string;
  hotspotDnsName: string;
  mikrotikIdentity: string;
  announcementTitle: string;
  announcementText: string;
  announcementType: 'promotion' | 'notice' | 'maintenance';
  adminPin: string;
  appUrl: string;
  showVoucherBoxOnCloud?: boolean;
  mikrotikApiHost?: string;
  mikrotikApiPort?: number;
  mikrotikApiUser?: string;
  mikrotikApiPass?: string;
  mikrotikHotspotServer?: string;
  mikrotikApiEnabled?: boolean;
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  networkName: 'طلقة نت',
  slogan: 'منظومة توزيع إنترنت فائق السرعة عبر شبكات الأقمارالصناعية ستارلينك وكروت ميكروتك الذكية',
  whatsappNumber: '967718097168',
  supportPhone: '718097168',
  emergencyPhone: '718097168',
  telegramChannel: 'https://t.me/talqanet',
  facebookPage: 'https://facebook.com/talqanet',
  workingHours: 'دعم فني على مدار الساعة 24/7',
  networkLocation: 'الجمهورية اليمنية — مأرب',
  currency: 'ريال',
  hotspotDnsName: 't.net',
  mikrotikIdentity: 'MikroTik-Talqa-Starlink-v7',
  announcementTitle: '🛰️ اتصال فائق السرعة عبر شبكات الأقمار الصناعية ستارلينك!',
  announcementText: 'نقدم أفضل تجربة تصفح وألعاب مع ثبات عالي ودعم فني على مدار الساعة في الجمهورية اليمنية — مأرب.',
  announcementType: 'promotion',
  adminPin: '7777',
  appUrl: 'https://talqanet.vercel.app',
  showVoucherBoxOnCloud: false,
  mikrotikApiHost: 'router.samtecai.com',
  mikrotikApiPort: 443,
  mikrotikApiUser: 'mosthassan',
  mikrotikApiPass: '',
  mikrotikHotspotServer: 'all',
  mikrotikApiEnabled: true
};

const STORAGE_KEY_PACKAGES = 'talqa_custom_packages_v1';
const STORAGE_KEY_CONFIG = 'talqa_network_config_v1';
const STORAGE_KEY_DISTRIBUTORS = 'talqa_custom_distributors_v1';
const STORAGE_KEY_ANNOUNCEMENTS = 'talqa_custom_announcements_v1';

// Packages
export function getStoredPackages(): CardPackage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PACKAGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading stored packages:', err);
  }
  return INITIAL_PACKAGES;
}

export function saveStoredPackages(packages: CardPackage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PACKAGES, JSON.stringify(packages));
  } catch (err) {
    console.error('Error saving packages:', err);
  }
}

// Network Config & Contacts
export function getStoredNetworkConfig(): NetworkConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      const config = { ...DEFAULT_NETWORK_CONFIG, ...parsed };
      if (config.hotspotDnsName === 'talqa.net') {
        config.hotspotDnsName = 't.net';
      }
      if (config.whatsappNumber === '967770446040' || config.whatsappNumber === '967771234567') {
        config.whatsappNumber = '967718097168';
      }
      if (config.supportPhone === '770446040' || config.supportPhone === '771234567') {
        config.supportPhone = '718097168';
      }
      if (config.emergencyPhone === '770446040' || config.emergencyPhone === '771234567') {
        config.emergencyPhone = '718097168';
      }
      return config;
    }
  } catch (err) {
    console.error('Error loading stored config:', err);
  }
  return DEFAULT_NETWORK_CONFIG;
}

export function saveStoredNetworkConfig(config: NetworkConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Distributors
export function getStoredDistributors(): DistributorPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISTRIBUTORS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading stored distributors:', err);
  }
  return INITIAL_DISTRIBUTORS;
}

export function saveStoredDistributors(distributors: DistributorPoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DISTRIBUTORS, JSON.stringify(distributors));
  } catch (err) {
    console.error('Error saving distributors:', err);
  }
}

// Reset
export function resetPackagesToDefault(): CardPackage[] {
  try {
    localStorage.removeItem(STORAGE_KEY_PACKAGES);
  } catch (err) {
    console.error('Error resetting packages:', err);
  }
  return INITIAL_PACKAGES;
}

export function resetAllToDefaults(): {
  packages: CardPackage[];
  config: NetworkConfig;
  distributors: DistributorPoint[];
} {
  try {
    localStorage.removeItem(STORAGE_KEY_PACKAGES);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(STORAGE_KEY_DISTRIBUTORS);
    localStorage.removeItem(STORAGE_KEY_ANNOUNCEMENTS);
  } catch (err) {
    console.error('Error resetting all:', err);
  }
  return {
    packages: INITIAL_PACKAGES,
    config: DEFAULT_NETWORK_CONFIG,
    distributors: INITIAL_DISTRIBUTORS
  };
}
