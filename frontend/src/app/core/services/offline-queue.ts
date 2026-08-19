import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { NetworkService } from './network';

/**
 * OfflineQueueService — persists SOS/hazard reports locally (IndexedDB) when
 * the backend can't be reached, and retries them once connectivity returns.
 *
 * WHY IndexedDB and not localStorage: proof-file payloads are base64 image/
 * video strings (see ReportMediaComponent) that can run several MB each,
 * and this app promises to queue those too (not just text) — localStorage's
 * ~5-10MB total quota and fully-synchronous API make it a poor fit for that
 * size and would block the main thread on every read/write. IndexedDB has
 * no such practical size ceiling (browser-dependent, but effectively
 * hundreds of MB+) and is fully async.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CAVEATS — read before relying on this for a real emergency:
 *
 * 1. NOT a delivery guarantee. If the device is lost, the app is
 *    uninstalled, or the user clears app storage while a report is still
 *    queued, that report is gone. This is client-side persistence only —
 *    there is no server-side record until a queued item actually reaches
 *    the backend.
 * 2. Duplicate risk on ambiguous failures. If a request times out AFTER
 *    the backend already received and processed it (slow ack, not a true
 *    send failure), this service cannot currently tell "it never arrived"
 *    apart from "it arrived but the response got lost" — it will retry and
 *    may create a second, duplicate report. The backend's own guard
 *    (SosController::submitSos rejects a 2nd Pending/Dispatched SOS per
 *    user with 429) accidentally covers SOS in most cases, but NOT hazard
 *    reports, which have no such uniqueness constraint. A proper fix needs
 *    a server-side idempotency key accepted by submit-sos/submit-hazard —
 *    out of scope for this pass; flagging it here so it isn't forgotten.
 * 3. Give-up ceiling. After MAX_ATTEMPTS repeated server-rejections (a real
 *    HTTP error response, not a network failure), an item is dropped
 *    rather than retried forever — a request the server keeps validating
 *    as broken will not start succeeding by resending it unchanged. This
 *    is silent from the user's point of view once queued; a "queued items"
 *    review screen is recommended (not built here) so a citizen/dispatcher
 *    can see anything that's been sitting unsent.
 * 4. Single-device, single-session queue. Nothing here syncs the queue
 *    across the person's other devices, and it doesn't survive a full
 *    uninstall/reinstall.
 * 5. Location goes stale. The lat/lng captured at queue time is NOT
 *    re-fetched before actually sending later — if someone queues an SOS
 *    then walks half a kilometer before connectivity returns, dispatchers
 *    see the OLD location. Worth surfacing in the UI ("location captured
 *    at [time]") rather than silently trusting it — not implemented here.
 */
export interface QueuedReport {
  id: string;
  kind: 'sos' | 'hazard';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'mdrrmo_offline_queue';
const DB_VERSION = 1;
const STORE = 'reports';
/** Safety ceiling so a permanently-invalid item doesn't retry forever. */
const MAX_ATTEMPTS = 8;

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  /** Reactive count of items still waiting to sync — bind to a UI badge. */
  readonly pendingCount = signal<number>(0);
  /** Reactive count of queued items specifically of kind 'sos' — Stage 5's Floating SOS Card and History page need this distinct from the hazard-inclusive total. */
  readonly pendingSosCount = signal<number>(0);
  /** Reactive snapshot of the full queue, oldest-first — lets consumers render queued items (e.g. a "Queued — offline" row) without a separate getAll() round trip. Treat as read-only; mutate via enqueue/flush only. */
  readonly items = signal<QueuedReport[]>([]);

  private dbPromise: Promise<IDBDatabase> | null = null;
  private flushing = false;

  constructor(private api: ApiService, private network: NetworkService) {
    window.addEventListener('online', () => { this.flush(); });
    this.refreshCount();
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  /** Adds a report to the persistent queue. Returns the generated id. */
  async enqueue(kind: 'sos' | 'hazard', payload: Record<string, unknown>): Promise<string> {
    const db = await this.openDb();
    const item: QueuedReport = {
      id: crypto.randomUUID(),
      kind,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await this.refreshCount();
    return item.id;
  }

  async getAll(): Promise<QueuedReport[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedReport[]);
      req.onerror = () => reject(req.error);
    });
  }

  private async remove(id: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async update(item: QueuedReport): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Single source of truth for every reactive signal this service exposes — one IndexedDB read, three derived views, so callers never diverge from what's actually persisted. */
  private async refreshCount(): Promise<void> {
    const all = (await this.getAll()).sort((a, b) => a.createdAt - b.createdAt);
    this.pendingCount.set(all.length);
    this.pendingSosCount.set(all.filter(i => i.kind === 'sos').length);
    this.items.set(all);
  }

  /**
   * Attempts to send every queued report, oldest first, one at a time.
   * Stops immediately on a genuine network failure (no point burning
   * through the rest of the queue if the connection just dropped again
   * mid-flush) rather than treating every item's failure independently.
   */
  async flush(): Promise<void> {
    if (this.flushing) return; // already in progress — avoid overlapping flushes
    this.flushing = true;
    try {
      const items = (await this.getAll()).sort((a, b) => a.createdAt - b.createdAt);
      for (const item of items) {
        const reachable = await this.network.recheck();
        if (!reachable) break; // still offline — stop, wait for the next 'online' event

        try {
          if (item.kind === 'sos') {
            await firstValueFrom(this.api.submitSos(item.payload));
          } else {
            await firstValueFrom(this.api.submitHazard(item.payload));
          }
          await this.remove(item.id);
        } catch (err: any) {
          // status 0 = no HTTP response reached us at all (offline / DNS /
          // CORS-preflight failure) — a genuine network failure, distinct
          // from the server actually responding with a rejection.
          if (err?.status === 0) break; // stop the whole flush, retry later

          item.attempts += 1;
          item.lastError = err?.error?.message || err?.message || 'Unknown error';
          if (item.attempts >= MAX_ATTEMPTS) {
            await this.remove(item.id); // give up — see class doc caveat #3
          } else {
            await this.update(item);
          }
        }
      }
    } finally {
      this.flushing = false;
      await this.refreshCount();
    }
  }
}
