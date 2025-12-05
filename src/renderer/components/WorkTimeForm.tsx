import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2, Send, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import Textarea from './ui/textarea-form';
import { Label } from './ui/label';
import Select from './ui/select-custom';
import TotalTimeDay from './TotalTimeDay';
import InputTime from './ui/input-time';
import InputDate from './ui/input-date';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import useTasks from '../hooks/useTasks';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { getNextAvailableSlot, NextSlotSuggestion } from '../services/timesService';

type WorkTimeEntry = {
  date: string;
  description: string;
  endTime: Date[]; // Ajustado para react-flatpickr
  hours: Date[];
  startTime: Date[];
  task: { value: string; label: string } | string;
};

export default function WorkTimeForm() {
  const [nextSlot, setNextSlot] = useState<NextSlotSuggestion | null>(null);
  const [isLoadingSlot, setIsLoadingSlot] = useState(true);

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
      endTime: [startTimeDate]
    };
  }, []);

  const defaultValue: WorkTimeEntry = {
    description: '',
    hours: [new Date('1970-01-01T00:00:00')],
    date: new Date().toISOString().split('T')[0],
    task: '',
    startTime: [new Date('1970-01-01T09:00:00')],
    endTime: [new Date('1970-01-01T09:00:00')]
  };

  const getInitialValues = () => {
    const saved = localStorage.getItem('workTimeFormEntries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((entry: any) => ({
          ...entry,
          hours: entry.hours.map((d: string) => new Date(d)),
          startTime: entry.startTime.map((d: string) => new Date(d)),
          endTime: entry.endTime.map((d: string) => new Date(d))
        }));
      } catch (e) {
        console.error('Failed to parse saved form data', e);
      }
    }
    return null; // Return null to indicate we should use smart defaults
  };

  const {
    formState: { errors },
    control,
    handleSubmit,
    reset,
    setValue
  } = useForm<{ entries: WorkTimeEntry[] }>({
    defaultValues: { entries: getInitialValues() || [defaultValue] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });
  const result = useWatch({ control, name: 'entries' });
  const { data: tasks } = useTasks();

  // Fetch next available slot on mount
  useEffect(() => {
    const fetchNextSlot = async () => {
      try {
        const slot = await getNextAvailableSlot();
        setNextSlot(slot);

        // If no saved entries, update form with smart defaults
        const saved = localStorage.getItem('workTimeFormEntries');
        if (!saved && slot) {
          const smartEntry = createDefaultEntry(slot);
          reset({ entries: [smartEntry] });
        }
      } catch (error) {
        console.error('Error fetching next slot:', error);
      } finally {
        setIsLoadingSlot(false);
      }
    };

    fetchNextSlot();
  }, [createDefaultEntry, reset]);

  const options = React.useMemo(() => {
    return (
      tasks?.map((task: any) => ({
        value: String(task.id),
        label: task.taskName,
        link: task.taskLink
      })) || []
    );
  }, [tasks]);

  const previousValues = useRef<{ startTime: Date[]; hours: Date[] }[]>([]);

  const calculateEndTime = (startTimeArray: Date[], hoursArray: Date[]) => {
    const startTime = startTimeArray[0];
    const hours = hoursArray[0];

    if (startTime && hours) {
      const hoursToAdd = hours.getUTCHours();
      const minutesToAdd = hours.getUTCMinutes();

      const newEndTime = new Date(startTime);
      newEndTime.setHours(startTime.getHours() + hoursToAdd);
      newEndTime.setMinutes(startTime.getMinutes() + minutesToAdd);

      // Ajuste de la zona horaria a GMT-5
      const offset = 5 * 60 * 60 * 1000; // 5 horas en milisegundos
      newEndTime.setTime(newEndTime.getTime() - offset);
      return [newEndTime];
    }

    return [new Date('1970-01-01T09:00:00')];
  };

  useEffect(() => {
    localStorage.setItem('workTimeFormEntries', JSON.stringify(result));
  }, [result]);

  useEffect(() => {
    result.forEach((entry, index) => {
      const prevEntry = previousValues.current[index] || {};
      const newEndTime = calculateEndTime(entry.startTime, entry.hours);

      // Solo actualiza si startTime o hours cambiaron
      if (
        entry.startTime[0]?.getTime() !== prevEntry.startTime?.[0]?.getTime() ||
        entry.hours[0]?.getTime() !== prevEntry.hours?.[0]?.getTime()
      ) {
        setValue(`entries.${index}.endTime`, newEndTime);
        previousValues.current[index] = { startTime: entry.startTime, hours: entry.hours };
      }
    });
  }, [result, setValue]);

  const onSubmit = async (data: { entries: WorkTimeEntry[] }) => {
    try {
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
          isBillable: true
        });
      });

      await Promise.all(promises);

      toast.success('Entries saved successfully!', {
        description: `${data.entries.length} time entries registered.`
      });
      localStorage.removeItem('workTimeFormEntries');

      // Fetch new slot suggestion after saving
      try {
        const newSlot = await getNextAvailableSlot();
        setNextSlot(newSlot);
        reset({ entries: [createDefaultEntry(newSlot)] });
      } catch {
        reset({ entries: [defaultValue] });
      }
    } catch (error) {
      console.error('Error saving entries:', error);
      toast.error('Error saving entries', {
        description: 'Please try again later.'
      });
    }
  };

  const handleAddEntry = async () => {
    const lastEntry = result[result.length - 1];

    // If last entry has endTime, use it as the next startTime
    if (lastEntry?.endTime?.[0]) {
      const newEntry = {
        ...defaultValue,
        date: lastEntry.date,
        startTime: lastEntry.endTime,
        endTime: lastEntry.endTime
      };
      append(newEntry);
    } else {
      // Fetch fresh suggestion from DB
      try {
        const slot = await getNextAvailableSlot();
        append(createDefaultEntry(slot));
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
            remove(fields.length - 1);
            toast.info('Last entry removed');
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
          <h1 className="text-2xl font-bold tracking-tight">Time Registration</h1>
          <p className="text-muted-foreground">Register your work hours for TeamWork</p>
        </div>
        <TotalTimeDay control={control} />
      </div>

      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {fields.map((field, index) => (
          <Card key={field.id} className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Entry {index + 1}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Single row layout - wraps on smaller screens */}
              <div className="flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor={`entries.${index}.description`}>Description</Label>
                  <Textarea
                    placeholder="What did you work on?"
                    className="w-full"
                    name={`entries.${index}.description`}
                    control={control}
                    rules={{ required: 'Description is required' }}
                  />
                </div>
                <div className="w-[200px] space-y-2">
                  <Label htmlFor={`entries.${index}.task`}>Task</Label>
                  <Select
                    name={`entries.${index}.task`}
                    control={control}
                    options={options}
                    placeholder="Select a task"
                    rules={{ required: 'Task is required' }}
                  />
                  {errors?.entries?.[index]?.task && (
                    <span className="text-sm text-destructive">{errors.entries[index].task.message}</span>
                  )}
                </div>
                <div className="w-[170px] space-y-2">
                  <Label htmlFor={`entries.${index}.date`}>Date</Label>
                  <InputDate
                    name={`entries.${index}.date`}
                    control={control}
                    rules={{ required: 'Date is required' }}
                  />
                </div>
                <div className="w-[90px] space-y-2">
                  <Label htmlFor={`entries.${index}.hours`}>Duration</Label>
                  <InputTime
                    name={`entries.${index}.hours`}
                    control={control}
                    className="w-full"
                    rules={{ required: 'Duration is required' }}
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
                  <Label htmlFor={`entries.${index}.startTime`}>Start</Label>
                  <InputTime
                    name={`entries.${index}.startTime`}
                    control={control}
                    className="w-full"
                    rules={{ required: 'Start time is required' }}
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
                  <Label htmlFor={`entries.${index}.endTime`}>End</Label>
                  <InputTime
                    name={`entries.${index}.endTime`}
                    control={control}
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
                  Add Entry
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-1">
                  Add new entry
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
                  Register in TeamWork
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-1">
                  Save entries
                  <kbd className="ml-1 px-1.5 py-0.5 bg-background/20 border border-border/50 rounded text-xs font-mono">
                    Ctrl+S
                  </kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            <Keyboard className="h-3 w-3 inline mr-1" />
            Press Esc to remove last entry
          </span>
        </div>
      </form>
    </div>
  );
}
