import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronUp, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import DataTable from './DataTable';
import useTypeTasks from '../hooks/useTypeTasks';
import { addTypeTask } from '../services/typeTasksService';
import { TypeTasks } from '../../types/typeTasks';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';

function TypeTasksTable() {
  const { t } = useTranslation();
  const { data, isLoading, isEditable, error, columns } = useTypeTasks();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [nameError, setNameError] = useState(false);

  function resetForm() {
    setTypeName('');
    setNameError(false);
  }

  const { mutate: submitAdd, isPending } = useMutation({
    mutationFn: (name: string) => addTypeTask(name),
    onSuccess: () => {
      toast.success(t('tasks.typeForm.addSuccess'));
      queryClient.invalidateQueries({ queryKey: ['typeTasks'] });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(t('tasks.typeForm.addError'), { description: err.message });
    }
  });

  function handleSubmit() {
    const nErr = !typeName.trim();
    setNameError(nErr);
    if (nErr) return;
    submitAdd(typeName.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setOpen(false);
      resetForm();
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <Button
          variant={open ? 'secondary' : 'default'}
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setOpen(!open);
            if (open) resetForm();
          }}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t('tasks.typeForm.addTypeBtn')}
        </Button>
      </div>

      {/* ── Collapsible add form ────────────────────────────────────────── */}
      {open && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4" onKeyDown={handleKeyDown}>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="space-y-1 flex-1">
                <Label htmlFor="new-type-name" className="text-xs">
                  {t('tasks.typeForm.typeNameLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-type-name"
                  placeholder={t('tasks.typeForm.typeNamePlaceholder')}
                  value={typeName}
                  onChange={(e) => {
                    setTypeName(e.target.value);
                    setNameError(false);
                  }}
                  className={nameError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  autoFocus
                />
                {nameError && <p className="text-xs text-destructive">{t('tasks.typeForm.nameRequired')}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isPending ? t('common.saving') : t('tasks.typeForm.submitBtn')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <DataTable
        title={t('tasks.typesTableTitle')}
        data={data}
        isLoading={isLoading}
        isEditable={isEditable}
        error={error ? { message: String((error as Error)?.message) || t('common.errorOccurred') } : null}
        columns={columns}
        onPersist={(row: TypeTasks) => row}
      />
    </div>
  );
}

export default TypeTasksTable;
