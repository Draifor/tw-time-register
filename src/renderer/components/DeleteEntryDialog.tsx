import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';

interface Props {
  open: boolean;
  /** Whether the entry has been synced to TW (shows TW deletion option). */
  isSent: boolean;
  entryLabel: string;
  isDeleting: boolean;
  onConfirm: (deleteFromTW: boolean) => void;
  onCancel: () => void;
}

export default function DeleteEntryDialog({ open, isSent, entryLabel, isDeleting, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [deleteFromTW, setDeleteFromTW] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function handleOpenChange(value: boolean) {
    // While the delete is in flight the dialog must stay open, so an Escape /
    // close request is ignored until the parent clears `isDeleting`.
    if (!value && !isDeleting) {
      setDeleteFromTW(false);
      onCancel();
    }
  }

  function handleConfirm() {
    onConfirm(deleteFromTW);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          // UX-406: land focus on the confirm action instead of the default
          // Cancel button. Preventing the default also skips Radix's built-in
          // cancel-focus handler.
          event.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('timeLogs.deleteConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('timeLogs.deleteConfirmDesc')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm font-medium truncate" title={entryLabel}>
            &ldquo;{entryLabel}&rdquo;
          </p>

          {/* TW deletion option — only shown for synced entries */}
          {isSent && (
            <label
              className={`flex items-start gap-3 cursor-pointer select-none rounded-md border p-3 hover:bg-muted/50 transition-colors ${deleteFromTW ? 'border-destructive/60 bg-destructive/5' : ''}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-destructive cursor-pointer"
                checked={deleteFromTW}
                onChange={(e) => setDeleteFromTW(e.target.checked)}
                disabled={isDeleting}
              />
              <span className="text-sm font-medium">{t('timeLogs.deleteAlsoInTW')}</span>
            </label>
          )}

          {/* Warning banner — shown only when TW deletion is selected */}
          {deleteFromTW && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/70 bg-destructive/15 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive leading-relaxed">{t('timeLogs.deleteTWWarning')}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
          <Button
            ref={confirmRef}
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('timeLogs.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {deleteFromTW ? t('timeLogs.deleteLocalAndTW') : t('common.delete')}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
