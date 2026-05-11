import { formatMinutesToHHMM as formatMins } from './timeUtils';
export { formatMins as formatMinutesToHHMM };

export type ProgressStatus = 'on-time' | 'warning' | 'overtime' | 'no-estimate';

export interface TaskProgressInfo {
  estimated: number;
  logged: number;
  pct: number;
  status: ProgressStatus;
  margin: number;
  over: number;
}

export function getTaskProgressInfo(
  estimatedTime: number | null | undefined,
  totalLoggedMinutes: number | undefined
): TaskProgressInfo {
  const estimated = estimatedTime ?? 0;
  const logged = totalLoggedMinutes ?? 0;

  if (!estimated) {
    return {
      estimated,
      logged,
      pct: 0,
      status: 'no-estimate',
      margin: 0,
      over: 0
    };
  }

  const pct = Math.min(100, (logged / estimated) * 100);
  const over = Math.max(0, logged - estimated);
  const margin = Math.max(0, estimated - logged);

  let status: ProgressStatus;
  if (over > 0) {
    status = 'overtime';
  } else if (pct >= 80) {
    status = 'warning';
  } else {
    status = 'on-time';
  }

  return { estimated, logged, pct, status, margin, over };
}

export function getStatusColor(status: ProgressStatus): string {
  switch (status) {
    case 'overtime':
      return 'text-red-500';
    case 'warning':
      return 'text-amber-500';
    case 'on-time':
      return 'text-emerald-500';
    default:
      return 'text-muted-foreground';
  }
}

export function getStatusBarColor(status: ProgressStatus): string {
  switch (status) {
    case 'overtime':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'on-time':
      return 'bg-emerald-500';
    default:
      return 'bg-muted';
  }
}

export function formatProgressBadgeLabel(over: number, margin: number, status: ProgressStatus): string {
  if (status === 'no-estimate') return '';
  if (status === 'overtime') {
    const h = Math.floor(over / 60);
    const m = over % 60;
    if (h > 0) return `+${h}h ${m.toString().padStart(2, '0')}m`;
    return `+${m}m`;
  }
  if (margin >= 30) {
    const h = Math.floor(margin / 60);
    const m = margin % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
  }
  return '';
}
