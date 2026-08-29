import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth-guard';
import { GuestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },

  // ── Auth ────────────────────────────────────────────────────────────────
  {
    path: 'welcome',
    loadComponent: () => import('./features/auth/welcome/welcome.page').then(m => m.WelcomePage),
    canActivate: [GuestGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage),
    canActivate: [GuestGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage),
    canActivate: [GuestGuard],
  },
  {
    path: 'pending-verification',
    loadComponent: () => import('./features/auth/pending-verification/pending-verification.page').then(m => m.PendingVerificationPage),
    canActivate: [GuestGuard],
  },

  // ── Admin / Dispatcher ──────────────────────────────────────────────────
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage),
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'dispatcher'] },
  },

  // ── Citizen tabs ─────────────────────────────────────────────────────────
  {
    path: 'tabs',
    loadComponent: () => import('./features/citizen/tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] },
    children: [
      { path: 'home',     loadComponent: () => import('./features/citizen/home/home.page').then(m => m.HomePage) },
      { path: 'history',  loadComponent: () => import('./features/citizen/history/history.page').then(m => m.HistoryPage) },
      { path: 'profile',  loadComponent: () => import('./features/citizen/profile/profile.page').then(m => m.ProfilePage) },
      { path: 'settings', loadComponent: () => import('./features/citizen/settings/settings.page').then(m => m.SettingsPage) },
      { path: 'help',     loadComponent: () => import('./features/citizen/help/help.page').then(m => m.HelpPage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: 'account-setup',
    loadComponent: () => import('./features/auth/account-setup/account-setup.page').then(m => m.AccountSetupPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] },
  },
  {
    path: 'report',
    loadComponent: () => import('./features/citizen/report/report.page').then(m => m.ReportPage),
    canActivate: [AuthGuard],
    data: { roles: ['citizen'] },
  },

  // ── Legacy redirects ─────────────────────────────────────────────────────
  { path: 'home',     redirectTo: 'tabs/home',     pathMatch: 'full' },
  { path: 'profile',  redirectTo: 'tabs/profile',  pathMatch: 'full' },
  { path: 'settings', redirectTo: 'tabs/settings', pathMatch: 'full' },
  { path: 'status',   redirectTo: 'tabs/history',  pathMatch: 'full' },
  { path: 'history',  redirectTo: 'tabs/history',  pathMatch: 'full' },
  { path: 'help',     redirectTo: 'tabs/help',     pathMatch: 'full' },
];
