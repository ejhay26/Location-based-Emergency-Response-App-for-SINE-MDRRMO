import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService, TourChapter } from '../../../core/services/tour';
import { RevealAnimateDirective } from '../../../shared/directives/reveal-animate.directive';

import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

interface FaqItem { q: string; a: string; open: boolean; }
interface TourChapterCard { chapter: TourChapter; icon: string; color: string; title: string; description: string; }

@Component({
  selector: 'app-help',
  templateUrl: './help.page.html',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, RevealAnimateDirective, AppIconComponent],
})
export class HelpPage implements OnInit {
  feedback = { message: '', category: 'general' };
  isSubmitting = false;

  chapters: TourChapterCard[] = [
    { chapter: 'home',      icon: 'home',          color: '#ff3b30', title: 'Home Screen',    description: 'Learn about the SOS button, hazard reporting, and broadcast alerts.' },
    { chapter: 'emergency', icon: 'alert',         color: '#ff453a', title: 'Emergency SOS',  description: 'Walk through submitting an emergency report step by step.' },
    { chapter: 'hazard',    icon: 'hazard',        color: '#ff9500', title: 'Hazard Report',  description: 'Learn how to report flooded roads, downed wires, and other hazards.' },
    { chapter: 'history',   icon: 'history',       color: '#007aff', title: 'History',        description: 'Understand how to track the status of your submitted reports.' },
    { chapter: 'profile',   icon: 'user',          color: '#34c759', title: 'My Profile',     description: 'Set your profile photo and fill in medical information for responders.' },
    { chapter: 'settings',  icon: 'settings',      color: '#8e8e93', title: 'Settings',       description: 'Customize dark mode, animations, location, and notifications.' },
  ];

  faqs: FaqItem[] = [
    { q: 'What happens after I press the SOS button?',         a: 'Your report — including your pinned location, emergency type, and any attached photos or videos — is sent directly to the MDRRMO dispatch team. They will assess the situation and dispatch the appropriate response team as quickly as possible.', open: false },
    { q: 'Will my exact location be shared?',                  a: 'Only the location you pin on the map is shared — not a continuous GPS feed. You can also manually drag the map to place the location pin if you are reporting on behalf of someone else or if your GPS is inaccurate.', open: false },
    { q: 'Can I cancel a report after submitting it?',         a: 'Yes. Go to the History tab, find your report, and tap "Cancel Request" — but only while it still shows as Pending. Once MDRRMO has dispatched a team, the report can no longer be cancelled through the app.', open: false },
    { q: 'Why do I need to attach a photo or video?',          a: 'Visual proof helps the dispatch team verify the situation before sending resources and helps them prepare the right equipment. It also protects you — it confirms your report is genuine and helps MDRRMO respond more precisely.', open: false },
    { q: 'What if my location is wrong on the map?',           a: 'Tap "Use My Location" to jump the map to your current GPS position, or drag the map manually until the location pin is over the correct spot. The latitude and longitude fields update in real time as you move the map.', open: false },
    { q: 'Why is the app asking for my medical information?',  a: 'Your blood type, allergies, and medical conditions are shared with responders when they are dispatched to you. This lets paramedics and first responders prepare the correct equipment and medications before they arrive.', open: false },
    { q: 'What is a Hazard Report vs an Emergency SOS?',       a: 'An Emergency SOS is for active, immediate threats requiring urgent response — fire, flood, medical emergency, crime in progress. A Hazard Report is for ongoing dangers that need attention but are not immediate emergencies.', open: false },
    { q: 'Will I get a notification when MDRRMO responds?',    a: 'Yes, if you have Emergency Dispatch Alerts enabled in Settings. You will receive a push notification when the dispatch team acknowledges and responds to your report.', open: false },
    { q: 'What do the report statuses mean?',                  a: 'Pending means your report is waiting for review. Dispatched means a response team is on the way. Resolved means the situation has been addressed and the report is closed.', open: false },
    { q: 'Can I use the app without an internet connection?',  a: 'No — the app requires an active internet connection to submit reports, load the map, and sync your settings. In the meantime, call the MDRRMO office directly using the emergency contact below.', open: false },
    { q: 'Is my personal information safe?',                   a: 'Your data is stored securely on the MDRRMO server and is only accessible to authorized MDRRMO personnel. Medical information is only surfaced to dispatchers when an emergency is reported.', open: false },
    { q: 'How do I update my password?',                       a: 'Go to the Profile tab, scroll down to the Password Security section, and tap "Change Password". You will need to verify your identity via a one-time code sent to your email or phone before setting a new password.', open: false },
  ];

  constructor(
    private api: ApiService,
    public tour: TourService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {}
  toggleFaq(item: FaqItem) {
    item.open = !item.open;
  }
  startChapter(chapter: TourChapterCard) { this.tour.start(chapter.chapter, '/tabs/help'); }
  startFullTour() { this.tour.start('all', '/tabs/home'); }

  async submitFeedback() {
    if (!this.feedback.message.trim() || this.feedback.message.trim().length < 10) {
      this.showToast('Please write at least 10 characters.', 'warning'); return;
    }
    const userStr = localStorage.getItem('user');
    if (!userStr) { this.showToast('You must be logged in to send feedback.', 'danger'); return; }
    const user = JSON.parse(userStr);
    this.isSubmitting = true;
    this.api.submitFeedback({ user_id: user.user_id, message: this.feedback.message.trim(), category: this.feedback.category }).subscribe({
      next: () => { this.isSubmitting = false; this.feedback = { message: '', category: 'general' }; this.showToast('Thank you for your feedback!', 'success'); },
      error: () => { this.isSubmitting = false; this.showToast('Failed to send. Please try again.', 'danger'); }
    });
  }

  async showToast(msg: string, color = 'success') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3500, color, position: 'bottom' });
    await t.present();
  }
}
