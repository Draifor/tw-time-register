import fs from 'fs';

/**
 * Pure, electron-free helper around the "pending update" marker file.
 *
 * The main process writes the marker immediately before `quitAndInstall`, then
 * consumes (reads + deletes) it on the next start to confirm the new version.
 * This module deliberately imports no `electron`, so it is unit-testable
 * without any mocking.
 */
export interface UpdateMarker {
  /** Best-effort write of the target version; never throws. */
  write(targetVersion: string): void;
  /**
   * Reads and ALWAYS deletes the marker. Returns `currentVersion` only when the
   * stored `targetVersion` matches it; otherwise returns `null`. Missing file,
   * malformed JSON, or any other error also returns `null`. Never throws.
   */
  consume(currentVersion: string): string | null;
}

export function createUpdateMarker(filePath: string): UpdateMarker {
  return {
    write(targetVersion: string): void {
      try {
        fs.writeFileSync(filePath, JSON.stringify({ targetVersion, requestedAt: new Date().toISOString() }));
      } catch (err) {
        // Constraint: a marker failure must never block or crash the update.
        console.error('Failed to write update marker:', err);
      }
    },

    consume(currentVersion: string): string | null {
      let raw: string | null;
      try {
        raw = fs.readFileSync(filePath, 'utf-8');
      } catch {
        raw = null;
      }

      // One-shot confirmation (D3): remove the marker regardless of outcome.
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Missing file or permission issue: best-effort only.
      }

      if (raw === null) return null;

      try {
        const parsed = JSON.parse(raw) as { targetVersion?: string };
        return parsed.targetVersion === currentVersion ? currentVersion : null;
      } catch {
        return null;
      }
    }
  };
}
