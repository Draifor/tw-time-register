import { describe, it, expect } from 'vitest';
import { extractTwTaskId } from '../../../main/database/models/TaskLinks';

describe('extractTwTaskId', () => {
  it('extracts the numeric ID from a standard TeamWork task URL', () => {
    expect(extractTwTaskId('https://acme.teamwork.com/app/tasks/12345')).toBe('12345');
  });

  it('extracts from a URL with a longer path after the ID', () => {
    expect(extractTwTaskId('https://mycompany.teamwork.com/app/tasks/99/subtasks')).toBe('99');
  });

  it('returns null for a URL that has no /tasks/ segment', () => {
    expect(extractTwTaskId('https://acme.teamwork.com/projects/123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractTwTaskId('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractTwTaskId(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(extractTwTaskId(undefined)).toBeNull();
  });

  it('handles a URL with only /tasks/ but no digits', () => {
    expect(extractTwTaskId('https://acme.teamwork.com/app/tasks/abc')).toBeNull();
  });
});
