import { Component, OnInit } from '@angular/core';
import { IonicModule, MenuController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class AppComponent implements OnInit {
  
  userFullName: string = 'Loading...';
  userRole: string = '';
  isDarkMode = false;

  constructor(private router: Router, private menuCtrl: MenuController) {}

  ngOnInit() {
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('ion-palette-dark', this.isDarkMode);
  }

  menuOpened() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userFullName = `${user.first_name} ${user.last_name}`;
      
      const role = localStorage.getItem('role');
      if (role === 'admin') {
        this.userRole = 'Master Admin';
      } else if (role === 'dispatcher') {
        this.userRole = 'Dispatcher';
      } else {
        this.userRole = 'Citizen';
      }
    }
  }

  toggleDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    document.documentElement.classList.toggle('ion-palette-dark', this.isDarkMode);
    localStorage.setItem('darkMode', String(this.isDarkMode));
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    this.router.navigate(['/login']);
  }
}