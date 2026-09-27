import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

  // The flatpickr instance, captured through onCreate. Driving setDate from
  // the form value is deliberate: v4 always renders the input as a controlled
  // input whose value is `value.toString()` (react-flatpickr/build/react-flatpickr.js:76)
  // and only calls setDate when the prop differs from the input's current
  // value (:56). React re-asserts that value on every commit, which both hides
  // altInput's formatted value and makes the guard skip setDate, so the input
  // is left uncontrolled here and flatpickr owns it (the v3 behaviour).
  const instanceRef = useRef<FlatpickrInstance>(null);
  const handleCreate = useCallback((instance: FlatpickrInstance) => {
    instanceRef.current = instance;
  }, []);

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

  useEffect(() => {
    const flatpickr = instanceRef.current;
    if (!flatpickr) return;
    flatpickr.setDate(isoValue || null, false);
  }, [isoValue]);

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
        onCreate={handleCreate}
        className={`${baseStyles} ${className || ''}`}
        options={defaultOptions}
      />
      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
    </div>
  );
}

export default InputDate;
