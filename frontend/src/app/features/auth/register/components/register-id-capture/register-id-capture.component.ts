import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

/**
 * RegisterIdCaptureComponent — reusable capture+crop flow used for both the
 * "Valid ID" photo and the "Selfie with ID" photo during registration.
 */
@Component({
  selector: 'app-register-id-capture',
  standalone: true,
  imports: [CommonModule, IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, ImageCropperComponent, AppIconComponent],
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
        description: 'Now the back of the same ID.',
        buttonLabel: 'Capture Back of ID',
        buttonIcon: 'id-card',
        modalTitle: 'Crop the Back of Your ID',
        fileName: 'id_back_capture.jpg',
        direction: undefined as CameraDirection | undefined,
      };
    }
    return {
      title: 'Valid ID — Front',
      description: 'A clear photo of the front of your ID is required for account verification.',
      buttonLabel: 'Capture ID Photo',
      buttonIcon: 'id-card',
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

  async retakeCrop(): Promise<void> {
    this.croppedBase64 = '';
    await this.triggerCapture();
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
