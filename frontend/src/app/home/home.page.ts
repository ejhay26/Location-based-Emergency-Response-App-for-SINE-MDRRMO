import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, 
  IonList, IonListHeader, IonItem, IonLabel, IonBadge 
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonButton, IonList, IonListHeader, IonItem, IonLabel, IonBadge
  ]
})
export class HomePage {
  recentRequests = [
    { request_id: 1, incident_type: 'Medical', status: 'Pending', date: 'May 4, 2026 10:00 AM' },
    { request_id: 2, incident_type: 'Fire', status: 'Resolved', date: 'May 1, 2026 02:30 PM' }
  ];
}
