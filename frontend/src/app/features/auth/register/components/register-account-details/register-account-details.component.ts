import { Component, Input, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonList, IonItem, IonSelect, IonSelectOption, IonInput, IonInputPasswordToggle, IonChip, IonCheckbox } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { BARANGAYS } from '../../../../../shared/constants/barangays';

/**
 * RegisterAccountDetailsComponent — step 2 body of registration (barangay,
 * username/email availability checks, password + strength meter, OTP
 * channel selector, terms checkbox). Mutates the parent's shared `userData`
 * object directly (passed by reference, same object identity throughout),
 * matching the original single-file component's data flow. The Back/Continue
 * buttons stay on the parent page since they drive page-level step
 * navigation (`prevStep()`/`nextStep()`), consistent with how report.page
 * kept its "Use My Location" button on the parent while delegating to a
 * child method.
 *
 * `usernameAvailable`, `emailAvailable`, and `termsAccepted` are read
 * directly by the parent's nextStep() via a template reference / @ViewChild,
 * the same way report.page reads ReportMapComponent's public state.
 */
@Component({
  selector: 'app-register-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule, IonList, IonItem, IonSelect, IonSelectOption, IonInput, IonInputPasswordToggle, IonChip, IonCheckbox],
  templateUrl: './register-account-details.component.html',
})
export class RegisterAccountDetailsComponent implements OnDestroy {
  private api = inject(ApiService);

  @Input() userData: any;

  barangays = BARANGAYS;

  passwordFocused = false;
  termsAccepted   = false;

  usernameAvailable: boolean | null = null;
  emailAvailable: boolean | null = null;
  usernameSuggestions: string[] = [];

  private usernameDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private emailDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
  }

  get pwdLength(): boolean { return (this.userData.password?.length ?? 0) >= 8; }
  get pwdUpper(): boolean { return /[A-Z]/.test(this.userData.password ?? ''); }
  get pwdLower(): boolean { return /[a-z]/.test(this.userData.password ?? ''); }
  get pwdNum(): boolean { return /\d/.test(this.userData.password ?? ''); }
  get pwdSym(): boolean { return /[@$!%*#?&]/.test(this.userData.password ?? ''); }

  isUsernameFormatValid(): boolean {
    return /^[a-zA-Z0-9._]*$/.test(this.userData.username ?? '');
  }

  isEmailFormatValid(): boolean {
    return /^[^\s@]*@?[^\s@]*\.?[^\s@]*$/.test(this.userData.email ?? '');
  }

  onUsernameInput(): void {
    const username = this.userData.username?.trim() ?? '';
    if (!username) { this.usernameAvailable = null; this.usernameSuggestions = []; return; }
    if (!this.isUsernameFormatValid()) { this.usernameAvailable = false; this.usernameSuggestions = []; return; }
    this.usernameAvailable = null;
    this.usernameSuggestions = [];
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (username.length < 3) return;
    this.usernameDebounceTimer = setTimeout(() => {
      this.api.checkUsername(username).subscribe({
        next: (res: any) => {
          if (res?.available) { this.usernameAvailable = true; this.usernameSuggestions = []; }
          else { this.usernameAvailable = false; this.generateUsernameSuggestions(); }
        },
        error: () => { this.usernameAvailable = null; }
      });
    }, 500);
  }

  onEmailInput(): void {
    const email = this.userData.email?.trim() ?? '';
    if (!email) { this.emailAvailable = null; return; }
    if (!this.isEmailFormatValid()) { this.emailAvailable = false; return; }
    this.emailAvailable = null;
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
    this.emailDebounceTimer = setTimeout(() => {
      this.api.checkEmail(email).subscribe({
        next: (res: any) => { this.emailAvailable = res?.available ?? false; },
        error: () => { this.emailAvailable = null; }
      });
    }, 500);
  }

  private generateUsernameSuggestions(): void {
    const firstName = this.userData.first_name?.toLowerCase().replace(/\s+/g, '') ?? 'user';
    const lastName = this.userData.last_name?.toLowerCase().substring(0, 2) ?? '';
    const birthYear = this.userData.birthdate
      ? new Date(this.userData.birthdate).getFullYear().toString() : '26';
    const base = firstName + lastName;
    this.usernameSuggestions = [
      `${base}_${birthYear}`,
      `${base}${Math.floor(10 + Math.random() * 90)}`,
      `sine_${base}`
    ].filter(s => s.length > 0);
  }

  applySuggestion(name: string): void {
    this.userData.username = name;
    this.usernameAvailable = true;
    this.usernameSuggestions = [];
  }

  selectOtpChannel(channel: 'email' | 'sms'): void {
    this.userData.otp_channel = channel;
  }
}
