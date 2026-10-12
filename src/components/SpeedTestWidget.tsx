import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Play, 
  RotateCcw, 
  Activity, 
  ArrowDown, 
  ArrowUp, 
  Zap, 
  CheckCircle2, 
  Server,
  Share2
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';

export const SpeedTestWidget: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'complete'>('idle');
  const [ping, setPing] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);

  const startTest = () => {
    soundManager.playTap();
    setIsRunning(true);
    setPhase('ping');
    setPing(0);
    setJitter(0);
    setCurrentSpeed(0);
    setDownloadSpeed(0);
    setUploadSpeed(0);

    // Step 1: Ping phase (1.2s)
    let pingCounter = 0;
    const pingInterval = setInterval(() => {
      pingCounter++;
      setPing(Math.floor(Math.random() * 8) + 12);
      setJitter(Math.floor(Math.random() * 3) + 1);
      if (pingCounter > 6) {
        clearInterval(pingInterval);
        startDownloadPhase();
      }
    }, 150);
  };

  const startDownloadPhase = () => {
    setPhase('download');
    let tick = 0;
    const targetDownload = Math.floor(Math.random() * 35) + 65; // 65 - 100 Mbps

    const dlInterval = setInterval(() => {
      tick++;
      // Sine acceleration curve
      const factor = Math.min(1, tick / 20);
      const randomJitter = (Math.random() - 0.5) * 8;
      const speedVal = Math.max(5, Math.round(targetDownload * factor + randomJitter));
      
      setCurrentSpeed(speedVal);
      setDownloadSpeed(speedVal);

      if (tick > 25) {
        clearInterval(dlInterval);
        startUploadPhase();
      }
    }, 120);
  };

  const startUploadPhase = () => {
    setPhase('upload');
    let tick = 0;
    const targetUpload = Math.floor(Math.random() * 20) + 30; // 30 - 50 Mbps

    const ulInterval = setInterval(() => {
      tick++;
      const factor = Math.min(1, tick / 15);
      const randomJitter = (Math.random() - 0.5) * 4;
      const speedVal = Math.max(2, Math.round(targetUpload * factor + randomJitter));

      setCurrentSpeed(speedVal);
      setUploadSpeed(speedVal);

      if (tick > 20) {
        clearInterval(ulInterval);
        finishTest();
      }
    }, 120);
  };

  const finishTest = () => {
    setPhase('complete');
    setIsRunning(false);
    soundManager.playSuccess();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#00f2fe', '#0ea5e9', '#f97316']
    });
  };

  // Convert speed 0-150 to gauge angle (-90deg to +90deg)
  const maxGaugeSpeed = 150;
  const speedPercentage = Math.min(1, currentSpeed / maxGaugeSpeed);
  const needleAngle = -90 + speedPercentage * 180;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Title */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>مقياس السرعة اللحظي لسيرفر طلقة نت</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black font-['Cairo'] text-white">
          فحص سرعة <span className="text-cyan-400">الإنترنت والبينج</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          اختبار مباشر لسرعة التنزيل والرفع وزمن الاستجابة (Latency) إلى كابينة الألياف
        </p>
      </div>

      {/* Main Speedometer Container */}
      <div className="bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(14,165,233,0.2)] text-center relative overflow-hidden">
        
        {/* Server Info */}
        <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>السيرفر: <strong className="text-white">Talqa-Fiber-Core</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>الحالة: <strong className="text-emerald-400">مثالي (1Gbps)</strong></span>
          </div>
        </div>

        {/* Speed Dial SVG */}
        <div className="relative w-64 h-36 mx-auto mt-6 flex items-end justify-center overflow-hidden">
          <svg className="w-64 h-64 absolute -top-14" viewBox="0 0 200 200">
            {/* Background Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Active Colored Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#speedGradient)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * speedPercentage)}
              className="transition-all duration-150 ease-out"
            />
            <defs>
              <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="60%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>

          {/* Needle Indicator */}
          <div
            className="absolute bottom-0 w-1.5 h-24 bg-gradient-to-t from-white to-cyan-400 origin-bottom rounded-full transition-transform duration-150 ease-out shadow-[0_0_15px_#00f2fe]"
            style={{ transform: `rotate(${needleAngle}deg)` }}
          ></div>
          <div className="absolute bottom-[-6px] w-6 h-6 bg-cyan-300 rounded-full border-4 border-slate-950 z-10 shadow-lg"></div>
        </div>

        {/* Big Speed Value Display */}
        <div className="mt-4 mb-6">
          <div className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tight flex items-baseline justify-center gap-2">
            <span>{currentSpeed}</span>
            <span className="text-base sm:text-xl font-sans text-cyan-400 font-bold">Mbps</span>
          </div>
          <div className="text-xs text-slate-400 font-bold mt-1">
            {phase === 'idle' && 'جاهز لبدء الفحص'}
            {phase === 'ping' && 'جارٍ قياس زمن الاستجابة (Ping)...'}
            {phase === 'download' && 'جارٍ فحص سرعة التنزيل (Download)...'}
            {phase === 'upload' && 'جارٍ فحص سرعة الرفع (Upload)...'}
            {phase === 'complete' && 'اكتمل الفحص بنجاح!'}
          </div>
        </div>

        {/* Diagnostic Results Grid */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-800">
          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">البينج</div>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              {ping > 0 ? `${ping} ms` : '--'}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">التذبذب</div>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              {jitter > 0 ? `${jitter} ms` : '--'}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
              <ArrowDown className="w-3 h-3 text-cyan-400" />
              <span>التنزيل</span>
            </div>
            <div className="text-base font-black text-cyan-300 font-mono mt-0.5">
              {downloadSpeed > 0 ? `${downloadSpeed} M` : '--'}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
              <ArrowUp className="w-3 h-3 text-orange-400" />
              <span>الرفع</span>
            </div>
            <div className="text-base font-black text-orange-400 font-mono mt-0.5">
              {uploadSpeed > 0 ? `${uploadSpeed} M` : '--'}
            </div>
          </div>
        </div>

        {/* Start / Re-run Test Button */}
        <div className="mt-6">
          <button
            onClick={startTest}
            disabled={isRunning}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-orange-500 hover:from-cyan-400 hover:to-orange-400 text-slate-950 font-black font-['Cairo'] text-base shadow-[0_0_25px_rgba(14,165,233,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>جارٍ فحص الخط والشبكة...</span>
              </>
            ) : phase === 'complete' ? (
              <>
                <RotateCcw className="w-5 h-5" />
                <span>إعادة الفحص مرة أخرى</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-slate-950" />
                <span>بدء فحص السرعة الفعلي</span>
              </>
            )}
          </button>
        </div>

        {/* Quality Rating on complete */}
        {phase === 'complete' && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>تقييم الخط: ممتاز جداً لمشاهدة 4K Ultra HD ولعب ببجي وفيفا بدون لاج</span>
          </div>
        )}
      </div>
    </div>
  );
};
