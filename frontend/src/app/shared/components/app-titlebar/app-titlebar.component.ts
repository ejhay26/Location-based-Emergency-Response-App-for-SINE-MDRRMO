import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { isTauri, isElectron } from '../../utils/platform.util';

/** Minimal shape of Electron's ipcRenderer that this component uses. */
interface ElectronIpcRenderer {
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

/** Minimal shape of the Tauri v2 window handle that this component uses. */
interface TauriWindowHandle {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onResized(handler: () => void): Promise<() => void>;
}

@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './app-titlebar.component.scss',
  template: `
    <div class="app-titlebar" [class.red-header]="isRedHeader">
      <div class="app-titlebar__drag" data-tauri-drag-region></div>
      <div class="app-titlebar__controls" (mousedown)="$event.stopPropagation()">
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="minimize($event)"
          (mousedown)="$event.stopPropagation()"
          aria-label="Minimize window"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="toggleMaximize($event)"
          (mousedown)="$event.stopPropagation()"
          [attr.aria-label]="isMaximized ? 'Restore window' : 'Maximize window'"
          [title]="isMaximized ? 'Restore' : 'Maximize'"
        >
          <svg *ngIf="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <svg *ngIf="isMaximized" width="10" height="10" viewBox="0 0 10 10"><path d="M3 1h6v6" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>
        </button>
        <button
          type="button"
          class="app-titlebar__btn app-titlebar__btn--close"
          (click)="close($event)"
          (mousedown)="$event.stopPropagation()"
          aria-label="Close window"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
    </div>
  `,
})
export class AppTitlebarComponent implements OnInit, OnDestroy {
  isMaximized = false;
  isRedHeader = false;

  private router = inject(Router);
  private sub?: Subscription;
  private ipc: ElectronIpcRenderer | null = null;

  // Tauri's window handle and unlisten function are resolved once via a
  // dynamic import of `@tauri-apps/api/window` — dynamic, not a static
  // top-level import, so this module has zero effect when running under
  // Electron/Capacitor/browser (where the package may not even be bundled
  // for that target).
  private tauriWindow: TauriWindowHandle | null = null;
  private tauriUnlistenResize: (() => void) | null = null;

  private readonly handleWindowState = (...args: unknown[]): void => {
    const state = args[0] as { maximized?: boolean } | undefined;
    this.isMaximized = !!state?.maximized;
  };

  async ngOnInit(): Promise<void> {
    if (isTauri()) {
      await this.initTauriWindowControls();
    } else if (isElectron()) {
      this.ipc = this.resolveIpcRenderer();
      this.ipc?.on('window:state', this.handleWindowState);
    }

    this.updateHeaderState(this.router.url);
    this.sub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.updateHeaderState(e.urlAfterRedirects || e.url);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.ipc?.removeListener('window:state', this.handleWindowState);
    this.tauriUnlistenResize?.();
  }

  private updateHeaderState(url: string): void {
    const isAuth = url.includes('/login') || url.includes('/register') || url.includes('/welcome');
    const isCitizen = url.includes('/tabs') || url.includes('/report');
    this.isRedHeader = isAuth || isCitizen;
  }

  minimize(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.tauriWindow) { void this.tauriWindow.minimize(); return; }
    const ipc = this.ipc || this.resolveIpcRenderer();
    ipc?.send('window:minimize');
  }

  toggleMaximize(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.tauriWindow) { void this.tauriWindow.toggleMaximize(); return; }
    const ipc = this.ipc || this.resolveIpcRenderer();
    ipc?.send('window:maximize-toggle');
  }

  close(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.tauriWindow) { void this.tauriWindow.close(); return; }
    const ipc = this.ipc || this.resolveIpcRenderer();
    ipc?.send('window:close');
  }

  /** Returns null outside the Electron desktop shell. */
  private resolveIpcRenderer(): ElectronIpcRenderer | null {
    try {
      const electronRequire = (window as unknown as { require?: (mod: string) => any }).require;
      if (typeof electronRequire === 'function') {
        const electron = electronRequire('electron');
        return electron?.ipcRenderer || electron || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /** Resolves the Tauri window handle and wires maximize-state sync via onResized. */
  private async initTauriWindowControls(): Promise<void> {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow() as unknown as TauriWindowHandle;
      this.tauriWindow = win;
      this.isMaximized = await win.isMaximized();
      this.tauriUnlistenResize = await win.onResized(async () => {
        this.isMaximized = await win.isMaximized();
      });
    } catch (err) {
      console.warn('[Titlebar] Failed to initialize Tauri window controls:', err);
    }
  }
}
