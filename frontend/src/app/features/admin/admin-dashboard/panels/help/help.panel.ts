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
          id: 'admin-map-toolbar',
          panel: 'active',
          callout: 'Barangay & Type Filters',
          subtext: 'Easily filter what you see on the map — choose specific barangays, or filter between Emergency SOS calls (Medical, Fire, Crime) and Public Hazards (Floods, Road blocks).',
          waitForInteraction: false,
        },
        {
          id: 'admin-queue-container',
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
      description: 'How to write disaster advisories, attach media files, schedule future announcements, and manage active and archived broadcasts.',
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
          callout: 'Message, Media & Drag-and-Drop',
          subtext: 'Enter the headline and advisory notice. You can drag and drop or attach up to 4 photos/videos for citizen guidance.',
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
        {
          id: 'scheduled-broadcasts-section',
          panel: 'broadcast',
          callout: 'Scheduled Announcements Queue',
          subtext: 'Announcements scheduled for later release appear here. The system will automatically publish them at the designated date and time.',
          waitForInteraction: false,
        },
        {
          id: 'archived-broadcasts-section',
          panel: 'broadcast',
          callout: 'Past & Archived History',
          subtext: 'Past completed announcements are archived here for municipal auditing and disaster post-incident reports.',
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
      title: 'Staff, ID Verification & Citizen Accounts',
      category: 'Admin Only',
      icon: 'users',
      badgeColor: '#bc6fff',
      adminOnly: true,
      description: 'How to create dispatcher staff accounts, review and approve citizen ID credentials, and manage disciplinary strikes for false alarms.',
      steps: [
        {
          id: 'nav-btn-dispatchers',
          callout: 'Step 1: Open Dispatchers & Teams',
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
          id: 'nav-btn-verifications',
          callout: 'Step 4: Open ID Verifications',
          subtext: 'Click ID Verifications on the sidebar to inspect pending resident ID submissions.',
          waitForInteraction: true,
          interactionHint: 'Click ID Verifications on the sidebar'
        },
        {
          id: 'verification-card-first',
          panel: 'verifications',
          callout: 'Inspect Submitted ID Proof',
          subtext: 'Inspect the resident’s uploaded government ID (front & back), selfie photo, and ID number details.',
          waitForInteraction: false,
        },
        {
          id: 'verify-actions-group',
          panel: 'verifications',
          callout: 'Approve or Deny Account',
          subtext: 'Click Approve to verify the citizen and activate full emergency SOS features, or Deny if invalid.',
          waitForInteraction: false,
        },
        {
          id: 'nav-btn-citizens',
          callout: 'Step 7: Citizen Directory',
          subtext: 'Click the highlighted Citizens button on the sidebar to inspect registered residents.',
          waitForInteraction: true,
          interactionHint: 'Click Citizens on the sidebar'
        },
        {
          id: 'citizenSearch',
          panel: 'citizens',
          callout: 'Citizen Search & Strike System',
          subtext: 'Look up citizens to inspect account details, verification status, and manage disciplinary strikes for false alarms.',
          waitForInteraction: false,
        },
      ]
    },
  ];

  get filteredProcedures(): ProcedureGuide[] {
    return this.procedures.filter(p => !p.adminOnly || this.isAdmin);
  }

  getStepCount(proc: ProcedureGuide): number {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      if (proc.id === 'incident-map') return 7;
      if (proc.id === 'account-management') return 11;
      if (proc.id === 'broadcast') return 8;
      if (proc.id === 'archive') return 3;
    }
    return proc.steps.length;
  }

  constructor(private tour: TourService) {}

  startWalkthrough(procedure: ProcedureGuide): void {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      this.tour.startCustomSteps(procedure.steps);
      return;
    }

    // ── Mobile-Specific Specialized Walkthrough for Incident Map ──
    if (procedure.id === 'incident-map') {
      const mobileMapSteps: TourStep[] = [
        {
          id: 'mobile-nav-back-btn',
          callout: 'Step 1: Return to Dashboard',
          subtext: 'Tap "< Menu" in the top left to exit Help and see the main dashboard.',
          waitForInteraction: true,
          interactionHint: 'Tap < Menu at top left',
        },
        {
          id: 'mobile-tab-active',
          callout: 'Step 2: Open Incident Map',
          subtext: 'Tap Incident Map on the bottom navigation bar to view the live dispatch map.',
          waitForInteraction: true,
          interactionHint: 'Tap Incident Map at the bottom',
        },
        {
          id: 'dispatch-map',
          panel: 'active',
          callout: 'Step 3: Live GPS Map & Pins',
          subtext: 'Red pins mark active emergency SOS calls from citizens. Yellow pins mark reported road hazards.',
          waitForInteraction: false,
        },
        {
          id: 'mobile-filter-btn',
          panel: 'active',
          callout: 'Step 4: Open Map Filters',
          subtext: 'Tap the Filter button to filter incoming alerts by type, date, or barangay.',
          waitForInteraction: true,
          interactionHint: 'Tap Filter at top left',
        },
        {
          id: 'mobile-filter-card',
          panel: 'active',
          callout: 'Step 5: Filter by Alert Type & Area',
          subtext: 'Toggle between Emergency SOS calls or Hazards, pick a date range, or select specific barangays.',
          waitForInteraction: false,
        },
        {
          id: 'mobile-filter-apply-btn',
          panel: 'active',
          callout: 'Step 6: Apply & View Map',
          subtext: 'Tap Apply & View Map to apply your filter selections and return to the live map.',
          waitForInteraction: true,
          interactionHint: 'Tap Apply & View Map',
        },
        {
          id: 'mobile-sheet-cards',
          panel: 'active',
          callout: 'Step 7: Incoming Alerts Queue',
          subtext: 'All incoming emergency calls appear in this list. Tapping an alert automatically centers the map on the citizen GPS pin.',
          waitForInteraction: false,
        },
      ];
      this.tour.startCustomSteps(mobileMapSteps);
      return;
    }

    // ── Mobile-Specific Specialized Walkthrough for Account Management ──
    if (procedure.id === 'account-management') {
      const mobileAccountSteps: TourStep[] = [
        {
          id: 'mobile-nav-back-btn',
          callout: 'Step 1: Return to Menu',
          subtext: 'Tap "< Menu" in the top left to return to the management menu.',
          waitForInteraction: true,
          interactionHint: 'Tap < Menu at top left',
        },
        {
          id: 'menu-item-dispatchers',
          callout: 'Step 2: Open Dispatchers & Teams',
          subtext: 'Tap "Dispatchers & Teams" to manage responder staff accounts and vehicles.',
          waitForInteraction: true,
          interactionHint: 'Tap Dispatchers & Teams',
        },
        {
          id: 'add-dispatcher-btn',
          panel: 'dispatchers',
          callout: 'Step 3: Add New Staff',
          subtext: 'Tap here to create login credentials for new dispatchers and responders.',
          waitForInteraction: false,
        },
        {
          id: 'dispatcherSearch',
          panel: 'dispatchers',
          callout: 'Step 4: Search Staff Roster',
          subtext: 'Search staff by name or role, and check active duty statuses.',
          waitForInteraction: false,
        },
        {
          id: 'mobile-nav-back-btn',
          panel: 'dispatchers',
          callout: 'Step 5: Return to Menu',
          subtext: 'Tap "< Menu" in the top left to return to the menu list.',
          waitForInteraction: true,
          interactionHint: 'Tap < Menu at top left',
        },
        {
          id: 'menu-item-verifications',
          callout: 'Step 6: Open ID Verifications',
          subtext: 'Tap "ID Verifications" to review pending resident identity applications.',
          waitForInteraction: true,
          interactionHint: 'Tap ID Verifications',
        },
        {
          id: 'verification-card-first',
          panel: 'verifications',
          callout: 'Step 7: Inspect Submitted IDs',
          subtext: 'Review the resident’s uploaded government ID, front/back photos, and selfie verification.',
          waitForInteraction: false,
        },
        {
          id: 'verify-actions-group',
          panel: 'verifications',
          callout: 'Step 8: Approve or Deny',
          subtext: 'Tap Approve to grant verified citizen status, or Deny if credentials do not match.',
          waitForInteraction: false,
        },
        {
          id: 'mobile-nav-back-btn',
          panel: 'verifications',
          callout: 'Step 9: Return to Menu',
          subtext: 'Tap "< Menu" in the top left to return to the menu list.',
          waitForInteraction: true,
          interactionHint: 'Tap < Menu at top left',
        },
        {
          id: 'menu-item-citizens',
          callout: 'Step 10: Open Citizen Directory',
          subtext: 'Tap "Citizen Directory" from the menu to inspect registered residents.',
          waitForInteraction: true,
          interactionHint: 'Tap Citizen Directory',
        },
        {
          id: 'citizenSearch',
          panel: 'citizens',
          callout: 'Step 11: Search & Verify Citizens',
          subtext: 'Look up residents to check verified ID credentials and false alarm strikes.',
          waitForInteraction: false,
        },
      ];
      this.tour.startCustomSteps(mobileAccountSteps);
      return;
    }

    // On mobile, inject intermediate navigation steps for all other procedures
    const mobileSteps = this.buildMobileSteps(procedure.steps);
    this.tour.startCustomSteps(mobileSteps);
  }

  /**
   * Transforms desktop-oriented steps into mobile-friendly sequences.
   */
  private buildMobileSteps(steps: TourStep[]): TourStep[] {
    const bottomNavFeatures = new Set(['active', 'broadcast', 'archive']);
    const navNameMap: Record<string, string> = {
      active:    'Incident Map',
      broadcast: 'Broadcast',
      archive:   'Log Archive',
    };
    const menuLabelMap: Record<string, string> = {
      verifications: 'ID Verifications',
      dispatchers:   'Dispatchers & Teams',
      citizens:      'Citizen Directory',
      analytics:     'Analytics & Trends',
      feedback:      'Citizen Feedback',
      settings:      'Settings',
      help:          'Help & User Guides',
    };

    const result: TourStep[] = [];
    let hasAddedBackStep = false;

    for (const step of steps) {
      const id = step.id;

      // Check if this is a sidebar navigation step (nav-btn-*)
      if (id.startsWith('nav-btn-')) {
        const feature = id.replace('nav-btn-', '');

        if (bottomNavFeatures.has(feature)) {
          if (!hasAddedBackStep) {
            result.push({
              id: 'mobile-nav-back-btn',
              callout: 'Step 1: Return to Dashboard',
              subtext: 'Tap "< Menu" in the top left to exit Help and see the main navigation tabs.',
              waitForInteraction: true,
              interactionHint: 'Tap < Menu at top left',
            });
            hasAddedBackStep = true;
          }

          result.push({
            ...step,
            id: `mobile-tab-${feature}`,
            callout: `Step 2: Open ${navNameMap[feature] || feature}`,
            subtext: `Tap ${navNameMap[feature] || feature} on the bottom navigation bar.`,
            interactionHint: `Tap ${navNameMap[feature] || feature} at the bottom`,
            waitForInteraction: true,
          });
        } else if (menuLabelMap[feature]) {
          if (!hasAddedBackStep) {
            result.push({
              id: 'mobile-nav-back-btn',
              callout: 'Step 1: Return to Menu',
              subtext: 'Tap "< Menu" in the top left to return to the management options.',
              waitForInteraction: true,
              interactionHint: 'Tap < Menu at top left',
            });
            hasAddedBackStep = true;
          }

          result.push({
            id: `menu-item-${feature}`,
            callout: `Select ${menuLabelMap[feature]}`,
            subtext: `Tap "${menuLabelMap[feature]}" from the menu list to open this panel.`,
            waitForInteraction: true,
            interactionHint: `Tap ${menuLabelMap[feature]}`,
          });
        } else {
          result.push(step);
        }
      } else {
        result.push(step);
      }
    }

    return result;
  }
}
