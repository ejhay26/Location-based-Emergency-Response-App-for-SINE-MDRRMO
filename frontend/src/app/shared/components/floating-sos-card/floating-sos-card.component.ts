import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressFeedbackDirective } from '../../directives/press-feedback.directive';
import { parseServerDate } from '../../pipes/utc-date.pipe';
import { QueuedReport } from '../../../core/services/offline-queue';

/**
 * Minimal shape read from an emergency_requests row — narrow on purpose so
 * the parent can pass the raw API object through without mapping it first.
 */
export interface FloatingSosStatus {
  request_id: number;
  status: 'Pending' | 'Dispatched' | 'Resolved' | 'Cancelled';
  request_time: string;
  incident_name?: string | null;
}

type PillState = 'offline' | 'pending' | 'dispatched';

interface SosPill {
  /** Unique key for ngFor trackBy — negative ids for offline-queue items. */
  key: number;
  state: PillState;
  label: string;
  sublabel: string;
  icon: string;
  timeAgo: string;
}

/**
 * FloatingSosCardComponent — Stage 5 (revised).
 *
 * Renders one large pill per active SOS:
 *   • One pill per queued-offline entry (no server id yet)
 *   • One pill per Pending/Dispatched server-confirmed report
 *
 * Offline-queue pills always appear above server ones (offline = most
 * "recently submitted from the user's perspective" since they haven't even
 * reached the server yet). Within each group order is newest-first, which
 * is the order the parent already passes them in.
 *
 * Rendered as a normal block element inside ion-content (NOT slot="fixed"),
 * so it participates in normal page flow between the header greeting and
 * the SOS button — the most visible location without obstructing the tab bar.
 *
 * Tap on any pill → emits cardTap. The parent navigates to History where
 * the full record lives.
 */
@Component({
  selector: 'app-floating-sos-card',
  standalone: true,
  imports: [CommonModule, PressFeedbackDirective],
  templateUrl: './floating-sos-card.component.html',
  styleUrl: './floating-sos-card.component.scss',
})
export class FloatingSosCardComponent {
  /** All Pending/Dispatched server-confirmed SOS reports, newest-first. */
  @Input() activeReports: FloatingSosStatus[] = [];
  /** Queued-offline SOS entries from OfflineQueueService.items(). */
  @Input() queuedItems: QueuedReport[] = [];
  @Output() cardTap = new EventEmitter<void>();

  get pills(): SosPill[] {
    const result: SosPill[] = [];

    // Offline-queue pills first (negative key so no collision with request_ids)
    for (let i = 0; i < this.queuedItems.length; i++) {
      const item = this.queuedItems[i];
      result.push({
        key: -(i + 1),
        state: 'offline',
        label: 'SOS Queued — Offline',
        sublabel: "Will send automatically once you're back online.",
        icon: 'fa-solid fa-cloud-arrow-up',
        timeAgo: '',
      });
    }

    // Server-confirmed active reports
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
      });
    }

    return result;
  }

  get visible(): boolean {
    return this.pills.length > 0;
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

  trackByKey(_: number, pill: SosPill): number { return pill.key; }

  onTap() { this.cardTap.emit(); }
}
