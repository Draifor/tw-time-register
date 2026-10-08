import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

export interface TableRowCountProps {
  /** Rows currently rendered/visible — the filtered count when `filtered`. */
  shown: number;
  /** Total rows the table holds (the full filtered set or the whole list). */
  total: number;
  /** True when a filter is active, so the "X results of Y" copy is used. */
  filtered: boolean;
  /** True while more rows can still be loaded by scrolling. */
  hasMore: boolean;
}

/**
 * Shared record-count footer for every data table (T1 of the UX table
 * consistency work). Extracted from the Catalog table so History and Reports
 * can show an identical count and "scroll for more" affordance. Renders nothing
 * for an empty table.
 */
export function TableRowCount({ shown, total, filtered, hasMore }: TableRowCountProps) {
  const { t } = useTranslation();

  if (total <= 0) return null;

  return (
    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
      <span>{filtered ? t('table.resultsOf', { count: shown, total }) : t('table.showingRows', { shown, total })}</span>
      {hasMore && (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('table.scrollForMore')}</span>
        </div>
      )}
    </div>
  );
}

export default TableRowCount;
