import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

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

  function handleOpenChange(value: boolean) {
    if (!value && !isDeleting) {
      setDeleteFromTW(false);
      onCancel();
    }
  }

  function handleConfirm() {
    onConfirm(deleteFromTW);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('timeLogs.deleteConfirmTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">{t('timeLogs.deleteConfirmDesc')}</p>
          <p className="text-sm font-medium truncate" title={entryLabel}>
            &ldquo;{entryLabel}&rdquo;
          </p>

          {/* TW deletion option — only shown for synced entries */}
          {isSent && (
            <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border p-3 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-destructive cursor-pointer"
                checked={deleteFromTW}
                onChange={(e) => setDeleteFromTW(e.target.checked)}
                disabled={isDeleting}
              />
              <span className="text-sm">{t('timeLogs.deleteAlsoInTW')}</span>
            </label>
          )}

          {/* Warning banner — shown only when TW deletion is selected */}
          {deleteFromTW && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive leading-relaxed">{t('timeLogs.deleteTWWarning')}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={isDeleting} className="gap-1.5">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
