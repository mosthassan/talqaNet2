import React, { useState, useEffect, useMemo } from 'react';
import { CardPackage } from '../types';
import {
  VoucherRecord,
  getCardsLedger,
  saveCardsLedger,
  generateRealCardsBatch,
  addSingleCustomCard,
  deleteCardFromDatabase,
  resetCardsDatabase,
  exportCardsToMikrotikScript,
  importCardsFromText,
  initCardsStorageFromIndexedDB
} from '../utils/cardsDatabase';
import { soundManager } from '../utils/audio';
import {
  CreditCard,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  RotateCcw,
  Download,
  Upload,
  FileCode,
  Sparkles,
  AlertCircle,
  Clock,
  HardDrive,
  ShieldCheck,
  Zap,
  Filter,
  Layers,
  Store,
  CheckCircle2,
  X,
  Cloud,
  RefreshCw,
  FileUp,
  FolderSync,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  syncCardsFromSamtechCloud, 
  getCachedSyncedBatches, 
  SyncedBatch, 
  getSyncStats, 
  SyncStats 
} from '../utils/firebaseSyncService';
import { parseMikrotikFileContent } from '../utils/mikrotikFileImporter';
import { auth, isSuperAdminEmail } from '../utils/firebaseService';

interface CardsRegistryManagerProps {
  packages: CardPackage[];
  onTestBalanceCode?: (code: string) => void;
}

export const CardsRegistryManager: React.FC<CardsRegistryManagerProps> = ({
  packages,
  onTestBalanceCode
}) => {
  const [cards, setCards] = useState<VoucherRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'active' | 'exhausted' | 'expired'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'samtech_cloud' | 'mikrotik_file' | 'local_generation'>('all');
  
  // Modal states
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // Cloud Sync State
  const [syncedBatches, setSyncedBatches] = useState<SyncedBatch[]>(() => getCachedSyncedBatches());
  const [syncStats, setSyncStats] = useState<SyncStats>(() => getSyncStats());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);

  // Batch Form State
  const [batchPkgId, setBatchPkgId] = useState(packages[0]?.id || 'pkg-500');
  const [batchCount, setBatchCount] = useState(10);
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchLength, setBatchLength] = useState(6);
  const [batchDistributor, setBatchDistributor] = useState('المخزن الرئيسي للشبكة');

  // Single Card Form State
  const [singleCode, setSingleCode] = useState('');
  const [singlePkgId, setSinglePkgId] = useState(packages[0]?.id || 'pkg-500');
  const [singleDistributor, setSingleDistributor] = useState('إدارة الشبكة');
  const [singleStatus, setSingleStatus] = useState<'new' | 'active'>('new');

  // Import State
  const [importText, setImportText] = useState('');
  const [importPkgId, setImportPkgId] = useState(packages[0]?.id || 'pkg-500');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number } | null>(null);

  // Export State
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load cards from database
  const loadCards = () => {
    const ledger = getCardsLedger();
    setCards(Object.values(ledger));
  };

  useEffect(() => {
    loadCards();
    initCardsStorageFromIndexedDB((ledger) => {
      setCards(Object.values(ledger));
    });
  }, []);

  // Helper to determine exact card source
  const getCardSource = (c: VoucherRecord): 'samtech_cloud' | 'mikrotik_file' | 'local_generation' => {
    if (
      c.source === 'samtech_cloud' ||
      c.distributorName?.includes('سحابية') ||
      c.distributorName?.includes('سام تك') ||
      c.packageId === 'pkg-synced'
    ) {
      return 'samtech_cloud';
    }
    if (
      c.source === 'mikrotik_file' ||
      c.serialNumber?.startsWith('MT-') ||
      c.serialNumber?.startsWith('CSV-') ||
      c.distributorName?.includes('مايكروتك')
    ) {
      return 'mikrotik_file';
    }
    return 'local_generation';
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Memoized Filtered Cards with High Performance Search
  const filteredCards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = Date.now();
    return cards.filter((c) => {
      const matchesSearch = !q ||
        c.code.toLowerCase().includes(q) ||
        c.packageName.toLowerCase().includes(q) ||
        c.serialNumber.toLowerCase().includes(q) ||
        (c.distributorName && c.distributorName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'expired'
          ? c.status === 'expired' || now > c.expiresAt
          : c.status === statusFilter;

      if (!matchesStatus) return false;

      const matchesSource =
        sourceFilter === 'all'
          ? true
          : getCardSource(c) === sourceFilter;

      return matchesSource;
    });
  }, [cards, searchQuery, statusFilter, sourceFilter]);

  // Reset pagination to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  
  // High-performance paginated slice - renders only 25 items instead of thousands!
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  // Single-pass calculation of all metrics to prevent O(N * 9) re-renders
  const metrics = useMemo(() => {
    let newCount = 0;
    let activeCount = 0;
    let exhaustedCount = 0;
    let expiredCount = 0;
    let cloudCount = 0;
    let mtCount = 0;
    let localCount = 0;

    const now = Date.now();
    for (const c of cards) {
      if (c.status === 'new') newCount++;
      else if (c.status === 'active') activeCount++;
      if (c.status === 'exhausted' || c.remainingBytes <= 0) exhaustedCount++;
      if (c.status === 'expired' || now > c.expiresAt) expiredCount++;

      const src = getCardSource(c);
      if (src === 'samtech_cloud') cloudCount++;
      else if (src === 'mikrotik_file') mtCount++;
      else localCount++;
    }

    return {
      total: cards.length,
      newCount,
      activeCount,
      exhaustedCount,
      expiredCount,
      cloudCount,
      mtCount,
      localCount
    };
  }, [cards]);

  const totalCardsCount = metrics.total;
  const newCardsCount = metrics.newCount;
  const activeCardsCount = metrics.activeCount;
  const exhaustedCardsCount = metrics.exhaustedCount;
  const expiredCardsCount = metrics.expiredCount;
  const cloudCardsCount = metrics.cloudCount;
  const mikrotikCardsCount = metrics.mtCount;
  const localCardsCount = metrics.localCount;

  // Handlers
  const handleGenerateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playTap();
    if (batchCount <= 0 || batchCount > 500) {
      alert('يرجى تحديد عدد كروت بين 1 و 500 كرت.');
      return;
    }

    const created = generateRealCardsBatch({
      packageId: batchPkgId,
      count: batchCount,
      prefix: batchPrefix.trim(),
      codeLength: batchLength,
      distributorName: batchDistributor.trim()
    });

    loadCards();
    setIsBatchModalOpen(false);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    soundManager.playSuccess();
    alert(`✅ تم توليد وحفظ ${created.length} كرت بنجاح في قاعدة بيانات الشبكة! الكروت الآن صالحة للفحص والاتصال.`);
  };

  const handleAddSingleCard = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playTap();
    const clean = singleCode.trim();
    if (!clean) {
      alert('يرجى إدخال كود الكرت.');
      return;
    }

    addSingleCustomCard({
      code: clean,
      packageId: singlePkgId,
      distributorName: singleDistributor.trim(),
      status: singleStatus
    });

    loadCards();
    setSingleCode('');
    setIsSingleModalOpen(false);
    soundManager.playSuccess();
    alert(`✅ تم حفظ الكرت (${clean}) في قاعدة بيانات السيرفر بنجاح.`);
  };

  const handleDeleteCard = (code: string) => {
    soundManager.playTap();
    if (confirm(`هل أنت متأكد من حذف الكرت (${code}) نهائياً من قاعدة البيانات؟ لن يتم التعرف عليه بعد الحذف.`)) {
      deleteCardFromDatabase(code);
      loadCards();
      soundManager.playSuccess();
    }
  };

  const handleResetToSeed = () => {
    soundManager.playTap();
    if (confirm('هل تريد تنظيف وإصلاح ذاكرة الكروت المؤقتة وفك أي تعليق في المتصفح؟ سيتم فك التعليق فوراً وإعادة تحميل السجل الخفيف.')) {
      resetCardsDatabase();
      loadCards();
      setSyncedBatches([]);
      setCurrentPage(1);
      soundManager.playSuccess();
      setSyncSuccessToast('✅ تم تنظيف الذاكرة المؤقتة وفك التعليق بنجاح! يعمل الموقع الآن بأقصى سرعة.');
      setTimeout(() => setSyncSuccessToast(null), 5000);
    }
  };

  const handleCloudSync = async () => {
    soundManager.playTap();
    setIsSyncing(true);
    setSyncSuccessToast(null);
    try {
      const res = await syncCardsFromSamtechCloud();
      if (res.cards && res.cards.length > 0) {
        const ledger = getCardsLedger();
        res.cards.forEach((c) => {
          if (!ledger[c.code]) {
            ledger[c.code] = c;
          } else {
            ledger[c.code] = {
              ...ledger[c.code],
              source: 'samtech_cloud',
              batchNumber: c.batchNumber || ledger[c.code].batchNumber,
              distributorName: c.distributorName || ledger[c.code].distributorName
            };
          }
        });
        saveCardsLedger(ledger);
      }
      setSyncedBatches(res.batches);
      setSyncStats(getSyncStats());
      loadCards();
      soundManager.playSuccess();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setSyncSuccessToast(res.message);
      setTimeout(() => setSyncSuccessToast(null), 5000);
    } catch (err: any) {
      console.error('Cloud Sync Error:', err);
      soundManager.playError();
      alert(err.message || 'حدث خطأ أثناء مزامنة قاعدة البيانات السحابية. يرجى التأكد من تسجيل الدخول بحساب المشرف.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportText(content);
        soundManager.playTap();
      }
    };
    reader.readAsText(file);
  };

  const handleImportText = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playTap();
    if (!importText.trim()) {
      alert('يرجى اختيار ملف كروت أو لصق أوامر ميكروتك.');
      return;
    }

    const targetPkg = packages.find((p) => p.id === importPkgId) || packages[0];
    const parseResult = parseMikrotikFileContent(
      importText, 
      targetPkg, 
      uploadedFileName ? `ملف (${uploadedFileName})` : 'استيراد مايكروتك',
      packages
    );

    setImportResult({
      added: parseResult.added,
      updated: parseResult.updated,
      skipped: parseResult.skipped
    });

    loadCards();
    soundManager.playSuccess();
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    const totalProcessed = parseResult.added + parseResult.updated;
    setSyncSuccessToast(
      `🎉 تم بنجاح استيراد وحفظ ${totalProcessed.toLocaleString('ar-YE')} كرت في قاعدة بيانات الشبكة ${
        parseResult.batchName ? `(الدفعة: ${parseResult.batchName})` : ''
      }!`
    );
    setTimeout(() => setSyncSuccessToast(null), 7000);
  };

  const handleCopyCode = (code: string) => {
    soundManager.playTap();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyScript = () => {
    soundManager.playTap();
    const script = exportCardsToMikrotikScript();
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDownloadRsc = () => {
    soundManager.playTap();
    const script = exportCardsToMikrotikScript();
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netflow-users-${new Date().toISOString().slice(0, 10)}.rsc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Description */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-950 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>سجل الكروت الصادرة وقاعدة البيانات الحقيقية</span>
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-500/30">
              فحص حقيقي 100%
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            جميع الكروت المسجلة هنا هي الوحيدة المعترف بها في سيرفر ميكروتك وبوابة الفحص الذكي.
            أي كرت غير مدرج في هذا السجل <strong className="text-rose-400">يتم رفضه فوراً</strong> كـ "كرت غير مسجل".
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              soundManager.playTap();
              setIsCloudModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(59,130,246,0.35)] cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>سحابة سام تك (Firebase) ☁️</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setIsBatchModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(14,165,233,0.3)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>توليد دفعة جديدة ⚡</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setIsSingleModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-cyan-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة كرت فردي</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setIsImportModalOpen(true);
              setImportResult(null);
            }}
            className="px-3 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/60 text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد ملف ميكروتك (.rsc)</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setIsExportModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير سكربت RSC</span>
          </button>

          <button
            onClick={handleResetToSeed}
            className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-500/40 cursor-pointer transition-colors shadow-sm"
            title="إصلاح الذاكرة المؤقتة وفك أي تعليق فوراً"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>فك التعليق وتسريع السجل ⚡</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Status Strip */}
      {syncSuccessToast && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{syncSuccessToast}</span>
          </div>
          <button onClick={() => setSyncSuccessToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Cloud Integration Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300 font-bold">سحابة سام تك (Firebase):</span>
          <span className="font-mono text-cyan-300">mikrotic-1a8ae</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            {syncedBatches.length > 0 
              ? `${syncedBatches.length} دفعات سحابية مسجلة (${syncedBatches.map(b => b.batchNumber).join(', ')})`
              : 'جاهز للمزامنة'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCloudSync}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة سحابية الآن 🔄'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-right">
          <div className="text-[11px] text-slate-400 font-bold">إجمالي الكروت</div>
          <div className="text-xl font-black text-cyan-400 font-mono mt-0.5">{totalCardsCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20 text-right">
          <div className="text-[11px] text-emerald-400 font-bold">جديدة 100%</div>
          <div className="text-xl font-black text-emerald-300 font-mono mt-0.5">{newCardsCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-cyan-500/20 text-right">
          <div className="text-[11px] text-cyan-400 font-bold">نشطة قيد الاستخدام</div>
          <div className="text-xl font-black text-cyan-300 font-mono mt-0.5">{activeCardsCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/20 text-right">
          <div className="text-[11px] text-amber-400 font-bold">مستنفدة (0 MB)</div>
          <div className="text-xl font-black text-amber-300 font-mono mt-0.5">{exhaustedCardsCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-rose-500/20 text-right">
          <div className="text-[11px] text-rose-400 font-bold">منتهية الصلاحية</div>
          <div className="text-xl font-black text-rose-300 font-mono mt-0.5">{expiredCardsCount}</div>
        </div>
      </div>

      {/* Source Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold px-1">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>فلترة حسب مصدر الكروت:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              soundManager.playTap();
              setSourceFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
              sourceFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🌐 جميع المصادر ({totalCardsCount})
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setSourceFilter('samtech_cloud');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
              sourceFilter === 'samtech_cloud'
                ? 'bg-indigo-600 text-white font-black shadow-sm shadow-indigo-500/25'
                : 'bg-slate-950 text-indigo-300 hover:text-white border border-indigo-900/50'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span>سحابة سام تك ({cloudCardsCount})</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setSourceFilter('mikrotik_file');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
              sourceFilter === 'mikrotik_file'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm shadow-amber-500/25'
                : 'bg-slate-950 text-amber-300 hover:text-white border border-amber-900/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>ملفات المايكروتك RSC ({mikrotikCardsCount})</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setSourceFilter('local_generation');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
              sourceFilter === 'local_generation'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm shadow-emerald-500/25'
                : 'bg-slate-950 text-emerald-300 hover:text-white border border-emerald-900/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>توليد محلي ({localCardsCount})</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الكرت، اسم الباقة، السيريال، أو نقطة البيع..."
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-all font-mono"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `الكل (${totalCardsCount})` },
            { id: 'new', label: `جديد (${newCardsCount})` },
            { id: 'active', label: `نشط (${activeCardsCount})` },
            { id: 'exhausted', label: `مستنفد (${exhaustedCardsCount})` },
            { id: 'expired', label: `منتهي (${expiredCardsCount})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundManager.playTap();
                setStatusFilter(tab.id as any);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={handleResetToSeed}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center gap-1 mr-auto cursor-pointer"
            title="إعادة ضبط السجل للوضع الافتراضي"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">استعادة الأصل</span>
          </button>
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 font-bold">
              <tr>
                <th className="py-2.5 px-3">رقم الكرت (User/Pass)</th>
                <th className="py-2.5 px-3">الباقة والسعر</th>
                <th className="py-2.5 px-3">رصيد البيانات</th>
                <th className="py-2.5 px-3">الوقت المتبقي</th>
                <th className="py-2.5 px-3">الحالة</th>
                <th className="py-2.5 px-3">المصدر ونقطة التوزيع</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    لا توجد كروت مطابقة لمعايير البحث في السجل.
                  </td>
                </tr>
              ) : (
                paginatedCards.map((c) => {
                  const remMB = Math.round(c.remainingBytes / (1024 * 1024));
                  const totalMB = Math.round(c.totalBytes / (1024 * 1024));
                  const pct = totalMB > 0 ? Math.round((remMB / totalMB) * 100) : 0;
                  const remHours = Math.floor(c.remainingSeconds / 3600);
                  const remMins = Math.floor((c.remainingSeconds % 3600) / 60);

                  const isExpired = c.status === 'expired' || Date.now() > c.expiresAt;
                  const isExhausted = c.status === 'exhausted' || c.remainingBytes <= 0;
                  const cardSource = getCardSource(c);

                  return (
                    <tr key={c.code} className="hover:bg-slate-900/60 transition-colors">
                      {/* Code */}
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-cyan-300 text-sm tracking-wider">{c.code}</strong>
                          <button
                            onClick={() => handleCopyCode(c.code)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="نسخ الكود"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block">{c.serialNumber}</span>
                      </td>

                      {/* Package */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-200 block">{c.packageName}</span>
                        <span className="text-[10px] text-cyan-400 font-mono font-bold">{c.price} {c.currency}</span>
                      </td>

                      {/* Data Quota */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="text-white font-bold">{remMB.toLocaleString()} MB</span>
                          <span className="text-slate-400 text-[10px]">من {totalMB.toLocaleString()} MB</span>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct > 40 ? 'bg-cyan-500' : pct > 15 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Time Quota */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                        {remHours} س و {remMins} د
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 font-bold text-[10px] border border-rose-500/20">
                            منتهي
                          </span>
                        ) : isExhausted ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold text-[10px] border border-amber-500/20">
                            مستنفد 0 MB
                          </span>
                        ) : c.status === 'new' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-bold text-[10px] border border-emerald-500/20">
                            جديد 100%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 font-bold text-[10px] border border-cyan-500/20">
                            نشط ({pct}%)
                          </span>
                        )}
                      </td>

                      {/* Source & Distributor */}
                      <td className="py-2.5 px-3">
                        {cardSource === 'samtech_cloud' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 w-fit">
                              <Cloud className="w-2.5 h-2.5 text-indigo-400" />
                              <span>سحابة سام تك {c.batchNumber ? `(${c.batchNumber})` : ''}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={c.distributorName}>
                              {c.distributorName || 'سحابة فايربيس'}
                            </span>
                          </div>
                        ) : cardSource === 'mikrotik_file' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 w-fit">
                              <FileCode className="w-2.5 h-2.5 text-amber-400" />
                              <span>ملف مايكروتك {c.batchNumber ? `(${c.batchNumber})` : ''}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={c.distributorName}>
                              {c.distributorName || 'أمر RSC / ملف'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 w-fit">
                              <Zap className="w-2.5 h-2.5 text-emerald-400" />
                              <span>توليد طلقة نت {c.batchNumber ? `(${c.batchNumber})` : ''}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px] block" title={c.distributorName}>
                              {c.distributorName || 'المركز الرئيسي'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onTestBalanceCode && (
                            <button
                              onClick={() => {
                                soundManager.playTap();
                                onTestBalanceCode(c.code);
                              }}
                              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold transition-all cursor-pointer"
                              title="فحص الرصيد المباشر"
                            >
                              فحص ⚡
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCard(c.code)}
                            className="p-1 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="حذف الكرت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* High Performance Pagination Controls */}
        {filteredCards.length > 0 && (
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Summary */}
            <div className="text-slate-400 font-mono flex items-center gap-2">
              <span>عرض</span>
              <strong className="text-cyan-400 font-bold">
                {Math.min((currentPage - 1) * pageSize + 1, filteredCards.length)} - {Math.min(currentPage * pageSize, filteredCards.length)}
              </strong>
              <span>من أصل</span>
              <strong className="text-white font-bold">{filteredCards.length}</strong>
              <span>كرت</span>
              {totalCardsCount !== filteredCards.length && (
                <span className="text-[10px] text-slate-500 font-sans">(مفلترة من إجمالي {totalCardsCount})</span>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundManager.playTap();
                  setCurrentPage(1);
                }}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="الصفحة الأولى"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                }}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-bold text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>

              <div className="px-3 py-1 bg-slate-950 rounded-lg border border-cyan-500/30 font-mono text-cyan-300 font-bold text-xs">
                {currentPage} / {totalPages}
              </div>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                }}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-bold text-xs"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  soundManager.playTap();
                  setCurrentPage(totalPages);
                }}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="الصفحة الأخيرة"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">في الصفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  soundManager.playTap();
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono outline-none cursor-pointer focus:border-cyan-500"
              >
                <option value={15}>15 كرت</option>
                <option value={25}>25 كرت</option>
                <option value={50}>50 كرت</option>
                <option value={100}>100 كرت</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Batch Generation Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(14,165,233,0.3)] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-black text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>توليد دفعة كروت حقيقية في السجل</span>
              </h4>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">اختر الباقة</label>
                <select
                  value={batchPkgId}
                  onChange={(e) => setBatchPkgId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.price} {p.currency} ({p.durationLabel} / {p.dataLimitMB} MB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">عدد الكروت</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 10)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">طول رقم الكرت (أرقام)</label>
                  <select
                    value={batchLength}
                    onChange={(e) => setBatchLength(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none text-center"
                  >
                    <option value={4}>4 أرقام (سريع)</option>
                    <option value={5}>5 أرقام</option>
                    <option value={6}>6 أرقام (موصى به)</option>
                    <option value={8}>8 أرقام (أمان عالي)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">بادئة الكود (اختياري)</label>
                  <input
                    type="text"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="مثال: 77"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none text-center"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">نقطة البيع المخصصة</label>
                  <input
                    type="text"
                    value={batchDistributor}
                    onChange={(e) => setBatchDistributor(e.target.value)}
                    placeholder="مثال: بقالة الأمل"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-[11px] text-cyan-300/90 leading-relaxed">
                💡 سيتم إنشاء الكروت بأكواد غير مكررة وحفظها في قاعدة البيانات فوراً لتصبح صالحة للاتصال والاستعلام عنها في الهوتسبوت.
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(14,165,233,0.3)]"
              >
                <Plus className="w-4 h-4" />
                <span>تأكيد التوليد والحفظ الفوري</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Card Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(14,165,233,0.3)] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-black text-white text-base">إضافة كرت مخصص فردي</h4>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSingleCard} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">رقم الكرت (User Code)</label>
                <input
                  type="text"
                  value={singleCode}
                  onChange={(e) => setSingleCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                  placeholder="مثال: 885522"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-cyan-300 font-mono font-black focus:border-cyan-500 outline-none text-center"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">الباقة</label>
                <select
                  value={singlePkgId}
                  onChange={(e) => setSinglePkgId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price} {p.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">الحالة المبدئية</label>
                <select
                  value={singleStatus}
                  onChange={(e) => setSingleStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                >
                  <option value="new">كرت جديد بالكامل (100% رصيد كامل)</option>
                  <option value="active">كرت نشط في السيرفر</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">نقطة التوزيع</label>
                <input
                  type="text"
                  value={singleDistributor}
                  onChange={(e) => setSingleDistributor(e.target.value)}
                  placeholder="مثال: إدارة الشبكة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                >
                </input>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)] mt-2"
              >
                حفظ الكرت في قاعدة البيانات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import from MikroTik Modal (Dual Importer: File Upload .rsc/csv + Paste) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-black text-white text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>استيراد كروت ميكروتك (رفع ملف .rsc أو لصق الأوامر)</span>
              </h4>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setUploadedFileName(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportText} className="mt-4 space-y-3.5">
              {/* File Drag & Drop Zone */}
              <div 
                className={`p-4 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer ${
                  isDraggingFile 
                    ? 'border-emerald-400 bg-emerald-500/15' 
                    : 'border-slate-700 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-950'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const input = document.getElementById('rscFileInput');
                  if (input) input.click();
                }}
              >
                <input
                  id="rscFileInput"
                  type="file"
                  accept=".rsc,.txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <FileUp className="w-7 h-7 text-emerald-400 mx-auto mb-1.5 animate-bounce" />
                <div className="text-xs font-bold text-white">
                  {uploadedFileName ? (
                    <span className="text-emerald-300 font-mono">📁 تم تحميل الملف: {uploadedFileName}</span>
                  ) : (
                    <span>اسحب ملف <strong className="text-emerald-400 font-mono">.rsc</strong> أو <strong className="text-emerald-400 font-mono">.csv</strong> هنا، أو اضغط للاختيار من جهازك</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  يدعم ملفات أوامر MikroTik RouterOS (/ip hotspot user add) أو ملفات كروت CSV النصية
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">
                  أو الصق أوامر المايكروتك مباشرة هنا:
                </label>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`/ip hotspot user add name="771001" profile="pkg-500" limit-bytes-total=2147483648\n/ip hotspot user add name="771002" profile="pkg-500" limit-uptime=10h\nأو أرقام كروت فقط:\n771001\n771002`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:border-emerald-500 outline-none leading-relaxed dir-ltr text-left"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">الباقة الافتراضية للكروت المستوردة:</label>
                <select
                  value={importPkgId}
                  onChange={(e) => setImportPkgId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price} {p.currency}) - {p.durationLabel} / {p.dataLimitMB} MB
                    </option>
                  ))}
                </select>
              </div>

              {importResult && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم استيراد الكروت وتحديث قاعدة البيانات بنجاح:</span>
                  </div>
                  <div>• أضيفت: <strong className="text-white font-mono">{importResult.added}</strong> كرت جديد</div>
                  <div>• حُدثت: <strong className="text-white font-mono">{importResult.updated}</strong> كرت موجود مسبقاً</div>
                  {importResult.skipped > 0 && <div>• تم تخطي: {importResult.skipped} أسطر غير صالحة</div>}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              >
                <Upload className="w-4 h-4" />
                <span>بدء معالجة الملف والإضافة الفورية للسجل 🚀</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cloud Sync Modal (Firebase Cloud Sync with mikrotic-1a8ae) */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-blue-500/40 rounded-3xl p-5 shadow-[0_0_60px_rgba(59,130,246,0.3)] text-right font-['Cairo']">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base">
                    مزامنة سحابة سام تك (Firebase Cloud)
                  </h4>
                  <p className="text-xs text-slate-400">
                    جلب واستيراد دفعات الكروت المولدة مباشرة من قاعدة بيانات <span className="font-mono text-cyan-300">mikrotic-1a8ae</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCloudModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cloud Status Info */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold">قاعدة البيانات السحابية</div>
                <div className="text-xs font-mono font-bold text-cyan-300 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>mikrotic-1a8ae</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold">حساب المشرف المعتمد</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-1 truncate">
                  mosthassan.ye@gmail.com
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold">حالة المزامنة الحية</div>
                <div className="text-xs font-bold text-blue-400 mt-1 flex items-center gap-1">
                  <span>{isSyncing ? 'جاري التحميل...' : 'متصل وجاهز ⚡'}</span>
                </div>
              </div>
            </div>

            {/* Synced Batches Table Preview */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <FolderSync className="w-4 h-4 text-cyan-400" />
                  <span>دفعات الكروت المسجلة في السحابة ({syncedBatches.length} دفعات):</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloudSync}
                  disabled={isSyncing}
                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.35)] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الكروت والدفعات الآن'}</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 max-h-56 bg-slate-950">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-2.5">رقم الدفعة</th>
                      <th className="p-2.5">الباقة</th>
                      <th className="p-2.5">الكمية</th>
                      <th className="p-2.5">قيمة التجزئة</th>
                      <th className="p-2.5">حالة الدفعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {syncedBatches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500 font-sans">
                          اضغط على زر "مزامنة الكروت والدفعات الآن" لجلب الدفعات السحابية.
                        </td>
                      </tr>
                    ) : (
                      syncedBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-2.5 font-bold text-cyan-300">{b.batchNumber}</td>
                          <td className="p-2.5 text-white font-sans">{b.packageName}</td>
                          <td className="p-2.5 text-emerald-400 font-bold">{b.cardCount} كرت</td>
                          <td className="p-2.5 text-amber-300">{b.retailPrice.toLocaleString()} ر.ي</td>
                          <td className="p-2.5 font-sans">
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 text-[11px] text-cyan-300 leading-relaxed">
              💡 <strong>تكامل فوري:</strong> عند الضغط على المزامنة، يتم حفظ الكروت في قاعدة بيانات النظام المحلية والسحابية لتصبح صالحة مباشرة لفحص الرصيد والاستعلام في الهوتسبوت والتطبيق.
            </div>
          </div>
        </div>
      )}

      {/* Export to MikroTik Script Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(14,165,233,0.3)] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-black text-white text-base flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>سكربت تصدير الكروت إلى MikroTik RouterOS</span>
              </h4>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                انسخ هذه الأوامر وألصقها في Terminal داخل WinBox، أو قم بتنزيل ملف <strong className="text-cyan-300 font-mono">.rsc</strong> وسحبه إلى الراوتر ليتم تطبيق جميع الكروت فوراً:
              </p>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-emerald-300 font-mono max-h-[220px] overflow-y-auto dir-ltr text-left leading-relaxed">
                {exportCardsToMikrotikScript()}
              </pre>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCopyScript}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>تم نسخ الأوامر بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ أوامر السكربت</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadRsc}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف .RSC</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
