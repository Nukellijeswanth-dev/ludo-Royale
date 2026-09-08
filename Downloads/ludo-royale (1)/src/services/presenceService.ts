export type PresenceStatus = 'ONLINE' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE';

export interface PresenceInfo {
  status: PresenceStatus;
  latencyMs: number;
  lastPingAt: number;
  isBrowserOnline: boolean;
}

type PresenceListener = (info: PresenceInfo) => void;

/**
 * Presence Service.
 * Tracks network connectivity, browser offline/online transitions,
 * and ping round-trip latency.
 */
export class PresenceService {
  private status: PresenceStatus = 'ONLINE';
  private latencyMs = 0;
  private lastPingAt = Date.now();
  private isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<PresenceListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isBrowserOnline = true;
        this.updateStatus(this.status === 'OFFLINE' ? 'CONNECTING' : this.status);
      });

      window.addEventListener('offline', () => {
        this.isBrowserOnline = false;
        this.updateStatus('OFFLINE');
      });
    }
  }

  public updateStatus(status: PresenceStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.notify();
    }
  }

  public recordPing(latency: number): void {
    this.latencyMs = Math.max(0, Math.round(latency));
    this.lastPingAt = Date.now();
    this.notify();
  }

  public getPresenceInfo(): PresenceInfo {
    return {
      status: !this.isBrowserOnline ? 'OFFLINE' : this.status,
      latencyMs: this.latencyMs,
      lastPingAt: this.lastPingAt,
      isBrowserOnline: this.isBrowserOnline,
    };
  }

  public subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    listener(this.getPresenceInfo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const info = this.getPresenceInfo();
    this.listeners.forEach((fn) => fn(info));
  }
}

export const presenceService = new PresenceService();
