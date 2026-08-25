import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonSegment, IonSegmentButton, IonLabel, ModalController } from '@ionic/angular/standalone';
import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonSegment, IonSegmentButton, IonLabel, AppIconComponent],
  template: `
<ion-header class="ion-no-border">
  <ion-toolbar color="danger">
    <ion-title style="color: white; font-weight: 800; font-size: 16px;">
      <app-icon name="shield-check" [size]="18" color="#ffffff" style="margin-right: 8px;"></app-icon>Terms &amp; Policies
    </ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="dismiss(false)" style="color: white; font-weight: 700;">
        <app-icon name="close" [size]="18" color="#ffffff"></app-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>

  <ion-toolbar style="--background: var(--ion-card-background, white); border-bottom: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.08));">
    <ion-segment [value]="activeTab" (ionChange)="activeTab = $any($event.detail.value)" mode="ios" color="danger" style="padding: 4px 12px;">
      <ion-segment-button value="terms">
        <ion-label style="font-weight: 700; font-size: 12px;">Terms of Service</ion-label>
      </ion-segment-button>
      <ion-segment-button value="privacy">
        <ion-label style="font-weight: 700; font-size: 12px;">Privacy Policy</ion-label>
      </ion-segment-button>
    </ion-segment>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding" style="--background: var(--ion-background-color, #f4f5f8); font-size: 13px; line-height: 1.6; color: var(--ion-text-color);">
  <div style="max-width: 600px; margin: 0 auto; background: var(--ion-card-background, white); border-radius: 18px; padding: 20px; box-shadow: var(--card-shadow); border: var(--card-border, 1px solid rgba(0,0,0,0.08));">

    <!-- ══ TERMS OF SERVICE ══ -->
    <div *ngIf="activeTab === 'terms'">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid rgba(235,68,90,0.15);">
        <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(235,68,90,0.12); color: var(--ion-color-danger); display: flex; align-items: center; justify-content: center;">
          <app-icon name="id-card" [size]="20" color="var(--ion-color-danger)"></app-icon>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--ion-color-danger);">Terms of Service</h3>
          <p style="margin: 0; font-size: 11px; color: var(--ion-color-medium);">MDRRMO San Isidro Emergency Response App</p>
        </div>
      </div>

      <h4 style="color: var(--ion-color-danger); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">1. What is this app for?</h4>
      <p style="margin: 0 0 10px 0;">
        This app is provided by MDRRMO San Isidro to help residents quickly report emergencies, report road hazards, receive weather alerts, and ask for rescue help in times of need.
      </p>

      <h4 style="color: var(--ion-color-danger); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">2. No Fake Reports or Pranks</h4>
      <div style="background: rgba(235,68,90,0.08); border-left: 4px solid var(--ion-color-danger); padding: 10px 12px; border-radius: 10px; margin: 8px 0;">
        <strong style="color: var(--ion-color-danger); font-size: 12px;">IMPORTANT NOTICE:</strong>
        <p style="margin: 4px 0 0 0; font-size: 12px;">
          Please never send fake or prank reports. First responders risk their lives responding to emergencies. If you send a false alarm, you will receive a strike. Getting 3 strikes will permanently ban your account and may be reported to the police for legal action under local and national laws.
        </p>
      </div>

      <h4 style="color: var(--ion-color-danger); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">3. Why do we need your ID?</h4>
      <p style="margin: 0 0 10px 0;">
        We ask for a valid ID and selfie to make sure every user is a real person. MDRRMO staff checks each registration before activating full report features so that fake accounts cannot abuse the system.
      </p>

      <h4 style="color: var(--ion-color-danger); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">4. Your Responsibility</h4>
      <p style="margin: 0 0 10px 0;">
        Please make sure your details (name, phone number, address) are correct. Keep your password safe, and only press the emergency button when there is a real emergency.
      </p>
    </div>

    <!-- ══ PRIVACY POLICY ══ -->
    <div *ngIf="activeTab === 'privacy'">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid rgba(45,211,111,0.2);">
        <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(45,211,111,0.12); color: #2dd36f; display: flex; align-items: center; justify-content: center;">
          <app-icon name="shield-check" [size]="20" color="#2dd36f"></app-icon>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #2dd36f;">Privacy Policy</h3>
          <p style="margin: 0; font-size: 11px; color: var(--ion-color-medium);">Data Privacy Act of 2012 (RA 10173)</p>
        </div>
      </div>

      <h4 style="color: var(--ion-text-color); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">1. What information do we collect?</h4>
      <p style="margin: 0 0 10px 0;">
        We follow the Philippine Data Privacy Act (RA 10173). We only collect what is needed to verify your account and help you during emergencies:
      </p>
      <ul style="margin: 0 0 12px 18px; padding: 0;">
        <li><strong>Basic Info:</strong> Your name, phone number, email, barangay, and photo of your ID for verification.</li>
        <li><strong>GPS Location:</strong> Your pin location is only shared when you send an emergency or hazard report so rescuers know where to go.</li>
        <li><strong>Optional Medical Info:</strong> Your blood type, allergies, or medical conditions so medical responders are prepared.</li>
      </ul>

      <h4 style="color: var(--ion-text-color); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">2. How do we protect your data?</h4>
      <p style="margin: 0 0 10px 0;">
        Your photos and details are stored securely. Only authorized MDRRMO officers can view your verification records. We never sell, give, or share your private information with any third party or advertiser.
      </p>

      <h4 style="color: var(--ion-text-color); font-size: 13px; font-weight: 800; margin: 16px 0 6px 0;">3. Record Keeping</h4>
      <p style="margin: 0 0 10px 0;">
        Emergency reports and incident history are kept for official disaster response records and municipal reporting as required by government standards.
      </p>
    </div>

    <!-- Acceptance button -->
    <div style="margin-top: 24px; padding-top: 16px; border-top: var(--inset-divider, 1px solid rgba(0,0,0,0.08));">
      <ion-button expand="block" color="danger" (click)="dismiss(true)" style="font-weight: 800; height: 50px; --border-radius: 14px; --box-shadow: 0 4px 16px rgba(211,47,47,0.3);">
        <app-icon name="check" [size]="18" color="#ffffff" style="margin-right: 8px;"></app-icon> I Understand &amp; Agree
      </ion-button>
    </div>

  </div>
</ion-content>
`,
})
export class TermsModalComponent {
  @Input() activeTab: 'terms' | 'privacy' = 'terms';

  private modalCtrl = inject(ModalController);

  dismiss(accepted = false): void {
    this.modalCtrl.dismiss({ accepted });
  }
}
