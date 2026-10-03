package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// ─── Profile Picture ───────────────────────────────────────────────────

type UpdateProfilePictureRequest struct {
	Image string `json:"image"`
}

func UpdateProfilePicture(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req UpdateProfilePictureRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Image) == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Image is required."})
	}

	binary, err := services.DecodeBase64(req.Image)
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Photo failed to process. Please try cropping again."})
	}
	if !services.CheckSize(binary, "profile") {
		return c.Status(422).JSON(fiber.Map{"message": "Photo is too large. Maximum is 5 MB."})
	}

	mime, ext, ok := services.DetectMime(binary)
	if !ok || mime == "video/mp4" || mime == "video/webm" {
		return c.Status(422).JSON(fiber.Map{"message": "Profile picture must be a PNG or JPEG image."})
	}

	fileName := services.MakeFilename("profile", user.UserID, ext)
	diskPath := filepath.Join("profiles", fmt.Sprintf("%d", user.UserID), fileName)
	newUrl, err := services.StorePublic(diskPath, binary)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to save profile picture."})
	}

	// Delete old photo if local
	var profile models.UserProfile
	err = database.DB.Where("user_id = ?", user.UserID).First(&profile).Error
	if err == nil && profile.ProfilePicture != nil {
		old := *profile.ProfilePicture
		if strings.HasPrefix(old, "/storage/") {
			oldRel := strings.TrimPrefix(old, "/storage/")
			_ = os.Remove(filepath.Join(".", "storage", "app", "public", oldRel))
		}
	}

	now := time.Now()
	if profile.ProfileID != 0 {
		database.DB.Model(&profile).Updates(map[string]interface{}{
			"profile_picture": &newUrl,
			"updated_at":      &now,
		})
	} else {
		profile = models.UserProfile{
			UserID:         user.UserID,
			ProfilePicture: &newUrl,
			CreatedAt:      &now,
			UpdatedAt:      &now,
		}
		database.DB.Create(&profile)
	}

	var freshUser models.User
	database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ?", user.UserID).First(&freshUser)

	return c.JSON(fiber.Map{
		"message": "Photo updated!",
		"user":    freshUser.ToResponse(),
	})
}

// ─── Medical Profile ───────────────────────────────────────────────────

type UpdateMedicalProfileRequest struct {
	BloodType         *string `json:"blood_type"`
	Allergies         *string `json:"allergies"`
	MedicalConditions *string `json:"medical_conditions"`
	PWDStatus         *string `json:"pwd_status"`
}

func UpdateMedicalProfile(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req UpdateMedicalProfileRequest
	_ = c.BodyParser(&req)

	var med models.UserMedicalProfile
	now := time.Now()
	err := database.DB.Where("user_id = ?", user.UserID).First(&med).Error
	if err == nil {
		database.DB.Model(&med).Updates(map[string]interface{}{
			"blood_type":         req.BloodType,
			"allergies":          req.Allergies,
			"medical_conditions": req.MedicalConditions,
			"pwd_status":         req.PWDStatus,
			"updated_at":         &now,
		})
	} else {
		med = models.UserMedicalProfile{
			UserID:            user.UserID,
			BloodType:         req.BloodType,
			Allergies:         req.Allergies,
			MedicalConditions: req.MedicalConditions,
			PWDStatus:         req.PWDStatus,
			CreatedAt:         &now,
			UpdatedAt:         &now,
		}
		database.DB.Create(&med)
	}

	var freshUser models.User
	database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ?", user.UserID).First(&freshUser)

	return c.JSON(fiber.Map{
		"message": "Medical profile updated successfully!",
		"user":    freshUser.ToResponse(),
	})
}

// ─── Account Setup ─────────────────────────────────────────────────────

func CompleteAccountSetup(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	now := time.Now()
	var profile models.UserProfile
	err := database.DB.Where("user_id = ?", user.UserID).First(&profile).Error
	if err == nil {
		database.DB.Model(&profile).Updates(map[string]interface{}{
			"setup_completed": true,
			"updated_at":      &now,
		})
	} else {
		profile = models.UserProfile{
			UserID:         user.UserID,
			SetupCompleted: true,
			CreatedAt:      &now,
			UpdatedAt:      &now,
		}
		database.DB.Create(&profile)
	}

	var freshUser models.User
	database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ?", user.UserID).First(&freshUser)

	return c.JSON(fiber.Map{
		"message": "Setup complete.",
		"user":    freshUser.ToResponse(),
	})
}

// ─── Push Tokens ───────────────────────────────────────────────────────

type SavePushTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

func SavePushToken(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req SavePushTokenRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Token) == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Token is required."})
	}

	platform := req.Platform
	if platform != "ios" {
		platform = "android"
	}

	var dt models.DeviceToken
	now := time.Now()
	err := database.DB.Where("token = ?", req.Token).First(&dt).Error
	if err == nil {
		database.DB.Model(&dt).Updates(map[string]interface{}{
			"user_id":  user.UserID,
			"platform": platform,
		})
	} else {
		dt = models.DeviceToken{
			UserID:    user.UserID,
			Token:     req.Token,
			Platform:  platform,
			CreatedAt: &now,
		}
		database.DB.Create(&dt)
	}

	// Enforce single active push device: remove other device tokens for this user
	database.DB.Where("user_id = ? AND token != ?", user.UserID, req.Token).Delete(&models.DeviceToken{})

	return c.JSON(fiber.Map{"message": "Token saved."})
}

func DeletePushToken(c *fiber.Ctx) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Token) == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Token is required."})
	}

	query := database.DB.Where("token = ?", req.Token)
	if user := middleware.GetUser(c); user != nil {
		query = query.Where("user_id = ?", user.UserID)
	}
	query.Delete(&models.DeviceToken{})

	return c.JSON(fiber.Map{"message": "Token removed."})
}
