import type { MenuItemConstructorOptions } from 'electron';

/**
 * Builds the explicit, minimal native application menu (UX-102).
 *
 * Kept as a pure function of the platform/dev flags so it can be unit-tested
 * without Electron at runtime — the electron import above is type-only, so it
 * is erased from the emitted module.
 *
 * Electron's role labels are English; on purpose we do not attempt native-menu
 * i18n here.
 */
export function buildApplicationMenuTemplate(isMac: boolean, isDev: boolean): MenuItemConstructorOptions[] {
  const devViewItems: MenuItemConstructorOptions[] = isDev
    ? [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }]
    : [];

  const template: MenuItemConstructorOptions[] = [];

  // macOS requires an application menu; on Windows/Linux it does not exist.
  if (isMac) {
    template.push({ role: 'appMenu' });
  }

  template.push(
    // Edit roles (undo/redo/cut/copy/paste/select all) are required for text
    // inputs, so they are always present.
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...devViewItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  );

  return template;
}
