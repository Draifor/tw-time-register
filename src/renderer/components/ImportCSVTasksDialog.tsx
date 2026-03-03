import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { importTasksFromCSV } from '../services/tasksService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSVRow {
  taskName: string;
  typeName: string;
  taskLink: string;
}

interface ImportCSVResult {
  created: number;
  skipped: number;
  typesCreated: string[];
  errors: string[];
}

type Step = 'upload' | 'preview' | 'result';

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal CSV parser that handles quoted fields and trims whitespace.
 * Returns an array of row arrays (strings).
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

/** Detect if the first row looks like a header row (non-numeric values typical of labels). */
function isHeaderRow(row: string[]): boolean {
  const HEADER_HINTS = /^(tarea|task|tipo|type|link|url|nombre|name)$/i;
  return row.some((cell) => HEADER_HINTS.test(cell.trim()));
}

// ─── Component ────────────────────────────────────────────────────────────────

function ImportCSVTasksDialog() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportCSVResult | null>(null);
  const [fileName, setFileName] = useState('');

  const queryClient = useQueryClient();
  const { t } = useTranslation();

  function reset() {
    setStep('upload');
    setRows([]);
    setParseError(null);
    setImporting(false);
    setResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) reset();
    setOpen(isOpen);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rawRows = parseCSV(text);
        if (rawRows.length === 0) {
          setParseError('The file appears to be empty.');
          return;
        }

        // Skip header if present
        const dataRows = isHeaderRow(rawRows[0]) ? rawRows.slice(1) : rawRows;

        if (dataRows.length === 0) {
          setParseError('No data rows found after skipping the header.');
          return;
        }

        const parsed: CSVRow[] = [];
        const malformed: number[] = [];

        dataRows.forEach((row, idx) => {
          if (row.length < 2) {
            malformed.push(idx + 1);
            return;
          }
          parsed.push({
            taskName: row[0] ?? '',
            typeName: row[1] ?? '',
            taskLink: row[2] ?? ''
          });
        });

        if (malformed.length > 0) {
          setParseError(
            `${malformed.length} row(s) have fewer than 2 columns and will be skipped (rows: ${malformed.join(', ')}).`
          );
        }

        if (parsed.length === 0) {
          setParseError('No valid rows to import.');
          return;
        }

        setRows(parsed);
        setStep('preview');
      } catch {
        setParseError('Failed to parse the CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await importTasksFromCSV(rows);
      setResult(res as ImportCSVResult);
      setStep('result');
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
      if (res.created > 0) {
        toast.success(t('tasks.importCSV.importedFromCSV', { count: res.created }));
      } else {
        toast.info(t('tasks.importCSV.noneImported'));
      }
    } catch (err) {
      toast.error(t('tasks.importCSV.importFailed', { error: String(err) }));
    } finally {
      setImporting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          {t('tasks.importCSV.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('tasks.importCSV.title')}</DialogTitle>
        </DialogHeader>

        {/* ── Step: upload ──────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('tasks.importCSV.uploadHint')}</p>

            <div className="rounded-md border bg-muted/50 px-4 py-3 font-mono text-sm">
              <span className="text-blue-500">TareaTW</span>
              <span className="text-muted-foreground">, </span>
              <span className="text-green-500">Tipo</span>
              <span className="text-muted-foreground">, </span>
              <span className="text-orange-500">Link</span>
            </div>

            <p className="text-sm text-muted-foreground">{t('tasks.importCSV.typeAutoCreate')}</p>

            <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-8">
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('tasks.importCSV.dropzoneHint')}</p>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                {t('tasks.importCSV.browseBtn')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step: preview ─────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{rows.length}</strong> {t('tasks.importCSV.rowsParsed', { count: rows.length, file: fileName })}
              </p>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 gap-1 text-xs">
                <X className="h-3 w-3" />
                {t('tasks.importCSV.changeFile')}
              </Button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Preview table */}
            <div className="max-h-64 overflow-auto rounded-md border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {t('tasks.importCSV.colTaskName')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {t('tasks.importCSV.colType')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {t('tasks.importCSV.colLink')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">{row.taskName || <span className="text-destructive">—</span>}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-normal">
                          {row.typeName || <span className="text-destructive">—</span>}
                        </Badge>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">{row.taskLink || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={importing}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? t('tasks.importCSV.importingBtn') : t('tasks.importCSV.importBtn', { count: rows.length })}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: result ──────────────────────────────────────────────── */}
        {step === 'result' && result && (
          <div className="space-y-4 py-2">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-green-500/10 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('tasks.importCSV.createdLabel')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.created}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t('tasks.importCSV.skippedLabel')}</p>
                <p className="text-2xl font-bold">{result.skipped}</p>
              </div>
            </div>

            {/* Auto-created types */}
            {result.typesCreated.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('tasks.importCSV.autoCreatedTypes')}</p>
                <div className="flex flex-wrap gap-1">
                  {result.typesCreated.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {t('tasks.importCSV.errorsLabel', { count: result.errors.length })}
                </div>
                <ul className="max-h-32 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.created > 0 && result.errors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {t('tasks.importCSV.allSuccess')}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                {t('tasks.importCSV.importAnotherFile')}
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                {t('common.done')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportCSVTasksDialog;
