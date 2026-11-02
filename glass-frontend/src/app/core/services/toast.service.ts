import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

export interface ToastAction {
  text: string;
  handler: () => void | Promise<void>;
  role?: string;
}

export interface ToastOptions {
  message: string;
  color?: 'danger' | 'success' | 'warning' | 'primary' | 'medium' | 'dark' | 'tertiary';
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  action?: ToastAction;
  dismissible?: boolean;
}

/**
 * ToastService — Smarter, accessible toast notifications adhering to
 * Jakob Nielsen's Usability Heuristics:
 *
 * 1. Heuristic #1 (Visibility of System Status): Clear color-coded feedback.
 * 2. Heuristic #3 (User Control & Freedom): Explicit dismiss and tap-to-close.
 * 3. Human Factors: Standard duration (3.5s - 5s) with strict cleanup of prior toasts.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {

  private activeToast: HTMLIonToastElement | null = null;

  constructor(private toastCtrl: ToastController) {}

  async dismissActiveToast(): Promise<void> {
    if (this.activeToast) {
      try {
        await this.activeToast.dismiss();
      } catch {}
      this.activeToast = null;
    }
  }

  async show(opts: ToastOptions | string, colorFallback: ToastOptions['color'] = 'danger'): Promise<HTMLIonToastElement> {
    const config: ToastOptions = typeof opts === 'string'
      ? { message: opts, color: colorFallback }
      : opts;

    // Clean up any lingering active toast so toasts never stack or persist indefinitely
    await this.dismissActiveToast();

    const color = config.color || 'danger';
    const hasAction = !!config.action;
    const duration = config.duration ?? (hasAction ? 5000 : 3500);
    const position = config.position ?? 'bottom';
    const dismissible = config.dismissible !== false;

    const buttons: any[] = [];

    if (config.action) {
      buttons.push({
        text: config.action.text,
        role: config.action.role || 'action',
        handler: () => {
          try {
            config.action!.handler();
          } catch (err) {
            console.error('[ToastService] Action handler error:', err);
          }
          this.dismissActiveToast();
          return true;
        },
      });
    }

    if (dismissible) {
      buttons.push({
        text: '✕',
        role: 'cancel',
        handler: () => {
          this.dismissActiveToast();
          return true;
        },
      });
    }

    const toast = await this.toastCtrl.create({
      message: config.message,
      duration,
      position,
      color,
      cssClass: 'app-smart-toast',
      buttons,
    });

    this.activeToast = toast;

    toast.onDidDismiss().then(() => {
      if (this.activeToast === toast) {
        this.activeToast = null;
      }
    });

    // Tap anywhere on the toast container to dismiss immediately
    toast.addEventListener('click', () => {
      this.dismissActiveToast();
    }, { once: true });

    await toast.present();
    return toast;
  }
}
