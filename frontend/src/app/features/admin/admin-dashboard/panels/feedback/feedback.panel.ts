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
    general: 'General', bug: 'Bug Report', suggestion: 'Suggestion', other: 'Other'
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

  // ── Official Certified PDF Export (Print / Save as PDF) ─────────────────
  exportPdf(): void {
    const list = this.activeFilter === 'trash' ? this.trashList : this.filteredList;
    if (list.length === 0) {
      this.ui.showToast('No feedback submissions to export.', 'warning');
      return;
    }

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const adminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'MDRRMO Officer';
    const role = localStorage.getItem('role') || 'Admin';
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const filterLabel = this.activeFilter === 'trash'
      ? 'Trash Archive'
      : (this.activeFilter === 'all' ? 'All Feedback' : this.categoryLabel(this.activeFilter));

    const rowsHtml = list.map((fb, i) => {
      const rating = Number(fb.rating) || 5;
      const stars = '★'.repeat(rating) + '☆'.repeat(Math.max(5 - rating, 0));
      const isArchived = !!fb.deleted_at;
      const statusColor = isArchived ? '#c62828' : '#2e7d32';
      const statusBg = isArchived ? '#ffebee' : '#e8f5e9';
      const statusText = isArchived ? 'Archived (Trash)' : 'Active';

      return `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">${i + 1}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; white-space: nowrap;">${new Date(fb.created_at).toLocaleString()}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; font-size: 11.5px;">${(fb.full_name || 'Anonymous Citizen').replace(/</g, '&lt;')}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${(fb.email || fb.username || 'N/A').replace(/</g, '&lt;')}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; background: #f0f0f0; font-weight: 600;">
              ${this.categoryLabel(fb.category)}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #f59e0b; white-space: nowrap;">
            ${stars} <span style="font-size: 10px; color: #555; font-weight: bold;">(${rating}/5)</span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; background: ${statusBg}; color: ${statusColor};">
              ${statusText}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px; line-height: 1.4; max-width: 320px;">
            ${(fb.message || '').replace(/</g, '&lt;')}
          </td>
        </tr>
      `;
    }).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MDRRMO Citizen Feedback Report - ${new Date().toISOString().slice(0, 10)}</title>
        <style>
          @page { size: landscape; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 15px; font-size: 12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #c62828; padding-bottom: 12px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .logo-box { width: 44px; height: 44px; background: #c62828; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; }
          .title-box h1 { margin: 0; font-size: 16px; text-transform: uppercase; color: #c62828; letter-spacing: 0.5px; }
          .title-box p { margin: 2px 0 0; font-size: 11px; color: #666; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8f9fa; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e9ecef; }
          .meta-item { font-size: 11px; }
          .meta-label { color: #888; text-transform: uppercase; font-size: 9px; font-weight: bold; margin-bottom: 2px; }
          .meta-val { font-weight: 600; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f3f5; color: #495057; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #dee2e6; text-align: left; }
          tr:nth-child(even) { background-color: #fafbfc; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 10px; color: #888; }
          .sig-box { text-align: center; border-top: 1px solid #333; padding-top: 4px; width: 180px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo-box">SINE</div>
            <div class="title-box">
              <h1>MDRRMO San Isidro — Citizen Feedback & Ratings Report</h1>
              <p>Municipal Disaster Risk Reduction and Management Office • Public Service Analytics</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #666;">
            <div><b>Generated:</b> ${nowStr}</div>
            <div><b>Officer:</b> ${adminName} (${role.toUpperCase()})</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Total Submissions</div>
            <div class="meta-val">${list.length} Records</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Average Satisfaction</div>
            <div class="meta-val">${this.averageRating} / 5.0 Stars</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Positive Sentiment Ratio</div>
            <div class="meta-val">${this.positivePercent}% Positive (4-5★)</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Export Filter Scope</div>
            <div class="meta-val">${filterLabel}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 30px;">#</th>
              <th style="width: 125px;">Date &amp; Time</th>
              <th>Citizen Name</th>
              <th>Contact / Email</th>
              <th>Category</th>
              <th style="text-align: center; width: 110px;">Rating</th>
              <th style="text-align: center; width: 85px;">Status</th>
              <th>Feedback Message</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>This document is an official export from the MDRRMO Citizen Response System. Confidential municipal record.</div>
          <div class="sig-box">
            <b>${adminName}</b><br>
            <span>Certified MDRRMO Personnel</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      this.ui.showToast('Opening print dialog for PDF export...', 'success');
    } else {
      // Fallback: hidden iframe print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 2000);
        }, 500);
        this.ui.showToast('Preparing PDF report...', 'success');
      } else {
        this.ui.showToast('Could not open print dialog. Please allow popups.', 'danger');
      }
    }
  }

  categoryLabel(cat: string): string { return this.categoryLabels[cat] || cat; }
  categoryColor(cat: string): string { return this.categoryColors[cat] || '#92949c'; }

  trackByFeedbackId(_index: number, fb: any): number {
    return fb.id;
  }
}

