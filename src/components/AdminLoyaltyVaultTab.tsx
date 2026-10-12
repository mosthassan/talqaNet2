import React, { useState, useEffect } from 'react';
import { 
  LoyaltyPrizeTier, 
  LoyaltyPrizeVoucher, 
  LoyaltyTransaction,
  LoyaltyBurnedCard 
} from '../types';
import { 
  getPrizeVault, 
  savePrizeVault, 
  getLoyaltyPrizeTiers, 
  saveLoyaltyPrizeTiers, 
  getBurnedCardsLedger, 
  saveBurnedCardsLedger,
  getLoyaltyTransactions, 
  addVouchersToVault 
} from '../utils/loyaltyManager';
import { soundManager } from '../utils/audio';
import { 
  Gift, 
  Plus, 
  Trash2, 
  Check, 
  Sparkles, 
  Flame, 
  RotateCcw, 
  Layers, 
  Sliders, 
  ShieldCheck, 
  Download,
  Clipboard,
  Trophy
} from 'lucide-react';

export const AdminLoyaltyVaultTab: React.FC = () => {
  const [vault, setVault] = useState<LoyaltyPrizeVoucher[]>(() => getPrizeVault());
  const [tiers, setTiers] = useState<LoyaltyPrizeTier[]>(() => getLoyaltyPrizeTiers());
  const [burnedLedger, setBurnedLedger] = useState<Record<string, LoyaltyBurnedCard>>(() => getBurnedCardsLedger());
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>(() => getLoyaltyTransactions());

  // Sub-tabs in Loyalty Admin
  const [subTab, setSubTab] = useState<'inventory' | 'add' | 'weights' | 'burned'>('inventory');
  
  // Add vouchers state
  const [selectedTierId, setSelectedTierId] = useState(tiers[0]?.id || 'tier_1000');
  const [bulkCodesInput, setBulkCodesInput] = useState('');
  const [addedToast, setAddedToast] = useState(false);

  // Filter state for inventory
  const [filterTier, setFilterTier] = useState<string>('all');

  const burnedCardsList: LoyaltyBurnedCard[] = Object.values(burnedLedger);
  const totalBurned = burnedCardsList.length;
  const totalClaimed = vault.filter(v => v.claimed).length;
  const availableStock = vault.filter(v => !v.claimed).length;

  // Add new vouchers to vault
  const handleAddVouchers = () => {
    soundManager.playTap();
    if (!bulkCodesInput.trim()) return;

    const targetTier = tiers.find(t => t.id === selectedTierId) || tiers[0];
    const codes = bulkCodesInput
      .split(/[\n,\s\t,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length >= 3);

    const items = codes.map(c => ({
      tierId: targetTier.id,
      tierName: targetTier.name,
      code: c,
      price: targetTier.price,
      dataLabel: targetTier.dataLabel,
      durationLabel: targetTier.durationLabel
    }));

    const addedCount = addVouchersToVault(items);
    setVault(getPrizeVault());
    setBulkCodesInput('');
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
    soundManager.playSuccess();
  };

  // Generate automated random test vouchers for a tier
  const handleAutoGenerateBatch = (tierId: string, count: number = 10) => {
    soundManager.playTap();
    const targetTier = tiers.find(t => t.id === tierId) || tiers[0];
    const items = [];
    for (let i = 0; i < count; i++) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      items.push({
        tierId: targetTier.id,
        tierName: targetTier.name,
        code: `TLQ-${targetTier.price}-${randomNum}`,
        price: targetTier.price,
        dataLabel: targetTier.dataLabel,
        durationLabel: targetTier.durationLabel
      });
    }

    addVouchersToVault(items);
    setVault(getPrizeVault());
    soundManager.playSuccess();
  };

  // Delete voucher from vault
  const handleDeleteVoucher = (id: string) => {
    soundManager.playTap();
    const updated = vault.filter(v => v.id !== id);
    setVault(updated);
    savePrizeVault(updated);
  };

  // Update tier probability weight
  const handleWeightChange = (tierId: string, weight: number) => {
    const updated = tiers.map(t => t.id === tierId ? { ...t, probabilityWeight: Math.max(1, weight) } : t);
    setTiers(updated);
    saveLoyaltyPrizeTiers(updated);
  };

  // Clear burned cards ledger (with confirmation)
  const handleResetBurnedLedger = () => {
    if (window.confirm('هل أنت متأكد من تصفير سجل الكروت المحروقة؟ سيتمكن العملاء من إعادة إدخال الكروت القديمة مرة أخرى.')) {
      soundManager.playTap();
      saveBurnedCardsLedger({});
      setBurnedLedger({});
    }
  };

  // Export JSON report
  const handleExportLoyaltyReport = () => {
    soundManager.playTap();
    const report = {
      exportedAt: new Date().toISOString(),
      totalBurned,
      totalClaimed,
      availableStock,
      burnedCards: burnedCardsList,
      transactions,
      vault
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talqa_loyalty_report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2 text-slate-100">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>الكروت المحروقة والمستبدلة</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-mono font-black text-white">{totalBurned} كرت</p>
          <span className="text-[10px] text-slate-500 block">تم منع تكرارها نهائياً</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>الجوائز التي ربحها العملاء</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-mono font-black text-amber-400">{totalClaimed} كرت جائزة</p>
          <span className="text-[10px] text-slate-500 block">سحبت من الصندوق ومستلمة</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>المخزون المتبقي في الصندوق</span>
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-mono font-black text-emerald-400">{availableStock} كرت جاهز</p>
          <span className="text-[10px] text-slate-500 block">جاهزة للفوز في العجلة</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => { soundManager.playTap(); setSubTab('inventory'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'inventory' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            مخزون كروت الجوائز ({availableStock})
          </button>

          <button
            onClick={() => { soundManager.playTap(); setSubTab('add'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              subTab === 'add' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>شحن وإضافة كروت جوائز</span>
          </button>

          <button
            onClick={() => { soundManager.playTap(); setSubTab('weights'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              subTab === 'weights' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>احتمالات ونسب الفوز</span>
          </button>

          <button
            onClick={() => { soundManager.playTap(); setSubTab('burned'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              subTab === 'burned' ? 'bg-rose-500 text-white font-black' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>سجل الكروت المحروقة ({totalBurned})</span>
          </button>
        </div>

        <button
          onClick={handleExportLoyaltyReport}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs flex items-center gap-1 shrink-0 transition-colors"
          title="تصدير تقرير JSON"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تصدير تقرير</span>
        </button>
      </div>

      {/* SUB-TAB 1: INVENTORY LIST */}
      {subTab === 'inventory' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">تصفية بحسب الفئة:</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setFilterTier('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  filterTier === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل
              </button>
              {tiers.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterTier(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    filterTier === t.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {vault
              .filter(v => filterTier === 'all' || v.tierId === filterTier)
              .map((voucher) => (
                <div 
                  key={voucher.id}
                  className={`p-3 rounded-2xl border text-xs space-y-2 relative ${
                    voucher.claimed 
                      ? 'bg-slate-950/60 border-slate-850 opacity-60' 
                      : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{voucher.tierName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      voucher.claimed ? 'bg-rose-950/50 text-rose-400 border border-rose-500/30' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {voucher.claimed ? 'مستلم من عميل' : 'متاح في الصندوق'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl font-mono text-cyan-300 font-bold">
                    <span>{voucher.code}</span>
                    <span>{voucher.price} ريال</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>الرصيد: {voucher.dataLabel}</span>
                    {!voucher.claimed && (
                      <button
                        onClick={() => handleDeleteVoucher(voucher.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="حذف من المخزون"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ADD VOUCHERS */}
      {subTab === 'add' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>إضافة كروت جديدة إلى صندوق الجوائز</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              اختر الفئة وألصق أكواد الكروت التي ولدتها في سيرفر المايكروتك لتقديمها كجوائز للعملاء
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">اختر فئة الكروت المراد إضافتها:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tiers.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTierId(t.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-right transition-all cursor-pointer ${
                    selectedTierId === t.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-bold text-white">{t.name}</p>
                  <span className="text-[10px] text-cyan-400 font-mono">{t.price} ريال · {t.dataLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">أكواد الكروت (كود في كل سطر):</label>
              <button
                type="button"
                onClick={() => handleAutoGenerateBatch(selectedTierId, 10)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد دفعة تجريبية (10 كروت جاهزة)</span>
              </button>
            </div>

            <textarea
              value={bulkCodesInput}
              onChange={(e) => setBulkCodesInput(e.target.value)}
              placeholder="مثال:&#10;TLQ-1000-883921&#10;TLQ-1000-994012&#10;..."
              rows={5}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white font-mono text-xs outline-none"
              dir="ltr"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {addedToast && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>تمت إضافة الكروت بنجاح إلى الصندوق!</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleAddVouchers}
              disabled={!bulkCodesInput.trim()}
              className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              شحن الكروت في الصندوق ⚡
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PROBABILITY WEIGHTS */}
      {subTab === 'weights' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>إدارة نسب واحتمالات الفوز في عجلة الحظ</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              تحكم بفرص ظهور كل فئة كرت في عجلة الحظ بناءً على الوزن النسبي (الرقم الأكبر يعني فرصة ظهور أعلى)
            </p>
          </div>

          <div className="space-y-3">
            {tiers.map((t) => {
              const totalWeight = tiers.reduce((s, item) => s + item.probabilityWeight, 0);
              const percentage = Math.round((t.probabilityWeight / totalWeight) * 100);

              return (
                <div key={t.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></span>
                      <strong className="text-white">{t.name}</strong>
                      <span className="text-slate-400 font-mono text-[11px]">({t.price} ريال)</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-amber-400 font-bold">{percentage}%</span>
                      <span className="text-slate-500 text-[10px]">(وزن: {t.probabilityWeight})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={t.probabilityWeight}
                      onChange={(e) => handleWeightChange(t.id, Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={t.probabilityWeight}
                      onChange={(e) => handleWeightChange(t.id, Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono text-xs text-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BURNED CARDS LEDGER */}
      {subTab === 'burned' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <span>سجل الكروت المحروقة (حماية عدم التكرار)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                قائمة بجميع الكروت التي استبدلها العملاء في برنامج الولاء وممنوع إدخالها مجدداً
              </p>
            </div>

            {totalBurned > 0 && (
              <button
                type="button"
                onClick={handleResetBurnedLedger}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
              >
                تصفير السجل
              </button>
            )}
          </div>

          {totalBurned === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
              لم يتم استبدال أي كروت حتى الآن. بمجرد أن يستبدل أي عميل 10 كروت، ستظهر هنا فوراً.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-1.5">
              {burnedCardsList.map((card, idx) => (
                <div key={card.code} className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px]">#{idx + 1}</span>
                    <strong className="text-rose-300">{card.code}</strong>
                    <span className="text-slate-400 text-[11px] font-sans">({card.packageName || 'كرت طلقة'})</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {new Date(card.redeemedAt).toLocaleString('ar-YE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
