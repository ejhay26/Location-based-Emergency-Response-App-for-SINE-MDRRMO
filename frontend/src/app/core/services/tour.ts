import { Injectable, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';

export type TourChapter = 'all' | 'home' | 'emergency' | 'hazard' | 'status' | 'profile' | 'settings';

export interface TourStep {
  id: string;
  page: string;
  chapter: TourChapter;
  callout: string;
  subtext?: string;
  waitForInteraction: boolean;
  interactionHint?: string;
}

// ── Correct logical flow ──────────────────────────────────────────────────────
// Home intro → SOS button → Emergency report steps → back to Home → Hazard button
// → Hazard report steps → back to Home → Announcement → Status tab → Status page
// → Profile tab → Profile steps → Settings tab → Settings steps → Help tab → Finish
const STEPS: TourStep[] = [
  // ── HOME: intro ───────────────────────────────────────────────────────────
  {
    id: 'tour-sos-button', page: '/tabs/home', chapter: 'home',
    callout: 'This is your Emergency SOS button.',
    subtext: 'Use this when you need immediate help — fire, flood, medical emergency, or crime. Tap it to see how it works.',
    waitForInteraction: true, interactionHint: 'Tap to continue →'
  },
  // ── EMERGENCY REPORT ──────────────────────────────────────────────────────
  {
    id: 'tour-incident-grid', page: '/report?type=emergency&tour=1', chapter: 'emergency',
    callout: 'First, choose the type of emergency.',
    subtext: 'Tap the category that best matches your situation. This helps MDRRMO prepare the right response before arriving.',
    waitForInteraction: true, interactionHint: 'Tap a category →'
  },
  {
    id: 'tour-description-field', page: '/report?type=emergency&tour=1', chapter: 'emergency',
    callout: 'Add extra details here.',
    subtext: 'Describe what\'s happening — landmarks nearby, number of people, what happened. This field is optional but very helpful for responders.',
    waitForInteraction: false
  },
  {
    id: 'tour-media-buttons', page: '/report?type=emergency&tour=1', chapter: 'emergency',
    callout: 'Attach a photo or short video as proof.',
    subtext: 'Visual evidence helps MDRRMO assess the severity and prepare the right equipment before they arrive.',
    waitForInteraction: false
  },
  {
    id: 'tour-map-area', page: '/report?type=emergency&tour=1', chapter: 'emergency',
    callout: 'Drag the map to pin your exact location.',
    subtext: 'The crosshair marks where your report will be pinned. You can also tap "Use My Location" to jump to your GPS position.',
    waitForInteraction: false
  },
  {
    id: 'tour-submit-button', page: '/report?type=emergency&tour=1', chapter: 'emergency',
    callout: 'This button sends your SOS to MDRRMO.',
    subtext: 'In a real emergency this immediately alerts the dispatch team. We won\'t submit anything during this tutorial — tap Next to continue.',
    waitForInteraction: false
  },
  // ── HOME: hazard ──────────────────────────────────────────────────────────
  {
    id: 'tour-hazard-button', page: '/tabs/home', chapter: 'home',
    callout: 'This button is for reporting hazards.',
    subtext: 'Use this for dangers that need attention but aren\'t immediate emergencies — flooded roads, downed wires, fallen trees. Tap it to see how it works.',
    waitForInteraction: true, interactionHint: 'Tap to continue →'
  },
  // ── HAZARD REPORT ─────────────────────────────────────────────────────────
  {
    id: 'tour-hazard-grid', page: '/report?type=hazard&tour=1', chapter: 'hazard',
    callout: 'Choose the type of hazard you\'re reporting.',
    subtext: 'Select the category that best matches what you see. MDRRMO will assess and send the appropriate team.',
    waitForInteraction: true, interactionHint: 'Tap a category →'
  },
  {
    id: 'tour-submit-button', page: '/report?type=hazard&tour=1', chapter: 'hazard',
    callout: 'Same process — pin location, attach proof, then submit.',
    subtext: 'MDRRMO will be notified and will address the hazard as soon as possible.',
    waitForInteraction: false
  },
  // ── HOME: announcement ────────────────────────────────────────────────────
  {
    id: 'tour-announcement-pane', page: '/tabs/home', chapter: 'home',
    callout: 'This is the Announcements section.',
    subtext: 'When MDRRMO posts an official notice — like a flood warning or road closure — it appears here as a highlighted alert card.',
    waitForInteraction: false
  },
  // ── STATUS ────────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-status', page: '/tabs/home', chapter: 'home',
    callout: 'Tap the Status tab to check your submitted reports.',
    subtext: 'You can track whether your report is Pending, Dispatched, or Resolved in real time.',
    waitForInteraction: true, interactionHint: 'Tap the tab →'
  },
  {
    id: 'tour-status-page', page: '/tabs/status', chapter: 'status',
    callout: 'All your submitted reports appear here.',
    subtext: 'Each card shows the report type, your location, and its current status. Tap any card to see full details.',
    waitForInteraction: false
  },
  // ── PROFILE ───────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-profile', page: '/tabs/status', chapter: 'status',
    callout: 'Tap the Profile tab to manage your account.',
    subtext: '',
    waitForInteraction: true, interactionHint: 'Tap the tab →'
  },
  {
    id: 'tour-avatar-area', page: '/tabs/profile', chapter: 'profile',
    callout: 'Tap "Change Photo" to set your profile picture.',
    subtext: 'A clear photo helps MDRRMO personnel identify you during emergencies.',
    waitForInteraction: false
  },
  {
    id: 'tour-medical-section', page: '/tabs/profile', chapter: 'profile',
    callout: 'Fill in your medical information here.',
    subtext: 'Blood type, allergies, and conditions let responders prepare the right equipment and medications before they arrive. This can save critical time.',
    waitForInteraction: false
  },
  // ── SETTINGS ──────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-settings', page: '/tabs/profile', chapter: 'profile',
    callout: 'Tap the Settings tab to customize the app.',
    subtext: '',
    waitForInteraction: true, interactionHint: 'Tap the tab →'
  },
  {
    id: 'tour-dark-mode-setting', page: '/tabs/settings', chapter: 'settings',
    callout: 'Toggle dark mode here.',
    subtext: 'All your settings are saved automatically and synced across your devices whenever you log in.',
    waitForInteraction: false
  },
  // ── HELP ──────────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-help', page: '/tabs/settings', chapter: 'settings',
    callout: 'The Help tab is your guide whenever you need it.',
    subtext: 'Find FAQs, replay any chapter of this tutorial, or send feedback to the development team.',
    waitForInteraction: true, interactionHint: 'Tap the tab →'
  },
  {
    id: 'tour-replay-section', page: '/tabs/help', chapter: 'all',
    callout: "You're all set! 🎉",
    subtext: "You now know how to use the MDRRMO Emergency App. You can replay any chapter of this guide here anytime.",
    waitForInteraction: false
  },
];

const CHAPTER_START: Record<TourChapter, number> = {
  all: 0, home: 0, emergency: 1, hazard: 7, status: 10, profile: 13, settings: 15,
};

@Injectable({ providedIn: 'root' })
export class TourService {

  isActive   = signal(false);
  stepIndex  = signal(0);
  targetId   = signal('');
  isTourMode = computed(() => this.isActive());

  // True while a modal (photo cropper, video trimmer) is open.
  // The overlay hides itself when this is true so it doesn't cover modals.
  modalOpen  = signal(false);

  private navigating = false;

  constructor(private router: Router, private alertCtrl: AlertController) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        if (!this.isActive()) return;
        if (this.navigating) { this.navigating = false; return; }
        const actual = (e.urlAfterRedirects as string).split('?')[0];
        const validPages = new Set(STEPS.map(s => s.page.split('?')[0]));
        if (!validPages.has(actual)) this.cancelSilent();
      });
  }

  get steps()       { return STEPS; }
  get currentStep() { return STEPS[this.stepIndex()]; }
  get totalSteps()  { return STEPS.length; }
  get isLastStep()  { return this.stepIndex() === STEPS.length - 1; }

  async promptStart() {
    const alert = await this.alertCtrl.create({
      header: '👋 Welcome!',
      message: "Would you like a quick walkthrough of the app? It takes about a minute and shows you everything you need to know.",
      buttons: [
        { text: 'Skip for now', role: 'cancel',  handler: () => this.markSeen() },
        { text: 'Yes, show me!', role: 'confirm', handler: () => this.start('all') }
      ]
    });
    await alert.present();
  }

  start(chapter: TourChapter = 'all') {
    this.stepIndex.set(CHAPTER_START[chapter] ?? 0);
    this.isActive.set(true);
    this.applyStep();
  }

  private applyStep() {
    const step = this.currentStep;
    if (!step) { this.finish(); return; }
    this.targetId.set(step.id);
    const target  = step.page.split('?')[0];
    const current = this.router.url.split('?')[0];
    if (current !== target) {
      this.navigating = true;
      this.router.navigateByUrl(step.page);
    }
  }

  next() {
    if (this.isLastStep) { this.finish(); return; }
    this.stepIndex.update(i => i + 1);
    this.applyStep();
  }

  // User explicitly exited mid-tour — treat this the same as finishing: don't nag them again.
  cancel()       { this.isActive.set(false); this.targetId.set(''); this.stepIndex.set(0); this.markSeen(); }
  // Tour was interrupted by unrelated navigation (not a deliberate exit) — don't mark as seen,
  // so it can still be resumed/prompted normally later.
  cancelSilent() { this.isActive.set(false); this.targetId.set(''); this.stepIndex.set(0); }

  finish() {
    this.isActive.set(false);
    this.targetId.set('');
    this.stepIndex.set(0);
    this.markSeen();
    this.navigating = true;
    this.router.navigate(['/tabs/home']);
  }

  markSeen()    { localStorage.setItem('tourSeen', 'true'); }
  hasSeenTour() { return localStorage.getItem('tourSeen') === 'true'; }

  onInteraction() {
    if (!this.isActive()) return;
    if (this.currentStep?.waitForInteraction) {
      setTimeout(() => this.next(), 200);
    }
  }
}
