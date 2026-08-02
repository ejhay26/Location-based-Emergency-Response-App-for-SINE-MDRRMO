import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { LocationService } from '../../../../../core/services/location';
import { TourService } from '../../../../../core/services/tour';

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

export interface ReportCoords { latitude: string; longitude: string; }

/**
 * ReportMapComponent — Leaflet map, street/satellite toggle, fullscreen
 * overlay, San Isidro boundary polygon, crosshair → coordinates.
 *
 * Ionic page lifecycle hooks (ionViewDidEnter / ionViewWillLeave) are only
 * dispatched by IonRouterOutlet to the routed page component, not to nested
 * children — so the parent report.page still owns those hooks and calls
 * tryInit()/cleanup() on this component via @ViewChild, preserving the exact
 * original 250ms-after-enter init timing and teardown-on-leave behavior.
 */
@Component({
  selector: 'app-report-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-map.component.html',
})
export class ReportMapComponent implements OnDestroy {
  private http           = inject(HttpClient);
  private toastCtrl      = inject(ToastController);
  private userSettings   = inject(UserSettingsService);
  private locationSvc    = inject(LocationService);
  public  tour            = inject(TourService);

  @Input() reportType: 'emergency' | 'hazard' = 'emergency';
  @Output() coordsChanged = new EventEmitter<ReportCoords | null>();

  map: any;
  sanIsidroPolygon: any[] = [];
  private sanIsidroGeoJson: any = null;

  mapStyle: 'street' | 'satellite' = 'street';
  mapExpanded = false;
  showMapHint = true;
  private hintTimer: any;
  private fullscreenMap: any = null;
  private streetLayer: any;
  private satelliteLayer: any;

  get crosshairColor(): string { return this.reportType === 'hazard' ? '#ffc409' : '#eb445a'; }

  /** Called by the parent page's ionViewDidEnter (after its 250ms settle delay). */
  tryInit() {
    if (document.getElementById('report-map') && !this.map) {
      this.mapStyle = this.userSettings.get('map_default_style') as 'street' | 'satellite';
      this.initMap();
    }
  }

  /** Called by the parent page's ionViewWillLeave / ngOnDestroy. */
  cleanup() {
    if (this.fullscreenMap) { this.fullscreenMap.remove(); this.fullscreenMap = null; }
    if (this.map) { this.map.remove(); this.map = null; }
    clearTimeout(this.hintTimer);
    this.mapExpanded = false;
  }

  ngOnDestroy() {
    this.cleanup();
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
        this.fullscreenMap = L.map('report-map-fullscreen', { minZoom: 13, zoomControl: true, center: center as [number, number], zoom });
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
          this.coordsChanged.emit({ latitude: c.lat.toFixed(6), longitude: c.lng.toFixed(6) });
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
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 13, opacity: 0.9 })
    ]);
    if (this.mapStyle === 'satellite') { this.satelliteLayer.addTo(this.map); } else { this.streetLayer.addTo(this.map); }
    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      this.sanIsidroGeoJson = json;
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
    const center = this.map.getCenter();
    if (this.sanIsidroPolygon.length > 0 && !this.isInsideSanIsidro(center.lat, center.lng)) {
      this.coordsChanged.emit(null);
      this.showToast('Move the crosshair inside San Isidro.', 'danger');
      return;
    }
    this.coordsChanged.emit({ latitude: center.lat.toFixed(6), longitude: center.lng.toFixed(6) });
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
    const x = lng, y = lat; let inside = false;
    for (let i = 0, j = this.sanIsidroPolygon.length - 1; i < this.sanIsidroPolygon.length; j = i++) {
      const xi = this.sanIsidroPolygon[i][0], yi = this.sanIsidroPolygon[i][1];
      const xj = this.sanIsidroPolygon[j][0], yj = this.sanIsidroPolygon[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  private async showToast(msg: string, color = 'danger') {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color });
    await t.present();
  }
}
