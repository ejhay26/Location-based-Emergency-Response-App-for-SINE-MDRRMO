import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-mobile-menu-panel',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './mobile-menu.panel.html',
  styleUrl: './mobile-menu.panel.scss'
})
export class MobileMenuPanel implements OnInit {
  @Input() currentRole: string = 'admin';
  @Input() pendingVerificationsCount: number = 0;
  @Output() viewSelect = new EventEmitter<string>();

  userName: string = 'MDRRMO Officer';
  userEmail: string = '';
  username: string = '';

  constructor() {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        this.userName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'MDRRMO Officer';
        this.userEmail = u.email || '';
        this.username = u.username || '';
      } catch {}
    }
  }

  get isAdmin(): boolean {
    return this.currentRole?.toLowerCase() === 'admin';
  }

  onSelectView(view: string): void {
    this.viewSelect.emit(view);
  }
}
