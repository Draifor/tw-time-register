export interface CSVRow {
  taskName: string;
  typeName: string;
  taskLink: string;
}

export interface ParseTasksCsvResult {
  rows: CSVRow[];
  malformed: number[];
  error: string | null;
}

export interface ParseTasksCsvChunkedOptions {
  /** Number of CSV lines to tokenize per chunk before yielding. */
  chunkSize?: number;
  /** Yields control back to the event loop between chunks. */
  yieldToEventLoop?: () => Promise<void>;
}

const HEADER_HINTS = /^(tarea|task|tipo|type|link|url|nombre|name)$/i;

/**
 * Tokenizes a single CSV line into columns. Handles quoted fields (including
 * escaped `""` quotes) and trims surrounding whitespace.
 */
function parseCsvLine(line: string): string[] {
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
  return cols;
}

/**
 * Minimal CSV parser that handles quoted fields and trims whitespace.
 * Returns an array of row arrays (strings).
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

/** Detect if the first row looks like a header row (non-numeric values typical of labels). */
export function isHeaderRow(row: string[]): boolean {
  return row.some((cell) => HEADER_HINTS.test(cell.trim()));
}

/** Maps parsed CSV rows into task rows, preserving the original dialog semantics. */
function buildParseResult(rawRows: string[][]): ParseTasksCsvResult {
  if (rawRows.length === 0) {
    return { rows: [], malformed: [], error: 'The file appears to be empty.' };
  }

  // Skip header if present
  const dataRows = isHeaderRow(rawRows[0]) ? rawRows.slice(1) : rawRows;

  if (dataRows.length === 0) {
    return { rows: [], malformed: [], error: 'No data rows found after skipping the header.' };
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

  if (parsed.length === 0) {
    return { rows: [], malformed, error: 'No valid rows to import.' };
  }

  const error =
    malformed.length > 0
      ? `${malformed.length} row(s) have fewer than 2 columns and will be skipped (rows: ${malformed.join(', ')}).`
      : null;

  return { rows: parsed, malformed, error };
}

/**
 * Parses a tasks CSV synchronously, returning the valid rows, the malformed
 * row numbers (1-based within the data rows) and a user-facing error/warning
 * string, without touching component state.
 */
export function parseTasksCsv(text: string): ParseTasksCsvResult {
  return buildParseResult(parseCSV(text));
}

/**
 * Chunked, non-blocking variant of {@link parseTasksCsv}. It tokenizes the file
 * in `chunkSize`-line batches, yielding to the event loop between batches so the
 * renderer thread is not blocked. The output is identical to `parseTasksCsv`.
 */
export async function parseTasksCsvChunked(
  text: string,
  {
    chunkSize = 500,
    yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  }: ParseTasksCsvChunkedOptions = {}
): Promise<ParseTasksCsvResult> {
  const lines = text.split(/\r?\n/);
  const rawRows: string[][] = [];
  let processedSinceYield = 0;

  for (const line of lines) {
    if (line.trim()) {
      rawRows.push(parseCsvLine(line));
    }
    processedSinceYield++;
    if (processedSinceYield >= chunkSize) {
      await yieldToEventLoop();
      processedSinceYield = 0;
    }
  }

  return buildParseResult(rawRows);
}
