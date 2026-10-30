import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonItem, IonSelect, IonSelectOption, IonInput, IonButton, IonCard, IonCardContent } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { TourService } from '../../../../../core/services/tour';
import { ToastRequest } from '../profile-shared-types';

export interface MedicalData {
  blood_type: string;
  allergies: string;
  medical_conditions: string;
  pwd_status: string;
}

/**
 * ProfileMedicalComponent — medical/vulnerability profile form extracted
 * from profile.page. `medicalData` is re-copied into local `formData` on
 * every parent-side change (input setter), matching the original page's
 * behavior of re-deriving medicalData from userData on every loadLocalUser()
 * call (including cross-tab storage-event reloads).
 */
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-profile-medical',
  standalone: true,
  imports: [CommonModule, FormsModule, IonItem, IonSelect, IonSelectOption, IonInput, IonButton, AppIconComponent],
  templateUrl: './profile-medical.component.html',
})
export class ProfileMedicalComponent {
  private api = inject(ApiService);
  public  tour = inject(TourService);

  @Input() userId: number | null = null;

  private initialData: MedicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  @Input() set medicalData(value: MedicalData) {
    this.formData = { ...value };
    this.initialData = { ...value };
  }

  hasUnsavedChanges(): boolean {
    return this.formData.blood_type !== this.initialData.blood_type ||
           this.formData.allergies !== this.initialData.allergies ||
           this.formData.medical_conditions !== this.initialData.medical_conditions ||
           this.formData.pwd_status !== this.initialData.pwd_status;
  }

  @Output() userUpdated = new EventEmitter<any>();
  @Output() toast = new EventEmitter<ToastRequest>();

  formData: MedicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };
  isSavingMedical = false;

  saveMedicalProfile() {
    if (!this.userId) { this.toast.emit({ msg: 'Session data missing. Please log out and log back in.', color: 'danger' }); return; }
    if (this.isSavingMedical) return;
    this.isSavingMedical = true;
    this.api.updateMedicalProfile({ user_id: this.userId, ...this.formData }).subscribe({
      next: (res: any) => {
        this.isSavingMedical = false;
        this.formData = { blood_type: res.user.blood_type || '', allergies: res.user.allergies || '', medical_conditions: res.user.medical_conditions || '', pwd_status: res.user.pwd_status || '' };
        this.initialData = { ...this.formData };
        this.userUpdated.emit(res.user);
        this.toast.emit({ msg: 'Medical profile saved!', color: 'success' });
      },
      error: () => { this.isSavingMedical = false; this.toast.emit({ msg: 'Failed to save.', color: 'danger' }); }
    });
  }
}
