import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent, IonRange, ModalController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-video-trimmer',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonButtons, IonHeader, IonToolbar, IonTitle, IonContent, IonRange],
  template: `
<ion-header class="ion-no-border">
  <ion-toolbar color="danger">
    <ion-title style="color:white;font-weight:bold;">Trim Video (max 10s)</ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="cancel()" style="color:white;font-weight:bold;">Cancel</ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">

  <!-- Video preview -->
  <video #previewVideo [src]="videoUrl" playsinline
         style="width:100%;border-radius:12px;background:#000;max-height:40vh;display:block;"
         (loadedmetadata)="onMetaLoaded()"
         (timeupdate)="onTimeUpdate()">
  </video>

  <!-- Duration info -->
  <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:gray;">
    <span>Start: {{ startTime.toFixed(1) }}s</span>
    <span>{{ trimDuration.toFixed(1) }}s selected</span>
    <span>End: {{ endTime.toFixed(1) }}s</span>
  </div>

  <!-- Trim range indicator -->
  <div style="position:relative;margin:16px 0 8px 0;height:48px;background:var(--ion-color-light);border-radius:10px;overflow:hidden;">
    <!-- Full timeline -->
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:var(--ion-color-step-100,#e0e0e0);"></div>
    <!-- Selected region -->
    <div [style.left.%]="(startTime/videoDuration)*100"
         [style.width.%]="(trimDuration/videoDuration)*100"
         style="position:absolute;top:0;bottom:0;background:rgba(235,68,90,0.35);border:2px solid var(--ion-color-danger);border-radius:4px;"></div>
    <!-- Playhead -->
    <div [style.left.%]="(currentTime/videoDuration)*100"
         style="position:absolute;top:0;bottom:0;width:2px;background:#eb445a;"></div>
  </div>

  <!-- Start slider -->
  <p style="font-size:12px;font-weight:bold;color:var(--ion-text-color);margin:8px 0 2px 0;">Trim Start</p>
  <ion-range [min]="0" [max]="maxStart" [step]="0.1"
             [value]="startTime" (ionInput)="onStartChange($event)"
             color="danger" style="padding:0;">
  </ion-range>

  <!-- End slider -->
  <p style="font-size:12px;font-weight:bold;color:var(--ion-text-color);margin:8px 0 2px 0;">Trim End</p>
  <ion-range [min]="minEnd" [max]="videoDuration" [step]="0.1"
             [value]="endTime" (ionInput)="onEndChange($event)"
             color="danger" style="padding:0;">
  </ion-range>

  <!-- Limit warning -->
  <div *ngIf="trimDuration > MAX_DURATION"
       style="background:#eb445a20;border:1px solid #eb445a;border-radius:8px;padding:8px 12px;margin-top:8px;font-size:12px;color:#eb445a;font-weight:bold;">
    <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>
    Selection is {{ trimDuration.toFixed(1) }}s — reduce to {{ MAX_DURATION }}s or less.
  </div>

  <!-- Controls -->
  <div style="display:flex;gap:10px;margin-top:20px;">
    <ion-button expand="block" fill="outline" color="dark" style="flex:1;font-weight:bold;height:45px;" (click)="previewTrim()">
      <i class="fa-solid fa-play" style="margin-right:6px;"></i> Preview
    </ion-button>
    <ion-button expand="block" color="danger" style="flex:1;font-weight:bold;height:45px;"
                [disabled]="trimDuration > MAX_DURATION || isExporting"
                (click)="exportTrim()">
      <span *ngIf="!isExporting"><i class="fa-solid fa-check" style="margin-right:6px;"></i> Use This Clip</span>
      <span *ngIf="isExporting"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i> Processing...</span>
    </ion-button>
  </div>

</ion-content>
  `
})
export class VideoTrimmerComponent implements AfterViewInit, OnDestroy {
  @Input()  videoBlob!: Blob;
  @ViewChild('previewVideo') videoRef!: ElementRef<HTMLVideoElement>;

  readonly MAX_DURATION = 10;

  videoUrl     = '';
  videoDuration = 0;
  startTime    = 0;
  endTime      = 10;
  currentTime  = 0;
  isExporting  = false;

  get trimDuration(): number { return this.endTime - this.startTime; }
  get maxStart():     number { return Math.max(0, this.endTime - 0.5); }
  get minEnd():       number { return Math.min(this.videoDuration, this.startTime + 0.5); }

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
    // Default: first 10s, or full video if shorter
    this.startTime = 0;
    this.endTime   = Math.min(this.MAX_DURATION, v.duration);
  }

  onTimeUpdate() {
    this.currentTime = this.videoRef.nativeElement.currentTime;
    // Auto-stop at trim end
    if (this.currentTime >= this.endTime) {
      this.videoRef.nativeElement.pause();
    }
  }

  onStartChange(event: any) {
    this.startTime = Number(event.detail.value);
    // Keep end at least startTime + 0.5, and enforce 10s max
    this.endTime = Math.min(this.videoDuration, Math.max(this.endTime, this.startTime + 0.5));
    if (this.trimDuration > this.MAX_DURATION) {
      this.endTime = this.startTime + this.MAX_DURATION;
    }
  }

  onEndChange(event: any) {
    this.endTime = Number(event.detail.value);
    if (this.trimDuration > this.MAX_DURATION) {
      this.startTime = Math.max(0, this.endTime - this.MAX_DURATION);
    }
  }

  previewTrim() {
    const v = this.videoRef.nativeElement;
    v.currentTime = this.startTime;
    v.play();
  }

  async exportTrim() {
    if (this.trimDuration > this.MAX_DURATION) return;
    this.isExporting = true;

    try {
      // Re-encode the selected segment using MediaRecorder capture from video element
      const trimmed = await this.trimVideoSegment();
      const reader  = new FileReader();
      reader.onload  = () => {
        this.modalCtrl.dismiss({ dataUrl: reader.result as string });
      };
      reader.readAsDataURL(trimmed);
    } catch {
      this.isExporting = false;
    }
  }

  private trimVideoSegment(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = this.videoRef.nativeElement;

      // Create an offscreen canvas matching video dimensions
      const canvas  = document.createElement('canvas');
      canvas.width  = v.videoWidth  || 640;
      canvas.height = v.videoHeight || 360;
      const ctx     = canvas.getContext('2d')!;

      // Capture stream from canvas + audio from video
      const canvasStream = (canvas as any).captureStream(30);

      // Try to get audio track from the video element
      const videoStream = (v as any).captureStream?.() as MediaStream | undefined;
      if (videoStream) {
        videoStream.getAudioTracks().forEach((t: MediaStreamTrack) => canvasStream.addTrack(t));
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus' : 'video/webm';

      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => { resolve(new Blob(chunks, { type: 'video/webm' })); };

      // Draw video frames to canvas during playback
      let animId: number;
      const drawFrame = () => {
        if (v.paused || v.ended || v.currentTime >= this.endTime) {
          recorder.stop();
          cancelAnimationFrame(animId);
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        animId = requestAnimationFrame(drawFrame);
      };

      recorder.start(100);
      v.currentTime = this.startTime;
      v.play().then(() => { drawFrame(); });
    });
  }

  cancel() { this.modalCtrl.dismiss(null); }
}