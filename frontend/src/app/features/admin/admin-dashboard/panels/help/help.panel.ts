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
      id: 'incident-map',
      title: 'Live Incident & Hazard Map',
      category: 'Operations',
      icon: 'map',
      badgeColor: '#eb445a',
      description: 'How to monitor incoming emergency SOS alerts and public road hazards on the live map, check victim details, and send response teams.',
      steps: [
        {
          id: 'nav-btn-active',
          callout: 'Step 1: Open Incident Map',
          subtext: 'Click the highlighted Incident Map button on the sidebar to open the live map and incoming alerts.',
          waitForInteraction: true,
          interactionHint: 'Click Incident Map on the sidebar'
        },
        {
          id: 'cad-map-toolbar',
          panel: 'active',
          callout: 'Filter by Barangay & Type',
          subtext: 'Easily filter what you see on the map — choose specific barangays, or filter between Emergency SOS calls (Medical, Fire, Crime) and Public Hazards (Floods, Road blocks).',
          waitForInteraction: false,
        },
        {
          id: 'dispatch-map',
          panel: 'active',
          callout: 'Live GPS Map & Pins',
          subtext: 'Red pins mark active emergency SOS calls from citizens. Orange pins mark reported road hazards and street obstructions across San Isidro.',
          waitForInteraction: false,
        },
        {
          id: 'cad-queue-container',
          panel: 'active',
          callout: 'Incoming Alerts List',
          subtext: 'All incoming emergency calls and hazard reports appear in this list. Click any card to view photos, medical info, and assign responder units.',
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
      description: 'How to write official disaster warnings, send immediate or scheduled push alerts to citizen phones, and manage active broadcasts.',
      steps: [
        {
          id: 'nav-btn-broadcast',
          callout: 'Step 1: Open Alert Broadcast',
          subtext: 'Click the highlighted Alert Broadcast button on the sidebar to open the advisory composer.',
          waitForInteraction: true,
          interactionHint: 'Click Alert Broadcast on the sidebar'
        },
        {
          id: 'broadcast-composer',
          panel: 'broadcast',
          callout: 'Message & Attachments',
          subtext: 'Enter the headline and advisory notice. You can attach up to 4 photos or weather graphics for citizen guidance.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-barangay-selector',
          panel: 'broadcast',
          callout: 'Choose Target Barangays',
          subtext: 'Leave on "All Barangays" for town-wide alerts, or select individual barangays to target specific areas only.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-delivery-mode',
          panel: 'broadcast',
          callout: 'Send Now or Schedule',
          subtext: 'Choose "Post Immediately" for urgent alerts, or toggle to "Schedule for Later" to pick an automatic release date and time.',
          waitForInteraction: false,
        },
        {
          id: 'broadcast-submit-btn',
          panel: 'broadcast',
          callout: 'Send or Queue Alert',
          subtext: 'Click here to send the announcement as a push notification across all citizen mobile apps.',
          waitForInteraction: false,
        },
        {
          id: 'active-broadcasts-section',
          panel: 'broadcast',
          callout: 'Active Announcements List',
          subtext: 'All currently running announcements appear below the composer. You can check how long they have been active, see targeted areas, and click Stop once resolved.',
          waitForInteraction: false,
        },
      ]
    },
    {
      id: 'archive',
      title: 'Past Incident History & Reports',
      category: 'Records',
      icon: 'history',
      badgeColor: '#3880ff',
      description: 'How to look up past resolved emergencies, search records by date or barangay, and download official certified PDF reports.',
      steps: [
        {
          id: 'nav-btn-archive',
          callout: 'Step 1: Open Log Archive',
          subtext: 'Click the highlighted Log Archive button on the sidebar to view past records of all resolved emergencies.',
          waitForInteraction: true,
          interactionHint: 'Click Log Archive on the sidebar'
        },
        {
          id: 'archive-filters',
          panel: 'archive',
          callout: 'Search & Date Filters',
          subtext: 'Filter past emergency reports by custom date ranges, incident type, status, or barangay location.',
          waitForInteraction: false,
        },
        {
          id: 'exportArchivePdfBtn',
          panel: 'archive',
          callout: 'Download Official PDF',
          subtext: 'Click here to generate and download an official certified PDF summary report of all filtered incidents.',
          waitForInteraction: false,
        },
      ]
    },
    {
      id: 'account-management',
      title: 'Staff & Citizen Account Management',
      category: 'Admin Only',
      icon: 'users',
      badgeColor: '#bc6fff',
      adminOnly: true,
      description: 'How to create dispatcher staff accounts, verify citizen ID credentials, and manage disciplinary strikes for false alarms.',
      steps: [
        {
          id: 'nav-btn-dispatchers',
          callout: 'Step 1: Open Dispatchers',
          subtext: 'Click the highlighted Dispatchers button on the sidebar to manage all responder staff accounts.',
          waitForInteraction: true,
          interactionHint: 'Click Dispatchers on the sidebar'
        },
        {
          id: 'add-dispatcher-btn',
          panel: 'dispatchers',
          callout: 'Add New Dispatcher',
          subtext: 'Click here to create login credentials for newly appointed dispatchers and responder staff.',
          waitForInteraction: false,
        },
        {
          id: 'dispatcherSearch',
          panel: 'dispatchers',
          callout: 'Search Staff Roster',
          subtext: 'Search staff by name or assigned barangay, and check their current active duty status.',
          waitForInteraction: false,
        },
        {
          id: 'nav-btn-citizens',
          callout: 'Step 4: Citizen Directory',
          subtext: 'Click the highlighted Citizens button on the sidebar to inspect registered residents.',
          waitForInteraction: true,
          interactionHint: 'Click Citizens on the sidebar'
        },
        {
          id: 'citizenSearch',
          panel: 'citizens',
          callout: 'Citizen Search & ID Verification',
          subtext: 'Look up citizens to inspect submitted ID documents, phone number validity, and false alarm strike counts.',
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
