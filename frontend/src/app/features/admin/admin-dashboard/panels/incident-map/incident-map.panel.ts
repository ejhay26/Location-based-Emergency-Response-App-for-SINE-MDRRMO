import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonCard, IonCardContent, IonButton, IonRadioGroup, IonRadio, IonModal,
  IonHeader, IonToolbar, IonTitle, IonButtons, IonContent
} from '@ionic/angular/standalone';
import * as L from 'leaflet';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { VideoThumbnailDirective } from '../../../../../shared/directives/video-thumbnail.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';

// @ts-ignore — tile layer with local cache-first fetch (unchanged from the original monolith)
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

@Component({
  selector: 'app-incident-map-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonCard, IonCardContent, IonButton, IonRadioGroup, IonRadio, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, ProxyImageDirective, VideoThumbnailDirective, UtcDatePipe],
  templateUrl: './incident-map.panel.html',
  styleUrl: './incident-map.panel.scss',
})
export class IncidentMapPanel implements OnChanges, AfterViewInit, OnDestroy {

  /** Which list is shown in the right-hand column — the map itself always shows both layers. */
  @Input() mode: 'active' | 'hazards' = 'active';

  activeRequests: any[] = [];
  activeHazards: any[] = [];
  availableResponders: any[] = [];
  availableVehicles: any[] = [];
  filteredVehicles: any[] = [];

  selectedRequestId: number | null = null;
  previewType: 'emergency' | 'hazard' | null = null;

  mapStyle: 'street' | 'satellite' = 'street';
  private map: any;
  private mapMarkers: any[] = [];
  private streetLayer: any;
  private satelliteLayer: any;
  private pollingInterval: any;

  isDispatchModalOpen = false;
  isDispatching = false;
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };

  constructor(private http: HttpClient, public api: ApiService, public ui: AdminUiService) {}

  ngOnChanges(changes: SimpleChanges) {
    // Re-fit the map container size when switching between active/hazards,
    // since the surrounding layout doesn't remount this component.
    if (changes['mode'] && this.map) {
      setTimeout(() => this.map.invalidateSize(), 200);
    }
  }

  ngAfterViewInit() {
    this.loadData();
    setTimeout(() => this.initMap(), 250);
    this.pollingInterval = setInterval(() => this.pollActiveEmergencies(), 5000);
  }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  loadData() {
    this.api.getActiveEmergencies().subscribe((res: any) => { this.activeRequests = res; this.plotMarkers(); });
    this.api.getActiveHazards().subscribe((res: any)     => { this.activeHazards  = res; this.plotMarkers(); });
    this.api.getDispatchAssets().subscribe((res: any)    => { this.availableResponders = res.responders; this.availableVehicles = res.vehicles; });
  }

  pollActiveEmergencies() {
    this.api.getActiveEmergencies().subscribe((res: any) => {
      if (res.length !== this.activeRequests.length) { this.activeRequests = res; this.loadData(); }
      else { this.activeRequests = res; }
    });
  }

  /** Called by the shell after the sidebar collapse/expand transition finishes,
   * since resizing the flex layout doesn't fire a window 'resize' event that
   * Leaflet would pick up on its own. */
  invalidateMapSize() {
    if (!this.map) return;
    setTimeout(() => this.map.invalidateSize(), 260);
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle || !this.map) return;
    [this.streetLayer, this.satelliteLayer].forEach(l => { if (l) this.map.removeLayer(l); });
    this.mapStyle = style;
    if (style === 'street')    this.streetLayer.addTo(this.map);
    if (style === 'satellite') this.satelliteLayer.addTo(this.map);
  }

  initMap() {
    if (this.map) return;
    this.map = L.map('dispatch-map', { minZoom: 12, zoomControl: true }).setView([15.3014, 120.9274], 13);
    // @ts-ignore
    this.streetLayer    = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 13, opacity: 0.9 })
    ]);
    this.streetLayer.addTo(this.map);
    this.map.on('popupopen',  (e: any) => { document.getElementById('dispatch-map')?.classList.add('map-has-selection');    if (e.popup._source?._icon) e.popup._source._icon.classList.add('selected-pin'); });
    this.map.on('popupclose', (e: any) => { document.getElementById('dispatch-map')?.classList.remove('map-has-selection'); if (e.popup._source?._icon) e.popup._source._icon.classList.remove('selected-pin'); setTimeout(() => { this.selectedRequestId = null; this.previewType = null; }); });
    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (f) => f.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));
      const hole = json.features[0].geometry.coordinates[0].map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90,-180],[90,-180],[90,180],[-90,180]], hole], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      this.plotMarkers();
    });
  }

  plotMarkers() {
    if (!this.map) return;
    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];
    const iconConfig: any = {
      'Fire':    { class: 'fa-solid fa-fire',                color: '#eb445a' },
      'Flood':   { class: 'fa-solid fa-cloud-showers-heavy', color: '#3880ff' },
      'Medical': { class: 'fa-solid fa-heart-pulse',         color: '#2dd36f' },
      'Crime':   { class: 'fa-solid fa-handcuffs',           color: '#bc6fff' }
    };
    this.activeRequests.forEach(req => {
      const cfg        = iconConfig[req.incident_name] || { class: 'fa-solid fa-triangle-exclamation', color: '#eb445a' };
      const pulseClass = req.status === 'Pending' ? 'sos-pulse-ripple' : '';
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper ${pulseClass}"><svg viewBox="0 0 30 42" class="vector-pin-shape"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#eb445a"/><circle cx="15" cy="15" r="10" fill="white"/></svg><i class="${cfg.class} pin-inner-fa-icon" style="color:${cfg.color};"></i></div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#eb445a;font-size:18px;font-weight:bold;margin:0 0 8px 0;border-bottom:2px solid #eb445a20;padding-bottom:4px;">${req.incident_name.toUpperCase()} EMERGENCY</h2>
        <p style="font-size:15px;margin:4px 0;"><b>Citizen:</b> ${req.first_name} ${req.last_name}</p>
        <p style="font-size:15px;margin:4px 0;"><b>Contact:</b> ${req.phone}</p>
        <p style="font-size:13px;margin:4px 0;color:gray;background:var(--ion-color-light);padding:4px;border-radius:4px;"><b>Coords:</b> ${req.latitude}, ${req.longitude}</p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button onclick="window.dispatchEvent(new CustomEvent('map-dispatch',{detail:${req.request_id}}))" style="background:#ffc409;color:black;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">DISPATCH UNIT</button>
          <button onclick="window.dispatchEvent(new CustomEvent('map-resolve',{detail:${req.request_id}}))"  style="background:#2dd36f;color:white;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">RESOLVE</button>
        </div></div>`;
      const marker = L.marker([req.latitude, req.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = req.request_id; this.previewType = 'emergency';
        setTimeout(() => { document.getElementById('request-card-' + req.request_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
    window.addEventListener('map-dispatch', (e: any) => { this.map.closePopup(); this.openDispatchModal(e.detail); }, { once: true });
    window.addEventListener('map-resolve',  (e: any) => { this.map.closePopup(); this.resolveEmergency(e.detail); }, { once: true });

    this.activeHazards.forEach(haz => {
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper"><svg viewBox="0 0 30 42" class="vector-pin-shape"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#ffc409"/><circle cx="15" cy="15" r="10" fill="white"/></svg><i class="fa-solid fa-road-barrier pin-inner-fa-icon" style="color:#e0ac00;"></i></div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#e0ac00;font-size:17px;font-weight:bold;margin:0 0 6px 0;border-bottom:2px solid #ffc40930;padding-bottom:4px;">⚠️ PUBLIC HAZARD LOG</h2>
        <p style="font-size:15px;margin:4px 0;line-height:1.4;background:var(--ion-color-light);padding:8px;border-radius:6px;border-left:4px solid #ffc409;">"${haz.description}"</p>
        <p style="font-size:12px;color:gray;margin:6px 0 0 0;">Reported by: ${haz.first_name} ${haz.last_name}</p></div>`;
      const marker = L.marker([haz.latitude, haz.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = haz.hazard_id; this.previewType = 'hazard';
        setTimeout(() => { document.getElementById('hazard-card-' + haz.hazard_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
  }

  openDispatchModal(requestId: number) { this.dispatchForm.request_id = requestId; this.dispatchForm.responder_id = null; this.dispatchForm.vehicle_id = null; this.filteredVehicles = []; this.isDispatchModalOpen = true; }
  onResponderChange() { this.filteredVehicles = this.availableVehicles.filter((v: any) => v.responder_id === this.dispatchForm.responder_id); }

  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id || this.isDispatching) return;
    this.isDispatching = true;
    this.api.dispatchEmergency(this.dispatchForm).subscribe({
      next: () => {
        this.isDispatching = false;
        this.ui.showToast('Units dispatched!', 'success');
        this.isDispatchModalOpen = false;
        this.loadData();
      },
      error: () => { this.isDispatching = false; this.ui.showToast('Dispatch failed.', 'danger'); }
    });
  }

  resolveEmergency(requestId: number) {
    this.ui.showConfirm({ title: 'Resolve Emergency', message: 'Mark this emergency as resolved? It will be moved to the archive.', icon: 'fa-solid fa-circle-check', iconColor: '#2dd36f', confirmLabel: 'Resolve', confirmColor: '#2dd36f',
      action: () => { this.api.resolveEmergency({ request_id: requestId }).subscribe({ next: () => { this.ui.showToast('Emergency resolved and archived.', 'medium'); this.loadData(); } }); }
    });
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.ui.showConfirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'fa-solid fa-triangle-exclamation', iconColor: '#eb445a', confirmLabel: 'Mark False Alarm', confirmColor: '#eb445a',
      action: () => {
        this.api.markFalseAlarm({ request_id: requestId }).subscribe({
          next: (res: any) => { this.ui.showToast(res.message, 'warning'); this.loadData(); },
          error: (err: any) => this.ui.showToast(err.error?.message || 'Failed to mark false alarm.', 'danger')
        });
      }
    });
  }

  dismissHazard(hazardId: number) {
    this.ui.showConfirm({ title: 'Acknowledge Hazard', message: 'Remove this hazard from the map? This confirms it has been addressed.', icon: 'fa-solid fa-road-barrier', iconColor: '#ffc409', confirmLabel: 'Acknowledge', confirmColor: '#ffc409',
      action: () => { this.api.resolveHazard({ hazard_id: hazardId }).subscribe({ next: () => { this.ui.showToast('Hazard acknowledged.', 'medium'); this.loadData(); } }); }
    });
  }
}
