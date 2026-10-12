import React, { useRef, useEffect, useState } from 'react';
import { LoyaltyPrizeTier } from '../types';
import { soundManager } from '../utils/audio';
import { Sparkles, Trophy, RotateCw } from 'lucide-react';

interface FortuneWheelProps {
  tiers: LoyaltyPrizeTier[];
  isSpinning: boolean;
  targetTier?: LoyaltyPrizeTier | null;
  onSpinStart: () => void;
  onSpinComplete: (wonTier: LoyaltyPrizeTier) => void;
  disabled?: boolean;
}

export const FortuneWheel: React.FC<FortuneWheelProps> = ({
  tiers,
  isSpinning,
  targetTier,
  onSpinStart,
  onSpinComplete,
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [isPointerBouncing, setIsPointerBouncing] = useState(false);
  const targetTierRef = useRef<LoyaltyPrizeTier | null>(null);
  const lastSegmentIndexRef = useRef<number>(-1);

  const numSegments = tiers.length;
  const arcSize = (2 * Math.PI) / numSegments;

  // Draw the high-resolution fortune wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 16;

    ctx.clearRect(0, 0, size, size);

    // Save context for wheel rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentRotation);

    // 1. Draw outer rim glow
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.stroke();

    // 2. Draw segments
    tiers.forEach((tier, i) => {
      const angleStart = i * arcSize;
      const angleEnd = angleStart + arcSize;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angleStart, angleEnd);
      ctx.closePath();

      // Segment fill with subtle gradient
      const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, radius);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.7, tier.color);
      grad.addColorStop(1, tier.color);
      ctx.fillStyle = grad;
      ctx.fill();

      // Hairline borders between segments
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 3. Draw segment text
      ctx.save();
      ctx.rotate(angleStart + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = tier.textColor || '#ffffff';
      ctx.font = 'bold 15px Cairo, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(tier.name, radius - 28, 5);

      // Sub-label (Data / Duration)
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(tier.dataLabel, radius - 28, 22);

      ctx.restore();

      // 4. Draw outer rim indicator pegs (golden beads)
      const pegAngle = angleStart;
      const pegX = Math.cos(pegAngle) * (radius + 2);
      const pegY = Math.sin(pegAngle) * (radius + 2);

      ctx.beginPath();
      ctx.arc(pegX, pegY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 5. Draw center wheel hub
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, 2 * Math.PI);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore(); // Restore context to standard coordinate system
  }, [tiers, currentRotation, arcSize, numSegments]);

  // Handle spin trigger
  const handleSpinClick = () => {
    if (isSpinning || disabled) return;
    onSpinStart();
  };

  // Run the physics deceleration animation when isSpinning turns true
  useEffect(() => {
    if (!isSpinning) return;

    // Pick predetermined weighted target tier if provided, or random fallback
    const targetIdx = targetTier ? tiers.findIndex(t => t.id === targetTier.id) : -1;
    const chosenIndex = targetIdx >= 0 ? targetIdx : Math.floor(Math.random() * tiers.length);
    const chosenTier = tiers[chosenIndex];
    targetTierRef.current = chosenTier;

    // Calculate rotation: We want the pointer at the top (which is 3 * Math.PI / 2 or -Math.PI / 2)
    // to point directly into the center of chosen segment
    const targetSegmentCenter = chosenIndex * arcSize + arcSize / 2;
    // Standard top position is 270 deg (1.5 * PI)
    const extraFullRotations = (6 + Math.floor(Math.random() * 3)) * (2 * Math.PI); // 6 to 8 full spins
    const finalAngle = extraFullRotations + (1.5 * Math.PI - targetSegmentCenter);

    const startAngle = currentRotation % (2 * Math.PI);
    const totalRotationNeeded = finalAngle - startAngle;

    const duration = 5200; // 5.2 seconds of thrilling spin
    const startTime = performance.now();

    let animationFrameId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth custom cubic ease-out deceleration curve
      const easeOut = 1 - Math.pow(1 - progress, 3.8);
      const nextRotation = startAngle + totalRotationNeeded * easeOut;

      setCurrentRotation(nextRotation);

      // Audio & Peg Tick Detection:
      // Normalize angle to find which segment is currently passing top pointer (1.5 * Math.PI)
      const normalizedAngle = (2 * Math.PI - (nextRotation % (2 * Math.PI)) + 1.5 * Math.PI) % (2 * Math.PI);
      const currentSegmentIndex = Math.floor(normalizedAngle / arcSize);

      if (currentSegmentIndex !== lastSegmentIndexRef.current) {
        lastSegmentIndexRef.current = currentSegmentIndex;
        soundManager.playWheelTick();
        setIsPointerBouncing(true);
        setTimeout(() => setIsPointerBouncing(false), 80);
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Complete!
        soundManager.playFanfare();
        onSpinComplete(chosenTier);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isSpinning]);

  return (
    <div className="relative flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Top Arrow Pointer Indicator */}
      <div 
        className={`absolute top-0 z-30 transition-transform duration-75 flex flex-col items-center ${
          isPointerBouncing ? '-translate-y-1 scale-110' : 'translate-y-0'
        }`}
      >
        <div className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[34px] border-t-amber-400 drop-shadow-[0_4px_12px_rgba(245,158,11,0.8)] filter"></div>
        <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-amber-300 -mt-10 shadow-sm"></div>
      </div>

      {/* Wheel Canvas Container with ambient lighting */}
      <div className="relative pt-4 flex items-center justify-center">
        {/* Ambient neon back glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/25 via-sky-500/10 to-amber-500/20 blur-2xl pointer-events-none transform scale-95" />

        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="w-[290px] h-[290px] sm:w-[360px] sm:h-[360px] max-w-full drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)] rounded-full transition-transform"
        />

        {/* Center Spin Hub Trigger Button */}
        <button
          type="button"
          onClick={handleSpinClick}
          disabled={isSpinning || disabled}
          className={`absolute z-20 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center p-1 text-center font-black transition-all cursor-pointer shadow-[0_0_25px_rgba(6,182,212,0.6)] ${
            disabled
              ? 'bg-slate-800 text-slate-500 border-2 border-slate-700 cursor-not-allowed opacity-60'
              : isSpinning
              ? 'bg-gradient-to-br from-cyan-500 to-sky-700 text-slate-950 border-2 border-cyan-300 animate-pulse'
              : 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 hover:from-amber-300 hover:to-orange-400 text-slate-950 border-2 border-amber-200 hover:scale-105 active:scale-95'
          }`}
        >
          {isSpinning ? (
            <>
              <RotateCw className="w-6 h-6 animate-spin text-slate-950 mb-0.5" />
              <span className="text-[11px] font-black">يدور الآن...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-slate-950 mb-0.5 animate-bounce" />
              <span className="text-xs font-black tracking-tight">أدر واربح</span>
              <span className="text-[9px] text-slate-900 font-mono">10 كروت</span>
            </>
          )}
        </button>
      </div>

      {/* Helper text under wheel */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-300">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span>كل دورة تمنحك كرتاً حقيقياً مضموناً من أحد الفئات الظاهرة ⚡</span>
      </div>
    </div>
  );
};
