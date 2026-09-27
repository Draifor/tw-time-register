import type { IpcRendererEvent } from 'electron';

/** Callback shape exposed to the renderer through `window.Main.on/off`. */
export type IpcChannelCallback = (data: unknown) => void;

/** Listener shape handed to the underlying ipcRenderer event emitter. */
export type IpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

/**
 * Minimal surface of `ipcRenderer` required by the bridge. Declared
 * structurally so tests can supply a fake emitter without casting.
 */
export interface IpcEventSource {
  on(channel: string, listener: IpcListener): unknown;
  removeListener(channel: string, listener: IpcListener): unknown;
}

/** Public API exposed as `window.Main.on/off`. */
export interface IpcEventBridge {
  on: (channel: string, callback: IpcChannelCallback) => void;
  off: (channel: string, callback: IpcChannelCallback) => void;
}

/**
 * Tracks, per channel, the wrapper actually registered with `ipcRenderer`.
 * Storing the wrapper is what lets `off` remove the exact same function that
 * `on` added; without it `off` builds a new lambda that can never match.
 */
export type IpcListenerRegistry = Map<string, Map<IpcChannelCallback, IpcListener>>;

/**
 * Creates the `on`/`off` bridge used by the preload script.
 *
 * @param source Underlying event emitter (`ipcRenderer` in production).
 * @param registry Wrapper registry; injectable so tests can assert cleanup.
 */
export function createIpcEventBridge(
  source: IpcEventSource,
  registry: IpcListenerRegistry = new Map<string, Map<IpcChannelCallback, IpcListener>>()
): IpcEventBridge {
  return {
    on(channel: string, callback: IpcChannelCallback): void {
      let channelListeners = registry.get(channel);
      if (!channelListeners) {
        channelListeners = new Map<IpcChannelCallback, IpcListener>();
        registry.set(channel, channelListeners);
      }

      // Ignore a duplicate registration for the same callback: callers get no
      // handle back, so re-registering would leak the previous wrapper.
      if (channelListeners.has(callback)) return;

      const listener: IpcListener = (_event, data) => callback(data);
      channelListeners.set(callback, listener);
      source.on(channel, listener);
    },

    off(channel: string, callback: IpcChannelCallback): void {
      const channelListeners = registry.get(channel);
      const listener = channelListeners?.get(callback);
      if (!channelListeners || !listener) return;

      source.removeListener(channel, listener);
      channelListeners.delete(callback);

      // Drop the channel entry once its last listener is gone so the registry
      // does not grow without bound across mount/unmount cycles.
      if (channelListeners.size === 0) registry.delete(channel);
    }
  };
}
