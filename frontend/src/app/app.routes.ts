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
  {
    path: 'sos',
    loadComponent: () => import('./sos/sos.page').then( m => m.SosPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] } // Only citizens can trigger an SOS
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then( m => m.ProfilePage),
    canActivate: [AuthGuard] // Anyone who is logged in can view their profile
  }
];