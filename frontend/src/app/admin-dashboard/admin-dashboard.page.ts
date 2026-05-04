import { Component } from '@angular/core';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
  IonItem, IonLabel, IonBadge, IonButton 
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: 'admin-dashboard.page.html',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, 
    IonItem, IonLabel, IonBadge, IonButton
  ]
})
export class AdminDashboardPage {
  incomingRequests = [
    { request_id: 101, first_name: 'Juan', last_name: 'Dela Cruz', phone: '09123456789', incident_type: 'Medical', barangay: 'San Isidro', status: 'Pending', time: 'Just now' },
    { request_id: 102, first_name: 'Maria', last_name: 'Santos', phone: '09987654321', incident_type: 'Fire', barangay: 'Poblacion', status: 'Dispatched', time: '15 mins ago' }
  ];
}
