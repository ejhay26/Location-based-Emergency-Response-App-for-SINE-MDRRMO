import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle,
  IonContent, IonButton, IonCard, IonItem,
  IonLabel, IonBadge, IonRefresher, IonRefresherContent,
  IonSkeletonText, IonList
} from '@ionic/angular/standalone';
import { ApiService } from '../services/api';

type DateFilter = 'all' | 'week' | 'month';

@Component({
  selector: 'app-status',
  templateUrl: 'status.page.html',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle,
    IonContent, IonButton, IonCard, IonItem,
    IonLabel, IonBadge, IonRefresher, IonRefresherContent,
    IonSkeletonText, IonList,
  ],
})
export class StatusPage {
  emergencies: any[] = [];
  isLoading = false;
  dateFilter: DateFilter = 'all';

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() { this.load(); }

  load(event?: any) {
    const userStr = localStorage.getItem('user');
    if (!userStr) { event?.target.complete(); return; }
    const user = JSON.parse(userStr);
    this.isLoading = !event;

    this.api.getMyEmergencies(user.user_id).subscribe({
      next: (res: any) => {
        this.emergencies = Array.isArray(res) ? res : [];
        this.isLoading = false;
        event?.target.complete();
      },
      error: () => { this.isLoading = false; event?.target.complete(); }
    });
  }

  setFilter(f: DateFilter) { this.dateFilter = f; }

  get filteredEmergencies(): any[] {
    if (this.dateFilter === 'all') return this.emergencies;

    const now = new Date();
    const cutoff = new Date();
    if (this.dateFilter === 'week')  cutoff.setDate(now.getDate() - 7);
    if (this.dateFilter === 'month') cutoff.setMonth(now.getMonth() - 1);

    return this.emergencies.filter(req => {
      const d = new Date(req.request_time);
      return d >= cutoff;
    });
  }

  // Label for the empty state based on active filter
  get emptyLabel(): string {
    if (this.dateFilter === 'week')  return 'No reports in the last 7 days.';
    if (this.dateFilter === 'month') return 'No reports in the last 30 days.';
    return 'You have not submitted any reports yet.';
  }

  async cancelRequest(requestId: number) {
    const user = JSON.parse(localStorage.getItem('user')!);
    this.api.cancelEmergency({ request_id: requestId, user_id: user.user_id }).subscribe({
      next: async () => {
        const t = await this.toastCtrl.create({ message: 'Request cancelled.', duration: 2000, color: 'medium' });
        t.present();
        this.load();
      },
      error: async () => {
        const t = await this.toastCtrl.create({ message: 'Failed to cancel. Try again.', duration: 2000, color: 'danger' });
        t.present();
      }
    });
  }

  goToSos()    { this.router.navigate(['/report'], { queryParams: { type: 'emergency' } }); }
  goToHazard() { this.router.navigate(['/report'], { queryParams: { type: 'hazard'    } }); }

  statusColor(status: string): string {
    switch (status) {
      case 'Pending':    return 'warning';
      case 'Dispatched': return 'primary';
      case 'Resolved':   return 'success';
      default:           return 'medium';
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