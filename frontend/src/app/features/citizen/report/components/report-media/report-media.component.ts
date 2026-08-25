import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonModal,
  ToastController, AlertController, ModalController
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { TourService } from '../../../../../core/services/tour';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { VideoTrimmerComponent } from '../../../../../shared/components/video-trimmer/video-trimmer.component';

export interface MediaFile { preview: string; type: 'photo' | 'video'; }

/**
 * ReportMediaComponent — camera/video capture, the image cropper, and the
 * VideoTrimmerComponent modal integration, extracted from report.page.
 * Owns mediaFiles locally and emits the full array up on every change so the
 * parent can use it for isFormReady / submitReport without duplicating the
 * capture/crop logic.
 */
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-report-media',
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonModal, ImageCropperComponent, AppIconComponent
  ],
  templateUrl: './report-media.component.html',
})
export class ReportMediaComponent {
  private toastCtrl    = inject(ToastController);
  private alertCtrl    = inject(AlertController);
  private modalCtrl    = inject(ModalController);
  private userSettings = inject(UserSettingsService);
  public  tour          = inject(TourService);

  @Input() reportType: 'emergency' | 'hazard' = 'emergency';
  @Output() mediaFilesChange = new EventEmitter<MediaFile[]>();

  mediaFiles: MediaFile[] = [];
  get canAddMore(): boolean { return this.mediaFiles.length < 2; }
  get hasMedia(): boolean   { return this.mediaFiles.length > 0; }

  showCropper = false;
  cropperFile: File | null = null;
  croppedBase64 = '';

  private emitMediaFiles() {
    this.mediaFilesChange.emit([...this.mediaFiles]);
  }

  async takePhoto() {
    if (!this.canAddMore) { this.showToast('Maximum 2 files allowed.', 'warning'); return; }
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
      const saveToGallery = this.userSettings.getBool('save_media_to_device');
      const result = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, saveToGallery });
      if (!result.dataUrl) return;

      // If photo cropping is disabled in Settings, attach immediately
      if (!this.userSettings.getBool('photo_cropping_enabled')) {
        this.mediaFiles.push({ preview: result.dataUrl, type: 'photo' });
        this.emitMediaFiles();
        return;
      }

      const res = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.openCropper(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    } catch { /* cancelled */ }
  }

  triggerVideo() {
    if (!this.canAddMore) { this.showToast('Maximum 2 files allowed.', 'warning'); return; }
    document.getElementById('videoInput')?.click();
  }

  async onVideoSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    if (file.size > 200 * 1024 * 1024) { this.showToast('Video file is too large.', 'warning'); return; }

    // If video trimming is disabled in Settings, check duration and auto-trim if > 10s
    if (!this.userSettings.getBool('video_trimming_enabled')) {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (v.duration <= 10.5) {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result) {
              this.mediaFiles.push({ preview: reader.result as string, type: 'video' });
              this.emitMediaFiles();
            }
          };
          reader.readAsDataURL(file);
        } else {
          this.autoTrimFirst10s(file);
        }
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            this.mediaFiles.push({ preview: reader.result as string, type: 'video' });
            this.emitMediaFiles();
          }
        };
        reader.readAsDataURL(file);
      };
      return;
    }

    const modal = await this.modalCtrl.create({ component: VideoTrimmerComponent, componentProps: { videoBlob: file }, cssClass: 'video-trimmer-modal' });
    this.tour.modalOpen.set(true);
    await modal.present();
    const { data } = await modal.onDidDismiss();
    this.tour.modalOpen.set(false);
    if (data?.dataUrl) {
      this.mediaFiles.push({ preview: data.dataUrl, type: 'video' });
      this.emitMediaFiles();
    }
  }

  openCropper(file: File) { this.cropperFile = file; this.croppedBase64 = ''; this.showCropper = true; this.tour.modalOpen.set(true); }

  onPhotoCropped(event: ImageCroppedEvent) {
    this.croppedBase64 = event.base64 && event.base64.includes(';base64,') ? event.base64 : '';
  }

  confirmCrop() {
    if (!this.croppedBase64) { this.showToast('Image is still processing. Please wait a moment.', 'warning'); return; }
    this.mediaFiles.push({ preview: this.croppedBase64, type: 'photo' });
    this.emitMediaFiles();
    this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; this.tour.modalOpen.set(false);
  }

  cancelCrop() { this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; this.tour.modalOpen.set(false); }

  async retakeCrop() {
    this.croppedBase64 = '';
    await this.takePhoto();
  }

  disablePhotoCropperNow() {
    this.userSettings.setBool('photo_cropping_enabled', false);
    const file = this.cropperFile;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.mediaFiles.push({ preview: dataUrl, type: 'photo' });
        this.emitMediaFiles();
        this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; this.tour.modalOpen.set(false);
      };
      reader.readAsDataURL(file);
    } else {
      this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; this.tour.modalOpen.set(false);
    }
    this.showToast('Photo crop editor turned off. You can turn it back on in Settings anytime.', 'medium');
  }

  private autoTrimFirst10s(file: File) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 360;
      const ctx = canvas.getContext('2d')!;
      const canvasStream = (canvas as any).captureStream(30);
      const videoStream = (v as any).captureStream?.() as MediaStream | undefined;
      if (videoStream) videoStream.getAudioTracks().forEach((t: MediaStreamTrack) => canvasStream.addTrack(t));
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          this.mediaFiles.push({ preview: reader.result as string, type: 'video' });
          this.emitMediaFiles();
          this.showToast('Video automatically trimmed to first 10 seconds.', 'medium');
        };
        reader.readAsDataURL(blob);
      };
      let animId: number;
      const maxTime = Math.min(10, v.duration);
      const draw = () => {
        if (v.paused || v.ended || v.currentTime >= maxTime) {
          recorder.stop();
          cancelAnimationFrame(animId);
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        animId = requestAnimationFrame(draw);
      };
      recorder.start(100);
      v.currentTime = 0;
      v.play().then(() => { draw(); }).catch(() => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            this.mediaFiles.push({ preview: reader.result as string, type: 'video' });
            this.emitMediaFiles();
          }
        };
        reader.readAsDataURL(file);
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
    };
  }

  async removeMedia(index: number) {
    const a = await this.alertCtrl.create({
      header: 'Remove File', message: 'Remove this file?',
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Remove', role: 'destructive', handler: () => { this.mediaFiles.splice(index, 1); this.emitMediaFiles(); } }]
    });
    await a.present();
  }

  private async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
