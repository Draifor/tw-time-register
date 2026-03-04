import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useForm, useFieldArray, useWatch, Control, FieldValues } from 'react-hook-form';
import { Plus, Trash2, Send, Keyboard, DollarSign, UtensilsCrossed, Timer, TimerOff, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import Textarea from './ui/textarea-form';
import { Label } from './ui/label';
import Combobox from './ui/combobox';
import TotalTimeDay from './TotalTimeDay';
import InputTime from './ui/input-time';
import InputDate from './ui/input-date';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import useTasks from '../hooks/useTasks';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { getNextAvailableSlot, getDailyTimeInfo, NextSlotSuggestion } from '../services/timesService';

type WorkTimeEntry = {
  date: string;
  description: string;
  endTime: Date[];
  hours: Date[];
  startTime: Date[];
  task: { value: string; label: string } | string;
  isBillable: boolean;
  afterLunch: boolean;
};

export default function WorkTimeForm() {
  const { t } = useTranslation();
  // Create default entry from next available slot
  const createDefaultEntry = useCallback((slot: NextSlotSuggestion | null): WorkTimeEntry => {
    const [hours, minutes] = (slot?.startTime || '09:00').split(':').map(Number);
    const startTimeDate = new Date('1970-01-01T00:00:00');
    startTimeDate.setHours(hours, minutes, 0, 0);

    return {
      description: '',
      hours: [new Date('1970-01-01T00:00:00')],
      date: slot?.date || new Date().toISOString().split('T')[0],
      task: '',
      startTime: [startTimeDate],
      endTime: [startTimeDate],
      isBillable: false,
      afterLunch: false
    };
  }, []);

  const defaultValue: WorkTimeEntry = {
    description: '',
    hours: [new Date('1970-01-01T00:00:00')],
    date: new Date().toISOString().split('T')[0],
    task: '',
    startTime: [new Date('1970-01-01T09:00:00')],
    endTime: [new Date('1970-01-01T09:00:00')],
    isBillable: false,
    afterLunch: false
  };

  // Capture synchronously whether a real draft exists at mount time.
  // The localStorage save-on-render effect fires AFTER this line, so this
  // correctly reflects pre-render state and avoids a race condition where
  // the async slot fetch would always find data written by the first render.
  const hasDraftRef = useRef(!!localStorage.getItem('workTimeFormEntries'));

  const getInitialValues = () => {
    const saved = localStorage.getItem('workTimeFormEntries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((entry: WorkTimeEntry & { hours: string[]; startTime: string[]; endTime: string[] }) => ({
          ...entry,
          hours: entry.hours.map((d) => new Date(d)),
          startTime: entry.startTime.map((d) => new Date(d)),
          endTime: entry.endTime.map((d) => new Date(d))
        }));
      } catch (e) {
        console.error('Failed to parse saved form data', e);
      }
    }
    return null;
  };

  const {
    formState: { errors },
    control,
    handleSubmit,
    reset,
    setValue,
    register
  } = useForm<{ entries: WorkTimeEntry[] }>({
    defaultValues: { entries: getInitialValues() || [defaultValue] }
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'entries' });
  const result = useWatch({ control, name: 'entries' });
  const { data: tasks } = useTasks();
  // Cast control so it's compatible with generic UI components (InputTime, InputForm, InputDate)
  const typedControl = control as unknown as Control<FieldValues>;

  // Fetch next available slot on mount and apply it as the smart start time.
  // Logic (handled by getNextAvailableSlot on the backend):
  //   - Today has remaining hours → startTime = last saved entry's endTime
  //   - Today is complete          → startTime = next working day's default start
  //   - No entries at all today    → startTime = configured default start time
  // Only applies when there is no pre-existing draft in localStorage.
  useEffect(() => {
    if (hasDraftRef.current) return; // Draft restored from localStorage — leave it as-is

    const fetchNextSlot = async () => {
      try {
        const slot = await getNextAvailableSlot();
        const smartEntry = createDefaultEntry(slot);
        reset({ entries: [smartEntry] });
      } catch (error) {
        console.error('Error fetching next slot:', error);
      }
    };

    fetchNextSlot();
  }, [createDefaultEntry, reset]);

  const options = React.useMemo(() => {
    return (
      tasks?.map((task) => ({
        value: String(task.id),
        label: task.taskName,
        link: task.taskLink
      })) || []
    );
  }, [tasks]);

  const previousValues = useRef<{ startTime: Date[]; hours: Date[]; afterLunch: boolean }[]>([]);

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
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wt_activeTimer');
      if (saved) {
        const { startedAt } = JSON.parse(saved) as { startedAt: string };
        return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      }
    } catch {
      /* ignore */
    }
    return 0;
  });
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref that always points to the latest activeTimer — avoids stale closures in
  // keyboard shortcut callbacks registered before the next render.
  const activeTimerRef = useRef(activeTimer);
  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);

  // ── Drag & drop state ─────────────────────────────────────────────────────
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    // Transparent 1×1 image — hides the default browser drag ghost; the card
    // itself shows opacity feedback instead.
    const ghost = new Image();
    ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    move(draggedIndex, dropIndex);
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
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  // ── End drag & drop ──────────────────────────────────────────────────────

  // Start/stop the 1-second tick whenever activeTimer changes
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (activeTimer) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - activeTimer.startedAt.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeTimer]);

  // Clear interval on unmount
  useEffect(
    () => () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    },
    []
  );

  const formatElapsed = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleStartTimer = useCallback(
    (index: number) => {
      // Stop any existing timer without saving to form (user switched tasks)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const now = new Date();
      // startTime stored as 1970-epoch Date — same convention as the rest of the form
      const startDate = new Date('1970-01-01T00:00:00');
      startDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
      setValue(`entries.${index}.startTime`, [startDate]);
      const state = { index, startedAt: now };
      setActiveTimer(state);
      setElapsedSeconds(0);
      localStorage.setItem('wt_activeTimer', JSON.stringify({ index, startedAt: now.toISOString() }));
    },
    [setValue]
  );

  const handleStopTimer = useCallback(() => {
    if (!activeTimer) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
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
    setElapsedSeconds(0);
    localStorage.removeItem('wt_activeTimer');
  }, [activeTimer, setValue]);
  // ── End live timer ──────────────────────────────────────────────────────────

  const calculateEndTime = (startTimeArray: Date[], hoursArray: Date[]) => {
    const startTime = startTimeArray[0];
    const hours = hoursArray[0];

    if (startTime && hours) {
      // Use local time consistently for both start and duration — no UTC conversion needed
      const hoursToAdd = hours.getHours();
      const minutesToAdd = hours.getMinutes();

      const newEndTime = new Date(startTime);
      newEndTime.setHours(startTime.getHours() + hoursToAdd);
      newEndTime.setMinutes(startTime.getMinutes() + minutesToAdd);

      return [newEndTime];
    }

    return [new Date('1970-01-01T09:00:00')];
  };

  useEffect(() => {
    localStorage.setItem('workTimeFormEntries', JSON.stringify(result));
  }, [result]);

  useEffect(() => {
    result.forEach((entry, index) => {
      const prevEntry = previousValues.current[index];

      // New entry: initialize tracking state without modifying anything
      if (!prevEntry) {
        previousValues.current[index] = {
          startTime: entry.startTime,
          hours: entry.hours,
          afterLunch: entry.afterLunch ?? false
        };
        return;
      }

      // Detect afterLunch toggle: shift startTime ±1 hour and recalculate endTime
      if (entry.afterLunch !== prevEntry.afterLunch && entry.startTime?.[0]) {
        const shifted = new Date(entry.startTime[0]);
        shifted.setHours(shifted.getHours() + (entry.afterLunch ? 1 : -1));
        const newEndTime = calculateEndTime([shifted], entry.hours);
        setValue(`entries.${index}.startTime`, [shifted]);
        setValue(`entries.${index}.endTime`, newEndTime);
        previousValues.current[index] = {
          ...previousValues.current[index],
          afterLunch: entry.afterLunch,
          startTime: [shifted]
        };
        return;
      }

      const newEndTime = calculateEndTime(entry.startTime, entry.hours);

      // Solo actualiza si startTime o hours cambiaron
      if (
        entry.startTime[0]?.getTime() !== prevEntry.startTime?.[0]?.getTime() ||
        entry.hours[0]?.getTime() !== prevEntry.hours?.[0]?.getTime()
      ) {
        setValue(`entries.${index}.endTime`, newEndTime);
        previousValues.current[index] = {
          startTime: entry.startTime,
          hours: entry.hours,
          afterLunch: entry.afterLunch ?? false
        };

        // Cascade: propagate endTime → startTime of the next entry.
        // We intentionally do NOT update previousValues[index+1].startTime here,
        // so the next render detects it as a change and recalculates endTime[index+1]
        // (which in turn cascades to index+2, etc.).
        if (result[index + 1] !== undefined) {
          setValue(`entries.${index + 1}.startTime`, newEndTime);
        }
      }
    });
  }, [result, setValue]);

  const onSubmit = async (data: { entries: WorkTimeEntry[] }) => {
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

      const promises = data.entries.map((entry) => {
        // Format times for DB (HH:MM)
        const formatTime = (date: Date) => {
          if (!date) return '00:00';
          return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        };

        const startTimeStr = formatTime(entry.startTime[0]);
        const endTimeStr = formatTime(entry.endTime[0]);

        // Save locally
        const taskId = typeof entry.task === 'object' ? Number(entry.task.value) : Number(entry.task);

        return window.Main.addTimeEntry({
          taskId,
          description: entry.description,
          date: entry.date,
          startTime: startTimeStr,
          endTime: endTimeStr,
          isBillable: entry.isBillable
        });
      });

      await Promise.all(promises);

      toast.success(t('workTimeForm.savedTitle'), {
        description: t('workTimeForm.savedDesc', { count: data.entries.length })
      });
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
    }
  };

  const handleAddEntry = async () => {
    const lastEntry = result[result.length - 1];
    const currentDate = lastEntry?.date || new Date().toISOString().split('T')[0];

    // Calculate draft time already in the form for this date
    const draftMinutes = result.reduce((acc, entry) => {
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

    // If last entry has endTime, use it as the next startTime
    if (lastEntry?.endTime?.[0]) {
      const newEntry = {
        ...defaultValue,
        date: lastEntry.date,
        startTime: lastEntry.endTime,
        endTime: calculateEndTime(lastEntry.endTime, [suggestedDuration]),
        hours: [suggestedDuration]
      };
      append(newEntry);
    } else {
      // Fetch fresh suggestion from DB
      try {
        const slot = await getNextAvailableSlot();
        const entry = createDefaultEntry(slot);
        entry.hours = [suggestedDuration];
        append(entry);
      } catch {
        append(defaultValue);
      }
    }
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
          // Clear the last entry if there's more than one
          if (fields.length > 1) {
            const lastIndex = fields.length - 1;
            // If the timer is running on the last entry, stop it silently
            if (activeTimerRef.current?.index === lastIndex) {
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              setActiveTimer(null);
              setElapsedSeconds(0);
              localStorage.removeItem('wt_activeTimer');
            }
            remove(lastIndex);
            toast.info(t('workTimeForm.lastRemoved'));
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
        <TotalTimeDay control={control} />
      </div>

      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {fields.map((field, index) => (
          <Card
            key={field.id}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'animate-in fade-in-0 slide-in-from-top-2 duration-300 transition-[opacity,border-color]',
              draggedIndex === index && 'opacity-40 border-dashed',
              dragOverIndex === index && draggedIndex !== index && 'border-primary border-2'
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
                    title={t('workTimeForm.dragToReorder')}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{t('workTimeForm.entryN', { num: index + 1 })}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {activeTimer?.index === index ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-mono tabular-nums"
                            onClick={handleStopTimer}
                          >
                            <TimerOff className="h-4 w-4 mr-1.5 animate-pulse" />
                            {formatElapsed(elapsedSeconds)}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => handleStartTimer(index)}
                            disabled={activeTimer !== null}
                          >
                            <Timer className="h-4 w-4" />
                          </Button>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {activeTimer?.index === index
                            ? t('workTimeForm.timer.stop')
                            : activeTimer !== null
                              ? t('workTimeForm.timer.otherRunning')
                              : t('workTimeForm.timer.start')}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => {
                      // If timer is running on this entry, stop it silently before removing
                      if (activeTimer?.index === index) {
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        setActiveTimer(null);
                        setElapsedSeconds(0);
                        localStorage.removeItem('wt_activeTimer');
                      }
                      remove(index);
                    }}
                    disabled={fields.length === 1}
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
                  <Label htmlFor={`entries.${index}.description`}>{t('common.description')}</Label>
                  <Textarea
                    placeholder={t('workTimeForm.descPlaceholder')}
                    className="w-full"
                    name={`entries.${index}.description`}
                    control={control}
                    rules={{ required: 'Description is required' }}
                  />
                </div>
                <div className="w-[200px] space-y-2">
                  <Label htmlFor={`entries.${index}.task`}>{t('workTimeForm.task')}</Label>
                  <Combobox
                    name={`entries.${index}.task`}
                    control={control}
                    options={options}
                    placeholder={t('workTimeForm.selectTask')}
                    searchPlaceholder={t('workTimeForm.searchTasks')}
                    rules={{ required: t('workTimeForm.taskRequired') }}
                  />
                  {errors?.entries?.[index]?.task && (
                    <span className="text-sm text-destructive">{errors.entries[index].task.message}</span>
                  )}
                </div>
                <div className="w-[170px] space-y-2">
                  <Label htmlFor={`entries.${index}.date`}>{t('common.date')}</Label>
                  <InputDate
                    name={`entries.${index}.date`}
                    control={typedControl}
                    rules={{ required: t('workTimeForm.dateRequired') }}
                  />
                </div>
                <div className="w-[90px] space-y-2">
                  <Label htmlFor={`entries.${index}.hours`}>{t('timeLogs.colDuration')}</Label>
                  <InputTime
                    name={`entries.${index}.hours`}
                    control={typedControl}
                    className="w-full"
                    rules={{ required: t('workTimeForm.durationRequired') }}
                    options={{
                      enableTime: true,
                      noCalendar: true,
                      time_24hr: true,
                      dateFormat: 'H:i',
                      defaultDate: '00:00'
                    }}
                  />
                </div>
                <div className="w-[100px] space-y-2">
                  <Label htmlFor={`entries.${index}.startTime`}>{t('timeLogs.colStart')}</Label>
                  <InputTime
                    name={`entries.${index}.startTime`}
                    control={typedControl}
                    className="w-full"
                    rules={{ required: t('workTimeForm.startRequired') }}
                    options={{
                      enableTime: true,
                      noCalendar: true,
                      dateFormat: 'h:i K',
                      defaultDate: '09:00'
                    }}
                  />
                  {errors?.entries?.[index]?.startTime && (
                    <span className="text-sm text-destructive">{errors.entries[index].startTime.message}</span>
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
                      dateFormat: 'h:i K',
                      time_24hr: false,
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
                    <label
                      htmlFor={`entries.${index}.afterLunch`}
                      className="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        id={`entries.${index}.afterLunch`}
                        {...register(`entries.${index}.afterLunch`)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 rounded-full border border-input bg-muted peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow after:transition-all after:duration-200 peer-checked:after:translate-x-4" />
                    </label>
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
                    <label
                      htmlFor={`entries.${index}.isBillable`}
                      className="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        id={`entries.${index}.isBillable`}
                        {...register(`entries.${index}.isBillable`)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 rounded-full border border-input bg-muted peer-checked:bg-primary peer-checked:border-primary transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow after:transition-all after:duration-200 peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

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
                <Button type="submit">
                  <Send className="h-4 w-4 mr-2" />
                  {t('workTimeForm.register')}
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
    </div>
  );
}
