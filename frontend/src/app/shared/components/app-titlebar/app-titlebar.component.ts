import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

/** Minimal shape of Electron's ipcRenderer that this component uses. */
interface ElectronIpcRenderer {
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './app-titlebar.component.scss',
  template: `
    <div class="app-titlebar" [class.red-header]="isRedHeader">
      <div class="app-titlebar__drag"></div>
      <div class="app-titlebar__controls" (mousedown)="$event.stopPropagation()">
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="minimize($event)"
          (mousedown)="$event.stopPropagation()"
          aria-label="Minimize window"
          title="Minimize"
        >
          <i class="fa-solid fa-minus"></i>
        </button>
        <button
          type="button"
          class="app-titlebar__btn"
          (click)="toggleMaximize($event)"
          (mousedown)="$event.stopPropagation()"
          [attr.aria-label]="isMaximized ? 'Restore window' : 'Maximize window'"
          [title]="isMaximized ? 'Restore' : 'Maximize'"
        >
          <i class="fa-regular" [class.fa-clone]="isMaximized" [class.fa-square]="!isMaximized"></i>
        </button>
        <button
          type="button"
          class="app-titlebar__btn app-titlebar__btn--close"
          (click)="close($event)"
          (mousedown)="$event.stopPropagation()"
          aria-label="Close window"
          title="Close"
        >
          <i class="fa-solid fa-xmark"></i>
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

  private readonly handleWindowState = (...args: unknown[]): void => {
    const state = args[0] as { maximized?: boolean } | undefined;
    this.isMaximized = !!state?.maximized;
  };

  ngOnInit(): void {
    this.ipc = this.resolveIpcRenderer();
    this.ipc?.on('window:state', this.handleWindowState);

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
  }

  private updateHeaderState(url: string): void {
    const isAuth = url.includes('/login') || url.includes('/register') || url.includes('/welcome');
    const isCitizen = url.includes('/tabs') || url.includes('/report');
    this.isRedHeader = isAuth || isCitizen;
  }

  minimize(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    const ipc = this.ipc || this.resolveIpcRenderer();
    ipc?.send('window:minimize');
  }

  toggleMaximize(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    const ipc = this.ipc || this.resolveIpcRenderer();
    ipc?.send('window:maximize-toggle');
  }

  close(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
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
}
