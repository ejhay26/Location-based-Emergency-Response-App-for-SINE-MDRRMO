package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

const (
	tileUserAgent       = "SINE-MDRRMO-Emergency-Response-App/1.0 (contact: admin@sine-mdrrmo.gov.ph)"
	tileCacheTTLSeconds = 5184000 // 60 days
)

var httpClient = &http.Client{
	Timeout: 8 * time.Second,
}

func OsmTileProxy(c *fiber.Ctx) error {
	z, err1 := strconv.Atoi(c.Params("z"))
	x, err2 := strconv.Atoi(c.Params("x"))
	yStr := strings.TrimSuffix(c.Params("y"), ".png")
	y, err3 := strconv.Atoi(yStr)

	if err1 != nil || err2 != nil || err3 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid tile coordinates"})
	}

	maxCoord := (1 << z) - 1
	if z < 0 || z > 19 || x < 0 || x > maxCoord || y < 0 || y > maxCoord {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid tile coordinates"})
	}

	cacheDir := filepath.Join(".", "storage", "app", "tiles", "osm", strconv.Itoa(z), strconv.Itoa(x))
	cacheFile := filepath.Join(cacheDir, fmt.Sprintf("%d.png", y))

	if data, err := os.ReadFile(cacheFile); err == nil {
		c.Set("Content-Type", "image/png")
		c.Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", tileCacheTTLSeconds))
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("X-Tile-Cache", "HIT-GO")
		return c.Send(data)
	}

	upstreamURL := fmt.Sprintf("https://tile.openstreetmap.org/%d/%d/%d.png", z, x, y)
	req, err := http.NewRequest("GET", upstreamURL, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create upstream request"})
	}
	req.Header.Set("User-Agent", tileUserAgent)
	req.Header.Set("Referer", "https://www.openstreetmap.org/")

	resp, err := httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Msgf("[TileProxy] Failed to fetch OSM tile (%d, %d, %d)", z, x, y)
		return c.Status(504).JSON(fiber.Map{"error": "Tile fetch timeout"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Upstream OSM tile error"})
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read tile stream"})
	}

	_ = os.MkdirAll(cacheDir, 0755)
	_ = os.WriteFile(cacheFile, body, 0644)

	c.Set("Content-Type", "image/png")
	c.Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", tileCacheTTLSeconds))
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("X-Tile-Cache", "MISS-GO")
	return c.Send(body)
}

func SatelliteTileProxy(c *fiber.Ctx) error {
	z, err1 := strconv.Atoi(c.Params("z"))
	y, err2 := strconv.Atoi(c.Params("y"))
	xRaw := c.Params("x")
	// Handle optional extension
	if idx := strings.Index(xRaw, "."); idx != -1 {
		xRaw = xRaw[:idx]
	}
	x, err3 := strconv.Atoi(xRaw)

	if err1 != nil || err2 != nil || err3 != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid tile coordinates"})
	}

	maxCoord := (1 << z) - 1
	if z < 0 || z > 19 || x < 0 || x > maxCoord || y < 0 || y > maxCoord {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid tile coordinates"})
	}

	cacheDir := filepath.Join(".", "storage", "app", "tiles", "satellite", strconv.Itoa(z), strconv.Itoa(y))
	cacheFile := filepath.Join(cacheDir, fmt.Sprintf("%d.jpg", x))

	if data, err := os.ReadFile(cacheFile); err == nil {
		c.Set("Content-Type", "image/jpeg")
		c.Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", tileCacheTTLSeconds))
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("X-Tile-Cache", "HIT-GO")
		return c.Send(data)
	}

	upstreamURL := fmt.Sprintf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d", z, y, x)
	req, err := http.NewRequest("GET", upstreamURL, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create upstream request"})
	}
	req.Header.Set("User-Agent", tileUserAgent)

	resp, err := httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Msgf("[TileProxy] Failed to fetch Satellite tile (%d, %d, %d)", z, y, x)
		return c.Status(504).JSON(fiber.Map{"error": "Tile fetch timeout"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Upstream satellite tile error"})
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read tile stream"})
	}

	_ = os.MkdirAll(cacheDir, 0755)
	_ = os.WriteFile(cacheFile, body, 0644)

	c.Set("Content-Type", "image/jpeg")
	c.Set("Cache-Control", fmt.Sprintf("public, max-age=%d, immutable", tileCacheTTLSeconds))
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("X-Tile-Cache", "MISS-GO")
	return c.Send(body)
}
