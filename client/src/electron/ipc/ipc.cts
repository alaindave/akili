import { ipcRenderer } from "electron";

// Legacy channels have heterogeneous responses; callers can specify a result type.
//prettier-ignore
export const invoke = <T = any,>(
  channel: string,

  ...args: unknown[]
): Promise<T> => {
  return ipcRenderer.invoke(channel, ...args);
};

export const send = (channel: string, ...args: unknown[]): void => {
  ipcRenderer.send(channel, ...args);
};

export const on = (channel: string, listener: (...args: unknown[]) => void) => {
  ipcRenderer.on(channel, (_event, ...args) => {
    listener(...args);
  });
};
