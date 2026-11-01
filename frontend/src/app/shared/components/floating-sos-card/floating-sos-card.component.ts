import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { parseServerDate } from '../../pipes/utc-date.pipe';
import { QueuedReport } from '../../../core/services/offline-queue';
import { AppIconComponent } from '../app-icon/app-icon.component';

export interface FloatingSosStatus {
  request_id: number;
  status: 'Pending' | 'Dispatched' | 'Resolved' | 'Cancelled';
  request_time: string;
  incident_name?: string | null;
  agency?: string | null;
  unit_name?: string | null;
}

type PillState = 'offline' | 'pending' | 'dispatched';

export interface SosPill {
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
  currentIndex = 0;
  private autoMinimizeTimer: any = null;
  private prevItemIds = new Set<string>();

  @Input() activeReports: FloatingSosStatus[] = [];
  @Input() queuedItems: QueuedReport[] = [];
  @Output() cardTap = new EventEmitter<void>();
  /** Emits request_id for server-confirmed pills, null for offline-queue pills (use queueId instead) */
  @Output() cancelTap = new EventEmitter<{ requestId: number | null; queueId: string | null }>();

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

    // Ensure currentIndex stays within bounds
    const len = this.pills.length;
    if (len === 0) {
      this.currentIndex = 0;
    } else if (this.currentIndex >= len) {
      this.currentIndex = len - 1;
    }
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

  onCardContainerClick(event: MouseEvent) {
    if (this.isMinimized) {
      event.stopPropagation();
      this.expandCard();
    } else {
      this.onTap();
    }
  }

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
        cancellable: state === 'pending',
      });
    }

    return result;
  }

  get currentPill(): SosPill | null {
    const p = this.pills;
    if (p.length === 0) return null;
    return p[this.currentIndex] ?? p[0];
  }

  get hasDispatched(): boolean {
    return this.pills.some(p => p.state === 'dispatched');
  }

  get summaryMinimizedLabel(): string {
    const len = this.pills.length;
    if (len === 1) {
      return this.pills[0].state === 'dispatched' ? 'En Route' : 'SOS Active';
    }
    return `${len} Active Alerts`;
  }

  get summaryIcon(): string {
    if (this.hasDispatched) return 'truck-medical';
    if (this.pills.some(p => p.state === 'offline')) return 'cloud-arrow-up';
    return 'clock';
  }

  get summaryIconColor(): string {
    if (this.hasDispatched) return '#10b981';
    if (this.pills.some(p => p.state === 'offline')) return '#f59e0b';
    return '#d32f2f';
  }

  get visible(): boolean { return this.pills.length > 0; }

  prevPill(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const len = this.pills.length;
    if (len <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + len) % len;
    this.scheduleAutoMinimize(8000);
    this.cdr.markForCheck();
  }

  nextPill(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const len = this.pills.length;
    if (len <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % len;
    this.scheduleAutoMinimize(8000);
    this.cdr.markForCheck();
  }

  goToPill(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (index >= 0 && index < this.pills.length) {
      this.currentIndex = index;
      this.scheduleAutoMinimize(8000);
      this.cdr.markForCheck();
    }
  }

  private calcTimeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }

  onTap() { this.cardTap.emit(); }

  onCancel(ev: MouseEvent, pill: SosPill | null) {
    ev.stopPropagation();
    if (!pill) return;
    this.cancelTap.emit({ requestId: pill.requestId, queueId: pill.queueId });
  }
}
