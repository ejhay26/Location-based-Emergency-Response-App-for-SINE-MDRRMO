import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonCard, IonItem,
  IonLabel, IonBadge, IonRefresher, IonRefresherContent, IonSkeletonText, IonList
} from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
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
export class HistoryPage {
  /** Exposed to the template so the status-filter row can be rendered from one source of truth. */
  readonly statusFilters = STATUS_FILTERS;

  emergencies: any[] = [];
  isLoading = false;

  statusFilter: StatusFilter = 'All';
  dateFilter: DateFilterValue | null = null;

  /** Accordion behavior — only one card expanded at a time. */
  expandedId: number | null = null;

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private router: Router,
    private dialog: DialogService,
    public tour: TourService,
  ) {}

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

  setStatusFilter(f: StatusFilter) { this.statusFilter = f; }

  onDateFilterChange(v: DateFilterValue | null) { this.dateFilter = v; }

  clearAllFilters() {
    this.statusFilter = 'All';
    this.dateFilter = null;
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

  /** Tap the card body to expand/retract (toggle) — accordion, so expanding one collapses any other. */
  toggleExpand(requestId: number) {
    this.expandedId = this.expandedId === requestId ? null : requestId;
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
