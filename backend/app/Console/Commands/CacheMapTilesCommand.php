<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class CacheMapTilesCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'map:cache-tiles
                            {--zoom-min=12 : Minimum zoom level to pre-cache (default: 12)}
                            {--zoom-max=18 : Maximum zoom level to pre-cache (default: 18)}
                            {--satellite : Also pre-cache ArcGIS Satellite imagery tiles}
                            {--status : Display current map tile cache metrics and disk usage}
                            {--clear : Clear all cached map tiles from disk}
                            {--endpoint= : Custom endpoint URL to warm (default: http://127.0.0.1)}';

    /**
     * The console command description.
     */
    protected $description = 'Pre-warm and manage the local VPS map tile cache for San Isidro, Nueva Ecija (Zooms 12-18).';

    // Bounding coordinates for San Isidro, Nueva Ecija (with generous 0.02 safety cushion)
    private const LAT_MIN = 15.23;
    private const LAT_MAX = 15.40;
    private const LNG_MIN = 120.83;
    private const LNG_MAX = 121.00;

    public function handle(): int
    {
        if ($this->option('status')) {
            return $this->displayStatus();
        }

        if ($this->option('clear')) {
            return $this->clearCache();
        }

        $zoomMin = max(0, min(19, (int) $this->option('zoom-min')));
        $zoomMax = max($zoomMin, min(19, (int) $this->option('zoom-max')));
        $withSatellite = (bool) $this->option('satellite');
        $endpoint = rtrim($this->option('endpoint') ?: 'http://127.0.0.1', '/');

        $this->info("================================================================================");
        $this->info("   SINE MDRRMO MAP TILE CACHE PRE-WARMING ENGINE");
        $this->info("   Target Region: San Isidro, Nueva Ecija (Lat: " . self::LAT_MIN . ".." . self::LAT_MAX . ", Lng: " . self::LNG_MIN . ".." . self::LNG_MAX . ")");
        $this->info("   Zoom Levels:   {$zoomMin} to {$zoomMax}");
        $this->info("   Satellite:     " . ($withSatellite ? "Yes" : "No (Street OSM Only)"));
        $this->info("   Host Endpoint: {$endpoint}");
        $this->info("================================================================================");

        // 1. Calculate tile matrix across all zoom levels
        $tilesToWarm = [];
        $totalTiles = 0;

        for ($z = $zoomMin; $z <= $zoomMax; $z++) {
            [$minX, $maxX, $minY, $maxY] = $this->calculateTileBounds($z);
            $count = ($maxX - $minX + 1) * ($maxY - $minY + 1);
            $totalTiles += $count;
            $tilesToWarm[$z] = [
                'minX' => $minX, 'maxX' => $maxX,
                'minY' => $minY, 'maxY' => $maxY,
                'count' => $count
            ];
            $this->line("  • Zoom {$z}: {$count} tiles (x: {$minX}..{$maxX}, y: {$minY}..{$maxY})");
        }

        $grandTotal = $withSatellite ? ($totalTiles * 2) : $totalTiles;
        $this->newLine();
        $this->info("Total tiles to pre-warm: {$grandTotal}");

        $bar = $this->output->createProgressBar($grandTotal);
        $bar->setFormat("  [%bar%] %current%/%max% (%percent:3s%%) -- %message%");
        $bar->start();

        $cached = 0;
        $failed = 0;
        $bytes = 0;
        $startTime = microtime(true);

        foreach ($tilesToWarm as $z => $b) {
            for ($x = $b['minX']; $x <= $b['maxX']; $x++) {
                for ($y = $b['minY']; $y <= $b['maxY']; $y++) {
                    // 1. Warm OpenStreetMap tile
                    $bar->setMessage("Warming OSM Z{$z} X{$x} Y{$y}");
                    $osmUrl = "{$endpoint}/tiles/osm/{$z}/{$x}/{$y}.png";
                    
                    try {
                        $res = Http::timeout(6)
                            ->withHeaders(['User-Agent' => 'SINE-MDRRMO-Prewarmer/1.0'])
                            ->get($osmUrl);
                        if ($res->successful()) {
                            $cached++;
                            $bytes += strlen($res->body());
                        } else {
                            $failed++;
                        }
                    } catch (\Throwable $e) {
                        $failed++;
                    }
                    $bar->advance();

                    // 2. Warm Satellite tile if requested
                    if ($withSatellite) {
                        $bar->setMessage("Warming Sat Z{$z} X{$x} Y{$y}");
                        $satUrl = "{$endpoint}/tiles/satellite/{$z}/{$y}/{$x}.jpg";
                        try {
                            $res = Http::timeout(6)
                                ->withHeaders(['User-Agent' => 'SINE-MDRRMO-Prewarmer/1.0'])
                                ->get($satUrl);
                            if ($res->successful()) {
                                $cached++;
                                $bytes += strlen($res->body());
                            } else {
                                $failed++;
                            }
                        } catch (\Throwable $e) {
                            $failed++;
                        }
                        $bar->advance();
                    }
                }
            }
        }

        $bar->finish();
        $this->newLine(2);

        $elapsed = round(microtime(true) - $startTime, 2);
        $mb = round($bytes / (1024 * 1024), 2);

        $this->info("================================================================================");
        $this->info("   PRE-WARMING COMPLETE!");
        $this->info("   Successfully Cached: {$cached} / {$grandTotal} tiles ({$mb} MB)");
        if ($failed > 0) {
            $this->warn("   Failed / Timed Out:  {$failed} tiles");
        }
        $this->info("   Elapsed Time:        {$elapsed} seconds");
        $this->info("================================================================================");

        return Command::SUCCESS;
    }

    private function calculateTileBounds(int $zoom): array
    {
        $n = pow(2, $zoom);
        $minX = (int) floor(((self::LNG_MIN + 180.0) / 360.0) * $n);
        $maxX = (int) floor(((self::LNG_MAX + 180.0) / 360.0) * $n);
        $minY = (int) floor((1.0 - asinh(tan(deg2rad(self::LAT_MAX))) / M_PI) / 2.0 * $n);
        $maxY = (int) floor((1.0 - asinh(tan(deg2rad(self::LAT_MIN))) / M_PI) / 2.0 * $n);

        return [min($minX, $maxX), max($minX, $maxX), min($minY, $maxY), max($minY, $maxY)];
    }

    private function displayStatus(): int
    {
        $this->info("=== Map Tile Cache Status ===");

        $nginxCacheDir = '/var/cache/nginx/tiles';
        $laravelCacheDir = storage_path('app/tiles');

        if (File::exists($nginxCacheDir)) {
            $files = count(File::allFiles($nginxCacheDir));
            $this->line("  Nginx Tile Cache (/var/cache/nginx/tiles): {$files} cache objects");
        } else {
            $this->line("  Nginx Tile Cache directory: Not found or handled in host volume");
        }

        if (File::exists($laravelCacheDir)) {
            $files = count(File::allFiles($laravelCacheDir));
            $this->line("  Laravel Tile Cache (storage/app/tiles): {$files} tile files");
        } else {
            $this->line("  Laravel Tile Cache: Empty");
        }

        return Command::SUCCESS;
    }

    private function clearCache(): int
    {
        $this->warn("Clearing local tile caches...");

        $laravelCacheDir = storage_path('app/tiles');
        if (File::exists($laravelCacheDir)) {
            File::deleteDirectory($laravelCacheDir);
            $this->info("  Cleared storage/app/tiles.");
        }

        $nginxCacheDir = '/var/cache/nginx/tiles';
        if (File::exists($nginxCacheDir)) {
            File::cleanDirectory($nginxCacheDir);
            $this->info("  Cleaned /var/cache/nginx/tiles.");
        }

        $this->info("Tile cache cleared successfully.");
        return Command::SUCCESS;
    }
}
