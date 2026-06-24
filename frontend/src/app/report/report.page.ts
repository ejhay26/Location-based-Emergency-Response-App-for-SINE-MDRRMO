import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardContent, IonItem, IonButton, IonInput, IonBackButton, IonButtons,
  ToastController, AlertController, IonTextarea, IonRow, IonCol, IonModal
} from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import * as L from 'leaflet';
import { ApiService } from '../services/api';

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
  private fb        = inject(FormBuilder);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private http      = inject(HttpClient);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private api       = inject(ApiService);

  map: any;
  sanIsidroPolygon: any[] = [];
  reportType: 'emergency' | 'hazard' = 'emergency';
  selectedIncidentName = 'None';
  selectedHazardName   = 'None';

  mediaFiles: MediaFile[] = [];
  get canAddMore(): boolean { return this.mediaFiles.length < 2; }
  get hasMedia(): boolean   { return this.mediaFiles.length > 0; }

  // ── Built-in camera state ───────────────────────────────────────────
  showCamera = false;
  cameraMode: 'photo' | 'video' = 'photo';
  cameraStream: MediaStream | null = null;
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  isRecording = false;
  recordingSeconds = 0;
  private recordingTimer: any;
  readonly VIDEO_LIMIT = 10; // seconds

  // ── Cropper state ───────────────────────────────────────────────────
  showCropper = false;
  cropperFile: File | null = null;
  croppedBase64 = '';

  // ── Map style ───────────────────────────────────────────────────────
  mapStyle: 'street' | 'satellite' = 'street';
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

  ionViewDidEnter() {
    this.route.queryParams.subscribe(params => {
      this.reportType = params['type'] === 'hazard' ? 'hazard' : 'emergency';
    });
    setTimeout(() => { if (document.getElementById('report-map') && !this.map) this.initMap(); }, 250);
  }

  ionViewWillLeave() {
    this.stopCameraStream();
    if (this.map) { this.map.remove(); this.map = null; }
  }
  ngOnDestroy() {
    this.stopCameraStream();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  selectIncident(type: any) { this.reportForm.patchValue({ incident_type_id: type.id }); this.selectedIncidentName = type.name; }
  selectHazard(cat: any)    { this.reportForm.patchValue({ hazard_type: cat.id });       this.selectedHazardName   = cat.name; }

  // ── Built-in camera ─────────────────────────────────────────────────
  async openBuiltInCamera(mode: 'photo' | 'video') {
    if (!this.canAddMore) { this.showToast('Maximum 2 files allowed.', 'warning'); return; }
    this.cameraMode = mode;
    this.showCamera = true;
    // Small delay so modal renders before we access the video element
    setTimeout(() => this.startCameraStream(), 150);
  }

  async startCameraStream() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: this.cameraMode === 'video'
      });
      const videoEl = document.getElementById('cameraPreview') as HTMLVideoElement;
      if (videoEl) { videoEl.srcObject = this.cameraStream; videoEl.play(); }
    } catch {
      this.showToast('Camera access denied. Please allow camera permission.', 'danger');
      this.showCamera = false;
    }
  }

  stopCameraStream() {
    clearInterval(this.recordingTimer);
    if (this.mediaRecorder && this.isRecording) { this.mediaRecorder.stop(); }
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; }
    this.isRecording = false;
    this.recordingSeconds = 0;
  }

  closeCamera() {
    this.stopCameraStream();
    this.showCamera = false;
  }

  // ── Photo capture ───────────────────────────────────────────────────
  capturePhoto() {
    const videoEl = document.getElementById('cameraPreview') as HTMLVideoElement;
    const canvas  = document.createElement('canvas');
    canvas.width  = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d')!.drawImage(videoEl, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      this.closeCamera();
      this.openCropper(file);
    }, 'image/jpeg', 0.85);
  }

  // ── Video recording — 10s limit ─────────────────────────────────────
  startRecording() {
    if (!this.cameraStream) return;
    this.recordedChunks = [];
    this.recordingSeconds = 0;
    this.mediaRecorder = new MediaRecorder(this.cameraStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    this.mediaRecorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
    this.mediaRecorder.onstop = () => { this.finaliseVideo(); };
    this.mediaRecorder.start(100); // collect chunks every 100ms
    this.isRecording = true;

    // Countdown timer — auto-stop at VIDEO_LIMIT seconds
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      if (this.recordingSeconds >= this.VIDEO_LIMIT) { this.stopRecording(); }
    }, 1000);
  }

  stopRecording() {
    clearInterval(this.recordingTimer);
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  finaliseVideo() {
    const blob    = new Blob(this.recordedChunks, { type: 'video/webm' });
    const reader  = new FileReader();
    reader.onload = () => {
      this.mediaFiles.push({ preview: reader.result as string, type: 'video' });
      this.closeCamera();
    };
    reader.readAsDataURL(blob);
  }

  // ── Cropper ─────────────────────────────────────────────────────────
  openCropper(file: File) { this.cropperFile = file; this.croppedBase64 = ''; this.showCropper = true; }
  onPhotoCropped(event: ImageCroppedEvent) { this.croppedBase64 = event.base64 || (event as any).objectUrl || ''; }
  confirmCrop() {
    if (!this.croppedBase64) { this.showToast('Please wait for the image to load.', 'warning'); return; }
    this.mediaFiles.push({ preview: this.croppedBase64, type: 'photo' });
    this.showCropper = false; this.cropperFile = null; this.croppedBase64 = '';
  }
  cancelCrop() { this.showCropper = false; this.cropperFile = null; this.croppedBase64 = ''; }

  async removeMedia(index: number) {
    const a = await this.alertCtrl.create({
      header: 'Remove File', message: 'Remove this file?',
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Remove', role: 'destructive', handler: () => { this.mediaFiles.splice(index, 1); } }]
    });
    await a.present();
  }

  // ── Map ──────────────────────────────────────────────────────────────
  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle || !this.map) return;
    [this.streetLayer, this.satelliteLayer].forEach(l => { if (l) this.map.removeLayer(l); });
    this.mapStyle = style;
    if (style === 'street')    this.streetLayer.addTo(this.map);
    if (style === 'satellite') this.satelliteLayer.addTo(this.map);
  }

  initMap() {
    this.map = L.map('report-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14);
    // @ts-ignore
    this.streetLayer    = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8 })
    ]);
    this.streetLayer.addTo(this.map);
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
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') { this.showToast('Location permission denied.', 'danger'); return; }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      this.map.flyTo([pos.coords.latitude, pos.coords.longitude], 17);
    } catch (err: any) {
      this.showToast('Could not get location. Try again or move to open sky.', 'warning');
    }
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
      this.api.submitSos({ user_id: user.user_id, incident_type_id: this.reportForm.value.incident_type_id,
        description: this.reportForm.value.description, latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude, proof_files: proofFiles }).subscribe({
        next: () => { this.showToast('Emergency SOS sent!', 'success'); this.router.navigate(['/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    } else {
      this.api.submitHazard({ user_id: user.user_id, description: this.reportForm.value.description || '',
        hazard_type: this.selectedHazardName, latitude: this.reportForm.value.latitude,
        longitude: this.reportForm.value.longitude, proof_files: proofFiles }).subscribe({
        next: () => { this.showToast('Hazard reported!', 'success'); this.router.navigate(['/home']); },
        error: (err: any) => this.showToast(err.error?.message || 'Submission failed.', 'danger')
      });
    }
  }
}