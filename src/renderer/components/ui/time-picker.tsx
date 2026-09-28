/**
 * TimePickerInput — Flatpickr time picker without react-hook-form.
 * Accepts/returns time strings in "HH:mm" format.
 * Use this for standalone controlled inputs (e.g. inline table editing).
 * For react-hook-form forms, use InputTime instead.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // Read the latest props through refs so the options object can stay stable.
  // react-flatpickr v4 mutates an options object that receives prop hooks and
  // rebuilds the flatpickr instance whenever its identity changes
  // (react-flatpickr/build/react-flatpickr.js:13-25,34-46); a stable object
  // keeps an open picker from closing on every parent render.
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  // The live flatpickr instance, published by `onReady` below. Held in state
  // rather than a plain ref so that a replacement instance re-runs the sync
  // effect instead of leaving the picker blank.
  const [instance, setInstance] = useState<FlatpickrInstance | null>(null);

  const options = useMemo(
    () => ({
      enableTime: true,
      noCalendar: true,
      dateFormat: 'H:i',
      time_24hr: true,
      minuteIncrement: 15,
      disableMobile: true,
      // Published, and given its value, here rather than from
      // react-flatpickr's `onCreate` prop — see the note in input-date.tsx:
      // v4 deletes `onCreate` from a memoised props copy and StrictMode's
      // double render reuses that mutated copy, so the replacement instance is
      // never published and renders blank. `onReady` lives in `options`, which
      // v4 passes through untouched.
      onReady: (_dates: Date[], _str: string, created: FlatpickrInstance) => {
        const parsed = toDate(valueRef.current);
        created.setDate(parsed ? [parsed] : [], false);
        setInstance(created);
      },
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

  // Re-applies the value when it changes and when the instance is replaced. The
  // DOM input is left uncontrolled on purpose: v4 renders it controlled to
  // `value.toString()` and re-asserts that on every commit, which would clobber
  // the "HH:mm" display it derives from setDate
  // (react-flatpickr/build/react-flatpickr.js:56,76).
  useEffect(() => {
    if (!instance) return;
    const parsed = toDate(value);
    instance.setDate(parsed ? [parsed] : [], false);
  }, [instance, value]);

  return (
    <DateTimePickerAny
      className={`${baseStyles} ${className ?? ''}`}
      placeholder={placeholder ?? '--:--'}
      disabled={disabled ?? false}
      options={options}
    />
  );
}

export default TimePickerInput;
