// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { addTimeEntries } from '../../renderer/services/timesService';
import { saveWorkTimeEntries, toTimeEntryInputs } from '../../renderer/components/WorkTimeForm';
import { queryKeys } from '../../renderer/lib/queryKeys';

vi.mock('../../renderer/services/timesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../renderer/services/timesService')>();
  return { ...actual, addTimeEntries: vi.fn() };
});

type WorkTimeFormEntry = Parameters<typeof toTimeEntryInputs>[0][number];

function makeEntry(overrides: Partial<WorkTimeFormEntry> = {}): WorkTimeFormEntry {
  return {
    date: '2026-09-24',
    description: 'work',
    endTime: [new Date('1970-01-01T10:00:00')],
    hours: [new Date('1970-01-01T01:00:00')],
    startTime: [new Date('1970-01-01T09:00:00')],
    task: '42',
    isBillable: true,
    afterLunch: false,
    manualStartTime: false,
    ...overrides
  };
}

describe('WorkTimeForm batch save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps form entries to the IPC payload shape', () => {
    const [input] = toTimeEntryInputs([makeEntry({ task: { value: '7', label: 'Seven' } })]);

    expect(input).toEqual({
      taskId: 7,
      description: 'work',
      date: '2026-09-24',
      startTime: '09:00',
      endTime: '10:00',
      isBillable: true
    });
  });

  it('saves every entry through the batch endpoint and invalidates the affected caches', async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    vi.mocked(addTimeEntries).mockResolvedValue([101, 102]);

    await saveWorkTimeEntries([makeEntry(), makeEntry({ task: '7' })], client);

    // One IPC round-trip for all entries instead of one per entry.
    expect(addTimeEntries).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addTimeEntries).mock.calls[0][0]).toHaveLength(2);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workTimes.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
  });
});
