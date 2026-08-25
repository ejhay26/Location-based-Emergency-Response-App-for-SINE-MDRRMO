import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

/**
 * FeedbackPanel — lists citizen-submitted feedback with export/clear actions.
 * Read-only list view; no media, no forms. Mirrors the old monolith's
 * "feedback" viewMode 1:1.
 */
@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, UtcDatePipe, ListEnterDirective, AppIconComponent],
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
      icon: 'trash', iconColor: '#eb445a', confirmLabel: 'Clear All', confirmColor: '#eb445a',
      action: () => {
        this.api.clearFeedback().subscribe({
          next: () => { this.ui.showToast('All feedback cleared.', 'medium'); this.feedbackList = []; },
          error: () => this.ui.showToast('Failed to clear.', 'danger')
        });
      }
    });
  }

  exportCsv() {
    if (this.feedbackList.length === 0) {
      this.ui.showToast('No feedback submissions to export.', 'warning');
      return;
    }
    const headers = ['ID', 'Date & Time', 'Citizen Name', 'Username', 'Email', 'Category', 'Message'];
    const rows = this.feedbackList.map(fb => [
      fb.id,
      `"${new Date(fb.created_at).toLocaleString().replace(/"/g, '""')}"`,
      `"${(fb.full_name || '').replace(/"/g, '""')}"`,
      `"${(fb.username || '').replace(/"/g, '""')}"`,
      `"${(fb.email || '').replace(/"/g, '""')}"`,
      `"${(this.categoryLabel(fb.category) || '').replace(/"/g, '""')}"`,
      `"${(fb.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `feedback_export_${new Date().toISOString().slice(0, 10)}.csv`;
    this.downloadBlob(blob, filename);
    this.ui.showToast('CSV export downloaded.', 'success');
  }

  exportJson() {
    if (this.feedbackList.length === 0) {
      this.ui.showToast('No feedback submissions to export.', 'warning');
      return;
    }
    const jsonContent = JSON.stringify(this.feedbackList, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const filename = `feedback_export_${new Date().toISOString().slice(0, 10)}.json`;
    this.downloadBlob(blob, filename);
    this.ui.showToast('JSON export downloaded.', 'success');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  categoryLabel(cat: string): string { return this.categoryLabels[cat] || cat; }
  categoryColor(cat: string): string { return this.categoryColors[cat] || '#92949c'; }

  trackByFeedbackId(_index: number, fb: any): number {
    return fb.id;
  }
}
