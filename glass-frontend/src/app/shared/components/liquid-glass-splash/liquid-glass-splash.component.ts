import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  inject,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-liquid-glass-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './liquid-glass-splash.component.html',
  styleUrl: './liquid-glass-splash.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidGlassSplashComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);

  @ViewChild('splashCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output() completed = new EventEmitter<void>();

  private rafId: number | null = null;
  private startTime = 0;
  private lastTime = 0;
  private readonly TOTAL_MS = 1700;
  private readonly ZOOM_START = 1000;
  private readonly ZOOM_END = 1480;
  private readonly REVEAL_START = 1400;
  private readonly RIPPLE_MS = 600;
  private readonly PULSE_MS = 220;
  private readonly BEATS_MS = [600, 850];
  private readonly MAX_STEP_MS = 34; // Max time per frame to protect against startup lag stalls

  private clock = 0;
  private hasBeat1Fired = false;
  private hasBeat2Fired = false;

  ngOnInit(): void {
    // Check reduced motion setting
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || (typeof window !== 'undefined' && window.location.search.includes('nosplash'))) {
      this.completed.emit();
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.setupCanvas();
      this.lastTime = performance.now();
      this.startTime = this.lastTime;
      this.rafId = requestAnimationFrame(this.renderLoop.bind(this));
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private setupCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  private renderLoop(now: number): void {
    const dt = Math.min((now - this.lastTime), this.MAX_STEP_MS);
    this.lastTime = now;
    this.clock = Math.min(this.clock + dt, this.TOTAL_MS);

    // Fire haptic ticks at Convx 120 BPM beats
    if (this.clock >= this.BEATS_MS[0] && !this.hasBeat1Fired) {
      this.hasBeat1Fired = true;
      this.triggerHapticTick();
    }
    if (this.clock >= this.BEATS_MS[1] && !this.hasBeat2Fired) {
      this.hasBeat2Fired = true;
      this.triggerHapticTick();
    }

    this.drawFrame();

    if (this.clock < this.TOTAL_MS) {
      this.rafId = requestAnimationFrame(this.renderLoop.bind(this));
    } else {
      this.ngZone.run(() => {
        this.completed.emit();
      });
    }
  }

  private drawFrame(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const t = this.clock;
    const r0 = 54;
    const cover = Math.hypot(w, h) / 2 * 1.05;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // 1. Reveal Aperture Hole
    const holePhase = this.phase(t, this.REVEAL_START, this.TOTAL_MS);
    const holeR = cover * this.outCubic(holePhase);

    // Draw opaque backdrop clipped around the opening hole
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    if (holeR > 0) {
      ctx.arc(cx, cy, holeR, 0, Math.PI * 2, true);
    }
    ctx.fillStyle = '#0a0a0c';
    ctx.fill();

    // Only render disc and monogram while hole hasn't enveloped screen
    if (holePhase < 1) {
      // 2. Dual Rhythmic Waves
      for (const beat of this.BEATS_MS) {
        const x = (t - beat) / this.RIPPLE_MS;
        if (x >= 0 && x <= 1) {
          ctx.beginPath();
          ctx.arc(cx, cy, r0 * (1 + 2.4 * this.outCubic(x)), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * (1 - x)})`;
          ctx.lineWidth = 2 * (1 - 0.6 * x);
          ctx.stroke();
        }
      }

      // 3. Central Spring Disc
      let beatPulse = 0;
      for (const beat of this.BEATS_MS) {
        beatPulse += this.pulse(t - beat);
      }
      const zoom = this.inCubic(this.phase(t, this.ZOOM_START, this.ZOOM_END));
      const discIn = this.outBack(this.phase(t, 0, 450));
      const discR = Math.max(0, r0 * discIn * (1 + 0.09 * beatPulse) + (cover - r0) * zoom);

      ctx.beginPath();
      ctx.arc(cx, cy, discR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 4. SINE MDRRMO Monogram Shield / Flame Symbol
      const glyphIn = this.phase(t, 100, 550);
      const glyph = r0 * 2 * 0.60 * this.outBack(glyphIn) * (1 + 0.09 * beatPulse) * (1 + 16 * Math.pow(zoom, 1.6));
      const spin = -140 * (1 - this.outCubic(glyphIn)) + 35 * zoom;

      if (glyph > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((spin * Math.PI) / 180);

        // Draw Stylized MDRRMO Flame / Shield Monogram
        const s = glyph / 48;
        ctx.scale(s, s);
        ctx.fillStyle = '#0a0a0c';

        ctx.beginPath();
        // Modern shield path
        ctx.moveTo(0, -20);
        ctx.bezierCurveTo(12, -20, 20, -14, 20, -6);
        ctx.bezierCurveTo(20, 10, 8, 18, 0, 22);
        ctx.bezierCurveTo(-8, 18, -20, 10, -20, -6);
        ctx.bezierCurveTo(-20, -14, -12, -20, 0, -20);
        ctx.closePath();
        ctx.fill();

        // Inner glowing negative space flame
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.bezierCurveTo(-5, 9, -10, 4, -10, -4);
        ctx.bezierCurveTo(-10, -10, -4, -13, 0, -17);
        ctx.bezierCurveTo(4, -13, 10, -10, 10, -4);
        ctx.bezierCurveTo(10, 4, 5, 9, 0, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }

  private phase(t: number, start: number, end: number): number {
    return Math.max(0, Math.min(1, (t - start) / (end - start)));
  }

  private pulse(dt: number): number {
    if (dt >= 0 && dt <= this.PULSE_MS) {
      return Math.sin((Math.PI * dt) / this.PULSE_MS);
    }
    return 0;
  }

  private outCubic(x: number): number {
    return 1 - Math.pow(1 - x, 3);
  }

  private inCubic(x: number): number {
    return x * x * x;
  }

  private outBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  private triggerHapticTick(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignored if device lacks vibrator
      }
    }
  }
}
