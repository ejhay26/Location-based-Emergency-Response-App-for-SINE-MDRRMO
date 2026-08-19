import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonCard, IonItem,
  IonLabel, IonBadge, IonRefresher, IonRefresherContent, IonSkeletonText, IonList
} from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { OfflineQueueService, QueuedReport } from '../../../core/services/offline-queue';
import { DialogService } from '../../../core/services/dialog.service';
import { DateRangeFilterComponent } from '../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { ProxyImageDirective } from '../../../shared/directives/proxy-image.directive';
import { VideoThumbnailDirective } from '../../../shared/directives/video-thumbnail.directive';
import { RevealAnimateDirective } from '../../../shared/directives/reveal-animate.directive';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../shared/utils/date-filter.util';

/** The 4 real backend status values (confirmed from SosController::getMyEmergencies) plus 'All'. */
type StatusFilter = 'All' | 'Pending' | 'Dispatched' | 'Resolved' | 'Cancelled';

interface StatusFilterOption { value: StatusFilter; label: string; icon: string; }

const STATUS_FILTERS: StatusFilterOption[] = [
  { value: 'Pending',    label: 'Pending',    icon: 'fa-solid fa-hourglass-half' },
  { value: 'Dispatched', label: 'Dispatched', icon: 'fa-solid fa-truck-medical' },
  { value: 'Resolved',   label: 'Resolved',   icon: 'fa-solid fa-circle-check' },
  { value: 'Cancelled',  label: 'Cancelled',  icon: 'fa-solid fa-ban' },
  { value: 'All',        label: 'All',        icon: 'fa-solid fa-list' },
];

@Component({
  selector: 'app-history',
  templateUrl: 'history.page.html',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonCard, IonItem,
    IonLabel, IonBadge, IonRefresher, IonRefresherContent, IonSkeletonText, IonList,
    DateRangeFilterComponent, FilterSummaryBarComponent,
    ProxyImageDirective, VideoThumbnailDirective, RevealAnimateDirective,
  ],
})
export class HistoryPage implements OnDestroy {
  /** Exposed to the template so the status-filter row can be rendered from one source of truth. */
  readonly statusFilters = STATUS_FILTERS;

  emergencies: any[] = [];
  isLoading = false;

  statusFilter: StatusFilter = 'All';
  dateFilter: DateFilterValue | null = null;

  /** Accordion behavior — only one card expanded at a time. */
  expandedId: number | null = null;
  /**
   * Drives [appRevealAnimate] on the expanded content div. Deliberately
   * separate from `expandedId`: the div is mounted (via *ngIf) the instant
   * `expandedId` changes, but RevealAnimateDirective always treats an
   * element's FIRST bound value (in ngAfterViewInit) as the resting state
   * with no animation — by design, so permanently-mounted filtered lists
   * don't animate on initial page load. If we bound [appRevealAnimate]
   * straight to `expandedId === req.request_id`, a freshly-*ngIf-mounted
   * card would mount already-open and skip the open animation entirely
   * (this was the original "instantly expands" bug). Mounting with this
   * flag still false, then flipping it true one frame later, makes the
   * directive see a genuine change via ngOnChanges instead — which is the
   * path that actually plays the animation.
   */
  openAnimateId: number | null = null;
  /** Card(s) still mounted and playing their close tween after being deselected (see toggleExpand). */
  closingIds = new Set<number>();

  /**
   * Fixing a visible bug: the "No reports match your filters" empty state
   * used to appear the instant a filter changed, while the now-non-matching
   * cards were still mid-collapse underneath it — so it read as the empty
   * message "teleporting" as the still-tall card(s) beneath it kept shrinking
   * for another ~200ms. Setting this true for the duration of the close
   * animation keeps the empty state hidden until the collapse has actually
   * finished, so nothing is left visibly resolving underneath it.
   */
  filterSettling = false;
  private filterSettleTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private router: Router,
    private dialog: DialogService,
    public tour: TourService,
    public offlineQueue: OfflineQueueService,
  ) {}

  /**
   * Stage 5 — "Pending offline / queued" indicator, History page half. An
   * item still sitting in the offline queue hasn't reached the server at
   * all yet, so it can never appear in `emergencies` (fetched from
   * getMyEmergencies) — rendered separately, read-only (no expand/cancel;
   * cancelling a not-yet-sent report is just deleting the local queue entry,
   * out of scope here), and only for kind 'sos' since this page only ever
   * shows SOS records to begin with (getMyEmergencies never returns hazard
   * reports). Reads the shared reactive signal directly — no separate
   * IndexedDB call of its own.
   */
  get queuedSosItems(): QueuedReport[] {
    return this.offlineQueue.items().filter(i => i.kind === 'sos');
  }

  ngOnInit() { this.load(); }

  load(event?: any) {
    const userStr = localStorage.getItem('user');
    if (!userStr) { event?.target.complete(); return; }
    const user = JSON.parse(userStr);
    this.isLoading = !event;
    this.api.getMyEmergencies(user.user_id).subscribe({
      next: (res: any) => { this.emergencies = Array.isArray(res) ? res : []; this.isLoading = false; event?.target.complete(); },
      error: () => { this.isLoading = false; event?.target.complete(); }
    });
  }

  ngOnDestroy() {
    clearTimeout(this.filterSettleTimer);
  }

  /** Delays the empty-state message just long enough for RevealAnimateDirective's close tween (~220ms) to actually finish — see the filterSettling doc comment above. */
  private markFilterSettling() {
    this.filterSettling = true;
    clearTimeout(this.filterSettleTimer);
    this.filterSettleTimer = setTimeout(() => { this.filterSettling = false; }, 260);
  }

  setStatusFilter(f: StatusFilter) { this.statusFilter = f; this.markFilterSettling(); }

  onDateFilterChange(v: DateFilterValue | null) { this.dateFilter = v; this.markFilterSettling(); }

  clearAllFilters() {
    this.statusFilter = 'All';
    this.dateFilter = null;
    this.markFilterSettling();
  }

  get filterChips(): string[] {
    const chips: string[] = [];
    if (this.statusFilter !== 'All') chips.push(this.statusFilter);
    if (this.dateFilter) chips.push(formatDateFilterLabel(this.dateFilter));
    return chips;
  }

  get filteredEmergencies(): any[] {
    return this.emergencies.filter(req =>
      (this.statusFilter === 'All' || req.status === this.statusFilter) &&
      matchesDateFilter(req.request_time, this.dateFilter)
    );
  }

  get emptyLabel(): string {
    if (this.statusFilter !== 'All' || this.dateFilter) return 'No reports match your filters.';
    return 'You have not submitted any reports yet.';
  }

  /**
   * Post-Stage-5 follow-up (filter shrink-and-reflow) — whether a given
   * report currently matches the active filters. The template now iterates
   * the full, unfiltered `emergencies` list and drives each card's
   * `[appRevealAnimate]` from this, instead of iterating the derived
   * `filteredEmergencies` array directly — a card that stops matching
   * stays mounted and collapses to a true zero height+margin in place, so
   * the cards below it slide up to fill the gap as an ordinary side effect
   * of block layout, rather than vanishing instantly.
   */
  matchesFilter(req: any): boolean {
    return (this.statusFilter === 'All' || req.status === this.statusFilter) &&
      matchesDateFilter(req.request_time, this.dateFilter);
  }

  trackByRequestId(_index: number, req: any): number {
    return req.request_id;
  }

  /** Tap the card body to expand/retract (toggle) — accordion, so expanding one collapses any other. */
  toggleExpand(requestId: number) {
    const previouslyExpanded = this.expandedId;
    const opening = this.expandedId !== requestId;
    this.expandedId = opening ? requestId : null;

    // Whichever card just lost its expanded state (if any) stays mounted,
    // driven by [appRevealAnimate]="false", until its close tween finishes.
    if (previouslyExpanded !== null && previouslyExpanded !== this.expandedId) {
      this.closingIds.add(previouslyExpanded);
    }

    if (!opening) {
      this.openAnimateId = null;
      return;
    }

    // Mount this tick with openAnimateId still null (=> [appRevealAnimate]
    // false), so RevealAnimateDirective's ngAfterViewInit collapses it
    // immediately with no animation — the correct "resting" starting point.
    // Two rAFs later (matching the double-rAF pattern documented in
    // flip-reflow.util.ts: first for Angular to commit the *ngIf mount +
    // the directive's immediate-collapse, second for the browser to have
    // actually painted that collapsed frame), flip openAnimateId to this
    // card's id — a real isOpen change RevealAnimateDirective picks up via
    // ngOnChanges, which is the path that plays the open tween.
    this.openAnimateId = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Guard: user may have tapped a different card again before this
        // fired — only apply if this card is still the one being opened.
        if (this.expandedId === requestId) this.openAnimateId = requestId;
      });
    });
  }

  /** RevealAnimateDirective (closed) callback — safe to actually unmount now. */
  onCardCollapsed(requestId: number) {
    this.closingIds.delete(requestId);
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
  }

  openMedia(filePath: string) {
    this.dialog.openLightbox(filePath, this.isVideoFile(filePath));
  }

  async cancelRequest(requestId: number) {
    const user = JSON.parse(localStorage.getItem('user')!);
    this.api.cancelEmergency({ request_id: requestId, user_id: user.user_id }).subscribe({
      next: async () => {
        const t = await this.toastCtrl.create({ message: 'Request cancelled.', duration: 2000, color: 'medium' });
        t.present(); this.load();
      },
      error: async () => {
        const t = await this.toastCtrl.create({ message: 'Failed to cancel.', duration: 2000, color: 'danger' });
        t.present();
      }
    });
  }

  goToSos()    { this.router.navigate(['/report'], { queryParams: { type: 'emergency' } }); }
  goToHazard() { this.router.navigate(['/report'], { queryParams: { type: 'hazard' } }); }

  statusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'warning'; case 'Dispatched': return 'primary';
      case 'Resolved': return 'success'; default: return 'medium';
    }
  }

  iconClass(req: any): string {
    if (req.incident_name === 'Fire')    return 'fa-solid fa-fire';
    if (req.incident_name === 'Flood')   return 'fa-solid fa-cloud-showers-heavy';
    if (req.incident_name === 'Medical') return 'fa-solid fa-heart-pulse';
    if (req.incident_name === 'Crime')   return 'fa-solid fa-handcuffs';
    if (req.hazard_type)                 return 'fa-solid fa-road-barrier';
    return 'fa-solid fa-circle-question';
  }
}
