package services

import (
	"encoding/json"
	"math"
	"os"
	"sync"

	"github.com/rs/zerolog/log"
)

// BarangayResolver replicates App\Services\BarangayResolver — resolves a
// lat/lng coordinate to a barangay_id using point-in-polygon ray-casting
// on the pre-loaded GeoJSON municipal boundary data.
type BarangayResolver struct {
	mu         sync.RWMutex
	boundaries []barangayBoundary
	loaded     bool
}

type barangayBoundary struct {
	BarangayID int
	Name       string
	Rings      [][][2]float64 // polygon rings (outer + holes)
}

type geoJSONFeatureCollection struct {
	Type     string           `json:"type"`
	Features []geoJSONFeature `json:"features"`
}

type geoJSONFeature struct {
	Type       string                `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   geoJSONGeometry       `json:"geometry"`
}

type geoJSONGeometry struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

var (
	resolverInstance *BarangayResolver
	resolverOnce     sync.Once
)

func GetBarangayResolver() *BarangayResolver {
	resolverOnce.Do(func() {
		resolverInstance = &BarangayResolver{}
		resolverInstance.load()
	})
	return resolverInstance
}

func (r *BarangayResolver) load() {
	// Try multiple possible paths for the GeoJSON file
	paths := []string{
		"resources/geo/san-isidro-barangays.geojson",
		"resources/geo/san_isidro_boundaries.geojson",
		"../backend/resources/geo/san-isidro-barangays.geojson",
		"../backend/resources/geo/san_isidro_boundaries.geojson",
		"resources/geo/barangay_boundaries.geojson",
	}

	var data []byte
	var err error
	for _, p := range paths {
		data, err = os.ReadFile(p)
		if err == nil {
			log.Info().Str("path", p).Msg("BarangayResolver: loaded GeoJSON boundaries")
			break
		}
	}

	if data == nil {
		log.Warn().Msg("BarangayResolver: no GeoJSON boundaries file found — all resolutions will return nil")
		return
	}

	var fc geoJSONFeatureCollection
	if err := json.Unmarshal(data, &fc); err != nil {
		log.Error().Err(err).Msg("BarangayResolver: failed to parse GeoJSON")
		return
	}

	for _, feature := range fc.Features {
		bid, ok := feature.Properties["barangay_id"]
		if !ok {
			continue
		}
		barangayID := int(bid.(float64))
		name, _ := feature.Properties["barangay_name"].(string)

		var rings [][][2]float64

		switch feature.Geometry.Type {
		case "Polygon":
			var coords [][][2]float64
			if err := json.Unmarshal(feature.Geometry.Coordinates, &coords); err == nil {
				rings = coords
			}
		case "MultiPolygon":
			var multiCoords [][][][2]float64
			if err := json.Unmarshal(feature.Geometry.Coordinates, &multiCoords); err == nil {
				for _, polygon := range multiCoords {
					rings = append(rings, polygon...)
				}
			}
		}

		if len(rings) > 0 {
			r.boundaries = append(r.boundaries, barangayBoundary{
				BarangayID: barangayID,
				Name:       name,
				Rings:      rings,
			})
		}
	}

	r.loaded = len(r.boundaries) > 0
	log.Info().Int("count", len(r.boundaries)).Msg("BarangayResolver: boundaries loaded")
}

// Resolve returns the barangay_id for the given lat/lng, or nil if the point
// is outside all known boundaries. Nil is valid and expected (offshore, outside
// municipal limits) — callers must never block on a nil result.
func (r *BarangayResolver) Resolve(lat, lng float64) *int {
	if !r.loaded {
		return nil
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, b := range r.boundaries {
		if r.pointInPolygon(lat, lng, b.Rings) {
			id := b.BarangayID
			return &id
		}
	}

	return nil
}

// pointInPolygon uses the ray-casting algorithm (identical to the PHP version).
// The first ring is the outer boundary; subsequent rings are holes.
func (r *BarangayResolver) pointInPolygon(lat, lng float64, rings [][][2]float64) bool {
	if len(rings) == 0 {
		return false
	}

	// Must be inside the outer ring
	if !r.pointInRing(lat, lng, rings[0]) {
		return false
	}

	// Must NOT be inside any hole ring
	for i := 1; i < len(rings); i++ {
		if r.pointInRing(lat, lng, rings[i]) {
			return false
		}
	}

	return true
}

// pointInRing implements the ray-casting algorithm for a single ring.
// GeoJSON coordinates are [lng, lat], so we index accordingly.
func (r *BarangayResolver) pointInRing(lat, lng float64, ring [][2]float64) bool {
	n := len(ring)
	if n < 3 {
		return false
	}

	inside := false
	j := n - 1

	for i := 0; i < n; i++ {
		xi, yi := ring[i][0], ring[i][1] // [lng, lat]
		xj, yj := ring[j][0], ring[j][1]

		if ((yi > lat) != (yj > lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi)+xi) {
			inside = !inside
		}
		j = i
	}

	return inside
}

// unused but keeping for parity — Haversine distance between two points
func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000.0 // Earth radius in meters
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// ResolveBarangay returns the barangay_id for the given coordinates, or 0 if outside
func ResolveBarangay(lat, lng float64) int {
	res := GetBarangayResolver().Resolve(lat, lng)
	if res != nil {
		return *res
	}
	return 0
}

