import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../core/services/dialog.service';
import { ProxyImageDirective } from '../../directives/proxy-image.directive';

/**
 * AppDialogsComponent — renders the app-wide themed confirm dialog and media
 * lightbox, fed by DialogService. Mounted once at the true app root (see
 * app.component.html), the same way <app-tour-overlay> is, so both are
 * available above every route — citizen tabs, auth screens, and the admin
 * dashboard alike.
 *
 * Markup and the .c-overlay/.c-panel/.lightbox-* classes are unchanged from
 * their original home in admin-dashboard.page.html; they were already
 * defined globally in global.scss (not view-encapsulated to that page), so
 * lifting the rendering here needed no style duplication.
 */
@Component({
  selector: 'app-dialogs',
  standalone: true,
  imports: [CommonModule, ProxyImageDirective],
  template: `
    <div *ngIf="dialog.confirmDialog().open" class="c-overlay" style="z-index: 99999;">
      <div class="c-overlay-bg" (click)="dialog.closeConfirm()"></div>
      <div class="c-panel" style="width: min(400px, 90vw); border-radius: 22px; overflow: hidden;">
        <div style="padding: 32px 28px; text-align: center;">
          <div style="width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;" [style.background]="dialog.confirmDialog().iconColor + '18'"><i [class]="dialog.confirmDialog().icon" style="font-size: 26px;" [style.color]="dialog.confirmDialog().iconColor"></i></div>
          <h3 style="margin: 0 0 10px 0; font-weight: bold; font-size: 19px; color: var(--ion-text-color);">{{ dialog.confirmDialog().title }}</h3>
          <p [style.margin]="dialog.confirmDialog().details?.length ? '0 0 16px 0' : '0 0 28px 0'" style="font-size: 14px; color: gray; line-height: 1.5;">{{ dialog.confirmDialog().message }}</p>
          <div *ngIf="dialog.confirmDialog().details?.length" style="text-align: left; background: var(--ion-color-light, #f4f5f8); border-radius: 12px; padding: 4px 14px; margin-bottom: 20px;">
            <div *ngFor="let d of dialog.confirmDialog().details; let isLast = last" style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--ion-color-step-100, #e6e6e6);" [style.border-bottom]="isLast ? 'none' : ''">
              <i *ngIf="d.icon" [class]="d.icon" style="font-size: 13px; color: var(--ion-color-medium); width: 16px; flex-shrink: 0;"></i>
              <span style="font-size: 12px; font-weight: 700; color: var(--ion-color-medium); flex-shrink: 0;">{{ d.label }}</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--ion-text-color); text-align: right; flex: 1; overflow-wrap: anywhere;">{{ d.value }}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button (click)="dialog.closeConfirm()" style="flex: 1; padding: 14px; background: var(--ion-color-light); border: none; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; color: var(--ion-text-color);">{{ dialog.confirmDialog().cancelLabel }}</button>
            <button (click)="dialog.runConfirm()" style="flex: 1; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; color: white;" [style.background]="dialog.confirmDialog().confirmColor">{{ dialog.confirmDialog().confirmLabel }}</button>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="dialog.lightboxOpen()" class="lightbox-overlay" (click)="dialog.closeLightbox()">
      <button class="lightbox-close" (click)="dialog.closeLightbox()"><i class="fa-solid fa-xmark"></i></button>
      <video *ngIf="dialog.lightboxIsVideo()" class="lightbox-video"
             [proxySrc]="dialog.lightboxUrl()" controls autoplay playsinline
             (click)="$event.stopPropagation()">
      </video>
      <img *ngIf="!dialog.lightboxIsVideo()" class="lightbox-img"
           [proxySrc]="dialog.lightboxUrl()" (click)="$event.stopPropagation()" />
    </div>
  `,
})
export class AppDialogsComponent {
  constructor(public dialog: DialogService) {}
}
