import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { GuestGuard } from './guards/guest-guard';

export const routes: Routes = [
  {
    // Root → welcome. The welcome page itself decides where to go next:
    //   - first-time user: stays on welcome, then Login or Register
    //   - returning user (welcomeSeen=true + stored session): straight to dashboard
    //   - returning user (welcomeSeen=true, no session): straight to login
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full',
  },
  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome.page').then(m => m.WelcomePage),
    // No guard — the page handles its own redirect logic
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage),
    canActivate: [GuestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then(m => m.RegisterPage),
    canActivate: [GuestGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] }
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'dispatcher'] }
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then(m => m.ProfilePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'report',
    loadComponent: () => import('./report/report.page').then(m => m.ReportPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] }
  }
];