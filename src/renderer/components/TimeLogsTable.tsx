import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Pencil,
  X,
  Check,
  Trash2,
  Copy,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { StatusBadge } from './ui/status-badge';
import { EmptyState, ErrorState } from './ui/empty-state';
import { TableToolbar, TableToolbarSearch } from './ui/table-toolbar';
import { Skeleton } from './ui/skeleton';
import Combobox from './ui/combobox';
import { Switch } from './ui/switch';
import TimePickerInput from './ui/time-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import useTimeLogs from '../hooks/useTimeLogs';
import {
  smartSyncEntries,
  addTimeEntry,
  updateTimeEntry,
  deleteEntryAndSync,
  resetTimeEntryToUnsent,
  type TimeEntry
} from '../services/timesService';
import PullFromTWDialog from './PullFromTWDialog';
import TaskCommentDialog from './TaskCommentDialog';
import DeleteEntryDialog from './DeleteEntryDialog';

interface EditData {
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  isBillable: boolean;
}

import { parseDuration, formatDuration } from '../lib/timeUtils';
import { fetchTasks } from '../services/tasksService';
import { queryKeys } from '../lib/queryKeys';
import { getTaskProgressInfo, getStatusDotColor } from '../lib/progressUtils';
import { Task } from '../../types/tasks';

export interface TimeLogRowProps {
  entry: TimeEntry;
  idx: number;
  isSyncing: boolean;
  /** True while any row is being edited; locks the per-row action buttons. */
  isRowLocked: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
  tasksByName: Map<string, Task>;
  onStartEdit: (entry: TimeEntry) => void;
  onDuplicate: (entry: TimeEntry) => void;
  onSyncOne: (entry: TimeEntry) => void;
  onRequestDelete: (entry: TimeEntry) => void;
  onOpenExternal: (link: string) => void;
  /** Absolute index in the filtered list; consumed by the virtualizer's measurement. */
  dataIndex?: number;
  /** react-virtual measurement callback; attached to the row element when windowed. */
  measureRef?: (element: Element | null) => void;
}

/** Default row height before react-virtual measures the real rendered height. */
const ROW_ESTIMATE_HEIGHT = 48;

const estimateRowHeight = () => ROW_ESTIMATE_HEIGHT;

/** Stable no-op ref so an un-windowed row keeps `React.memo` referential equality. */
const NOOP_MEASURE_REF = () => {};

// Extracted out of the table body so a row can skip re-rendering when only
// unrelated rows or parent state change. Every prop is referentially stable or
// a primitive; the map is memoized in the table.
export const TimeLogRow = React.memo(function TimeLogRow({
  entry,
  idx,
  isSyncing,
  isRowLocked,
  isDuplicating,
  isDeleting,
  tasksByName,
  onStartEdit,
  onDuplicate,
  onSyncOne,
  onRequestDelete,
  onOpenExternal,
  dataIndex,
  measureRef = NOOP_MEASURE_REF
}: TimeLogRowProps) {
  const { t } = useTranslation();
  const { hours, minutes } = parseDuration(entry.startTime, entry.endTime);
  const task = tasksByName.get(entry.taskName || '');
  const progress = task && task.estimatedTime ? getTaskProgressInfo(task.estimatedTime, task.totalLoggedMinutes) : null;
  const taskName = entry.taskName || '—';

  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={`border-b last:border-0 transition-colors ${
        idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
      } hover:bg-accent/30`}
    >
      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{entry.date}</td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2 max-w-[260px]">
          {progress && (
            <div
              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(progress.status)}`}
              title={`${Math.round(progress.pct)}% — ${progress.status === 'overtime' ? 'Overtime' : progress.status === 'warning' ? 'Warning' : 'On time'}`}
            />
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {entry.taskLink ? (
                  <button
                    type="button"
                    onClick={() => onOpenExternal(entry.taskLink!)}
                    className="group/task inline-flex items-start gap-1 text-left font-medium leading-snug hover:text-primary transition-colors"
                  >
                    <span className="whitespace-normal break-words">{taskName}</span>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <span className="cursor-default font-medium leading-snug whitespace-normal break-words">
                    {taskName}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium whitespace-normal break-words">{taskName}</p>
                {entry.taskLink && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground break-all">{entry.taskLink}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[320px] cursor-default leading-snug whitespace-normal break-words">
                {entry.description || '—'}
              </span>
            </TooltipTrigger>
            {entry.description && (
              <TooltipContent className="max-w-sm">
                <p className="whitespace-pre-wrap break-words">{entry.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-4 py-3 text-center font-mono text-xs">{entry.startTime || '—'}</td>
      <td className="px-4 py-3 text-center font-mono text-xs">{entry.endTime || '—'}</td>
      <td className="px-4 py-3 text-center font-mono text-xs font-medium">{formatDuration(hours, minutes)}</td>
      <td className="px-4 py-3 text-center">
        {entry.isBillable ? (
          <Badge variant="secondary" className="text-xs">
            {t('timeLogs.yes')}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">No</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {entry.isSent ? (
          <StatusBadge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            {t('common.sent')}
          </StatusBadge>
        ) : (
          <StatusBadge variant="warning">
            <Clock className="h-3 w-3" />
            {t('common.pending')}
          </StatusBadge>
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
                  disabled={isRowLocked}
                  onClick={() => onStartEdit(entry)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{entry.isSent ? t('timeLogs.editResync') : t('timeLogs.editEntry')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Duplicate button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  disabled={isRowLocked || isDuplicating}
                  onClick={() => onDuplicate(entry)}
                >
                  {isDuplicating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('timeLogs.duplicateEntry')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Comment button — only when the entry has a TW task link */}
          {(() => {
            const twId = entry.taskLink?.match(/\/tasks\/(\d+)/)?.[1];
            return twId ? (
              <TaskCommentDialog twTaskId={twId} taskName={entry.taskName || entry.description || ''} />
            ) : null;
          })()}
          {/* Sync button — only for pending */}
          {!entry.isSent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isSyncing || isRowLocked}
                    onClick={() => onSyncOne(entry)}
                  >
                    {isSyncing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('timeLogs.sendToTW')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Delete button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  disabled={isRowLocked || isDeleting}
                  onClick={() => onRequestDelete(entry)}
                >
                  {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('timeLogs.deleteEntry')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </td>
    </tr>
  );
});

function TimeLogsTable() {
  const { data, isLoading, error } = useTimeLogs();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  // Reuse the cached task list (same key as useTasks) instead of bypassing the cache.
  const { data: tasksData } = useQuery<Task[]>({
    queryKey: queryKeys.tasks.list(''),
    queryFn: () => fetchTasks()
  });
  const tasks = useMemo(() => tasksData ?? [], [tasksData]);
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
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

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

  // O(1) task lookup by name for the per-row progress dot. First match wins,
  // mirroring the previous `tasks.find(...)` semantics.
  const tasksByName = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      if (!map.has(task.taskName)) map.set(task.taskName, task);
    }
    return map;
  }, [tasks]);

  const hasActiveFilters = search || filterTask || filterDateFrom || filterDateTo;

  // Windowing: only the visible slice of `filteredData` is mounted. The real
  // <table> markup is kept — the virtualizer only tells us which absolute row
  // indexes to render, and the off-window range is represented by top/bottom
  // spacer rows so scroll height and row parity stay correct.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: estimateRowHeight,
    overscan: 8,
    getItemKey: (index) => filteredData[index]?.entryId ?? index
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const firstVirtualItem = virtualItems[0];
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const topSpacerHeight = firstVirtualItem ? firstVirtualItem.start : 0;
  const totalSize = rowVirtualizer.getTotalSize();
  const bottomSpacerHeight = lastVirtualItem ? Math.max(0, totalSize - lastVirtualItem.end) : 0;

  // A new filter re-orders/shrinks the list; bring the window back to the top.
  useEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [search, filterTask, filterDateFrom, filterDateTo, rowVirtualizer]);

  function clearFilters() {
    setSearch('');
    setFilterTask('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const handleDuplicate = useCallback(
    async (entry: TimeEntry) => {
      setDuplicatingId(entry.entryId);
      try {
        await addTimeEntry({
          taskId: entry.taskId,
          description: entry.description,
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isBillable: entry.isBillable
        });
        toast.success(t('timeLogs.duplicateSuccess', { name: entry.taskName || entry.description }));
        queryClient.invalidateQueries({ queryKey: ['workTimes'] });
      } catch (err) {
        toast.error(String(err));
      } finally {
        setDuplicatingId(null);
      }
    },
    [t, queryClient]
  );

  const handleDelete = async (entry: TimeEntry, deleteFromTW: boolean) => {
    setDeletingId(entry.entryId);
    try {
      const result = await deleteEntryAndSync(entry.entryId, deleteFromTW);
      if (result.localDeleted) {
        queryClient.invalidateQueries({ queryKey: ['workTimes'] });
        if (deleteFromTW && result.twDeleted === false) {
          toast.warning(t('timeLogs.deletedLocalOnly'), { description: result.twMessage });
        } else {
          toast.success(t('timeLogs.deleteSuccess', { name: entry.taskName || entry.description }));
        }
      } else {
        toast.error(t('timeLogs.deleteTWFailed'), { description: result.twMessage });
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const handleStartEdit = useCallback((entry: TimeEntry) => {
    setEditingId(entry.entryId);
    setEditData({
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      description: entry.description,
      isBillable: entry.isBillable
    });
  }, []);

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
        toast.error(t('timeLogs.saveError'));
        return;
      }
      // If the entry was already sent, reset it to pending so the user can re-sync
      if (entry.isSent) {
        await resetTimeEntryToUnsent(entry.entryId);
        toast.info(t('timeLogs.updatedPending'));
      } else {
        toast.success(t('timeLogs.changesSaved'));
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

  const setSyncing = useCallback(
    (id: number, value: boolean) =>
      setSyncingIds((prev) => {
        const next = new Set(prev);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      }),
    []
  );

  const handleSyncOne = useCallback(
    async (entry: TimeEntry) => {
      setSyncing(entry.entryId, true);
      try {
        const result = await smartSyncEntries([entry.entryId]);
        const r = result.results[0];
        if (r?.success) {
          const name = entry.taskName || entry.description;
          const msg =
            r.action === 'updated' ? t('timeLogs.entryUpdatedInTW', { name }) : t('timeLogs.entrySentToTW', { name });
          toast.success(msg);
          queryClient.invalidateQueries({ queryKey: ['workTimes'] });
        } else {
          toast.error(r?.message || t('timeLogs.syncFailed'));
        }
      } catch (err) {
        toast.error(String(err));
      } finally {
        setSyncing(entry.entryId, false);
      }
    },
    [setSyncing, t, queryClient]
  );

  const handleRequestDelete = useCallback((entry: TimeEntry) => setDeleteTarget(entry), []);
  const handleOpenExternal = useCallback((link: string) => window.Main.openExternal(link), []);

  const handleSyncAll = async () => {
    const pending = (data ?? []).filter((e) => !e.isSent);
    if (pending.length === 0) {
      toast.info(t('timeLogs.noPending'));
      return;
    }
    setSyncingAll(true);
    pending.forEach((e) => setSyncing(e.entryId, true));
    try {
      const result = await smartSyncEntries(pending.map((e) => e.entryId));
      queryClient.invalidateQueries({ queryKey: ['workTimes'] });
      if (result.failed === 0) {
        toast.success(t('timeLogs.allSent', { count: result.succeeded }));
      } else {
        toast.warning(t('timeLogs.partialSent', { success: result.succeeded, fail: result.failed }));
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      pending.forEach((e) => setSyncing(e.entryId, false));
      setSyncingAll(false);
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
      <ErrorState
        title={t('table.errorTitle')}
        message={String((error as Error)?.message || t('common.errorOccurred'))}
      />
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={Clock} title={t('timeLogs.noTimeLogs')} description={t('timeLogs.createEntry')} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <TableToolbar>
          {/* Search */}
          <TableToolbarSearch value={search} onChange={setSearch} placeholder={t('timeLogs.searchPlaceholder')} />
          <div className="flex items-center gap-2 shrink-0">
            {/* Filter toggle */}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('timeLogs.filters')}
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
              {`Sync ${pendingCount}`}
            </Button>
            {/* Pull from TW button */}
            <PullFromTWDialog />
          </div>
        </TableToolbar>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
            {/* Task filter */}
            <div className="space-y-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.colTask')}</label>
              <Combobox
                options={taskOptions.map((n) => ({ value: n, label: n }))}
                placeholder={t('timeLogs.allTasks')}
                searchPlaceholder={t('timeLogs.searchTask')}
                value={filterTask ? { value: filterTask, label: filterTask } : null}
                onChange={(opt) => setFilterTask(opt?.value ?? '')}
              />
            </div>
            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.from')}</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.to')}</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" />
                {t('reports.clear')}
              </Button>
            )}
          </div>
        )}

        {/* Results count when filtering */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            {filteredData.length} {t('timeLogs.of')} {data.length} {t('common.entries')}
          </p>
        )}
      </div>

      {/* Table */}
      <div ref={scrollRef} className="rounded-md border overflow-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50">
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.colDate')}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.colTask')}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('common.description')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('timeLogs.colStart')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('timeLogs.colEnd')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('timeLogs.colDuration')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('common.billable')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('timeLogs.colStatus')}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t('timeLogs.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {hasActiveFilters && filteredData.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                  {t('timeLogs.noFilterResults')}
                </td>
              </tr>
            )}
            {/* Top spacer: keeps the rows below the window at their real offset. */}
            {topSpacerHeight > 0 && (
              <tr data-virtual-spacer="top" aria-hidden="true">
                <td colSpan={9} style={{ height: `${topSpacerHeight}px`, padding: 0 }} />
              </tr>
            )}
            {virtualItems.map((virtualItem) => {
              const entry = filteredData[virtualItem.index];
              if (!entry) return null;
              // --- EDITING ROW ---
              if (editingId === entry.entryId) {
                const editDuration = parseDuration(editData.startTime, editData.endTime);
                return (
                  <tr
                    key={entry.entryId}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualItem.index}
                    className="border-b last:border-0 bg-accent/40"
                  >
                    {/* Date */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={editData.date}
                        onChange={(e) => setEditData((d) => ({ ...d, date: e.target.value }))}
                        className="w-32 rounded border border-input bg-background px-2 py-1 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Task — read-only */}
                    <td className="px-4 py-2 align-top text-muted-foreground text-xs">
                      <span className="block max-w-[240px] whitespace-normal break-words leading-snug">
                        {entry.taskName || '—'}
                      </span>
                    </td>
                    {/* Description */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editData.description}
                        onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                        placeholder={t('common.description')}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    {/* Start time */}
                    <td className="px-2 py-2 text-center">
                      <TimePickerInput
                        value={editData.startTime}
                        onChange={(v) => setEditData((d) => ({ ...d, startTime: v }))}
                      />
                    </td>
                    {/* End time */}
                    <td className="px-2 py-2 text-center">
                      <TimePickerInput
                        value={editData.endTime}
                        onChange={(v) => setEditData((d) => ({ ...d, endTime: v }))}
                      />
                    </td>
                    {/* Duration (computed) */}
                    <td className="px-4 py-2 text-center font-mono text-xs font-medium text-muted-foreground">
                      {formatDuration(editDuration.hours, editDuration.minutes)}
                    </td>
                    {/* Billable */}
                    <td className="px-2 py-2 text-center">
                      <Switch
                        checked={editData.isBillable}
                        onCheckedChange={(v) => setEditData((d) => ({ ...d, isBillable: v }))}
                        aria-label={t('common.billable')}
                      />
                    </td>
                    {/* Status */}
                    <td className="px-4 py-2 text-center">
                      {entry.isSent ? (
                        <StatusBadge variant="success">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('common.sent')}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="warning">
                          <Clock className="h-3 w-3" />
                          {t('common.pending')}
                        </StatusBadge>
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
                                className="h-8 w-8 p-0 text-success hover:text-success/80"
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
                              <p>{t('timeLogs.saveChanges')}</p>
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
                              <p>{t('common.cancel')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {/* Delete in edit mode */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                disabled={savingEdit || deletingId === entry.entryId}
                                onClick={() => setDeleteTarget(entry)}
                              >
                                {deletingId === entry.entryId ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('timeLogs.deleteEntry')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                );
              }

              // --- NORMAL ROW ---
              return (
                <TimeLogRow
                  key={entry.entryId}
                  entry={entry}
                  idx={virtualItem.index}
                  dataIndex={virtualItem.index}
                  measureRef={rowVirtualizer.measureElement}
                  isSyncing={syncingIds.has(entry.entryId)}
                  isRowLocked={editingId !== null}
                  isDuplicating={duplicatingId === entry.entryId}
                  isDeleting={deletingId === entry.entryId}
                  tasksByName={tasksByName}
                  onStartEdit={handleStartEdit}
                  onDuplicate={handleDuplicate}
                  onSyncOne={handleSyncOne}
                  onRequestDelete={handleRequestDelete}
                  onOpenExternal={handleOpenExternal}
                />
              );
            })}
            {/* Bottom spacer: completes the scroll height down to the last row. */}
            {bottomSpacerHeight > 0 && (
              <tr data-virtual-spacer="bottom" aria-hidden="true">
                <td colSpan={9} style={{ height: `${bottomSpacerHeight}px`, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      <DeleteEntryDialog
        open={deleteTarget !== null}
        isSent={deleteTarget?.isSent ?? false}
        entryLabel={
          deleteTarget ? deleteTarget.taskName || deleteTarget.description || String(deleteTarget.entryId) : ''
        }
        isDeleting={deletingId !== null}
        onConfirm={(deleteFromTW) => deleteTarget && handleDelete(deleteTarget, deleteFromTW)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default TimeLogsTable;
