import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonBadge } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { VideoThumbnailDirective } from '../../../../../shared/directives/video-thumbnail.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';

@Component({
  selector: 'app-log-archive-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonBadge, ProxyImageDirective, VideoThumbnailDirective, UtcDatePipe],
  templateUrl: './log-archive.panel.html',
})
export class LogArchivePanel implements OnInit {

  archivedRequests: any[] = [];

  archiveFilter: 'all' | 'resolved' | 'false_alarm' | 'cancelled' = 'all';
  archiveSort: 'newest' | 'oldest' | 'type' = 'newest';
  archiveTypeFilter = 'all';

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getArchivedEmergencies().subscribe((res: any) => { this.archivedRequests = res; });
  }

  get filteredArchivedRequests(): any[] {
    let list = [...this.archivedRequests];
    if (this.archiveFilter === 'resolved')    list = list.filter(r => r.status === 'Resolved' && !r.is_false_alarm);
    if (this.archiveFilter === 'false_alarm') list = list.filter(r => r.is_false_alarm);
    if (this.archiveFilter === 'cancelled')   list = list.filter(r => r.status === 'Cancelled');
    if (this.archiveTypeFilter !== 'all')     list = list.filter(r => r.incident_name === this.archiveTypeFilter);
    if (this.archiveSort === 'newest') list.sort((a, b) => new Date(b.request_time).getTime() - new Date(a.request_time).getTime());
    if (this.archiveSort === 'oldest') list.sort((a, b) => new Date(a.request_time).getTime() - new Date(b.request_time).getTime());
    if (this.archiveSort === 'type')   list.sort((a, b) => a.incident_name.localeCompare(b.incident_name));
    return list;
  }

  get archiveIncidentTypes(): string[] {
    return [...new Set(this.archivedRequests.map(r => r.incident_name))].sort();
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.ui.showConfirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'fa-solid fa-triangle-exclamation', iconColor: '#eb445a', confirmLabel: 'Mark False Alarm', confirmColor: '#eb445a',
      action: () => {
        this.api.markFalseAlarm({ request_id: requestId }).subscribe({
          next: (res: any) => { this.ui.showToast(res.message, 'warning'); this.loadData(); },
          error: (err: any) => this.ui.showToast(err.error?.message || 'Failed to mark false alarm.', 'danger')
        });
      }
    });
  }
}
