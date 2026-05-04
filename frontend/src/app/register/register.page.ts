import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, 
  IonCardHeader, IonCardTitle, IonCardContent, IonItem, 
  IonInput, IonButton, IonText, IonSelect, IonSelectOption, 
  IonBackButton, IonButtons, IonInputPasswordToggle 
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader,
    IonCardTitle, IonCardContent, IonItem, IonInput, IonButton, IonText,
    IonSelect, IonSelectOption, IonBackButton, IonButtons, IonInputPasswordToggle
  ]
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // This will eventually be fetched from your Laravel backend via API
  barangays = [
    { id: 1, name: 'Barangay San Isidro' },
    { id: 2, name: 'Barangay Poblacion' },
    { id: 3, name: 'Barangay San Jose' }
  ];

  registerForm: FormGroup = this.fb.group({
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern('^(09|\\+639)\\d{9}$')]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    barangay_id: ['', [Validators.required]]
  });

  register() {
    if (this.registerForm.valid) {
      console.log('Registration data:', this.registerForm.value);
      // TODO: Connect to api.service.ts
      // this.apiService.register(this.registerForm.value).subscribe(...)
      
      // Navigate back to login upon successful registration
      this.router.navigate(['/login']);
    }
  }
}
