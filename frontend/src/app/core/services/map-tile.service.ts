import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { PMTiles } from 'pmtiles';
import { environment } from '../../../environments/environment';

export interface StreetTileConfig {
  backendTileUrl?: string;
  offlinePmtilesUrl?: string;
  minZoom?: number;
  maxZoom?: number;
  attribution?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapTileService {
  /** Hardcoded zoom limits from lowest to highest level */
  readonly minZoom = 12;
  readonly maxZoom = 19;
  readonly maxNativeZoom = 18;

  readonly defaultOsmTileUrl = (environment as any).mapTileUrl || 'http://159.223.42.159:3000/tiles/osm/{z}/{x}/{y}.png';
  readonly defaultSatelliteTileUrl = (environment as any).satelliteTileUrl || 'http://159.223.42.159:3000/tiles/satellite/{z}/{y}/{x}.jpg';
  readonly defaultPmtilesUrl = (environment as any).offlinePmtilesUrl || 'assets/tiles/san-isidro.pmtiles';

  /**
   * Creates a resilient street tile layer:
   * 1. Targets offline PMTiles first (assets/tiles/san-isidro.pmtiles).
   * 2. If the PMTiles archive is missing, or a specific tile is not in the archive,
   *    it seamlessly falls back to the backend OSM tile server.
   */
  createResilientStreetLayer(config?: StreetTileConfig): L.Layer {
    const minZoom = config?.minZoom ?? this.minZoom;
    const maxZoom = config?.maxZoom ?? this.maxZoom;
    const attribution = config?.attribution ?? '© OpenStreetMap contributors';
    const backendUrl = config?.backendTileUrl || this.defaultOsmTileUrl;
    const pmtilesUrl = config?.offlinePmtilesUrl || this.defaultPmtilesUrl;

    let pmtilesSource: PMTiles | null = null;
    let pmtilesReady = false;
    let pmtilesFailed = false;
    let mimeType = 'image/png';

    try {
      pmtilesSource = new PMTiles(pmtilesUrl);
      pmtilesSource.getHeader()
        .then((header) => {
          pmtilesReady = true;
          if (header.tileType === 2) mimeType = 'image/png';
          else if (header.tileType === 3) mimeType = 'image/jpeg';
          else if (header.tileType === 4) mimeType = 'image/webp';
          else if (header.tileType === 5) mimeType = 'image/avif';
          console.log(`[MapTileService] Offline PMTiles archive ready (${pmtilesUrl}). Zoom: ${header.minZoom}-${header.maxZoom}`);
        })
        .catch(() => {
          pmtilesFailed = true;
          console.warn(`[MapTileService] Offline PMTiles not accessible at ${pmtilesUrl}. Using backend tile server: ${backendUrl}`);
        });
    } catch {
      pmtilesFailed = true;
      console.warn(`[MapTileService] PMTiles init failed. Falling back to backend tile server: ${backendUrl}`);
    }

    const ResilientGridLayer = (L.GridLayer as any).extend({
      createTile(coords: { z: number; x: number; y: number }, done: (err: any, tile: HTMLElement) => void): HTMLElement {
        const tile = document.createElement('img');
        tile.alt = '';
        tile.style.width = '256px';
        tile.style.height = '256px';

        const fallbackSrc = backendUrl
          .replace('{z}', String(coords.z))
          .replace('{x}', String(coords.x))
          .replace('{y}', String(coords.y));

        // If offline PMTiles archive failed or is not available, immediately fetch from backend
        if (pmtilesFailed || !pmtilesSource) {
          tile.src = fallbackSrc;
          tile.onload = () => done(undefined, tile);
          tile.onerror = () => done(undefined, tile);
          return tile;
        }

        const controller = new AbortController();
        (tile as any).cancel = () => controller.abort();

        // Target offline PMTiles first
        pmtilesSource.getZxy(coords.z, coords.x, coords.y, controller.signal)
          .then((resp) => {
            if (resp && resp.data && resp.data.byteLength > 0) {
              const blob = new Blob([resp.data], { type: mimeType });
              const objectUrl = window.URL.createObjectURL(blob);
              tile.src = objectUrl;
              (tile as any)._objectUrl = objectUrl;
              tile.onload = () => done(undefined, tile);
              tile.onerror = () => {
                tile.src = fallbackSrc;
                done(undefined, tile);
              };
            } else {
              // Tile not present in archive -> fallback to backend
              tile.src = fallbackSrc;
              tile.onload = () => done(undefined, tile);
              tile.onerror = () => done(undefined, tile);
            }
            (tile as any).cancel = undefined;
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') {
              // Tile fetch error -> fallback to backend
              tile.src = fallbackSrc;
              tile.onload = () => done(undefined, tile);
              tile.onerror = () => done(undefined, tile);
            }
          });

        return tile;
      },

      _removeTile(key: string) {
        const tile = (this as any)._tiles?.[key];
        if (tile?.el) {
          if (tile.el.cancel) tile.el.cancel();
          if (tile.el._objectUrl) window.URL.revokeObjectURL(tile.el._objectUrl);
        }
        (L.GridLayer.prototype as any)._removeTile.call(this, key);
      }
    });

    return new ResilientGridLayer({
      minZoom,
      maxZoom,
      attribution,
    });
  }

  /**
   * Creates the satellite tile layer, which remains hosted on the backend server.
   */
  createSatelliteLayer(customUrl?: string): L.TileLayer {
    const url = customUrl || this.defaultSatelliteTileUrl;
    return L.tileLayer(url, {
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      maxNativeZoom: this.maxNativeZoom,
      attribution: '© Esri Satellite'
    });
  }
}
