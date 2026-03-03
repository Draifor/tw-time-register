/**
 * TimePickerInput — Flatpickr time picker without react-hook-form.
 * Accepts/returns time strings in "HH:mm" format.
 * Use this for standalone controlled inputs (e.g. inline table editing).
 * For react-hook-form forms, use InputTime instead.
 */
import React from 'react';
import DateTimePicker from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';

interface TimePickerInputProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

function TimePickerInput({ value, onChange, className, placeholder, disabled }: TimePickerInputProps) {
  const DateTimePickerAny = DateTimePicker as React.ComponentType<Record<string, unknown>>;

  const baseStyles =
    'w-24 rounded border border-input bg-background px-2 py-1 text-xs font-mono text-center ' +
    'focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  // Convert "HH:mm" string to a Date for Flatpickr (date part is irrelevant for time-only)
  const toDate = (timeStr: string): Date | null => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date('1970-01-01T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const parsed = toDate(value);

  return (
    <DateTimePickerAny
      value={parsed ? [parsed] : []}
      onChange={(dates: Date[]) => {
        if (dates[0]) {
          const h = dates[0].getHours().toString().padStart(2, '0');
          const m = dates[0].getMinutes().toString().padStart(2, '0');
          onChange(`${h}:${m}`);
        }
      }}
      className={`${baseStyles} ${className ?? ''}`}
      placeholder={placeholder ?? '--:--'}
      disabled={disabled ?? false}
      options={{
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i',
        time_24hr: true,
        minuteIncrement: 15,
        disableMobile: true
      }}
    />
  );
}

export default TimePickerInput;
