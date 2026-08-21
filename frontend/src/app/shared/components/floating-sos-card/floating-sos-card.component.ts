import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressFeedbackDirective } from '../../directives/press-feedback.directive';
import { parseServerDate } from '../../pipes/utc-date.pipe';
import { QueuedReport } from '../../../core/services/offline-queue';

export interface FloatingSosStatus {
  request_id: number;
  status: 'Pending' | 'Dispatched' | 'Resolved' | 'Cancelled';
  request_time: string;
  incident_name?: string | null;
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

@Component({
  selector: 'app-floating-sos-card',
  standalone: true,
  imports: [CommonModule, PressFeedbackDirective],
  templateUrl: './floating-sos-card.component.html',
  styleUrl: './floating-sos-card.component.scss',
})
export class FloatingSosCardComponent {
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
        icon: 'fa-solid fa-cloud-arrow-up',
        timeAgo: '',
        requestId: null,
        queueId: item.id,
        cancellable: true,
      });
    }

    for (const r of this.activeReports) {
      const state: PillState = r.status === 'Dispatched' ? 'dispatched' : 'pending';
      result.push({
        key: r.request_id,
        state,
        label: state === 'dispatched' ? 'Help Is On The Way' : 'SOS Sent — Awaiting Response',
        sublabel: state === 'dispatched'
          ? 'A responder has been dispatched to your location.'
          : 'MDRRMO has received your request and is reviewing it.',
        icon: state === 'dispatched' ? 'fa-solid fa-truck-medical' : 'fa-solid fa-hourglass-half',
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
