import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';
import { AdminViewMode } from '../mobile-admin-nav/mobile-admin-nav.component';

@Component({
  selector: 'app-mobile-admin-more-sheet',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './mobile-admin-more-sheet.component.html',
  styleUrl: './mobile-admin-more-sheet.component.scss',
})
export class MobileAdminMoreSheetComponent {
  @Input() isOpen = false;
  @Input() currentRole = 'admin';
  @Input() currentView: AdminViewMode = 'active';
  @Input() pendingVerificationsCount = 0;

  @Output() selectView = new EventEmitter<AdminViewMode>();
  @Output() close = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  onSelect(view: AdminViewMode): void {
    this.selectView.emit(view);
    this.close.emit();
  }

  onLogout(): void {
    this.logout.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
