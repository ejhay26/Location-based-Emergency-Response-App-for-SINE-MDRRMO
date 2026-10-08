import { Component, Input, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardContent, IonItem, IonButton, IonInput, IonButtons,
  ToastController, IonTextarea, IonRow, IonCol, ModalController
} from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { NetworkService } from '../../../core/services/network';
import { OfflineQueueService } from '../../../core/services/offline-queue';
import { DialogService } from '../../../core/services/dialog.service';
import { TourService } from '../../../core/services/tour';
import { LocationService } from '../../../core/services/location';
import { AuthSessionService } from '../../../core/services/auth-session.service';
import { PressFeedbackDirective } from '../../../shared/directives/press-feedback.directive';
import { ReportTypeSelectorComponent } from './components/report-type-selector/report-type-selector.component';
import type { ConfirmDialogDetail } from '../../../core/services/dialog.service';
import { ReportMapComponent, ReportCoords } from './components/report-map/report-map.component';
import { ReportMediaComponent, MediaFile } from './components/report-media/report-media.component';

import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonButton, IonButtons, IonTextarea, PressFeedbackDirective,
    ReportTypeSelectorComponent, ReportMapComponent, ReportMediaComponent, AppIconComponent
  ]
})
export class ReportPage implements OnDestroy {
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private toastCtrl   = inject(ToastController);
  private dialog      = inject(DialogService);
  private api          = inject(ApiService);
  private network      = inject(NetworkService);
  private offlineQueue = inject(OfflineQueueService);
  private modalCtrl    = inject(ModalController);
  public  tour        = inject(TourService);
  private authSession = inject(AuthSessionService);
  /**
   * Perf: continuous high-accuracy GPS tracking (LocationService.start())
   * is now scoped to exactly the lifetime of this page/modal being open,
   * instead of running for the whole logged-in session (see
   * app.component.ts, where the old always-on start() call was removed).
   * The report map is the ONLY consumer of LocationService.cachedPosition/
   * the live watch in the whole app — Home, History, Profile, Settings etc.
   * never read it — so there's no reason GPS should be actively polling
   * while the citizen is just browsing elsewhere.
   */
  private locationSvc  = inject(LocationService);

  @ViewChild(ReportMapComponent) reportMapCmp?: ReportMapComponent;
  @ViewChild(ReportTypeSelectorComponent) typeSelectorCmp?: ReportTypeSelectorComponent;

  /**
   * Set via ModalController's componentProps when opened from Home (see
   * home.page.ts/openReport) — that's the primary path now. The `/report`
   * ROUTE still exists as a fallback (direct link, anything else that might
   * still reference it) and is untouched: when presentedAsModal is false,
   * reportType/close() behave exactly as they did before this changed.
   */
  @Input() presentedAsModal = false;
  @Input() reportType: 'emergency' | 'hazard' = 'emergency';

  ngOnInit() {
    if (!this.presentedAsModal) {
      const type = this.route.snapshot.queryParamMap.get('type');
      this.reportType = type === 'hazard' ? 'hazard' : 'emergency';
    }
    this.restoreDraftIfPresent();
  }

  mediaFiles: MediaFile[] = [];
  get hasMedia(): boolean { return this.mediaFiles.length > 0; }

  reportForm: FormGroup = this.fb.group({
    incident_type_id: [''], hazard_type: [''], description: [''],
    latitude: ['', Validators.required], longitude: ['', Validators.required],
  });

  isSubmitting = false;
  private isSubmitted = false;
  /** Captured from ReportMapComponent's live preview via onCoordsChanged — shown in the pre-submit confirmation dialog. Preview only: never sent to the backend, which resolves barangay_id independently (see BarangayResolver) before persisting. */
  resolvedBarangayName: string | null = null;

  get isFormReady(): boolean {
    if (!this.reportForm.value.latitude || !this.reportForm.value.longitude) return false;
    if (this.reportType === 'emergency') return !!this.reportForm.value.incident_type_id;
    return !!this.reportForm.value.hazard_type && this.hasMedia;
  }

  constructor() {}

  /** Checks if any report details or media were provided by the user. */
  private hasDraftContent(): boolean {
    const val = this.reportForm.value;
    const hasDetails = !!(val?.description && val.description.trim().length > 0);
    const hasType = !!(val?.incident_type_id || val?.hazard_type);
    const hasLocation = !!(val?.latitude && val?.longitude);
    const hasMedia = this.mediaFiles.length > 0;
    return hasDetails || hasType || hasLocation || hasMedia;
  }

  /** Saves active report input fields to sessionStorage so they are preserved across auth bounces. */
  saveDraft(): void {
    const val = this.reportForm.value;
    const draft = {
      reportType: this.reportType,
      incident_type_id: val.incident_type_id || '',
      hazard_type: val.hazard_type || '',
      description: val.description || '',
      latitude: val.latitude || '',
      longitude: val.longitude || '',
      resolvedBarangayName: this.resolvedBarangayName,
      mediaFiles: this.mediaFiles,
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem('pending_report_draft', JSON.stringify(draft));
    } catch {
      try {
        sessionStorage.setItem('pending_report_draft', JSON.stringify({ ...draft, mediaFiles: [] }));
      } catch {
        // Storage quota error ignored
      }
    }
  }

  /** Clears persisted draft upon successful submission. */
  clearDraft(): void {
    sessionStorage.removeItem('pending_report_draft');
  }

  /** Restores any draft found in sessionStorage. */
  private restoreDraftIfPresent(): void {
    try {
      const raw = sessionStorage.getItem('pending_report_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === 'object') {
        if (draft.reportType === 'hazard' || draft.reportType === 'emergency') {
          this.reportType = draft.reportType;
        }
        this.reportForm.patchValue({
          incident_type_id: draft.incident_type_id || '',
          hazard_type: draft.hazard_type || '',
          description: draft.description || '',
          latitude: draft.latitude || '',
          longitude: draft.longitude || '',
        });
        if (draft.resolvedBarangayName) {
          this.resolvedBarangayName = draft.resolvedBarangayName;
        }
        if (Array.isArray(draft.mediaFiles) && draft.mediaFiles.length > 0) {
          this.mediaFiles = draft.mediaFiles;
        }
        this.clearDraft();
        this.showToast('Your unsent report draft has been restored.', 'primary');
      }
    } catch {
      // Draft parse error ignored
    }
  }

  ionViewDidEnter() {
    this.locationSvc.start();
    this.reportMapCmp?.tryInit();
    setTimeout(() => this.reportMapCmp?.tryInit(), 150);
    setTimeout(() => this.reportMapCmp?.tryInit(), 400);
  }

  ionViewWillLeave() {
    this.reportMapCmp?.cleanup();
    this.locationSvc.stop();
  }

  ngOnDestroy() {
    if (this.authSession.isTerminatingSession && !this.isSubmitted && this.hasDraftContent()) {
      this.saveDraft();
    }
    this.reportMapCmp?.cleanup();
    this.locationSvc.stop();
  }

  onCoordsChanged(coords: ReportCoords | null) {
    if (coords) {
      this.reportForm.patchValue({ latitude: coords.latitude, longitude: coords.longitude });
      this.resolvedBarangayName = coords.barangayName;
    } else {
      this.reportForm.patchValue({ latitude: '', longitude: '' });
      this.resolvedBarangayName = null;
    }
  }

  /** Summarizes what's about to be submitted, shown inside the confirm dialog so the person can double-check before sending. */
  private buildConfirmDetails(): ConfirmDialogDetail[] {
    const details: ConfirmDialogDetail[] = [];
    if (this.reportType === 'emergency') {
      details.push({ label: 'Type', value: this.typeSelectorCmp?.selectedIncidentName || 'None', icon: 'alert' });
    } else {
      details.push({ label: 'Hazard', value: this.typeSelectorCmp?.selectedHazardName || 'None', icon: 'hazard' });
    }
    const desc = (this.reportForm.value.description || '').trim();
    details.push({
      label: 'Details',
      value: desc ? (desc.length > 60 ? desc.slice(0, 57) + '…' : desc) : 'None provided',
      icon: 'file-text',
    });
    details.push({
      label: 'Attachments',
      value: this.mediaFiles.length > 0 ? `${this.mediaFiles.length} file${this.mediaFiles.length !== 1 ? 's' : ''}` : 'None',
      icon: 'paperclip',
    });
    details.push({
      label: 'Barangay',
      value: this.resolvedBarangayName || 'Unresolved',
      icon: 'map',
    });
    const lat = this.reportForm.value.latitude, lng = this.reportForm.value.longitude;
    details.push({
      label: 'Location',
      value: lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'Not set',
      icon: 'map-pin',
    });
    return details;
  }

  /** Header back/close button — dismisses the modal when presented that way, otherwise falls back to the old route-based navigation. */
  close() {
    if (this.presentedAsModal) { this.modalCtrl.dismiss(null, 'cancel'); }
    else { this.router.navigate(['/tabs/home']); }
  }

  /** Same dismiss-vs-navigate branch, used after a successful submission. */
  private goHome() {
    this.isSubmitted = true;
    this.clearDraft();
    if (this.presentedAsModal) { this.modalCtrl.dismiss({ submitted: true }, 'submitted'); }
    else { this.router.navigate(['/tabs/home']); }
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
    const confirmed = await this.dialog.confirm({
      title: label, message: msg,
      icon: this.reportType === 'emergency' ? 'alert' : 'hazard',
      iconColor: 'var(--ion-color-danger)',
      confirmLabel: 'Confirm', confirmColor: 'var(--ion-color-danger)',
      details: this.buildConfirmDetails(),
    });
    if (!confirmed) return;

    const rawUser = localStorage.getItem('user');
    const token = localStorage.getItem('api_token');
    if (!rawUser || !token) {
      this.saveDraft();
      void this.authSession.terminateSession('Please log in again to submit your report.');
      return;
    }
    let user: any;
    try {
      user = JSON.parse(rawUser);
    } catch {
      this.saveDraft();
      void this.authSession.terminateSession('Please log in again to submit your report.');
      return;
    }

    this.isSubmitting = true;
    const proofFiles = this.mediaFiles.map(m => m.preview);
    const payload = this.reportType === 'emergency'
      ? { user_id: user.user_id, incident_type_id: this.reportForm.value.incident_type_id, description: this.reportForm.value.description, latitude: this.reportForm.value.latitude, longitude: this.reportForm.value.longitude, proof_files: proofFiles }
      : { user_id: user.user_id, description: this.reportForm.value.description || '', hazard_type: this.reportForm.value.hazard_type, latitude: this.reportForm.value.latitude, longitude: this.reportForm.value.longitude, proof_files: proofFiles };

    // Skip the live attempt entirely when we already know we're offline —
    // no point waiting out a doomed request's timeout first. `isOnline` is
    // the last-known state from NetworkService's listeners; queueLiveOrOffline
    // still re-verifies with a real probe before trusting either path (see
    // NetworkService doc comment on why navigator.onLine alone isn't enough).
    await this.submitOrQueue(payload);
  }

  /**
   * Tries a live submission first; on a genuine network failure (not a
   * validation/business-rule rejection — those still surface as errors
   * normally) falls back to the offline queue instead of just failing the
   * user's report outright. Either path ends with goHome() — from the
   * user's perspective the report was accepted either way, just with a
   * different toast explaining which happened.
   */
  private async submitOrQueue(payload: Record<string, unknown>) {
    const kind = this.reportType === 'emergency' ? 'sos' : 'hazard';
    const reachable = this.network.isOnline() ? await this.network.recheck() : false;

    if (!reachable) {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('api_token');
      if (!user || !token) {
        this.saveDraft();
        this.isSubmitting = false;
        this.showToast('Authentication required. Please reconnect and log in to send your report.', 'warning');
        return;
      }
      await this.queueAndNotify(kind, payload);
      return;
    }

    const submit$ = kind === 'sos' ? this.api.submitSos(payload) : this.api.submitHazard(payload);
    submit$.subscribe({
      next: () => {
        this.isSubmitted = true;
        this.clearDraft();
        this.isSubmitting = false;
        this.showToast(kind === 'sos' ? 'Emergency SOS sent!' : 'Hazard reported!', 'success');
        this.goHome();
      },
      error: async (err: any) => {
        // status 0 = no HTTP response reached us at all — a genuine network
        // failure (connection dropped mid-request, DNS failure, etc), as
        // opposed to the server actually responding with a rejection (422
        // validation, 429 duplicate-SOS, etc), which should still surface
        // as a normal error, not silently queue a report the server has
        // already told us is invalid.
        if (err?.status === 0) {
          await this.queueAndNotify(kind, payload);
          return;
        }
        if (err?.status === 401) {
          // Token expired or revoked: keep form data, do NOT queue report, tell user to log in again
          this.saveDraft();
          this.isSubmitting = false;
          return;
        }
        this.isSubmitting = false;
        this.showToast(err.error?.message || 'Submission failed.', 'danger');
      }
    });
  }

  private async queueAndNotify(kind: 'sos' | 'hazard', payload: Record<string, unknown>) {
    await this.offlineQueue.enqueue(kind, payload);
    this.isSubmitting = false;
    this.showToast(
      'No connection — your report is saved and will send automatically once you\'re back online.',
      'warning'
    );
    this.goHome();
  }
}
