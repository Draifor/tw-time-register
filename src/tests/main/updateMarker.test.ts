import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createUpdateMarker } from '../../main/updateMarker';

// `updateMarker` is a pure module (no `electron` import), so these tests run in
// the default node environment against a real temp file.
describe('createUpdateMarker', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-marker-'));
    filePath = path.join(dir, 'pending-update.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes then consumes the matching version and deletes the file', () => {
    const marker = createUpdateMarker(filePath);

    marker.write('1.13.0');
    expect(fs.existsSync(filePath)).toBe(true);

    expect(marker.consume('1.13.0')).toBe('1.13.0');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('returns null for a mismatched version and still deletes the marker', () => {
    const marker = createUpdateMarker(filePath);

    marker.write('1.13.0');

    expect(marker.consume('1.12.0')).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('returns null when the marker file is missing', () => {
    const marker = createUpdateMarker(filePath);

    expect(marker.consume('1.13.0')).toBeNull();
  });

  it('returns null for malformed JSON and still deletes the marker', () => {
    fs.writeFileSync(filePath, '{ not valid json');

    const marker = createUpdateMarker(filePath);

    expect(marker.consume('1.13.0')).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('write never throws on an invalid path', () => {
    const marker = createUpdateMarker(path.join(dir, 'missing-dir', 'nested', 'pending-update.json'));

    expect(() => marker.write('1.13.0')).not.toThrow();
  });
});
