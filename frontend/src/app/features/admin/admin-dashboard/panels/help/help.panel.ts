import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
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
      description: 'Standard operational procedure for receiving incoming citizen emergency alerts, evaluating urgency, and dispatching response units.',
      steps: [
        {
          id: 'nav-btn-active',
          callout: 'Step 1: Open CAD Workspace',
          subtext: 'Click the highlighted Incident Map button on the sidebar to open the live CAD command center.',
          waitForInteraction: true,
          interactionHint: 'Click Incident Map on the sidebar'
        },
        {
          id: 'cad-map-toolbar',
          panel: 'active',
          callout: 'Command Filter Toolbar',
          subtext: 'Filter live incidents by Barangay, category (Medical, Fire, Crime), and toggle between Street and Satellite view.',
          waitForInteraction: false,
        },
        {
          id: 'dispatch-map',
          panel: 'active',
          callout: 'Live GPS Incident Map',
          subtext: 'All emergency SOS beacons are plotted in real time with exact coordinates, GPS accuracy rings, and active responder markers.',
          waitForInteraction: false,
        },
        {
          id: 'cad-queue-container',
          panel: 'active',
          callout: 'Incident Triage Queue',
          subtext: 'Incoming calls appear ranked by severity. Click any incident card to view citizen medical info, photos, and dispatch units.',
          waitForInteraction: false,
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
          callout: 'Step 1: Open Alert Broadcast',
          subtext: 'Click the highlighted Alert Broadcast button on the sidebar to open the town-wide advisory composer.',
          waitForInteraction: true,
          interactionHint: 'Click Alert Broadcast on the sidebar'
        },
        {
          id: 'broadcast-composer',
          panel: 'broadcast',
          callout: 'Advisory Message & Media',
          subtext: 'Enter the headline and advisory notice. Attach up to 4 photos or video updates for citizen guidance.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-barangay-selector',
          panel: 'broadcast',
          callout: 'Audience Targeting',
          subtext: 'Leave on "All Barangays" for municipal blasts, or tap individual barangays to restrict the alert to specific zones.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-delivery-mode',
          panel: 'broadcast',
          callout: 'Delivery Mode Toggle',
          subtext: 'Select "Post Immediately" for critical warnings, or toggle to "Schedule for Later" to pick an auto-release date and time.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-submit-btn',
          panel: 'broadcast',
          callout: 'Review & Dispatch Alert',
          subtext: 'Click here to review recipients and send or queue the push announcement across all citizen apps.',
          waitForInteraction: false,
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
          callout: 'Step 1: Open Public Hazards',
          subtext: 'Click the highlighted Public Hazards button on the sidebar to open the road obstruction inspection map.',
          waitForInteraction: true,
          interactionHint: 'Click Public Hazards on the sidebar'
        },
        {
          id: 'cad-map-toolbar',
          panel: 'hazards',
          callout: 'Hazard Category Filters',
          subtext: 'Filter obstruction reports by Flood, Road Obstruction, Power Lines, or Landslide.',
          waitForInteraction: false,
        },
        {
          id: 'dispatch-map',
          panel: 'hazards',
          callout: 'Hazard Location Map',
          subtext: 'Orange hazard warning markers show exact road obstruction points submitted by citizens with GPS tracking.',
          waitForInteraction: false,
        },
        {
          id: 'cad-queue-container',
          panel: 'hazards',
          callout: 'Verification & Clearing',
          subtext: 'Inspect citizen photo evidence, contact the reporter if clarification is needed, and mark the hazard Resolved once cleared.',
          waitForInteraction: false,
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
          callout: 'Step 1: Open Log Archive',
          subtext: 'Click the highlighted Log Archive button on the sidebar to access historical records of all resolved incidents.',
          waitForInteraction: true,
          interactionHint: 'Click Log Archive on the sidebar'
        },
        {
          id: 'archive-filters',
          panel: 'archive',
          callout: 'Multi-Criteria Search & Filter',
          subtext: 'Filter past emergency reports by custom date ranges, incident severity, status, or barangay jurisdiction.',
          waitForInteraction: false,
        },
        {
          id: 'exportArchivePdfBtn',
          panel: 'archive',
          callout: 'Export Certified PDF',
          subtext: 'Export filtered incident logs to official certified PDF situation reports for disaster council briefings and audit compliance.',
          waitForInteraction: false,
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
          callout: 'Step 1: Open Dispatchers Staff',
          subtext: 'Click the highlighted Dispatchers button on the sidebar to manage all municipal response operators.',
          waitForInteraction: true,
          interactionHint: 'Click Dispatchers on the sidebar'
        },
        {
          id: 'add-dispatcher-btn',
          panel: 'dispatchers',
          callout: 'Register New Dispatcher',
          subtext: 'Click here to securely create accounts for newly appointed municipal dispatchers and assign their station credentials.',
          waitForInteraction: false,
        },
        {
          id: 'dispatcherSearch',
          panel: 'dispatchers',
          callout: 'Staff Search & Roster',
          subtext: 'Search dispatchers by name, email, or barangay assignment, and monitor their active duty statuses.',
          waitForInteraction: false,
        },
        {
          id: 'nav-btn-citizens',
          callout: 'Step 4: Citizen Directory',
          subtext: 'Click the highlighted Citizens button on the sidebar to inspect all registered residents.',
          waitForInteraction: true,
          interactionHint: 'Click Citizens on the sidebar'
        },
        {
          id: 'citizenSearch',
          panel: 'citizens',
          callout: 'Citizen Search & Moderation',
          subtext: 'Look up citizens to inspect submitted KYC verification documents, phone validity, and strike counts for misuse.',
          waitForInteraction: false,
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
