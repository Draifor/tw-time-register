import React, { useMemo } from 'react';
import { Controller } from 'react-hook-form';
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

function InputDate({ className, control, name, rules, options }: InputDateProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DateTimePickerAny = DateTimePicker as any;
  const { i18n } = useTranslation();
  const baseStyles =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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
      ...options
    }),
    [locale, options]
  );

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <div className="w-full">
          <DateTimePickerAny
            value={field.value || ''}
            onChange={(dates: Date[]) => {
              // Store the selected date in ISO format (Y-m-d) for DB consistency
              if (dates[0]) {
                const isoDate = dates[0].toISOString().split('T')[0];
                field.onChange(isoDate);
              }
            }}
            className={`${baseStyles} ${className || ''}`}
            options={defaultOptions}
          />
          {fieldState?.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}

export default InputDate;
