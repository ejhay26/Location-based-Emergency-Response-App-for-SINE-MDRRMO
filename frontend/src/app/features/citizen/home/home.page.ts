import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonToast, ModalController } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { BroadcastRefreshService } from '../../../core/services/broadcast-refresh';
import { WidgetPinService } from '../../../core/services/widget-pin';
import { DialogService } from '../../../core/services/dialog.service';
import { PressFeedbackDirective } from '../../../shared/directives/press-feedback.directive';
import { ImpactFeedbackDirective } from '../../../shared/directives/impact-feedback.directive';
import { ListEnterDirective } from '../../../shared/directives/list-enter.directive';
import { parseServerDate } from '../../../shared/pipes/utc-date.pipe';
import { reportModalEnter, reportModalLeave } from '../../../core/animations/report-modal-transition';
import { ReportPage } from '../report/report.page';

const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Stage 3a — Home Screen Widget banner. Shown once to accounts that
 * already existed before this feature shipped (new accounts get the
 * account-setup slide instead, and never see this banner — see
 * account-setup.page.ts). Dismissing it (either "Add" or the X) sets this
 * flag permanently; the Settings page item stays available forever as the
 * evergreen way back in, so nothing is lost by dismissing.
 */
const WIDGET_PROMPT_DISMISSED_KEY = 'widget_prompt_dismissed';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonToast,
    PressFeedbackDirective, ImpactFeedbackDirective, ListEnterDirective,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  userFirstName = '';
  activeBroadcasts: any[] = [];

  showWidgetBanner = false;
  widgetToastOpen = false;
  widgetToastMessage = '';

  private pollSub?: Subscription;
  private pushRefreshSub?: Subscription;

  constructor(
    private api: ApiService,
    public tour: TourService,
    private broadcastRefresh: BroadcastRefreshService,
    private modalCtrl: ModalController,
    private widgetPin: WidgetPinService,
    private dialog: DialogService,
  ) {}

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) this.userFirstName = JSON.parse(userStr).first_name || '';

    // Paint instantly from the cache (if this isn't the first time HomePage
    // has been created this session — see BroadcastRefreshService's doc
    // comment) instead of starting from an empty array and visibly popping
    // the cards back in once the fetch resolves.
    if (this.broadcastRefresh.lastBroadcasts) {
      this.activeBroadcasts = this.broadcastRefresh.lastBroadcasts;
    }
    this.fetchBroadcasts();

    // Keep the announcement panel live without requiring the user to leave
    // and re-enter the tab: poll on an interval, plus refetch instantly
    // whenever a broadcast push notification arrives in the foreground.
    this.pollSub = interval(REFRESH_INTERVAL_MS).subscribe(() => this.fetchBroadcasts());
    this.pushRefreshSub = this.broadcastRefresh.onRefresh.subscribe(() => this.fetchBroadcasts());

    this.widgetPin.isAvailable().then(available => {
      this.showWidgetBanner = available && !localStorage.getItem(WIDGET_PROMPT_DISMISSED_KEY);
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.pushRefreshSub?.unsubscribe();
  }

  fetchBroadcasts() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => {
        this.activeBroadcasts = Array.isArray(res) ? res : (res?.message ? [res] : []);
        this.broadcastRefresh.lastBroadcasts = this.activeBroadcasts;
      },
      error: () => {}
    });
  }

  /**
   * Without this, every 60s poll re-assigns `activeBroadcasts` to a brand
   * new array of freshly-parsed JSON objects — different references even
   * when the underlying data hasn't changed. Angular's default *ngFor diffs
   * by object identity, so with no trackBy it would read that as "every
   * item removed, every item re-added", destroy and recreate every card,
   * and (as a direct side effect) re-trigger appAnnouncementEnter's
   * ngOnInit on all of them. Tracking by the real DB primary key instead
   * lets Angular recognize "same broadcast, new object" and just patch the
   * existing DOM node's bindings in place — no destroy, no replay.
   */
  trackByBroadcastId(_index: number, b: any): number {
    return b.broadcast_id;
  }

  timeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  /** X button — a real decision to skip, not just backing out of the confirm dialog, so this permanently hides the banner and points them to Settings. */
  dismissWidgetBanner() {
    localStorage.setItem(WIDGET_PROMPT_DISMISSED_KEY, '1');
    this.showWidgetBanner = false;
    this.widgetToastMessage = 'No problem — you can add it anytime from Settings > Home Screen Widget.';
    this.widgetToastOpen = true;
  }

  async addWidgetFromBanner() {
    const confirmed = await this.dialog.confirm({
      title: 'Add Report Widget to Home Screen',
      message: 'In an emergency, every second counts. This puts a "Report Emergency" button right on your home screen, so you can start a report the moment something happens — no unlocking through the app, no digging for the right screen. Tap Add, then confirm the placement prompt Android shows you.',
      icon: 'apps-outline',
      iconColor: 'primary',
      confirmLabel: 'Add Widget',
      confirmColor: 'primary',
    });
    // Cancelling the confirm dialog is just backing out, not a decision to
    // skip — leave the banner up so they can revisit it this session.
    if (!confirmed) return;

    const requested = await this.widgetPin.requestPin();
    localStorage.setItem(WIDGET_PROMPT_DISMISSED_KEY, '1');
    this.showWidgetBanner = false;
    this.widgetToastMessage = requested
      ? 'Confirm in the prompt that just appeared to finish adding the widget.'
      : "Couldn't open the widget prompt on this device. You can try again anytime from Settings.";
    this.widgetToastOpen = true;
  }

  /**
   * Report is presented as a custom-styled ion-modal (see .report-modal in
   * global.scss + report-modal-transition.ts) rather than a routed page.
   * This is what actually keeps HomePage's own component instance alive
   * underneath instead of being destroyed/recreated on the way there and
   * back — the broadcast cache alone only masked the symptom (a data
   * flash), not the cause (entrance animations replaying every return
   * trip). Deliberately NOT using Ionic's default modal presentation
   * (`presentingElement`, the iOS card-shrink effect, the sheet handle) —
   * fully custom instead, per explicit direction to avoid Ionic's default
   * modal look entirely.
   */
  private async openReport(type: 'emergency' | 'hazard') {
    this.tour.onInteraction();
    if (this.tour.isActive()) return;
    const modal = await this.modalCtrl.create({
      component: ReportPage,
      componentProps: { reportType: type, presentedAsModal: true },
      cssClass: 'report-modal',
      backdropDismiss: false,
      enterAnimation: reportModalEnter,
      leaveAnimation: reportModalLeave,
    });
    await modal.present();
  }

  goToSos() { this.openReport('emergency'); }

  goToHazard() { this.openReport('hazard'); }
}
