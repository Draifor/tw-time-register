/**
 * TimePickerInput — Flatpickr time picker without react-hook-form.
 * Accepts/returns time strings in "HH:mm" format.
 * Use this for standalone controlled inputs (e.g. inline table editing).
 * For react-hook-form forms, use InputTime instead.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import DateTimePicker from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';

interface TimePickerInputProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface FlatpickrInstance {
  setDate: (date: unknown, triggerChange?: boolean) => void;
}

// Convert "HH:mm" string to a Date for Flatpickr (date part is irrelevant for time-only)
const toDate = (timeStr: string): Date | null => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date('1970-01-01T00:00:00');
  d.setHours(h, m, 0, 0);
  return d;
};

function TimePickerInput({ value, onChange, className, placeholder, disabled }: TimePickerInputProps) {
  const DateTimePickerAny = DateTimePicker as React.ComponentType<Record<string, unknown>>;

  const baseStyles =
    'w-24 rounded border border-input bg-background px-2 py-1 text-xs font-mono text-center ' +
    'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  // Read the latest onChange through a ref so the options object can stay
  // stable. react-flatpickr v4 mutates an options object that receives prop
  // hooks and rebuilds the flatpickr instance whenever its identity changes
  // (react-flatpickr/build/react-flatpickr.js:13-25,34-46); a stable object
  // keeps an open picker from closing on every parent render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const options = useMemo(
    () => ({
      enableTime: true,
      noCalendar: true,
      dateFormat: 'H:i',
      time_24hr: true,
      minuteIncrement: 15,
      disableMobile: true,
      onChange: (dates: Date[]) => {
        // v4 also routes a native input event through onChange with
        // `[new Date(input.value)]`; for a time-only picker that value is
        // "HH:mm" and parses to an Invalid Date. flatpickr's own hook (this
        // path) already carries the real selection, so drop invalid payloads.
        if (!dates[0] || Number.isNaN(dates[0].getTime())) return;
        const h = dates[0].getHours().toString().padStart(2, '0');
        const m = dates[0].getMinutes().toString().padStart(2, '0');
        onChangeRef.current(`${h}:${m}`);
      }
    }),
    []
  );

  // Capture the instance through onCreate and let flatpickr own the input.
  // v4 renders the input as controlled and re-asserts `value.toString()`,
  // which would clobber the "HH:mm" display it derives from setDate
  // (react-flatpickr/build/react-flatpickr.js:56,76).
  const instanceRef = useRef<FlatpickrInstance | null>(null);
  const handleCreate = useCallback((instance: FlatpickrInstance) => {
    instanceRef.current = instance;
  }, []);

  useEffect(() => {
    const flatpickr = instanceRef.current;
    if (!flatpickr) return;
    const parsed = toDate(value);
    flatpickr.setDate(parsed ? [parsed] : [], false);
  }, [value]);

  return (
    <DateTimePickerAny
      onCreate={handleCreate}
      className={`${baseStyles} ${className ?? ''}`}
      placeholder={placeholder ?? '--:--'}
      disabled={disabled ?? false}
      options={options}
    />
  );
}

export default TimePickerInput;
