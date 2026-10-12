import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Tv, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Flame, 
  Film, 
  Gamepad2, 
  Download, 
  Eye, 
  Zap,
  Activity,
  RotateCw,
  AlertTriangle,
  Radio,
  ExternalLink
} from 'lucide-react';
import Hls from 'hls.js';
import { soundManager } from '../utils/audio';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SportsChannel {
  id: string;
  name: string;
  url: string;
  category: string;
  matchTitle: string;
  league: string;
  commentator: string;
  score: string;
  status: 'live' | 'upcoming';
  viewers: number;
}

const SPORTS_CHANNELS: SportsChannel[] = [
  {
    id: 'bein1',
    name: '⚽ beIN Sports 1 HD',
    url: 'http://192.168.50.2:8888/live/bein1/',
    category: 'سيرفر محلي LAN',
    matchTitle: 'ريال مدريد vs مانشستر سيتي',
    league: 'دوري أبطال أوروبا',
    commentator: 'عصام الشوالي',
    score: '2 - 1 (الدقيقة 72\')',
    status: 'live',
    viewers: 1450
  },
  {
    id: 'bein2',
    name: '⚽ beIN Sports 2 HD',
    url: 'http://192.168.50.2:8888/live/bein2/',
    category: 'سيرفر محلي LAN',
    matchTitle: 'برشلونة vs أتلتيكو مدريد',
    league: 'الدوري الإسباني - الجولة 28',
    commentator: 'حفيظ دراجي',
    score: '1 - 0 (الشوط الثاني)',
    status: 'live',
    viewers: 980
  },
  {
    id: 'ssc1',
    name: '⚽ SSC Sports 1 HD',
    url: 'http://192.168.50.2:8888/live/ssc1/',
    category: 'سيرفر محلي LAN',
    matchTitle: 'الهلال vs العين',
    league: 'دوري أبطال آسيا للنخبة',
    commentator: 'فارس عوض',
    score: '0 - 0 (تبدأ قريباً)',
    status: 'live',
    viewers: 820
  }
];

const LOCAL_MOVIES = [
  {
    id: 'mv1',
    title: 'Dune: Part Two (2024)',
    category: 'خيال علمي • 4K UHD',
    duration: '2h 46m',
    rating: '8.8 ★',
    speed: 'تحميل فوري 100Mbps'
  },
  {
    id: 'mv2',
    title: 'Oppenheimer (2023)',
    category: 'دراما تاريخية • 1080p',
    duration: '3h 00m',
    rating: '8.9 ★',
    speed: 'تحميل فوري 100Mbps'
  },
  {
    id: 'mv3',
    title: 'Spider-Man: Across the Spider-Verse',
    category: 'أنيميشن • أكشن',
    duration: '2h 20m',
    rating: '8.7 ★',
    speed: 'تحميل فوري 100Mbps'
  }
];

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'cinema' | 'games'>('matches');
  const [selectedChannel, setSelectedChannel] = useState<SportsChannel>(SPORTS_CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Initialize and attach HLS stream
  useEffect(() => {
    if (!isOpen || activeTab !== 'matches') return;

    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);
    setStreamError(null);

    // Timeout alert if stream takes too long (e.g., local server offline or buffering)
    const timeout = setTimeout(() => {
      if (video.paused || video.readyState < 2) {
        setStreamError('جاري تحميل البث أو القناة غير مفعلة حالياً');
      }
    }, 4500);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        manifestLoadingTimeOut: 6000,
        levelLoadingTimeOut: 6000
      });
      hlsRef.current = hls;

      hls.loadSource(selectedChannel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        setStreamError(null);
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setIsBuffering(false);
          setStreamError('جاري تحميل البث أو القناة غير مفعلة حالياً');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari iOS
      video.src = selectedChannel.url;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        setStreamError(null);
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      });
      video.addEventListener('error', () => {
        setIsBuffering(false);
        setStreamError('جاري تحميل البث أو القناة غير مفعلة حالياً');
      });
    } else {
      setIsBuffering(false);
      setStreamError('متصفحك لا يدعم مشغل HLS للبث المباشر');
    }

    return () => {
      clearTimeout(timeout);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, selectedChannel, activeTab]);

  const handleChannelSwitch = (channel: SportsChannel) => {
    soundManager.playTap();
    setSelectedChannel(channel);
  };

  const handleRetryStream = () => {
    soundManager.playTap();
    setIsBuffering(true);
    setStreamError(null);
    const curr = { ...selectedChannel };
    setSelectedChannel(curr);
  };

  const toggleFullScreen = () => {
    soundManager.playTap();
    const container = playerContainerRef.current;
    const video = videoRef.current;
    if (!container && !video) return;

    if (!document.fullscreenElement) {
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (video?.requestFullscreen) {
        video.requestFullscreen().catch(() => {});
      } else if ((video as any)?.webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      }

      // Try screen orientation lock to landscape
      try {
        if ((screen as any).orientation && (screen as any).orientation.lock) {
          (screen as any).orientation.lock('landscape').catch(() => {});
        }
      } catch {}
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      try {
        if ((screen as any).orientation && (screen as any).orientation.unlock) {
          (screen as any).orientation.unlock().catch(() => {});
        }
      } catch {}
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-[0_0_60px_rgba(16,185,129,0.25)] text-slate-100 max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Tv className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black font-['Cairo'] text-white">
                  طلقة نت - الترفيه والوسائط
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>مباشر LIVE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                بث رياضي مباشر • سينما ومسلسلات • تطبيقات
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 my-3 shrink-0">
          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('matches');
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>بث المباريات</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('cinema');
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cinema'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>السينما والأفلام</span>
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setActiveTab('games');
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'games'
                ? 'bg-orange-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>الألعاب والتطبيقات</span>
          </button>
        </div>

        {/* Tab 1: Live Sports Stream */}
        {activeTab === 'matches' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Real HTML5 & MediaMTX Embedded Stream Player */}
            <div 
              ref={playerContainerRef}
              className="relative aspect-video rounded-2xl bg-black border border-emerald-500/40 overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.9)] flex items-center justify-center group"
            >
              <iframe
                src={selectedChannel.url}
                className="w-full h-full border-0 bg-black"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                title={selectedChannel.name}
              />

              {/* Floating Top Indicator Bar */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600/90 text-white font-black text-xs shadow-lg backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    <span>بث مباشر حي</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/85 border border-slate-700 text-cyan-300 text-xs font-bold backdrop-blur-md">
                    {selectedChannel.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-slate-200 bg-slate-900/85 px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur-md">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{selectedChannel.viewers} متابع</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Player Quick Controls & Fullscreen Edge-to-Edge Action */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="font-bold text-white">{selectedChannel.matchTitle}</span>
                <span className="text-slate-400 hidden sm:inline">• {selectedChannel.league}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullScreen}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>تكبير الشاشة</span>
                </button>
                <a
                  href={selectedChannel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all no-underline"
                  title="فتح المشغل في صفحة مستقلة"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>نافذة مستقلة</span>
                </a>
              </div>
            </div>

            {/* Sporty Channel Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 font-['Cairo']">
                <span>القنوات الرياضية المتاحة:</span>
                <span className="text-emerald-400 font-mono">3 قنوات HD</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SPORTS_CHANNELS.map((ch) => {
                  const isActive = selectedChannel.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => handleChannelSwitch(ch)}
                      className={`p-3 rounded-2xl border transition-all text-right cursor-pointer flex flex-col justify-between space-y-2 ${
                        isActive
                          ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-cyan-950/80 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-['Cairo'] font-black text-sm text-white">
                          {ch.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                          isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isActive ? '● جاري البث' : 'تشغيل'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        <div>{ch.matchTitle}</div>
                        <div className="text-emerald-400/90 font-mono text-[10px] mt-0.5">🎙️ {ch.commentator}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Local Cinema & VOD */}
        {activeTab === 'cinema' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Direct Open Server Action Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-sky-950/80 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4 text-right">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎬</span>
                  <h4 className="font-['Cairo'] font-black text-base text-white">منصة الأفلام والمسلسلات</h4>
                  <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-bold">4K UHD</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  مكتبة وسائط ضخمة من أحدث الأفلام والمسلسلات بجودة 4K وبدون تقطيع.
                </p>
              </div>

              <a
                href="http://192.168.50.2:8096"
                onClick={() => soundManager.playTap()}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer shrink-0 no-underline"
              >
                <span>فتح منصة السينما الآن</span>
                <span>🍿 ↗</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LOCAL_MOVIES.map((mv) => (
                <div key={mv.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-orange-400 font-bold mb-1">
                      <span>{mv.rating}</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">{mv.duration}</span>
                    </div>
                    <h5 className="font-bold text-sm text-white">{mv.title}</h5>
                    <p className="text-xs text-slate-400 mt-1">{mv.category}</p>
                  </div>

                  <a
                    href="http://192.168.50.2:8096"
                    onClick={() => soundManager.playTap()}
                    className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer no-underline"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>مشاهدة الفيلم</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Local Fast App & Game Downloads */}
        {activeTab === 'games' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="p-3 rounded-2xl bg-orange-950/40 border border-orange-500/30 text-xs text-orange-200">
              🚀 تنزيل تحديثات وحزم ببجي وفري فاير وتطبيقات أندرويد بسرعة فائقة من السيرفر المحلي مباشرة.
            </div>

            <div className="space-y-2">
              {[
                { name: 'حزمة تحديث PUBG Mobile (v3.2) الكاملة', size: '1.8 GB', time: 'أقل من دقيقتين' },
                { name: 'تطبيق Free Fire Max - التحديث الرسمي', size: '1.2 GB', time: 'دقيقة واحدة' },
                { name: 'تطبيق طلقة نت المطور (APK مباشر)', size: '14 MB', time: 'ثانية واحدة' }
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-white">{item.name}</div>
                    <div className="text-[11px] text-slate-400">الحجم: {item.size} • وقت التنزيل التقديري: {item.time}</div>
                  </div>
                  <button
                    onClick={() => soundManager.playTap()}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل محلي</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
