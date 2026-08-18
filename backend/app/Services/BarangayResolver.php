<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * BarangayResolver — resolves a (latitude, longitude) pair to the San
 * Isidro barangay it falls inside, using the 9 barangay boundary polygons
 * in resources/geo/san-isidro-barangays.geojson (PSA/PSGC-sourced, via the
 * faeldon/philippines-json-maps project — see the session checklist for
 * full provenance and the validation checks run on this file before use).
 *
 * This is the SERVER-SIDE, AUTHORITATIVE resolver. The Ionic frontend has
 * its own independent copy of the same point-in-polygon math (report-map
 * component's isInsideSanIsidro(), extended to loop over these same 9
 * polygons) used only for an instant live preview while the citizen drags
 * the pin — that client-side result is never trusted for what actually
 * gets persisted. This class is what actually decides the barangay_id
 * written to emergency_requests/hazards, so a malicious or buggy client
 * can't misreport its own location's barangay.
 *
 * Deliberately NOT using a PHP geospatial extension or package — ray-
 * casting point-in-polygon over 9 simple, non-self-intersecting polygons
 * is ~15 lines and needs no dependency (mirrors the frontend's existing
 * single town-boundary check, just looped over multiple polygons).
 */
class BarangayResolver
{
    /** Cache key for the parsed polygon set (see loadPolygons()). Bumped by name, not version suffix, if the geojson source is ever swapped/regenerated — see loadPolygons() doc. */
    private const CACHE_KEY = 'san_isidro_barangay_polygons_v1';

    /**
     * adm4_psgc (from the geojson's properties) -> barangays.barangay_id
     * (from the `barangays` table, see database/emergencydb.sql). Hardcoded
     * rather than resolved via a name join: the geojson's adm4_en for
     * barangay_id 8 is "Sto. Cristo" while the DB row is "Santo Cristo" —
     * same barangay, different abbreviation — so a name-string join would
     * silently fail for that one row. PSGC codes are stable and official;
     * this map is the single source of truth for the code<->id relationship
     * and must be kept in sync if barangays are ever added/renumbered.
     */
    private const PSGC_TO_BARANGAY_ID = [
        304925001 => 1, // Alua
        304925002 => 2, // Calaba
        304925004 => 3, // Malapit
        304925005 => 4, // Mangga
        304925006 => 5, // Poblacion
        304925008 => 6, // Pulo
        304925010 => 7, // San Roque
        304925011 => 8, // Santo Cristo (geojson properties say "Sto. Cristo")
        304925012 => 9, // Tabon
    ];

    /**
     * Resolve (lat, lng) to a barangay_id, or null if the point doesn't
     * fall inside any of the 9 mapped polygons (e.g. just outside a
     * boundary edge, or genuinely outside San Isidro). Never throws for a
     * geographically valid but unresolved point — null is a normal,
     * expected outcome the caller stores as-is in the nullable
     * barangay_id column. This must never be allowed to block or fail an
     * SOS/hazard submission — it's a life-safety path.
     */
    public function resolve(float $latitude, float $longitude): ?int
    {
        foreach ($this->loadPolygons() as $psgc => $ring) {
            if ($this->pointInPolygon($longitude, $latitude, $ring)) {
                return self::PSGC_TO_BARANGAY_ID[$psgc] ?? null;
            }
        }
        return null;
    }

    /**
     * @return array<int, array<int, array{0: float, 1: float}>> map of
     *         adm4_psgc => ring (array of [lng, lat] pairs — GeoJSON
     *         coordinate order), cached forever via the framework's cache
     *         facade (same pattern OtpService uses) so the file is parsed
     *         at most once until the cache is explicitly cleared. Safe to
     *         cache indefinitely: barangay boundaries are static reference
     *         data, not something that changes at runtime.
     */
    private function loadPolygons(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $path = resource_path('geo/san-isidro-barangays.geojson');
            $raw = @file_get_contents($path);
            if ($raw === false) {
                // Fail safe, not fail loud: a missing/unreadable geojson
                // file should degrade to "barangay unresolved" for every
                // report, not break SOS/hazard submission.
                return [];
            }

            $decoded = json_decode($raw, true);
            $polygons = [];
            foreach ($decoded['features'] ?? [] as $feature) {
                $psgc = $feature['properties']['adm4_psgc'] ?? null;
                $ring = $feature['geometry']['coordinates'][0] ?? null;
                if ($psgc !== null && $ring !== null) {
                    $polygons[$psgc] = $ring;
                }
            }
            return $polygons;
        });
    }

    /**
     * Standard ray-casting point-in-polygon test. $ring is a closed loop
     * of [lng, lat] pairs (GeoJSON coordinate order). Mirrors the
     * frontend's isInsideSanIsidro() implementation exactly, so both sides
     * agree on edge-case handling (e.g. points exactly on a boundary edge).
     */
    private function pointInPolygon(float $lng, float $lat, array $ring): bool
    {
        $inside = false;
        $n = count($ring);
        for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
            $xi = $ring[$i][0];
            $yi = $ring[$i][1];
            $xj = $ring[$j][0];
            $yj = $ring[$j][1];
            $intersects = (($yi > $lat) !== ($yj > $lat))
                && ($lng < ($xj - $xi) * ($lat - $yi) / ($yj - $yi) + $xi);
            if ($intersects) {
                $inside = !$inside;
            }
        }
        return $inside;
    }
}
