import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    (window as any).__pwaInstallPrompt || null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if app is running in standalone mode (already installed on phone or desktop)
    const checkIsInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://') ||
        (window as any).__pwaInstalled === true ||
        localStorage.getItem('pwa_is_installed') === 'true';
      setIsInstalled(!!isStandalone);
    };

    checkIsInstalled();

    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    // Listen to media query changes (if installed while open)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        try { localStorage.setItem('pwa_is_installed', 'true'); } catch (err) {}
      }
    };
    mediaQuery.addEventListener?.('change', handleMediaChange);

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // 3. Capture Chrome / Android / Edge install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handlePromptReady = () => {
      if ((window as any).__pwaInstallPrompt) {
        setDeferredPrompt((window as any).__pwaInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      try { localStorage.setItem('pwa_is_installed', 'true'); } catch (err) {}
      (window as any).__pwaInstalled = true;
      (window as any).__pwaInstallPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (window as any).__pwaInstallPrompt;
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
        try { localStorage.setItem('pwa_is_installed', 'true'); } catch (err) {}
        (window as any).__pwaInstalled = true;
        (window as any).__pwaInstallPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('PWA install error:', err);
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}
