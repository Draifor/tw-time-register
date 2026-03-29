import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, Paperclip, X, Send, Loader2, UploadCloud, ChevronDown, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  addCommentToTWTask,
  uploadPendingFileToTW,
  getCommentTemplates,
  fetchTWPeopleForTask,
  type CommentTemplate,
  type TWPerson
} from '../services/timesService';

interface AttachedFile {
  file: File;
  /** ref returned by TW pending-files endpoint, populated after upload */
  ref?: string;
  uploading: boolean;
  error?: string;
}

interface TaskCommentDialogProps {
  /** TW task numeric ID */
  twTaskId: string;
  /** Human-readable task name, shown in the dialog title */
  taskName: string;
}

export default function TaskCommentDialog({ twTaskId, taskName }: TaskCommentDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Notify people
  const [people, setPeople] = useState<TWPerson[]>([]);
  const [notifyIds, setNotifyIds] = useState<Set<string>>(new Set());
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const notifyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load templates when dialog opens ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      getCommentTemplates()
        .then(setTemplates)
        .catch(() => {});
    }
  }, [open]);

  // ── Close dropdowns on outside click ────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) setTemplateOpen(false);
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) setNotifyOpen(false);
    }
    if (templateOpen || notifyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [templateOpen, notifyOpen]);

  // ── File helpers ────────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files).filter(
        (f) => !attachments.some((a) => a.file.name === f.name && a.file.size === f.size)
      );
      if (!incoming.length) return;
      setAttachments((prev) => [...prev, ...incoming.map((file) => ({ file, uploading: false }))]);
    },
    [attachments]
  );

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFile = async (idx: number): Promise<string | null> => {
    const item = attachments[idx];
    setAttachments((prev) => prev.map((a, i) => (i === idx ? { ...a, uploading: true, error: undefined } : a)));
    const buffer = await item.file.arrayBuffer();
    const result = await uploadPendingFileToTW(item.file.name, buffer);
    if (result.success && result.ref) {
      setAttachments((prev) => prev.map((a, i) => (i === idx ? { ...a, uploading: false, ref: result.ref } : a)));
      return result.ref;
    }
    setAttachments((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, uploading: false, error: result.message ?? t('taskComment.uploadError') } : a
      )
    );
    return null;
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // ── Load people lazily when notify panel opens ───────────────────────────────
  const handleOpenNotify = async () => {
    setNotifyOpen((v) => !v);
    if (people.length === 0 && !loadingPeople) {
      setLoadingPeople(true);
      const result = await fetchTWPeopleForTask(twTaskId);
      if (result.success && result.people) setPeople(result.people);
      setLoadingPeople(false);
    }
  };

  const toggleNotify = (id: string) => {
    setNotifyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPeople = people.filter(
    (p) =>
      !peopleSearch ||
      p.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(peopleSearch.toLowerCase())
  );

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!body.trim() && attachments.length === 0) return;
    setSending(true);

    const refs: string[] = [];
    for (let i = 0; i < attachments.length; i++) {
      if (attachments[i].ref) {
        refs.push(attachments[i].ref!);
      } else {
        const ref = await uploadFile(i);
        if (ref) refs.push(ref);
      }
    }

    const notify = [...notifyIds].join(',');
    const result = await addCommentToTWTask(twTaskId, body.trim(), refs.join(','), notify);

    setSending(false);

    if (result.success) {
      toast.success(t('taskComment.success'));
      setBody('');
      setAttachments([]);
      setNotifyIds(new Set());
      setOpen(false);
    } else {
      toast.error(t('taskComment.error'), { description: result.message });
    }
  };

  // ── Reset on close ──────────────────────────────────────────────────────────
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setBody('');
      setAttachments([]);
      setDragOver(false);
      setNotifyIds(new Set());
      setTemplateOpen(false);
      setNotifyOpen(false);
      setPeopleSearch('');
      setPeople([]); // reset so next task fetches fresh project members
    }
    setOpen(val);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(true)}
              aria-label={t('taskComment.triggerTooltip')}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('taskComment.triggerTooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
              {t('taskComment.title')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground truncate">{taskName}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Template picker ──────────────────────────────────────── */}
            {templates.length > 0 && (
              <div className="relative" ref={templateRef}>
                <button
                  type="button"
                  onClick={() => setTemplateOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={sending}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {t('taskComment.useTemplate')}
                </button>
                {templateOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.templateId}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={() => {
                          setBody(tpl.body);
                          setTemplateOpen(false);
                        }}
                      >
                        <span className="font-medium">{tpl.title}</span>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tpl.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Comment textarea ─────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="comment-body">{t('taskComment.bodyLabel')}</Label>
              <textarea
                id="comment-body"
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={t('taskComment.bodyPlaceholder')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
              />
            </div>

            {/* ── Notify people picker ─────────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="relative" ref={notifyRef}>
                <button
                  type="button"
                  onClick={handleOpenNotify}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={sending}
                >
                  <Bell className="h-3.5 w-3.5" />
                  {notifyIds.size > 0
                    ? t('taskComment.notifyCount', { count: notifyIds.size })
                    : t('taskComment.notifyNone')}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {notifyOpen && (
                  <div className="absolute z-50 mt-1 w-72 rounded-md border bg-popover shadow-md">
                    <div className="p-2 border-b">
                      <input
                        type="text"
                        autoFocus
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={t('taskComment.notifySearch')}
                        value={peopleSearch}
                        onChange={(e) => setPeopleSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {loadingPeople ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredPeople.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">{t('taskComment.notifyEmpty')}</p>
                      ) : (
                        filteredPeople.map((person) => (
                          <label
                            key={person.id}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-primary"
                              checked={notifyIds.has(person.id)}
                              onChange={() => toggleNotify(person.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{person.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{person.email}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected people chips */}
              {notifyIds.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...notifyIds].map((id) => {
                    const person = people.find((p) => p.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {person?.name ?? id}
                        <button
                          type="button"
                          onClick={() => toggleNotify(id)}
                          className="hover:text-destructive transition-colors"
                          aria-label={t('taskComment.removeNotify')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Drop zone ────────────────────────────────────────────── */}
            <div
              className={`relative rounded-md border-2 border-dashed transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
                disabled={sending}
              />
              <div className="flex flex-col items-center justify-center py-5 gap-1.5 pointer-events-none select-none">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('taskComment.dropZoneHint')}</p>
                <p className="text-xs text-muted-foreground/70">{t('taskComment.dropZoneOr')}</p>
              </div>
            </div>

            {/* ── Attached files list ───────────────────────────────────── */}
            {attachments.length > 0 && (
              <ul className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <li
                    key={`${att.file.name}-${idx}`}
                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{att.file.name}</span>
                    {att.uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                    {att.error && <span className="text-xs text-destructive shrink-0">{att.error}</span>}
                    {att.ref && <span className="text-xs text-green-600 dark:text-green-400 shrink-0">✓</span>}
                    {!att.uploading && (
                      <button
                        type="button"
                        className="ml-auto shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(idx);
                        }}
                        aria-label={t('taskComment.removeFile')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSend} disabled={sending || (!body.trim() && attachments.length === 0)}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('taskComment.sending')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t('taskComment.sendBtn')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
