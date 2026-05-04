import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, 
  IonCardHeader, IonCardTitle, IonCardContent, IonItem, 
  IonInput, IonButton, IonText, IonInputPasswordToggle 
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, 
    IonCardHeader, IonCardTitle, IonCardContent, IonItem, 
    IonInput, IonButton, IonText, IonInputPasswordToggle
  ]
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  login() {
    if (this.loginForm.valid) {
      console.log('Login credentials:', this.loginForm.value);
      // TODO: Connect to api.service.ts
      // this.apiService.login(this.loginForm.value).subscribe(...)
      
      // Navigate to the Citizen Dashboard on success
      this.router.navigate(['/home']);
    }
  }
}
