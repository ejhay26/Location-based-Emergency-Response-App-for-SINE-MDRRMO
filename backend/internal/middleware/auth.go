package middleware

import (
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// AuthSanctum is a Fiber middleware that replicates Laravel Sanctum's
// auth:sanctum middleware. It reads the Bearer token from the Authorization
// header, SHA-256 hashes it (Sanctum stores hashed tokens), looks it up in
// personal_access_tokens, loads the associated user + profile, and stores
// both in c.Locals for downstream handlers.
func AuthSanctum() fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
		}

		rawToken := strings.TrimPrefix(header, "Bearer ")
		if rawToken == "" {
			return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
		}

		// Sanctum tokens are stored as "id|plain_token". The DB stores
		// only the SHA-256 hash of the part after the pipe.
		parts := strings.SplitN(rawToken, "|", 2)
		var hashInput string
		if len(parts) == 2 {
			hashInput = parts[1]
		} else {
			hashInput = rawToken
		}

		hash := sha256.Sum256([]byte(hashInput))
		hashedToken := hex.EncodeToString(hash[:])

		var pat models.PersonalAccessToken
		if err := database.DB.Where("token = ?", hashedToken).First(&pat).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
		}

		// Check expiry
		if pat.ExpiresAt != nil && pat.ExpiresAt.Before(time.Now()) {
			return c.Status(401).JSON(fiber.Map{"message": "Token expired."})
		}

		// Load user with profile (like Laravel's $with = ['profile'])
		var user models.User
		if err := database.DB.
			Preload("Profile").
			Preload("Verification").
			Preload("MedicalProfile").
			Where("user_id = ?", pat.TokenableID).
			First(&user).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
		}

		// Update last_used_at
		now := time.Now()
		database.DB.Model(&pat).Update("last_used_at", now)

		// Store in context for handlers
		c.Locals("user", &user)
		c.Locals("token", &pat)

		return c.Next()
	}
}

// RequireAbility is a middleware that checks if the authenticated user's
// token has a specific ability. This replicates Laravel Sanctum's
// `middleware('ability:admin')` pattern.
func RequireAbility(ability string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		pat, ok := c.Locals("token").(*models.PersonalAccessToken)
		if !ok || pat == nil {
			return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
		}

		if !tokenCan(pat, ability) {
			return c.Status(403).JSON(fiber.Map{"message": "Unauthorized."})
		}

		return c.Next()
	}
}

// tokenCan checks if the token has the given ability.
// Abilities are stored as a JSON array: ["admin","dispatcher","citizen"]
func tokenCan(pat *models.PersonalAccessToken, ability string) bool {
	if pat.Abilities == nil {
		return false
	}

	// Handle the special "*" wildcard
	if *pat.Abilities == `["*"]` {
		return true
	}

	var abilities []string
	if err := json.Unmarshal([]byte(*pat.Abilities), &abilities); err != nil {
		return false
	}

	for _, a := range abilities {
		if a == ability || a == "*" {
			return true
		}
	}
	return false
}

// GetUser extracts the authenticated user from the Fiber context
func GetUser(c *fiber.Ctx) *models.User {
	user, ok := c.Locals("user").(*models.User)
	if !ok {
		return nil
	}
	return user
}

// GetToken extracts the PAT from the Fiber context
func GetToken(c *fiber.Ctx) *models.PersonalAccessToken {
	pat, ok := c.Locals("token").(*models.PersonalAccessToken)
	if !ok {
		return nil
	}
	return pat
}

// TokenCan checks if the current request's token has an ability
func TokenCan(c *fiber.Ctx, ability string) bool {
	pat := GetToken(c)
	if pat == nil {
		return false
	}
	return tokenCan(pat, ability)
}

// CreatePersonalAccessToken generates a Sanctum-compatible token
func CreatePersonalAccessToken(userId int, name string, abilities []string) (string, error) {
	// Generate 40-char random token string
	randomBytes := make([]byte, 20)
	if _, err := cryptoRand(randomBytes); err != nil {
		return "", err
	}
	plainToken := hex.EncodeToString(randomBytes)

	hash := sha256.Sum256([]byte(plainToken))
	hashedToken := hex.EncodeToString(hash[:])

	abilitiesJSON, err := json.Marshal(abilities)
	if err != nil {
		return "", err
	}
	abilitiesStr := string(abilitiesJSON)

	now := time.Now()
	pat := models.PersonalAccessToken{
		TokenableType: "App\\Models\\User",
		TokenableID:   userId,
		Name:          name,
		Token:         hashedToken,
		Abilities:     &abilitiesStr,
		CreatedAt:     &now,
		UpdatedAt:     &now,
	}

	if err := database.DB.Create(&pat).Error; err != nil {
		return "", err
	}

	return fmt.Sprintf("%d|%s", pat.ID, plainToken), nil
}

func cryptoRand(b []byte) (int, error) {
	return crand.Read(b)
}

