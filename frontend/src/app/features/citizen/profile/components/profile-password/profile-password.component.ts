import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonItem, IonInput, IonCard, IonCardContent, AlertController } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { OtpAutofillService } from '../../../../../core/services/otp-autofill';
import { ToastRequest } from '../profile-shared-types';

/**
 * ProfilePasswordComponent — the multi-step password-change flow (choose
 * channel → verify OTP → set new password) extracted from profile.page.
 * Receives already-masked email/phone strings from the parent rather than
 * duplicating maskEmail/maskPhone here, since the parent already computes
 * those for its own Contact & Location display.
 */
@Component({
  selector: 'app-profile-password',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonItem, IonInput, IonCard, IonCardContent],
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
  }

  startPasswordChange() { this.pwdStep = 'choose-channel'; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' }; }
  cancelPasswordChange() {
    this.otpAutofill.stop();
    this.pwdStep = 'idle'; this.pwdChannel = null; this.pwdOtp = ''; this.passwords = { new: '', confirm: '' };
  }

  sendPwdChangeOtp(channel: 'email' | 'phone') {
    this.pwdChannel = channel; this.pwdSending = true;
    this.api.sendPasswordChangeOtp({ user_id: this.userId, channel }).subscribe({
      next: () => {
        this.pwdSending = false; this.pwdStep = 'enter-otp';
        this.toast.emit({ msg: 'Verification code sent.', color: 'success' });
        this.otpAutofill.listen(code => { this.pwdOtp = code; this.verifyPwdChangeOtp(); });
      },
      error: () => { this.pwdSending = false; this.toast.emit({ msg: 'Failed to send code. Try again.', color: 'danger' }); }
    });
  }

  onPwdOtpInput() { if (this.pwdOtp && this.pwdOtp.length === 4) this.verifyPwdChangeOtp(); }

  verifyPwdChangeOtp() {
    if (!this.pwdOtp || this.pwdOtp.length < 4 || this.pwdVerifying) return;
    this.pwdVerifying = true;
    this.api.verifyPasswordChangeOtp({ user_id: this.userId, otp: this.pwdOtp }).subscribe({
      next: () => { this.pwdVerifying = false; this.pwdStep = 'change-password'; this.otpAutofill.stop(); },
      error: () => { this.pwdVerifying = false; this.toast.emit({ msg: 'Invalid or expired code. Try again.', color: 'danger' }); }
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
