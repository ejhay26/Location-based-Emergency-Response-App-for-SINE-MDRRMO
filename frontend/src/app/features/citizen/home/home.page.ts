import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent],
})
export class HomePage implements OnInit {
  userFirstName = '';
  activeBroadcast: any = null;
  broadcastDismissed = false;

  constructor(private router: Router, private api: ApiService, public tour: TourService) {}

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) this.userFirstName = JSON.parse(userStr).first_name || '';
    this.fetchBroadcast();
  }

  fetchBroadcast() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => { this.activeBroadcast = res?.message ? res : null; this.broadcastDismissed = false; },
      error: () => {}
    });
  }

  dismissBroadcast() { this.broadcastDismissed = true; }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
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
