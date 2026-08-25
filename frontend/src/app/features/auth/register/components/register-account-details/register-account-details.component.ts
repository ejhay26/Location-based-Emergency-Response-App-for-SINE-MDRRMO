import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonItem, IonInput, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

/**
 * RegisterAccountDetailsComponent — Step 2: Account Credentials & Security
 * Features:
 * - Instant client + server smart username suggestions
 * - Real-time username checklist & availability state feedback
 * - Email format & availability verification
 * - Password 5-rule strength meter + live confirm matching
 */
@Component({
  selector: 'app-register-account-details',
  standalone: true,
  imports: [CommonModule, FormsModule, IonItem, IonInput, IonInputPasswordToggle, AppIconComponent],
  templateUrl: './register-account-details.component.html',
  styleUrls: ['./register-account-details.component.scss']
})
export class RegisterAccountDetailsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  @Input() userData: any;

  usernameFocused = false;
  emailFocused    = false;
  passwordFocused = false;

  usernameAvailable: boolean | null = null;
  emailAvailable: boolean | null = null;
  usernameSuggestions: string[] = [];
  isLoadingSuggestions = false;

  private usernameDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private emailDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.generateClientSuggestions();
    this.fetchProactiveSuggestions();
  }

  ngOnDestroy(): void {
    if (this.usernameDebounceTimer) clearTimeout(this.usernameDebounceTimer);
    if (this.emailDebounceTimer) clearTimeout(this.emailDebounceTimer);
  }

  // Password rules
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

  // Username rules
  get usernameLengthValid(): boolean {
    const len = (this.userData.username ?? '').trim().length;
    return len >= 3 && len <= 20;
  }

  get usernameCharsValid(): boolean {
    const u = (this.userData.username ?? '').trim();
    return u.length > 0 && /^[a-zA-Z0-9._]+$/.test(u);
  }

  isUsernameFormatValid(): boolean {
    return this.usernameLengthValid && this.usernameCharsValid;
  }

  generateClientSuggestions(): void {
    const rawFirst = (this.userData.first_name ?? '').trim().toLowerCase();
    const rawLast = (this.userData.last_name ?? '').trim().toLowerCase();
    const firstWords = rawFirst.split(/[\s\-_]+/).filter((w: string) => w.length > 0);
    const firstWord = firstWords[0] || '';
    const joinedFirst = rawFirst.replace(/[^a-z0-9]/g, '');
    const lastName = rawLast.replace(/[^a-z0-9]/g, '');
    const firstInitials = firstWords.map((w: string) => w[0]).join('');
    const birthYear = this.userData.birthdate ? new Date(this.userData.birthdate).getFullYear().toString() : '26';

    const candidates: string[] = [];
    if (firstInitials.length > 1 && lastName) candidates.push(`${firstInitials}.${lastName}`);
    if (firstInitials.length > 1 && lastName) candidates.push(`${firstInitials}_${lastName}`);
    if (firstWord && lastName) candidates.push(`${firstWord}.${lastName}`);
    if (firstWord && lastName) candidates.push(`${firstWord}_${lastName}`);
    if (firstWord && birthYear) candidates.push(`${firstWord}${birthYear}`);
    if (joinedFirst && joinedFirst !== firstWord && lastName) candidates.push(`${joinedFirst}.${lastName}`);
    if (firstWord) candidates.push(`${firstWord}_sine`);

    if (candidates.length > 0 && this.usernameSuggestions.length === 0) {
      this.usernameSuggestions = candidates.slice(0, 4);
    }
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
      this.generateClientSuggestions();
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
        error: () => {
          this.usernameAvailable = this.isUsernameFormatValid();
        }
      });
    }, 300);
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
        error: () => { this.emailAvailable = this.isEmailFormatValid(); }
      });
    }, 350);
  }

  applySuggestion(name: string): void {
    this.userData.username = name;
    this.usernameAvailable = true;
    this.onUsernameInput();
  }
}
