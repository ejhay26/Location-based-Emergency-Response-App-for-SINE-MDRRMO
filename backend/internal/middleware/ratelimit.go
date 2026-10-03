package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// RateLimiter provides per-key rate limiting similar to Laravel's throttle middleware.
// Uses an in-memory sliding window counter. For production at scale, swap to Redis.
type RateLimiter struct {
	mu       sync.Mutex
	counters map[string]*rateBucket
}

type rateBucket struct {
	count     int
	expiresAt time.Time
}

var globalLimiter = &RateLimiter{
	counters: make(map[string]*rateBucket),
}

// Throttle creates a Fiber middleware that limits requests per IP.
// maxAttempts is the max requests allowed within windowMinutes.
// Equivalent to Laravel's throttle:maxAttempts,windowMinutes
func Throttle(maxAttempts int, windowMinutes int) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := c.Path() + "|" + c.IP()
		window := time.Duration(windowMinutes) * time.Minute

		globalLimiter.mu.Lock()
		bucket, exists := globalLimiter.counters[key]
		now := time.Now()

		if !exists || now.After(bucket.expiresAt) {
			globalLimiter.counters[key] = &rateBucket{
				count:     1,
				expiresAt: now.Add(window),
			}
			globalLimiter.mu.Unlock()
			return c.Next()
		}

		if bucket.count >= maxAttempts {
			remaining := int(bucket.expiresAt.Sub(now).Seconds())
			globalLimiter.mu.Unlock()
			return c.Status(429).JSON(fiber.Map{
				"message": "Too many attempts. Please try again in " + formatSeconds(remaining) + ".",
			})
		}

		bucket.count++
		globalLimiter.mu.Unlock()
		return c.Next()
	}
}

func formatSeconds(s int) string {
	if s < 60 {
		return string(rune('0'+s/10)) + string(rune('0'+s%10)) + "s"
	}
	m := s / 60
	return string(rune('0'+m/10)) + string(rune('0'+m%10)) + "m"
}

// CleanupExpiredEntries should be called periodically to prevent memory leaks
func CleanupExpiredEntries() {
	globalLimiter.mu.Lock()
	defer globalLimiter.mu.Unlock()
	now := time.Now()
	for key, bucket := range globalLimiter.counters {
		if now.After(bucket.expiresAt) {
			delete(globalLimiter.counters, key)
		}
	}
}
