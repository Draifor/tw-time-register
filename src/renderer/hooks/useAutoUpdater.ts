import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../plugins/i18n';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date' | 'installing';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  percent: number | null;
  bytesPerSecond: number | null;
}

/** How long the "installing" overlay is shown before the app actually quits. */
export const INSTALL_OVERLAY_DELAY_MS = 1200;

export function useAutoUpdater(): UpdateState & { installUpdate: () => void; checkForUpdates: () => void } {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    percent: null,
    bytesPerSecond: null
  });

  // Guards the delayed install against a double click / double invocation.
  const installScheduledRef = useRef(false);

  // Stable identities so consumers can safely use these in dependency arrays.
  const installUpdate = useCallback(() => {
    if (installScheduledRef.current) return;
    installScheduledRef.current = true;
    // Flip to the blocking overlay synchronously, then let it render for a
    // bounded moment before the process is killed (D6).
    setState((s) => ({ ...s, status: 'installing' }));
    setTimeout(() => {
      window.Main.installUpdate?.();
    }, INSTALL_OVERLAY_DELAY_MS);
  }, []);

  const checkForUpdates = useCallback(() => {
    setState((s) => ({ ...s, status: 'checking' }));
    sessionStorage.setItem('manualUpdateCheck', '1');
    window.Main.checkForUpdates?.().catch?.(() => {
      setState((s) => ({ ...s, status: 'idle' }));
      sessionStorage.removeItem('manualUpdateCheck');
    });
  }, []);

  useEffect(() => {
    const handleAvailable = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'available', version: info.version, percent: null, bytesPerSecond: null });
      toast.info(i18n.t('nav.updateAvailableToast'), {
        description: i18n.t('nav.updateAvailableDesc', { version: info.version }),
        duration: 6000
      });
    };

    const handleNotAvailable = () => {
      // Always reset to idle — no badge should remain after finding no update
      setState((s) => ({ ...s, status: 'idle' }));
      // Solo mostrar toast cuando el usuario lo pidió manualmente
      // El evento se emite también en el chequeo automático al arrancar;
      // usamos el flag en sessionStorage para distinguirlos
      if (sessionStorage.getItem('manualUpdateCheck') === '1') {
        sessionStorage.removeItem('manualUpdateCheck');
        toast.success(i18n.t('nav.upToDateToast'), {
          description: i18n.t('nav.upToDateDesc'),
          duration: 4000
        });
      }
    };

    const handleDownloadProgress = (data: unknown) => {
      const info = data as { percent: number; bytesPerSecond: number };
      // Status stays `available` while downloading; only the progress values change.
      setState((s) => ({ ...s, percent: info.percent, bytesPerSecond: info.bytesPerSecond }));
    };

    const handleDownloaded = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'downloaded', version: info.version, percent: null, bytesPerSecond: null });
      toast.success(i18n.t('nav.updateReadyToast'), {
        description: i18n.t('nav.updateReadyDesc', { version: info.version }),
        duration: Infinity,
        action: {
          label: i18n.t('nav.updateReadyAction'),
          // Route through the hook so the "installing" overlay is shown too.
          onClick: installUpdate
        }
      });
    };

    const handleError = (data: unknown) => {
      const info = data as { message: string };
      setState((s) => ({ ...s, status: 'idle' }));
      toast.error(i18n.t('nav.updateError'), {
        description: info.message,
        duration: 8000
      });
    };

    window.Main.on('update-available', handleAvailable);
    window.Main.on('update-not-available', handleNotAvailable);
    window.Main.on('update-download-progress', handleDownloadProgress);
    window.Main.on('update-downloaded', handleDownloaded);
    window.Main.on('update-error', handleError);

    return () => {
      window.Main.off('update-available', handleAvailable);
      window.Main.off('update-not-available', handleNotAvailable);
      window.Main.off('update-download-progress', handleDownloadProgress);
      window.Main.off('update-downloaded', handleDownloaded);
      window.Main.off('update-error', handleError);
    };
  }, []);

  // Post-restart confirmation (D3): ask main for a consumed marker once on mount
  // and toast when the app just came back on a newer version.
  useEffect(() => {
    let cancelled = false;

    const checkUpdateResult = async () => {
      try {
        const result = await window.Main.getUpdateResult?.();
        if (cancelled || !result) return;
        toast.success(i18n.t('nav.updatedSuccess', { version: result.updatedTo }), {
          description: i18n.t('nav.updatedSuccessDesc', { version: result.updatedTo })
        });
      } catch {
        // A missing/failed result (dev, no marker, read error) must not break startup.
      }
    };

    void checkUpdateResult();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, installUpdate, checkForUpdates };
}
