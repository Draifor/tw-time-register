import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Controller, Control, RegisterOptions } from 'react-hook-form';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface ComboboxProps {
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
}

interface ComboboxInnerProps {
  options: Option[];
  placeholder?: string;
  value?: Option | null;
  onChange?: (option: Option | null) => void;
  className?: string;
  searchPlaceholder?: string;
}

function ComboboxInner({
  options,
  placeholder = 'Select an option',
  value,
  onChange,
  className,
  searchPlaceholder = 'Search...'
}: ComboboxInnerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()));

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

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelectorAll('li')[highlightedIndex];
    item?.scrollIntoView({ block: 'nearest' });
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
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
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
      {/* Trigger */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-9 w-full items-start justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
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
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options list */}
          <ul ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground text-center">No results found.</li>
            ) : (
              filtered.map((option, i) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={value?.value === option.value}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur before select
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm select-none',
                    i === highlightedIndex && 'bg-accent text-accent-foreground',
                    value?.value === option.value && i !== highlightedIndex && 'bg-accent/40'
                  )}
                >
                  <span className="whitespace-normal break-words pr-2">{option.label}</span>
                  {value?.value === option.value && <Check className="h-3.5 w-3.5 shrink-0 ml-2 text-primary" />}
                </li>
              ))
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
  onChange
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
    />
  );
}

export default Combobox;
