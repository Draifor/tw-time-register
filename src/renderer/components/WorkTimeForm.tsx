import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  useForm,
  useFieldArray,
  useWatch,
  Control,
  FieldValues,
  Controller,
  FieldErrors,
  UseFormSetValue
} from 'react-hook-form';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Send, Keyboard, DollarSign, UtensilsCrossed, Timer, GripVertical, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import Textarea from './ui/textarea-form';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import Combobox from './ui/combobox';
import TotalTimeDay from './TotalTimeDay';
import LiveTimer from './LiveTimer';
import InputTime from './ui/input-time';
import InputDate from './ui/input-date';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
import { getTaskProgressInfo, formatMinutesToHHMM } from '../lib/progressUtils';
import { formatTime24h } from '../lib/timeUtils';
import useTasks from '../hooks/useTasks';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
  getNextAvailableSlot,
  getDailyTimeInfo,
  getWorkSettings,
  isWorkDay,
  NextSlotSuggestion,
  WorkTimeDraftEntry,
  getWorkTimeDraft,
  saveWorkTimeDraft,
  clearWorkTimeDraft,
  addTimeEntries,
  TimeEntryInput
} from '../services/timesService';
import { queryKeys } from '../lib/queryKeys';

type WorkTimeEntry = {
  date: string;
  description: string;
  endTime: Date[];
  hours: Date[];
  startTime: Date[];
  task: { value: string; label: string } | string;
  isBillable: boolean;
  afterLunch: boolean;
  manualStartTime: boolean;
};

const getLocalISODate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMinutesFromDate = (date?: Date): number => {
  if (!date) return 0;
  return date.getHours() * 60 + date.getMinutes();
};

const buildEpochTime = (minutes: number): Date => {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const out = new Date('1970-01-01T00:00:00');
  out.setHours(Math.floor(normalized / 60), normalized % 60, 0, 0);
  return out;
};

const parseTimeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const addDaysToISO = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalISODate(d);
};

const isSameWorkDay = (leftDate?: string, rightDate?: string): boolean => {
  return Boolean(leftDate && rightDate && leftDate === rightDate);
};

const getEntryTaskId = (entry?: WorkTimeEntry): string => {
  const raw = entry?.task;
  if (!raw) return '';
  if (typeof raw === 'object' && 'value' in raw) return String((raw as { value: string }).value);
  return String(raw);
};

const getEntryMinutes = (entry?: WorkTimeEntry): number => {
  const duration = entry?.hours?.[0];
  return duration ? duration.getHours() * 60 + duration.getMinutes() : 0;
};

/**
 * Map form entries to the payload accepted by the batch time-entry endpoint.
 */
export function toTimeEntryInputs(entries: WorkTimeEntry[]): TimeEntryInput[] {
  const formatTime = (date: Date) => formatTime24h(date);

  return entries.map((entry) => {
    const taskId = typeof entry.task === 'object' ? Number(entry.task.value) : Number(entry.task);

    return {
      taskId,
      description: entry.description,
      date: entry.date,
      startTime: formatTime(entry.startTime[0]),
      endTime: formatTime(entry.endTime[0]),
      isBillable: entry.isBillable
    };
  });
}

/**
 * Persist every draft entry through the batch endpoint, then refresh the caches
 * that depend on them so Home / TimeLogs / Reports reflect the new data without
 * a manual reload.
 */
export async function saveWorkTimeEntries(entries: WorkTimeEntry[], queryClient: QueryClient): Promise<void> {
  await addTimeEntries(toTimeEntryInputs(entries));
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workTimes.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  ]);
}

// Hoverable divider between entries that lets the user insert a row at any
// position without having to drag one up from the bottom.
function InsertDivider({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="group/insert flex h-5 items-center gap-3">
      <div className="h-px flex-1 bg-border/60 transition-colors group-hover/insert:bg-primary/50" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        title={label}
        className="h-auto gap-1 rounded-full border-dashed border-muted-foreground/40 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground opacity-0 transition-all hover:border-primary hover:bg-transparent hover:text-primary group-hover/insert:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
      >
        <Plus className="h-3 w-3" />
        {label}
      </Button>
      <div className="h-px flex-1 bg-border/60 transition-colors group-hover/insert:bg-primary/50" />
    </div>
  );
}

// Consistent required indicator shared by every required field label: a visual
// glyph hidden from assistive tech plus a screen-reader-only "required" label,
// so the asterisk is announced meaningfully instead of read as "star".
function RequiredMark() {
  const { t } = useTranslation();
  return (
    <>
      <span className="text-destructive" aria-hidden="true">
        *
      </span>
      <span className="sr-only">{t('common.required')}</span>
    </>
  );
}

const hydrateEntryDates = (
  entry: WorkTimeEntry & { hours: string[]; startTime: string[]; endTime: string[] }
): WorkTimeEntry => ({
  ...entry,
  hours: entry.hours.map((d) => new Date(d)),
  startTime: entry.startTime.map((d) => new Date(d)),
  endTime: entry.endTime.map((d) => new Date(d)),
  manualStartTime: entry.manualStartTime ?? false
});

const serializeEntryDates = (entry: WorkTimeEntry): WorkTimeDraftEntry => ({
  ...entry,
  hours: entry.hours.map((d) => d.toISOString()),
  startTime: entry.startTime.map((d) => d.toISOString()),
  endTime: entry.endTime.map((d) => d.toISOString())
});

type TaskOption = {
  value: string;
  label: string;
  link: string;
  estimatedTime: number;
  totalLoggedMinutes: number;
};

interface EntryCardProps {
  index: number;
  control: Control<{ entries: WorkTimeEntry[] }>;
  typedControl: Control<FieldValues>;
  setValue: UseFormSetValue<{ entries: WorkTimeEntry[] }>;
  entryErrors?: FieldErrors<WorkTimeEntry>;
  options: TaskOption[];
  draftMinutesByTask: Map<string, number>;
  activeTimer: { index: number; startedAt: Date } | null;
  isDragged: boolean;
  isDragOver: boolean;
  canRemove: boolean;
  onStartTimer: (index: number) => void;
  onStopTimer: () => void;
  onRemove: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onElapsedMinutesChange: (minutes: number) => void;
}

// Extracted, module-scope card so `React.memo` can actually skip sibling rows
// while the user types. The root still re-renders on every `useWatch('entries')`
// change, but each card only re-renders when one of its stable props changes;
// per-entry values are read through their own react-hook-form subscriptions.
const EntryCard = React.memo(function EntryCard({
  index,
  control,
  typedControl,
  setValue,
  entryErrors,
  options,
  draftMinutesByTask,
  activeTimer,
  isDragged,
  isDragOver,
  canRemove,
  onStartTimer,
  onStopTimer,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onElapsedMinutesChange
}: EntryCardProps) {
  const { t } = useTranslation();
  const taskError = entryErrors?.task;
  const startTimeError = entryErrors?.startTime;
  const hoursError = entryErrors?.hours;
  const descriptionError = entryErrors?.description;
  const descriptionErrorId = `entries.${index}.description-error`;

  return (
    <Card
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-2 duration-300 transition-[opacity,border-color]',
        isDragged && 'opacity-40 border-dashed',
        isDragOver && 'border-primary border-2'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
              title={t('workTimeForm.dragToReorder')}
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">{t('workTimeForm.entryN', { num: index + 1 })}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {activeTimer?.index === index ? (
              <LiveTimer
                startedAt={activeTimer.startedAt}
                onStop={onStopTimer}
                onElapsedMinutesChange={onElapsedMinutesChange}
              />
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => onStartTimer(index)}
                      disabled={activeTimer !== null}
                    >
                      <Timer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{activeTimer !== null ? t('workTimeForm.timer.otherRunning') : t('workTimeForm.timer.start')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => onRemove(index)}
              disabled={!canRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Single row layout - wraps on smaller screens */}
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label htmlFor={`entries.${index}.description`}>
              {t('common.description')} <RequiredMark />
            </Label>
            {/* `TextareaForm` owns the error message and renders it with a stable
                `${name}-error` id, so `aria-describedby` points at that element
                directly instead of a wrapper that contains it. */}
            <Textarea
              id={`entries.${index}.description`}
              placeholder={t('workTimeForm.descPlaceholder')}
              className="w-full"
              name={`entries.${index}.description`}
              control={typedControl}
              aria-invalid={descriptionError ? true : undefined}
              aria-describedby={descriptionError ? descriptionErrorId : undefined}
              aria-required
              rules={{ required: t('workTimeForm.descriptionRequired') }}
            />
          </div>
          <div className="w-[200px] space-y-2">
            <Label htmlFor={`entries.${index}.task`}>
              {t('workTimeForm.task')} <RequiredMark />
            </Label>
            <Controller
              name={`entries.${index}.task`}
              control={control}
              rules={{ required: t('workTimeForm.taskRequired') }}
              render={({ field }) => {
                const selectedOption = (() => {
                  const val = field.value;
                  if (!val) return null;
                  if (typeof val === 'object' && 'value' in val) {
                    return options.find((o) => String(o.value) === String((val as { value: string }).value)) ?? null;
                  }
                  return null;
                })();

                const selectedTask = selectedOption as {
                  value: string;
                  label: string;
                  estimatedTime?: number;
                  totalLoggedMinutes?: number;
                } | null;
                const draftMinutes = selectedTask ? (draftMinutesByTask.get(String(selectedTask.value)) ?? 0) : 0;
                const taskInfo =
                  selectedTask?.estimatedTime && selectedTask.estimatedTime > 0
                    ? getTaskProgressInfo(selectedTask.estimatedTime, selectedTask.totalLoggedMinutes)
                    : null;

                return (
                  <div className="space-y-1">
                    <Combobox
                      id={`entries.${index}.task`}
                      options={options}
                      placeholder={t('workTimeForm.selectTask')}
                      searchPlaceholder={t('workTimeForm.searchTasks')}
                      value={selectedTask}
                      onChange={field.onChange}
                      aria-required
                      aria-invalid={taskError ? true : undefined}
                      aria-describedby={taskError ? `entries.${index}.task-error` : undefined}
                      showProgress
                      className="w-full"
                    />
                    {taskInfo && selectedTask?.estimatedTime && selectedTask.estimatedTime > 0 && (
                      <div
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          taskInfo.status === 'overtime'
                            ? 'bg-destructive/10 text-destructive'
                            : taskInfo.status === 'warning'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-success/10 text-success'
                        }`}
                      >
                        {t(draftMinutes > 0 ? 'workTimeForm.progressInfoProjected' : 'workTimeForm.progressInfo', {
                          logged: formatMinutesToHHMM(selectedTask.totalLoggedMinutes ?? 0),
                          estimated: formatMinutesToHHMM(selectedTask.estimatedTime ?? 0),
                          pct: Math.round(taskInfo.pct),
                          margin: formatMinutesToHHMM(taskInfo.margin),
                          draft: formatMinutesToHHMM(draftMinutes)
                        })}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {taskError && (
              <span id={`entries.${index}.task-error`} className="text-sm text-destructive">
                {taskError.message}
              </span>
            )}
          </div>
          <div className="w-[170px] space-y-2">
            <Label htmlFor={`entries.${index}.date`}>
              {t('common.date')} <RequiredMark />
            </Label>
            <InputDate
              name={`entries.${index}.date`}
              control={typedControl}
              id={`entries.${index}.date`}
              aria-required
              rules={{ required: t('workTimeForm.dateRequired') }}
            />
          </div>
          <div className="w-[90px] space-y-2">
            <Label htmlFor={`entries.${index}.hours`}>
              {t('timeLogs.colDuration')} <RequiredMark />
            </Label>
            <InputTime
              name={`entries.${index}.hours`}
              control={typedControl}
              className="w-full"
              aria-required
              aria-invalid={hoursError ? true : undefined}
              aria-describedby={hoursError ? `entries.${index}.hours-error` : undefined}
              rules={{ required: t('workTimeForm.durationRequired') }}
              options={{
                enableTime: true,
                noCalendar: true,
                time_24hr: true,
                dateFormat: 'H:i',
                defaultDate: '00:00'
              }}
            />
            {hoursError && (
              <span id={`entries.${index}.hours-error`} className="text-sm text-destructive">
                {hoursError.message}
              </span>
            )}
          </div>
          <div className="w-[100px] space-y-2">
            <Label htmlFor={`entries.${index}.startTime`}>
              {t('timeLogs.colStart')} <RequiredMark />
            </Label>
            <InputTime
              name={`entries.${index}.startTime`}
              control={typedControl}
              className="w-full"
              aria-required
              aria-invalid={startTimeError ? true : undefined}
              aria-describedby={startTimeError ? `entries.${index}.startTime-error` : undefined}
              rules={{ required: t('workTimeForm.startRequired') }}
              options={{
                enableTime: true,
                noCalendar: true,
                time_24hr: true,
                dateFormat: 'H:i',
                defaultDate: '09:00',
                onChange: () => {
                  setValue(`entries.${index}.manualStartTime`, true, { shouldDirty: true });
                }
              }}
            />
            {startTimeError && (
              <span id={`entries.${index}.startTime-error`} className="text-sm text-destructive">
                {startTimeError.message}
              </span>
            )}
          </div>
          <div className="w-[100px] space-y-2">
            <Label htmlFor={`entries.${index}.endTime`}>{t('timeLogs.colEnd')}</Label>
            <InputTime
              name={`entries.${index}.endTime`}
              control={typedControl}
              className="w-full"
              options={{
                enableTime: true,
                noCalendar: true,
                time_24hr: true,
                dateFormat: 'H:i',
                defaultDate: '09:00',
                clickOpens: false
              }}
            />
          </div>
          <div className="flex flex-col justify-end space-y-2">
            <Label
              htmlFor={`entries.${index}.afterLunch`}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
              {t('workTimeForm.afterLunch')}
            </Label>
            <div className="h-10 flex items-center">
              <Controller
                name={`entries.${index}.afterLunch`}
                control={control}
                render={({ field }) => (
                  <Switch id={`entries.${index}.afterLunch`} checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <div className="flex flex-col justify-end space-y-2">
            <Label
              htmlFor={`entries.${index}.isBillable`}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {t('common.billable')}
            </Label>
            <div className="h-10 flex items-center">
              <Controller
                name={`entries.${index}.isBillable`}
                control={control}
                render={({ field }) => (
                  <Switch id={`entries.${index}.isBillable`} checked={!!field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default function WorkTimeForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Pending state for the primary save. The ref is the synchronous re-entry
  // guard (a click and the Ctrl+S form submit can fire before React re-renders),
  // while the state drives the button's disabled/spinner UI.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Single pending-deletion state driving one reusable confirmation dialog for
  // every draft-entry removal (the per-row Trash2 control and the Esc shortcut).
  const [pendingRemovalIndex, setPendingRemovalIndex] = useState<number | null>(null);
  const removeConfirmRef = useRef<HTMLButtonElement>(null);

  // Create default entry from next available slot
  const createDefaultEntry = useCallback((slot: NextSlotSuggestion | null): WorkTimeEntry => {
    const [hours, minutes] = (slot?.startTime || '09:00').split(':').map(Number);
    const startTimeDate = new Date('1970-01-01T00:00:00');
    startTimeDate.setHours(hours, minutes, 0, 0);

    return {
      description: '',
      hours: [new Date('1970-01-01T00:00:00')],
      date: slot?.date || getLocalISODate(),
      task: '',
      startTime: [startTimeDate],
      endTime: [startTimeDate],
      isBillable: false,
      afterLunch: false,
      manualStartTime: false
    };
  }, []);

  const defaultValue = React.useMemo<WorkTimeEntry>(
    () => ({
      description: '',
      hours: [new Date('1970-01-01T00:00:00')],
      date: getLocalISODate(),
      task: '',
      startTime: [new Date('1970-01-01T09:00:00')],
      endTime: [new Date('1970-01-01T09:00:00')],
      isBillable: false,
      afterLunch: false,
      manualStartTime: false
    }),
    []
  );

  const {
    formState: { errors },
    control,
    handleSubmit,
    reset,
    setValue,
    getValues
  } = useForm<{ entries: WorkTimeEntry[] }>({
    defaultValues: { entries: [defaultValue] }
  });
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: 'entries' });

  // `useFieldArray` recreates `remove`/`move` on every render, so keep the latest
  // in refs. The memoized card handlers below must keep a stable identity while
  // the user types, otherwise `React.memo` would be defeated on every keystroke.
  const removeRef = useRef(remove);
  const moveRef = useRef(move);
  useEffect(() => {
    removeRef.current = remove;
    moveRef.current = move;
  });
  const result = useWatch({ control, name: 'entries' });
  const { data: tasks } = useTasks();
  // Cast control so it's compatible with generic UI components (InputTime, InputForm, InputDate)
  const typedControl = control as unknown as Control<FieldValues>;

  const isHydratingDraftRef = useRef(true);
  const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft from SQLite at startup. If missing, migrate once from legacy
  // localStorage and persist to SQLite. If still missing, use smart slot.
  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      try {
        const dbDraft = await getWorkTimeDraft();
        if (cancelled) return;

        if (dbDraft?.entries?.length) {
          const hydratedEntries = dbDraft.entries.map((entry) =>
            hydrateEntryDates(entry as WorkTimeEntry & { hours: string[]; startTime: string[]; endTime: string[] })
          );
          reset({ entries: hydratedEntries });
          localStorage.removeItem('workTimeFormEntries');
          return;
        }

        const legacyDraft = localStorage.getItem('workTimeFormEntries');
        if (legacyDraft) {
          const parsed = JSON.parse(legacyDraft) as (WorkTimeEntry & {
            hours: string[];
            startTime: string[];
            endTime: string[];
          })[];
          const hydratedEntries = parsed.map((entry) => hydrateEntryDates(entry));
          reset({ entries: hydratedEntries });
          await saveWorkTimeDraft({ entries: hydratedEntries.map(serializeEntryDates) });
          localStorage.removeItem('workTimeFormEntries');
          return;
        }

        const slot = await getNextAvailableSlot();
        if (cancelled) return;
        const smartEntry = createDefaultEntry(slot);
        reset({ entries: [smartEntry] });
      } catch (error) {
        console.error('Error restoring draft:', error);
        if (!cancelled) {
          reset({ entries: [defaultValue] });
        }
      } finally {
        if (!cancelled) {
          isHydratingDraftRef.current = false;
        }
      }
    };

    restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [createDefaultEntry, defaultValue, reset]);

  const options = React.useMemo(() => {
    return (
      tasks?.map((task) => ({
        value: String(task.id),
        label: task.taskName,
        link: task.taskLink,
        estimatedTime: task.estimatedTime ?? 0,
        totalLoggedMinutes: task.totalLoggedMinutes ?? 0
      })) || []
    );
  }, [tasks]);

  const previousValues = useRef<{ startTime: Date[]; hours: Date[]; afterLunch: boolean; manualStartTime: boolean }[]>(
    []
  );

  // ── Live timer ───────────────────────────────────────────────────────────────
  // One timer active at a time. Persisted to localStorage so it survives
  // navigation. Uses 1970-epoch Dates (same convention as the rest of the form).
  const [activeTimer, setActiveTimer] = useState<{ index: number; startedAt: Date } | null>(() => {
    try {
      const saved = localStorage.getItem('wt_activeTimer');
      if (saved) {
        const { index, startedAt } = JSON.parse(saved) as { index: number; startedAt: string };
        return { index, startedAt: new Date(startedAt) };
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  // Elapsed minutes of the running timer, reported by LiveTimer at minute
  // granularity so projected progress stays fresh without re-rendering the form
  // every second.
  const [timerElapsedMinutes, setTimerElapsedMinutes] = useState(0);
  // Ref that always points to the latest activeTimer — avoids stale closures in
  // keyboard shortcut callbacks registered before the next render.
  const activeTimerRef = useRef(activeTimer);
  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);

  // ── Draft progress per task ────────────────────────────────────────────────
  // Minutes currently sitting in the form (not yet saved) grouped by task id.
  // This lets the task progress badge/dropdown show the projected consumption
  // as if the draft entries were already saved.
  //
  // `draftSignature` is a primitive encoding of exactly the entry values the map
  // reads (task id + duration). Keying the memo on it keeps `draftMinutesByTask`
  // referentially stable across description keystrokes (same contents → same Map),
  // so `optionsWithDraft` — and therefore every card's `options` prop — keeps its
  // identity while the user types. It still rebuilds on task/duration/timer events.
  const draftSignature = React.useMemo(() => {
    const parts: string[] = [];
    (result ?? []).forEach((entry) => {
      const taskId = getEntryTaskId(entry);
      if (!taskId) return;
      parts.push(`${taskId}:${getEntryMinutes(entry)}`);
    });
    return parts.join('|');
  }, [result]);

  const draftMinutesByTask = React.useMemo(() => {
    const map = new Map<string, number>();

    (result ?? []).forEach((entry) => {
      const taskId = getEntryTaskId(entry);
      if (!taskId) return;
      map.set(taskId, (map.get(taskId) ?? 0) + getEntryMinutes(entry));
    });

    // A running timer has no committed `hours` yet, so add its elapsed minutes.
    if (activeTimer) {
      const timerTaskId = getEntryTaskId(result?.[activeTimer.index]);
      if (timerTaskId) {
        map.set(timerTaskId, (map.get(timerTaskId) ?? 0) + timerElapsedMinutes);
      }
    }

    return map;
    // `draftSignature` encodes every entry value this map reads, so `result` is
    // intentionally omitted from the dependencies: a description-only change must
    // reuse the previous Map and return the same identity.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [draftSignature, activeTimer, timerElapsedMinutes]);

  const optionsWithDraft = React.useMemo(
    () =>
      options.map((option) => ({
        ...option,
        totalLoggedMinutes: (option.totalLoggedMinutes ?? 0) + (draftMinutesByTask.get(String(option.value)) ?? 0)
      })),
    [options, draftMinutesByTask]
  );

  // ── Drag & drop state ─────────────────────────────────────────────────────
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragClientYRef = useRef<number>(0);

  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    const EDGE_THRESHOLD = 80;
    const MAX_SCROLL_SPEED = 8;

    const getScrollSpeed = (distance: number): number => {
      const ratio = 1 - distance / EDGE_THRESHOLD;
      return Math.ceil(ratio * MAX_SCROLL_SPEED);
    };

    const tick = () => {
      const viewportHeight = window.innerHeight;
      const clientY = dragClientYRef.current;
      const distanceToTop = clientY;
      const distanceToBottom = viewportHeight - clientY;

      if (distanceToTop < EDGE_THRESHOLD && distanceToTop >= 0) {
        window.scrollBy({ top: -getScrollSpeed(distanceToTop), behavior: 'auto' });
      } else if (distanceToBottom < EDGE_THRESHOLD && distanceToBottom >= 0) {
        window.scrollBy({ top: getScrollSpeed(distanceToBottom), behavior: 'auto' });
      }
    };

    autoScrollIntervalRef.current = setInterval(tick, 16);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // Global dragover listener to track mouse position even when not over a Card
  useEffect(() => {
    if (draggedIndex === null) return;

    const onDragOver = (e: DragEvent) => {
      dragClientYRef.current = e.clientY;
    };

    document.addEventListener('dragover', onDragOver);
    return () => {
      document.removeEventListener('dragover', onDragOver);
    };
  }, [draggedIndex]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      // Transparent 1×1 image — hides the default browser drag ghost; the card
      // itself shows opacity feedback instead.
      const ghost = new Image();
      ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      e.dataTransfer.setDragImage(ghost, 0, 0);
      dragClientYRef.current = e.clientY;
      setDraggedIndex(index);
      startAutoScroll();
    },
    [startAutoScroll]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      stopAutoScroll();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }
      moveRef.current(draggedIndex, dropIndex);
      // Rearrange previousValues to keep cascade tracking consistent
      const newPrev = [...previousValues.current];
      const [movedPrev] = newPrev.splice(draggedIndex, 1);
      newPrev.splice(dropIndex, 0, movedPrev);
      previousValues.current = newPrev;
      // Update live timer index if the dragged or displaced entry owns it
      if (activeTimerRef.current) {
        const timerIdx = activeTimerRef.current.index;
        let newIdx = timerIdx;
        if (timerIdx === draggedIndex) {
          newIdx = dropIndex;
        } else if (draggedIndex < dropIndex && timerIdx > draggedIndex && timerIdx <= dropIndex) {
          newIdx = timerIdx - 1;
        } else if (draggedIndex > dropIndex && timerIdx >= dropIndex && timerIdx < draggedIndex) {
          newIdx = timerIdx + 1;
        }
        if (newIdx !== timerIdx) {
          const updated = { ...activeTimerRef.current, index: newIdx };
          setActiveTimer(updated);
          localStorage.setItem(
            'wt_activeTimer',
            JSON.stringify({ index: newIdx, startedAt: activeTimerRef.current.startedAt.toISOString() })
          );
        }
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, stopAutoScroll]
  );

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [stopAutoScroll]);
  // ── End drag & drop ──────────────────────────────────────────────────────

  const handleStartTimer = useCallback(
    (index: number) => {
      const now = new Date();
      // startTime stored as 1970-epoch Date — same convention as the rest of the form
      const startDate = new Date('1970-01-01T00:00:00');
      startDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setValue(`entries.${index}.startTime`, [startDate]);
      setValue(`entries.${index}.manualStartTime`, false);
      const state = { index, startedAt: now };
      setActiveTimer(state);
      setTimerElapsedMinutes(0);
      localStorage.setItem('wt_activeTimer', JSON.stringify({ index, startedAt: now.toISOString() }));
    },
    [setValue]
  );

  const handleStopTimer = useCallback(() => {
    if (!activeTimer) return;
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - activeTimer.startedAt.getTime()) / 1000);
    const elapsedMinutes = Math.floor(elapsed / 60);
    const durationH = Math.floor(elapsedMinutes / 60);
    const durationM = elapsedMinutes % 60;
    const durationDate = new Date('1970-01-01T00:00:00');
    durationDate.setHours(durationH, durationM, 0, 0);
    // Updating 'hours' triggers the chained useEffect → recalculates endTime automatically
    setValue(`entries.${activeTimer.index}.hours`, [durationDate]);
    setActiveTimer(null);
    setTimerElapsedMinutes(0);
    localStorage.removeItem('wt_activeTimer');
  }, [activeTimer, setValue]);

  const handleRemoveEntry = useCallback((index: number) => {
    // Do not touch the form yet: open the confirmation dialog and only remove
    // the row once the user accepts.
    setPendingRemovalIndex(index);
  }, []);

  const confirmRemoveEntry = useCallback(() => {
    if (pendingRemovalIndex === null) return;
    const index = pendingRemovalIndex;
    // If the timer is running on this entry, stop it silently before removing
    if (activeTimer?.index === index) {
      setActiveTimer(null);
      setTimerElapsedMinutes(0);
      localStorage.removeItem('wt_activeTimer');
    }
    const wasLastEntry = index === fields.length - 1;
    removeRef.current(index);
    setPendingRemovalIndex(null);
    if (wasLastEntry) {
      toast.info(t('workTimeForm.lastRemoved'));
    }
  }, [pendingRemovalIndex, activeTimer, fields.length, t]);
  // ── End live timer ──────────────────────────────────────────────────────────

  const calculateEndTime = (startTimeArray: Date[], hoursArray: Date[]) => {
    const startTime = startTimeArray[0];
    const hours = hoursArray[0];

    if (startTime && hours) {
      const startMinutes = getMinutesFromDate(startTime);
      const durationMinutes = getMinutesFromDate(hours);
      return [buildEpochTime(startMinutes + durationMinutes)];
    }

    return [new Date('1970-01-01T09:00:00')];
  };

  useEffect(() => {
    if (isHydratingDraftRef.current) {
      return;
    }

    if (!result || result.length === 0) {
      void clearWorkTimeDraft();
      return;
    }

    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
    }

    saveDraftTimeoutRef.current = setTimeout(() => {
      const payload = { entries: result.map(serializeEntryDates) };
      void saveWorkTimeDraft(payload).catch((error) => {
        console.error('Error saving WorkTime draft:', error);
      });
    }, 500);

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [result]);

  useEffect(
    () => () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    result.forEach((entry, index) => {
      const prevEntry = previousValues.current[index];

      // New entry: initialize tracking state without modifying anything
      if (!prevEntry) {
        previousValues.current[index] = {
          startTime: entry.startTime,
          hours: entry.hours,
          afterLunch: entry.afterLunch ?? false,
          manualStartTime: entry.manualStartTime ?? false
        };
        return;
      }

      // Detect afterLunch toggle: apply the 60-minute lunch offset to THIS
      // entry's startTime (so the task itself begins +60min). Recalculate its
      // endTime accordingly and cascade the new endTime to the next entry
      // (unless the next entry has manualStartTime true).
      if (entry.afterLunch !== prevEntry.afterLunch && entry.startTime?.[0]) {
        // Prefer basing this entry's start on the previous entry's endTime.
        // If there's no previous entry, fall back to shifting current start by +60/-60.
        const prevEntrySameDay = isSameWorkDay(result[index - 1]?.date, entry.date);
        const prevEnd = prevEntrySameDay ? result[index - 1]?.endTime?.[0] : undefined;

        let newStart: Date;
        if (prevEnd) {
          const offset = entry.afterLunch ? 60 : 0;
          newStart = buildEpochTime(getMinutesFromDate(prevEnd) + offset);
        } else {
          // Fallback: adjust current start relatively
          const currentStart = entry.startTime[0];
          const delta = entry.afterLunch ? 60 : -60;
          newStart = buildEpochTime(getMinutesFromDate(currentStart) + delta);
        }

        // Update this entry's startTime and endTime based on newStart
        setValue(`entries.${index}.startTime`, [newStart]);
        const newEndTime = calculateEndTime([newStart], entry.hours);
        setValue(`entries.${index}.endTime`, newEndTime);

        previousValues.current[index] = {
          ...previousValues.current[index],
          afterLunch: entry.afterLunch ?? false,
          manualStartTime: entry.manualStartTime ?? false
        };

        // Cascade to next entry: align its start with this new endTime (+respect afterLunch flag on next)
        if (
          result[index + 1] !== undefined &&
          isSameWorkDay(entry.date, result[index + 1].date) &&
          !result[index + 1].manualStartTime
        ) {
          const nextAfterLunch = result[index + 1].afterLunch ?? false;
          if (nextAfterLunch) {
            const shifted = buildEpochTime(getMinutesFromDate(newEndTime[0]) + 60);
            setValue(`entries.${index + 1}.startTime`, [shifted]);
          } else {
            setValue(`entries.${index + 1}.startTime`, newEndTime);
          }
        }

        return;
      }

      const newEndTime = calculateEndTime(entry.startTime, entry.hours);

      // Solo actualiza si startTime o hours cambiaron
      if (
        getMinutesFromDate(entry.startTime?.[0]) !== getMinutesFromDate(prevEntry.startTime?.[0]) ||
        getMinutesFromDate(entry.hours?.[0]) !== getMinutesFromDate(prevEntry.hours?.[0])
      ) {
        setValue(`entries.${index}.endTime`, newEndTime);
        previousValues.current[index] = {
          startTime: entry.startTime,
          hours: entry.hours,
          afterLunch: entry.afterLunch ?? false,
          manualStartTime: entry.manualStartTime ?? false
        };

        // Cascade: propagate endTime → startTime of the next entry.
        // We intentionally do NOT update previousValues[index+1].startTime here,
        // so the next render detects it as a change and recalculates endTime[index+1]
        // (which in turn cascades to index+2, etc.).
        if (
          result[index + 1] !== undefined &&
          isSameWorkDay(entry.date, result[index + 1].date) &&
          !result[index + 1].manualStartTime
        ) {
          const nextAfterLunch = result[index + 1].afterLunch ?? false;
          if (nextAfterLunch) {
            const shifted = buildEpochTime(getMinutesFromDate(newEndTime[0]) + 60);
            setValue(`entries.${index + 1}.startTime`, [shifted]);
          } else {
            setValue(`entries.${index + 1}.startTime`, newEndTime);
          }
        }
      }
    });
  }, [result, setValue]);

  const onSubmit = async (data: { entries: WorkTimeEntry[] }) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Group entries by date and validate against max hours
      const entriesByDate: Record<string, number> = {};
      for (const entry of data.entries) {
        const startTime = entry.startTime[0];
        const endTime = entry.endTime[0];
        if (startTime && endTime) {
          const durationMinutes =
            endTime.getHours() * 60 + endTime.getMinutes() - (startTime.getHours() * 60 + startTime.getMinutes());
          entriesByDate[entry.date] = (entriesByDate[entry.date] || 0) + durationMinutes;
        }
      }

      // Check each date for over-limit
      for (const [date, draftMinutes] of Object.entries(entriesByDate)) {
        const dailyInfo = await getDailyTimeInfo(date);
        const totalAfterSave = dailyInfo.totalMinutes + draftMinutes;

        if (totalAfterSave > dailyInfo.maxMinutes && dailyInfo.maxMinutes > 0) {
          const overMinutes = totalAfterSave - dailyInfo.maxMinutes;
          const overHours = Math.floor(overMinutes / 60);
          const overMins = overMinutes % 60;

          toast.warning(t('workTimeForm.overtimeTitle', { date }), {
            description: t('workTimeForm.overtimeDesc', {
              overH: overHours,
              overM: overMins,
              maxH: dailyInfo.maxMinutes / 60
            })
          });
        }
      }

      await saveWorkTimeEntries(data.entries, queryClient);

      toast.success(t('workTimeForm.savedTitle'), {
        description: t('workTimeForm.savedDesc', { count: data.entries.length })
      });
      await clearWorkTimeDraft();
      localStorage.removeItem('workTimeFormEntries');

      // Fetch new slot suggestion after saving
      try {
        const newSlot = await getNextAvailableSlot();
        reset({ entries: [createDefaultEntry(newSlot)] });
      } catch {
        reset({ entries: [defaultValue] });
      }
    } catch (error) {
      console.error('Error saving entries:', error);
      toast.error(t('workTimeForm.saveErrorTitle'), {
        description: t('workTimeForm.saveErrorDesc')
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAddEntry = async () => {
    const entries = getValues('entries');
    const lastEntry = entries[entries.length - 1];
    const currentDate = lastEntry?.date || getLocalISODate();

    // Calculate draft time already in the form for this date
    const draftMinutes = entries.reduce((acc, entry) => {
      if (entry.date !== currentDate) return acc;
      const hours = entry.hours?.[0]?.getHours() ?? 0;
      const minutes = entry.hours?.[0]?.getMinutes() ?? 0;
      return acc + hours * 60 + minutes;
    }, 0);

    // Smart duration suggestion based on remaining time
    // - More than 2 hours left → suggest 1 hour (standard)
    // - Between 30 min and 2 hours → suggest remaining time
    // - Less than 30 min → suggest 30 minutes (minimum useful)
    let suggestedDuration = new Date('1970-01-01T01:00:00'); // Default 1 hour
    try {
      const dailyInfo = await getDailyTimeInfo(currentDate);
      // Subtract both saved time AND draft time from form
      const remaining = dailyInfo.remainingMinutes - draftMinutes;

      let suggestedMinutes = 60; // Default: 1 hour

      if (remaining <= 0) {
        // Day is complete, suggest 1 hour anyway (overtime)
        suggestedMinutes = 60;
      } else if (remaining <= 30) {
        // Less than 30 min left, suggest 30 min (minimum useful block)
        suggestedMinutes = 30;
      } else if (remaining <= 120) {
        // Between 30 min and 2 hours, suggest the exact remaining time
        suggestedMinutes = remaining;
      } else {
        // More than 2 hours left, suggest 1 hour (standard block)
        suggestedMinutes = 60;
      }

      const hours = Math.floor(suggestedMinutes / 60);
      const minutes = suggestedMinutes % 60;
      suggestedDuration = new Date('1970-01-01T00:00:00');
      suggestedDuration.setHours(hours, minutes, 0, 0);
    } catch (error) {
      console.error('Error getting daily info:', error);
    }

    let shouldMoveToNextWorkDay = false;
    try {
      const dailyInfo = await getDailyTimeInfo(currentDate);
      const remainingAfterDraft = dailyInfo.remainingMinutes - draftMinutes;
      shouldMoveToNextWorkDay = remainingAfterDraft <= 0;
    } catch {
      // If info fails, keep current behavior fallback below.
    }

    if (shouldMoveToNextWorkDay) {
      try {
        const settings = await getWorkSettings();
        let candidate = addDaysToISO(currentDate, 1);
        for (let i = 0; i < 370; i++) {
          const workable = await isWorkDay(candidate);
          if (workable) break;
          candidate = addDaysToISO(candidate, 1);
        }

        const defaultStart = buildEpochTime(parseTimeToMinutes(settings.defaultStartTime || '09:00'));
        const end = calculateEndTime([defaultStart], [suggestedDuration]);
        append({
          ...defaultValue,
          date: candidate,
          startTime: [defaultStart],
          endTime: end,
          hours: [suggestedDuration],
          manualStartTime: false
        });
        return;
      } catch {
        // Fall through to existing behavior if settings/workday checks fail.
      }
    }

    // If last entry has endTime and we still have room in the current day, use it as next startTime
    if (lastEntry?.endTime?.[0]) {
      const newEntry = {
        ...defaultValue,
        date: lastEntry.date,
        startTime: lastEntry.endTime,
        endTime: calculateEndTime(lastEntry.endTime, [suggestedDuration]),
        hours: [suggestedDuration],
        manualStartTime: false
      };
      append(newEntry);
    } else {
      // Fetch fresh suggestion from DB
      try {
        const slot = await getNextAvailableSlot();
        const entry = createDefaultEntry(slot);
        entry.hours = [suggestedDuration];
        entry.endTime = calculateEndTime(entry.startTime, [suggestedDuration]);
        append(entry);
      } catch {
        append(defaultValue);
      }
    }
  };

  // Insert a new entry at an arbitrary position, basing its start time on the
  // previous entry (or the next one when inserting at the very top). The
  // chaining effect then shifts the following entries automatically.
  const handleInsertEntry = (atIndex: number) => {
    const entries = getValues('entries');
    const prevEntry = atIndex > 0 ? entries[atIndex - 1] : undefined;
    const nextEntry = entries[atIndex];

    const date = prevEntry?.date ?? nextEntry?.date ?? getLocalISODate();
    const startTime = prevEntry?.endTime?.[0]
      ? prevEntry.endTime
      : nextEntry?.startTime?.[0]
        ? nextEntry.startTime
        : [buildEpochTime(parseTimeToMinutes('09:00'))];

    const duration = [new Date('1970-01-01T01:00:00')];
    const newEntry: WorkTimeEntry = {
      ...defaultValue,
      date,
      startTime,
      endTime: calculateEndTime(startTime, duration),
      hours: duration,
      manualStartTime: false
    };

    // Keep the cascade-tracking array aligned with the shifted entries and force
    // the effect to detect a change on the inserted entry (its placeholder start
    // differs by one minute) so the following rows shift correctly.
    const newPrev = [...previousValues.current];
    newPrev.splice(atIndex, 0, {
      startTime: [buildEpochTime(getMinutesFromDate(startTime[0]) - 1)],
      hours: duration,
      afterLunch: false,
      manualStartTime: false
    });
    previousValues.current = newPrev;

    // Keep the running timer pointing at the right entry after the shift.
    if (activeTimerRef.current && atIndex <= activeTimerRef.current.index) {
      const newIdx = activeTimerRef.current.index + 1;
      setActiveTimer({ ...activeTimerRef.current, index: newIdx });
      localStorage.setItem(
        'wt_activeTimer',
        JSON.stringify({ index: newIdx, startedAt: activeTimerRef.current.startedAt.toISOString() })
      );
    }

    insert(atIndex, newEntry);
  };

  const formRef = useRef<HTMLFormElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        ctrl: true,
        action: handleAddEntry,
        description: 'Add new entry'
      },
      {
        key: 's',
        ctrl: true,
        action: () => formRef.current?.requestSubmit(),
        description: 'Save/Register entries'
      },
      {
        key: 'Escape',
        action: () => {
          // The confirmation dialog owns Escape while it is open (it dismisses
          // itself), so never re-open it from this global shortcut.
          if (pendingRemovalIndex !== null) return;
          // Clear the last entry if there's more than one, after confirming.
          if (fields.length > 1) {
            setPendingRemovalIndex(fields.length - 1);
          }
        },
        description: 'Remove last entry'
      }
    ]
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('workTimeForm.title')}</h1>
          <p className="text-muted-foreground">{t('workTimeForm.subtitle')}</p>
        </div>
        <TotalTimeDay control={typedControl} />
      </div>

      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-1">
        {fields.flatMap((field, index) => [
          <InsertDivider
            key={`insert-${index}`}
            onClick={() => handleInsertEntry(index)}
            label={t('workTimeForm.insertEntry')}
          />,
          <EntryCard
            key={field.id}
            index={index}
            control={control}
            typedControl={typedControl}
            setValue={setValue}
            entryErrors={errors.entries?.[index]}
            options={optionsWithDraft}
            draftMinutesByTask={draftMinutesByTask}
            activeTimer={activeTimer}
            isDragged={draggedIndex === index}
            isDragOver={dragOverIndex === index && draggedIndex !== index}
            canRemove={fields.length > 1}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onRemove={handleRemoveEntry}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onElapsedMinutesChange={setTimerElapsedMinutes}
          />
        ])}

        <InsertDivider
          key="insert-end"
          onClick={() => handleInsertEntry(fields.length)}
          label={t('workTimeForm.insertEntry')}
        />

        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" onClick={handleAddEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('workTimeForm.addEntry')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-1">
                  {t('workTimeForm.addEntryTooltip')}
                  <kbd className="ml-1 px-1.5 py-0.5 bg-background/20 border border-border/50 rounded text-xs font-mono">
                    Ctrl+N
                  </kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('workTimeForm.saving')}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {t('workTimeForm.register')}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-1">
                  {t('workTimeForm.saveTooltip')}
                  <kbd className="ml-1 px-1.5 py-0.5 bg-background/20 border border-border/50 rounded text-xs font-mono">
                    Ctrl+S
                  </kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            <Keyboard className="h-3 w-3 inline mr-1" />
            {t('workTimeForm.escHint')}
          </span>
        </div>
      </form>

      {/* ── Draft entry removal confirmation (UX-402) ─────────────────────── */}
      <AlertDialog
        open={pendingRemovalIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemovalIndex(null);
        }}
      >
        <AlertDialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            removeConfirmRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('timeLogs.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('timeLogs.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <Button
              ref={removeConfirmRef}
              variant="destructive"
              size="sm"
              onClick={confirmRemoveEntry}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
