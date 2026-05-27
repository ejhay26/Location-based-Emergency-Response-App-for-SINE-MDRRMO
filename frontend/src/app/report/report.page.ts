import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
  ToastController, IonTextarea, IonRow, IonCol
} from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import * as L from 'leaflet';
import { ApiService } from '../services/api';

// @ts-ignore
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: any, done: any) {
    const tile = document.createElement('img');
    const url = this.getTileUrl(coords);
    tile.crossOrigin = 'Anonymous';
    if ('caches' in window) {
      caches.open('mdrrmo-offline-map').then(cache => {
        cache.match(url).then(response => {
          if (response) {
            response.blob().then((blob: Blob) => { tile.src = URL.createObjectURL(blob); done(null, tile); });
          } else {
            fetch(url, { mode: 'cors' }).then(net => {
              if (net.ok) cache.put(url, net.clone());
              net.blob().then((blob: Blob) => { tile.src = URL.createObjectURL(blob); done(null, tile); });
            }).catch((err: any) => done(err, tile));
          }
        });
      });
    } else { tile.src = url; done(null, tile); }
    return tile;
  }
});

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
    HttpClientModule, IonTextarea, IonRow, IonCol
  ]
})
export class ReportPage implements OnDestroy {
  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private http      = inject(HttpClient);   // kept ONLY for loading the local GeoJSON asset
  private toastCtrl = inject(ToastController);
  private api       = inject(ApiService);

  map: any;
  sanIsidroPolygon: any[] = [];
  photoPreview: string | null = null;
  evidenceType: 'photo' | 'video' | null = null;
  reportType: 'emergency' | 'hazard' = 'emergency';
  selectedIncidentName = 'None';
  selectedHazardName   = 'None';

  incidentTypes = [
    { id: 1, name: 'Fire',    icon: 'fa-solid fa-fire',                color: '#eb445a' },
    { id: 2, name: 'Flood',   icon: 'fa-solid fa-cloud-showers-heavy', color: '#3880ff' },
    { id: 3, name: 'Medical', icon: 'fa-solid fa-heart-pulse',         color: '#2dd36f' },
    { id: 4, name: 'Crime',   icon: 'fa-solid fa-handcuffs',           color: '#bc6fff' },
    { id: 5, name: 'Others',  icon: 'fa-solid fa-circle-question',     color: '#92949c' }
  ];

  hazardCategories = [
    { id: 'Flooded Street',   name: 'Flooded Street',   icon: 'fa-solid fa-cloud-showers-heavy', color: '#3880ff' },
    { id: 'Road Obstruction', name: 'Road Obstruction', icon: 'fa-solid fa-road-barrier',        color: '#ffc409' },
    { id: 'Downed Wire',      name: 'Downed Wire',      icon: 'fa-solid fa-bolt-lightning',      color: '#e0ac00' },
    { id: 'Fallen Tree',      name: 'Fallen Tree',      icon: 'fa-solid fa-tree',                color: '#2dd36f' },
    { id: 'Others',           name: 'Others',           icon: 'fa-solid fa-circle-question',     color: '#92949c' }
  ];

  reportForm: FormGroup = this.fb.group({
    incident_type_id: [''],
    hazard_type:      [''],
    description:      [''],
    latitude:         ['', Validators.required],
    longitude:        ['', Validators.required],
    image_proof:      ['']
  });

  get crosshairColor(): string { return this.reportType === 'hazard' ? '#ffc409' : '#eb445a'; }
  get isFormReady(): boolean {
    if (!this.reportForm.value.latitude || !this.reportForm.value.longitude) return false;
    return this.reportType === 'emergency'
      ? !!this.reportForm.value.incident_type_id
      : !!this.reportForm.value.hazard_type;
  }

  ionViewDidEnter() {
    this.route.queryParams.subscribe(params => {
      this.reportType = params['type'] === 'hazard' ? 'hazard' : 'emergency';
    });
    setTimeout(() => {
      if (document.getElementById('report-map') && !this.map) this.initMap();
    }, 250);
  }

  ionViewWillLeave() { if (this.map) { this.map.remove(); this.map = null; } }
  ngOnDestroy()      { if (this.map) { this.map.remove(); this.map = null; } }

  selectIncident(type: any) { this.reportForm.patchValue({ incident_type_id: type.id }); this.selectedIncidentName = type.name; }
  selectHazard(cat: any)    { this.reportForm.patchValue({ hazard_type: cat.id });       this.selectedHazardName   = cat.name; }

  async captureEvidence() {
    try {
      const image = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      this.photoPreview = image.dataUrl || null;
      this.evidenceType = 'photo';
      this.reportForm.patchValue({ image_proof: this.photoPreview });
    } catch { document.getElementById('videoInput')?.click(); }
  }

  onVideoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20971520) { this.showToast('Video too large. Max 20MB.', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.evidenceType = 'video';
      this.reportForm.patchValue({ image_proof: this.photoPreview });
    };
    reader.readAsDataURL(file);
  }

  initMap() {
    this.map = L.map('report-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14);
    // @ts-ignore
    new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    // this.http.get() here loads a LOCAL bundled asset file, not an API endpoint
    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, {
        filter: (f) => f.geometry.type !== 'Point',
        style: { color: '#eb445a', weight: 3, fillOpacity: 0 }
      }).addTo(this.map);
      this.sanIsidroPolygon = json.features[0].geometry.coordinates[0];
      const hole = this.sanIsidroPolygon.map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90, -180], [90, -180], [90, 180], [-90, 180]], hole],
        { color: 'transparent', fillColor: '#888', fillOpacity: 0.6 }).addTo(this.map);
      const bounds = boundaryLayer.getBounds();
      this.map.fitBounds(bounds);
      this.map.setMaxBounds(bounds.pad(0.1));
      this.map.options.maxBoundsViscosity = 1.0;
      this.updateCoords();
    });
    this.map.on('moveend', () => this.updateCoords());
  }

  updateCoords() {
    const center = this.map.getCenter();
    if (this.sanIsidroPolygon.length > 0 && !this.isInsideSanIsidro(center.lat, center.lng)) {
      this.reportForm.patchValue({ latitude: '', longitude: '' });
      this.showToast('Move the crosshair inside San Isidro.', 'danger'); return;
    }
    this.reportForm.patchValue({ latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6) });
  }

  async getCurrentLocation() {
    try {
      const pos = await Geolocation.getCurrentPosition();
      this.map.flyTo([pos.coords.latitude, pos.coords.longitude], 16);
    } catch { alert('Please enable location services in your settings.'); }
  }

  isInsideSanIsidro(lat: number, lng: number): boolean {
    if (!this.sanIsidroPolygon?.length) return true;
    const x = lng, y = lat; let inside = false;
    for (let i = 0, j = this.sanIsidroPolygon.length - 1; i < this.sanIsidroPolygon.length; j = i++) {
      const xi = this.sanIsidroPolygon[i][0], yi = this.sanIsidroPolygon[i][1];
      const xj = this.sanIsidroPolygon[j][0], yj = this.sanIsidroPolygon[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }

  submitReport() {
    if (!this.photoPreview) { this.showToast('A photo or video is required as proof.', 'warning'); return; }
    if (!this.isFormReady)  { this.showToast('Please fill out all required fields.', 'warning'); return; }

    const user = JSON.parse(localStorage.getItem('user')!);

    if (this.reportType === 'emergency') {
      this.api.submitSos({
        user_id: user.user_id,
        incident_type_id: this.reportForm.value.incident_type_id,
        description: this.reportForm.value.description,
        latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude,
        proof_file: this.photoPreview
      }).subscribe({
        next: () => { this.showToast('Emergency SOS sent!', 'success'); this.router.navigate(['/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    } else {
      this.api.submitHazard({
        user_id: user.user_id,
        description: this.reportForm.value.description || '',
        hazard_type: this.selectedHazardName,
        latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude,
        proof_file: this.photoPreview
      }).subscribe({
        next: () => { this.showToast('Hazard reported!', 'success'); this.router.navigate(['/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    }
  }
}