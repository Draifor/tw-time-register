import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';
import useTimeLogs from '../hooks/useTimeLogs';
import {
  syncTimeEntryToTW,
  extractTWTaskId,
  markEntriesAsSent,
  type TimeEntry
} from '../services/timesService';

// Compute duration in hours and minutes from startTime/endTime strings (HH:MM)
function parseDuration(startTime: string, endTime: string): { hours: number; minutes: number } {
  if (!startTime || !endTime) return { hours: 0, minutes: 0 };
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalStart = sh * 60 + sm;
  const totalEnd = eh * 60 + em;
  const diff = Math.max(0, totalEnd - totalStart);
  return { hours: Math.floor(diff / 60), minutes: diff % 60 };
}

function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '—';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function TimeLogsTable() {
  const { data, isLoading, error } = useTimeLogs();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';

  // Track loading state per entry
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);

  const setSyncing = (id: number, value: boolean) =>
    setSyncingIds((prev) => {
      const next = new Set(prev);
      value ? next.add(id) : next.delete(id);
      return next;
    });

  const syncEntry = useCallback(
    async (entry: TimeEntry): Promise<boolean> => {
      if (!entry.taskLink) {
        toast.error(
          isSpanish
            ? `Sin task_link para "${entry.taskName || entry.description}"`
            : `No task_link for "${entry.taskName || entry.description}"`
        );
        return false;
      }

      const twTaskId = await extractTWTaskId(entry.taskLink);
      if (!twTaskId) {
        toast.error(
          isSpanish
            ? `No se pudo extraer el ID de TW de la URL: ${entry.taskLink}`
            : `Could not extract TW task ID from URL: ${entry.taskLink}`
        );
        return false;
      }

      const { hours, minutes } = parseDuration(entry.startTime, entry.endTime);
      if (hours === 0 && minutes === 0) {
        toast.error(isSpanish ? 'Duración es 0 — verifica hora inicio/fin' : 'Duration is 0 — check start/end time');
        return false;
      }

      const result = await syncTimeEntryToTW({
        twTaskId,
        description: entry.description,
        date: entry.date,
        startTime: entry.startTime,
        hours,
        minutes,
        isBillable: entry.isBillable
      });

      if (result.success) {
        await markEntriesAsSent([entry.entryId]);
        return true;
      } else {
        toast.error(result.message || (isSpanish ? 'Error al sincronizar' : 'Sync failed'));
        return false;
      }
    },
    [isSpanish]
  );

  const handleSyncOne = async (entry: TimeEntry) => {
    setSyncing(entry.entryId, true);
    try {
      const ok = await syncEntry(entry);
      if (ok) {
        toast.success(
          isSpanish
            ? `✓ "${entry.taskName || entry.description}" enviado a TW`
            : `✓ "${entry.taskName || entry.description}" sent to TW`
        );
        queryClient.invalidateQueries({ queryKey: ['workTimes'] });
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error(String(err));
    } finally {
      setSyncing(entry.entryId, false);
    }
  };

  const handleSyncAll = async () => {
    const pending = data.filter((e) => !e.isSent);
    if (pending.length === 0) {
      toast.info(isSpanish ? 'No hay entradas pendientes' : 'No pending entries');
      return;
    }
    setSyncingAll(true);
    let successCount = 0;
    let failCount = 0;
    for (const entry of pending) {
      setSyncing(entry.entryId, true);
      try {
        const ok = await syncEntry(entry);
        ok ? successCount++ : failCount++;
      } catch {
        failCount++;
      } finally {
        setSyncing(entry.entryId, false);
      }
    }
    setSyncingAll(false);
    queryClient.invalidateQueries({ queryKey: ['workTimes'] });
    if (failCount === 0) {
      toast.success(
        isSpanish ? `${successCount} entradas enviadas a TeamWork` : `${successCount} entries sent to TeamWork`
      );
    } else {
      toast.warning(
        isSpanish
          ? `${successCount} enviadas, ${failCount} fallidas`
          : `${successCount} sent, ${failCount} failed`
      );
    }
  };

  const pendingCount = data.filter((e) => !e.isSent).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4">
        <AlertCircle className="h-5 w-5" />
        <span>{String((error as Error)?.message || 'Error loading time logs')}</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Clock className="h-12 w-12 opacity-30" />
        <p className="text-lg">{isSpanish ? 'No hay registros de tiempo' : 'No time logs yet'}</p>
        <p className="text-sm">{isSpanish ? 'Crea una entrada en la pantalla principal' : 'Create an entry on the home screen'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length} {isSpanish ? 'entradas' : 'entries'} &middot;{' '}
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {pendingCount} {isSpanish ? 'pendientes' : 'pending'}
          </span>
        </p>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={handleSyncAll}
          disabled={syncingAll || pendingCount === 0}
        >
          {syncingAll ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSpanish ? `Sincronizar ${pendingCount} pendientes` : `Sync ${pendingCount} pending`}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{isSpanish ? 'Fecha' : 'Date'}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{isSpanish ? 'Tarea' : 'Task'}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{isSpanish ? 'Descripción' : 'Description'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Inicio' : 'Start'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Fin' : 'End'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Duración' : 'Duration'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Facturable' : 'Billable'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Estado' : 'Status'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Acciones' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, idx) => {
              const { hours, minutes } = parseDuration(entry.startTime, entry.endTime);
              const isSyncing = syncingIds.has(entry.entryId);
              return (
                <tr
                  key={entry.entryId}
                  className={`border-b last:border-0 transition-colors ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  } hover:bg-accent/30`}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{entry.date}</td>
                  <td className="px-4 py-3 max-w-[160px] truncate">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{entry.taskName || '—'}</span>
                        </TooltipTrigger>
                        {entry.taskLink && (
                          <TooltipContent>
                            <p className="font-mono text-xs">{entry.taskLink}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="px-4 py-3 max-w-[220px] truncate text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{entry.description || '—'}</span>
                        </TooltipTrigger>
                        {entry.description && (
                          <TooltipContent className="max-w-xs">
                            <p>{entry.description}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{entry.startTime || '—'}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{entry.endTime || '—'}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs font-medium">
                    {formatDuration(hours, minutes)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.isBillable ? (
                      <Badge variant="secondary" className="text-xs">
                        {isSpanish ? 'Sí' : 'Yes'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{isSpanish ? 'No' : 'No'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.isSent ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        {isSpanish ? 'Enviado' : 'Sent'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                        <Clock className="h-3 w-3" />
                        {isSpanish ? 'Pendiente' : 'Pending'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!entry.isSent && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={isSyncing}
                              onClick={() => handleSyncOne(entry)}
                            >
                              {isSyncing ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isSpanish ? 'Enviar a TeamWork' : 'Send to TeamWork'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TimeLogsTable;
