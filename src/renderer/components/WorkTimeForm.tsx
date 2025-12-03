import React, { useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import Button from './ui/Button';
import Input from './ui/InputForm';
import Label from './ui/Label';
import Select from './ui/Select';
import TotalTimeDay from './TotalTimeDay';
import InputTime from './ui/InputTime';

type WorkTimeEntry = {
  date: string;
  description: string;
  endTime: Date[]; // Ajustado para react-flatpickr
  hours: Date[];
  startTime: Date[];
  task: string;
};

export default function WorkTimeForm() {
  const defaultValue: WorkTimeEntry = {
    description: '',
    hours: [new Date('1970-01-01T00:00:00')],
    date: new Date().toISOString().split('T')[0],
    task: '',
    startTime: [new Date('1970-01-01T09:00:00')],
    endTime: [new Date('1970-01-01T09:00:00')]
  };

  const {
    formState: { errors },
    control,
    handleSubmit,
    reset,
    setValue
  } = useForm<{ entries: WorkTimeEntry[] }>({
    defaultValues: { entries: [defaultValue] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });
  const result = useWatch({ control, name: 'entries' });

  const options = [
    { value: '1', label: 'Project 1', link: 'https://link-to-task-1' },
    { value: '2', label: 'Project 2', link: 'https://link-to-task-2' },
    { value: '3', label: 'Project 3', link: 'https://link-to-task-3' },
    { value: 'juju', label: 'Project juju', link: 'https://link-to-task-juju' }
  ];

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
    console.log(data);
    reset();
  };

  const handleAddEntry = () => {
    const lastEntry = result[result.length - 1];
    const newEntry = {
      ...defaultValue,
      date: lastEntry?.date || new Date().toISOString().split('T')[0],
      startTime: lastEntry?.endTime || [new Date('1970-01-01T09:00:00')],
      endTime: [new Date('1970-01-01T09:00:00')]
    };
    append(newEntry);
  };

  return (
    <>
      <TotalTimeDay control={control} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-end space-x-2">
            <div className="flex-1">
              <Label htmlFor={`entries.${index}.description`}>Description Task</Label>
              <Input
                type="text"
                placeholder="Task description"
                className="w-full"
                name={`entries.${index}.description`}
                control={control}
                rules={{ required: 'Description is required' }}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`entries.${index}.task`}>Task</Label>
              <Select
                name={`entries.${index}.task`}
                control={control}
                options={options}
                placeholder="Select a task"
                rules={{ required: 'Task is required' }}
              />
              {errors?.entries?.[index]?.task && <span>{errors.entries[index].task.message}</span>}
            </div>
            <div className="w-40">
              <Label htmlFor={`entries.${index}.date`}>Date</Label>
              <Input
                type="date"
                name={`entries.${index}.date`}
                control={control}
                rules={{ required: 'Date is required' }}
              />
              {errors?.entries?.[index]?.date && <span>{errors.entries[index].date.message}</span>}
            </div>
            <div className="w-28">
              <Label htmlFor={`entries.${index}.hours`}>Hours</Label>
              <InputTime
                name={`entries.${index}.hours`}
                control={control}
                className="w-full"
                rules={{ required: 'Hours are required' }}
                options={{
                  enableTime: true,
                  noCalendar: true,
                  time_24hr: true,
                  dateFormat: 'H:i',
                  defaultDate: '00:00'
                }}
              />
            </div>
            <div className="w-32">
              <Label htmlFor={`entries.${index}.startTime`}>Start Time</Label>
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
              {errors?.entries?.[index]?.startTime && <span>{errors.entries[index].startTime.message}</span>}
            </div>
            <div className="w-28">
              <Label htmlFor={`entries.${index}.endTime`}>End Time</Label>
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
            <Button type="button" className="destructive" onClick={() => remove(index)} disabled={fields.length === 1}>
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" onClick={handleAddEntry}>
          Add Entry
        </Button>
        <Button type="submit">Register in TW</Button>
      </form>
      <pre>{JSON.stringify(fields, null, 2)}</pre>
      <hr />
      <pre>{JSON.stringify(errors, null, 2)}</pre>
    </>
  );
}
