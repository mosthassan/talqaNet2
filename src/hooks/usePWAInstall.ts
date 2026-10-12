import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global variable to capture beforeinstallprompt immediately at module evaluation time
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-prompt-captured'));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    try {
      localStorage.setItem('netflow_pwa_installed', 'true');
    } catch {}
    window.dispatchEvent(new CustomEvent('pwa-installed-event'));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      localStorage.getItem('netflow_pwa_installed') === 'true'
    );
  });
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isCaptivePortal, setIsCaptivePortal] = useState(false);
  const [isHTTP, setIsHTTP] = useState(false);

  useEffect(() => {
    // 1. Standalone check
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      localStorage.getItem('netflow_pwa_installed') === 'true';
    setIsInstalled(isStandalone);

    // 2. Detect OS & device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // 3. Detect Insecure HTTP
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isInsecure = window.location.protocol === 'http:' && !isLocalhost;
    setIsHTTP(isInsecure);

    // 4. Detect Captive Portal / In-App WebView
    const isWebview =
      /wv|webview|captiveportal|captivenetworksupport/i.test(userAgent) ||
      (isAndroidDevice && /version\/4\.0/i.test(userAgent) && !/chrome\/[0-9]{3}/i.test(userAgent));
    setIsCaptivePortal(isWebview);

    // 5. Global sync listener
    if (globalDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const handlePromptCaptured = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      try {
        localStorage.setItem('netflow_pwa_installed', 'true');
      } catch {}
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('pwa-prompt-captured', handlePromptCaptured);
    window.addEventListener('pwa-installed-event', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-captured', handlePromptCaptured);
      window.removeEventListener('pwa-installed-event', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const install = async (): Promise<'accepted' | 'dismissed' | 'manual_required'> => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (!promptEvent) {
      return 'manual_required';
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        globalDeferredPrompt = null;
        try {
          localStorage.setItem('netflow_pwa_installed', 'true');
        } catch {}
        return 'accepted';
      } else {
        return 'dismissed';
      }
    } catch (err) {
      console.error('Error during PWA install prompt:', err);
      return 'manual_required';
    }
  };

  return {
    isInstallable: !!(deferredPrompt || globalDeferredPrompt),
    hasNativePrompt: !!(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isCaptivePortal,
    isHTTP,
    install,
  };
}
