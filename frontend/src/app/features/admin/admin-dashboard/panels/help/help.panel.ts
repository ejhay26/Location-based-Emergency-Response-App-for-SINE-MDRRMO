import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonBadge
} from '@ionic/angular/standalone';
import { TourService, TourStep } from '../../../../../core/services/tour';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

export interface ProcedureGuide {
  id: string;
  title: string;
  category: string;
  icon: string;
  badgeColor: string;
  description: string;
  adminOnly?: boolean;
  steps: TourStep[];
}

@Component({
  selector: 'app-help-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonBadge,
    AppIconComponent,
  ],
  templateUrl: './help.panel.html',
})
export class HelpPanel {

  @Input() isAdmin = false;

  readonly procedures: ProcedureGuide[] = [
    {
      id: 'dispatch',
      title: 'Emergency SOS Incident Triage (CAD)',
      category: 'Operations',
      icon: 'siren',
      badgeColor: '#eb445a',
      description: 'Standard operational procedure for receiving incoming citizen emergency alerts, pinpointing precise GPS coordinates, evaluating urgency, and dispatching response units.',
      steps: [
        {
          id: 'nav-btn-active',
          panel: 'active',
          callout: 'Step 1: Open CAD Workspace',
          subtext: 'Click Incident Map on the sidebar to access the live Computer-Aided Dispatch (CAD) command center.',
        },
        {
          id: 'cad-map-toolbar',
          panel: 'active',
          callout: 'Command Filter Toolbar',
          subtext: 'Filter live incidents by Barangay, category (Medical, Fire, Crime), and toggle between Street and Satellite view.',
        },
        {
          id: 'dispatch-map',
          panel: 'active',
          callout: 'Live GPS Incident Map',
          subtext: 'All emergency SOS beacons are plotted in real time with exact coordinates, GPS accuracy rings, and active responder markers.',
        },
        {
          id: 'cad-queue-container',
          panel: 'active',
          callout: 'Incident Triage Queue',
          subtext: 'Incoming calls appear ranked by severity. Click any incident card to view citizen medical info, photos, and dispatch units.',
        },
      ]
    },
    {
      id: 'broadcast',
      title: 'Public Advisories & Scheduled Broadcasts',
      category: 'Public Safety',
      icon: 'broadcast',
      badgeColor: '#ffc409',
      description: 'How to compose official disaster warnings, target specific barangays or town-wide, and schedule announcements for future auto-release.',
      steps: [
        {
          id: 'nav-btn-broadcast',
          panel: 'broadcast',
          callout: 'Step 1: Open Alert Broadcast',
          subtext: 'Click Alert Broadcast on the sidebar to access the town-wide public advisory composer.',
        },
        {
          id: 'broadcast-composer',
          panel: 'broadcast',
          callout: 'Advisory Message & Media',
          subtext: 'Enter the headline and advisory notice. Attach up to 4 photos or video updates for citizen guidance.',
        },
        {
          id: 'broadcast-barangay-selector',
          panel: 'broadcast',
          callout: 'Audience Targeting',
          subtext: 'Leave on "All Barangays" for municipal blasts, or tap individual barangays to restrict the alert to specific zones.',
        },
        {
          id: 'broadcast-delivery-mode',
          panel: 'broadcast',
          callout: 'Delivery Mode Toggle',
          subtext: 'Select "Post Immediately" for critical warnings, or toggle to "Schedule for Later" to pick an auto-release date and time.',
        },
        {
          id: 'broadcast-submit-btn',
          panel: 'broadcast',
          callout: 'Review & Dispatch Alert',
          subtext: 'Click here to review recipients and send or queue the push announcement across all citizen apps.',
        },
      ]
    },
    {
      id: 'hazards',
      title: 'Community Hazard Verification & Clearing',
      category: 'Road & Safety',
      icon: 'alert-triangle',
      badgeColor: '#2dd36f',
      description: 'Procedure for inspecting citizen-reported flooded streets, fallen trees, and downed electrical wires, and updating hazard status when cleared.',
      steps: [
        {
          id: 'nav-btn-hazards',
          panel: 'hazards',
          callout: 'Step 1: Open Public Hazards',
          subtext: 'Click Public Hazards on the sidebar to access the road obstruction inspection map.',
        },
        {
          id: 'cad-map-toolbar',
          panel: 'hazards',
          callout: 'Hazard Category Filters',
          subtext: 'Filter obstruction reports by Flood, Road Obstruction, Power Lines, or Landslide.',
        },
        {
          id: 'dispatch-map',
          panel: 'hazards',
          callout: 'Hazard Location Map',
          subtext: 'Orange hazard warning markers show exact road obstruction points submitted by citizens with GPS tracking.',
        },
        {
          id: 'cad-queue-container',
          panel: 'hazards',
          callout: 'Verification & Clearing',
          subtext: 'Inspect citizen photo evidence, contact the reporter if clarification is needed, and mark the hazard Resolved once cleared.',
        },
      ]
    },
    {
      id: 'archive',
      title: 'Incident Log Archive & Official Reports',
      category: 'Audit & Legal',
      icon: 'history',
      badgeColor: '#3880ff',
      description: 'How to search historical incident logs, filter by date or barangay, and export certified records for municipal and disaster councils.',
      steps: [
        {
          id: 'nav-btn-archive',
          panel: 'archive',
          callout: 'Step 1: Open Log Archive',
          subtext: 'Click Log Archive on the sidebar to access historical records of all resolved emergency incidents.',
        },
        {
          id: 'archive-filters',
          panel: 'archive',
          callout: 'Multi-Criteria Search & Filter',
          subtext: 'Filter past emergency reports by custom date ranges, incident severity, status, or barangay jurisdiction.',
        },
        {
          id: 'exportArchivePdfBtn',
          panel: 'archive',
          callout: 'Export Certified PDF',
          subtext: 'Export filtered incident logs to official certified PDF situation reports for disaster council briefings and audit compliance.',
        },
      ]
    },
    {
      id: 'account-management',
      title: 'Personnel & Account Management',
      category: 'Admin Control',
      icon: 'users',
      badgeColor: '#bc6fff',
      adminOnly: true,
      description: 'Administrative standard procedure for managing dispatcher staff, creating responder accounts, verifying citizen KYC identity credentials, and moderating false alarm strikes.',
      steps: [
        {
          id: 'nav-btn-dispatchers',
          panel: 'dispatchers',
          callout: 'Step 1: Open Dispatchers Staff',
          subtext: 'Click Dispatchers on the sidebar to manage all municipal response operators and their assigned duties.',
        },
        {
          id: 'add-dispatcher-btn',
          panel: 'dispatchers',
          callout: 'Register New Dispatcher',
          subtext: 'Click here to securely create accounts for newly appointed municipal dispatchers and assign their station credentials.',
        },
        {
          id: 'dispatcherSearch',
          panel: 'dispatchers',
          callout: 'Staff Search & Roster',
          subtext: 'Search dispatchers by name, email, or barangay assignment, and monitor their active duty statuses.',
        },
        {
          id: 'nav-btn-citizens',
          panel: 'citizens',
          callout: 'Step 4: Citizen Directory',
          subtext: 'Click Citizens on the sidebar to inspect all registered residents, verify identity documents, and enforce disciplinary strikes.',
        },
        {
          id: 'citizenSearch',
          panel: 'citizens',
          callout: 'Citizen Search & Moderation',
          subtext: 'Look up citizens to inspect submitted KYC verification documents, phone validity, and strike counts for misuse.',
        },
      ]
    },
  ];

  get filteredProcedures(): ProcedureGuide[] {
    return this.procedures.filter(p => !p.adminOnly || this.isAdmin);
  }

  constructor(private tour: TourService) {}

  startWalkthrough(procedure: ProcedureGuide): void {
    this.tour.startCustomSteps(procedure.steps);
  }
}
