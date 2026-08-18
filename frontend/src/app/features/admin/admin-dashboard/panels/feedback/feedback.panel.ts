import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';

/**
 * FeedbackPanel — lists citizen-submitted feedback with export/clear actions.
 * Read-only list view; no media, no forms. Mirrors the old monolith's
 * "feedback" viewMode 1:1.
 */
@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, UtcDatePipe, ListEnterDirective],
  templateUrl: './feedback.panel.html',
})
export class FeedbackPanel implements OnInit {

  feedbackList: any[] = [];

  private readonly categoryLabels: Record<string, string> = {
    general: 'General', bug: '🐛 Bug', suggestion: '💡 Suggestion', other: 'Other'
  };
  private readonly categoryColors: Record<string, string> = {
    general: '#3880ff', bug: '#eb445a', suggestion: '#2dd36f', other: '#92949c'
  };

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.loadFeedback();
  }

  loadFeedback() {
    this.api.getFeedback().subscribe({
      next: (res: any) => { this.feedbackList = res; },
      error: () => this.ui.showToast('Failed to load feedback.', 'danger')
    });
  }

  clearAllFeedback() {
    this.ui.showConfirm({
      title: 'Clear All Feedback',
      message: 'Permanently delete all feedback? This cannot be undone.',
      icon: 'fa-solid fa-trash', iconColor: '#eb445a', confirmLabel: 'Clear All', confirmColor: '#eb445a',
      action: () => {
        this.api.clearFeedback().subscribe({
          next: () => { this.ui.showToast('All feedback cleared.', 'medium'); this.feedbackList = []; },
          error: () => this.ui.showToast('Failed to clear.', 'danger')
        });
      }
    });
  }

  exportFeedback() {
    window.open(this.api.exportFeedbackUrl(), '_blank', 'noopener,noreferrer');
  }

  categoryLabel(cat: string): string { return this.categoryLabels[cat] || cat; }
  categoryColor(cat: string): string { return this.categoryColors[cat] || '#92949c'; }

  trackByFeedbackId(_index: number, fb: any): number {
    return fb.id;
  }
}
