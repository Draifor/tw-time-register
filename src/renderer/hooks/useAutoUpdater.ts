import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../plugins/i18n';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
}

export function useAutoUpdater(): UpdateState & { installUpdate: () => void; checkForUpdates: () => void } {
  const [state, setState] = useState<UpdateState>({ status: 'idle', version: null });

  const installUpdate = () => {
    window.Main.installUpdate?.();
  };

  const checkForUpdates = () => {
    setState((s) => ({ ...s, status: 'checking' }));
    sessionStorage.setItem('manualUpdateCheck', '1');
    window.Main.checkForUpdates?.().catch?.(() => {
      setState((s) => ({ ...s, status: 'idle' }));
      sessionStorage.removeItem('manualUpdateCheck');
    });
  };

  useEffect(() => {
    const handleAvailable = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'available', version: info.version });
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

    const handleDownloaded = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'downloaded', version: info.version });
      toast.success(i18n.t('nav.updateReadyToast'), {
        description: i18n.t('nav.updateReadyDesc', { version: info.version }),
        duration: Infinity,
        action: {
          label: i18n.t('nav.updateReadyAction'),
          onClick: () => window.Main.installUpdate?.()
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
    window.Main.on('update-downloaded', handleDownloaded);
    window.Main.on('update-error', handleError);
  }, []);

  return { ...state, installUpdate, checkForUpdates };
}
