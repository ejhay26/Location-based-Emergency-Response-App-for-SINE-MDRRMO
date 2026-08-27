import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';
import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class ErrorInterceptorService implements HttpInterceptor {

  constructor(private toastService: ToastService, private router: Router) {}

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
            message = 'No internet connection detected. Please check your mobile data or Wi-Fi connection.';
          } else if (error.status === 401 && !isLogout && !isLogin && !ApiService.isLoggingOut) {
            const isApiRequest = req.url.includes('/api/');
            const currentUrl = this.router.url || '';
            if (isApiRequest && !currentUrl.includes('/login') && !currentUrl.includes('/auth')) {
              localStorage.removeItem('api_token');
              localStorage.removeItem('user');
              localStorage.removeItem('role');
              this.router.navigate(['/login']);
              message = 'Your session has expired. Please log in again to continue.';
            }
          } else if (error.status === 403) {
            message = 'Access restricted. You do not have permission to perform this action.';
          } else if (error.status === 429) {
            message = 'Too many requests. Please pause for a few seconds before trying again.';
          } else if (error.status === 502 || error.status === 503) {
            message = 'The server is temporarily busy or updating. Please wait a moment and try again.';
          } else if (error.status >= 500) {
            message = 'Server encountered an issue. Please try again in a few moments.';
          }
        }

        if (message) {
          this.toastService.show({
            message,
            duration: 4500,
            position: 'top',
            color: 'warning',
          });
        }

        return throwError(() => error);
      })
    );
  }
}
