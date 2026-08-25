import { Component, Input, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent, ModalController } from '@ionic/angular/standalone';
import { UserSettingsService } from '../../../core/services/user-settings';
import { AppIconComponent } from '../app-icon/app-icon.component';

type DragHandle = 'start' | 'end' | 'playhead' | null;

@Component({
  selector: 'app-video-trimmer',
  standalone: true,
  imports: [CommonModule, IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent, AppIconComponent],
  template: `
<ion-header class="ion-no-border">
  <ion-toolbar color="danger">
    <ion-title style="color:white;font-weight:bold;">Trim Video</ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="cancel()" style="color:white;font-weight:bold;">Cancel</ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">

  <!-- Info banner -->
  <div style="background:var(--ion-color-step-50, rgba(0,0,0,0.03));border:1px solid var(--ion-color-step-100, rgba(0,0,0,0.06));border-radius:14px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <app-icon name="circle-alert" [size]="16" color="var(--ion-color-danger)" style="margin-top:2px;flex-shrink:0;"></app-icon>
      <div style="font-size:13px;color:var(--ion-text-color);line-height:1.5;">
        <strong>Clips are capped at {{ MAX_DURATION }} seconds.</strong><br>
        Drag the <span style="color:var(--ion-color-danger);font-weight:bold;">red handles</span> to select your clip window.
      </div>
    </div>
    <button type="button" (click)="disableVideoTrimmerNow()" style="background:transparent;border:none;color:var(--ion-color-danger);font-weight:bold;font-size:12px;cursor:pointer;text-decoration:underline;white-space:nowrap;padding:0;margin-top:2px;">
      Disable now
    </button>
  </div>

  <!-- Video preview -->
  <div style="position:relative;border-radius:16px;overflow:hidden;background:#000;min-height:180px;margin-bottom:0;box-shadow:0 4px 16px rgba(0,0,0,0.2);">
    <video #previewVideo [src]="videoUrl" playsinline [muted]="isMuted"
           [style.opacity]="metaReady ? 1 : 0"
           style="width:100%;max-height:38vh;display:block;transition:opacity 0.15s;"
           (loadedmetadata)="onMetaLoaded()"
           (timeupdate)="onTimeUpdate()"
           (play)="isPlaying = true" (pause)="isPlaying = false" (ended)="isPlaying = false">
    </video>
    <div *ngIf="!metaReady"
         style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <span class="dot-loader dot-loader-white"><span></span><span></span><span></span></span>
    </div>
  </div>

  <!-- Play/Pause button -->
  <div *ngIf="metaReady"
       style="display:flex;align-items:center;justify-content:center;gap:14px;margin:12px 0;">
    <button type="button" (click)="togglePlay()"
            style="width:44px;height:44px;border-radius:50%;border:none;background:var(--app-red-light, rgba(211,47,47,0.12));color:var(--ion-color-danger);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;">
      <app-icon [name]="isPlaying ? 'pause' : 'play'" [size]="18" color="var(--ion-color-danger)"></app-icon>
    </button>
    <span style="font-size:13px;font-weight:700;color:var(--ion-color-medium);font-variant-numeric:tabular-nums;">
      {{ currentTime.toFixed(1) }}s / {{ videoDuration.toFixed(1) }}s
    </span>
  </div>

  <!-- Duration / selection info -->
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:gray;">
    <span>Start: <strong>{{ startTime.toFixed(1) }}s</strong></span>
    <span style="font-weight:bold;" [style.color]="trimDuration > MAX_DURATION ? '#eb445a' : '#2dd36f'">
      {{ trimDuration.toFixed(1) }}s selected
    </span>
    <span>End: <strong>{{ endTime.toFixed(1) }}s</strong></span>
  </div>

  <!-- Timeline strip -->
  <div #timeline class="trim-timeline"
       (pointerdown)="timelineTap($event)"
       style="position:relative;height:60px;border-radius:10px;overflow:hidden;background:#1c1c1e;touch-action:none;user-select:none;margin-bottom:8px;">

    <!-- Film-strip thumbnails -->
    <div style="position:absolute;inset:0;display:flex;">
      <div *ngFor="let f of thumbFrames"
           style="flex:1;background:#2a2a2a;border-right:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <img *ngIf="f" [src]="f" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
    </div>

    <!-- Dim left of selection -->
    <div style="position:absolute;top:0;bottom:0;left:0;background:rgba(0,0,0,0.58);pointer-events:none;"
         [style.width.%]="(startTime/videoDuration)*100"></div>
    <!-- Dim right of selection -->
    <div style="position:absolute;top:0;bottom:0;right:0;background:rgba(0,0,0,0.58);pointer-events:none;"
         [style.width.%]="100 - (endTime/videoDuration)*100"></div>

    <!-- Selection border top/bottom -->
    <div style="position:absolute;top:0;bottom:0;border-top:3px solid #eb445a;border-bottom:3px solid #eb445a;pointer-events:none;"
         [style.left.%]="(startTime/videoDuration)*100"
         [style.width.%]="(trimDuration/videoDuration)*100"></div>

    <!-- Playhead — draggable -->
    <div (pointerdown)="startDrag('playhead', $event)"
         (pointermove)="onDragMove($event)"
         (pointerup)="endDrag($event)"
         (pointercancel)="endDrag($event)"
         style="position:absolute;top:0;bottom:0;width:24px;margin-left:-12px;cursor:ew-resize;z-index:3;display:flex;align-items:center;justify-content:center;"
         [style.left.%]="playheadPct">
      <div style="width:2px;height:100%;background:white;box-shadow:0 0 5px rgba(255,255,255,0.7);"></div>
    </div>

    <!-- Start handle -->
    <div (pointerdown)="startDrag('start', $event)"
         (pointermove)="onDragMove($event)"
         (pointerup)="endDrag($event)"
         (pointercancel)="endDrag($event)"
         style="position:absolute;top:0;bottom:0;width:22px;margin-left:-11px;cursor:ew-resize;z-index:4;display:flex;align-items:center;justify-content:center;"
         [style.left.%]="(startTime/videoDuration)*100">
      <div style="width:7px;height:40px;border-radius:4px;background:#eb445a;box-shadow:0 0 0 2px white;"></div>
    </div>

    <!-- End handle -->
    <div (pointerdown)="startDrag('end', $event)"
         (pointermove)="onDragMove($event)"
         (pointerup)="endDrag($event)"
         (pointercancel)="endDrag($event)"
         style="position:absolute;top:0;bottom:0;width:22px;margin-left:-11px;cursor:ew-resize;z-index:4;display:flex;align-items:center;justify-content:center;"
         [style.left.%]="(endTime/videoDuration)*100">
      <div style="width:7px;height:40px;border-radius:4px;background:#eb445a;box-shadow:0 0 0 2px white;"></div>
    </div>

  </div>

  <!-- Limit warning -->
  <div *ngIf="trimDuration > MAX_DURATION"
       style="background:#eb445a20;border:1px solid #eb445a;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#eb445a;font-weight:bold;display:flex;align-items:center;gap:8px;">
    <app-icon name="alert" [size]="16" color="#eb445a"></app-icon>
    Selection is {{ trimDuration.toFixed(1) }}s — drag a handle inward to reduce to {{ MAX_DURATION }}s or less.
  </div>

  <ion-button expand="block" color="danger" style="font-weight:bold;height:48px;margin-top:14px;--border-radius:14px;box-shadow:0 4px 16px rgba(211,47,47,0.3);"
              [disabled]="trimDuration > MAX_DURATION || isExporting || !metaReady"
              (click)="exportTrim()">
    <span *ngIf="!isExporting" style="display:flex;align-items:center;gap:8px;">
      <app-icon name="check" [size]="18" color="#ffffff"></app-icon>Use This Clip ({{ trimDuration.toFixed(1) }}s)
    </span>
    <span *ngIf="isExporting" style="display:flex;align-items:center;gap:8px;">
      <span class="dot-loader dot-loader-white"><span></span><span></span><span></span></span> Exporting…
    </span>
  </ion-button>

</ion-content>
  `
})
export class VideoTrimmerComponent implements AfterViewInit, OnDestroy {
  @Input()  videoBlob!: Blob;
  @ViewChild('previewVideo') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('timeline') timelineRef!: ElementRef<HTMLDivElement>;

  readonly MAX_DURATION = 10;
  readonly THUMB_COUNT  = 10;

  videoUrl      = '';
  videoDuration = 0;
  startTime     = 0;
  endTime       = 10;
  currentTime   = 0;
  isExporting   = false;
  isPlaying     = false;
  metaReady     = false;
  thumbFrames: (string | null)[] = new Array(this.THUMB_COUNT).fill(null);
  isMuted = true; // muted during thumbnail generation to avoid autoplay-policy errors; unmuted after

  private dragging: DragHandle = null;
  private wasPlayingBeforeDrag = false;

  get trimDuration(): number { return this.endTime - this.startTime; }

  // The displayed playhead position is clamped inside [startTime, endTime]
  // when we're in playback mode, so it never escapes the selection window.
  // During a handle drag it stays exactly where it was before the drag started.
  get playheadPct(): number {
    const clamped = Math.min(Math.max(this.currentTime, this.startTime), this.endTime);
    return (clamped / this.videoDuration) * 100;
  }

  private userSettings = inject(UserSettingsService);

  constructor(private modalCtrl: ModalController) {}

  ngAfterViewInit() {
    this.videoUrl = URL.createObjectURL(this.videoBlob);
  }

  ngOnDestroy() {
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
  }

  onMetaLoaded() {
    const v = this.videoRef.nativeElement;
    this.videoDuration = v.duration;
    this.startTime = 0;
    this.endTime   = Math.min(this.MAX_DURATION, v.duration);
    this.currentTime = 0;
    this.metaReady = true;
    this.generateThumbnails();
  }

  onTimeUpdate() {
    if (this.dragging === 'start' || this.dragging === 'end') return; // handle drags NEVER touch currentTime
    const v = this.videoRef.nativeElement;
    this.currentTime = v.currentTime;
    if (v.currentTime >= this.endTime) { v.pause(); }
  }

  togglePlay() {
    const v = this.videoRef.nativeElement;
    if (v.paused) {
      if (v.currentTime < this.startTime || v.currentTime >= this.endTime) {
        v.currentTime = this.startTime;
        this.currentTime = this.startTime;
      }
      v.play();
    } else {
      v.pause();
    }
  }

  // Tap anywhere on the bare timeline (no handle) → seek playhead only
  timelineTap(event: PointerEvent) {
    // If the tap lands on a handle element, the handle's own pointerdown fires
    // first and captures the pointer, so this handler never interferes.
    const target = event.target as HTMLElement;
    if (target.closest('[data-handle]')) return;
    this.seekToPointer(event.clientX);
  }

  private seekToPointer(clientX: number) {
    if (!this.timelineRef) return;
    const rect = this.timelineRef.nativeElement.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time  = ratio * this.videoDuration;
    // Clamp to [startTime, endTime] so you can't seek outside the selection
    const clamped = Math.min(Math.max(time, this.startTime), this.endTime);
    this.currentTime = clamped;
    this.videoRef.nativeElement.currentTime = clamped;
  }

  // ── Handle drag ─────────────────────────────────────────────────────────
  startDrag(handle: DragHandle, event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation(); // prevent timelineTap from firing
    this.dragging = handle;
    this.wasPlayingBeforeDrag = !this.videoRef.nativeElement.paused;
    this.videoRef.nativeElement.pause();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.applyDrag(event.clientX);
  }

  onDragMove(event: PointerEvent) {
    if (!this.dragging) return;
    event.preventDefault();
    this.applyDrag(event.clientX);
  }

  endDrag(event: PointerEvent) {
    if (!this.dragging) return;
    try { (event.target as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (this.wasPlayingBeforeDrag) this.videoRef.nativeElement.play();
    this.dragging = null;
  }

  private applyDrag(clientX: number) {
    if (!this.timelineRef) return;
    const rect  = this.timelineRef.nativeElement.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time  = ratio * this.videoDuration;
    const v     = this.videoRef.nativeElement;

    if (this.dragging === 'start') {
      // ── Start handle: moves startTime only ──
      // Playhead (currentTime) is intentionally NOT touched here.
      const clamped = Math.min(Math.max(time, 0), this.endTime - 0.3);
      this.startTime = clamped;
      // Sliding window: if the window is already at 10s and user drags start
      // further right, pull the end handle along with it.
      if (this.endTime - this.startTime > this.MAX_DURATION) {
        this.endTime = this.startTime + this.MAX_DURATION;
      }
      // Seek the video to the new start so the preview updates — but do NOT
      // update this.currentTime (so the white line doesn't jump).
      v.currentTime = this.startTime;

    } else if (this.dragging === 'end') {
      // ── End handle: moves endTime only ──
      const clamped = Math.max(Math.min(time, this.videoDuration), this.startTime + 0.3);
      this.endTime = clamped;
      if (this.endTime - this.startTime > this.MAX_DURATION) {
        this.startTime = this.endTime - this.MAX_DURATION;
      }
      v.currentTime = this.endTime;

    } else if (this.dragging === 'playhead') {
      // ── Playhead: moves currentTime only, clamped inside selection ──
      const clamped = Math.min(Math.max(time, this.startTime), this.endTime);
      this.currentTime = clamped;
      v.currentTime = clamped;
    }
  }

  // ── Film-strip thumbnails ──────────────────────────────────────────────
  private generateThumbnails() {
    const v = this.videoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    const originalTime = v.currentTime;
    let i = 0;
    const captureNext = () => {
      if (i >= this.THUMB_COUNT) {
        v.currentTime = originalTime;
        this.isMuted = false; // thumbnail pass done — safe to let user hear audio now
        return;
      }
      v.currentTime = (i / this.THUMB_COUNT) * this.videoDuration;
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        try {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          this.thumbFrames[i] = canvas.toDataURL('image/jpeg', 0.6);
        } catch { /* cross-origin fallback */ }
        i++;
        captureNext();
      };
      v.addEventListener('seeked', onSeeked);
    };
    captureNext();
  }

  async exportTrim() {
    if (this.trimDuration > this.MAX_DURATION) return;
    this.isExporting = true;
    try {
      const blob = await this.trimVideoSegment();
      const reader = new FileReader();
      reader.onload = () => { this.modalCtrl.dismiss({ dataUrl: reader.result as string }); };
      reader.readAsDataURL(blob);
    } catch { this.isExporting = false; }
  }

  /**
   * Skip — resets the selection to the default window (first MAX_DURATION
   * seconds, or the whole clip if shorter) and immediately runs the same
   * exportTrim() pipeline, so the 10s cap is still enforced and the output
   * is still a normal re-encoded clip. Lets a reporter in a hurry attach a
   * video without having to touch the trim handles at all.
   */
  disableVideoTrimmerNow() {
    this.userSettings.setBool('video_trimming_enabled', false);
    if (this.isExporting || !this.metaReady) return;
    this.startTime = 0;
    this.endTime   = Math.min(this.MAX_DURATION, this.videoDuration);
    this.currentTime = 0;
    this.exportTrim();
  }

  private trimVideoSegment(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = this.videoRef.nativeElement;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 640; canvas.height = v.videoHeight || 360;
      const ctx = canvas.getContext('2d')!;
      const canvasStream = (canvas as any).captureStream(30);
      const videoStream = (v as any).captureStream?.() as MediaStream | undefined;
      if (videoStream) videoStream.getAudioTracks().forEach((t: MediaStreamTrack) => canvasStream.addTrack(t));
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      recorder.onerror = () => reject(new Error('Recording failed'));
      let animId: number;
      const draw = () => {
        if (v.paused || v.ended || v.currentTime >= this.endTime) { recorder.stop(); cancelAnimationFrame(animId); return; }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        animId = requestAnimationFrame(draw);
      };
      recorder.start(100);
      v.currentTime = this.startTime;
      v.play().then(() => { draw(); }).catch(reject);
    });
  }

  cancel() { this.modalCtrl.dismiss(null); }
}
