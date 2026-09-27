// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import useTasks from '../../renderer/hooks/useTasks';
import { fetchTasks, addTask } from '../../renderer/services/tasksService';
import type { Task } from '../../types/tasks';

vi.mock('../../renderer/services/tasksService', () => ({
  fetchTasks: vi.fn(),
  addTask: vi.fn(),
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

  it('appends the new task to every cached search variant and rolls them all back on error', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } }
    });

    // Two cache entries under the `['tasks']` prefix, mirroring two search variants.
    client.setQueryData(['tasks', ''], [makeTask(1, 'Alpha')]);
    client.setQueryData(['tasks', 'beta'], [makeTask(2, 'Beta')]);

    let rejectAdd: (reason?: unknown) => void = () => {};
    vi.mocked(addTask).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectAdd = reject;
        })
    );

    const { result } = renderHook(() => useTasks({ searchTerm: '' }), {
      wrapper: createWrapper(client)
    });

    act(() => {
      result.current.onSubmit({ taskName: 'New', typeName: 'RECA', taskLink: '', description: '' });
    });

    // The optimistic append is visible on the active variant...
    await waitFor(() => {
      const active = client.getQueryData<Task[]>(['tasks', '']) ?? [];
      expect(active.map((task) => task.taskName)).toEqual(['Alpha', 'New']);
    });

    // ...and on every other cached variant matched by the `['tasks']` prefix.
    const other = client.getQueryData<Task[]>(['tasks', 'beta']) ?? [];
    expect(other.map((task) => task.taskName)).toEqual(['Beta', 'New']);

    act(() => {
      rejectAdd(new Error('boom'));
    });

    // Rollback restores both variants to their previous values.
    await waitFor(() => {
      const active = client.getQueryData<Task[]>(['tasks', '']) ?? [];
      expect(active.map((task) => task.taskName)).toEqual(['Alpha']);
    });
    const restored = client.getQueryData<Task[]>(['tasks', 'beta']) ?? [];
    expect(restored.map((task) => task.taskName)).toEqual(['Beta']);
  });
});
