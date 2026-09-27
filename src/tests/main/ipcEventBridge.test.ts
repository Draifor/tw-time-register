import { describe, it, expect, vi } from 'vitest';
import type { IpcRendererEvent } from 'electron';
import {
  createIpcEventBridge,
  type IpcEventSource,
  type IpcListener,
  type IpcListenerRegistry
} from '../../main/ipcEventBridge';

/**
 * Fake ipcRenderer emitter that records the exact listener references it was
 * given, so tests can prove `off` removes the same wrapper `on` registered.
 */
function createFakeSource() {
  const listeners = new Map<string, Set<IpcListener>>();

  const onMock = vi.fn((channel: string, listener: IpcListener) => {
    const channelListeners = listeners.get(channel) ?? new Set<IpcListener>();
    channelListeners.add(listener);
    listeners.set(channel, channelListeners);
  });

  const removeListenerMock = vi.fn((channel: string, listener: IpcListener) => {
    listeners.get(channel)?.delete(listener);
  });

  const source: IpcEventSource = { on: onMock, removeListener: removeListenerMock };

  return {
    source,
    onMock,
    removeListenerMock,
    emit(channel: string, data: unknown) {
      const event = {} as IpcRendererEvent;
      listeners.get(channel)?.forEach((listener) => listener(event, data));
    },
    listenerCount(channel: string) {
      return listeners.get(channel)?.size ?? 0;
    }
  };
}

describe('createIpcEventBridge', () => {
  it('unwraps the event argument and forwards the payload to the callback', () => {
    const { source, emit } = createFakeSource();
    const bridge = createIpcEventBridge(source);
    const callback = vi.fn();

    bridge.on('update-available', callback);
    emit('update-available', { version: '2.0.0' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ version: '2.0.0' });
  });

  it('removes the exact listener that on() registered', () => {
    const { source, onMock, removeListenerMock } = createFakeSource();
    const bridge = createIpcEventBridge(source);
    const callback = vi.fn();

    bridge.on('update-error', callback);
    const registeredListener = onMock.mock.calls[0][1];

    bridge.off('update-error', callback);

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
    expect(removeListenerMock).toHaveBeenCalledWith('update-error', registeredListener);
  });

  it('stops invoking the callback after off() so listeners do not accumulate', () => {
    const { source, emit } = createFakeSource();
    const bridge = createIpcEventBridge(source);
    const callback = vi.fn();

    bridge.on('update-downloaded', callback);
    bridge.off('update-downloaded', callback);
    emit('update-downloaded', { version: '2.0.0' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('drops the channel entry once its last listener is removed', () => {
    const { source } = createFakeSource();
    const registry: IpcListenerRegistry = new Map();
    const bridge = createIpcEventBridge(source, registry);
    const first = vi.fn();
    const second = vi.fn();

    bridge.on('update-available', first);
    bridge.on('update-available', second);
    expect(registry.get('update-available')?.size).toBe(2);

    bridge.off('update-available', first);
    expect(registry.has('update-available')).toBe(true);

    bridge.off('update-available', second);
    expect(registry.has('update-available')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('registers a given callback only once per channel', () => {
    const { source, onMock, emit } = createFakeSource();
    const bridge = createIpcEventBridge(source);
    const callback = vi.fn();

    bridge.on('update-available', callback);
    bridge.on('update-available', callback);
    emit('update-available', { version: '2.0.0' });

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores off() for a callback that was never registered', () => {
    const { source, removeListenerMock } = createFakeSource();
    const bridge = createIpcEventBridge(source);

    expect(() => bridge.off('update-error', vi.fn())).not.toThrow();
    expect(removeListenerMock).not.toHaveBeenCalled();
  });
});
