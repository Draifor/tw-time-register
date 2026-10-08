import { app } from 'electron';

// Keep the development build fully isolated from the installed production build.
//
// Both builds resolve `app.getName()` to the same productName ("TW Time
// Register"), so they would otherwise share %APPDATA%\TW Time Register. Two
// Chromium processes cannot share one userData directory: the second fails to
// lock the disk cache ("Unable to move the cache: Acceso denegado. 0x5") and the
// single-instance lock makes both builds fight over the same lock.
//
// Imported FIRST in `main/index.ts` so the new path is set before any other
// module reads `app.getPath('userData')` at load time — for example,
// `database/database.ts` computes `DB_PATH` on import.
if (!app.isPackaged) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}
