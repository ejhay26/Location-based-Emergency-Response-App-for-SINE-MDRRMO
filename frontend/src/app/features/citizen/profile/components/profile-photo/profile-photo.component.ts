import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonContent, AlertController } from '@ionic/angular/standalone';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
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
      buttons: [
        { text: 'Choose from Gallery', handler: () => { document.getElementById('profileGalleryInput')?.click(); } },
        { text: 'Take a Photo',        handler: () => { document.getElementById('profileCameraInput')?.click(); } },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await a.present();
  }

  onPhotoFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      this.toast.emit({ msg: 'Only photos are accepted (no GIFs or videos).', color: 'warning' }); return;
    }
    if (file.size > 10 * 1024 * 1024) { this.toast.emit({ msg: 'Image too large. Max 10MB.', color: 'warning' }); return; }
    this.cropperFile = file; this.croppedBase64 = ''; this.showCropper = true;
    (event.target as HTMLInputElement).value = '';
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
