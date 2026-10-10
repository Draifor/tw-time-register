// @vitest-environment jsdom
/**
 * TC-2 cover: harden the "add comment to a TW task" dialog.
 *
 * Three medium defects are pinned here:
 *   1. Require a non-empty body — even with attachments, an empty body must keep
 *      the send button disabled and block `handleSend`.
 *   2. Fail closed on attachment upload failure — a failed upload must abort the
 *      send (`addCommentToTWTask` never called) and surface a visible error.
 *   3. Notify-people load failure — a failed `fetchTWPeopleForTask` must render a
 *      distinct error state, not the empty-list message, and re-opening retries.
 *
 * Radix dialog/dropdown needs the usual jsdom shims (ResizeObserver, pointer
 * capture). Toasts are captured with a mocked `sonner` (no <Toaster /> mounted),
 * matching deleteConfirm.test.tsx.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
}));
vi.mock('sonner', () => ({ toast: toastMock, Toaster: () => null }));

vi.mock('../../renderer/services/timesService', () => ({
  getCommentTemplates: vi.fn().mockResolvedValue([]),
  fetchTWPeopleForTask: vi.fn().mockResolvedValue({ success: true, people: [] }),
  addCommentToTWTask: vi.fn().mockResolvedValue({ success: true }),
  uploadPendingFileToTW: vi.fn().mockResolvedValue({ success: false })
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {}
});

import TaskCommentDialog from '../../renderer/components/TaskCommentDialog';
import {
  addCommentToTWTask,
  fetchTWPeopleForTask,
  uploadPendingFileToTW,
  getCommentTemplates
} from '../../renderer/services/timesService';

const mockAddComment = vi.mocked(addCommentToTWTask);
const mockFetchPeople = vi.mocked(fetchTWPeopleForTask);
const mockUpload = vi.mocked(uploadPendingFileToTW);
const mockGetTemplates = vi.mocked(getCommentTemplates);

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  const view = renderWithClient(<TaskCommentDialog twTaskId="12345" taskName="Alpha" />);
  await user.click(screen.getByRole('button', { name: i18n.t('taskComment.triggerTooltip') }));
  await screen.findByRole('dialog');
  return view;
}

async function attachFile(user: ReturnType<typeof userEvent.setup>, name = 'notes.txt') {
  // Radix portals DialogContent to document.body, so query the document.
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(fileInput, 'file input not found').not.toBeNull();
  await user.upload(fileInput as HTMLInputElement, new File(['hello'], name, { type: 'text/plain' }));
  await screen.findByText(name);
}

const sendButton = () => screen.getByRole('button', { name: i18n.t('taskComment.sendBtn') });
const bodyInput = () => screen.getByLabelText(i18n.t('taskComment.bodyLabel'));

describe('TaskCommentDialog hardening (TC-2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  it('keeps send disabled while the body is empty even with an attachment present', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await attachFile(user);

    // Empty body + attachment: still blocked.
    expect(sendButton()).toBeDisabled();

    // Whitespace-only body is not a body either.
    await user.type(bodyInput(), '   ');
    expect(sendButton()).toBeDisabled();

    // A real body enables sending.
    await user.type(bodyInput(), 'A real comment');
    expect(sendButton()).toBeEnabled();

    // Clearing the body blocks sending again.
    await user.clear(bodyInput());
    expect(sendButton()).toBeDisabled();
  });

  it('aborts the send when an attachment upload fails, surfacing an error', async () => {
    mockUpload.mockResolvedValue({ success: false, message: 'upload boom' });
    const user = userEvent.setup();
    await openDialog(user);

    await attachFile(user);
    await user.type(bodyInput(), 'Comment with a broken attachment');

    await user.click(sendButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.attachmentFailed')));
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    // Dialog stays open with its state intact.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(bodyInput()).toHaveValue('Comment with a broken attachment');
  });

  it('shows a distinct notify error state (not the empty-list message) and retries on reopen', async () => {
    mockFetchPeople.mockResolvedValue({ success: false, message: 'people boom' });
    const user = userEvent.setup();
    await openDialog(user);

    const notifyTrigger = () => screen.getByRole('button', { name: i18n.t('taskComment.notifyNone') });

    await user.click(notifyTrigger());

    expect(await screen.findByText('people boom')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('taskComment.notifyEmpty'))).not.toBeInTheDocument();
    expect(mockFetchPeople).toHaveBeenCalledTimes(1);

    // Re-opening the dropdown re-attempts the fetch. Radix hides the trigger from
    // the a11y tree while the menu is open, so close it first.
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: i18n.t('taskComment.notifyNone') })).toBeInTheDocument()
    );
    await user.click(notifyTrigger());
    await waitFor(() => expect(mockFetchPeople).toHaveBeenCalledTimes(2));
  });
});

describe('TaskCommentDialog hardening (TC-3)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  it('rejects an oversized attachment without adding it and toasts the limit', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput, 'file input not found').not.toBeNull();

    const oversized = new File(['x'], 'huge.bin', { type: 'application/octet-stream' });
    // Override size cheaply instead of allocating a real 26 MB buffer.
    Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });

    await user.upload(fileInput as HTMLInputElement, oversized);

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.attachTooLarge', { max: '25 MB' }))
    );
    expect(screen.queryByText('huge.bin')).not.toBeInTheDocument();
  });

  it('auto-retries a previously failed attachment on the next send', async () => {
    mockUpload
      .mockResolvedValueOnce({ success: false, message: 'transient failure' })
      .mockResolvedValueOnce({ success: true, ref: 'ref-1' });

    const user = userEvent.setup();
    await openDialog(user);

    await attachFile(user, 'report.txt');
    await user.type(bodyInput(), 'Retry me');

    // First send: the upload fails, the send aborts, the dialog stays open.
    await user.click(sendButton());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.attachmentFailed')));
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Second send: the failed attachment auto-retries and succeeds.
    await user.click(sendButton());
    await waitFor(() => expect(mockAddComment).toHaveBeenCalledTimes(1));
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockAddComment).toHaveBeenCalledWith('12345', 'Retry me', 'ref-1', '');
  });

  it('shows a template load error and retries via the retry button', async () => {
    mockGetTemplates
      .mockRejectedValueOnce(new Error('templates boom'))
      .mockResolvedValueOnce([
        { templateId: 1, title: 'Greeting', body: 'Hello there', createdAt: '2026-01-01T00:00:00.000Z' }
      ]);

    const user = userEvent.setup();
    await openDialog(user);

    // The failure surfaces as an error state instead of silently disappearing.
    expect(await screen.findByText(i18n.t('taskComment.templatesLoadError'))).toBeInTheDocument();

    // The retry button re-invokes the service.
    await user.click(screen.getByRole('button', { name: i18n.t('common.retry') }));
    await waitFor(() => expect(mockGetTemplates).toHaveBeenCalledTimes(2));

    // A successful retry restores the dropdown.
    expect(await screen.findByText(i18n.t('taskComment.useTemplate'))).toBeInTheDocument();
  });

  it('shows the notify error state (not the empty-list message) when the request rejects', async () => {
    mockFetchPeople.mockRejectedValueOnce(new Error('network down'));

    const user = userEvent.setup();
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.notifyNone') }));

    expect(await screen.findByText(i18n.t('taskComment.notifyLoadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('taskComment.notifyEmpty'))).not.toBeInTheDocument();
  });

  it('accepts a file exactly at the 25 MB limit', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput, 'file input not found').not.toBeNull();

    const atLimit = new File(['x'], 'at-limit.bin', { type: 'application/octet-stream' });
    Object.defineProperty(atLimit, 'size', { value: 25 * 1024 * 1024 });

    await user.upload(fileInput as HTMLInputElement, atLimit);

    expect(await screen.findByText('at-limit.bin')).toBeInTheDocument();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('falls back to the notify error when the message is present but blank', async () => {
    mockFetchPeople.mockResolvedValueOnce({ success: false, message: '   ' });
    const user = userEvent.setup();
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.notifyNone') }));

    expect(await screen.findByText(i18n.t('taskComment.notifyLoadError'))).toBeInTheDocument();
  });
});
