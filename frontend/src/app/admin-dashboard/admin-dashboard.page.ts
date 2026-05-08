import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline } from 'ionicons/icons';
import * as L from 'leaflet'; 

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, HttpClientModule]
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  
  currentRole: string | null = '';
  apiUrl = 'http://127.0.0.1:8000/api';
  
  activeRequests: any[] = [];
  archivedRequests: any[] = [];
  availableResponders: any[] = [];
  availableVehicles: any[] = [];
  filteredVehicles: any[] = []; 
  
  viewMode: 'active' | 'archive' = 'active';
  isModalOpen = false;
  isDispatchModalOpen = false;
  selectedRequestId: number | null = null; 
  
  newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };

  map: any;
  mapMarkers: any[] = [];
  pollingInterval: any; // The background timer

  sosIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  constructor(
    private router: Router, 
    private http: HttpClient,
    private toastController: ToastController,
    private menuCtrl: MenuController
  ) {
    addIcons({ logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(true);
    this.loadData();

    // START POLLING: Checks DB every 5 seconds
    this.pollingInterval = setInterval(() => {
      this.pollActiveEmergencies();
    }, 5000);
  }

  ionViewWillLeave() {
    // Stop polling if they leave the page to save battery/memory!
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  loadData() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => {
      this.activeRequests = res;
      this.plotMarkers();
    });
    this.http.get(`${this.apiUrl}/archived-emergencies`).subscribe((res: any) => this.archivedRequests = res);
    this.http.get(`${this.apiUrl}/dispatch-assets`).subscribe((res: any) => {
      this.availableResponders = res.responders;
      this.availableVehicles = res.vehicles;
    });
  }

  // The Silent Poller
  pollActiveEmergencies() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => {
      // Only rebuild the map if the amount of emergencies CHANGED. 
      // This stops open popups from closing randomly!
      if (res.length !== this.activeRequests.length) {
        this.activeRequests = res;
        this.plotMarkers();
      } else {
        this.activeRequests = res; // Silently update the list data
      }
    });
  }

  initMap() {
    // ... exact same initMap code ...
    this.map = L.map('dispatch-map', { minZoom: 12 }).setView([15.3014, 120.9274], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (feature) => feature.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));

      const sanIsidroCoords = json.features[0].geometry.coordinates[0];
      const hole = sanIsidroCoords.map((coord: any[]) => [coord[1], coord[0]]);
      L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], hole ], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);

      this.plotMarkers();
    });
  }

  plotMarkers() {
    if (!this.map) return; 
    this.mapMarkers.forEach(marker => this.map.removeLayer(marker));
    this.mapMarkers = [];

    this.activeRequests.forEach(req => {
      const marker = L.marker([req.latitude, req.longitude], { icon: this.sosIcon })
        .bindPopup(`
          <b>${req.incident_name}</b><br>${req.first_name} ${req.last_name}
          <br><img src="http://127.0.0.1:8000/${req.image_proof}" style="max-width:100px; margin-top:5px; border-radius:4px;">
        `)
        .addTo(this.map);
      
      marker.on('click', () => {
        this.selectedRequestId = req.request_id;
        const element = document.getElementById('request-card-' + req.request_id);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      this.mapMarkers.push(marker);
    });
  }

  openDispatchModal(requestId: number) {
    this.dispatchForm.request_id = requestId;
    this.dispatchForm.responder_id = null;
    this.dispatchForm.vehicle_id = null;
    this.filteredVehicles = []; 
    this.isDispatchModalOpen = true;
  }

  onResponderChange() {
    this.dispatchForm.vehicle_id = null; 
    this.filteredVehicles = this.availableVehicles.filter(v => v.responder_id === this.dispatchForm.responder_id);
  }

  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id) return;
    this.http.post(`${this.apiUrl}/dispatch-emergency`, this.dispatchForm).subscribe({
      next: () => {
        this.showToast('Units Dispatched Successfully!', 'success');
        this.isDispatchModalOpen = false;
        this.loadData(); 
      }
    });
  }

  resolveEmergency(requestId: number) {
    this.http.post(`${this.apiUrl}/resolve-emergency`, { request_id: requestId }).subscribe({
      next: () => {
        this.showToast('Emergency Resolved and Archived.', 'medium');
        this.selectedRequestId = null;
        this.loadData(); 
      }
    });
  }

  saveDispatcher() {
    this.http.post(`${this.apiUrl}/create-dispatcher`, this.newDispatcher).subscribe({
      next: () => {
        this.showToast('Dispatcher created successfully!', 'success');
        this.isModalOpen = false; 
        this.newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
      }
    });
  }

  async showToast(msg: string, color: string = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color: color });
    await toast.present();
  }
}