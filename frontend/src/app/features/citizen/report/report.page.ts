import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
  ToastController, AlertController, IonTextarea, IonRow, IonCol
} from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { ReportTypeSelectorComponent } from './components/report-type-selector/report-type-selector.component';
import { ReportMapComponent, ReportCoords } from './components/report-map/report-map.component';
import { ReportMediaComponent, MediaFile } from './components/report-media/report-media.component';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
    IonTextarea, IonRow, IonCol,
    ReportTypeSelectorComponent, ReportMapComponent, ReportMediaComponent
  ]
})
export class ReportPage implements OnDestroy {
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private toastCtrl   = inject(ToastController);
  private alertCtrl   = inject(AlertController);
  private api         = inject(ApiService);
  public  tour        = inject(TourService);

  @ViewChild(ReportMapComponent) reportMapCmp?: ReportMapComponent;

  reportType: 'emergency' | 'hazard' = 'emergency';

  ngOnInit() {
    const type = this.route.snapshot.queryParamMap.get('type');
    this.reportType = type === 'hazard' ? 'hazard' : 'emergency';
  }

  mediaFiles: MediaFile[] = [];
  get hasMedia(): boolean { return this.mediaFiles.length > 0; }

  reportForm: FormGroup = this.fb.group({
    incident_type_id: [''], hazard_type: [''], description: [''],
    latitude: ['', Validators.required], longitude: ['', Validators.required],
  });

  isSubmitting = false;

  get isFormReady(): boolean {
    if (!this.reportForm.value.latitude || !this.reportForm.value.longitude) return false;
    if (this.reportType === 'emergency') return !!this.reportForm.value.incident_type_id;
    return !!this.reportForm.value.hazard_type && this.hasMedia;
  }

  constructor() {}

  ionViewDidEnter() {
    setTimeout(() => this.reportMapCmp?.tryInit(), 250);
  }

  ionViewWillLeave() {
    this.reportMapCmp?.cleanup();
  }

  ngOnDestroy() {
    this.reportMapCmp?.cleanup();
  }

  onCoordsChanged(coords: ReportCoords | null) {
    if (coords) {
      this.reportForm.patchValue({ latitude: coords.latitude, longitude: coords.longitude });
    } else {
      this.reportForm.patchValue({ latitude: '', longitude: '' });
    }
  }

  async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }

  async submitReport() {
    if (this.isSubmitting) return;
    if (this.reportType === 'hazard' && !this.hasMedia) { this.showToast('At least one photo or video is required for hazard reports.', 'warning'); return; }
    if (!this.isFormReady) { this.showToast('Please fill out all required fields.', 'warning'); return; }
    const label = this.reportType === 'emergency' ? 'Send Emergency SOS' : 'Submit Hazard Report';
    const msg   = this.reportType === 'emergency' ? 'Only submit for real emergencies. False reports are legally actionable.' : 'Are you sure you want to submit this hazard report?';
    const confirmed = await new Promise<boolean>(resolve => {
      this.alertCtrl.create({
        header: label, message: msg,
        buttons: [{ text: 'Cancel', role: 'cancel', handler: () => resolve(false) }, { text: 'Confirm', role: 'destructive', handler: () => resolve(true) }]
      }).then(a => { a.present(); a.onDidDismiss().then(r => resolve(r.role === 'destructive')); });
    });
    if (!confirmed) return;
    this.isSubmitting = true;
    const user       = JSON.parse(localStorage.getItem('user')!);
    const proofFiles = this.mediaFiles.map(m => m.preview);
    if (this.reportType === 'emergency') {
      this.api.submitSos({ user_id: user.user_id, incident_type_id: this.reportForm.value.incident_type_id, description: this.reportForm.value.description, latitude: this.reportForm.value.latitude, longitude: this.reportForm.value.longitude, proof_files: proofFiles }).subscribe({
        next: () => { this.isSubmitting = false; this.showToast('Emergency SOS sent!', 'success'); this.router.navigate(['/tabs/home']); },
        error: (err: any) => { this.isSubmitting = false; this.showToast(err.error?.message || 'Submission failed.', 'danger'); }
      });
    } else {
      this.api.submitHazard({ user_id: user.user_id, description: this.reportForm.value.description || '', hazard_type: this.reportForm.value.hazard_type, latitude: this.reportForm.value.latitude, longitude: this.reportForm.value.longitude, proof_files: proofFiles }).subscribe({
        next: () => { this.isSubmitting = false; this.showToast('Hazard reported!', 'success'); this.router.navigate(['/tabs/home']); },
        error: (err: any) => { this.isSubmitting = false; this.showToast(err.error?.message || 'Submission failed.', 'danger'); }
      });
    }
  }
}
