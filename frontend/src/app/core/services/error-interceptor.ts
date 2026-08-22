import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class ErrorInterceptorService implements HttpInterceptor {

  constructor(private toastCtrl: ToastController, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const isStorageFetch = req.url.includes('/storage/');
        const isLogout       = req.url.includes('/logout');
        const isLogin        = req.url.includes('/login');

        let message = '';

        if (!isStorageFetch) {
          if (!navigator.onLine || error.status === 0) {
            // Network error — do NOT log out. May just be offline or ngrok timeout.
            message = 'No network connection. Please check your internet.';
          } else if (error.status === 401 && !isLogout && !isLogin && !ApiService.isLoggingOut) {
            const isApiRequest = req.url.includes('/api/');
            const currentUrl = this.router.url || '';
            if (isApiRequest && !currentUrl.includes('/login') && !currentUrl.includes('/auth')) {
              localStorage.removeItem('api_token');
              localStorage.removeItem('user');
              localStorage.removeItem('role');
              this.router.navigate(['/login']);
              message = 'Your session has expired. Please log in again.';
            }
          } else if (error.status === 502 || error.status === 503) {
            message = 'Server is currently unavailable.';
          } else if (error.status >= 500) {
            message = 'Server error. Please try again later.';
          }
        }

        if (message) {
          // No icon — avoids the ion-icon registration error when
          // Ionicons isn't loaded in the current context.
          this.toastCtrl.create({
            message,
            duration: 4000,
            position: 'top',
            color: 'warning',
          }).then(t => t.present());
        }

        return throwError(() => error);
      })
    );
  }
}
