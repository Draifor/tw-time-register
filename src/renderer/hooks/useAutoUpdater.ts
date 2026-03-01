import { useEffect, useState } from 'react';

type UpdateStatus = 'idle' | 'available' | 'downloaded';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
}

export function useAutoUpdater(): UpdateState & { installUpdate: () => void } {
  const [state, setState] = useState<UpdateState>({ status: 'idle', version: null });

  useEffect(() => {
    const handleAvailable = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'available', version: info.version });
    };

    const handleDownloaded = (data: unknown) => {
      const info = data as { version: string };
      setState({ status: 'downloaded', version: info.version });
    };

    window.Main.on('update-available', handleAvailable);
    window.Main.on('update-downloaded', handleDownloaded);

    // Cleanup: electron-updater events are fire-and-forget so we just let them be
  }, []);

  const installUpdate = () => {
    window.Main.installUpdate?.();
  };

  return { ...state, installUpdate };
}
