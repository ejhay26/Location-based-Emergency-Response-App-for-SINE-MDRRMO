package services

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"sine-mdrrmo-backend/internal/config"
)

const (
	MaxProfileBytes = 5 * 1024 * 1024  // 5 MB
	MaxIDBytes      = 10 * 1024 * 1024 // 10 MB
	MaxProofBytes   = 10 * 1024 * 1024 // 10 MB per file
)

// Magic signatures matching MediaHandling trait in Laravel
type signature struct {
	offset int
	sig    []byte
	mime   string
	ext    string
}

var signatures = []signature{
	{offset: 0, sig: []byte{0x89, 0x50, 0x4E, 0x47}, mime: "image/png", ext: "png"},
	{offset: 0, sig: []byte{0xFF, 0xD8, 0xFF}, mime: "image/jpeg", ext: "jpg"},
	{offset: 4, sig: []byte{0x66, 0x74, 0x79, 0x70}, mime: "video/mp4", ext: "mp4"},
	{offset: 0, sig: []byte{0x1A, 0x45, 0xDF, 0xA3}, mime: "video/webm", ext: "webm"},
}

// DecodeBase64 strips MIME headers (e.g. data:image/png;base64,) and decodes base64
func DecodeBase64(data string) ([]byte, error) {
	if idx := strings.Index(data, ";base64,"); idx != -1 {
		data = data[idx+8:]
	}
	data = strings.TrimSpace(data)
	if data == "" {
		return nil, fmt.Errorf("empty base64 string")
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil, err
	}
	if len(decoded) < 100 {
		return nil, fmt.Errorf("payload too small (< 100 bytes)")
	}
	return decoded, nil
}

// DetectMime returns the MIME type and extension using magic byte verification
func DetectMime(binary []byte) (string, string, bool) {
	for _, s := range signatures {
		if len(binary) >= s.offset+len(s.sig) {
			if bytes.Equal(binary[s.offset:s.offset+len(s.sig)], s.sig) {
				return s.mime, s.ext, true
			}
		}
	}
	return "", "", false
}

// CheckSize validates the byte size against the requested category
func CheckSize(binary []byte, category string) bool {
	var ceiling int
	switch category {
	case "profile":
		ceiling = MaxProfileBytes
	case "id":
		ceiling = MaxIDBytes
	default:
		ceiling = MaxProofBytes
	}
	return len(binary) <= ceiling
}

// MakeFilename generates unguessable, collision-proof filename using crypto/rand
func MakeFilename(fileType string, userId int, ext string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%d_%s.%s", fileType, userId, hex.EncodeToString(b), ext)
}

// StorePublic writes file into ./storage/app/public/<diskPath> and returns the public URL "/storage/<diskPath>"
func StorePublic(diskPath string, binary []byte) (string, error) {
	cfg := config.AppConfig
	baseStorageDir := os.Getenv("STORAGE_PATH")
	if baseStorageDir == "" {
		baseStorageDir = filepath.Join(".", "storage", "app", "public")
	}
	fullPath := filepath.Join(baseStorageDir, diskPath)

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	if err := os.WriteFile(fullPath, binary, 0644); err != nil {
		return "", fmt.Errorf("failed to write file %s: %w", fullPath, err)
	}

	// Clean slash path for URL
	cleanPath := strings.ReplaceAll(diskPath, "\\", "/")
	cleanPath = strings.TrimPrefix(cleanPath, "/")

	// If AppURL is configured, return full URL or root-relative "/storage/..."
	if cfg != nil && cfg.AppURL != "" && strings.HasPrefix(cfg.AppURL, "http") {
		return fmt.Sprintf("%s/storage/%s", strings.TrimRight(cfg.AppURL, "/"), cleanPath), nil
	}
	return "/storage/" + cleanPath, nil
}

// ProcessAndStorePublic combines decode, size check, mime check, and store
func ProcessAndStorePublic(fileType, folder, category, data string, userId int) (*string, error) {
	binary, err := DecodeBase64(data)
	if err != nil {
		return nil, err
	}
	if !CheckSize(binary, category) {
		return nil, fmt.Errorf("file exceeds size limit for category %s", category)
	}
	_, ext, ok := DetectMime(binary)
	if !ok {
		return nil, fmt.Errorf("unsupported file format or corrupt header")
	}

	fileName := MakeFilename(fileType, userId, ext)
	diskPath := filepath.Join(folder, fileName)
	url, err := StorePublic(diskPath, binary)
	if err != nil {
		return nil, err
	}
	return &url, nil
}

// ProcessProofFiles processes up to maxCount raw files and returns a JSON string of paths
func ProcessProofFiles(files []string, userId int, fileType string, maxCount int) (string, error) {
	if maxCount <= 0 {
		maxCount = 2
	}
	if len(files) > maxCount {
		files = files[:maxCount]
	}

	var storedPaths []string
	folder := fmt.Sprintf("reports/%s/%d", fileType, userId)

	for _, raw := range files {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		// If already stored path or url (e.g. from draft)
		if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") ||
			strings.HasPrefix(raw, "/storage/") || strings.HasPrefix(raw, "reports/") {
			storedPaths = append(storedPaths, raw)
			continue
		}

		path, err := ProcessAndStorePublic(fileType, folder, "proof", raw, userId)
		if err == nil && path != nil {
			storedPaths = append(storedPaths, *path)
		}
	}

	jsonBytes, err := json.Marshal(storedPaths)
	if err != nil {
		return "[]", err
	}
	return string(jsonBytes), nil
}
