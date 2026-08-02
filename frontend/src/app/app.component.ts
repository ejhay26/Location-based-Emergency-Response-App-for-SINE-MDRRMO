import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TourOverlayComponent } from './shared/components/index';
import { UserSettingsService } from './core/services/user-settings';
import { LocationService } from './core/services/location';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, TourOverlayComponent],
})
export class AppComponent implements OnInit {
  constructor(
    private settings: UserSettingsService,
    private locationSvc: LocationService,
  ) {}

  ngOnInit() {
    // Only apply persisted DOM settings (dark mode, reduce animations) when
    // the user is already logged in. This prevents dark mode from leaking
    // onto the login/register pages on cold start.
    const user = localStorage.getItem('user');
    if (user) {
      this.settings.applyToDom();
      this.locationSvc.start();
    }
  }
}
