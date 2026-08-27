import { Component } from '@angular/core';
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
  duration: string;
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

  readonly procedures: ProcedureGuide[] = [
    {
      id: 'dispatch',
      title: 'Emergency SOS Incident Triage (CAD)',
      category: 'Operations',
      icon: 'siren',
      badgeColor: '#eb445a',
      description: 'Standard procedure for receiving live citizen SOS calls, assessing medical & triage urgency, locating on map, and dispatching rescue teams.',
      duration: '1 min',
      steps: [
        {
          id: '#cad-map-container',
          panel: 'active',
          callout: 'Real-Time Incident Map',
          subtext: 'Incoming emergency SOS beacons appear with live GPS coordinates, accuracy radius, and citizen details.',
        },
        {
          id: '#cad-queue-container',
          panel: 'active',
          callout: 'Incident Queue & Triage',
          subtext: 'Review reported incidents ranked by urgency. Click any incident card to view citizen medical info, photo evidence, and assigned responders.',
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
      duration: '1 min',
      steps: [
        {
          id: '#broadcast-composer',
          panel: 'broadcast',
          callout: 'Broadcast Message Composer',
          subtext: 'Enter the official emergency advisory, evacuation order, or weather update. You can attach up to 4 photos or videos.',
        },
        {
          id: '#broadcast-barangay-selector',
          panel: 'broadcast',
          callout: 'Targeting Barangays',
          subtext: 'Keep on "All Barangays" for town-wide alerts, or tap multiple individual barangays to target specific affected communities.',
        },
        {
          id: '#broadcast-delivery-mode',
          panel: 'broadcast',
          callout: 'Immediate vs. Scheduled Release',
          subtext: 'Choose "Post Immediately" for critical warnings, or "Schedule for Later" with the date/time picker to pre-program advisories.',
        },
      ]
    },
    {
      id: 'hazards',
      title: 'Community Hazard Verification & Clearing',
      category: 'Road & Safety',
      icon: 'alert-triangle',
      badgeColor: '#2dd36f',
      description: 'Procedure for verifying citizen-reported flooded streets, fallen trees, and downed electrical wires, and updating hazard status when cleared.',
      duration: '1 min',
      steps: [
        {
          id: '#cad-map-container',
          panel: 'hazards',
          callout: 'Hazard Map Plotter',
          subtext: 'All citizen-submitted hazard reports are plotted as orange warning pins with exact GPS coordinates.',
        },
        {
          id: '#cad-queue-container',
          panel: 'hazards',
          callout: 'Hazard Verification Queue',
          subtext: 'Inspect citizen photo evidence, contact reporting party if needed, and mark the hazard as Resolved when clearing teams finish.',
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
      duration: '45 sec',
      steps: [
        {
          id: '#archive-filters',
          panel: 'archive',
          callout: 'Log Search & Filters',
          subtext: 'Filter past emergency reports by date range, status, incident type, or barangay jurisdiction.',
        },
        {
          id: '#exportArchivePdfBtn',
          panel: 'archive',
          callout: 'Export Certified Reports',
          subtext: 'Export incident logs to official PDF reports for situation briefings and post-disaster municipal audits.',
        },
      ]
    },
  ];

  constructor(private tour: TourService) {}

  startWalkthrough(procedure: ProcedureGuide): void {
    this.tour.startCustomSteps(procedure.steps);
  }
}
