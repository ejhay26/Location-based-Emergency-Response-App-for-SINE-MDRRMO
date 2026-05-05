import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { GuestGuard } from './guards/guest-guard'; // <-- Import the new guard

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then( m => m.LoginPage),
    canActivate: [GuestGuard] // <-- Logged-in users can't see this
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then( m => m.RegisterPage),
    canActivate: [GuestGuard] // <-- Logged-in users can't see this
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [AuthGuard],
    data: { role: 'citizen' } // <-- Only citizens can see this
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.page').then( m => m.AdminDashboardPage),
    canActivate: [AuthGuard],
    data: { role: 'admin' } // <-- Only admins can see this
  },
  {
    path: 'sos',
    loadComponent: () => import('./sos/sos.page').then( m => m.SosPage),
    canActivate: [AuthGuard],
    data: { role: 'citizen' } // <-- Only citizens can trigger an SOS
  }
];