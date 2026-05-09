import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, 
  IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons, ToastController, IonIcon 
} from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { locateOutline, cameraOutline } from 'ionicons/icons';
import * as L from 'leaflet';

@Component({
  selector: 'app-hazard',
  templateUrl: './hazard.page.html',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonCard, IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
    HttpClientModule, IonIcon 
  ]
})
export class HazardPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  apiUrl = 'http://127.0.0.1:8000/api'; 
  map: any;
  sanIsidroPolygon: any[] = []; 
  photoPreview: string | null = null; 

  hazardForm: FormGroup = this.fb.group({
    description: ['', [Validators.required]],
    latitude: ['', [Validators.required]],
    longitude: ['', [Validators.required]],
    image_proof: [''] 
  });

  constructor() { addIcons({ locateOutline, cameraOutline }); }

  ionViewDidEnter() {
    setTimeout(() => {
      const mapContainer = document.getElementById('hazard-map');
      if (mapContainer && !this.map) this.initMap();
    }, 250);
  }

  async takePhoto() {
    try {
      const image = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      this.photoPreview = image.dataUrl || null;
      this.hazardForm.patchValue({ image_proof: this.photoPreview });
    } catch (e) { console.log('Camera cancelled.'); }
  }

  initMap() {
    this.map = L.map('hazard-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (feature) => feature.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.sanIsidroPolygon = json.features[0].geometry.coordinates[0];
      const hole = this.sanIsidroPolygon.map((coord: any[]) => [coord[1], coord[0]]);
      L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], hole ], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      
      const bounds = boundaryLayer.getBounds();
      this.map.fitBounds(bounds);
      this.map.setMaxBounds(bounds.pad(0.1));
      this.map.options.maxBoundsViscosity = 1.0; 
      this.updateFormFromMapCenter();
    });

    this.map.on('moveend', () => this.updateFormFromMapCenter());
  }

  updateFormFromMapCenter() {
    const center = this.map.getCenter();
    if (this.sanIsidroPolygon.length > 0 && !this.isInsideSanIsidro(center.lat, center.lng)) {
      this.hazardForm.patchValue({ latitude: '', longitude: '' }); 
      this.showToast('Invalid Location: Pin must be inside San Isidro.', 'danger');
      return;
    }
    this.hazardForm.patchValue({ latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6) });
  }

  async getCurrentLocation() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      this.map.flyTo([coordinates.coords.latitude, coordinates.coords.longitude], 16);
    } catch (error) { alert('Please enable location services.'); }
  }

  isInsideSanIsidro(lat: number, lng: number): boolean {
    if (!this.sanIsidroPolygon || this.sanIsidroPolygon.length === 0) return true;
    const x = lng, y = lat;
    let inside = false;
    for (let i = 0, j = this.sanIsidroPolygon.length - 1; i < this.sanIsidroPolygon.length; j = i++) {
      const xi = this.sanIsidroPolygon[i][0], yi = this.sanIsidroPolygon[i][1];
      const xj = this.sanIsidroPolygon[j][0], yj = this.sanIsidroPolygon[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  async showToast(msg: string, color: string = 'danger') {
    const toast = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color: color });
    await toast.present();
  }

  submitHazard() {
    if (!this.photoPreview) {
      this.showToast('Photo evidence is required.', 'warning');
      return;
    }

    if (this.hazardForm.valid) {
      const user = JSON.parse(localStorage.getItem('user')!);
      const payload = {
        user_id: user.user_id,
        description: this.hazardForm.value.description,
        latitude: this.hazardForm.value.latitude,
        longitude: this.hazardForm.value.longitude,
        image_proof: this.photoPreview
      };

      this.http.post(`${this.apiUrl}/submit-hazard`, payload).subscribe({
        next: () => {
          this.showToast('Hazard reported successfully!', 'success');
          this.router.navigate(['/home']);
        },
        error: (err) => {
          const errorMsg = err.error.message || 'Failed to report hazard. Please try again.';
          this.showToast(errorMsg, 'danger')}
      });
    }
  }
}