import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonList, IonItem, IonInput, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';

/**
 * RegisterAccountDetailsComponent — Step 2: Account Credentials & Security
 * (Username with live suggestions, Email availability check, Password + strength meter, Confirm Password match).
 */
@Component({
  selector: 'app-register-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule, IonList, IonItem, IonInput, IonInputPasswordToggle],
  templateUrl: './register-account-details.component.html',
  styleUrls: ['./register-account-details.component.scss']
})
export class RegisterAccountDetailsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  @Input() userData: any;

  passwordFocused = false;

  usernameAvailable: boolean | null = null;
  emailAvailable: boolean | null = null;
  usernameSuggestions: string[] = [];
  isLoadingSuggestions = false;

  private usernameDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private emailDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!this.userData.username && (this.userData.first_name || this.userData.last_name)) {
      this.fetchProactiveSuggestions();
    }
  }

  ngOnDestroy(): void {
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
  }

  get pwdLength(): boolean { return (this.userData.password?.length ?? 0) >= 8; }
  get pwdUpper(): boolean { return /[A-Z]/.test(this.userData.password ?? ''); }
  get pwdLower(): boolean { return /[a-z]/.test(this.userData.password ?? ''); }
  get pwdNum(): boolean { return /\d/.test(this.userData.password ?? ''); }
  get pwdSym(): boolean { return /[@$!%*#?&]/.test(this.userData.password ?? ''); }

  get isPasswordValid(): boolean {
    return this.pwdLength && this.pwdUpper && this.pwdLower && this.pwdNum && this.pwdSym;
  }

  get passwordsMatch(): boolean | null {
    const confirm = (this.userData.confirm_password ?? '').trim();
    if (!confirm) return null;
    return this.userData.password === this.userData.confirm_password;
  }

  isUsernameFormatValid(): boolean {
    const u = (this.userData.username ?? '').trim();
    return u.length >= 3 && u.length <= 20 && /^[a-zA-Z0-9._]+$/.test(u);
  }

  fetchProactiveSuggestions(): void {
    this.isLoadingSuggestions = true;
    this.api.checkUsername('', {
      first_name: this.userData.first_name,
      last_name: this.userData.last_name,
      birthdate: this.userData.birthdate
    }).subscribe({
      next: (res: any) => {
        this.isLoadingSuggestions = false;
        if (res?.suggestions?.length) {
          this.usernameSuggestions = res.suggestions;
        }
      },
      error: () => { this.isLoadingSuggestions = false; }
    });
  }

  onUsernameInput(): void {
    const username = (this.userData.username ?? '').trim();
    if (!username) {
      this.usernameAvailable = null;
      this.fetchProactiveSuggestions();
      return;
    }
    if (!this.isUsernameFormatValid()) {
      this.usernameAvailable = false;
      return;
    }
    this.usernameAvailable = null;
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    this.usernameDebounceTimer = setTimeout(() => {
      this.api.checkUsername(username, {
        first_name: this.userData.first_name,
        last_name: this.userData.last_name,
        birthdate: this.userData.birthdate
      }).subscribe({
        next: (res: any) => {
          this.usernameAvailable = res?.available ?? false;
          if (res?.suggestions?.length) {
            this.usernameSuggestions = res.suggestions;
          }
        },
        error: () => { this.usernameAvailable = null; }
      });
    }, 350);
  }

  isEmailFormatValid(): boolean {
    const email = (this.userData.email ?? '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  onEmailInput(): void {
    const email = (this.userData.email ?? '').trim();
    if (!email) { this.emailAvailable = null; return; }
    if (!this.isEmailFormatValid()) { this.emailAvailable = false; return; }
    this.emailAvailable = null;
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
    this.emailDebounceTimer = setTimeout(() => {
      this.api.checkEmail(email).subscribe({
        next: (res: any) => { this.emailAvailable = res?.available ?? false; },
        error: () => { this.emailAvailable = null; }
      });
    }, 400);
  }

  applySuggestion(name: string): void {
    this.userData.username = name;
    this.usernameAvailable = true;
    this.onUsernameInput();
  }
}
