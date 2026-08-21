import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Minimal shape of Electron's ipcRenderer that this component actually uses. */
interface ElectronIpcRenderer {
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

/**
 * AppTitlebarComponent — replaces the native OS titlebar that main.js
 * disables via `frame: false`. Only meaningful inside the Electron desktop
 * shell (see AppComponent.isElectron), never rendered on web/Android/iOS.
 *
 * Talks to main.js over IPC using the SAME security model the rest of the
 * Electron shell already relies on (nodeIntegration: true, contextIsolation:
 * false in main.js's BrowserWindow), i.e. `window.require('electron')` is
 * available directly in the renderer. That model is broader than best
 * practice (a preload script + contextBridge would be tighter), but this
 * component doesn't change that trust boundary — it only adds 3 narrow,
 * argument-less IPC channels (minimize / maximize-toggle / close) on top of
 * it. All electron access below is defensively guarded so this component is
 * a total no-op — not a crash — anywhere `window.require` doesn't exist.
 */
@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './app-titlebar.component.scss',
  template: `
    <div class="app-titlebar">
      <div class="app-titlebar__drag"></div>
      <div class="app-titlebar__controls">
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="minimize()"
          aria-label="Minimize window"
        >
          <i class="fa-solid fa-window-minimize"></i>
        </button>
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="toggleMaximize()"
          [attr.aria-label]="isMaximized ? 'Restore window' : 'Maximize window'"
        >
          <i class="fa-regular" [class.fa-window-restore]="isMaximized" [class.fa-square]="!isMaximized"></i>
        </button>
        <button
          type="button"
          class="app-titlebar__btn app-titlebar__btn--close"
          (click)="close()"
          aria-label="Close window"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `,
})
export class AppTitlebarComponent implements OnInit, OnDestroy {
  isMaximized = false;

  private ipcRenderer: ElectronIpcRenderer | null = null;

  // Bound once so removeListener() in ngOnDestroy actually matches the
  // listener registered in ngOnInit (an inline arrow passed to `on` and a
  // fresh one passed to `removeListener` would never be equal).
  private readonly handleWindowState = (...args: unknown[]): void => {
    const state = args[0] as { maximized?: boolean } | undefined;
    this.isMaximized = !!state?.maximized;
  };

  ngOnInit(): void {
    this.ipcRenderer = this.resolveIpcRenderer();
    this.ipcRenderer?.on('window:state', this.handleWindowState);
  }

  ngOnDestroy(): void {
    this.ipcRenderer?.removeListener('window:state', this.handleWindowState);
  }

  minimize(): void {
    this.ipcRenderer?.send('window:minimize');
  }

  toggleMaximize(): void {
    this.ipcRenderer?.send('window:maximize-toggle');
  }

  close(): void {
    this.ipcRenderer?.send('window:close');
  }

  /** Returns null (never throws) outside the Electron shell. */
  private resolveIpcRenderer(): ElectronIpcRenderer | null {
    const electronRequire = (window as unknown as { require?: (mod: 'electron') => { ipcRenderer: ElectronIpcRenderer } }).require;
    if (typeof electronRequire !== 'function') return null;
    try {
      return electronRequire('electron').ipcRenderer ?? null;
    } catch {
      return null;
    }
  }
}
