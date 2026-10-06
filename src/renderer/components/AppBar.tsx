import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Maximize2, HelpCircle } from 'lucide-react';

import Icon from '../assets/icons/Icon-Electron.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

function AppBar() {
  const [isMaximize, setMaximize] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (aboutOpen && !appVersion) {
      window.Main.getAppVersion()
        .then(setAppVersion)
        .catch(() => setAppVersion('?'));
    }
  }, [aboutOpen, appVersion]);

  // Keep the Maximize/Restore icon bound to the real BrowserWindow state, so
  // native transitions (double-click on the frameless title bar, OS shortcuts)
  // stay in sync instead of relying only on the button's own click.
  useEffect(() => {
    let active = true;

    window.Main.isMaximized()
      .then((maximized) => {
        if (active) setMaximize(maximized);
      })
      .catch(() => {
        // Keep the default state if the query fails.
      });

    const handleMaximizeChange = (maximized: unknown) => {
      if (active) setMaximize(Boolean(maximized));
    };

    window.Main.on('window:maximized', handleMaximizeChange);

    return () => {
      active = false;
      window.Main.off('window:maximized', handleMaximizeChange);
    };
  }, []);

  const handleToggle = () => {
    window.Main.Maximize();
  };

  const handleCheckForUpdates = () => {
    sessionStorage.setItem('manualUpdateCheck', '1');
    window.Main.checkForUpdates?.();
  };

  return (
    <div className="fixed top-0 w-full z-50">
      <div className="bg-card text-card-foreground border-b border-border h-8 flex justify-between items-center draggable">
        <div className="inline-flex items-center gap-1 pl-2">
          <img className="h-5 w-5" src={Icon} alt="TW Time Register" />
          <span className="text-sm font-medium">TW Time Register</span>
        </div>
        <div className="inline-flex h-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="undraggable w-10 h-full flex items-center justify-center hover:bg-accent transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t('menu.help.help')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleCheckForUpdates}>{t('menu.help.checkForUpdates')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAboutOpen(true)}>{t('menu.help.about')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={window.Main.Minimize}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-accent transition-colors"
            aria-label={t('appBar.minimize')}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleToggle}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-accent transition-colors"
            aria-label={isMaximize ? t('appBar.restore') : t('appBar.maximize')}
          >
            {isMaximize ? <Maximize2 className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={window.Main.Close}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <img src={Icon} alt="TW Time Register" className="h-10 w-10" />
              <div>
                <DialogTitle className="text-left">{t('menu.help.aboutDialogTitle')}</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {appVersion ? `v${appVersion}` : '...'}
                </p>
              </div>
            </div>
            <DialogDescription className="text-left">{t('menu.help.aboutDesc')}</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">{t('menu.help.builtWith')}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppBar;
