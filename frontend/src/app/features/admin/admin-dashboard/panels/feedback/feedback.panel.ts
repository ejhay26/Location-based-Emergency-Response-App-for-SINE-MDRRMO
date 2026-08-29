import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

export type FeedbackFilter = 'all' | 'suggestion' | 'bug' | 'general' | 'high_rating' | 'low_rating' | 'trash';

/**
 * FeedbackPanel — lists citizen-submitted feedback, satisfaction ratings,
 * category filters, forward-to-devs action, and soft-delete trash archive.
 */
@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, UtcDatePipe, ListEnterDirective, AppIconComponent],
  templateUrl: './feedback.panel.html',
})
export class FeedbackPanel implements OnInit {

  feedbackList: any[] = [];
  activeFilter: FeedbackFilter = 'all';
  isForwardingBug: Record<number, boolean> = {};

  private readonly categoryLabels: Record<string, string> = {
    general: 'General', bug: '🐛 Bug Report', suggestion: '💡 Suggestion', other: 'Other'
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
      next: (res: any) => { this.feedbackList = res || []; },
      error: () => this.ui.showToast('Failed to load citizen feedback.', 'danger')
    });
  }

  // ── Active vs Trash Filtered Lists ──────────────────────────────────────────
  get activeList(): any[] {
    return this.feedbackList.filter(f => f.status !== 'archived');
  }

  get trashList(): any[] {
    return this.feedbackList.filter(f => f.status === 'archived');
  }

  get filteredList(): any[] {
    if (this.activeFilter === 'trash') return this.trashList;

    const list = this.activeList;
    switch (this.activeFilter) {
      case 'suggestion':
        return list.filter(f => f.category === 'suggestion');
      case 'bug':
        return list.filter(f => f.category === 'bug');
      case 'general':
        return list.filter(f => f.category === 'general' || f.category === 'other' || !f.category);
      case 'high_rating':
        return list.filter(f => (f.rating || 5) >= 4);
      case 'low_rating':
        return list.filter(f => (f.rating || 5) <= 3);
      default:
        return list;
    }
  }

  // ── Counts for Filter Pills ────────────────────────────────────────────────
  get countAll(): number { return this.activeList.length; }
  get countSuggestions(): number { return this.activeList.filter(f => f.category === 'suggestion').length; }
  get countBugs(): number { return this.activeList.filter(f => f.category === 'bug').length; }
  get countHighRatings(): number { return this.activeList.filter(f => (f.rating || 5) >= 4).length; }
  get countLowRatings(): number { return this.activeList.filter(f => (f.rating || 5) <= 3).length; }
  get countTrash(): number { return this.trashList.length; }

  // ── Executive Satisfaction Rating KPI ─────────────────────────────────────
  get averageRating(): number {
    const list = this.activeList;
    if (list.length === 0) return 5.0;
    const sum = list.reduce((acc, f) => acc + (f.rating || 5), 0);
    return Math.round((sum / list.length) * 10) / 10;
  }

  get positivePercent(): number {
    const list = this.activeList;
    if (list.length === 0) return 100;
    const positive = list.filter(f => (f.rating || 5) >= 4).length;
    return Math.round((positive / list.length) * 100);
  }

  // ── Forward Bug to Dev Team ───────────────────────────────────────────────
  forwardBugToDev(fb: any) {
    if (fb.is_forwarded) {
      this.ui.showToast('This issue has already been forwarded to Technical Support.', 'medium');
      return;
    }

    this.ui.showConfirm({
      title: 'Forward to Technical Support',
      message: `Forward this ${fb.category === 'bug' ? 'bug report' : 'feedback'} from @${fb.username} to the developer support team (ejcp2005@gmail.com)?`,
      icon: 'send',
      iconColor: '#3880ff',
      confirmLabel: 'Forward to Devs',
      confirmColor: '#3880ff',
      action: () => {
        this.isForwardingBug[fb.id] = true;
        this.api.forwardFeedbackBug(fb.id).subscribe({
          next: (res: any) => {
            this.isForwardingBug[fb.id] = false;
            fb.is_forwarded = true;
            fb.forwarded_at = res.forwarded_at || new Date().toISOString();
            this.ui.showToast('Bug report successfully forwarded to Technical Support.', 'success');
          },
          error: (err: any) => {
            this.isForwardingBug[fb.id] = false;
            const msg = err?.error?.error || 'Failed to send bug report email.';
            this.ui.showToast(msg, 'danger');
          }
        });
      }
    });
  }

  // ── Soft Delete / Archive & Restore ───────────────────────────────────────
  archiveFeedback(fb: any) {
    this.api.archiveFeedback(fb.id).subscribe({
      next: () => {
        fb.status = 'archived';
        fb.deleted_at = new Date().toISOString();
        this.ui.showToast('Moved feedback to Trash Archive.', 'medium');
      },
      error: () => this.ui.showToast('Failed to archive feedback.', 'danger')
    });
  }

  restoreFeedback(fb: any) {
    this.api.restoreFeedback(fb.id).subscribe({
      next: () => {
        fb.status = 'active';
        fb.deleted_at = null;
        this.ui.showToast('Restored feedback to active list.', 'success');
      },
      error: () => this.ui.showToast('Failed to restore feedback.', 'danger')
    });
  }

  clearAllFeedback() {
    if (this.activeList.length === 0) return;
    this.ui.showConfirm({
      title: 'Move All to Trash',
      message: 'Move all active feedback to the Trash Archive? You can restore them anytime from the Trash tab.',
      icon: 'trash',
      iconColor: '#eb445a',
      confirmLabel: 'Move to Trash',
      confirmColor: '#eb445a',
      action: () => {
        this.api.clearFeedback().subscribe({
          next: () => {
            this.activeList.forEach(f => {
              f.status = 'archived';
              f.deleted_at = new Date().toISOString();
            });
            this.ui.showToast('All feedback moved to Trash Archive.', 'medium');
          },
          error: () => this.ui.showToast('Failed to move to trash.', 'danger')
        });
      }
    });
  }

  purgeTrash() {
    if (this.trashList.length === 0) return;
    this.ui.showConfirm({
      title: 'Empty Trash Permanently',
      message: 'Permanently delete all archived feedback? This action is irreversible.',
      icon: 'alert-triangle',
      iconColor: '#eb445a',
      confirmLabel: 'Delete Permanently',
      confirmColor: '#eb445a',
      action: () => {
        this.api.purgeFeedbackTrash().subscribe({
          next: () => {
            this.feedbackList = this.activeList;
            this.ui.showToast('Trash emptied permanently.', 'medium');
          },
          error: () => this.ui.showToast('Failed to empty trash.', 'danger')
        });
      }
    });
  }

  // ── Enhanced CSV Export (Save As Picker + Share / Mobile Support) ──────────
  async exportCsv() {
    const list = this.activeFilter === 'trash' ? this.trashList : this.filteredList;
    if (list.length === 0) {
      this.ui.showToast('No feedback submissions to export.', 'warning');
      return;
    }

    const headers = ['ID', 'Date & Time', 'Citizen Name', 'Username', 'Email', 'Category', 'Rating (1-5)', 'Status', 'Message'];
    const rows = list.map(fb => [
      fb.id,
      `"${new Date(fb.created_at).toLocaleString().replace(/"/g, '""')}"`,
      `"${(fb.full_name || '').replace(/"/g, '""')}"`,
      `"${(fb.username || '').replace(/"/g, '""')}"`,
      `"${(fb.email || '').replace(/"/g, '""')}"`,
      `"${(this.categoryLabel(fb.category) || '').replace(/"/g, '""')}"`,
      `"${fb.rating || 5} of 5 Stars"`,
      `"${fb.status === 'archived' ? 'Archived' : 'Active'}"`,
      `"${(fb.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `feedback_report_${new Date().toISOString().slice(0, 10)}.csv`;

    // 1. Check for modern File System Access API (Native Windows "Save As" file dialog)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'CSV Spreadsheet',
            accept: { 'text/csv': ['.csv'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.ui.showToast(`Saved ${filename} successfully.`, 'success');
        return;
      } catch (err: any) {
        // User aborted/cancelled the picker dialog
        if (err?.name === 'AbortError') return;
      }
    }

    // 2. Mobile Native Share Sheet if supported
    if (navigator.canShare && typeof File !== 'undefined') {
      try {
        const file = new File([blob], filename, { type: 'text/csv' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Citizen Feedback Export',
            text: `SINE MDRRMO Citizen Feedback Export (${new Date().toLocaleDateString()})`
          });
          this.ui.showToast('Spreadsheet exported.', 'success');
          return;
        }
      } catch (e) {
        // Fall back to standard download
      }
    }

    // 3. Fallback download with clear folder destination toast
    this.downloadBlob(blob, filename);
    this.ui.showToast(`Saved ${filename} to your Downloads folder.`, 'success');
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

