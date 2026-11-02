import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  inject
} from '@angular/core';
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
  isSliding = false;
  pills: SosPill[] = [];
  currentPill: SosPill | null = null;
  visible = false;
  hasDispatched = false;

  private autoMinimizeTimer: any = null;
  private prevItemIds = new Set<string>();

  @Input() activeReports: FloatingSosStatus[] = [];
  @Input() queuedItems: QueuedReport[] = [];
  @Output() cardTap = new EventEmitter<void>();
  /** Emits request_id for server-confirmed pills, null for offline-queue pills (use queueId instead) */
  @Output() cancelTap = new EventEmitter<{ requestId: number | null; queueId: string | null }>();

  ngOnInit(): void {
    this.rebuildPills();
    if (this.visible) {
      this.scheduleAutoMinimize(5000);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const currentIds = new Set<string>();
    (this.activeReports || []).forEach(r => currentIds.add(`r:${r.request_id}`));
    (this.queuedItems || []).forEach(q => currentIds.add(`q:${q.id}`));

    let hasNewItem = false;
    for (const id of currentIds) {
      if (!this.prevItemIds.has(id)) {
        hasNewItem = true;
        break;
      }
    }

    this.rebuildPills();

    if (hasNewItem && this.prevItemIds.size > 0) {
      this.expandCard();
    } else if (this.prevItemIds.size === 0 && currentIds.size > 0 && !this.isMinimized) {
      this.scheduleAutoMinimize(5000);
    }

    this.prevItemIds = currentIds;
  }

  ngOnDestroy(): void {
    this.clearAutoMinimize();
  }

  rebuildPills(): void {
    const result: SosPill[] = [];

    for (let i = 0; i < (this.queuedItems || []).length; i++) {
      const item = this.queuedItems[i];
      result.push({
        key: -(i + 1),
        state: 'offline',
        label: 'SOS Queued',
        sublabel: "Sending once online",
        icon: 'cloud-arrow-up',
        timeAgo: '',
        requestId: null,
        queueId: item.id,
        cancellable: true,
      });
    }

    for (const r of (this.activeReports || [])) {
      const state: PillState = r.status === 'Dispatched' ? 'dispatched' : 'pending';
      const label = r.incident_name
        ? `${r.incident_name} Emergency`
        : (state === 'dispatched' ? 'Help En Route' : 'Emergency SOS');

      let sublabel = '';
      if (state === 'dispatched') {
        if (r.agency && r.unit_name) {
          sublabel = `${r.agency} (${r.unit_name}) en route`;
        } else if (r.agency) {
          sublabel = `${r.agency} en route`;
        } else if (r.unit_name) {
          sublabel = `${r.unit_name} en route`;
        } else {
          sublabel = 'Responder dispatched';
        }
      } else {
        sublabel = 'MDRRMO reviewing request';
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

    this.pills = result;
    this.visible = result.length > 0;
    this.hasDispatched = result.some(p => p.state === 'dispatched');

    if (result.length === 0) {
      this.currentIndex = 0;
      this.currentPill = null;
    } else {
      if (this.currentIndex >= result.length) {
        this.currentIndex = result.length - 1;
      }
      this.currentPill = result[this.currentIndex] ?? result[0];
    }

    this.cdr.markForCheck();
  }

  scheduleAutoMinimize(delayMs = 6000): void {
    this.clearAutoMinimize();
    this.autoMinimizeTimer = setTimeout(() => {
      this.isMinimized = true;
      this.cdr.markForCheck();
    }, delayMs);
  }

  clearAutoMinimize(): void {
    if (this.autoMinimizeTimer) {
      clearTimeout(this.autoMinimizeTimer);
      this.autoMinimizeTimer = null;
    }
  }

  expandCard(): void {
    this.clearAutoMinimize();
    this.isMinimized = false;
    this.cdr.markForCheck();
    this.scheduleAutoMinimize(7000);
  }

  minimizeCard(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.clearAutoMinimize();
    this.isMinimized = true;
    this.cdr.markForCheck();
  }

  onCapsuleClick(event: MouseEvent): void {
    if (this.isMinimized) {
      event.stopPropagation();
      this.expandCard();
    } else {
      this.onTap();
    }
  }

  get summaryMinimizedLabel(): string {
    const len = this.pills.length;
    if (len === 1) {
      const first = this.pills[0];
      return first?.state === 'dispatched' ? 'En Route' : 'SOS Active';
    }
    return `${len} Active`;
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

  prevPill(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const len = this.pills.length;
    if (len <= 1) return;
    this.triggerSlideTransition();
    this.currentIndex = (this.currentIndex - 1 + len) % len;
    this.currentPill = this.pills[this.currentIndex];
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
    this.triggerSlideTransition();
    this.currentIndex = (this.currentIndex + 1) % len;
    this.currentPill = this.pills[this.currentIndex];
    this.scheduleAutoMinimize(8000);
    this.cdr.markForCheck();
  }

  private triggerSlideTransition(): void {
    this.isSliding = true;
    setTimeout(() => {
      this.isSliding = false;
      this.cdr.markForCheck();
    }, 180);
  }

  private calcTimeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }

  onTap(): void {
    this.cardTap.emit();
  }

  onCancel(ev: MouseEvent, pill: SosPill | null): void {
    ev.stopPropagation();
    if (!pill) return;
    this.cancelTap.emit({ requestId: pill.requestId, queueId: pill.queueId });
  }
}
