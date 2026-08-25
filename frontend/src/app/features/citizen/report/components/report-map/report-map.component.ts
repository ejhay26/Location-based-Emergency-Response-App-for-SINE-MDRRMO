import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { LocationService } from '../../../../../core/services/location';
import { TourService } from '../../../../../core/services/tour';
import { PressFeedbackDirective } from '../../../../../shared/directives/press-feedback.directive';

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

export interface ReportCoords { latitude: string; longitude: string; barangayName: string | null; }

/**
 * ReportMapComponent — Clean, stable Leaflet map component with inline and fullscreen support.
 * 
 * Never mutates or reparents DOM elements outside the component view tree. Fullscreen is managed
 * purely via CSS class toggles (`.is-fullscreen`), guaranteeing 100% stability across all routes,
 * modals, and widget deep-link entry points.
 */
@Component({
  selector: 'app-report-map',
  standalone: true,
  imports: [CommonModule, PressFeedbackDirective],
  templateUrl: './report-map.component.html',
})
export class ReportMapComponent implements OnDestroy {
  private http         = inject(HttpClient);
  private toastCtrl    = inject(ToastController);
  private userSettings = inject(UserSettingsService);
  private locationSvc  = inject(LocationService);
  public  tour         = inject(TourService);

  @Input() reportType: 'emergency' | 'hazard' = 'emergency';
  @Output() coordsChanged = new EventEmitter<ReportCoords | null>();

  @Input() submitLabel = '';
  @Input() submitDisabled = false;
  @Input() submitLoading = false;
  @Output() submitRequested = new EventEmitter<void>();

  map: any;
  sanIsidroPolygon: any[] = [];
  private barangayPolygons: { name: string; ring: number[][] }[] = [];
  resolvedBarangayName: string | null = null;

  mapStyle: 'street' | 'satellite' = 'street';
  mapExpanded = false;
  showMapHint = true;
  private hintTimer: any;
  private streetLayer: any;
  private satelliteLayer: any;
  private bgyLabelsLayer: any;

  get crosshairColor(): string { return this.reportType === 'hazard' ? '#ffc409' : '#eb445a'; }

  /** Called by the parent page's ionViewDidEnter (after settle delay). */
  tryInit() {
    if (document.getElementById('report-map') && !this.map) {
      this.mapStyle = this.userSettings.get('map_default_style') as 'street' | 'satellite';
      this.initMap();
    }
  }

  /** Called by parent ionViewWillLeave / ngOnDestroy. */
  cleanup() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    clearTimeout(this.hintTimer);
    this.mapExpanded = false;
  }

  ngOnDestroy() {
    this.cleanup();
  }

  toggleMapExpand() {
    this.mapExpanded = !this.mapExpanded;
    if (this.map) {
      this.map.invalidateSize();
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 60);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 180);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 350);
    }
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle) return;
    this.mapStyle = style;
    if (this.map) {
      [this.streetLayer, this.satelliteLayer].forEach(l => { if (l && this.map.hasLayer(l)) this.map.removeLayer(l); });
      if (style === 'street') {
        this.streetLayer.addTo(this.map);
      }
      if (style === 'satellite') {
        this.satelliteLayer.addTo(this.map);
      }
      if (this.bgyLabelsLayer && !this.map.hasLayer(this.bgyLabelsLayer)) {
        this.bgyLabelsLayer.addTo(this.map);
      }
    }
  }

  initMap() {
    this.map = L.map('report-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14);
    // @ts-ignore
    this.streetLayer = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: '© Esri' });

    if (this.mapStyle === 'street') {
      this.streetLayer.addTo(this.map);
    } else {
      this.satelliteLayer.addTo(this.map);
    }

    // Local GeoJSON layers loaded directly from project assets
    this.http.get('assets/data/bgysubmuns-municity-304925000.0.1.json').subscribe((json: any) => {
      this.barangayPolygons = (json.features || [])
        .filter((f: any) => f.geometry?.type === 'Polygon')
        .map((f: any) => ({ name: f.properties.adm4_en, ring: f.geometry.coordinates[0] }));

      const labelMarkers: any[] = [];
      (json.features || []).forEach((f: any) => {
        if (f.geometry?.type === 'Polygon' && f.geometry.coordinates[0]?.length) {
          const coords = f.geometry.coordinates[0];
          let latSum = 0; let lngSum = 0;
          coords.forEach((c: number[]) => { lngSum += c[0]; latSum += c[1]; });
          const centroid: [number, number] = [latSum / coords.length, lngSum / coords.length];
          const bgyName = f.properties.adm4_en || 'Barangay';

          const marker = L.marker(centroid, {
            icon: L.divIcon({
              className: 'bgy-clean-label-icon',
              html: `<div class="bgy-map-badge"><span class="bgy-map-badge__dot"></span><span>${bgyName}</span></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            }),
            interactive: false
          });
          labelMarkers.push(marker);
        }
      });

      const bgyBorder = L.geoJSON(json, {
        style: { color: 'rgba(211, 47, 47, 0.4)', weight: 1.5, dashArray: '4,4', fillOpacity: 0.02, fillColor: '#D32F2F' }
      });
      this.bgyLabelsLayer = L.layerGroup([bgyBorder, ...labelMarkers]);
      if (this.map) {
        this.bgyLabelsLayer.addTo(this.map);
        this.updateCoords();
      }
    });

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      this.sanIsidroPolygon = json.features[0].geometry.coordinates[0];
      const boundaryLayer = L.geoJSON(json, { filter: (f) => f.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      const hole = this.sanIsidroPolygon.map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90, -180], [90, -180], [90, 180], [-90, 180]], hole], { color: 'transparent', fillColor: '#888', fillOpacity: 0.6 }).addTo(this.map);
      const bounds = boundaryLayer.getBounds();
      this.map.fitBounds(bounds); this.map.setMaxBounds(bounds.pad(0.1)); this.map.options.maxBoundsViscosity = 1.0;
      this.updateCoords();
      const cached = this.locationSvc.cachedPosition;
      if (cached && this.map) { this.map.flyTo([cached.lat, cached.lng], 17); }
    });

    this.map.on('moveend', () => this.updateCoords());
    this.showMapHint = true;
    this.hintTimer = setTimeout(() => { this.showMapHint = false; }, 3000);
  }

  updateCoords() {
    if (!this.map) return;
    const center = this.map.getCenter();
    if (this.sanIsidroPolygon.length > 0 && !this.isInsideSanIsidro(center.lat, center.lng)) {
      this.resolvedBarangayName = null;
      this.coordsChanged.emit(null);
      this.showToast('Move the crosshair inside San Isidro.', 'danger');
      return;
    }
    this.resolvedBarangayName = this.resolveBarangayName(center.lat, center.lng);
    this.coordsChanged.emit({ latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6), barangayName: this.resolvedBarangayName });
  }

  async getCurrentLocation() {
    let permDenied = false;
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') { permDenied = true; }
    } catch { /* already granted */ }
    if (permDenied) { this.showToast('Location permission denied. Enable it in app settings.', 'danger'); return; }
    let pos: any = null;
    try { pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 }); }
    catch (highErr: any) {
      const isTimeout = highErr?.message?.toLowerCase().includes('timeout') || highErr?.code === 3;
      if (isTimeout) {
        try { pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 }); }
        catch { this.showToast('Could not get location. Check that GPS is enabled.', 'warning'); return; }
      } else { this.showToast('Could not get location. Check that GPS is enabled.', 'warning'); return; }
    }
    if (this.map) { this.map.flyTo([pos.coords.latitude, pos.coords.longitude], 17); }
    this.locationSvc.cachedPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp };
  }

  isInsideSanIsidro(lat: number, lng: number): boolean {
    if (!this.sanIsidroPolygon?.length) return true;
    return this.pointInRing(lat, lng, this.sanIsidroPolygon as number[][]);
  }

  private resolveBarangayName(lat: number, lng: number): string | null {
    for (const b of this.barangayPolygons) {
      if (this.pointInRing(lat, lng, b.ring)) return b.name;
    }
    return null;
  }

  private pointInRing(lat: number, lng: number, ring: number[][]): boolean {
    const x = lng, y = lat;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  private async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
