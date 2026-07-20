import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { GuestGuard } from './guards/guest-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },

  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome.page').then(m => m.WelcomePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage),
    canActivate: [GuestGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then(m => m.RegisterPage),
    canActivate: [GuestGuard],
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'dispatcher'] },
  },

  // Citizen tab shell — all citizen pages live under /tabs/* so the bottom
  // tab bar persists across navigation.
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] },
    children: [
      { path: 'home',     loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
      { path: 'status',   loadComponent: () => import('./status/status.page').then(m => m.StatusPage) },
      { path: 'profile',  loadComponent: () => import('./profile/profile.page').then(m => m.ProfilePage) },
      { path: 'settings', loadComponent: () => import('./settings/settings.page').then(m => m.SettingsPage) },
      { path: 'help',     loadComponent: () => import('./help/help.page').then(m => m.HelpPage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },

  // Report stays at root level — slides in as full-screen push, no tab bar.
  {
    path: 'report',
    loadComponent: () => import('./report/report.page').then(m => m.ReportPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] },
  },

  // Legacy redirects — kept for any bookmarks or stored deep links
  { path: 'home',     redirectTo: 'tabs/home',    pathMatch: 'full' },
  { path: 'profile',  redirectTo: 'tabs/profile', pathMatch: 'full' },
  { path: 'settings', redirectTo: 'tabs/settings', pathMatch: 'full' },
  { path: 'status',   redirectTo: 'tabs/status',  pathMatch: 'full' },
  { path: 'help',     redirectTo: 'tabs/help',    pathMatch: 'full' },
];