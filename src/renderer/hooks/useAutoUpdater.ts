import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../plugins/i18n';

type UpdateStatus = 'idle' | 'available' | 'downloaded';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
}

export function useAutoUpdater(): UpdateState & { installUpdate: () => void } {
  const [state, setState] = useState<UpdateState>({ status: 'idle', version: null });

  const installUpdate = () => {
    window.Main.installUpdate?.();
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

    const handleDownloaded = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'downloaded', version: info.version });
      // Persistent toast — does not auto-dismiss, has install action
      toast.success(i18n.t('nav.updateReadyToast'), {
        description: i18n.t('nav.updateReadyDesc', { version: info.version }),
        duration: Infinity,
        action: {
          label: i18n.t('nav.updateReadyAction'),
          onClick: () => window.Main.installUpdate?.()
        }
      });
    };

    window.Main.on('update-available', handleAvailable);
    window.Main.on('update-downloaded', handleDownloaded);
  }, []);

  return { ...state, installUpdate };
}
