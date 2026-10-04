import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useActiveTimer } from '../hooks/useActiveTimer';

function formatElapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Home affordance for a running timer. Renders nothing when no timer is active,
 * otherwise shows the running state and live elapsed time and links back to the
 * Register page where the timer can be stopped.
 */
function ActiveTimerChip() {
  const { t } = useTranslation();
  const { startedAt, elapsedMs } = useActiveTimer();

  if (!startedAt) return null;

  return (
    <Link
      to="/worktime"
      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm transition-colors hover:bg-primary/20"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="font-medium">{t('home.timerRunning')}</span>
      <span className="font-mono tabular-nums">{formatElapsed(elapsedMs)}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export default ActiveTimerChip;
