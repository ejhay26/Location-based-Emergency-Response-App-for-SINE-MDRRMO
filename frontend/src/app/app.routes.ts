import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { GuestGuard } from './guards/guest-guard'; 

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then( m => m.LoginPage),
    canActivate: [GuestGuard] 
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then( m => m.RegisterPage),
    canActivate: [GuestGuard] 
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] } // Only citizens allowed
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.page').then( m => m.AdminDashboardPage),
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'dispatcher'] } // Admin AND Dispatcher allowed!
  },
  // removed this page for unified report page, but can be added back if we want separate flows for hazards vs emergencies
  // {
  //   path: 'sos',
  //   loadComponent: () => import('./sos/sos.page').then( m => m.SosPage),
  //   canActivate: [AuthGuard],
  //   data: { roles: ['citizen'] } // Only citizens can trigger an SOS
  // },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then( m => m.ProfilePage),
    canActivate: [AuthGuard] // Anyone who is logged in can view their profile
  },
  // removed this page for unified report page, but can be added back if we want separate flows for hazards vs emergencies
  // {
  //   path: 'hazard',
  //   loadComponent: () => import('./hazard/hazard.page').then( m => m.HazardPage)
  // },
  {
    path: 'report',
    loadComponent: () => import('./report/report.page').then( m => m.ReportPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] } // Only citizens can report emergencies or hazards
  }

];