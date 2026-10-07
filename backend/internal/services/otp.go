package services

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"
	"time"
)

// OtpService replicates Laravel's App\Services\OtpService — generate, rate-limit,
// and verify one-time codes. Uses in-memory cache (swap to Redis for multi-instance).
type OtpService struct {
	mu    sync.Mutex
	store map[string]*otpEntry
}

type otpEntry struct {
	Code      int
	ExpiresAt time.Time
	Attempts  int
}

const (
	resendCooldownSec = 60
	maxRequestsPerHr  = 5
)

type cooldownEntry struct {
	until time.Time
}

type countEntry struct {
	count     int
	expiresAt time.Time
}

var (
	otpSvc      *OtpService
	cooldowns   = make(map[string]*cooldownEntry)
	reqCounts   = make(map[string]*countEntry)
	otpCacheMu  sync.Mutex
)

func init() {
	otpSvc = &OtpService{store: make(map[string]*otpEntry)}
}

func GetOtpService() *OtpService {
	return otpSvc
}

// GenerateAndStore creates a new 6-digit OTP and caches it for the given duration.
func (s *OtpService) GenerateAndStore(key string, minutes int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	otp := int(n.Int64()) + 100000

	s.mu.Lock()
	s.store[key] = &otpEntry{
		Code:      otp,
		ExpiresAt: time.Now().Add(time.Duration(minutes) * time.Minute),
	}
	s.mu.Unlock()

	return otp
}

// RequestOtp is the rate-limited entry point: checks per-identifier cooldown + hourly cap.
// Returns map with "otp" on success, or "blocked" + details on rate limit.
func (s *OtpService) RequestOtp(key string, minutes int) map[string]interface{} {
	otpCacheMu.Lock()
	defer otpCacheMu.Unlock()

	cdKey := key + ":cooldown_until"
	countKey := key + ":req_count"

	// Check cooldown
	if cd, exists := cooldowns[cdKey]; exists && time.Now().Before(cd.until) {
		return map[string]interface{}{
			"blocked":     "cooldown",
			"retry_after": int(cd.until.Sub(time.Now()).Seconds()),
		}
	}

	// Check hourly cap
	if cnt, exists := reqCounts[countKey]; exists && time.Now().Before(cnt.expiresAt) && cnt.count >= maxRequestsPerHr {
		return map[string]interface{}{"blocked": "cap"}
	}

	// Set cooldown
	cooldowns[cdKey] = &cooldownEntry{until: time.Now().Add(time.Duration(resendCooldownSec) * time.Second)}

	// Increment count
	if cnt, exists := reqCounts[countKey]; exists && time.Now().Before(cnt.expiresAt) {
		cnt.count++
	} else {
		reqCounts[countKey] = &countEntry{count: 1, expiresAt: time.Now().Add(time.Hour)}
	}

	otp := s.GenerateAndStore(key, minutes)
	return map[string]interface{}{"otp": otp}
}

// Verify checks a submitted code against the cached one. On success, the entry
// is deleted (single-use) and true is returned. After 5 incorrect attempts,
// the code is invalidated immediately.
func (s *OtpService) Verify(key string, submitted int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	entry, exists := s.store[key]
	if !exists || time.Now().After(entry.ExpiresAt) {
		delete(s.store, key)
		return false
	}

	if entry.Code == submitted {
		delete(s.store, key)
		return true
	}

	entry.Attempts++
	if entry.Attempts >= 5 {
		delete(s.store, key)
	}

	return false
}

// Forget explicitly clears a pending OTP.
func (s *OtpService) Forget(key string) {
	s.mu.Lock()
	delete(s.store, key)
	s.mu.Unlock()
}

// CacheGet retrieves a value from the simple in-memory cache
func CacheGet(key string) (bool, bool) {
	otpCacheMu.Lock()
	defer otpCacheMu.Unlock()
	// Simple bool cache for reset_verified_ and pwd_change_verified_ flags
	if cd, exists := cooldowns[key]; exists && time.Now().Before(cd.until) {
		return true, true
	}
	return false, false
}

// CachePut stores a bool flag with a TTL
func CachePut(key string, ttl time.Duration) {
	otpCacheMu.Lock()
	defer otpCacheMu.Unlock()
	cooldowns[key] = &cooldownEntry{until: time.Now().Add(ttl)}
}

// CacheForget removes a cache entry
func CacheForget(key string) {
	otpCacheMu.Lock()
	defer otpCacheMu.Unlock()
	delete(cooldowns, key)
}

// FormatOtp returns a printable OTP string
func FormatOtp(otp int) string {
	return fmt.Sprintf("%06d", otp)
}
