import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';

type VerificationStatus = 'checking' | 'unverified' | 'active' | 'banned' | 'not_found' | 'error';

/**
 * Shown after OTP verification during registration (account is created but
 * `account_status` is `unverified`), and reached from the Login page when a
 * login attempt 403s with reason `unverified`. Deliberately not behind
 * AuthGuard — there's no token at this point, only an identifier (email or
 * username) passed in the `login` query param.
 *
 * Polls POST /check-verification-status on an interval rather than opening
 * a WebSocket connection — this screen isn't time-critical enough to
 * justify running broadcast infrastructure just for it.
 */
@Component({
  selector: 'app-pending-verification',
  templateUrl: './pending-verification.page.html',
  standalone: true,
  imports: [CommonModule, RouterModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
})
export class PendingVerificationPage implements OnInit, OnDestroy {

  readonly POLL_INTERVAL_MS = 25_000;

  identifier = '';
  status: VerificationStatus = 'checking';
  private pollHandle: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
  ) {}

  ngOnInit() {
    this.identifier = this.route.snapshot.queryParamMap.get('login') || '';
    if (!this.identifier) {
      // No identifier to check — nothing useful to poll, send them back.
      this.router.navigate(['/login']);
      return;
    }
    this.checkStatus();
    this.pollHandle = setInterval(() => this.checkStatus(), this.POLL_INTERVAL_MS);
  }

  ngOnDestroy() {
    clearInterval(this.pollHandle);
  }

  checkStatus() {
    this.api.checkVerificationStatus(this.identifier).subscribe({
      next: (res: any) => {
        const next: VerificationStatus = res?.status ?? 'error';
        this.status = next;
        if (next === 'active' || next === 'banned' || next === 'not_found') {
          clearInterval(this.pollHandle);
        }
      },
      error: () => {
        // Transient network hiccup — keep polling rather than dead-ending
        // the screen on one failed check.
        this.status = 'error';
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
