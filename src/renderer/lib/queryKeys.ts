/**
 * Canonical React Query cache keys.
 *
 * Centralizing the keys keeps every query, invalidation and optimistic update
 * pointed at the same cache identity. The string values are the existing ones
 * on purpose: changing them would invalidate the current runtime cache.
 */
export const queryKeys = {
  tasks: {
    /** Prefix key: matches every `tasks.list(searchTerm)` variant (TanStack prefix matching). */
    all: ['tasks'] as const,
    /** Exact key used by each task-list query, one entry per search term. */
    list: (searchTerm: string) => ['tasks', searchTerm] as const
  },
  typeTasks: {
    all: ['typeTasks'] as const
  },
  workTimes: {
    all: ['workTimes'] as const
  }
} as const;
