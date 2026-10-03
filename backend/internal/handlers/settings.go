package handlers

import (
	"strconv"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

var allowedSettingKeys = map[string]bool{
	"dark_mode":              true,
	"reduce_animations":      true,
	"location_auto_fetch":    true,
	"map_default_style":      true,
	"notif_emergency_alerts": true,
	"notif_broadcast_alerts": true,
	"save_media_to_device":   true,
	"photo_cropping_enabled": true,
	"video_trimming_enabled": true,
}

var defaultSettings = map[string]string{
	"dark_mode":              "false",
	"reduce_animations":      "false",
	"location_auto_fetch":    "true",
	"map_default_style":      "street",
	"notif_emergency_alerts": "true",
	"notif_broadcast_alerts": "true",
	"save_media_to_device":   "false",
	"photo_cropping_enabled": "true",
	"video_trimming_enabled": "true",
}

func GetUserSettings(c *fiber.Ctx) error {
	authUser := middleware.GetUser(c)
	if authUser == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	targetID := authUser.UserID
	if param := c.Params("user_id"); param != "" {
		if id, err := strconv.Atoi(param); err == nil && id != 0 {
			if id != authUser.UserID && !middleware.TokenCan(c, "admin") && !middleware.TokenCan(c, "dispatcher") {
				return c.Status(403).JSON(fiber.Map{"message": "Unauthorized to view settings for another user."})
			}
			targetID = id
		}
	}

	var rows []models.UserSetting
	database.DB.Where("user_id = ?", targetID).Find(&rows)

	result := make(map[string]string)
	for k, v := range defaultSettings {
		result[k] = v
	}
	for _, r := range rows {
		if allowedSettingKeys[r.Key] && r.Value != nil {
			result[r.Key] = *r.Value
		}
	}

	return c.JSON(result)
}

type SetUserSettingRequest struct {
	UserID *int   `json:"user_id"`
	Key    string `json:"key"`
	Value  string `json:"value"`
}

func SetUserSettings(c *fiber.Ctx) error {
	authUser := middleware.GetUser(c)
	if authUser == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req SetUserSettingRequest
	if err := c.BodyParser(&req); err != nil || !allowedSettingKeys[req.Key] {
		return c.Status(422).JSON(fiber.Map{"message": "Valid key is required."})
	}

	targetID := authUser.UserID
	if req.UserID != nil && *req.UserID != 0 {
		if *req.UserID != authUser.UserID && !middleware.TokenCan(c, "admin") {
			return c.Status(403).JSON(fiber.Map{"message": "Unauthorized to modify settings for another user."})
		}
		targetID = *req.UserID
	}

	now := time.Now()
	var setting models.UserSetting
	err := database.DB.Where("user_id = ? AND `key` = ?", targetID, req.Key).First(&setting).Error
	if err == nil {
		database.DB.Model(&setting).Updates(map[string]interface{}{
			"value":      &req.Value,
			"updated_at": &now,
		})
	} else {
		setting = models.UserSetting{
			UserID:    targetID,
			Key:       req.Key,
			Value:     &req.Value,
			UpdatedAt: &now,
		}
		database.DB.Create(&setting)
	}

	return c.JSON(fiber.Map{"message": "Setting saved."})
}
