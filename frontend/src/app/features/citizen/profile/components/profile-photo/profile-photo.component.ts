import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, AlertController } from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../../../../../core/services/api';
import { ImageCacheService } from '../../../../../core/services/image-cache';
import { TourService } from '../../../../../core/services/tour';
import { ToastRequest } from '../profile-shared-types';

/**
 * ProfilePhotoComponent — avatar display, photo picker, and crop flow
 * extracted from profile.page. Owns the entire avatar-resolution lifecycle
 * (imageCache lookups) so that logic isn't split across parent and child;
 * the parent only ever passes the raw `profile_picture` path down.
 */
@Component({
  selector: 'app-profile-photo',
  standalone: true,
  imports: [CommonModule, IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, ImageCropperComponent],
  templateUrl: './profile-photo.component.html',
})
export class ProfilePhotoComponent implements OnChanges {
  private api        = inject(ApiService);
  private alertCtrl  = inject(AlertController);
  private imageCache = inject(ImageCacheService);
  public  tour        = inject(TourService);

  @Input() profilePicturePath: string | null | undefined = null;
  @Input() userId: number | null = null;

  @Output() userUpdated = new EventEmitter<any>();
  @Output() toast = new EventEmitter<ToastRequest>();

  resolvedAvatarUrl = '';

  showCropper   = false;
  cropperFile: File | null = null;
  croppedBase64 = '';
  isCropping    = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['profilePicturePath']) {
      this.resolveAvatar(this.profilePicturePath);
    }
  }

  private resolveAvatar(path: string | null | undefined) {
    if (!path) { this.resolvedAvatarUrl = ''; return; }
    const cached = this.imageCache.getCached(path);
    if (cached) { this.resolvedAvatarUrl = cached; } else {
      this.resolvedAvatarUrl = '';
      this.imageCache.resolve(path).then(url => { this.resolvedAvatarUrl = url; });
    }
  }

  async triggerPhotoPicker() {
    const a = await this.alertCtrl.create({
      header: 'Change Profile Photo',
      subHeader: '⚠️ Verification Notice',
      message: 'Please upload an authentic and recognizable photo of yourself. Uploading inappropriate, misleading, or non-personal images will result in account warnings and suspension.',
      buttons: [
        { text: 'Choose from Gallery', handler: () => { this.selectFromSource(CameraSource.Photos); } },
        { text: 'Take a Photo',        handler: () => { this.selectFromSource(CameraSource.Camera); } },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await a.present();
  }

  async selectFromSource(source: CameraSource) {
    try {
      if (source === CameraSource.Camera) {
        try {
          await Camera.requestPermissions({ permissions: ['camera'] });
        } catch {
          // Camera permission fallback handled by getPhoto
        }
      }
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });
      if (!result.dataUrl) return;
      const res = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.cropperFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      this.croppedBase64 = '';
      this.showCropper = true;
    } catch (e) {
      console.warn('ProfilePhoto: selection dismissed or error', e);
    }
  }

  onPhotoCropped(event: ImageCroppedEvent) {
    if (event.base64 && event.base64.length > 100) this.croppedBase64 = event.base64;
  }

  async confirmCrop() {
    if (!this.croppedBase64 || this.croppedBase64.length < 100) {
      this.toast.emit({ msg: 'Please wait for the image to load, then try again.', color: 'warning' }); return;
    }
    if (!this.userId) { this.toast.emit({ msg: 'Session data missing. Please log out and log back in.', color: 'danger' }); return; }
    if (this.isCropping) return;
    this.isCropping = true; this.showCropper = false;
    const imagePayload = this.croppedBase64.startsWith('data:') ? this.croppedBase64 : `data:image/jpeg;base64,${this.croppedBase64}`;
    this.api.updateProfilePicture({ user_id: this.userId, image: imagePayload }).subscribe({
      next: async (res: any) => {
        this.isCropping = false;
        this.imageCache.clear();
        this.resolvedAvatarUrl = await this.imageCache.resolve(res.user.profile_picture);
        this.userUpdated.emit(res.user);
        window.dispatchEvent(new Event('storage'));
        this.toast.emit({ msg: 'Profile picture updated!', color: 'success' });
      },
      error: (err: any) => { this.isCropping = false; this.toast.emit({ msg: err?.error?.message || 'Failed to update photo.', color: 'danger' }); }
    });
    this.cropperFile = null; this.croppedBase64 = '';
  }

  cancelCrop() { this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; }
}
