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
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
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
  fetchTWCommentsForTask: vi.fn().mockResolvedValue({ success: true, comments: [] }),
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
  fetchTWCommentsForTask,
  uploadPendingFileToTW,
  getCommentTemplates,
  type TWComment
} from '../../renderer/services/timesService';

const mockAddComment = vi.mocked(addCommentToTWTask);
const mockFetchPeople = vi.mocked(fetchTWPeopleForTask);
const mockFetchComments = vi.mocked(fetchTWCommentsForTask);
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

describe('TaskCommentDialog existing comments listing (TC-4)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetTemplates.mockReset();
    mockFetchPeople.mockReset();
    mockFetchComments.mockReset();
    mockAddComment.mockReset();
    mockUpload.mockReset();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockFetchComments.mockResolvedValue({ success: true, comments: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  type CommentsResult = Awaited<ReturnType<typeof fetchTWCommentsForTask>>;

  const sampleComment: TWComment = {
    id: 'c1',
    body: 'First comment body',
    authorName: 'Ada Lovelace',
    datetime: '2026-01-02T10:00:00.000Z',
    attachmentsCount: 0
  };

  it('shows the loading state while the comment fetch is pending', async () => {
    let resolveComments: (value: CommentsResult) => void = () => {};
    mockFetchComments.mockImplementationOnce(
      () =>
        new Promise<CommentsResult>((resolve) => {
          resolveComments = resolve;
        })
    );

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText(i18n.t('taskComment.commentsLoading'))).toBeInTheDocument();

    resolveComments({ success: true, comments: [] });

    await waitFor(() => expect(screen.queryByText(i18n.t('taskComment.commentsLoading'))).not.toBeInTheDocument());
  });

  it('shows the empty message when the task has no comments', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText(i18n.t('taskComment.commentsEmpty'))).toBeInTheDocument();
  });

  it('shows a load error and refetches when the retry button is clicked', async () => {
    mockFetchComments
      .mockResolvedValueOnce({ success: false, message: 'comments boom' })
      .mockResolvedValueOnce({ success: true, comments: [sampleComment] });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText('comments boom')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('common.retry') }));

    await waitFor(() => expect(mockFetchComments).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('First comment body')).toBeInTheDocument();
  });

  it('renders the author and body of each existing comment', async () => {
    mockFetchComments.mockResolvedValue({
      success: true,
      comments: [
        sampleComment,
        {
          id: 'c2',
          body: 'Second comment body',
          authorName: 'Alan Turing',
          datetime: '',
          attachmentsCount: 2
        }
      ]
    });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('First comment body')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(screen.getByText('Second comment body')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('taskComment.attachmentsCount', { count: 2 }))).toBeInTheDocument();
  });

  it('refetches the comment list after a successful send', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await waitFor(() => expect(mockFetchComments).toHaveBeenCalledTimes(1));

    await user.type(bodyInput(), 'Brand new comment');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockFetchComments).toHaveBeenCalledTimes(2));
  });
});

describe('TaskCommentDialog add/send flow (TC-5)', () => {
  beforeEach(async () => {
    mockGetTemplates.mockReset();
    mockFetchPeople.mockReset();
    mockFetchComments.mockReset();
    mockAddComment.mockReset();
    mockUpload.mockReset();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockFetchComments.mockResolvedValue({ success: true, comments: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  it('sends a body-only comment and closes the dialog on success', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(bodyInput(), 'Hello TeamWork');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('12345', 'Hello TeamWork', '', ''));
    expect(toastMock.success).toHaveBeenCalledWith(i18n.t('taskComment.success'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('uploads a single attachment and sends its ref', async () => {
    mockUpload.mockResolvedValue({ success: true, ref: 'ref-9' });
    const user = userEvent.setup();
    await openDialog(user);

    await attachFile(user, 'notes.txt');
    await user.type(bodyInput(), 'With attachment');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('12345', 'With attachment', 'ref-9', ''));
    expect(toastMock.success).toHaveBeenCalledWith(i18n.t('taskComment.success'));
  });

  it('joins multiple attachment refs in attachment order', async () => {
    mockUpload
      .mockResolvedValueOnce({ success: true, ref: 'ref-1' })
      .mockResolvedValueOnce({ success: true, ref: 'ref-2' });
    const user = userEvent.setup();
    await openDialog(user);

    await attachFile(user, 'a.txt');
    await attachFile(user, 'b.txt');
    await user.type(bodyInput(), 'Two files');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('12345', 'Two files', 'ref-1,ref-2', ''));
  });

  it('keeps the dialog open and preserves the body when the server rejects', async () => {
    mockAddComment.mockResolvedValue({ success: false, message: 'server boom' });
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(bodyInput(), 'Will fail');
    await user.click(sendButton());

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.error'), { description: 'server boom' })
    );
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(bodyInput()).toHaveValue('Will fail');
  });

  it('sends the selected notify ids as a comma-joined list', async () => {
    mockFetchPeople.mockResolvedValue({
      success: true,
      people: [
        { id: 'p1', name: 'Ada Lovelace', email: 'ada@test.com' },
        { id: 'p2', name: 'Alan Turing', email: 'alan@test.com' }
      ]
    });
    const user = userEvent.setup();
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.notifyNone') }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Ada Lovelace/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Alan Turing/ }));
    await user.keyboard('{Escape}');

    await user.type(bodyInput(), 'Notify ping');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('12345', 'Notify ping', '', 'p1,p2'));
  });

  it('applies a chosen template body to the textarea', async () => {
    mockGetTemplates.mockResolvedValue([
      { templateId: 1, title: 'Greeting', body: 'Hello there', createdAt: '2026-01-01T00:00:00.000Z' }
    ]);
    const user = userEvent.setup();
    await openDialog(user);

    await user.click(await screen.findByRole('button', { name: i18n.t('taskComment.useTemplate') }));
    await user.click(await screen.findByRole('menuitem', { name: /Greeting/ }));

    await waitFor(() => expect(bodyInput()).toHaveValue('Hello there'));
  });

  it('dedupes same-name/same-size attachments and omits a removed attachment from the refs', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    // First attach through the helper, then re-upload the same name+size.
    await attachFile(user, 'dup.txt');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['hello'], 'dup.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getAllByText('dup.txt')).toHaveLength(1));

    // Removing the only attachment must leave it out of the send.
    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.removeFile') }));
    expect(screen.queryByText('dup.txt')).not.toBeInTheDocument();

    await user.type(bodyInput(), 'No attachments now');
    await user.click(sendButton());

    await waitFor(() => expect(mockAddComment).toHaveBeenCalledWith('12345', 'No attachments now', '', ''));
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('TaskCommentDialog listing pagination (TC-6)', () => {
  beforeEach(async () => {
    mockGetTemplates.mockReset();
    mockFetchPeople.mockReset();
    mockFetchComments.mockReset();
    mockAddComment.mockReset();
    mockUpload.mockReset();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  const COMMENTS_PAGE_SIZE = 50;

  const makeComment = (n: number): TWComment => ({
    id: `c${n}`,
    body: `Comment body ${n}`,
    authorName: `Author ${n}`,
    datetime: '',
    attachmentsCount: 0
  });

  it('shows the counter and load-more button, then appends the next page', async () => {
    const page1 = Array.from({ length: COMMENTS_PAGE_SIZE }, (_, i) => makeComment(i + 1));
    const page2 = Array.from({ length: 10 }, (_, i) => makeComment(i + 51));
    mockFetchComments.mockImplementation(async (_twTaskId, page) =>
      page === 2 ? { success: true, comments: page2, total: 60 } : { success: true, comments: page1, total: 60 }
    );

    const user = userEvent.setup();
    await openDialog(user);

    expect(
      await screen.findByText(i18n.t('taskComment.commentsShowingTotal', { loaded: COMMENTS_PAGE_SIZE, total: 60 }))
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.commentsLoadMore') }));

    await waitFor(() => expect(mockFetchComments).toHaveBeenCalledWith('12345', 2, COMMENTS_PAGE_SIZE));
    expect(await screen.findByText('Comment body 60')).toBeInTheDocument();
    expect(screen.getByText('Comment body 1')).toBeInTheDocument();

    // The final page is reached: the load-more button disappears.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: i18n.t('taskComment.commentsLoadMore') })).not.toBeInTheDocument()
    );
  });

  it('renders no load-more button when the last page is partial and total is unknown', async () => {
    mockFetchComments.mockResolvedValue({ success: true, comments: [makeComment(1), makeComment(2)] });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText('Comment body 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('taskComment.commentsLoadMore') })).not.toBeInTheDocument();
  });

  it('renders two comments with empty ids without a React duplicate-key error (R3-4)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchComments.mockResolvedValue({
      success: true,
      comments: [
        { id: '', body: 'First empty id', authorName: 'A', datetime: '', attachmentsCount: 0 },
        { id: '', body: 'Second empty id', authorName: 'B', datetime: '', attachmentsCount: 0 }
      ]
    });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText('First empty id')).toBeInTheDocument();
    expect(screen.getByText('Second empty id')).toBeInTheDocument();

    const keyWarnings = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === 'string' && /same key|duplicate key/i.test(arg))
    );
    expect(keyWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });
});

describe('TaskCommentDialog listing follow-up (TC-6 advisories)', () => {
  beforeEach(async () => {
    mockGetTemplates.mockReset();
    mockFetchPeople.mockReset();
    mockFetchComments.mockReset();
    mockAddComment.mockReset();
    mockUpload.mockReset();
    mockGetTemplates.mockResolvedValue([]);
    mockFetchPeople.mockResolvedValue({ success: true, people: [] });
    mockFetchComments.mockResolvedValue({ success: true, comments: [] });
    mockAddComment.mockResolvedValue({ success: true });
    mockUpload.mockResolvedValue({ success: false });
    await i18n.changeLanguage('en');
  });
  afterEach(() => cleanup());

  type CommentsResult = Awaited<ReturnType<typeof fetchTWCommentsForTask>>;

  const COMMENTS_PAGE_SIZE = 50;

  const makeComment = (n: number): TWComment => ({
    id: `c${n}`,
    body: `Comment body ${n}`,
    authorName: `Author ${n}`,
    datetime: '',
    attachmentsCount: 0
  });

  /** Flush pending microtasks so a deferred fetch continuation can run. */
  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  const loadMoreButton = () => screen.queryByRole('button', { name: i18n.t('taskComment.commentsLoadMore') });

  it('keeps the list and re-enables Load more when an append page resolves { success: false }', async () => {
    const page1 = Array.from({ length: COMMENTS_PAGE_SIZE }, (_, i) => makeComment(i + 1));
    mockFetchComments.mockImplementation(async (_twTaskId, page) =>
      page === 2 ? { success: false } : { success: true, comments: page1, total: 60 }
    );

    const user = userEvent.setup();
    await openDialog(user);

    // Page 1 loaded, so the load-more affordance is visible.
    expect(await screen.findByText('Comment body 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.commentsLoadMore') }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.commentsLoadError')));
    // The page-1 list survives the failed append.
    expect(screen.getByText('Comment body 1')).toBeInTheDocument();
    // The retryable button stays present and is not stuck in its loading state.
    expect(loadMoreButton()).toBeInTheDocument();
    expect(loadMoreButton()).toBeEnabled();
  });

  it('keeps the list and re-enables Load more when an append page rejects', async () => {
    const page1 = Array.from({ length: COMMENTS_PAGE_SIZE }, (_, i) => makeComment(i + 1));
    mockFetchComments.mockImplementation(async (_twTaskId, page) => {
      if (page === 2) throw new Error('append boom');
      return { success: true, comments: page1, total: 60 };
    });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText('Comment body 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.commentsLoadMore') }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(i18n.t('taskComment.commentsLoadError')));
    expect(screen.getByText('Comment body 1')).toBeInTheDocument();
    expect(loadMoreButton()).toBeInTheDocument();
    expect(loadMoreButton()).toBeEnabled();
  });

  it('ignores a stale replace response that resolves after a newer list (TF-1 guard)', async () => {
    let resolveFirst: (value: CommentsResult) => void = () => {};
    mockFetchComments.mockImplementationOnce(
      () =>
        new Promise<CommentsResult>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const freshComment = makeComment(100);
    const staleComment: TWComment = {
      id: 'c200',
      body: 'Stale comment body',
      authorName: 'Stale Author',
      datetime: '',
      attachmentsCount: 0
    };
    // Any call after the deferred first one resolves with the fresh comment.
    mockFetchComments.mockResolvedValue({ success: true, comments: [freshComment] });

    const user = userEvent.setup();
    await openDialog(user);

    // The first (deferred) fetch is still pending: the loading state is showing.
    expect(await screen.findByText(i18n.t('taskComment.commentsLoading'))).toBeInTheDocument();

    // Close the dialog while that fetch is still in flight.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Reopen: the second fetch resolves with the fresh comment.
    await user.click(screen.getByRole('button', { name: i18n.t('taskComment.triggerTooltip') }));
    expect(await screen.findByText(freshComment.body)).toBeInTheDocument();

    // Now the stale first fetch settles late with a different comment. Wrap the
    // settle in `act` so React flushes any (incorrect) state update before we assert.
    await act(async () => {
      resolveFirst({ success: true, comments: [staleComment] });
      await flushMicrotasks();
    });

    // The stale response must never overwrite the newer list.
    expect(screen.getByText(freshComment.body)).toBeInTheDocument();
    expect(screen.queryByText(staleComment.body)).not.toBeInTheDocument();
  });

  it('renders the localized load error (not the English literal) when the result carries a stable code', async () => {
    await i18n.changeLanguage('es');
    mockFetchComments.mockResolvedValueOnce({
      success: false,
      code: 'unexpected_response',
      message: 'Unexpected response from TeamWork'
    });

    const user = userEvent.setup();
    await openDialog(user);

    expect(await screen.findByText(i18n.t('taskComment.commentsLoadError'))).toBeInTheDocument();
    expect(screen.queryByText('Unexpected response from TeamWork')).not.toBeInTheDocument();
  });
});
