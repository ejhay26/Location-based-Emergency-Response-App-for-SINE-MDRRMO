import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, 
  IonCardContent, IonItem, IonLabel, IonSelect, IonSelectOption, 
  IonButton, IonInput, IonBackButton, IonButtons 
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-sos',
  templateUrl: 'sos.page.html',
  standalone: true,
  imports: [
    ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonCard, IonCardContent, IonItem, IonLabel, IonSelect, 
    IonSelectOption, IonButton, IonInput, IonBackButton, IonButtons
  ]
})
export class SosPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  incidentTypes = [
    { id: 1, name: 'Fire' },
    { id: 2, name: 'Flood' },
    { id: 3, name: 'Medical' },
    { id: 4, name: 'Crime' }
  ];

  sosForm: FormGroup = this.fb.group({
    incident_type_id: ['', [Validators.required]],
    latitude: ['', [Validators.required]],
    longitude: ['', [Validators.required]]
  });

  getCurrentLocation() {
    // Mocking an HTML5 geolocation/capacitor geolocation call
    this.sosForm.patchValue({ latitude: '14.5995', longitude: '120.9842' });
  }

  submitEmergency() {
    if (this.sosForm.valid) {
      console.log('Dispatching SOS:', this.sosForm.value);
      this.router.navigate(['/home']);
    }
  }
}
