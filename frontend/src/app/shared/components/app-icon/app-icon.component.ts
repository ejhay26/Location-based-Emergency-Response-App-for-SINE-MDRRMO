import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconRegistryService, IconPackType } from '../../../core/services/icon-registry.service';

/**
 * Universal App Icon Component (<app-icon>)
 *
 * Examples:
 *   <app-icon name="phone" [size]="18" color="var(--ion-color-danger)"></app-icon>
 *   <app-icon name="shield-check" [size]="22"></app-icon>
 *   <app-icon name="map-pin" [size]="16"></app-icon>
 *
 * Supports seamless switching between Lucide SVG, FontAwesome CSS, or custom pack
 * without changing a single line of HTML!
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="app-icon-wrapper" [style.display]="'inline-flex'" [style.align-items]="'center'" [style.justify-content]="'center'" [style.width.px]="size" [style.height.px]="size">
      <!-- 1. Lucide SVG Mode -->
      <span *ngIf="iconPack === 'lucide' && lucideSvg" [innerHTML]="lucideSvg" class="app-icon-svg" style="display:inline-flex;line-height:0;"></span>

      <!-- 2. FontAwesome Class Mode -->
      <i *ngIf="iconPack === 'fontawesome' || !lucideSvg" [class]="faClass" [style.font-size.px]="size" [style.color]="color" style="line-height:1;"></i>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
  `]
})
export class AppIconComponent {
  @Input() name = '';
  @Input() size = 20;
  @Input() color = 'currentColor';
  @Input() strokeWidth = 2;
  @Input() pack?: IconPackType;

  constructor(private registry: IconRegistryService) {}

  get iconPack(): IconPackType {
    return this.pack || this.registry.getActivePack();
  }

  get lucideSvg() {
    return this.registry.getLucideSvg(this.name, this.size, this.color, this.strokeWidth);
  }

  get faClass(): string {
    return this.registry.getFaClass(this.name);
  }
}
