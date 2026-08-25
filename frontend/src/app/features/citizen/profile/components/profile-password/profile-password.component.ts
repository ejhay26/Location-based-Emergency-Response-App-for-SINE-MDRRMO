import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonItem, IonInput, IonCard, IonCardContent, AlertController } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { OtpAutofillService } from '../../../../../core/services/otp-autofill';
import { OtpBoxInputComponent } from '../../../../../shared/components/otp-box-input/otp-box-input.component';
import { ToastRequest } from '../profile-shared-types';

/**
 * ProfilePasswordComponent — the multi-step password-change flow (choose
 * channel → verify OTP → set new password) extracted from profile.page.
 * Receives already-masked email/phone strings from the parent rather than
 * duplicating maskEmail/maskPhone here, since the parent already computes
 * those for its own Contact & Location display.
 *
 * NOTE: deliberately NOT animated. Two separate attempts at a close
 * animation for this component's step transitions (via
 * RevealAnimateDirective) both produced a live visual bug — a step getting
 * stuck mid-collapse, clipped to a sliver — that couldn't be reliably
 * reproduced or root-caused without live debugging access. Reverted to
 * this plain, stable version rather than risk a third attempt. If
 * animating this component is revisited later, it should be a fresh,
 * carefully-isolated attempt, not a repeat of the same approach.
 */
@Component({
  selector: 'app-profile-password',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonItem, IonInput, IonCard, IonCardContent, OtpBoxInputComponent],
  templateUrl: './profile-password.component.html',
})
export class ProfilePasswordComponent implements OnDestroy {
  private api         = inject(ApiService);
  private alertCtrl   = inject(AlertController);
  private otpAutofill = inject(OtpAutofillService);

  @Input() userId: number | null = null;
  @Input() maskedEmail = '';
  @Input() maskedPhone = '';

  @Output() toast = new EventEmitter<ToastRequest>();

  pwdStep: 'idle' | 'choose-channel' | 'enter-otp' | 'change-password' = 'idle';
  pwdChannel: 'email' | 'phone' | null = null;
  pwdOtp = '';
  pwdSending = false;
  pwdVerifying = false;
  pwdFocused = false;
  passwords = { new: '', confirm: '' };
  isUpdatingPassword = false;

  /** Resend cooldown, seconds — same 60s shape/interval pattern as login.page.ts's startResendCountdown(). */
  otpResendSecs = 0;
  private resendInterval: any;

  /** Masked identifier for whichever channel was chosen — mirrors login.page.ts's maskedResetIdentifier row. */
  get maskedIdentifier(): string {
    return this.pwdChannel === 'phone' ? this.maskedPhone : this.maskedEmail;
  }

  checkLength(): boolean { return this.passwords.new?.length >= 8; }
  checkUpper(): boolean  { return /[A-Z]/.test(this.passwords.new); }
  checkLower(): boolean  { return /[a-z]/.test(this.passwords.new); }
  checkNum(): boolean    { return /\d/.test(this.passwords.new); }
  checkSym(): boolean    { return /[@$!%*#?&]/.test(this.passwords.new); }
  get passwordMeetsAllRules(): boolean {
    return this.checkLength() && this.checkUpper() && this.checkLower() && this.checkNum() && this.checkSym();
  }
  get passwordsMatch(): boolean {
    return this.passwords.new.length > 0 && this.passwords.new === this.passwords.confirm;
  }

  ngOnDestroy() {
    this.otpAutofill.stop();
    clearInterval(this.resendInterval);
  }

  startPasswordChange() {
    this.pwdStep = 'choose-channel'; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' };
    this.otpResendSecs = 0; clearInterval(this.resendInterval);
  }
  cancelPasswordChange() {
    this.otpAutofill.stop();
    clearInterval(this.resendInterval); this.otpResendSecs = 0;
    this.pwdStep = 'idle'; this.pwdChannel = null; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' };
  }

  /** @param seconds Defaults to the client's optimistic 60s; pass the backend's actual retry_after (from a 429) to stay in sync with the real per-identifier cooldown instead of guessing. */
  private startResendCountdown(seconds = 60) {
    this.otpResendSecs = seconds;
    clearInterval(this.resendInterval);
    this.resendInterval = setInterval(() => {
      this.otpResendSecs--;
      if (this.otpResendSecs <= 0) clearInterval(this.resendInterval);
    }, 1000);
  }

  /** Sends (or, once pwdStep is 'enter-otp', resends) the code for the chosen channel. Guarded by the same cooldown shown to the user. */
  sendPwdChangeOtp(channel: 'email' | 'phone') {
    if (this.otpResendSecs > 0 || this.pwdSending) return;
    this.pwdChannel = channel; this.pwdSending = true;
    this.api.sendPasswordChangeOtp({ user_id: this.userId, channel }).subscribe({
      next: () => {
        this.pwdSending = false; this.pwdStep = 'enter-otp'; this.pwdOtp = '';
        this.startResendCountdown();
        const msg = channel === 'email'
          ? 'Verification code sent! Please check your inbox and spam/junk folder.'
          : 'Verification code sent to your mobile phone.';
        this.toast.emit({ msg, color: 'success' });
        if (channel === 'phone') {
          this.otpAutofill.listen(code => { this.pwdOtp = code; this.verifyPwdChangeOtp(); });
        }
      },
      error: (err: any) => {
        this.pwdSending = false;
        if (err.status === 429) {
          // Per-identifier OTP abuse limit (OtpService::requestOtp). A code
          // may already be pending, so stay on/advance to enter-otp and
          // sync the countdown to the backend's real remaining cooldown.
          this.pwdStep = 'enter-otp';
          if (err.error?.retry_after) this.startResendCountdown(err.error.retry_after);
          this.toast.emit({ msg: err.error?.message || 'A code was already sent. Please wait before requesting another.', color: 'warning' });
          return;
        }
        this.toast.emit({ msg: err.error?.message || 'Failed to send code. Try again.', color: 'danger' });
      }
    });
  }

  verifyPwdChangeOtp() {
    if (!this.pwdOtp || this.pwdOtp.length < 6 || this.pwdVerifying) return;
    this.pwdVerifying = true;
    this.api.verifyPasswordChangeOtp({ user_id: this.userId, otp: this.pwdOtp }).subscribe({
      next: () => {
        this.pwdVerifying = false; this.pwdStep = 'change-password';
        this.otpAutofill.stop(); clearInterval(this.resendInterval); this.otpResendSecs = 0;
      },
      error: (err: any) => {
        this.pwdVerifying = false;
        this.toast.emit({ msg: err.error?.message || 'Invalid or expired code. Try again.', color: 'danger' });
      }
    });
  }

  async updatePassword() {
    if (!this.passwordMeetsAllRules) { this.toast.emit({ msg: 'New password does not meet all requirements.', color: 'danger' }); return; }
    if (!this.passwordsMatch)        { this.toast.emit({ msg: 'Passwords do not match.', color: 'danger' }); return; }
    if (this.isUpdatingPassword) return;
    const alert = await this.alertCtrl.create({
      header: 'Confirm Password Change', message: 'Are you sure you want to change your password?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm', role: 'confirm', handler: () => {
          this.isUpdatingPassword = true;
          this.api.updatePassword({ user_id: this.userId, new_password: this.passwords.new, otp_verified: true }).subscribe({
            next: () => { this.isUpdatingPassword = false; this.toast.emit({ msg: 'Password updated!', color: 'success' }); this.cancelPasswordChange(); },
            error: (err: any) => { this.isUpdatingPassword = false; this.toast.emit({ msg: err.error?.message || 'Update failed.', color: 'danger' }); }
          });
        }}
      ]
    });
    await alert.present();
  }
}
