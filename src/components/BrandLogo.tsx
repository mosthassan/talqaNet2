import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  animate?: boolean;
  networkName?: string;
  slogan?: string;
  onSecretTrigger?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  animate = true,
  networkName = 'طلقة نت',
  slogan = 'منظومة ستارلينك الفضائية وكروت ميكروتك الذكية',
  onSecretTrigger
}) => {
  const sizeMap = {
    sm: { box: 'w-8 h-8', svg: 'w-5 h-5', title: 'text-base', sub: 'text-[10px]' },
    md: { box: 'w-11 h-11', svg: 'w-7 h-7', title: 'text-xl', sub: 'text-xs' },
    lg: { box: 'w-16 h-16', svg: 'w-10 h-10', title: 'text-2xl', sub: 'text-sm' },
    xl: { box: 'w-20 h-20', svg: 'w-12 h-12', title: 'text-3xl', sub: 'text-base' }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Glowing Logo Icon Container */}
      <div
        onClick={(e) => {
          if (onSecretTrigger) {
            onSecretTrigger();
          }
        }}
        className={`relative ${currentSize.box} rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500 via-sky-600 to-orange-500 shadow-[0_0_20px_rgba(14,165,233,0.5)] border border-cyan-300/30 shrink-0 ${
          animate ? 'group hover:scale-105 transition-transform duration-300' : ''
        }`}
      >
        {/* Glow Ring Behind */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-orange-500 rounded-2xl blur-sm opacity-40 group-hover:opacity-75 transition duration-500"></div>

        {/* Speed Fiber SVG Shape */}
        <svg
          className={`relative ${currentSize.svg} text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]`}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fiber speed trail streaks */}
          <path
            d="M3 7H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="opacity-70"
          />
          <path
            d="M2 12H7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="opacity-90"
          />
          <path
            d="M4 17H8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="opacity-60"
          />
          {/* Main Electric Lightning Bullet */}
          <path
            d="M14 2L6 13H13L10 22L21 9H14L16 2Z"
            fill="currentColor"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        </svg>

        {/* Pulsing Dot in corner */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-300 border border-slate-900"></span>
        </span>
      </div>

      {/* Brand Name and Slogan */}
      {showText && (
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight text-white ${currentSize.title} font-['Cairo'] flex items-center gap-1`}>
              {networkName.includes('طلقة') ? (
                <>
                  طلقة <span className="text-cyan-400 font-extrabold">{networkName.replace('طلقة', '').trim() || 'نت'}</span>
                </>
              ) : (
                <span>{networkName}</span>
              )}
            </span>
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full tracking-wider">
              FIBER
            </span>
          </div>
          <span className={`text-cyan-200/80 font-bold ${currentSize.sub} tracking-wide`}>
            {slogan}
          </span>
        </div>
      )}
    </div>
  );
};
