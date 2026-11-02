import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

export type AdminViewMode =
  | 'active'
  | 'archive'
  | 'analytics'
  | 'broadcast'
  | 'feedback'
  | 'verifications'
  | 'dispatchers'
  | 'citizens'
  | 'settings'
  | 'help'
  | 'menu';

@Component({
  selector: 'app-mobile-admin-nav',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './mobile-admin-nav.component.html',
  styleUrl: './mobile-admin-nav.component.scss',
})
export class MobileAdminNavComponent {
  @Input() currentView: AdminViewMode = 'active';
  @Input() activeIncidentsCount = 0;
  @Input() pendingVerificationsCount = 0;
  @Input() isMoreOpen = false;

  @Output() viewChange = new EventEmitter<AdminViewMode>();

  onTabClick(view: AdminViewMode): void {
    this.viewChange.emit(view);
  }

  isPrimaryTab(mode: AdminViewMode): boolean {
    return mode === 'active' || mode === 'broadcast' || mode === 'archive' || mode === 'menu';
  }
}
