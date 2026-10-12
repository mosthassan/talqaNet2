import React, { useState } from 'react';
import { NetworkAnnouncement } from '../types';
import { NetworkConfig } from '../utils/packagesStorage';
import { Zap, Sparkles, X, ChevronLeft } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface NetworkAnnouncementBarProps {
  announcements: NetworkAnnouncement[];
  onOpenPackages: () => void;
  networkConfig?: NetworkConfig;
}

export const NetworkAnnouncementBar: React.FC<NetworkAnnouncementBarProps> = ({
  announcements,
  onOpenPackages,
  networkConfig
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Use custom announcement from networkConfig if set, otherwise fallback to list
  const title = networkConfig?.announcementTitle || (announcements[0]?.title ?? 'عروض شبكة طلقة نت');
  const content = networkConfig?.announcementText || (announcements[0]?.content ?? 'تصفح باقات الألياف الضوئية السريعة الآن');
  const linkText = announcements[0]?.linkText || 'عرض الباقات';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 my-3 animate-fadeIn">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-orange-950/80 border border-cyan-500/30 p-3 sm:p-3.5 shadow-md flex items-center justify-between gap-3">
        {/* Animated Glow Dot */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>

          <div className="min-w-0 text-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <span className="truncate">{title}</span>
              <span className="text-[10px] text-cyan-300/80 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20 shrink-0">
                جديد 🔥
              </span>
            </div>
            <p className="text-slate-300 text-[11px] truncate mt-0.5">{content}</p>
          </div>
        </div>

        {/* Action button & Dismiss */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              soundManager.playTap();
              onOpenPackages();
            }}
            className="px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{linkText}</span>
            <ChevronLeft className="w-3 h-3" />
          </button>

          <button
            onClick={() => {
              soundManager.playTap();
              setDismissed(true);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
