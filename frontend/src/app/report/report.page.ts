import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
  ToastController, AlertController, ModalController, IonTextarea, IonRow, IonCol, IonModal
} from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import * as L from 'leaflet';
import { ApiService } from '../services/api';
import { TourService } from '../services/tour';
import { UserSettingsService } from '../services/user-settings';
import { LocationService } from '../services/location';
import { VideoTrimmerComponent } from '../components/video-trimmer/video-trimmer.component';

// @ts-ignore
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: any, done: any) {
    const tile = document.createElement('img');
    const url  = this.getTileUrl(coords);
    tile.crossOrigin = 'Anonymous';
    const fetchOptions: RequestInit = {
      mode: 'cors', referrerPolicy: 'no-referrer',
      headers: {
        'User-Agent': 'SINEMDRRMOApp/1.0 (sine-mdrrmo-capstone; contact: ejperez623@gmail.com)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      }
    };
    const loadTile = (blob: Blob) => { tile.src = URL.createObjectURL(blob); done(null, tile); };
    const fetchFresh = () =>
      fetch(url, fetchOptions)
        .then((net: Response) => {
          if (!net.ok) throw new Error(`OSM tile ${net.status}`);
          const clone = net.clone();
          if ('caches' in window) { caches.open('mdrrmo-tile-cache-v1').then((cache: Cache) => cache.put(url, clone)); }
          return net.blob();
        })
        .then(loadTile)
        .catch((err: any) => done(err, tile));
    if ('caches' in window) {
      caches.open('mdrrmo-tile-cache-v1').then((cache: Cache) => {
        cache.match(url).then((cached: Response | undefined) => {
          if (cached) { cached.blob().then(loadTile); } else { fetchFresh(); }
        });
      });
    } else { fetchFresh(); }
    return tile;
  }
});

export interface MediaFile { preview: string; type: 'photo' | 'video'; }

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
    IonTextarea, IonRow, IonCol, IonModal, ImageCropperComponent
  ]
})
export class ReportPage implements OnDestroy {
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private http        = inject(HttpClient);
  private toastCtrl   = inject(ToastController);
  private alertCtrl   = inject(AlertController);
  private modalCtrl   = inject(ModalController);
  private api         = inject(ApiService);
  public  tour        = inject(TourService);
  private userSettings  = inject(UserSettingsService);
  private locationSvc   = inject(LocationService);

  map: any;
  sanIsidroPolygon: any[] = [];
  private sanIsidroGeoJson: any = null;

  reportType: 'emergency' | 'hazard' = 'emergency';

  ngOnInit() {
    const type = this.route.snapshot.queryParamMap.get('type');
    this.reportType = type === 'hazard' ? 'hazard' : 'emergency';
  }

  selectedIncidentName = 'None';
  selectedHazardName   = 'None';

  mediaFiles: MediaFile[] = [];
  get canAddMore(): boolean { return this.mediaFiles.length < 2; }
  get hasMedia(): boolean   { return this.mediaFiles.length > 0; }

  showCropper = false;
  cropperFile: File | null = null;
  croppedBase64 = '';

  mapStyle: 'street' | 'satellite' = 'street';
  mapExpanded = false;
  showMapHint = true;
  private hintTimer: any;
  private fullscreenMap: any = null;
  private streetLayer: any;
  private satelliteLayer: any;

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
    incident_type_id: [''], hazard_type: [''], description: [''],
    latitude: ['', Validators.required], longitude: ['', Validators.required],
  });

  get crosshairColor(): string { return this.reportType === 'hazard' ? '#ffc409' : '#eb445a'; }
  get isFormReady(): boolean {
    if (!this.reportForm.value.latitude || !this.reportForm.value.longitude) return false;
    return this.reportType === 'emergency'
      ? !!this.reportForm.value.incident_type_id
      : !!this.reportForm.value.hazard_type;
  }

  constructor() {}

  ionViewDidEnter() {
    setTimeout(() => {
      if (document.getElementById('report-map') && !this.map) {
        this.mapStyle = this.userSettings.get('map_default_style') as 'street' | 'satellite';
        this.initMap();
      }
    }, 250);
  }

  ionViewWillLeave() {
    if (this.fullscreenMap) { this.fullscreenMap.remove(); this.fullscreenMap = null; }
    if (this.map) { this.map.remove(); this.map = null; }
    clearTimeout(this.hintTimer);
    this.mapExpanded = false;
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    clearTimeout(this.hintTimer);
  }

  selectIncident(type: any) {
    this.reportForm.patchValue({ incident_type_id: type.id });
    this.selectedIncidentName = type.name;
    this.tour.onInteraction();
  }
  selectHazard(cat: any) {
    this.reportForm.patchValue({ hazard_type: cat.id });
    this.selectedHazardName = cat.name;
    this.tour.onInteraction();
  }

  private addBoundaryOverlay(targetMap: any) {
    if (!this.sanIsidroGeoJson) return;
    L.geoJSON(this.sanIsidroGeoJson, {
      filter: (f) => f.geometry.type !== 'Point',
      style: { color: '#eb445a', weight: 3, fillOpacity: 0 }
    }).addTo(targetMap);
    const hole = this.sanIsidroPolygon.map((c: any[]) => [c[1], c[0]]);
    L.polygon([[[-90, -180], [90, -180], [90, 180], [-90, 180]], hole],
      { color: 'transparent', fillColor: '#888', fillOpacity: 0.6 }).addTo(targetMap);
  }

  toggleMapExpand() {
    this.mapExpanded = !this.mapExpanded;

    if (this.mapExpanded) {
      setTimeout(() => {
        const el = document.getElementById('report-map-fullscreen');
        if (!el || this.fullscreenMap) return;
        const center = this.map ? this.map.getCenter() : [15.3014, 120.9274];
        const zoom   = this.map ? this.map.getZoom()   : 14;

        this.fullscreenMap = L.map('report-map-fullscreen', {
          minZoom: 13, zoomControl: true,
          center: center as [number, number], zoom
        });

        const url  = this.mapStyle === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const attr = this.mapStyle === 'satellite' ? 'Tiles &copy; Esri' : '&copy; OpenStreetMap contributors';
        L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(this.fullscreenMap);

        this.addBoundaryOverlay(this.fullscreenMap);

        this.fullscreenMap.on('move', () => {
          if (!this.map) return;
          this.map.setView(this.fullscreenMap.getCenter(), this.fullscreenMap.getZoom(), { animate: false });
          const c = this.fullscreenMap.getCenter();
          this.reportForm.patchValue({ latitude: c.lat.toFixed(6), longitude: c.lng.toFixed(6) });
        });

        this.fullscreenMap.invalidateSize();
      }, 200);
    } else {
      if (this.fullscreenMap) { this.fullscreenMap.remove(); this.fullscreenMap = null; }
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 100);
    }
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle) return;
    this.mapStyle = style;
    if (this.map) {
      [this.streetLayer, this.satelliteLayer].forEach(l => { if (l) this.map.removeLayer(l); });
      if (style === 'street')    this.streetLayer.addTo(this.map);
      if (style === 'satellite') this.satelliteLayer.addTo(this.map);
    }
    if (this.fullscreenMap) {
      this.fullscreenMap.eachLayer((l: any) => this.fullscreenMap.removeLayer(l));
      const url  = style === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attr = style === 'satellite' ? 'Tiles &copy; Esri' : '&copy; OpenStreetMap contributors';
      L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(this.fullscreenMap);
      this.addBoundaryOverlay(this.fullscreenMap);
    }
  }

  initMap() {
    this.map = L.map('report-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14);
    // @ts-ignore
    this.streetLayer    = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 13, opacity: 0.9 })
    ]);

    if (this.mapStyle === 'satellite') {
      this.satelliteLayer.addTo(this.map);
    } else {
      this.streetLayer.addTo(this.map);
    }

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      this.sanIsidroGeoJson = json;
      this.sanIsidroPolygon = json.features[0].geometry.coordinates[0];

      const boundaryLayer = L.geoJSON(json, {
        filter: (f) => f.geometry.type !== 'Point',
        style: { color: '#eb445a', weight: 3, fillOpacity: 0 }
      }).addTo(this.map);

      const hole = this.sanIsidroPolygon.map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90, -180], [90, -180], [90, 180], [-90, 180]], hole],
        { color: 'transparent', fillColor: '#888', fillOpacity: 0.6 }).addTo(this.map);

      const bounds = boundaryLayer.getBounds();
      this.map.fitBounds(bounds);
      this.map.setMaxBounds(bounds.pad(0.1));
      this.map.options.maxBoundsViscosity = 1.0;
      this.updateCoords();

      // If the background watch already has a fix, fly to it immediately — no GPS wait.
      // Falls back to the default center if no cached position exists yet.
      const cached = this.locationSvc.cachedPosition;
      if (cached && this.map) {
        this.map.flyTo([cached.lat, cached.lng], 17);
      }
    });

    this.map.on('moveend', () => this.updateCoords());
    this.showMapHint = true;
    this.hintTimer = setTimeout(() => { this.showMapHint = false; }, 3000);
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
    // Separate try/catch for permission: on some Android builds requestPermissions()
    // throws when permission was already granted, which we should treat as granted.
    let permDenied = false;
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') { permDenied = true; }
    } catch { /* already granted — continue */ }

    if (permDenied) {
      this.showToast('Location permission denied. Enable it in app settings.', 'danger'); return;
    }

    // Try high-accuracy first; fall back to low-accuracy on timeout (cold GPS chip).
    let pos: any = null;
    try {
      pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    } catch (highErr: any) {
      const isTimeout = highErr?.message?.toLowerCase().includes('timeout') || highErr?.code === 3;
      if (isTimeout) {
        try {
          pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
        } catch {
          this.showToast('Could not get location. Check that GPS is enabled.', 'warning'); return;
        }
      } else {
        this.showToast('Could not get location. Check that GPS is enabled.', 'warning'); return;
      }
    }

    if (this.map) { this.map.flyTo([pos.coords.latitude, pos.coords.longitude], 17); }

    // Update the service cache so future page opens benefit from this fresh fix.
    this.locationSvc.cachedPosition = {
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy, timestamp: pos.timestamp,
    };
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

  // ── Photo ────────────────────────────────────────────────────────────
  async takePhoto() {
    if (!this.canAddMore) { this.showToast('Maximum 2 files allowed.', 'warning'); return; }
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
      const result = await Camera.getPhoto({
        quality: 80, allowEditing: false,
        resultType: CameraResultType.DataUrl, source: CameraSource.Camera
      });
      if (!result.dataUrl) return;
      const res  = await fetch(result.dataUrl);
      const blob = await res.blob();
      this.openCropper(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    } catch { /* cancelled or permission denied */ }
  }

  // ── Video ────────────────────────────────────────────────────────────
  triggerVideo() {
    if (!this.canAddMore) { this.showToast('Maximum 2 files allowed.', 'warning'); return; }
    document.getElementById('videoInput')?.click();
  }

  async onVideoSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';
    if (file.size > 200 * 1024 * 1024) { this.showToast('Video file is too large.', 'warning'); return; }
    const modal = await this.modalCtrl.create({
      component: VideoTrimmerComponent,
      componentProps: { videoBlob: file },
      cssClass: 'video-trimmer-modal'
    });
    this.tour.modalOpen.set(true);
    await modal.present();
    const { data } = await modal.onDidDismiss();
    this.tour.modalOpen.set(false);
    if (data?.dataUrl) { this.mediaFiles.push({ preview: data.dataUrl, type: 'video' }); }
  }

  // ── Cropper ──────────────────────────────────────────────────────────
  openCropper(file: File) {
    this.cropperFile = file;
    this.croppedBase64 = '';
    this.showCropper = true;
    this.tour.modalOpen.set(true);
  }

  onPhotoCropped(event: ImageCroppedEvent) {
    this.croppedBase64 = event.base64 && event.base64.includes(';base64,') ? event.base64 : '';
  }

  confirmCrop() {
    if (!this.croppedBase64) {
      this.showToast('Image is still processing. Please wait a moment and try cropping again.', 'warning');
      return;
    }
    this.mediaFiles.push({ preview: this.croppedBase64, type: 'photo' });
    this.showCropper = false;
    this.cropperFile = null;
    this.croppedBase64 = '';
    this.tour.modalOpen.set(false);
  }

  cancelCrop() {
    this.showCropper = false;
    this.cropperFile = null;
    this.croppedBase64 = '';
    this.tour.modalOpen.set(false);
  }

  async removeMedia(index: number) {
    const a = await this.alertCtrl.create({
      header: 'Remove File', message: 'Remove this file?',
      buttons: [{ text: 'Cancel', role: 'cancel' },
                { text: 'Remove', role: 'destructive', handler: () => { this.mediaFiles.splice(index, 1); } }]
    });
    await a.present();
  }

  async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }

  async submitReport() {
    if (!this.hasMedia) { this.showToast('At least one photo or video is required.', 'warning'); return; }
    if (!this.isFormReady) { this.showToast('Please fill out all required fields.', 'warning'); return; }
    const label = this.reportType === 'emergency' ? 'Send Emergency SOS' : 'Submit Hazard Report';
    const msg   = this.reportType === 'emergency'
      ? 'Only submit for real emergencies. False reports are legally actionable.'
      : 'Are you sure you want to submit this hazard report?';
    const confirmed = await new Promise<boolean>(resolve => {
      this.alertCtrl.create({
        header: label, message: msg,
        buttons: [{ text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
                  { text: 'Confirm', role: 'destructive', handler: () => resolve(true) }]
      }).then(a => { a.present(); a.onDidDismiss().then(r => resolve(r.role === 'destructive')); });
    });
    if (!confirmed) return;
    const user       = JSON.parse(localStorage.getItem('user')!);
    const proofFiles = this.mediaFiles.map(m => m.preview);
    if (this.reportType === 'emergency') {
      this.api.submitSos({
        user_id: user.user_id, incident_type_id: this.reportForm.value.incident_type_id,
        description: this.reportForm.value.description, latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude, proof_files: proofFiles
      }).subscribe({
        next: () => { this.showToast('Emergency SOS sent!', 'success'); this.router.navigate(['/tabs/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    } else {
      this.api.submitHazard({
        user_id: user.user_id, description: this.reportForm.value.description || '',
        hazard_type: this.selectedHazardName, latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude, proof_files: proofFiles
      }).subscribe({
        next: () => { this.showToast('Hazard reported!', 'success'); this.router.navigate(['/tabs/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    }
  }
}
