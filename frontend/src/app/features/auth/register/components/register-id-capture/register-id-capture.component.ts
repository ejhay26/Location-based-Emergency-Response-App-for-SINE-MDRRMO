import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonButtons, IonModal, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

import { enhanceIdCardImage } from '../../../../../core/utils/image-enhancer';

/**
 * RegisterIdCaptureComponent — reusable capture+crop flow used for both the
 * "Valid ID" (front & back) photos and the "Selfie with ID" photo during registration.
 *
 * Enforces standard landscape card aspect ratio (ISO/IEC 7810 ID-1 standard ~1.58:1)
 * directly in the live camera canvas viewfinder, capturing directly to card dimensions
 * with rich graphical preview guides and automatic enhancement.
 */
@Component({
  selector: 'app-register-id-capture',
  standalone: true,
  imports: [CommonModule, IonButton, IonButtons, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, ImageCropperComponent, AppIconComponent],
  templateUrl: './register-id-capture.component.html',
})
export class RegisterIdCaptureComponent implements OnDestroy {
  @Input() variant: 'id' | 'id-back' | 'selfie' = 'id';
  @Input() fieldName: 'valid_id_image' | 'valid_id_image_back' | 'selfie_with_id_image' = 'valid_id_image';
  @Input() userData: any;

  @Output() toast = new EventEmitter<string>();

  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('cardGuideEl') cardGuideEl?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  rawFile: File | null = null;
  showCropper = false;
  isLiveCameraOpen = false;
  mediaStream: MediaStream | null = null;
  cameraFacing: 'environment' | 'user' = 'environment';
  croppedBase64 = '';
  isEnhancing = false;
  canvasRotation = 0;

  ngOnDestroy(): void {
    this.closeLiveCamera();
  }

  get isCardVariant(): boolean {
    return this.variant === 'id' || this.variant === 'id-back';
  }

  get sampleImage(): string {
    if (this.variant === 'id') return 'assets/sample-id-front.svg';
    if (this.variant === 'id-back') return 'assets/sample-id-back.svg';
    return 'assets/sample-id-selfie.svg';
  }

  get sampleBadge(): string {
    if (this.isCardVariant) return 'Sample Guide (Landscape Card)';
    return 'Sample Guide (Face + ID Visible)';
  }

  get samplePills(): string[] {
    if (this.variant === 'id') {
      return ['Landscape Card Format', 'All 4 Corners Inside', 'No Glare / Blur'];
    }
    if (this.variant === 'id-back') {
      return ['Landscape Card Format', 'Barcode & QR Clear', 'Flat & Focused'];
    }
    return ['Hold ID Near Chest', 'Face & ID Both Focused', 'Natural Lighting'];
  }

  get config() {
    if (this.variant === 'selfie') {
      return {
        title: 'Selfie with Valid ID',
        description: "Take a selfie holding the same ID so we can confirm it's you.",
        buttonLabel: 'Capture Selfie',
        buttonIcon: 'camera',
        modalTitle: 'Crop Your Selfie',
        fileName: 'selfie_capture.jpg',
        direction: CameraDirection.Front,
      };
    }
    if (this.variant === 'id-back') {
      return {
        title: 'Valid ID — Back',
        description: 'A clear photo of the back of your ID (landscape card format).',
        buttonLabel: 'Capture Back of ID',
        buttonIcon: 'id-card',
        modalTitle: 'Crop Back of ID (Landscape)',
        fileName: 'id_back_capture.jpg',
        direction: undefined as CameraDirection | undefined,
      };
    }
    return {
      title: 'Valid ID — Front',
      description: 'A clear photo of the front of your ID (landscape card format).',
      buttonLabel: 'Capture Front of ID',
      buttonIcon: 'id-card',
      modalTitle: 'Crop Front of ID (Landscape)',
      fileName: 'id_capture.jpg',
      direction: undefined as CameraDirection | undefined,
    };
  }

  get preview(): string { return this.userData?.[this.fieldName] || ''; }

  /**
   * Main capture entry: Launches the live in-app camera canvas with an ID-card cutout frame.
   * If on insecure origin (HTTP), or if user/browser blocks live camera, seamlessly falls back
   * to system camera via HTML5 capture.
   */
  async triggerCapture(): Promise<void> {
    if (typeof window !== 'undefined' && window.isSecureContext && navigator?.mediaDevices?.getUserMedia) {
      this.cameraFacing = this.variant === 'selfie' ? 'user' : 'environment';
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.cameraFacing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        this.isLiveCameraOpen = true;
        setTimeout(() => this.attachVideoStream(), 60);
        return;
      } catch (err) {
        console.warn('Live in-app camera stream failed, falling back to system camera input:', err);
      }
    }

    // Direct system camera fallback for Chrome Android, HTTP origins, or restricted permissions
    this.triggerSystemCamera();
  }

  triggerSystemCamera(): void {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.click();
    }
  }

  private attachVideoStream(): void {
    requestAnimationFrame(() => {
      const video = this.videoEl?.nativeElement;
      if (video && this.mediaStream) {
        video.srcObject = this.mediaStream;
        video.play().catch((err) => console.warn('Video play error:', err));
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.rawFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.croppedBase64 = reader.result as string;
      this.canvasRotation = 0;
      this.showCropper = true;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  closeLiveCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.isLiveCameraOpen = false;
  }

  async switchCamera(): Promise<void> {
    this.cameraFacing = this.cameraFacing === 'environment' ? 'user' : 'environment';
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (this.videoEl?.nativeElement && this.mediaStream) {
        this.videoEl.nativeElement.srcObject = this.mediaStream;
        this.videoEl.nativeElement.play().catch(() => {});
      }
    } catch {
      // Revert if failed
    }
  }

  captureFromLiveCamera(): void {
    const video = this.videoEl?.nativeElement;
    const guide = this.cardGuideEl?.nativeElement;
    if (!video || !guide || !video.videoWidth || !video.videoHeight) return;

    const videoRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    const scale = Math.max(scaleX, scaleY);

    const displayedWidth = video.videoWidth / scale;
    const displayedHeight = video.videoHeight / scale;
    const offsetX = (videoRect.width - displayedWidth) / 2;
    const offsetY = (videoRect.height - displayedHeight) / 2;

    const cropX = Math.max(0, (guideRect.left - videoRect.left - offsetX) * scale);
    const cropY = Math.max(0, (guideRect.top - videoRect.top - offsetY) * scale);
    const cropWidth = Math.min(video.videoWidth - cropX, guideRect.width * scale);
    const cropHeight = Math.min(video.videoHeight - cropY, guideRect.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    this.closeLiveCamera();

    fetch(base64)
      .then((res) => res.blob())
      .then((blob) => {
        this.rawFile = new File([blob], this.config.fileName, { type: 'image/jpeg' });
        this.croppedBase64 = base64;
        this.canvasRotation = 0;
        this.showCropper = true;
      });
  }

  /** Capacitor Camera fallback for native environments where getUserMedia is unavailable */
  async fallbackCapacitorCapture(): Promise<void> {
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
      const opts: any = { quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera };
      if (this.config.direction) opts.direction = this.config.direction;
      const result = await Camera.getPhoto(opts);
      if (!result.dataUrl) return;
      const res = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.rawFile = new File([blob], this.config.fileName, { type: 'image/jpeg' });
      this.canvasRotation = 0;
      this.showCropper = true;
    } catch { /* cancelled */ }
  }

  rotateImage(): void {
    this.canvasRotation = (this.canvasRotation + 1) % 4;
  }

  async retakeCrop(): Promise<void> {
    this.croppedBase64 = '';
    this.canvasRotation = 0;
    this.showCropper = false;
    await this.triggerCapture();
  }

  onCropped(event: ImageCroppedEvent): void { this.croppedBase64 = event.base64 ?? ''; }

  async confirmCrop(): Promise<void> {
    if (!this.croppedBase64) { this.toast.emit('Please wait for the image to load.'); return; }

    // Strict landscape card orientation check for ID front & back
    if (this.isCardVariant) {
      const img = new Image();
      img.src = this.croppedBase64;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      if (img.width < img.height) {
        this.toast.emit('ID must be captured in landscape card orientation. Tap "Rotate 90°" to adjust.');
        return;
      }
    }

    this.isEnhancing = true;
    let finalBase64 = this.croppedBase64;
    // Auto-enhance document legibility for front and back ID cards
    if (this.isCardVariant) {
      try {
        finalBase64 = await enhanceIdCardImage(this.croppedBase64);
      } catch {
        finalBase64 = this.croppedBase64;
      }
    }
    this.isEnhancing = false;
    if (this.userData) this.userData[this.fieldName] = finalBase64;
    this.showCropper = false;
    this.rawFile = null;
    this.canvasRotation = 0;
  }

  cancelCrop(): void { this.showCropper = false; this.rawFile = null; this.croppedBase64 = ''; this.canvasRotation = 0; }

  clearImage(): void { if (this.userData) this.userData[this.fieldName] = ''; }
}
