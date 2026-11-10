import { Component, EventEmitter, Input, Output } from '@angular/core';
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
 * for government IDs to prevent invalid portrait captures, with 90° rotation and
 * rich graphical preview guides.
 */
@Component({
  selector: 'app-register-id-capture',
  standalone: true,
  imports: [CommonModule, IonButton, IonButtons, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, ImageCropperComponent, AppIconComponent],
  templateUrl: './register-id-capture.component.html',
})
export class RegisterIdCaptureComponent {
  @Input() variant: 'id' | 'id-back' | 'selfie' = 'id';
  @Input() fieldName: 'valid_id_image' | 'valid_id_image_back' | 'selfie_with_id_image' = 'valid_id_image';
  @Input() userData: any;

  @Output() toast = new EventEmitter<string>();

  rawFile: File | null = null;
  showCropper = false;
  croppedBase64 = '';
  isEnhancing = false;
  canvasRotation = 0;

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

  async triggerCapture(): Promise<void> {
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
