import React, { useState, useMemo } from 'react';
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
  Copy,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import Combobox from './ui/combobox';
import TimePickerInput from './ui/time-picker';
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
  smartSyncEntries,
  addTimeEntry,
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

import { parseDuration, formatDuration } from '../lib/timeUtils';

function TimeLogsTable() {
  const { data, isLoading, error } = useTimeLogs();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

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

  const hasActiveFilters = search || filterTask || filterDateFrom || filterDateTo;

  function clearFilters() {
    setSearch('');
    setFilterTask('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const handleDuplicate = async (entry: TimeEntry) => {
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
  };

  const handleDelete = async (entry: TimeEntry) => {
    setDeletingId(entry.entryId);
    try {
      const ok = await deleteTimeEntry(entry.entryId);
      if (ok) {
        toast.success(t('timeLogs.deleteSuccess', { name: entry.taskName || entry.description }));
        queryClient.invalidateQueries({ queryKey: ['workTimes'] });
      } else {
        toast.error(t('timeLogs.deleteError'));
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

  const setSyncing = (id: number, value: boolean) =>
    setSyncingIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleSyncOne = async (entry: TimeEntry) => {
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
  };

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
        <p className="text-lg">{t('timeLogs.noTimeLogs')}</p>
        <p className="text-sm">{t('timeLogs.createEntry')}</p>
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
              placeholder={t('timeLogs.searchPlaceholder')}
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
        </div>

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
                className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.to')}</label>
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
      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead>
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
                        placeholder={t('common.description')}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
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
                          {t('common.sent')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                        >
                          <Clock className="h-3 w-3" />
                          {t('common.pending')}
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
                                <p>{t('timeLogs.deleteEntry')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('timeLogs.deleteConfirmTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('timeLogs.deleteConfirmDesc')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(entry)}
                              >
                                {t('common.delete')}
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
                        {t('timeLogs.yes')}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.isSent ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('common.sent')}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                      >
                        <Clock className="h-3 w-3" />
                        {t('common.pending')}
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
                              disabled={editingId !== null || duplicatingId === entry.entryId}
                              onClick={() => handleDuplicate(entry)}
                            >
                              {duplicatingId === entry.entryId ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('timeLogs.duplicateEntry')}</p>
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
                              <p>{t('timeLogs.sendToTW')}</p>
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
                              <p>{t('timeLogs.deleteEntry')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('timeLogs.deleteConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('timeLogs.deleteConfirmDesc')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(entry)}
                            >
                              {t('common.delete')}
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
