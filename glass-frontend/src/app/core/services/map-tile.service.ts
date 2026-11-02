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

export interface SatelliteTileConfig {
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
  readonly defaultSatellitePmtilesUrl = (environment as any).offlineSatellitePmtilesUrl || 'assets/tiles/satellite_base.pmtiles';

  /**
   * Creates a resilient street tile layer:
   * 1. Targets offline PMTiles first (assets/tiles/san-isidro.pmtiles or assets/tiles/philippines_vector.pmtiles).
   * 2. If the PMTiles archive is missing, or a specific tile is not in the archive,
   *    it seamlessly falls back to the backend OSM tile server.
   */
  createResilientStreetLayer(config?: StreetTileConfig): L.Layer {
    const minZoom = config?.minZoom ?? this.minZoom;
    const maxZoom = config?.maxZoom ?? this.maxZoom;
    const attribution = config?.attribution ?? '© OpenStreetMap contributors';
    const backendUrl = config?.backendTileUrl || this.defaultOsmTileUrl;
    const pmtilesUrl = config?.offlinePmtilesUrl || this.defaultPmtilesUrl;

    return this.buildResilientLayer(pmtilesUrl, backendUrl, minZoom, maxZoom, attribution, 'image/png');
  }

  /**
   * Creates a resilient satellite tile layer:
   * 1. Targets offline satellite PMTiles first (assets/tiles/satellite_base.pmtiles).
   * 2. If absent or out of bounds, seamlessly falls back to the backend satellite tile server.
   */
  createSatelliteLayer(customUrl?: string, config?: SatelliteTileConfig): L.Layer {
    const minZoom = config?.minZoom ?? this.minZoom;
    const maxZoom = config?.maxZoom ?? this.maxZoom;
    const attribution = config?.attribution ?? '© Esri Satellite';
    const backendUrl = customUrl || config?.backendTileUrl || this.defaultSatelliteTileUrl;
    const pmtilesUrl = config?.offlinePmtilesUrl || this.defaultSatellitePmtilesUrl;

    return this.buildResilientLayer(pmtilesUrl, backendUrl, minZoom, maxZoom, attribution, 'image/jpeg');
  }

  private buildResilientLayer(
    pmtilesUrl: string,
    backendUrl: string,
    minZoom: number,
    maxZoom: number,
    attribution: string,
    defaultMime: string
  ): L.Layer {
    let pmtilesSource: PMTiles | null = null;
    let pmtilesReady = false;
    let pmtilesFailed = false;
    let mimeType = defaultMime;

    try {
      pmtilesSource = new PMTiles(pmtilesUrl);
      pmtilesSource.getHeader()
        .then((header) => {
          pmtilesReady = true;
          if (header.tileType === 2) mimeType = 'image/png';
          else if (header.tileType === 3) mimeType = 'image/jpeg';
          else if (header.tileType === 4) mimeType = 'image/webp';
          else if (header.tileType === 5) mimeType = 'image/avif';
          console.log(`[MapTileService] Offline PMTiles ready (${pmtilesUrl}). Zoom: ${header.minZoom}-${header.maxZoom}`);
        })
        .catch(() => {
          pmtilesFailed = true;
        });
    } catch {
      pmtilesFailed = true;
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

        // If offline archive failed or is not available, immediately fetch from backend
        if (pmtilesFailed || !pmtilesSource) {
          tile.src = fallbackSrc;
          tile.onload = () => done(undefined, tile);
          tile.onerror = () => done(undefined, tile);
          return tile;
        }

        const controller = new AbortController();
        (tile as any).cancel = () => controller.abort();

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
              tile.src = fallbackSrc;
              tile.onload = () => done(undefined, tile);
              tile.onerror = () => done(undefined, tile);
            }
            (tile as any).cancel = undefined;
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') {
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
}
