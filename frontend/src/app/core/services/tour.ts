import { Injectable, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';

export type TourChapter = 'all' | 'home' | 'emergency' | 'hazard' | 'history' | 'profile' | 'settings';

export interface TourStep {
  id: string;
  page?: string;
  panel?: string;
  chapter?: TourChapter;
  chapters?: TourChapter[];
  callout: string;
  subtext?: string;
  waitForInteraction?: boolean;
  interactionHint?: string;
}

// ── Correct logical flow ──────────────────────────────────────────────────────
// Home intro → SOS button → Emergency report steps → back to Home → Hazard button
// → Hazard report steps → back to Home → Announcement → History tab → History page
// → Profile tab → Profile steps → Settings tab → Settings steps → Help tab → Finish
const STEPS: TourStep[] = [
  // ── HOME / SOS / HAZARD: Nav step ──────────────────────────────────────────
  {
    id: 'tour-tab-home', page: '/tabs/help', chapters: ['home', 'emergency', 'hazard'],
    callout: 'First, tap the Home tab at the bottom.',
    subtext: 'This opens your primary emergency response dashboard.',
    waitForInteraction: true, interactionHint: 'Tap the Home tab'
  },
  // ── HOME: intro ───────────────────────────────────────────────────────────
  {
    id: 'tour-sos-button', page: '/tabs/home', chapters: ['all', 'home'],
    callout: 'This is your Emergency SOS button.',
    subtext: 'Use this when you need immediate help — fire, flood, medical emergency, or crime. Tap it to see how it works.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted button'
  },
  // ── EMERGENCY REPORT ──────────────────────────────────────────────────────
  {
    id: 'tour-sos-button', page: '/tabs/home', chapters: ['emergency'],
    callout: 'Tap the Emergency SOS button to start.',
    subtext: 'Pressing this opens the emergency submission form.',
    waitForInteraction: true, interactionHint: 'Tap the SOS button'
  },
  {
    id: 'tour-incident-grid', page: '/report?type=emergency&tour=1', chapters: ['all', 'emergency'],
    callout: 'First, choose the type of emergency.',
    subtext: 'Tap the category that best matches your situation. This helps MDRRMO prepare the right response before arriving.',
    waitForInteraction: true, interactionHint: 'Tap a category'
  },
  {
    id: 'tour-description-field', page: '/report?type=emergency&tour=1', chapters: ['all', 'emergency'],
    callout: 'Add extra details here.',
    subtext: 'Describe what\'s happening — landmarks nearby, number of people, what happened. This field is optional but very helpful for responders.',
    waitForInteraction: false
  },
  {
    id: 'tour-media-buttons', page: '/report?type=emergency&tour=1', chapters: ['all', 'emergency'],
    callout: 'Attach a photo or short video as proof.',
    subtext: 'Visual evidence helps MDRRMO assess the severity and prepare the right equipment before they arrive.',
    waitForInteraction: false
  },
  {
    id: 'tour-map-area', page: '/report?type=emergency&tour=1', chapters: ['all', 'emergency'],
    callout: 'Drag the map to pin your exact location.',
    subtext: 'The location pin marks where your report will be submitted. You can also tap "Use My Location" to jump to your GPS position.',
    waitForInteraction: false
  },
  {
    id: 'tour-submit-button', page: '/report?type=emergency&tour=1', chapters: ['all', 'emergency'],
    callout: 'This button sends your SOS to MDRRMO.',
    subtext: 'In a real emergency this immediately alerts the dispatch team. We won\'t submit anything during this tutorial — tap Next to continue.',
    waitForInteraction: false
  },
  // ── HOME: hazard ──────────────────────────────────────────────────────────
  {
    id: 'tour-hazard-button', page: '/tabs/home', chapters: ['all', 'home', 'hazard'],
    callout: 'This button is for reporting hazards.',
    subtext: 'Use this for dangers that need attention but aren\'t immediate emergencies — flooded roads, downed wires, fallen trees. Tap it to see how it works.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted button'
  },
  // ── HAZARD REPORT ─────────────────────────────────────────────────────────
  {
    id: 'tour-hazard-grid', page: '/report?type=hazard&tour=1', chapters: ['all', 'hazard'],
    callout: 'Choose the type of hazard you\'re reporting.',
    subtext: 'Select the category that best matches what you see. MDRRMO will assess and send the appropriate team.',
    waitForInteraction: true, interactionHint: 'Tap a category'
  },
  {
    id: 'tour-submit-button', page: '/report?type=hazard&tour=1', chapters: ['all', 'hazard'],
    callout: 'Same process — pin location, attach proof, then submit.',
    subtext: 'MDRRMO will be notified and will address the hazard as soon as possible.',
    waitForInteraction: false
  },
  // ── HOME: announcement ────────────────────────────────────────────────────
  {
    id: 'tour-announcement-pane', page: '/tabs/home', chapters: ['all', 'home'],
    callout: 'This is the Announcements section.',
    subtext: 'When MDRRMO posts an official notice — like a flood warning or road closure — it appears here as a highlighted alert card.',
    waitForInteraction: false
  },
  // ── HISTORY ───────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-history', page: '/tabs/home', chapters: ['all', 'history'],
    callout: 'Tap the History tab to check your submitted reports.',
    subtext: 'You can track whether your report is Pending, Dispatched, or Resolved in real time.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted tab'
  },
  {
    id: 'tour-history-page', page: '/tabs/history', chapters: ['all', 'history'],
    callout: 'All your submitted reports appear here.',
    subtext: 'Filter by date or status to find a specific report. Each card shows the type, time, and current status — tap any card to see full details.',
    waitForInteraction: false
  },
  // ── PROFILE ───────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-profile', page: '/tabs/history', chapters: ['all', 'profile'],
    callout: 'Tap the Profile tab to manage your account.',
    subtext: 'Manage your personal details, profile picture, and life-saving medical data.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted tab'
  },
  {
    id: 'tour-avatar-area', page: '/tabs/profile', chapters: ['all', 'profile'],
    callout: 'Tap "Change Photo" to set your profile picture.',
    subtext: 'A clear photo helps MDRRMO personnel identify you during emergencies.',
    waitForInteraction: false
  },
  {
    id: 'tour-medical-section', page: '/tabs/profile', chapters: ['all', 'profile'],
    callout: 'Fill in your medical information here.',
    subtext: 'Blood type, allergies, and conditions let responders prepare the right equipment and medications before they arrive. This can save critical time.',
    waitForInteraction: false
  },
  // ── SETTINGS ──────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-settings', page: '/tabs/profile', chapters: ['all', 'settings'],
    callout: 'Tap the Settings tab to customize the app.',
    subtext: 'Customize your theme, notification sounds, and safety preferences.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted tab'
  },
  {
    id: 'tour-settings-page', page: '/tabs/settings', chapters: ['all', 'settings'],
    callout: 'Choose your app preferences here.',
    subtext: 'Dark mode, map style, location precision, notifications, reporting defaults, and even a Home Screen Widget — all saved automatically and synced across your devices.',
    waitForInteraction: false
  },
  // ── HELP ──────────────────────────────────────────────────────────────────
  {
    id: 'tour-tab-help', page: '/tabs/settings', chapters: ['all'],
    callout: 'The Help tab is your guide whenever you need it.',
    subtext: 'Find FAQs, replay any chapter of this tutorial, or send feedback to the development team.',
    waitForInteraction: true, interactionHint: 'Tap the highlighted tab'
  },
  {
    id: 'tour-help-contacts', page: '/tabs/help', chapters: ['all'],
    callout: "MDRRMO's hotlines are always one tap away.",
    subtext: 'Call either hotline directly from here, or check the office address and 24/7 operating hours.',
    waitForInteraction: false
  },
  {
    id: 'tour-help-tutorial', page: '/tabs/help', chapters: ['all'],
    callout: 'You can replay this tutorial anytime.',
    subtext: 'Tap "Start Complete Tour" for the full walkthrough, or pick any chapter card below to jump straight to that topic instead.',
    waitForInteraction: false
  },
  {
    id: 'tour-help-faq', page: '/tabs/help', chapters: ['all'],
    callout: 'Check the FAQs for quick answers.',
    subtext: 'Tap any question to expand it — covers reports, location accuracy, medical info, and more.',
    waitForInteraction: false
  },
  {
    id: 'tour-help-feedback', page: '/tabs/help', chapters: ['all'],
    callout: "You're all set! 🎉",
    subtext: 'You now know how to use the MDRRMO Emergency App. Found a bug or have an idea? Send it to us right here.',
    waitForInteraction: false
  },
];

const CHAPTER_START: Record<TourChapter, number> = {
  all: 0, home: 0, emergency: 1, hazard: 7, history: 10, profile: 13, settings: 15,
};

@Injectable({ providedIn: 'root' })
export class TourService {

  isActive   = signal(false);
  stepIndex  = signal(0);
  targetId   = signal('');
  isTourMode = computed(() => this.isActive());

  // True while a modal (photo cropper, video trimmer) is open.
  // True while a modal (photo cropper, video trimmer) is open.
  // The overlay hides itself when this is true so it doesn't cover modals.
  modalOpen  = signal(false);

  // Emits panel names ('active', 'broadcast', etc.) when an admin step specifies a dashboard panel
  adminPanelSwitch = signal<string | null>(null);

  private currentChapter: TourChapter = 'all';
  private filteredSteps: TourStep[] = STEPS;
  private navigating = false;
  private returnUrl = '/tabs/home';
  private onFinishCustom?: () => void;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        if (!this.isActive()) return;
        if (this.onFinishCustom) return; // Don't auto-cancel custom admin dashboard tours
        if (this.navigating) { this.navigating = false; return; }
        const actual = (e.urlAfterRedirects as string).split('?')[0];
        const validPages = new Set(this.steps.filter(s => !!s.page).map(s => s.page!.split('?')[0]));
        if (!validPages.has(actual)) this.cancelSilent();
      });
  }

  private async dismissAnyModal() {
    try {
      const top = await this.modalCtrl.getTop();
      if (top) await this.modalCtrl.dismiss();
    } catch {}
  }

  get steps()       { return this.filteredSteps; }
  get currentStep() { return this.filteredSteps[this.stepIndex()]; }
  get totalSteps()  { return this.filteredSteps.length; }
  get isLastStep()  { return this.stepIndex() === this.filteredSteps.length - 1; }

  async promptStart() {
    const alert = await this.alertCtrl.create({
      header: '👋 Welcome!',
      message: "Would you like a quick walkthrough of the app? It takes about a minute and shows you everything you need to know.",
      buttons: [
        { text: 'Skip for now', role: 'cancel',  handler: () => this.markSeen() },
        { text: 'Yes, show me!', role: 'confirm', handler: () => this.start('all', '/tabs/home') }
      ]
    });
    await alert.present();
  }

  start(chapter: TourChapter = 'all', returnUrl?: string) {
    this.onFinishCustom = undefined;
    this.currentChapter = chapter;
    this.returnUrl = returnUrl || (chapter === 'all' ? '/tabs/home' : '/tabs/help');
    if (chapter === 'all') {
      this.filteredSteps = STEPS.filter(s => s.chapters ? s.chapters.includes('all') : s.chapter === 'all');
      this.stepIndex.set(0);
    } else {
      this.filteredSteps = STEPS.filter(s => s.chapters ? s.chapters.includes(chapter) : s.chapter === chapter);
      this.stepIndex.set(0);
    }
    this.isActive.set(true);
    this.applyStep();
  }

  startCustomSteps(steps: TourStep[], onFinish?: () => void) {
    this.onFinishCustom = onFinish;
    this.filteredSteps = steps;
    this.stepIndex.set(0);
    this.isActive.set(true);
    this.applyStep();
  }

  private applyStep() {
    const step = this.currentStep;
    if (!step) { this.finish(); return; }
    this.targetId.set(step.id);
    if (step.panel) {
      this.adminPanelSwitch.set(step.panel);
    }
    if (step.page) {
      const target  = step.page.split('?')[0];
      const current = this.router.url.split('?')[0];
      if (current !== target) {
        this.navigating = true;
        this.router.navigateByUrl(step.page);
      }
    }
  }

  next() {
    if (this.isLastStep) { this.finish(); return; }
    this.stepIndex.update(i => i + 1);
    this.applyStep();
  }

  // User explicitly exited mid-tour — treat this the same as finishing: don't nag them again.
  cancel() {
    const customCb = this.onFinishCustom;
    this.onFinishCustom = undefined;
    this.isActive.set(false);
    this.targetId.set('');
    this.stepIndex.set(0);
    this.filteredSteps = STEPS;
    this.dismissAnyModal();
    if (customCb) {
      customCb();
    } else {
      this.markSeen();
      this.navigating = true;
      this.router.navigate([this.returnUrl]);
    }
  }

  // Tour was interrupted by unrelated navigation (not a deliberate exit) — don't mark as seen,
  // so it can still be resumed/prompted normally later.
  cancelSilent() {
    this.onFinishCustom = undefined;
    this.isActive.set(false);
    this.targetId.set('');
    this.stepIndex.set(0);
    this.filteredSteps = STEPS;
    this.dismissAnyModal();
  }

  finish() {
    const customCb = this.onFinishCustom;
    this.onFinishCustom = undefined;
    this.isActive.set(false);
    this.targetId.set('');
    this.stepIndex.set(0);
    this.filteredSteps = STEPS;
    this.dismissAnyModal();
    if (customCb) {
      customCb();
    } else {
      this.markSeen();
      this.navigating = true;
      this.router.navigate([this.returnUrl]);
    }
  }

  markSeen()    { localStorage.setItem('tourSeen', 'true'); }
  hasSeenTour() { return localStorage.getItem('tourSeen') === 'true'; }

  /**
   * Called by TourOverlayComponent when a step's target element can't be
   * found on the page for several seconds straight (bad/stale id, a
   * component that changed since this step was written, page not settled).
   * Without this, the overlay just renders nothing forever — the app stays
   * usable, but the tour itself silently disappears with no obvious way to
   * tell what happened. Skipping forward turns that into "the tour
   * continues, minus one broken step" instead.
   */
  skipMissingStep() {
    if (!this.isActive()) return;
    this.next();
  }

  onInteraction() {
    if (!this.isActive()) return;
    if (this.currentStep?.waitForInteraction) {
      setTimeout(() => this.next(), 200);
    }
  }
}
