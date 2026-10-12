import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Flashlight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setErrorMsg(null);
    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          soundManager.playScanBeep();
          // Clean up standard hotspot url format if QR is e.g. http://10.5.50.1/login?username=TALQA-123
          let code = decodedText.trim();
          if (code.includes('username=')) {
            const match = code.match(/username=([^&]+)/);
            if (match) code = decodeURIComponent(match[1]);
          } else if (code.includes('code=')) {
            const match = code.match(/code=([^&]+)/);
            if (match) code = decodeURIComponent(match[1]);
          }
          stopScanner();
          onScanSuccess(code);
        },
        () => {
          // ignore frame errors
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Camera QR Scan Error:', err);
      setIsScanning(false);
      setErrorMsg('تعذر الوصول إلى الكاميرا. يرجى التأكد من إعطاء صلاحية الكاميرا أو كتابة الكرت يدوياً.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.error(e);
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(14,165,233,0.3)] text-slate-100 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black font-['Cairo'] text-white">مسح باركود / QR الكرت</h3>
              <p className="text-xs text-slate-400">وجه الكاميرا نحو رمز الاستجابة على بطاقة الشحن</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Scanner Container */}
        <div className="my-5 relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 min-h-[280px] flex items-center justify-center">
          <div id={scannerContainerId} className="w-full h-full min-h-[280px]"></div>

          {/* Cyberpunk Laser Target Overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-64 border-2 border-cyan-400/50 rounded-2xl">
                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></span>
                <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></span>
                <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></span>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></span>

                {/* Animated Laser Scanning Line */}
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f2fe] animate-bounce"></div>
              </div>
            </div>
          )}

          {/* Error display */}
          {errorMsg && (
            <div className="absolute inset-0 p-6 bg-slate-900/95 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
              <p className="text-sm text-slate-300 font-semibold mb-4">{errorMsg}</p>
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          )}
        </div>

        {/* Real Scan Instructions */}
        <div className="pt-2">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>سيتم قراءة كود الكرت تلقائياً وإدخاله في حقل تسجيل الدخول بمجرد توجيه الكاميرا.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
