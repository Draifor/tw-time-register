import React, { useEffect, useState } from 'react';
import { TimerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface LiveTimerProps {
  startedAt: Date;
  onStop: () => void;
  onElapsedMinutesChange?: (minutes: number) => void;
}

const computeElapsedSeconds = (startedAt: Date): number =>
  Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Self-contained live timer. Owns its 1-second interval and elapsed-seconds
 * state so the surrounding form does not re-render on every tick. Minutes are
 * reported upward at minute granularity for projected-progress calculations.
 */
export default function LiveTimer({ startedAt, onStop, onElapsedMinutesChange }: LiveTimerProps) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => computeElapsedSeconds(startedAt));

  useEffect(() => {
    setElapsedSeconds(computeElapsedSeconds(startedAt));
    const intervalId = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(startedAt));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [startedAt]);

  useEffect(() => {
    onElapsedMinutesChange?.(Math.floor(elapsedSeconds / 60));
  }, [elapsedSeconds, onElapsedMinutesChange]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-mono tabular-nums"
            onClick={onStop}
          >
            <TimerOff className="h-4 w-4 mr-1.5 animate-pulse" />
            {formatElapsed(elapsedSeconds)}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('workTimeForm.timer.stop')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
