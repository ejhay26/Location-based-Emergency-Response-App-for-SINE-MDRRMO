import { Component, OnInit } from '@angular/core';
import { Alerts } from '../services/alerts';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: true,
})
export class AdminDashboardPage implements OnInit {

  alerts:any[] = [];

  constructor(private alertService: Alerts) {}

  ngOnInit() {
    this.alertService.getAlerts((data:any)=>{
      this.alerts = data ? Object.values(data) : [];
    });
  }

}
