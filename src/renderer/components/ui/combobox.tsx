import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { Controller, Control, RegisterOptions } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatMinutesToHHMM } from '../../lib/progressUtils';

const formatMins = formatMinutesToHHMM;

interface Option {
  value: string;
  label: string;
  estimatedTime?: number;
  totalLoggedMinutes?: number;
  link?: string;
}

interface ComboboxProps extends React.AriaAttributes {
  name?: string;
  options: Option[];
  placeholder?: string;
  value?: Option | null;
  onChange?: (option: Option | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control?: Control<any>;
  rules?: RegisterOptions;
  className?: string;
  searchPlaceholder?: string;
  showProgress?: boolean;
  id?: string;
}

interface ComboboxInnerProps extends React.AriaAttributes {
  options: Option[];
  placeholder?: string;
  value?: Option | null;
  onChange?: (option: Option | null) => void;
  className?: string;
  searchPlaceholder?: string;
  showProgress?: boolean;
  id?: string;
}

function ComboboxInner({
  options,
  placeholder = 'Select an option',
  value,
  onChange,
  className,
  searchPlaceholder = 'Search...',
  showProgress = false,
  id: idProp,
  ...triggerProps
}: ComboboxInnerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Stable ids for the ARIA combobox/listbox relationship. Prefer the caller's
  // `id` (which already labels the trigger) and fall back to `useId` so two
  // unlabeled comboboxes on the same page never collide.
  const reactId = useId();
  const baseId = idProp ?? reactId;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  // Read the latest options through a ref so the open/reset effect below can
  // depend only on `open`/selection. `WorkTimeForm` rebuilds `options` every
  // second (fresh projected progress), and depending on its identity re-ran
  // that effect each tick, wiping the user's typed search (BUG-07).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const filtered = useMemo(
    () => options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const highlightedOption = open ? filtered[highlightedIndex] : undefined;
  const activeOptionId = highlightedOption ? optionId(highlightedIndex) : undefined;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Focus search input and align highlight to current selection when opened.
  // Depends on `open` and the primitive selection only; `options` is read
  // through the ref so a parent rebuild does not re-run it.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    const selectedValue = value?.value;
    const selectedIndex = selectedValue ? optionsRef.current.findIndex((opt) => opt.value === selectedValue) : -1;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const focusTimeout = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(focusTimeout);
  }, [open, value?.value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelectorAll('li')[highlightedIndex];
    // `scrollIntoView` is absent in jsdom; guard so tests can move the highlight.
    item?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (option: Option) => {
      onChange?.(option);
      setOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filtered.length > 0) {
          setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filtered.length > 0) {
          setHighlightedIndex((i) => Math.max(i - 1, 0));
        }
        break;
      case 'Home':
        e.preventDefault();
        if (filtered.length > 0) {
          setHighlightedIndex(0);
        }
        break;
      case 'End':
        e.preventDefault();
        if (filtered.length > 0) {
          setHighlightedIndex(filtered.length - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)} onKeyDown={handleKeyDown}>
      {/* Live announcement of the highlighted option while open. Rendered
          unconditionally so the region is registered before it changes. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {highlightedOption
          ? t('combobox.positionAnnouncement', {
              current: highlightedIndex + 1,
              total: filtered.length,
              label: highlightedOption.label
            })
          : ''}
      </div>

      {/* Trigger — receives the pass-through `aria-*`/`id` (validation
          semantics, label association) from `triggerProps`, while the
          popup state attributes stay owned by this component. While the popup
          is open, focus (and the `role="combobox"`) moves to the search input
          below, so the trigger drops its combobox role to avoid two elements
          claiming it (ARIA 1.2). */}
      <button
        type="button"
        id={idProp}
        role={open ? undefined : 'combobox'}
        {...triggerProps}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-9 w-full items-start justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-hidden focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground'
        )}
      >
        <span className="whitespace-normal break-words text-left">{value ? value.label : placeholder}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 opacity-50 shrink-0 ml-2 mt-0.5 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 min-w-full w-max max-w-[480px] rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded={true}
              aria-haspopup="listbox"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
            />
          </div>

          {/* Options list */}
          <ul id={listboxId} ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground text-center">No results found.</li>
            ) : (
              filtered.map((option, i) => {
                const estimated = option.estimatedTime ?? 0;
                const hasProgress = showProgress && estimated > 0;
                const { pct, status, margin } = (() => {
                  if (hasProgress) {
                    const logged = option.totalLoggedMinutes ?? 0;
                    const p = Math.min(100, (logged / estimated) * 100);
                    const o = Math.max(0, logged - estimated);
                    const m = Math.max(0, estimated - logged);
                    const s = o > 0 ? 'overtime' : p >= 80 ? 'warning' : 'on-time';
                    return { pct: p, status: s, margin: m };
                  }
                  return { pct: 0, status: 'none', margin: 0 };
                })();

                return (
                  <li
                    key={option.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={value?.value === option.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(option);
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm select-none',
                      i === highlightedIndex && 'bg-accent text-accent-foreground',
                      value?.value === option.value && i !== highlightedIndex && 'bg-accent/40'
                    )}
                    title={
                      hasProgress
                        ? `Progreso: ${formatMins(option.totalLoggedMinutes ?? 0)} / ${formatMins(estimated)} (${Math.round(pct)}%) — Margen: ${formatMins(margin)}`
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {hasProgress && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            status === 'overtime'
                              ? 'bg-destructive'
                              : status === 'warning'
                                ? 'bg-warning'
                                : 'bg-success'
                          )}
                        />
                      )}
                      <span className="whitespace-normal break-words pr-2">{option.label}</span>
                      {hasProgress && (
                        <span className="sr-only">
                          {t('progress.detail', {
                            status:
                              status === 'overtime'
                                ? t('progress.statusOvertime')
                                : status === 'warning'
                                  ? t('progress.statusWarning')
                                  : t('progress.statusOnTime'),
                            logged: formatMins(option.totalLoggedMinutes ?? 0),
                            estimated: formatMins(estimated),
                            pct: Math.round(pct),
                            margin: formatMins(margin)
                          })}
                        </span>
                      )}
                    </div>
                    {value?.value === option.value && <Check className="h-3.5 w-3.5 shrink-0 ml-2 text-primary" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Combobox({
  name,
  control,
  options,
  placeholder,
  rules,
  className,
  searchPlaceholder,
  value,
  onChange,
  showProgress,
  ...triggerProps
}: ComboboxProps) {
  if (control && name) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field }) => (
          <ComboboxInner
            options={options}
            placeholder={placeholder}
            value={field.value || null}
            onChange={field.onChange}
            className={className}
            searchPlaceholder={searchPlaceholder}
            showProgress={showProgress}
            {...triggerProps}
          />
        )}
      />
    );
  }

  return (
    <ComboboxInner
      options={options}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      searchPlaceholder={searchPlaceholder}
      showProgress={showProgress}
      {...triggerProps}
    />
  );
}

export default Combobox;
