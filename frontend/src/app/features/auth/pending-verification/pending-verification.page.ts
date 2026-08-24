import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { EchoService } from '../../../core/services/echo.service';

type VerificationStatus = 'checking' | 'unverified' | 'active' | 'banned' | 'not_found' | 'error';

/**
 * Shown after OTP verification during registration (account is created but
 * `account_status` is `unverified`), and reached from the Login page when a
 * login attempt 403s with reason `unverified`. Deliberately not behind
 * AuthGuard — there's no token at this point, only an identifier (email or
 * username) passed in the `login` query param.
 *
 * Real-time strategy (hybrid):
 *   Primary  — Echo `users` channel listens for UserVerified events.
 *              When the admin approves THIS user, the event fires and we
 *              call checkStatus() immediately — the citizen sees their screen
 *              update in under a second rather than waiting for the next poll.
 *   Fallback — 30s interval runs continuously as a safety net for when
 *              the WebSocket is disconnected (network blip, mobile background,
 *              app cold-started without Reverb running yet, etc.).
 *
 * The Echo subscription is intentionally broad (any UserVerified event, not
 * just this user's user_id) because the identifier on this page is an email/
 * username string, not a user_id — we can't filter server-side without an
 * authenticated private channel, which this pre-auth page can't use. The
 * extra HTTP call on an irrelevant approval is negligible.
 */
@Component({
  selector: 'app-pending-verification',
  templateUrl: './pending-verification.page.html',
  standalone: true,
  imports: [CommonModule, RouterModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
})
export class PendingVerificationPage implements OnInit, OnDestroy {

  /** Fallback polling interval in ms — active when the WebSocket is down or reconnecting. */
  readonly POLL_INTERVAL_MS = 4_000;

  identifier = '';
  status: VerificationStatus = 'checking';

  private fallbackPollSub?: Subscription;
  private echoUserSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private echo: EchoService,
  ) {}

  ngOnInit() {
    this.identifier = this.route.snapshot.queryParamMap.get('login') || '';
    if (!this.identifier) {
      this.router.navigate(['/login']);
      return;
    }

    // Initial check immediately on mount.
    this.checkStatus();

    // Primary: Reverb Echo fires the moment an admin approves/rejects any account.
    this.echo.connect();
    this.echoUserSub = this.echo.onUserVerified.subscribe(() => {
      this.checkStatus();
    });

    // Fallback: 4s poll covers disconnected WebSocket scenarios.
    this.fallbackPollSub = interval(this.POLL_INTERVAL_MS).subscribe(() => {
      this.checkStatus();
    });
  }

  ngOnDestroy() {
    this.fallbackPollSub?.unsubscribe();
    this.echoUserSub?.unsubscribe();
    // Do NOT disconnect Echo — it is a root singleton.
  }

  checkStatus() {
    this.api.checkVerificationStatus(this.identifier).subscribe({
      next: (res: any) => {
        const next: VerificationStatus = res?.status ?? 'error';
        this.status = next;

        if (next === 'active') {
          // Stop all polling — account is approved. The template shows a
          // "You're approved!" state; the citizen taps "Go to Login" to
          // complete the flow rather than auto-navigating, because they
          // still need to log in to get a token.
          this.fallbackPollSub?.unsubscribe();
          this.echoUserSub?.unsubscribe();
        }

        if (next === 'banned' || next === 'not_found') {
          this.fallbackPollSub?.unsubscribe();
          this.echoUserSub?.unsubscribe();
        }
      },
      error: () => {
        // Transient network hiccup — keep polling.
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
