// @vitest-environment jsdom
/**
 * UX-507 (Fase 5) cover: table header semantics + keyboard-operable CSV dropzone.
 *
 * Two contracts are pinned here:
 *   - Table header scope: the shared `TableHead` must default every column header
 *     to `scope="col"` while still honouring an explicit override; the plain
 *     `<th>` headers in `ImportCSVTasksDialog`, `ReportsPage` and `TimeLogsTable`
 *     must also declare their scope so tables expose header association.
 *   - CSV dropzone: the dashed area in `ImportCSVTasksDialog` must be an operable
 *     `role="button"` reachable by Tab that opens the hidden file picker on
 *     Enter/Space, and must route a dropped file through the same parse path as
 *     the `<input onChange>`.
 *
 * Radix dialog needs a few jsdom shims (ResizeObserver, pointer capture) to mount
 * and open in the test environment.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, fireEvent, waitFor, cleanup, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../renderer/plugins/i18n';

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

// The real chunked parser yields to the event loop, which makes the drop test
// non-deterministic. Mock it so we can assert the shared file path reaches it.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));
vi.mock('../../renderer/lib/csvTasks', () => ({
  parseTasksCsvChunked: parseMock
}));

vi.mock('../../renderer/services/tasksService', () => ({
  importTasksFromCSV: vi.fn()
}));

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../renderer/components/ui/table';
import ImportCSVTasksDialog from '../../renderer/components/ImportCSVTasksDialog';

describe('TableHead scope (UX-507)', () => {
  beforeEach(() => cleanup());

  it('defaults every column header to scope="col"', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>a</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('lets callers override the default scope', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="row">Row label</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    expect(screen.getByText('Row label')).toHaveAttribute('scope', 'row');
  });
});

describe('plain table headers declare scope (UX-507)', () => {
  const PLAIN_TH_FILES = [
    ['components', 'ImportCSVTasksDialog.tsx'],
    ['pages', 'ReportsPage.tsx'],
    ['components', 'TimeLogsTable.tsx']
  ] as const;

  for (const [dir, file] of PLAIN_TH_FILES) {
    it(`${file} has no <th> without scope`, () => {
      const source = readFileSync(join(process.cwd(), 'src', 'renderer', dir, file), 'utf8');
      const tags = source.match(/<th\b[^>]*>/g) ?? [];
      expect(tags.length).toBeGreaterThan(0);
      const bare = tags.filter((tag) => !/\bscope=/.test(tag));
      expect(bare, `bare <th> in ${file}`).toEqual([]);
    });
  }
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ImportCSVTasksDialog />
    </QueryClientProvider>
  );
}

async function openDialog() {
  const view = renderDialog();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('tasks.importCSV.trigger') }));
  await screen.findByRole('dialog');
  return view;
}

describe('ImportCSVTasksDialog dropzone (UX-507)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => vi.restoreAllMocks());

  it('exposes the dropzone as a focusable button with an accessible name', async () => {
    await openDialog();

    const dropzone = screen.getByRole('button', { name: i18n.t('tasks.importCSV.dropzoneAria') });
    expect(dropzone).toHaveAttribute('tabindex', '0');
  });

  it('opens the file picker on Enter and Space', async () => {
    await openDialog();

    const dropzone = screen.getByRole('button', { name: i18n.t('tasks.importCSV.dropzoneAria') });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropzone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('opens the file picker on click', async () => {
    await openDialog();

    const dropzone = screen.getByRole('button', { name: i18n.t('tasks.importCSV.dropzoneAria') });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('parses a dropped file through the same handler as the file input', async () => {
    await openDialog();

    const dropzone = screen.getByRole('button', { name: i18n.t('tasks.importCSV.dropzoneAria') });
    parseMock.mockResolvedValue({
      rows: [{ taskName: 'Dropped', typeName: 'Type', taskLink: 'https://x' }],
      malformed: [],
      error: null
    });

    const file = new File(['TareaTW,Tipo,Link\nDropped,Type,https://x'], 'dropped.csv', {
      type: 'text/csv'
    });

    // Drag over must be cancelled so the browser delivers the drop.
    expect(fireEvent.dragOver(dropzone)).toBe(false);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(parseMock).toHaveBeenCalledTimes(1));
    expect(parseMock.mock.calls[0][0]).toContain('Dropped');

    // The preview step mounts from the dropped file, proving the shared path ran.
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText(/rows parsed/i);
    for (const header of within(dialog).getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });
});
