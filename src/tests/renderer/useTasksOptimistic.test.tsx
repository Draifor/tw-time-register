// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import useTasks from '../../renderer/hooks/useTasks';
import { fetchTasks, editTask } from '../../renderer/services/tasksService';
import type { Task } from '../../types/tasks';

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn(),
  editTask: vi.fn(),
  deleteTask: vi.fn()
}));

vi.mock('../../renderer/services/typeTasksService', () => ({
  default: vi.fn().mockResolvedValue([]),
  addTypeTask: vi.fn(),
  updateTypeTask: vi.fn(),
  deleteTypeTask: vi.fn()
}));

const makeTask = (id: number, taskName: string): Task => ({
  id,
  typeName: 'RECA',
  taskName,
  taskLink: '',
  description: ''
});

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useTasks optimistic update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Server truth used by the invalidation refetch that runs after the mutation settles.
    vi.mocked(fetchTasks).mockImplementation((search?: string) =>
      Promise.resolve(search === 'beta' ? [makeTask(2, 'Beta')] : [makeTask(1, 'Alpha')])
    );
  });

  it('applies an edited task to the cache before the save settles and rolls it back on error', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } }
    });

    client.setQueryData(['tasks', ''], [makeTask(1, 'Alpha')]);

    let rejectEdit: (reason?: unknown) => void = () => {};
    vi.mocked(editTask).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectEdit = reject;
        })
    );

    const { result } = renderHook(() => useTasks({ searchTerm: '' }), {
      wrapper: createWrapper(client)
    });

    act(() => {
      result.current.onEdit({ ...makeTask(1, 'Alpha'), taskLink: 'https://tw/tasks/1' });
    });

    // The optimistic edit is visible on the cached list before settle, and the
    // task is replaced in place rather than appended.
    await waitFor(() => {
      const cached = client.getQueryData<Task[]>(['tasks', '']) ?? [];
      expect(cached).toHaveLength(1);
      expect(cached[0].taskLink).toBe('https://tw/tasks/1');
    });

    // Freeze the post-settle refetch so the rollback — not a refetch — has to
    // restore the previous value.
    vi.mocked(fetchTasks).mockImplementation(() => new Promise<Task[]>(() => {}));

    act(() => {
      rejectEdit(new Error('boom'));
    });

    // Rollback restores the previous task value.
    await waitFor(() => {
      const cached = client.getQueryData<Task[]>(['tasks', '']) ?? [];
      expect(cached).toHaveLength(1);
      expect(cached[0].taskLink).toBe('');
    });
  });
});
