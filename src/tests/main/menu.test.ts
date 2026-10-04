/**
 * UX-102: the native application menu is built as a pure template so it can be
 * asserted without Electron at runtime. Traverse submenus instead of assuming a
 * flat array, since roles can nest.
 */
import { describe, it, expect } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildApplicationMenuTemplate } from '../../main/menu';

function collectRoles(template: MenuItemConstructorOptions[]): string[] {
  const roles: string[] = [];
  const visit = (items: MenuItemConstructorOptions[]) => {
    for (const item of items) {
      if (typeof item.role === 'string') roles.push(item.role);
      if (item.submenu && Array.isArray(item.submenu)) {
        visit(item.submenu);
      }
    }
  };
  visit(template);
  return roles;
}

describe('buildApplicationMenuTemplate (UX-102)', () => {
  it('always includes editMenu and windowMenu', () => {
    const roles = collectRoles(buildApplicationMenuTemplate(false, false));

    expect(roles).toContain('editMenu');
    expect(roles).toContain('windowMenu');
  });

  it('includes appMenu only on macOS', () => {
    expect(collectRoles(buildApplicationMenuTemplate(true, false))).toContain('appMenu');
    expect(collectRoles(buildApplicationMenuTemplate(false, false))).not.toContain('appMenu');
  });

  it('excludes reload/forceReload/toggleDevTools in production', () => {
    const roles = collectRoles(buildApplicationMenuTemplate(false, false));

    expect(roles).not.toContain('reload');
    expect(roles).not.toContain('forceReload');
    expect(roles).not.toContain('toggleDevTools');
  });

  it('includes reload/forceReload/toggleDevTools in development', () => {
    const roles = collectRoles(buildApplicationMenuTemplate(false, true));

    expect(roles).toContain('reload');
    expect(roles).toContain('forceReload');
    expect(roles).toContain('toggleDevTools');
  });

  it('always includes the zoom and fullscreen roles', () => {
    for (const isDev of [false, true]) {
      const roles = collectRoles(buildApplicationMenuTemplate(false, isDev));

      expect(roles).toEqual(expect.arrayContaining(['resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']));
    }
  });
});
