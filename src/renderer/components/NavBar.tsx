import React, { useEffect, useState } from 'react';
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

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isConfigured, username, domain, isLoading } = useTWSession();
  const { status: updateStatus, version: updateVersion, installUpdate } = useAutoUpdater();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/worktime', label: t('nav.workTime'), icon: Clock },
    { to: '/tasks', label: t('nav.tasks'), icon: ListTodo },
    { to: '/reports', label: t('nav.reports'), icon: BarChart2 },
    { to: '/settings', label: t('nav.settings'), icon: Settings }
  ];

  return (
    <div className="sticky top-14 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
                    className={cn('gap-2', isActive && 'bg-secondary')}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
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
                    isConfigured
                      ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => navigate('/settings')}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isConfigured ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span>{username}</span>
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
                  <Button
                    variant={updateStatus === 'downloaded' ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'gap-2 text-sm animate-pulse',
                      updateStatus === 'downloaded'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
                        : 'border-amber-500 text-amber-500 hover:bg-amber-500/10'
                    )}
                    onClick={updateStatus === 'downloaded' ? installUpdate : undefined}
                  >
                    <Download className="h-4 w-4" />
                    {updateStatus === 'downloaded'
                      ? t('nav.installing', { version: updateVersion })
                      : t('nav.updating')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {updateStatus === 'downloaded'
                    ? t('nav.downloadedVersion', { version: updateVersion })
                    : t('nav.downloadingVersion', { version: updateVersion })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
