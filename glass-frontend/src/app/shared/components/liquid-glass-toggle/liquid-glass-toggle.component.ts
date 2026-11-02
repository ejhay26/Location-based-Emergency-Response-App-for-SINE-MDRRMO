import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-liquid-glass-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './liquid-glass-toggle.component.html',
  styleUrl: './liquid-glass-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidGlassToggleComponent {
  private cdr = inject(ChangeDetectorRef);
  private el = inject(ElementRef);

  @Input() checked = false;
  @Input() disabled = false;
  @Input() activeColor = '#34C759'; // Apple HIG iOS Green
  @Input() inactiveColor = '#39393D'; // Apple HIG Slate Gray
  @Input() ariaLabel = 'Toggle setting';

  @Output() checkedChange = new EventEmitter<boolean>();

  // Liquid Physics & Direct Manipulation
  isPressed = false;
  isDragging = false;
  dragFraction = 0; // 0.0 (inactive) to 1.0 (active)
  isSeparating = false; // Liquid bridge stretch active

  private pointerStartX = 0;
  private pointerStartTime = 0;
  private isPointerDown = false;
  private didDrag = false;
  private pointerFired = false;

  get progress(): number {
    if (this.isDragging) return this.dragFraction;
    return this.checked ? 1 : 0;
  }

  // ── Pointer / Touch Gestures with Damped Physics ──
  onPointerDown(event: PointerEvent): void {
    if (this.disabled) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    this.pointerFired = true;
    this.isPointerDown = true;
    this.isPressed = true;
    this.didDrag = false;
    this.pointerStartX = event.clientX;
    this.pointerStartTime = Date.now();
    this.dragFraction = this.checked ? 1 : 0;

    // Trigger liquid lens highlight & squish
    this.triggerHapticTick();
    this.cdr.markForCheck();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPointerDown || this.disabled) return;

    const dx = event.clientX - this.pointerStartX;
    if (!this.didDrag && Math.abs(dx) > 3) {
      this.didDrag = true;
      this.isDragging = true;
      this.isSeparating = true;
    }

    if (this.isDragging) {
      // 20px travel distance across the 46px track
      const travelDistance = 20;
      const initial = this.checked ? 1 : 0;
      const rawDelta = dx / travelDistance;
      this.dragFraction = Math.max(0, Math.min(1, initial + rawDelta));
      this.cdr.markForCheck();
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDown || this.disabled) return;

    this.isPointerDown = false;
    this.isPressed = false;
    const wasDragging = this.isDragging;
    this.isDragging = false;

    if (wasDragging) {
      // Commit toggle based on 50% midpoint threshold
      const newChecked = this.dragFraction >= 0.5;
      if (newChecked !== this.checked) {
        this.checked = newChecked;
        this.checkedChange.emit(this.checked);
        this.triggerHapticTick();
      }
    } else {
      // Direct tap toggle
      this.checked = !this.checked;
      this.checkedChange.emit(this.checked);
      this.triggerHapticTick();
    }

    // Liquid bridge snaps and dissolves back into unity
    setTimeout(() => {
      this.isSeparating = false;
      this.pointerFired = false;
      this.cdr.markForCheck();
    }, 280);

    this.cdr.markForCheck();
  }

  onClick(event: MouseEvent): void {
    if (this.disabled) return;
    if (this.pointerFired) return;
    this.toggle();
  }

  toggle(): void {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
    this.triggerHapticTick();
    this.cdr.markForCheck();
  }

  onPointerCancel(): void {
    this.isPointerDown = false;
    this.isPressed = false;
    this.isDragging = false;
    this.isSeparating = false;
    this.pointerFired = false;
    this.cdr.markForCheck();
  }

  private triggerHapticTick(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignored if device lacks hardware haptic motor
      }
    }
  }
}
