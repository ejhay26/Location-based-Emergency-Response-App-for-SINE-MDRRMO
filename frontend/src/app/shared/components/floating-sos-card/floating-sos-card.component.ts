import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { parseServerDate } from '../../pipes/utc-date.pipe';
import { QueuedReport } from '../../../core/services/offline-queue';

export interface FloatingSosStatus {
  request_id: number;
  status: 'Pending' | 'Dispatched' | 'Resolved' | 'Cancelled';
  request_time: string;
  incident_name?: string | null;
  agency?: string | null;
  unit_name?: string | null;
}

type PillState = 'offline' | 'pending' | 'dispatched';

interface SosPill {
  key: number;
  state: PillState;
  label: string;
  sublabel: string;
  icon: string;
  timeAgo: string;
  /** null for offline-queue pills (no server id yet) */
  requestId: number | null;
  /** set for offline-queue pills */
  queueId: string | null;
  /** Dispatched reports cannot be cancelled — responder already en route */
  cancellable: boolean;
}

import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-floating-sos-card',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './floating-sos-card.component.html',
  styleUrl: './floating-sos-card.component.scss',
})
export class FloatingSosCardComponent implements OnInit, OnDestroy, OnChanges {
  private cdr = inject(ChangeDetectorRef);

  isMinimized = false;
  private autoMinimizeTimer: any = null;
  private prevItemIds = new Set<string>();

  ngOnInit() {
    if (this.visible) {
      this.scheduleAutoMinimize(5000);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const currentIds = new Set<string>();
    (this.activeReports || []).forEach(r => currentIds.add(`r:${r.request_id}`));
    (this.queuedItems || []).forEach(q => currentIds.add(`q:${q.id}`));

    // Check if genuinely NEW items were added (not just polling or array reference churn)
    let hasNewItem = false;
    for (const id of currentIds) {
      if (!this.prevItemIds.has(id)) {
        hasNewItem = true;
        break;
      }
    }

    if (hasNewItem && this.prevItemIds.size > 0) {
      this.expandCard();
    } else if (this.prevItemIds.size === 0 && currentIds.size > 0 && !this.isMinimized) {
      this.scheduleAutoMinimize(5000);
    }

    this.prevItemIds = currentIds;
  }

  ngOnDestroy() {
    this.clearAutoMinimize();
  }

  scheduleAutoMinimize(delayMs = 5000) {
    this.clearAutoMinimize();
    this.autoMinimizeTimer = setTimeout(() => {
      this.isMinimized = true;
      this.cdr.markForCheck();
    }, delayMs);
  }

  clearAutoMinimize() {
    if (this.autoMinimizeTimer) {
      clearTimeout(this.autoMinimizeTimer);
      this.autoMinimizeTimer = null;
    }
  }

  expandCard() {
    this.clearAutoMinimize();
    this.isMinimized = false;
    this.cdr.markForCheck();
    this.scheduleAutoMinimize(6000);
  }

  minimizeCard(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.clearAutoMinimize();
    this.isMinimized = true;
    this.cdr.markForCheck();
  }

  @Input() activeReports: FloatingSosStatus[] = [];
  @Input() queuedItems: QueuedReport[] = [];
  @Output() cardTap = new EventEmitter<void>();
  /** Emits request_id for server-confirmed pills, null for offline-queue pills (use queueId instead) */
  @Output() cancelTap = new EventEmitter<{ requestId: number | null; queueId: string | null }>();

  get pills(): SosPill[] {
    const result: SosPill[] = [];

    for (let i = 0; i < this.queuedItems.length; i++) {
      const item = this.queuedItems[i];
      result.push({
        key: -(i + 1),
        state: 'offline',
        label: 'SOS Queued — Offline',
        sublabel: "Will send automatically once you're back online.",
        icon: 'cloud-arrow-up',
        timeAgo: '',
        requestId: null,
        queueId: item.id,
        cancellable: true,
      });
    }

    for (const r of this.activeReports) {
      const state: PillState = r.status === 'Dispatched' ? 'dispatched' : 'pending';
      const label = r.incident_name
        ? `${r.incident_name} Emergency`
        : (state === 'dispatched' ? 'Help Is On The Way' : 'Emergency SOS');

      let sublabel = '';
      if (state === 'dispatched') {
        if (r.agency && r.unit_name) {
          sublabel = `${r.agency} (${r.unit_name}) is en route to your location.`;
        } else if (r.agency) {
          sublabel = `${r.agency} is en route to your location.`;
        } else if (r.unit_name) {
          sublabel = `${r.unit_name} is en route to your location.`;
        } else {
          sublabel = 'A responder has been dispatched to your location.';
        }
      } else {
        sublabel = 'MDRRMO has received your request and is reviewing it.';
      }

      result.push({
        key: r.request_id,
        state,
        label,
        sublabel,
        icon: state === 'dispatched' ? 'truck-medical' : 'clock',
        timeAgo: this.calcTimeAgo(r.request_time),
        requestId: r.request_id,
        queueId: null,
        // Only Pending can be cancelled — Dispatched means a responder is
        // already en route, cancelling at that point is handled by History.
        cancellable: state === 'pending',
      });
    }

    return result;
  }

  get visible(): boolean { return this.pills.length > 0; }

  private calcTimeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }

  trackByKey(_: number, pill: SosPill): number { return pill.key; }

  onTap() { this.cardTap.emit(); }

  onCancel(ev: MouseEvent, pill: SosPill) {
    ev.stopPropagation(); // don't also fire cardTap
    this.cancelTap.emit({ requestId: pill.requestId, queueId: pill.queueId });
  }
}
