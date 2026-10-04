import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, ListTodo, Home, Settings, WifiOff, Loader2, BarChart2, Download, ArrowUp } from 'lucide-react';
import SwitchDarkMode from './SwitchDarkMode';
import SelectLanguage from './SelectLanguage';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import useTWSession from '../hooks/useTWSession';
import { useAutoUpdater } from '../hooks/useAutoUpdater';
import useScrollPastThreshold from '../hooks/useScrollPastThreshold';

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isConfigured, username, domain, isLoading } = useTWSession();
  const { status: updateStatus, version: updateVersion, percent: updatePercent, installUpdate } = useAutoUpdater();
  const showBackToTop = useScrollPastThreshold(300);

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/worktime', label: t('nav.workTime'), icon: Clock },
    { to: '/tasks', label: t('nav.tasks'), icon: ListTodo },
    { to: '/reports', label: t('nav.reports'), icon: BarChart2 },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <div className="sticky top-8 z-40 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">TW Time Register</h1>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-label={item.label}
                    title={item.label}
                    className={cn('gap-2', isActive && 'bg-secondary')}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {/* TW Session badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-2 text-sm font-normal',
                    isConfigured ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => navigate('/settings')}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isConfigured ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      <span className="max-w-[12rem] truncate">{username}</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('nav.noSession')}</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                {isLoading
                  ? t('nav.verifying')
                  : isConfigured
                    ? t('nav.connectedAs', { username, domain })
                    : t('nav.noCredentials')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <SwitchDarkMode />
          <SelectLanguage />

          {/* Auto-update indicator — only shown when a download is in progress or ready to install */}
          {(updateStatus === 'available' || updateStatus === 'downloaded') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={updateStatus === 'downloaded' ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'gap-2 text-sm',
                        updateStatus === 'downloaded' || updatePercent == null ? 'animate-pulse' : '',
                        updateStatus === 'downloaded'
                          ? 'bg-success hover:bg-success/90 text-success-foreground border-0'
                          : 'border-warning text-warning hover:bg-warning/10'
                      )}
                      onClick={updateStatus === 'downloaded' ? installUpdate : undefined}
                    >
                      <Download className="h-4 w-4" />
                      {updateStatus === 'downloaded'
                        ? t('nav.installing', { version: updateVersion })
                        : updatePercent != null
                          ? t('nav.downloadProgress', {
                              version: updateVersion,
                              percent: Math.round(updatePercent)
                            })
                          : t('nav.updating')}
                    </Button>
                    {updateStatus === 'available' && updatePercent != null && (
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-warning"
                          style={{ width: `${Math.round(updatePercent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {updateStatus === 'downloaded'
                    ? t('nav.downloadedVersion', { version: updateVersion })
                    : t('nav.downloadingVersion', { version: updateVersion })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Blocking install overlay — shown for a bounded moment before the app quits.
              Rendered through a portal so it is not trapped in NavBar's z-40 stacking
              context and can cover the fixed AppBar (z-50). */}
          {updateStatus === 'installing' &&
            createPortal(
              <div
                role="alert"
                className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-success" />
                  <p className="text-lg font-semibold">{t('nav.installingTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('nav.installingDesc', { version: updateVersion })}</p>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>

      {showBackToTop && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="fixed bottom-2 right-6 h-10 w-10 rounded-full shadow-lg"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label={t('common.backToTop')}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('common.backToTop')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default NavBar;
