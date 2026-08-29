import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type IconPackType = 'lucide' | 'fontawesome' | 'custom';

export interface IconDefinition {
  name: string;
  faClass: string;
  lucideSvg?: string;
  customUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IconRegistryService {
  /** Current active icon pack: 'lucide' (default iOS SF-Symbols style), 'fontawesome', or 'custom' */
  private activePack: IconPackType = 'lucide';

  private registry = new Map<string, IconDefinition>([
    [
      'home',
      {
        name: 'home',
        faClass: 'fa-solid fa-house',
        lucideSvg: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
      }
    ],
    [
      'phone',
      {
        name: 'phone',
        faClass: 'fa-solid fa-phone',
        lucideSvg: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
      }
    ],
    [
      'phone-call',
      {
        name: 'phone-call',
        faClass: 'fa-solid fa-phone-volume',
        lucideSvg: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/>'
      }
    ],
    [
      'shield',
      {
        name: 'shield',
        faClass: 'fa-solid fa-shield-halved',
        lucideSvg: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
      }
    ],
    [
      'shield-check',
      {
        name: 'shield-check',
        faClass: 'fa-solid fa-circle-check',
        lucideSvg: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'
      }
    ],
    [
      'map-pin',
      {
        name: 'map-pin',
        faClass: 'fa-solid fa-location-dot',
        lucideSvg: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
      }
    ],
    [
      'crosshairs',
      {
        name: 'crosshairs',
        faClass: 'fa-solid fa-location-crosshairs',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>'
      }
    ],
    [
      'camera',
      {
        name: 'camera',
        faClass: 'fa-solid fa-camera',
        lucideSvg: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'
      }
    ],
    [
      'video',
      {
        name: 'video',
        faClass: 'fa-solid fa-video',
        lucideSvg: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>'
      }
    ],
    [
      'hazard',
      {
        name: 'hazard',
        faClass: 'fa-solid fa-road-barrier',
        lucideSvg: '<path d="M4 8h16"/><path d="M4 16h16"/><path d="M4 4v16"/><path d="M20 4v16"/><path d="m6 8 8 8"/><path d="m10 8 8 8"/>'
      }
    ],
    [
      'alert',
      {
        name: 'alert',
        faClass: 'fa-solid fa-triangle-exclamation',
        lucideSvg: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>'
      }
    ],
    [
      'clock',
      {
        name: 'clock',
        faClass: 'fa-solid fa-clock',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
      }
    ],
    [
      'lock',
      {
        name: 'lock',
        faClass: 'fa-solid fa-lock',
        lucideSvg: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
      }
    ],
    [
      'mail',
      {
        name: 'mail',
        faClass: 'fa-solid fa-envelope',
        lucideSvg: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
      }
    ],
    [
      'user',
      {
        name: 'user',
        faClass: 'fa-solid fa-user',
        lucideSvg: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
      }
    ],
    [
      'history',
      {
        name: 'history',
        faClass: 'fa-solid fa-clock-rotate-left',
        lucideSvg: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'
      }
    ],
    [
      'chevron-left',
      {
        name: 'chevron-left',
        faClass: 'fa-solid fa-chevron-left',
        lucideSvg: '<path d="m15 18-6-6 6-6"/>'
      }
    ],
    [
      'chevron-right',
      {
        name: 'chevron-right',
        faClass: 'fa-solid fa-chevron-right',
        lucideSvg: '<path d="m9 18 6-6-6-6"/>'
      }
    ],
    [
      'chevron-down',
      {
        name: 'chevron-down',
        faClass: 'fa-solid fa-chevron-down',
        lucideSvg: '<path d="m6 9 6 6 6-6"/>'
      }
    ],
    [
      'chevron-up',
      {
        name: 'chevron-up',
        faClass: 'fa-solid fa-chevron-up',
        lucideSvg: '<path d="m18 15-6-6-6 6"/>'
      }
    ],
    [
      'send',
      {
        name: 'send',
        faClass: 'fa-solid fa-paper-plane',
        lucideSvg: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
      }
    ],
    [
      'trash',
      {
        name: 'trash',
        faClass: 'fa-solid fa-trash-can',
        lucideSvg: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'
      }
    ],
    [
      'info',
      {
        name: 'info',
        faClass: 'fa-solid fa-circle-info',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
      }
    ],
    [
      'close',
      {
        name: 'close',
        faClass: 'fa-solid fa-xmark',
        lucideSvg: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
      }
    ],
    [
      'check',
      {
        name: 'check',
        faClass: 'fa-solid fa-check',
        lucideSvg: '<polyline points="20 6 9 17 4 12"/>'
      }
    ],
    [
      'expand',
      {
        name: 'expand',
        faClass: 'fa-solid fa-expand',
        lucideSvg: '<path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/><path d="M3 16.2V21m0 0h4.8M3 21l6-6"/><path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/><path d="M3 7.8V3m0 0h4.8M3 3l6 6"/>'
      }
    ],
    [
      'compress',
      {
        name: 'compress',
        faClass: 'fa-solid fa-compress',
        lucideSvg: '<path d="m4 14 6 6m-6-6h4.8m-4.8 0v4.8"/><path d="M20 10l-6-6m6 6h-4.8m4.8 0V5.2"/><path d="M14 4l6 6m0 0v-4.8m0 4.8h-4.8"/><path d="m10 20-6-6m0 0v4.8m0-4.8h4.8"/>'
      }
    ],
    [
      'map',
      {
        name: 'map',
        faClass: 'fa-solid fa-map',
        lucideSvg: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>'
      }
    ],
    [
      'satellite',
      {
        name: 'satellite',
        faClass: 'fa-solid fa-satellite',
        lucideSvg: '<path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4"/><path d="m16 8-4-4"/><path d="M12 20a8 8 0 1 0-8-8"/>'
      }
    ],
    [
      'copy',
      {
        name: 'copy',
        faClass: 'fa-solid fa-copy',
        lucideSvg: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
      }
    ],
    [
      'user-check',
      {
        name: 'user-check',
        faClass: 'fa-solid fa-user-check',
        lucideSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>'
      }
    ],
    [
      'user-xmark',
      {
        name: 'user-xmark',
        faClass: 'fa-solid fa-user-xmark',
        lucideSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>'
      }
    ],
    [
      'id-card',
      {
        name: 'id-card',
        faClass: 'fa-solid fa-id-card',
        lucideSvg: '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="4" width="20" height="16" rx="2"/>'
      }
    ],
    [
      'globe',
      {
        name: 'globe',
        faClass: 'fa-solid fa-globe',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
      }
    ],
    [
      'external-link',
      {
        name: 'external-link',
        faClass: 'fa-solid fa-arrow-up-right-from-square',
        lucideSvg: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
      }
    ],
    [
      'sliders-horizontal',
      {
        name: 'sliders-horizontal',
        faClass: 'fa-solid fa-sliders',
        lucideSvg: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'
      }
    ],
    [
      'alert-triangle',
      {
        name: 'alert-triangle',
        faClass: 'fa-solid fa-triangle-exclamation',
        lucideSvg: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>'
      }
    ],
    [
      'shield-alert',
      {
        name: 'shield-alert',
        faClass: 'fa-solid fa-shield-halved',
        lucideSvg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
      }
    ],
    [
      'rotate-ccw',
      {
        name: 'rotate-ccw',
        faClass: 'fa-solid fa-rotate-left',
        lucideSvg: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
      }
    ],
    [
      'gavel',
      {
        name: 'gavel',
        faClass: 'fa-solid fa-gavel',
        lucideSvg: '<path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>'
      }
    ],
    [
      'flag',
      {
        name: 'flag',
        faClass: 'fa-solid fa-flag',
        lucideSvg: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'
      }
    ],
    [
      'shield',
      {
        name: 'shield',
        faClass: 'fa-solid fa-shield',
        lucideSvg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
      }
    ],
    [
      'settings',
      {
        name: 'settings',
        faClass: 'fa-solid fa-gear',
        lucideSvg: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
      }
    ],
    [
      'graduation-cap',
      {
        name: 'graduation-cap',
        faClass: 'fa-solid fa-graduation-cap',
        lucideSvg: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'
      }
    ],
    [
      'play',
      {
        name: 'play',
        faClass: 'fa-solid fa-play',
        lucideSvg: '<polygon points="6 3 20 12 6 21 6 3"/>'
      }
    ],
    [
      'logout',
      {
        name: 'logout',
        faClass: 'fa-solid fa-arrow-right-from-bracket',
        lucideSvg: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
      }
    ],
    [
      'broadcast',
      {
        name: 'broadcast',
        faClass: 'fa-solid fa-tower-broadcast',
        lucideSvg: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>'
      }
    ],
    [
      'megaphone',
      {
        name: 'megaphone',
        faClass: 'fa-solid fa-bullhorn',
        lucideSvg: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'
      }
    ],
    [
      'calendar-clock',
      {
        name: 'calendar-clock',
        faClass: 'fa-solid fa-calendar-check',
        lucideSvg: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><circle cx="16" cy="16" r="6"/><polyline points="16 14 16 16 18 17"/>'
      }
    ],
    [
      'circle-question',
      {
        name: 'circle-question',
        faClass: 'fa-solid fa-circle-question',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>'
      }
    ],
    [
      'circle-info',
      {
        name: 'circle-info',
        faClass: 'fa-solid fa-circle-info',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>'
      }
    ],
    [
      'message-square',
      {
        name: 'message-square',
        faClass: 'fa-solid fa-comment-dots',
        lucideSvg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
      }
    ],
    [
      'star',
      {
        name: 'star',
        faClass: 'fa-solid fa-star',
        lucideSvg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
      }
    ],
    [
      'medical',
      {
        name: 'medical',
        faClass: 'fa-solid fa-heart-pulse',
        lucideSvg: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'
      }
    ],
    [
      'mobile',
      {
        name: 'mobile',
        faClass: 'fa-solid fa-mobile-screen',
        lucideSvg: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>'
      }
    ],
    [
      'bell',
      {
        name: 'bell',
        faClass: 'fa-solid fa-bell',
        lucideSvg: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
      }
    ],
    [
      'siren',
      {
        name: 'siren',
        faClass: 'fa-solid fa-bullhorn',
        lucideSvg: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'
      }
    ],
    [
      'moon',
      {
        name: 'moon',
        faClass: 'fa-solid fa-moon',
        lucideSvg: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
      }
    ],
    [
      'sun',
      {
        name: 'sun',
        faClass: 'fa-solid fa-sun',
        lucideSvg: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
      }
    ],
    [
      'truck-medical',
      {
        name: 'truck-medical',
        faClass: 'fa-solid fa-truck-medical',
        lucideSvg: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/><path d="M8 8v4"/><path d="M6 10h4"/>'
      }
    ],
    [
      'flame',
      {
        name: 'flame',
        faClass: 'fa-solid fa-fire',
        lucideSvg: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/>'
      }
    ],
    [
      'droplet',
      {
        name: 'droplet',
        faClass: 'fa-solid fa-cloud-showers-heavy',
        lucideSvg: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'
      }
    ],
    [
      'zap',
      {
        name: 'zap',
        faClass: 'fa-solid fa-bolt-lightning',
        lucideSvg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
      }
    ],
    [
      'trees',
      {
        name: 'trees',
        faClass: 'fa-solid fa-tree',
        lucideSvg: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>'
      }
    ],
    [
      'shield-alert',
      {
        name: 'shield-alert',
        faClass: 'fa-solid fa-handcuffs',
        lucideSvg: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
      }
    ],
    [
      'cloud-arrow-up',
      {
        name: 'cloud-arrow-up',
        faClass: 'fa-solid fa-cloud-arrow-up',
        lucideSvg: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>'
      }
    ],
    [
      'calendar',
      {
        name: 'calendar',
        faClass: 'fa-solid fa-calendar-days',
        lucideSvg: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
      }
    ],
    [
      'user-plus',
      {
        name: 'user-plus',
        faClass: 'fa-solid fa-user-plus',
        lucideSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>'
      }
    ],
    [
      'log-in',
      {
        name: 'log-in',
        faClass: 'fa-solid fa-right-to-bracket',
        lucideSvg: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>'
      }
    ],
    [
      'arrow-right',
      {
        name: 'arrow-right',
        faClass: 'fa-solid fa-arrow-right',
        lucideSvg: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'
      }
    ],
    [
      'arrow-left',
      {
        name: 'arrow-left',
        faClass: 'fa-solid fa-arrow-left',
        lucideSvg: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
      }
    ],
    [
      'id-card',
      {
        name: 'id-card',
        faClass: 'fa-solid fa-id-card',
        lucideSvg: '<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 9h2"/><path d="M15 13h2"/>'
      }
    ],
    [
      'sliders',
      {
        name: 'sliders',
        faClass: 'fa-solid fa-sliders',
        lucideSvg: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>'
      }
    ],
    [
      'sparkles',
      {
        name: 'sparkles',
        faClass: 'fa-solid fa-wand-magic-sparkles',
        lucideSvg: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>'
      }
    ],
    [
      'rotate-cw',
      {
        name: 'rotate-cw',
        faClass: 'fa-solid fa-rotate-right',
        lucideSvg: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'
      }
    ],
    [
      'crop',
      {
        name: 'crop',
        faClass: 'fa-solid fa-crop-simple',
        lucideSvg: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'
      }
    ],
    [
      'eye',
      {
        name: 'eye',
        faClass: 'fa-solid fa-eye',
        lucideSvg: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
      }
    ],
    [
      'eye-off',
      {
        name: 'eye-off',
        faClass: 'fa-solid fa-eye-slash',
        lucideSvg: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>'
      }
    ],
    [
      'smartphone',
      {
        name: 'smartphone',
        faClass: 'fa-solid fa-mobile-screen',
        lucideSvg: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>'
      }
    ],
    [
      'hourglass',
      {
        name: 'hourglass',
        faClass: 'fa-solid fa-hourglass-half',
        lucideSvg: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'
      }
    ],
    [
      'ban',
      {
        name: 'ban',
        faClass: 'fa-solid fa-ban',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>'
      }
    ],
    [
      'circle-alert',
      {
        name: 'circle-alert',
        faClass: 'fa-solid fa-circle-exclamation',
        lucideSvg: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
      }
    ],
    [
      'plus',
      {
        name: 'plus',
        faClass: 'fa-solid fa-plus',
        lucideSvg: '<path d="M5 12h14"/><path d="M12 5v14"/>'
      }
    ],
    [
      'paper-plane',
      {
        name: 'paper-plane',
        faClass: 'fa-solid fa-paper-plane',
        lucideSvg: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
      }
    ],
    [
      'lock-open',
      {
        name: 'lock-open',
        faClass: 'fa-solid fa-lock-open',
        lucideSvg: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
      }
    ],
    [
      'circle',
      {
        name: 'circle',
        faClass: 'fa-regular fa-circle',
        lucideSvg: '<circle cx="12" cy="12" r="10"/>'
      }
    ],
    [
      'loader-2',
      {
        name: 'loader-2',
        faClass: 'fa-solid fa-spinner',
        lucideSvg: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>'
      }
    ],
    [
      'search',
      {
        name: 'search',
        faClass: 'fa-solid fa-magnifying-glass',
        lucideSvg: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
      }
    ],
    [
      'chart-pie',
      {
        name: 'chart-pie',
        faClass: 'fa-solid fa-chart-pie',
        lucideSvg: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.997.398-.997.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>'
      }
    ],
    [
      'users',
      {
        name: 'users',
        faClass: 'fa-solid fa-users',
        lucideSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
      }
    ],
    [
      'user-gear',
      {
        name: 'user-gear',
        faClass: 'fa-solid fa-user-gear',
        lucideSvg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="11" r="2"/><path d="M19 8v1"/><path d="M19 13v1"/><path d="m21.6 9.5-.87.5"/><path d="m17.27 12-.87.5"/><path d="m21.6 12.5-.87-.5"/><path d="m17.27 10-.87-.5"/>'
      }
    ],
    [
      'filter',
      {
        name: 'filter',
        faClass: 'fa-solid fa-filter',
        lucideSvg: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'
      }
    ],
    [
      'paperclip',
      {
        name: 'paperclip',
        faClass: 'fa-solid fa-paperclip',
        lucideSvg: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
      }
    ],
    [
      'file-pdf',
      {
        name: 'file-pdf',
        faClass: 'fa-solid fa-file-pdf',
        lucideSvg: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
      }
    ],
    [
      'menu',
      {
        name: 'menu',
        faClass: 'fa-solid fa-bars',
        lucideSvg: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>'
      }
    ],
    [
      'trash',
      {
        name: 'trash',
        faClass: 'fa-solid fa-trash-can',
        lucideSvg: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'
      }
    ],
    [
      'pen',
      {
        name: 'pen',
        faClass: 'fa-solid fa-pen-to-square',
        lucideSvg: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'
      }
    ],
    [
      'layers',
      {
        name: 'layers',
        faClass: 'fa-solid fa-layer-group',
        lucideSvg: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5"/>'
      }
    ],
    [
      'download',
      {
        name: 'download',
        faClass: 'fa-solid fa-download',
        lucideSvg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'
      }
    ],
    [
      'file-text',
      {
        name: 'file-text',
        faClass: 'fa-solid fa-file-lines',
        lucideSvg: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
      }
    ],
    [
      'file-spreadsheet',
      {
        name: 'file-spreadsheet',
        faClass: 'fa-solid fa-file-excel',
        lucideSvg: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>'
      }
    ],
    [
      'code',
      {
        name: 'code',
        faClass: 'fa-solid fa-code',
        lucideSvg: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'
      }
    ]
  ]);

  constructor(private sanitizer: DomSanitizer) {}

  getActivePack(): IconPackType {
    return this.activePack;
  }

  setActivePack(pack: IconPackType): void {
    this.activePack = pack;
  }

  registerIcon(def: IconDefinition): void {
    this.registry.set(def.name, def);
  }

  getIcon(name: string): IconDefinition | undefined {
    if (!name) return undefined;
    if (this.registry.has(name)) return this.registry.get(name);

    // Normalize name
    const normalized = name.toLowerCase()
      .replace(/^fa-(solid|regular|brands)\s+fa-/, '')
      .replace(/^fa-/, '')
      .replace(/-outline$/, '')
      .replace(/-sharp$/, '')
      .trim();

    if (this.registry.has(normalized)) return this.registry.get(normalized);

    const aliases: Record<string, string> = {
      'triangle-exclamation': 'alert',
      'circle-xmark': 'close',
      'xmark': 'close',
      'close-circle': 'close',
      'circle-check': 'check',
      'right-to-bracket': 'log-in',
      'right-from-bracket': 'logout',
      'log-out': 'logout',
      'lock-closed': 'lock',
      'mail-outline': 'mail',
      'call': 'phone',
      'location': 'map-pin',
      'location-dot': 'map-pin',
      'location-crosshairs': 'crosshairs',
      'map-location-dot': 'map',
      'road-barrier': 'hazard',
      'align-left': 'message-square',
      'hand-pointer': 'crosshairs',
      'magnifying-glass-plus': 'expand',
      'magnifying-glass-minus': 'compress',
      'rotate-left': 'history',
      'chevron-back': 'chevron-left',
      'mobile-screen': 'smartphone',
      'id-card-clip': 'id-card',
      'table-cells-large': 'sliders',
      'wand-magic-sparkles': 'sparkles',
      'circle-exclamation': 'circle-alert',
      'circle-info': 'info',
      'info-circle': 'info',
      'paperclip': 'paperclip',
      'lock-open': 'lock-open',
      'lock-unlocked': 'lock-open',
      'triangle-alert': 'alert',
      'warning': 'alert',
      'play': 'play',
      'pause': 'pause',
      'camera-retro': 'camera',
      'camera-rotate': 'rotate-cw',
      'crop-simple': 'crop',
      'rotate': 'rotate-cw',
      'comment-sms': 'smartphone',
      'envelope-open-text': 'mail',
      'heart-pulse': 'medical',
      'notes-medical': 'medical',
      'spinner': 'loader-2',
      'hourglass-half': 'hourglass',
      'chevron-forward': 'chevron-right',
      'shield-half': 'shield',
      'shield-halved': 'shield',
      'cloud-showers-heavy': 'droplet',
      'fire': 'flame',
      'bolt-lightning': 'zap',
      'tree': 'trees',
      'handcuffs': 'shield-alert',
      'clock-rotate-left': 'history',
      'house': 'home',
      'circle-user': 'user',
      'images': 'camera',
      'floppy-disk': 'check',
      'arrows-up-down-left-right': 'crosshairs',
      'arrows-left-right': 'chevron-right',
      'bars': 'menu',
      'magnifying-glass': 'search',
      'pie-chart': 'chart-pie',
      'chart-line': 'chart-pie',
      'chart-bar': 'chart-pie',
      'user-shield': 'shield-check',
      'user-cog': 'user-gear',
      'file-lines': 'file-pdf',
      'file-contract': 'file-pdf',
      'pen-to-square': 'pen',
      'trash-can': 'trash',
      'delete': 'trash',
      'chat': 'message-square',
      'file-excel': 'file-spreadsheet',
      'file-csv': 'file-spreadsheet',
      'csv': 'file-spreadsheet',
      'excel': 'file-spreadsheet',
      'layer-group': 'layers',
      'box-archive': 'history',
      'comment-dots': 'message-square',
      'announcement': 'broadcast',
      'tower-broadcast': 'broadcast',
      'bullhorn': 'megaphone',
      'paper-plane': 'send'
    };

    const alias = aliases[normalized];
    if (alias && this.registry.has(alias)) return this.registry.get(alias);

    return undefined;
  }

  getLucideSvg(name: string, size = 20, color = 'currentColor', strokeWidth = 2): SafeHtml | null {
    const icon = this.getIcon(name);
    if (!icon || !icon.lucideSvg) return null;

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${icon.name}">${icon.lucideSvg}</svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  getFaClass(name: string): string {
    const icon = this.getIcon(name);
    if (icon?.faClass) return icon.faClass;
    if (name?.startsWith('fa-')) return name;
    return 'fa-solid fa-circle-question';
  }
}
