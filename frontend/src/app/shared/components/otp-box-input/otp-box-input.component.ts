import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * OtpBoxInputComponent — 4 separate numeric digit boxes instead of one
 * text field, per the OTP redesign. Used identically across registration,
 * login-OTP, and password-reset OTP entry (previously each had its own
 * single `<ion-input>` — this replaces all three so there's one place to
 * fix OTP-entry UX instead of three).
 *
 * - Auto-advances focus to the next box on digit entry, and back on
 *   Backspace when the current box is already empty.
 * - Pasting a 4-digit code (e.g. from a notification/clipboard) fills all
 *   four boxes at once from a single paste into any box.
 * - `inputmode="numeric"` + `type="tel"` opens the numeric keypad only on
 *   mobile, never the full alphanumeric keyboard — the specific ask behind
 *   the redesign.
 * - Emits the joined 4-digit string on every change via `codeChange`
 *   (works with `[(code)]` two-way binding) and fires `completed` once,
 *   exactly when the 4th digit is entered, so callers can auto-submit
 *   without polling `code.length === 4` themselves.
 */
@Component({
  selector: 'app-otp-box-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './otp-box-input.component.html',
  styleUrl: './otp-box-input.component.scss',
})
export class OtpBoxInputComponent {
  @Input() disabled = false;
  @Input()
  get code(): string { return this._code; }
  set code(value: string) {
    this._code = (value || '').slice(0, 4);
    this.digits = this.splitToDigits(this._code);
  }
  @Output() codeChange = new EventEmitter<string>();
  @Output() completed = new EventEmitter<string>();

  @ViewChildren('boxInput') boxInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private _code = '';
  digits: string[] = ['', '', '', ''];
  boxIndexes = [0, 1, 2, 3];

  private splitToDigits(value: string): string[] {
    const chars = value.replace(/\D/g, '').split('');
    return [0, 1, 2, 3].map(i => chars[i] ?? '');
  }

  private emitCurrent(): void {
    const joined = this.digits.join('');
    this._code = joined;
    this.codeChange.emit(joined);
    if (joined.length === 4 && this.digits.every(d => d !== '')) {
      this.completed.emit(joined);
    }
  }

  onInput(index: number, rawValue: string): void {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      // Autofill (iOS QuickType, or a browser/keyboard code suggestion) can
      // insert the FULL code into a single box's `input` event instead of
      // firing `paste` — `maxlength="1"` only restricts typed input, not
      // script/autofill-driven value assignment, so this path is reachable
      // in practice. Treat it identically to a paste, filling forward from
      // whichever box received it.
      this.fillFrom(index, digitsOnly);
      return;
    }
    this.digits[index] = digitsOnly;
    this.emitCurrent();
    if (digitsOnly && index < 3) {
      this.boxInputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      this.boxInputs.get(index - 1)?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digitsOnly = pasted.replace(/\D/g, '');
    if (!digitsOnly) return;
    event.preventDefault();
    this.fillFrom(0, digitsOnly);
  }

  /**
   * Shared by onPaste (always starts at box 0) and onInput's autofill path
   * (starts at whichever box received the multi-character value). Fills
   * boxes left-to-right from startIndex, stopping at the last box (index 3)
   * regardless of how many extra characters were supplied.
   */
  private fillFrom(startIndex: number, digitsOnly: string): void {
    const chars = digitsOnly.split('');
    for (let i = startIndex; i < 4 && (i - startIndex) < chars.length; i++) {
      this.digits[i] = chars[i - startIndex];
    }
    this.emitCurrent();
    const lastFilled = Math.min(startIndex + chars.length, 4) - 1;
    if (lastFilled >= 0) {
      this.boxInputs.get(Math.min(lastFilled, 3))?.nativeElement.focus();
    }
  }
}
