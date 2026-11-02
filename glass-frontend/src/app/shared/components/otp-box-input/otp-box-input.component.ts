import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate } from 'motion';

/**
 * OtpBoxInputComponent — 6 separate numeric digit boxes with interactive
 * micro-animations powered by Motion.
 *
 * - Spring scale bounce on each digit typed.
 * - Auto-advances focus while keeping mobile keyboard open.
 * - Supports states: 'idle' | 'verifying' | 'success' | 'error'.
 * - 'success': staggered emerald cascade + SVG checkmark overlay.
 * - 'error': physics-based horizontal shake + red border flash.
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
  @Input() state: 'idle' | 'verifying' | 'success' | 'error' = 'idle';

  @Input()
  get code(): string { return this._code; }
  set code(value: string) {
    this._code = (value || '').slice(0, 6);
    this.digits = this.splitToDigits(this._code);
  }
  @Output() codeChange = new EventEmitter<string>();
  @Output() completed = new EventEmitter<string>();

  @ViewChild('rowContainer') rowContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren('boxInput') boxInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private _code = '';
  digits: string[] = ['', '', '', '', '', ''];
  boxIndexes = [0, 1, 2, 3, 4, 5];

  private splitToDigits(value: string): string[] {
    const chars = value.replace(/\D/g, '').split('');
    return [0, 1, 2, 3, 4, 5].map(i => chars[i] ?? '');
  }

  private emitCurrent(): void {
    const joined = this.digits.join('');
    this._code = joined;
    this.codeChange.emit(joined);
    if (joined.length === 6 && this.digits.every(d => d !== '')) {
      this.state = 'verifying';
      this.completed.emit(joined);
    } else if (this.state === 'error') {
      this.state = 'idle';
    }
  }

  onInput(index: number, rawValue: string): void {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      this.fillFrom(index, digitsOnly);
      return;
    }
    this.digits[index] = digitsOnly;

    // Trigger Motion micro-bounce on the entered digit
    if (digitsOnly) {
      const boxEl = this.boxInputs.get(index)?.nativeElement;
      if (boxEl) {
        animate(boxEl as any, { scale: [1, 1.08, 1] }, { duration: 0.18, ease: [0.16, 1, 0.3, 1] });
      }
    }

    this.emitCurrent();
    if (digitsOnly && index < 5) {
      // Auto-advance without hiding the keyboard
      const nextInput = this.boxInputs.get(index + 1)?.nativeElement;
      nextInput?.focus();
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prevInput = this.boxInputs.get(index - 1)?.nativeElement;
      prevInput?.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digitsOnly = pasted.replace(/\D/g, '');
    if (!digitsOnly) return;
    event.preventDefault();
    this.fillFrom(0, digitsOnly);
  }

  private fillFrom(startIndex: number, digitsOnly: string): void {
    const chars = digitsOnly.split('');
    for (let i = startIndex; i < 6 && (i - startIndex) < chars.length; i++) {
      this.digits[i] = chars[i - startIndex];
      const boxEl = this.boxInputs.get(i)?.nativeElement;
      if (boxEl) {
        animate(boxEl as any, { scale: [1, 1.08, 1] }, { duration: 0.2, delay: (i - startIndex) * 0.03 });
      }
    }
    this.emitCurrent();
    const lastFilled = Math.min(startIndex + chars.length, 6) - 1;
    if (lastFilled >= 0) {
      this.boxInputs.get(Math.min(lastFilled, 5))?.nativeElement.focus();
    }
  }

  /**
   * Triggers the emerald cascade animation when verification succeeds.
   */
  async triggerSuccess(): Promise<void> {
    this.state = 'success';
    if (this.boxInputs) {
      this.boxInputs.forEach((box, idx) => {
        animate(
          box.nativeElement as any,
          { scale: [1, 1.1, 1] },
          { duration: 0.35, delay: idx * 0.035, ease: [0.16, 1, 0.3, 1] }
        );
      });
    }
  }

  /**
   * Triggers a horizontal physics-based shake and keeps the keyboard open.
   */
  async triggerError(): Promise<void> {
    this.state = 'error';
    if (this.rowContainer) {
      await animate(
        this.rowContainer.nativeElement as any,
        { x: [0, -7, 7, -5, 5, -2, 2, 0] },
        { duration: 0.42, ease: 'easeInOut' }
      );
    }
    // Keep focus and select digit so user can immediately re-enter
    const lastInput = this.boxInputs.get(Math.max(0, this.digits.findIndex(d => !d) - 1))?.nativeElement
      || this.boxInputs.last?.nativeElement;
    lastInput?.focus();
    lastInput?.select();
  }

  /**
   * Resets all boxes back to idle.
   */
  reset(): void {
    this.digits = ['', '', '', '', '', ''];
    this._code = '';
    this.state = 'idle';
    this.codeChange.emit('');
    this.boxInputs.first?.nativeElement.focus();
  }
}
