<?php

namespace App\Http\Controllers\Map;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * TileProxyController
 *
 * Provides a resilient, cached tile proxy for OpenStreetMap (Street) and ArcGIS (Satellite).
 * In production behind Nginx, Nginx intercepts /tiles/ directly for sub-millisecond caching.
 * This controller serves as the application-level fallback for local development or direct API calls.
 */
class TileProxyController extends Controller
{
    private const USER_AGENT = 'SINE-MDRRMO-Emergency-Response-App/1.0 (contact: admin@sine-mdrrmo.gov.ph)';
    private const CACHE_TTL_SECONDS = 5184000; // 60 days

    /**
     * Serve or cache OpenStreetMap tiles.
     * URI: /api/tiles/osm/{z}/{x}/{y}.png
     */
    public function osm(int $z, int $x, int $y)
    {
        // Basic coordinate validation
        $maxCoord = (1 << $z) - 1;
        if ($z < 0 || $z > 19 || $x < 0 || $x > $maxCoord || $y < 0 || $y > $maxCoord) {
            return response()->json(['error' => 'Invalid tile coordinates'], 400);
        }

        $cacheDir = storage_path("app/tiles/osm/{$z}/{$x}");
        $cacheFile = "{$cacheDir}/{$y}.png";

        if (File::exists($cacheFile)) {
            return response(File::get($cacheFile), 200, [
                'Content-Type' => 'image/png',
                'Cache-Control' => 'public, max-age=' . self::CACHE_TTL_SECONDS . ', immutable',
                'Access-Control-Allow-Origin' => '*',
                'X-Tile-Cache' => 'HIT-LARAVEL',
            ]);
        }

        try {
            $upstreamUrl = "https://tile.openstreetmap.org/{$z}/{$x}/{$y}.png";
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                    'Referer'    => 'https://www.openstreetmap.org/',
                ])
                ->get($upstreamUrl);

            if ($response->successful()) {
                File::ensureDirectoryExists($cacheDir);
                File::put($cacheFile, $response->body());

                return response($response->body(), 200, [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'public, max-age=' . self::CACHE_TTL_SECONDS . ', immutable',
                    'Access-Control-Allow-Origin' => '*',
                    'X-Tile-Cache' => 'MISS-LARAVEL',
                ]);
            }

            return response()->json(['error' => 'Upstream OSM tile error'], $response->status());
        } catch (\Throwable $e) {
            Log::warning("[TileProxy] Failed to fetch OSM tile ({$z}, {$x}, {$y}): " . $e->getMessage());
            return response()->json(['error' => 'Tile fetch timeout'], 504);
        }
    }

    /**
     * Serve or cache ArcGIS World Imagery (Satellite) tiles.
     * URI: /api/tiles/satellite/{z}/{y}/{x}
     */
    public function satellite(int $z, int $y, int $x)
    {
        // Basic coordinate validation
        $maxCoord = (1 << $z) - 1;
        if ($z < 0 || $z > 19 || $x < 0 || $x > $maxCoord || $y < 0 || $y > $maxCoord) {
            return response()->json(['error' => 'Invalid tile coordinates'], 400);
        }

        $cacheDir = storage_path("app/tiles/satellite/{$z}/{$y}");
        $cacheFile = "{$cacheDir}/{$x}.jpg";

        if (File::exists($cacheFile)) {
            return response(File::get($cacheFile), 200, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=' . self::CACHE_TTL_SECONDS . ', immutable',
                'Access-Control-Allow-Origin' => '*',
                'X-Tile-Cache' => 'HIT-LARAVEL',
            ]);
        }

        try {
            $upstreamUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{$z}/{$y}/{$x}";
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                ])
                ->get($upstreamUrl);

            if ($response->successful()) {
                File::ensureDirectoryExists($cacheDir);
                File::put($cacheFile, $response->body());

                return response($response->body(), 200, [
                    'Content-Type' => 'image/jpeg',
                    'Cache-Control' => 'public, max-age=' . self::CACHE_TTL_SECONDS . ', immutable',
                    'Access-Control-Allow-Origin' => '*',
                    'X-Tile-Cache' => 'MISS-LARAVEL',
                ]);
            }

            return response()->json(['error' => 'Upstream satellite tile error'], $response->status());
        } catch (\Throwable $e) {
            Log::warning("[TileProxy] Failed to fetch Satellite tile ({$z}, {$y}, {$x}): " . $e->getMessage());
            return response()->json(['error' => 'Tile fetch timeout'], 504);
        }
    }
}
