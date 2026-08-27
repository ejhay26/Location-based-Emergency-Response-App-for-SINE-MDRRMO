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
 * 2. Heuristic #3 (User Control & Freedom): Provides an explicit [✕] button
 *    so users can dismiss immediately, and an optional [Undo] action.
 * 3. Human Factors: Standard messages stay visible for 4.5 seconds (rather
 *    than disappearing before seniors or panicking citizens finish reading).
 *    Actionable toasts (with Undo) extend to 6 seconds.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {

  constructor(private toastCtrl: ToastController) {}

  async show(opts: ToastOptions | string, colorFallback: ToastOptions['color'] = 'danger'): Promise<HTMLIonToastElement> {
    const config: ToastOptions = typeof opts === 'string'
      ? { message: opts, color: colorFallback }
      : opts;

    const color = config.color || 'danger';
    const hasAction = !!config.action;
    const duration = config.duration ?? (hasAction ? 6000 : 4500);
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
        },
      });
    }

    if (dismissible) {
      buttons.push({
        text: '✕',
        role: 'cancel',
        handler: () => {
          // Explicit user dismiss
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

    await toast.present();
    return toast;
  }
}
