import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  X,
  Check,
  Trash2,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import Combobox from './ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from './ui/alert-dialog';
import useTimeLogs from '../hooks/useTimeLogs';
import {
  syncTimeEntryToTW,
  extractTWTaskId,
  markEntriesAsSent,
  updateTimeEntry,
  deleteTimeEntry,
  resetTimeEntryToUnsent,
  type TimeEntry
} from '../services/timesService';

interface EditData {
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  isBillable: boolean;
}

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

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<EditData>({
    date: '',
    startTime: '',
    endTime: '',
    description: '',
    isBillable: false
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Unique task names for the task filter dropdown
  const taskOptions = useMemo(() => {
    const names = [...new Set((data ?? []).map((e) => e.taskName).filter(Boolean))] as string[];
    return names.sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (data ?? []).filter((e) => {
      if (q && !e.description?.toLowerCase().includes(q) && !e.taskName?.toLowerCase().includes(q)) return false;
      if (filterTask && e.taskName !== filterTask) return false;
      if (filterDateFrom && e.date < filterDateFrom) return false;
      if (filterDateTo && e.date > filterDateTo) return false;
      return true;
    });
  }, [data, search, filterTask, filterDateFrom, filterDateTo]);

  const hasActiveFilters = search || filterTask || filterDateFrom || filterDateTo;

  function clearFilters() {
    setSearch('');
    setFilterTask('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const handleDelete = async (entry: TimeEntry) => {
    setDeletingId(entry.entryId);
    try {
      const ok = await deleteTimeEntry(entry.entryId);
      if (ok) {
        toast.success(
          isSpanish
            ? `Entrada "${entry.taskName || entry.description}" eliminada`
            : `Entry "${entry.taskName || entry.description}" deleted`
        );
        queryClient.invalidateQueries({ queryKey: ['workTimes'] });
      } else {
        toast.error(isSpanish ? 'Error al eliminar la entrada' : 'Failed to delete entry');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(String(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (entry: TimeEntry) => {
    setEditingId(entry.entryId);
    setEditData({
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      description: entry.description,
      isBillable: entry.isBillable
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (entry: TimeEntry) => {
    setSavingEdit(true);
    try {
      const ok = await updateTimeEntry(entry.entryId, {
        date: editData.date,
        startTime: editData.startTime,
        endTime: editData.endTime,
        description: editData.description,
        isBillable: editData.isBillable
      });
      if (!ok) {
        toast.error(isSpanish ? 'Error al guardar cambios' : 'Failed to save changes');
        return;
      }
      // If the entry was already sent, reset it to pending so the user can re-sync
      if (entry.isSent) {
        await resetTimeEntryToUnsent(entry.entryId);
        toast.info(
          isSpanish
            ? 'Entrada actualizada y marcada como pendiente — vuelve a sincronizarla con TW'
            : 'Entry updated and marked as pending — sync it again to update TW'
        );
      } else {
        toast.success(isSpanish ? 'Cambios guardados' : 'Changes saved');
      }
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['workTimes'] });
    } catch (err) {
      console.error('Edit error:', err);
      toast.error(String(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const setSyncing = (id: number, value: boolean) =>
    setSyncingIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
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
        if (ok) successCount++;
        else failCount++;
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
        isSpanish ? `${successCount} enviadas, ${failCount} fallidas` : `${successCount} sent, ${failCount} failed`
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
        <p className="text-sm">
          {isSpanish ? 'Crea una entrada en la pantalla principal' : 'Create an entry on the home screen'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isSpanish ? 'Buscar por tarea o descripción...' : 'Search by task or description...'}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {isSpanish ? 'Filtros' : 'Filters'}
            {hasActiveFilters && (
              <span className="ml-0.5 rounded-full bg-primary text-primary-foreground w-4 h-4 text-xs flex items-center justify-center">
                {[search, filterTask, filterDateFrom, filterDateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          {/* Sync button */}
          <Button
            variant="default"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleSyncAll}
            disabled={syncingAll || pendingCount === 0}
          >
            {syncingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSpanish ? `Sync ${pendingCount}` : `Sync ${pendingCount}`}
          </Button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
            {/* Task filter */}
            <div className="space-y-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">{isSpanish ? 'Tarea' : 'Task'}</label>
              <Combobox
                options={taskOptions.map((n) => ({ value: n, label: n }))}
                placeholder={isSpanish ? 'Todas las tareas' : 'All tasks'}
                searchPlaceholder={isSpanish ? 'Buscar tarea...' : 'Search task...'}
                value={filterTask ? { value: filterTask, label: filterTask } : null}
                onChange={(opt) => setFilterTask(opt?.value ?? '')}
              />
            </div>
            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isSpanish ? 'Desde' : 'From'}</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isSpanish ? 'Hasta' : 'To'}</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" />
                {isSpanish ? 'Limpiar' : 'Clear'}
              </Button>
            )}
          </div>
        )}

        {/* Results count when filtering */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            {filteredData.length} {isSpanish ? 'de' : 'of'} {data.length} {isSpanish ? 'entradas' : 'entries'}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{isSpanish ? 'Fecha' : 'Date'}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{isSpanish ? 'Tarea' : 'Task'}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {isSpanish ? 'Descripción' : 'Description'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {isSpanish ? 'Inicio' : 'Start'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{isSpanish ? 'Fin' : 'End'}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {isSpanish ? 'Duración' : 'Duration'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {isSpanish ? 'Facturable' : 'Billable'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {isSpanish ? 'Estado' : 'Status'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                {isSpanish ? 'Acciones' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {hasActiveFilters && filteredData.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                  {isSpanish ? 'Sin resultados para los filtros aplicados' : 'No results match the active filters'}
                </td>
              </tr>
            )}
            {filteredData.map((entry, idx) => {
              const { hours, minutes } = parseDuration(entry.startTime, entry.endTime);
              const isSyncing = syncingIds.has(entry.entryId);
              const isEditing = editingId === entry.entryId;

              // --- EDITING ROW ---
              if (isEditing) {
                const editDuration = parseDuration(editData.startTime, editData.endTime);
                return (
                  <tr key={entry.entryId} className="border-b last:border-0 bg-accent/40">
                    {/* Date */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={editData.date}
                        onChange={(e) => setEditData((d) => ({ ...d, date: e.target.value }))}
                        className="w-32 rounded border border-input bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Task — read-only */}
                    <td className="px-4 py-2 max-w-[160px] truncate text-muted-foreground text-xs">
                      {entry.taskName || '—'}
                    </td>
                    {/* Description */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editData.description}
                        onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                        placeholder={isSpanish ? 'Descripción' : 'Description'}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Start time */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="time"
                        value={editData.startTime}
                        onChange={(e) => setEditData((d) => ({ ...d, startTime: e.target.value }))}
                        className="w-24 rounded border border-input bg-background px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* End time */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="time"
                        value={editData.endTime}
                        onChange={(e) => setEditData((d) => ({ ...d, endTime: e.target.value }))}
                        className="w-24 rounded border border-input bg-background px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Duration (computed) */}
                    <td className="px-4 py-2 text-center font-mono text-xs font-medium text-muted-foreground">
                      {formatDuration(editDuration.hours, editDuration.minutes)}
                    </td>
                    {/* Billable */}
                    <td className="px-2 py-2 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.isBillable}
                          onChange={(e) => setEditData((d) => ({ ...d, isBillable: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 rounded-full border border-input bg-muted peer-checked:bg-primary peer-checked:border-primary transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow after:transition-all after:duration-200 peer-checked:after:translate-x-4" />
                      </label>
                    </td>
                    {/* Status — unchanged */}
                    <td className="px-4 py-2 text-center">
                      {entry.isSent ? (
                        <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          {isSpanish ? 'Enviado' : 'Sent'}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                        >
                          <Clock className="h-3 w-3" />
                          {isSpanish ? 'Pendiente' : 'Pending'}
                        </Badge>
                      )}
                    </td>
                    {/* Save / Cancel / Delete */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                disabled={savingEdit}
                                onClick={() => handleSaveEdit(entry)}
                              >
                                {savingEdit ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isSpanish ? 'Guardar cambios' : 'Save changes'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isSpanish ? 'Cancelar' : 'Cancel'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {/* Delete in edit mode */}
                        <AlertDialog>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    disabled={savingEdit || deletingId === entry.entryId}
                                  >
                                    {deletingId === entry.entryId ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isSpanish ? 'Eliminar entrada' : 'Delete entry'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {isSpanish ? '¿Eliminar esta entrada?' : 'Delete this entry?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {isSpanish
                                  ? 'Esta acción no se puede deshacer. La entrada se eliminará solo localmente.'
                                  : 'This action cannot be undone. The entry will be removed locally only.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{isSpanish ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(entry)}
                              >
                                {isSpanish ? 'Eliminar' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              }

              // --- NORMAL ROW ---
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
                      <Badge
                        variant="outline"
                        className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                      >
                        <Clock className="h-3 w-3" />
                        {isSpanish ? 'Pendiente' : 'Pending'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Edit button — always visible */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              disabled={editingId !== null}
                              onClick={() => handleStartEdit(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {entry.isSent
                                ? isSpanish
                                  ? 'Editar y reenviar a TW'
                                  : 'Edit & re-sync to TW'
                                : isSpanish
                                  ? 'Editar entrada'
                                  : 'Edit entry'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {/* Sync button — only for pending */}
                      {!entry.isSent && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={isSyncing || editingId !== null}
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
                      {/* Delete button */}
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  disabled={editingId !== null || deletingId === entry.entryId}
                                >
                                  {deletingId === entry.entryId ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isSpanish ? 'Eliminar entrada' : 'Delete entry'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isSpanish ? '¿Eliminar esta entrada?' : 'Delete this entry?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {isSpanish
                                ? 'Esta acción no se puede deshacer. La entrada se eliminará solo localmente.'
                                : 'This action cannot be undone. The entry will be removed locally only.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{isSpanish ? 'Cancelar' : 'Cancel'}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(entry)}
                            >
                              {isSpanish ? 'Eliminar' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
