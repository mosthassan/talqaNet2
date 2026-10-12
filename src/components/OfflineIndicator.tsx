import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-500/95 backdrop-blur-md px-4 py-2 text-xs font-black text-slate-950 shadow-2xl border border-amber-300/40 animate-bounce">
      <WifiOff className="w-4 h-4 text-slate-950 animate-pulse" />
      <span>وضع عدم الاتصال — يتم استخدام البيانات المحفوظة محلياً</span>
    </div>
  );
};
