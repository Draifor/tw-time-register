import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useController, Control, FieldValues, RegisterOptions } from 'react-hook-form';
import DateTimePicker from 'react-flatpickr';
import { Options } from 'flatpickr/dist/types/options';
import 'flatpickr/dist/flatpickr.css';

interface InputTimeProps {
  className?: string;
  control: Control<FieldValues>;
  name: string;
  rules?: RegisterOptions;
  options?: Partial<Options>;
}

interface FlatpickrInstance {
  setDate: (date: unknown, triggerChange?: boolean) => void;
}

function InputTime({ className, control, name, rules, options }: InputTimeProps) {
  const DateTimePickerAny = DateTimePicker as React.ComponentType<Record<string, unknown>>;
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  const { field } = useController({ name, control, rules });

  // Keep `field` out of the options object and read it through a ref, so the
  // options memo below can stay stable while still calling the latest handler.
  const fieldRef = useRef(field);
  useEffect(() => {
    fieldRef.current = field;
  });

  // WorkTimeForm passes a fresh `options` object on every render, and
  // react-flatpickr v4 rebuilds the flatpickr instance whenever the merged
  // options identity changes (react-flatpickr/build/react-flatpickr.js:25,34-46).
  // Under the live timer WorkTimeForm re-renders every second, which would keep
  // closing an open picker. Key the memo on the serializable contents instead,
  // and register the change handler inside `options` (not as a top-level prop)
  // so v4 neither mutates this object nor accumulates duplicate hooks.
  const parentOptionsRef = useRef(options);
  useEffect(() => {
    parentOptionsRef.current = options;
  });

  // The live flatpickr instance, published by `onReady` below. Held in state
  // rather than a plain ref so that a replacement instance re-runs the sync
  // effect instead of leaving the picker blank.
  const [instance, setInstance] = useState<FlatpickrInstance | null>(null);

  const optionsKey = JSON.stringify({ ...(options ?? {}), onChange: undefined });
  const stableOptions = useMemo(() => {
    const restOptions: Partial<Options> = { ...(options ?? {}) };
    delete restOptions.onChange;
    return {
      ...restOptions,
      // Published, and given its value, here rather than from
      // react-flatpickr's `onCreate` prop — see the note in input-date.tsx:
      // v4 deletes `onCreate` from a memoised props copy and StrictMode's
      // double render reuses that mutated copy, so the replacement instance is
      // never published and renders blank. `onReady` lives in `options`, which
      // v4 passes through untouched.
      onReady: (_dates: Date[], _str: string, created: FlatpickrInstance) => {
        created.setDate(fieldRef.current.value || [], false);
        setInstance(created);
      },
      onChange: (dates: Date[], dateStr: string, fp: unknown) => {
        // v4 also routes a native input event through onChange with
        // `[new Date(input.value)]`; for a time-only picker that value is
        // "HH:mm" and parses to an Invalid Date. flatpickr's own hook (this
        // path) already carries the real selection, so drop invalid payloads.
        if (!dates[0] || Number.isNaN(dates[0].getTime())) return;
        fieldRef.current.onChange(dates);
        // Read the parent's hook through a ref so it sees the latest closure
        // (e.g. the current entry index) even though this object is stable.
        const parentOnChange = parentOptionsRef.current?.onChange;
        const hooks = Array.isArray(parentOnChange) ? parentOnChange : parentOnChange ? [parentOnChange] : [];
        hooks.forEach((hook) => hook(dates, dateStr, fp as never));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const pickerValue = useMemo(() => field.value || [], [field.value]);

  // Re-applies the value when it changes and when the instance is replaced. The
  // DOM input is left uncontrolled on purpose: v4 renders it controlled to
  // `value.toString()` and re-asserts that on every commit, which would clobber
  // the "HH:mm" display and defeat v4's own setDate guard
  // (react-flatpickr/build/react-flatpickr.js:56,76).
  useEffect(() => {
    if (!instance) return;
    instance.setDate(pickerValue, false);
  }, [instance, pickerValue]);

  // field.onChange and field.value are wired through `options` and the setDate
  // effect above; leaving them off the DOM input keeps it uncontrolled so React
  // does not overwrite what flatpickr writes.
  const fieldProps = { ...field, onChange: undefined, value: undefined };

  return <DateTimePickerAny {...fieldProps} className={`${baseStyles} ${className || ''}`} options={stableOptions} />;
}

export default InputTime;
