import { describe, it, expect, vi, beforeEach } from 'vitest';

// `vi.hoisted` keeps the mutable app mock available to the hoisted `vi.mock`
// factory. `isPackaged` is flipped per test to load the module in both modes.
const { appMock, setPathMock, getPathMock } = vi.hoisted(() => {
  const setPathMock = vi.fn();
  const getPathMock = vi.fn(() => 'C:\\AppData\\Roaming\\TW Time Register');
  return {
    setPathMock,
    getPathMock,
    appMock: { isPackaged: false, setPath: setPathMock, getPath: getPathMock }
  };
});

vi.mock('electron', () => ({ app: appMock }));

// The module under test is a side-effect bootstrap: its work happens at import
// time, so each case resets the registry and re-imports with the desired
// `isPackaged` value already in place.
async function loadDevUserData(isPackaged: boolean) {
  appMock.isPackaged = isPackaged;
  vi.resetModules();
  await import('../../main/devUserData');
}

describe('devUserData isolation', () => {
  beforeEach(() => {
    setPathMock.mockClear();
    getPathMock.mockClear();
  });

  it('points the dev build at a separate userData directory', async () => {
    await loadDevUserData(false);

    expect(getPathMock).toHaveBeenCalledWith('userData');
    expect(setPathMock).toHaveBeenCalledTimes(1);
    expect(setPathMock).toHaveBeenCalledWith('userData', 'C:\\AppData\\Roaming\\TW Time Register-dev');
  });

  it('leaves the packaged build on the default userData directory', async () => {
    await loadDevUserData(true);

    expect(setPathMock).not.toHaveBeenCalled();
  });
});
