import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class ErrorInterceptorService implements HttpInterceptor {

  constructor(private toastCtrl: ToastController) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        let message = '';

        if (!navigator.onLine || error.status === 0) {
          // No network or server completely unreachable
          message = 'No network connection. Please check your internet.';
        } else if (error.status >= 500) {
          message = 'Server error. Please try again later.';
        } else if (error.status === 503 || error.status === 502) {
          message = 'Server is currently unavailable.';
        }
        // 4xx errors (validation, auth, etc.) are handled per-page — don't intercept them globally

        if (message) {
          this.toastCtrl.create({
            message,
            duration: 4000,
            position: 'top',        // top so it's visible even on login screen
            color: 'warning',
            icon: 'wifi-outline'
          }).then(t => t.present());
        }

        return throwError(() => error); // still propagate so per-page error handlers work
      })
    );
  }
}