import { CardPackage, DistributorPoint, NetworkAnnouncement, TestCardPreset } from '../types';

export const INITIAL_PACKAGES: CardPackage[] = [
  {
    id: 'pkg-200',
    name: 'كرت 200 ريال',
    category: 'hours',
    price: 200,
    currency: 'ريال',
    durationLabel: '6 ساعات',
    validityDaysLabel: '7 أيام',
    dataLimitLabel: '1300 ميجا',
    dataLimitMB: 1300,
    speedLimitLabel: 'حتى 30 ميجا/ثانية',
    badge: 'توفير سريع',
    popular: false,
    colorTheme: 'cyan',
    features: [
      'حجم رصيد 1300 ميجابايت كاملة',
      'وقت اتصال 6 ساعات',
      'صلاحية الكرت 7 أيام من تاريخ الاستخدام',
      'سرعة فائقة وثبات عالي للتصفح والواتساب'
    ]
  },
  {
    id: 'pkg-500',
    name: 'كرت 500 ريال',
    category: 'daily',
    price: 500,
    currency: 'ريال',
    durationLabel: '15 ساعة',
    validityDaysLabel: '10 أيام',
    dataLimitLabel: '2700 ميجا',
    dataLimitMB: 2700,
    speedLimitLabel: 'حتى 50 ميجا/ثانية',
    badge: 'الأكثر طلباً 🔥',
    popular: true,
    colorTheme: 'orange',
    features: [
      'حجم رصيد 2700 ميجابايت (2.7GB)',
      'وقت اتصال 15 ساعة كاملة',
      'صلاحية الكرت 10 أيام من أول استخدام',
      'أولوية بث الفيديو عالي الدقة HD والألعاب'
    ]
  },
  {
    id: 'pkg-1000',
    name: 'كرت 1000 ريال',
    category: 'weekly',
    price: 1000,
    currency: 'ريال',
    durationLabel: '30 ساعة',
    validityDaysLabel: '10 أيام',
    dataLimitLabel: '4500 ميجا',
    dataLimitMB: 4500,
    speedLimitLabel: 'حتى 70 ميجا/ثانية',
    badge: 'قيمة ممتازة ⚡',
    popular: false,
    colorTheme: 'emerald',
    features: [
      'حجم رصيد 4500 ميجابايت (4.5GB)',
      'وقت اتصال 30 ساعة صالحة للاتصال',
      'صلاحية الكرت 10 أيام كاملة',
      'سرعة تحميل فائقة وبينج منخفض مستقر'
    ]
  },
  {
    id: 'pkg-4000',
    name: 'كرت 4000 ريال',
    category: 'monthly',
    price: 4000,
    currency: 'ريال',
    durationLabel: '720 ساعة (30 يوم)',
    validityDaysLabel: '30 يوم',
    dataLimitLabel: '30 جيجا',
    dataLimitMB: 30720,
    speedLimitLabel: 'أقصى سرعة فايبر (100 Mbps)',
    badge: 'شهري VIP 👑',
    popular: false,
    colorTheme: 'amber',
    features: [
      'حجم رصيد ضخم 30 جيجابايت (30,720 MB)',
      'وقت اتصال 720 ساعة (طوال الشهر)',
      'صلاحية 30 يوماً كاملة من تاريخ التفعيل',
      'أعلى أولوية في الشبكة وسرعة خط مفتوحة'
    ]
  }
];

export const INITIAL_DISTRIBUTORS: DistributorPoint[] = [
  {
    id: 'dist-1',
    name: 'مركز النجم للاتصالات والخدمات',
    ownerName: 'أبو أحمد النهاري',
    neighborhood: 'شارع 26 سبتمبر - حي الروضة',
    city: 'مأرب المدينة',
    address: 'شارع 26 سبتمبر الرئيسي، بجوار مجمع النور، مأرب',
    phone: '+967 718 097 168',
    whatsapp: '967718097168',
    openHours: 'من 8:00 صباحاً حتى 12:00 منتصف الليل',
    lat: 15.4590,
    lng: 45.3260,
    isVerified: true,
    availableCards: ['كرت 200 ريال', 'كرت 500 ريال', 'كرت 1000 ريال', 'كرت 4000 ريال']
  },
  {
    id: 'dist-2',
    name: 'سوبر ماركت البركة الحديث',
    ownerName: 'محمد سعيد العولقي',
    neighborhood: 'شارع الأربعين - حي المجمع',
    city: 'مأرب المدينة',
    address: 'شارع الأربعين، مقابل كلية التربية، مأرب',
    phone: '+967 773 987 654',
    whatsapp: '967773987654',
    openHours: 'مفتوح 24 ساعة يومياً',
    lat: 15.4640,
    lng: 45.3200,
    isVerified: true,
    availableCards: ['كرت 200 ريال', 'كرت 500 ريال', 'كرت 1000 ريال']
  },
  {
    id: 'dist-3',
    name: 'كافيه ولاونج الأندلس',
    ownerName: 'م. طارق العريقي',
    neighborhood: 'حي السلام - شارع الجامعة',
    city: 'مأرب المدينة',
    address: 'شارع الجامعة الجديد، جوار مكتبة التوفير، مأرب',
    phone: '+967 775 555 123',
    whatsapp: '967775555123',
    openHours: 'من 7:00 صباحاً حتى 1:00 فجراً',
    lat: 15.4520,
    lng: 45.3340,
    isVerified: true,
    availableCards: ['جميع الكروت: 200، 500، 1000، 4000 ريال']
  },
  {
    id: 'dist-4',
    name: 'محل الفخامة للإلكترونيات والألعاب',
    ownerName: 'عبدالرحمن باحاج',
    neighborhood: 'سوق مأرب العام',
    city: 'وسط مأرب',
    address: 'مدخل السوق العام، بجوار البريد، المحل رقم 14',
    phone: '+967 770 112 233',
    whatsapp: '967770112233',
    openHours: 'من 9:00 صباحاً حتى 11:00 مساءً',
    lat: 15.4570,
    lng: 45.3280,
    isVerified: true,
    availableCards: ['كرت 1000 ريال', 'كرت 4000 ريال VIP']
  },
  {
    id: 'dist-5',
    name: 'بقالة الوفاء السريعة',
    ownerName: 'حسام العدني',
    neighborhood: 'حي اليرموك - تقاطع النور',
    city: 'مأرب',
    address: 'شارع اليرموك المتفرع، عمارة السلام 3، مأرب',
    phone: '+967 777 444 888',
    whatsapp: '967777444888',
    openHours: 'من 6:00 صباحاً حتى 12:30 ليلاً',
    lat: 15.4680,
    lng: 45.3150,
    isVerified: true,
    availableCards: ['كرت 200 ريال', 'كرت 500 ريال']
  }
];

export const TEST_PRESET_CARDS: TestCardPreset[] = [
  {
    code: '200200',
    name: 'كرت 200 ريال (1300MB - 6H)',
    price: 200,
    durationLabel: '6 ساعات',
    validityDaysLabel: '7 أيام',
    dataLabel: '1300 ميجا',
    category: '200 ريال',
    seconds: 6 * 3600,
    bytes: 1300 * 1024 * 1024,
    speed: 'سرعة حتى 30 Mbps'
  },
  {
    code: '500500',
    name: 'كرت 500 ريال (2700MB - 15H)',
    price: 500,
    durationLabel: '15 ساعة',
    validityDaysLabel: '10 أيام',
    dataLabel: '2700 ميجا',
    category: '500 ريال',
    seconds: 15 * 3600,
    bytes: 2700 * 1024 * 1024,
    speed: 'طلقة فايبر 50 Mbps'
  },
  {
    code: '10001000',
    name: 'كرت 1000 ريال (4500MB - 30H)',
    price: 1000,
    durationLabel: '30 ساعة',
    validityDaysLabel: '10 أيام',
    dataLabel: '4500 ميجا',
    category: '1000 ريال',
    seconds: 30 * 3600,
    bytes: 4500 * 1024 * 1024,
    speed: 'طلقة ألترا 70 Mbps'
  },
  {
    code: '40004000',
    name: 'كرت 4000 ريال (30GB - 720H)',
    price: 4000,
    durationLabel: '720 ساعة (30 يوم)',
    validityDaysLabel: '30 يوم',
    dataLabel: '30 جيجا',
    category: '4000 ريال',
    seconds: 720 * 3600,
    bytes: 30 * 1024 * 1024 * 1024,
    speed: 'أقصى سرعة فايبر 100 Mbps'
  }
];

export const INITIAL_ANNOUNCEMENTS: NetworkAnnouncement[] = [
  {
    id: 'ann-1',
    title: '🛰️ بث مباشر وفائق عبر شبكات الأقمار الصناعية ستارلينك',
    content: 'شبكة طلقة نت تعمل الآن عبر أحدث محطات ستارلينك الفضائية لضمان سرعات تحميل خارقة وثبات تام بدون انقطاع في مأرب.',
    type: 'promotion',
    date: 'اليوم',
    active: true,
    linkText: 'تصفح قائمة الكروت'
  },
  {
    id: 'ann-2',
    title: '🎮 استقرار فائق للألعاب والبث المباشر (Low Ping)',
    content: 'تم توجيه مسارات البينج المباشر للألعاب عبر منظومة ميكروتك الذكية مع دعم فني على مدار الساعة.',
    type: 'info',
    date: 'أمس',
    active: true
  }
];
