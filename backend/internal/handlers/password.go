package handlers

import (
	"fmt"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

type SendPasswordChangeOtpRequest struct {
	Channel string `json:"channel"`
}

func SendPasswordChangeOtp(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req SendPasswordChangeOtpRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Invalid request."})
	}

	channel := req.Channel
	if channel != "phone" {
		channel = "email"
	}

	cacheKey := fmt.Sprintf("pwd_change_otp_%d", user.UserID)
	res := services.GetOtpService().RequestOtp(cacheKey, 10)
	if blocked, ok := res["blocked"]; ok {
		if blocked == "cooldown" {
			retryAfter, _ := res["retry_after"].(int)
			return c.Status(429).JSON(fiber.Map{
				"message":     fmt.Sprintf("A code was already sent — check your inbox or wait %ds before requesting another.", retryAfter),
				"retry_after": retryAfter,
			})
		}
		return c.Status(429).JSON(fiber.Map{"message": "Too many code requests. Please try again later."})
	}

	otp, _ := res["otp"].(int)
	otpStr := services.FormatOtp(otp)
	log.Info().Int("user_id", user.UserID).Str("channel", channel).Str("otp", otpStr).Msg("Password change OTP generated")

	smsFailed := false
	if channel == "phone" && user.Profile != nil && user.Profile.Phone != nil {
		if err := services.SendPhilSmsOtp(*user.Profile.Phone, otpStr, "changing your password"); err != nil {
			smsFailed = true
			if user.Email != nil {
				_ = services.SendOtpEmail(*user.Email, otpStr, "changing your password (SMS fallback)")
			}
		}
	} else if user.Email != nil {
		_ = services.SendOtpEmail(*user.Email, otpStr, "changing your password")
	}

	msg := "Verification code sent."
	if smsFailed {
		msg = "Verification code sent to your email (SMS gateway was unavailable)."
	}
	return c.JSON(fiber.Map{"message": msg})
}

type VerifyPasswordChangeOtpRequest struct {
	Otp int `json:"otp"`
}

func VerifyPasswordChangeOtp(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req VerifyPasswordChangeOtpRequest
	if err := c.BodyParser(&req); err != nil || req.Otp <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid OTP required."})
	}

	cacheKey := fmt.Sprintf("pwd_change_otp_%d", user.UserID)
	if services.GetOtpService().Verify(cacheKey, req.Otp) {
		flagKey := fmt.Sprintf("pwd_change_verified_%d", user.UserID)
		services.CachePut(flagKey, 5*time.Minute)
		return c.JSON(fiber.Map{"message": "OTP verified."})
	}

	return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP."})
}

type UpdatePasswordRequest struct {
	NewPassword string `json:"new_password"`
}

func UpdatePassword(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req UpdatePasswordRequest
	if err := c.BodyParser(&req); err != nil || len(strings.TrimSpace(req.NewPassword)) < 8 {
		return c.Status(422).JSON(fiber.Map{"message": "New password must be at least 8 characters."})
	}

	flagKey := fmt.Sprintf("pwd_change_verified_%d", user.UserID)
	if ok, _ := services.CacheGet(flagKey); !ok {
		return c.Status(403).JSON(fiber.Map{"message": "Identity verification required before changing password."})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to hash password."})
	}
	hashStr := string(hashed)

	now := time.Now()
	database.DB.Model(&models.User{}).Where("user_id = ?", user.UserID).Updates(map[string]interface{}{
		"password":   &hashStr,
		"updated_at": &now,
	})

	services.CacheForget(flagKey)
	return c.JSON(fiber.Map{"message": "Password updated successfully!"})
}
