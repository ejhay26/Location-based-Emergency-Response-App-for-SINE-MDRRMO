import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, Renderer2, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { animate, type AnimationPlaybackControls } from 'motion';
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
  imports: [CommonModule, PressFeedbackDirective],
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

  /**
   * Open Item fix (report-page fullscreen map submit button): the parent
   * page's submit button used to sit fixed above this component's own
   * fullscreen overlay from *outside* it, which only visually worked by
   * accident (see the Renderer2 reparenting note on toggleMapExpand below
   * for the actual root cause) and left the bottom ~15% of the fullscreen
   * map as an unstyled dead zone for pin-dragging. Decision: keep the
   * submit action usable while fullscreen, but make it a proper, intentional
   * part of *this* component's own fullscreen chrome — a reserved bottom
   * bar the map never renders under — rather than an incidental overlap.
   */
  @Input() submitLabel = '';
  @Input() submitDisabled = false;
  @Input() submitLoading = false;
  @Output() submitRequested = new EventEmitter<void>();

  @ViewChild('fullscreenOverlay') fullscreenOverlayRef?: ElementRef<HTMLElement>;
  private renderer = inject(Renderer2);
  /** Where the overlay node originally lived in the DOM, so close can put it back before Angular removes it via *ngIf. */
  private overlayOriginalParent: Node | null = null;
  private overlayOriginalNextSibling: Node | null = null;
  /**
   * Where the #report-map Leaflet container originally lived (inside
   * #report-map-slot in the small view), so collapse/cleanup can put the
   * SAME node back rather than creating a second Leaflet instance. A single
   * map is reused across small/fullscreen instead of maintaining two
   * separate Leaflet instances kept in sync — no duplicate init, no extra
   * tile fetches, no visible resize flinch on expand/collapse.
   */
  private mapCanvasOriginalParent: Node | null = null;
  private mapCanvasOriginalNextSibling: Node | null = null;

  map: any;
  sanIsidroPolygon: any[] = [];
  /** Loaded once in initMap() from the same PSA/PSGC-sourced geojson used server-side (see backend/app/Services/BarangayResolver.php) — client-side result is a live preview only, never trusted for what's actually persisted (the backend recomputes independently on submit). */
  private barangayPolygons: { name: string; ring: number[][] }[] = [];
  /** Live-resolved barangay for the crosshair's current position, null while outside every mapped polygon (or outside San Isidro entirely). Read by report.page.ts via ReportCoords.barangayName for the pre-submit confirmation dialog. */
  resolvedBarangayName: string | null = null;

  mapStyle: 'street' | 'satellite' = 'street';
  mapExpanded = false;
  /** True only while the close tween is still playing — keeps the overlay's *ngIf mounted past mapExpanded flipping false, mirroring RevealAnimateDirective's temporary-mount pattern. */
  mapCollapsing = false;
  showMapHint = true;
  private hintTimer: any;
  /** Handle for the overlay's current curtain (clip-path) tween, so a rapid re-tap can stop an in-flight animation cleanly instead of racing it. */
  private overlayAnimControls?: AnimationPlaybackControls;
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
    // Stop any in-flight expand/collapse tween before tearing anything down —
    // an animation still running against a node whose parent map/DOM state
    // is about to be ripped out is exactly the kind of dangling-reference
    // risk RevealAnimateDirective's bug notes warn about (see its ngOnDestroy).
    this.overlayAnimControls?.stop();
    // If the Leaflet container is currently reparented into the fullscreen
    // slot, move it back to its permanent #report-map-slot home BEFORE
    // touching this.map — tryInit() on a future re-entry looks up #report-map
    // via getElementById() there, so it must still exist under its original,
    // persistent parent (not inside the overlay, which is about to be torn
    // down by *ngIf below).
    const mapEl = document.getElementById('report-map');
    if (mapEl && this.mapCanvasOriginalParent) {
      this.renderer.insertBefore(this.mapCanvasOriginalParent, mapEl, this.mapCanvasOriginalNextSibling);
      this.mapCanvasOriginalParent = null;
      this.mapCanvasOriginalNextSibling = null;
    }
    if (this.map) { this.map.remove(); this.map = null; }
    // If the page is being torn down while the reparented overlay node is
    // still sitting under document.body, put it back first — leaving a
    // detached-from-Angular's-expected-location node behind on document.body
    // would leak it past this component's own lifetime.
    if (this.fullscreenOverlayRef && this.overlayOriginalParent) {
      const node = this.fullscreenOverlayRef.nativeElement;
      node.style.clipPath = '';
      this.renderer.insertBefore(this.overlayOriginalParent, node, this.overlayOriginalNextSibling);
      this.overlayOriginalParent = null;
      this.overlayOriginalNextSibling = null;
    }
    clearTimeout(this.hintTimer);
    this.mapExpanded = false;
    this.mapCollapsing = false;
  }

  ngOnDestroy() {
    this.cleanup();
  }

  /**
   * Stage 3 — fullscreen-map expand/collapse animation, locked-container curtain.
   *
   * Superseded two earlier approaches: a FLIP scale-from-rect with buttons
   * flying to a relocated header (not fluid), then a plain opacity fade of
   * the whole panel (too flat — didn't read as the map itself expanding).
   * This version:
   *  - Mounts the overlay at `position:fixed;inset:0` and never moves it —
   *    the container is "locked" for the entire animation, exactly matching
   *    its final on-screen box from frame one.
   *  - Only `clip-path` animates: it starts as a thin horizontal band whose
   *    top/bottom edges sit exactly where the small map's real on-screen
   *    top/bottom edges are (read once via getBoundingClientRect()), then
   *    grows outward to the full viewport. On close it shrinks back into
   *    that same band. This is what makes the top and bottom of the map
   *    visibly push outward/inward like a curtain, while the map content
   *    itself never translates or scales — exactly the requested "the map
   *    stays still, only the visible top/bottom expands."
   *  - No cloneNode/button-flight machinery at all — the Street/Satellite
   *    toggle and submit button now sit inside the fullscreen overlay using
   *    the same markup/position pattern as the small view, so there's
   *    nothing separate to animate into place.
   */
  toggleMapExpand() {
    if (this.mapExpanded) {
      this.collapseMap();
    } else {
      this.expandMap();
    }
  }

  /**
   * Live rect that seeds the curtain's starting/ending clip band — used only
   * to size the clip-path, never for element cloning or flight. This is the
   * UNION of two real, currently-on-screen elements from the small
   * (non-fullscreen) view:
   *  - #report-map-slot — the permanent, never-moved map wrapper.
   *    Deliberately NOT #report-map itself — #report-map is the node that
   *    gets reparented into the fullscreen slot on expand, so during
   *    collapse its live rect would already be the fullscreen-sized box,
   *    not the small one.
   *  - #report-map-toggle-slot — the small-view Street|Satellite bar, which
   *    sits directly beneath the map.
   *
   * Seeding the closed band from BOTH elements' combined footprint (not
   * just the map's) is what makes the fullscreen toggle bar feel like it's
   * riding the same physical curtain as the map, instead of only becoming
   * visible once the growing clip-path happens to reach past it: the toggle
   * bar's real on-screen position is baked into the starting/ending band
   * itself, so it's already inside the visible region from the very first
   * frame and simply grows/shrinks with everything else — no separate
   * opacity/transform tween of its own needed.
   */
  private smallMapRect(): DOMRect | null {
    const mapEl = document.getElementById('report-map-slot');
    if (!mapEl) return null;
    const mapRect = mapEl.getBoundingClientRect();
    const toggleEl = document.getElementById('report-map-toggle-slot');
    if (!toggleEl) return mapRect; // defensive fallback — toggle bar should always be present alongside the map
    const toggleRect = toggleEl.getBoundingClientRect();
    const top = Math.min(mapRect.top, toggleRect.top);
    const left = Math.min(mapRect.left, toggleRect.left);
    const bottom = Math.max(mapRect.bottom, toggleRect.bottom);
    const right = Math.max(mapRect.right, toggleRect.right);
    return new DOMRect(left, top, right - left, bottom - top);
  }

  private expandMap(): void {
    if (this.mapExpanded) return; // already open or already mid-way through opening

    // Capture the small map's rect BEFORE the overlay mounts and steals
    // layout — this seeds the curtain's closed (starting) clip band.
    const srcRect = this.smallMapRect();

    this.mapExpanded = true;
    this.mapCollapsing = false;

    // Wait a frame so Angular has actually mounted the *ngIf'd overlay node
    // before we try to reference/reparent/animate it.
    requestAnimationFrame(() => {
      const node = this.fullscreenOverlayRef?.nativeElement;
      if (!node) return;

      // Root cause of the original Open Item bug: `ion-content` applies CSS
      // `contain` to its scroll viewport, and per spec that also makes it
      // the containing block for any `position:fixed` descendant — so this
      // overlay's `position:fixed;inset:0` was never actually fixed to the
      // real browser viewport, only to ion-content's box. Reparenting the
      // overlay node to document.body escapes the trap entirely — Angular's
      // view/binding system doesn't care where in the DOM a node physically
      // lives. This must happen BEFORE the curtain starts, so the node is
      // already in its final stacking context — and at its final, locked
      // full-viewport box — for the whole animation.
      if (!this.overlayOriginalParent) {
        this.overlayOriginalParent = node.parentNode;
        this.overlayOriginalNextSibling = node.nextSibling;
        this.renderer.appendChild(document.body, node);
      }

      // Reparent the SAME, already-initialized #report-map Leaflet container
      // into the fullscreen slot — no second Leaflet instance is created, so
      // there's no re-init/tile-refetch pass to visibly flinch mid-animation.
      // This happens before the curtain starts, so the map is already laid
      // out at its full fullscreen size for the entire reveal — only the
      // clip-path grows; the map's own content never resizes mid-tween, and
      // invalidateSize() keeps the same geographic center, so the region
      // visible in the small view lines up exactly once revealed.
      const mapEl = document.getElementById('report-map');
      const slotEl = document.getElementById('report-map-fullscreen-slot');
      if (mapEl && slotEl && !this.mapCanvasOriginalParent) {
        this.mapCanvasOriginalParent = mapEl.parentNode;
        this.mapCanvasOriginalNextSibling = mapEl.nextSibling;
        this.renderer.appendChild(slotEl, mapEl);
        if (this.map) { this.map.invalidateSize(); }
      }

      // Fire-and-forget: unlike collapseMap, expandMap doesn't need to react
      // to the curtain settling (no teardown work happens on expand). Still
      // attach a no-op .catch() so an interrupted tween's rejection (e.g. a
      // rapid collapse-tap calling .stop() mid-curtain) never surfaces as an
      // unhandled promise rejection.
      this.playCurtainReveal(node, srcRect, 'in').catch(() => {});
    });
  }

  private collapseMap(): void {
    if (this.mapCollapsing) return; // a close tween is already playing — don't restart it on a duplicate tap
    this.mapCollapsing = true;

    const node = this.fullscreenOverlayRef?.nativeElement;
    if (!node) { this.finishCollapse(); return; }

    // Target is the small map's CURRENT rect — it's still sitting in its
    // normal place behind the overlay the whole time, so this reads its
    // real live position rather than a value cached from expand time.
    const destRect = this.smallMapRect();

    this.playCurtainReveal(node, destRect, 'out')
      .then(() => this.finishCollapse())
      .catch(() => this.finishCollapse()); // interrupted tween must still land on a fully-closed, fully-cleaned-up state
  }

  /**
   * Plays the curtain clip-path tween for one direction and returns a
   * Promise the caller can await/settle on — resolves immediately
   * (already-settled Promise) if `reduce_animations` is on or `rect`
   * couldn't be measured, so callers don't need to special-case either
   * path.
   *
   * Only the vertical insets (top/bottom) animate — left/right stay at 0
   * the whole time, since the small map already spans the full width of
   * its container and only its height differs from the fullscreen target.
   */
  private playCurtainReveal(node: HTMLElement, rect: DOMRect | null, direction: 'in' | 'out'): Promise<void> {
    this.overlayAnimControls?.stop();

    if (!rect || window.innerHeight <= 0) {
      node.style.clipPath = '';
      return Promise.resolve();
    }

    const topPct    = Math.max(0, Math.min(100, (rect.top / window.innerHeight) * 100));
    const bottomPct = Math.max(0, Math.min(100, ((window.innerHeight - rect.bottom) / window.innerHeight) * 100));
    const closedClip = `inset(${topPct}% 0% ${bottomPct}% 0%)`;
    const openClip   = 'inset(0% 0% 0% 0%)';
    const durationSec = direction === 'in' ? 0.32 : 0.26;

    if (!this.userSettings.shouldAnimate()) {
      node.style.clipPath = direction === 'in' ? openClip : closedClip;
      return Promise.resolve();
    }

    if (direction === 'in') {
      // Force the starting frame before tweening — the node just mounted via
      // *ngIf with no inline style yet, so without this it would start from
      // its default CSS (unclipped, full-viewport) and there'd be nothing
      // to visibly animate FROM.
      node.style.clipPath = closedClip;
    }

    return new Promise<void>((resolve, reject) => {
      // Defer to next frame so the browser paints the starting frame first
      // (same pattern as RevealAnimateDirective.playOpen()), rather than
      // jumping straight to the tween with no visible starting state.
      requestAnimationFrame(() => {
        const target = direction === 'in' ? { clipPath: openClip } : { clipPath: closedClip };
        this.overlayAnimControls = animate(node, target, { duration: durationSec, ease: [0.4, 0, 0.2, 1] });
        this.overlayAnimControls.finished
          .then(() => { if (direction === 'in') { node.style.clipPath = ''; } resolve(); })
          .catch(() => reject(new Error('overlay-tween-interrupted')));
      });
    });
  }

  /**
   * Runs once the close tween has finished (or resolved instantly under
   * `reduce_animations`) — moves the single #report-map Leaflet container
   * back to its permanent small-view slot (#report-map-slot), restores the
   * overlay node to its original DOM position, and unmounts it. The map's
   * own content stays untouched throughout — reparenting + invalidateSize()
   * only changes what's visible/laid out, never the underlying Leaflet
   * instance, so there is nothing to re-render or flinch.
   */
  private finishCollapse(): void {
    const mapEl = document.getElementById('report-map');
    if (mapEl && this.mapCanvasOriginalParent) {
      this.renderer.insertBefore(this.mapCanvasOriginalParent, mapEl, this.mapCanvasOriginalNextSibling);
      this.mapCanvasOriginalParent = null;
      this.mapCanvasOriginalNextSibling = null;
      // Deferred one frame purely so invalidateSize() reads the box's final,
      // committed layout rather than racing the just-applied DOM move.
      requestAnimationFrame(() => { if (this.map) this.map.invalidateSize(); });
    }
    const node = this.fullscreenOverlayRef?.nativeElement;
    if (node && this.overlayOriginalParent) {
      // Clear inline animation styles before moving/unmounting so a stale
      // clip-path value can never leak onto the next expand's fresh curtain
      // (a brand-new element instance has no inline style of its own, but
      // reusing the same DOM node — which Angular does here since it's only
      // toggled by mapExpanded||mapCollapsing, not recreated — means
      // whatever was left on it survives across cycles).
      node.style.clipPath = '';
      this.renderer.insertBefore(this.overlayOriginalParent, node, this.overlayOriginalNextSibling);
      this.overlayOriginalParent = null;
      this.overlayOriginalNextSibling = null;
    }
    this.mapExpanded = false;
    this.mapCollapsing = false;
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle) return;
    this.mapStyle = style;
    // Single shared Leaflet instance now covers both small and fullscreen
    // views (the container is reparented, not duplicated — see expandMap/
    // finishCollapse), so swapping layers here already applies regardless of
    // which slot #report-map currently lives in. No separate fullscreen-map
    // branch needed.
    if (this.map) {
      [this.streetLayer, this.satelliteLayer].forEach(l => { if (l) this.map.removeLayer(l); });
      if (style === 'street')    this.streetLayer.addTo(this.map);
      if (style === 'satellite') this.satelliteLayer.addTo(this.map);
    }
  }

  initMap() {
    this.map = L.map('report-map', { minZoom: 13, zoomControl: false }).setView([15.3014, 120.9274], 14);
    // @ts-ignore
    this.streetLayer    = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }),
      // maxZoom capped to match maxNativeZoom (13): this layer's tiles don't
      // exist past z13, and Leaflet's default behavior beyond maxNativeZoom
      // is to keep reusing the last-fetched z13 tile bitmap, scaling it up to
      // fill every zoom level up to maxZoom — a 2^6x stretch at z19, which is
      // what caused the blurry/oversized place-name labels. Setting maxZoom
      // to 13 as well stops the layer from rendering at all past its native
      // resolution instead of upscaling it. Base imagery layer above still
      // zooms to 19 (its own maxNativeZoom of 17 is only a 2-level stretch,
      // not visually distracting the way stretched text is).
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 13, maxNativeZoom: 13, opacity: 0.9 })
    ]);
    if (this.mapStyle === 'satellite') { this.satelliteLayer.addTo(this.map); } else { this.streetLayer.addTo(this.map); }
    // Barangay boundaries — PSA/PSGC-sourced, same file as the backend's copy
    // (see backend/app/Services/BarangayResolver.php). Loaded independently
    // of the San Isidro town boundary below; only used to populate
    // barangayPolygons for the live resolveBarangayName() preview, never
    // rendered as a visible layer.
    this.http.get('assets/data/bgysubmuns-municity-304925000.0.1.json').subscribe((json: any) => {
      this.barangayPolygons = (json.features || [])
        .filter((f: any) => f.geometry?.type === 'Polygon')
        .map((f: any) => ({ name: f.properties.adm4_en, ring: f.geometry.coordinates[0] }));
      // A location may already be resolved (updateCoords ran off the town-
      // boundary load below before this arrives, or vice versa depending on
      // which HTTP response lands first) — recompute once this data is in,
      // so the live preview doesn't stay blank until the next map move.
      if (this.map) { this.updateCoords(); }
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

  /**
   * Resolves (lat, lng) to a barangay name for LIVE PREVIEW ONLY, using the
   * same 9 PSA/PSGC-sourced polygons as the backend's BarangayResolver (see
   * backend/app/Services/BarangayResolver.php — kept in sync manually,
   * same geojson source file). This is never sent to or trusted by the
   * server: submitSos/submitHazard only send latitude/longitude, and the
   * backend recomputes barangay_id independently before persisting. Returns
   * null if the point doesn't fall inside any of the 9 mapped polygons
   * (rare given the ~1.002 area-tiling ratio, but not impossible right at a
   * boundary edge) — the UI shows nothing rather than a wrong guess.
   */
  private resolveBarangayName(lat: number, lng: number): string | null {
    for (const b of this.barangayPolygons) {
      if (this.pointInRing(lat, lng, b.ring)) return b.name;
    }
    return null;
  }

  /**
   * Standard ray-casting point-in-polygon test, shared by isInsideSanIsidro
   * (single town-boundary polygon) and resolveBarangayName (looped over the
   * 9 barangay polygons) — previously duplicated inline in
   * isInsideSanIsidro; extracted here rather than copy-pasted a second time
   * for the barangay loop. `ring` is a closed loop of [lng, lat] pairs
   * (GeoJSON coordinate order), mirroring the backend's identical PHP
   * implementation in BarangayResolver::pointInPolygon().
   */
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
