import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const optionsKey = JSON.stringify({ ...(options ?? {}), onChange: undefined });
  const stableOptions = useMemo(() => {
    const restOptions: Partial<Options> = { ...(options ?? {}) };
    delete restOptions.onChange;
    return {
      ...restOptions,
      onChange: (dates: Date[], dateStr: string, instance: unknown) => {
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
        hooks.forEach((hook) => hook(dates, dateStr, instance as never));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  // Capture the instance through onCreate and let flatpickr own the input.
  // v4 renders the input as controlled and re-asserts `value.toString()` on
  // every commit, which would clobber the "HH:mm" display and defeat v4's own
  // setDate guard (react-flatpickr/build/react-flatpickr.js:56,76).
  const instanceRef = useRef<FlatpickrInstance | null>(null);
  const handleCreate = useCallback((instance: FlatpickrInstance) => {
    instanceRef.current = instance;
  }, []);

  const pickerValue = useMemo(() => field.value || [], [field.value]);

  useEffect(() => {
    const flatpickr = instanceRef.current;
    if (!flatpickr) return;
    flatpickr.setDate(pickerValue, false);
  }, [pickerValue]);

  // field.onChange and field.value are wired through `options` and the setDate
  // effect above; leaving them off the DOM input keeps it uncontrolled so React
  // does not overwrite what flatpickr writes.
  const fieldProps = { ...field, onChange: undefined, value: undefined };

  return (
    <DateTimePickerAny
      {...fieldProps}
      onCreate={handleCreate}
      className={`${baseStyles} ${className || ''}`}
      options={stableOptions}
    />
  );
}

export default InputTime;
