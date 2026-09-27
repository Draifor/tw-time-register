import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DateTimePicker from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import { english } from 'flatpickr/dist/l10n/default.js';

interface InputDateProps {
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlatpickrInstance = any;

/** Normalise the form's value to the ISO `Y-m-d` string flatpickr expects. */
function toIsoDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
  const raw = String(value);
  return raw.includes('T') ? raw.split('T')[0] : raw;
}

function InputDate({ className, control, name, rules, options }: InputDateProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DateTimePickerAny = DateTimePicker as any;
  const { i18n } = useTranslation();
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const { field, fieldState } = useController({ name, control, rules });

  // The latest `field` is read through a ref so the options object below can
  // stay stable. react-flatpickr v4 mutates an options object that receives
  // top-level hook props and rebuilds the flatpickr instance whenever that
  // object's identity changes (react-flatpickr/build/react-flatpickr.js:13-25,34-46).
  // A rebuild closes an open calendar and re-accumulates hooks, so the change
  // handler is registered inside `options` and the object is memoised.
  const fieldRef = useRef(field);
  useEffect(() => {
    fieldRef.current = field;
  });

  // The live flatpickr instance, published by `onReady` below. Held in state
  // rather than a plain ref so that a replacement instance re-runs the sync
  // effect instead of leaving the picker blank.
  const [instance, setInstance] = useState<FlatpickrInstance | null>(null);

  // Get locale based on current language
  const locale = useMemo(() => {
    return i18n.language === 'es' ? Spanish : english;
  }, [i18n.language]);

  // Build options - separate altInput for display vs actual value
  const defaultOptions = useMemo(
    () => ({
      dateFormat: 'Y-m-d', // Internal format for DB (ISO)
      altInput: true, // Show alternative format to user
      altFormat: 'D-d-M-Y', // Display format: Day-dd-Mon-YYYY
      allowInput: true,
      locale,
      ...options,
      // The instance is published, and given its value, here — NOT from
      // react-flatpickr's `onCreate` prop. v4 deletes `onCreate` from a
      // memoised copy of its props (build/react-flatpickr.js:22-23), and
      // StrictMode renders twice with the same props object, so the second
      // render reuses that already-mutated copy: `onCreate` is undefined, v4's
      // create effect re-runs on the changed callback, and the replacement
      // instance is never given a value — the picker then renders empty.
      // flatpickr's own `onReady` lives inside `options`, which v4 passes
      // through untouched, and fires at the end of every init
      // (flatpickr/dist/esm/index.js:88).
      onReady: (_dates: Date[], _str: string, created: FlatpickrInstance) => {
        created.setDate(toIsoDate(fieldRef.current.value) || null, false);
        setInstance(created);
      },
      onChange: (dates: Date[]) => {
        // Store the selected date in ISO format (Y-m-d) for DB consistency
        if (dates[0] && !Number.isNaN(dates[0].getTime())) {
          fieldRef.current.onChange(dates[0].toISOString().split('T')[0]);
        }
      }
    }),
    [locale, options]
  );

  const isoValue = toIsoDate(field.value);

  // Re-applies the value when it changes and when the instance is replaced.
  // The DOM input is left uncontrolled on purpose: v4 renders it controlled to
  // `value.toString()` and only calls setDate when that differs from the
  // input's own value (build/react-flatpickr.js:56,76), so handing React the
  // value makes it fight flatpickr over the altInput display.
  useEffect(() => {
    if (!instance) return;
    instance.setDate(isoValue || null, false);
  }, [instance, isoValue]);

  return (
    <div className="w-full">
      <DateTimePickerAny
        // React 19 rewrites the `type` attribute of this input on every commit
        // where `value` changes. flatpickr sets type="hidden" imperatively
        // (flatpickr/dist/esm/index.js:1773) and inserts its own visible alt
        // input, so without this declaration React deletes the attribute and
        // leaves the original input visible next to the alt one — two date rows.
        // Declaring it keeps React's model in step with flatpickr's.
        type="hidden"
        className={`${baseStyles} ${className || ''}`}
        options={defaultOptions}
      />
      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
    </div>
  );
}

export default InputDate;
