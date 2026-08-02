import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent } from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

/**
 * RegisterIdCaptureComponent — reusable capture+crop flow used for both the
 * "Valid ID" photo and the "Selfie with ID" photo during registration.
 * The original register.page duplicated this entire flow (capture button,
 * preview, crop modal) twice with only cosmetic differences (title, icon,
 * camera direction) — consolidated here into one component driven by
 * `variant`, written back onto the shared `userData` object via `fieldName`
 * so the parent's step-1 validation (`!!userData.valid_id_image` etc.) needs
 * no separate synced flag.
 */
@Component({
  selector: 'app-register-id-capture',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, ImageCropperComponent],
  templateUrl: './register-id-capture.component.html',
})
export class RegisterIdCaptureComponent {
  @Input() variant: 'id' | 'selfie' = 'id';
  @Input() fieldName: 'valid_id_image' | 'selfie_with_id_image' = 'valid_id_image';
  @Input() userData: any;

  @Output() toast = new EventEmitter<string>();

  rawFile: File | null = null;
  showCropper = false;
  croppedBase64 = '';

  get config() {
    return this.variant === 'selfie'
      ? {
          title: 'Selfie with Valid ID',
          description: "Take a selfie holding the same ID so we can confirm it's you.",
          buttonLabel: 'Capture Selfie',
          buttonIcon: 'fa-solid fa-camera-retro',
          modalTitle: 'Crop Your Selfie',
          fileName: 'selfie_capture.jpg',
          direction: CameraDirection.Front,
        }
      : {
          title: 'Valid ID Verification',
          description: 'A clear photo of your ID is required for account verification.',
          buttonLabel: 'Capture ID Photo',
          buttonIcon: 'fa-solid fa-id-card',
          modalTitle: 'Crop Your ID Photo',
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
      this.showCropper = true;
    } catch { /* cancelled */ }
  }

  onCropped(event: ImageCroppedEvent): void { this.croppedBase64 = event.base64 ?? ''; }

  confirmCrop(): void {
    if (!this.croppedBase64) { this.toast.emit('Please wait for the image to load.'); return; }
    if (this.userData) this.userData[this.fieldName] = this.croppedBase64;
    this.showCropper = false;
    this.rawFile = null;
  }

  cancelCrop(): void { this.showCropper = false; this.rawFile = null; this.croppedBase64 = ''; }

  clearImage(): void { if (this.userData) this.userData[this.fieldName] = ''; }
}
