import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { BroadcastRefreshService } from '../../../core/services/broadcast-refresh';
import { parseServerDate } from '../../../shared/pipes/utc-date.pipe';

const REFRESH_INTERVAL_MS = 60_000; // 1 minute

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent],
})
export class HomePage implements OnInit, OnDestroy {
  userFirstName = '';
  activeBroadcasts: any[] = [];

  private pollSub?: Subscription;
  private pushRefreshSub?: Subscription;

  constructor(
    private router: Router,
    private api: ApiService,
    public tour: TourService,
    private broadcastRefresh: BroadcastRefreshService,
  ) {}

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) this.userFirstName = JSON.parse(userStr).first_name || '';

    this.fetchBroadcasts();

    // Keep the announcement panel live without requiring the user to leave
    // and re-enter the tab: poll on an interval, plus refetch instantly
    // whenever a broadcast push notification arrives in the foreground.
    this.pollSub = interval(REFRESH_INTERVAL_MS).subscribe(() => this.fetchBroadcasts());
    this.pushRefreshSub = this.broadcastRefresh.onRefresh.subscribe(() => this.fetchBroadcasts());
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.pushRefreshSub?.unsubscribe();
  }

  fetchBroadcasts() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => { this.activeBroadcasts = Array.isArray(res) ? res : (res?.message ? [res] : []); },
      error: () => {}
    });
  }

  timeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  goToSos() {
    this.tour.onInteraction();
    if (!this.tour.isActive()) this.router.navigate(['/report'], { queryParams: { type: 'emergency' } });
  }

  goToHazard() {
    this.tour.onInteraction();
    if (!this.tour.isActive()) this.router.navigate(['/report'], { queryParams: { type: 'hazard' } });
  }
}
