package handlers

import (
	"fmt"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"
	"sine-mdrrmo-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func GetDispatchAssets(c *fiber.Ctx) error {
	var responders []models.Responder
	var vehicles []models.Vehicle

	database.DB.Where("status = 'Available'").Find(&responders)
	database.DB.Where("status = 'Available'").Find(&vehicles)

	return c.JSON(fiber.Map{
		"responders": responders,
		"vehicles":   vehicles,
	})
}

type DispatchEmergencyRequest struct {
	RequestID   int `json:"request_id"`
	ResponderID int `json:"responder_id"`
	VehicleID   int `json:"vehicle_id"`
}

func DispatchEmergency(c *fiber.Ctx) error {
	var req DispatchEmergencyRequest
	if err := c.BodyParser(&req); err != nil || req.RequestID <= 0 || req.ResponderID <= 0 || req.VehicleID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "request_id, responder_id, and vehicle_id are required."})
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var er models.EmergencyRequest
		if err := tx.Where("request_id = ? AND deleted_at IS NULL", req.RequestID).First(&er).Error; err != nil {
			return fiber.NewError(404, "Emergency request not found.")
		}
		if er.Status == nil || (*er.Status != "Pending" && *er.Status != "Dispatched") {
			curr := "unknown"
			if er.Status != nil {
				curr = *er.Status
			}
			return fiber.NewError(409, fmt.Sprintf("Emergency request cannot be dispatched; current status is %s.", curr))
		}

		var responder models.Responder
		if err := tx.Where("responder_id = ?", req.ResponderID).First(&responder).Error; err != nil {
			return fiber.NewError(404, "Responder not found.")
		}
		if responder.Status != "Available" {
			return fiber.NewError(409, fmt.Sprintf("Assigned responder is %s.", responder.Status))
		}

		var vehicle models.Vehicle
		if err := tx.Where("vehicle_id = ?", req.VehicleID).First(&vehicle).Error; err != nil {
			return fiber.NewError(404, "Vehicle not found.")
		}
		if vehicle.Status != "Available" {
			return fiber.NewError(409, fmt.Sprintf("Assigned vehicle is %s.", vehicle.Status))
		}

		now := time.Now()
		dispatch := models.Dispatch{
			RequestID:    &req.RequestID,
			ResponderID:  &req.ResponderID,
			VehicleID:    &req.VehicleID,
			DispatchTime: &now,
			Status:       strPtr("En Route"),
		}
		if err := tx.Create(&dispatch).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.EmergencyRequest{}).Where("request_id = ? AND deleted_at IS NULL", req.RequestID).Update("status", "Dispatched").Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Responder{}).Where("responder_id = ?", req.ResponderID).Update("status", "Dispatched").Error; err != nil {
			return err
		}

		if err := tx.Model(&models.Vehicle{}).Where("vehicle_id = ?", req.VehicleID).Update("status", "In Use").Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"message": fe.Message})
		}
		return c.Status(500).JSON(fiber.Map{"message": "Failed to dispatch units."})
	}

	var er models.EmergencyRequest
	if err := database.DB.Where("request_id = ? AND deleted_at IS NULL", req.RequestID).First(&er).Error; err == nil && er.UserID != nil {
		services.SafeGo(func() {
			_ = services.NotifyUser(*er.UserID, "Responders Dispatched", "Help is on the way to your location.", map[string]string{
				"type": "dispatched",
			})
		})
	}

	websocket.BroadcastEmergency("dispatched", req.RequestID)

	return c.JSON(fiber.Map{"message": "Units dispatched successfully!"})
}

func ResolveEmergency(c *fiber.Ctx) error {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.RequestID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid request_id is required."})
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var er models.EmergencyRequest
		if err := tx.Where("request_id = ? AND deleted_at IS NULL", req.RequestID).First(&er).Error; err != nil {
			return fiber.NewError(404, "Emergency request not found.")
		}
		if er.Status == nil || (*er.Status != "Dispatched" && *er.Status != "Pending") {
			curr := "unknown"
			if er.Status != nil {
				curr = *er.Status
			}
			return fiber.NewError(409, fmt.Sprintf("Emergency request cannot be resolved; current status is %s.", curr))
		}

		if err := tx.Model(&models.EmergencyRequest{}).Where("request_id = ? AND deleted_at IS NULL", req.RequestID).Update("status", "Resolved").Error; err != nil {
			return err
		}

		var dispatches []models.Dispatch
		tx.Where("request_id = ? AND status = 'En Route'", req.RequestID).Find(&dispatches)

		now := time.Now()
		for _, d := range dispatches {
			if d.ResponderID != nil {
				tx.Model(&models.Responder{}).Where("responder_id = ?", *d.ResponderID).Update("status", "Available")
			}
			if d.VehicleID != nil {
				tx.Model(&models.Vehicle{}).Where("vehicle_id = ?", *d.VehicleID).Update("status", "Available")
			}
			tx.Model(&d).Updates(map[string]interface{}{
				"status":       "Completed",
				"arrival_time": &now,
			})
		}
		return nil
	})

	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"message": fe.Message})
		}
		return c.Status(500).JSON(fiber.Map{"message": "Failed to resolve emergency."})
	}

	var er models.EmergencyRequest
	if err := database.DB.Where("request_id = ? AND deleted_at IS NULL", req.RequestID).First(&er).Error; err == nil && er.UserID != nil {
		services.SafeGo(func() {
			_ = services.NotifyUser(*er.UserID, "Emergency Resolved", "Your report has been resolved. Stay safe.", map[string]string{
				"type": "resolved",
			})
		})
	}

	websocket.BroadcastEmergency("resolved", req.RequestID)

	return c.JSON(fiber.Map{"message": "Emergency resolved and archived."})
}

func MarkFalseAlarm(c *fiber.Ctx) error {
	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.RequestID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid request_id is required."})
	}

	var emergency models.EmergencyRequest
	if err := database.DB.Where("request_id = ? AND deleted_at IS NULL", req.RequestID).First(&emergency).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Emergency not found."})
	}

	if emergency.Status != nil && (*emergency.Status == "Pending" || *emergency.Status == "Dispatched") {
		return c.Status(400).JSON(fiber.Map{"message": "Cannot mark an active emergency as a false alarm."})
	}
	if emergency.IsFalseAlarm != 0 {
		return c.Status(400).JSON(fiber.Map{"message": "Already marked as a false alarm."})
	}

	database.DB.Model(&emergency).Update("is_false_alarm", 1)

	if emergency.UserID == nil {
		return c.JSON(fiber.Map{"message": "Emergency marked as false alarm."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Where("user_id = ?", *emergency.UserID).First(&user).Error; err != nil {
		return c.JSON(fiber.Map{"message": "Emergency marked as false alarm."})
	}

	newStrikes := user.FalseAlarmStrikes + 1
	now := time.Now()
	userName := "Citizen"
	if user.Profile != nil && user.Profile.FirstName != nil {
		userName = *user.Profile.FirstName
	}
	userEmail := ""
	if user.Email != nil {
		userEmail = *user.Email
	}

	if newStrikes >= 3 {
		reason := "Automatically suspended after 3 false alarm strikes."
		database.DB.Model(&user).Updates(map[string]interface{}{
			"false_alarm_strikes": newStrikes,
			"account_status":     "banned",
			"ban_reason":         &reason,
			"banned_at":          &now,
		})
		database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})

		services.SafeGo(func() {
			_ = services.NotifyUser(user.UserID, "Account Suspended", "Your account has been suspended due to repeated false emergency reports.", map[string]string{
				"type": "suspended",
			})
			if userEmail != "" {
				_ = services.SendFalseAlarmStrikeEmail(userName, userEmail, newStrikes, 3, "Emergency report marked as false alarm during responder on-site verification.", "banned")
			}
		})

		websocket.BroadcastEmergency("false_alarm", req.RequestID)

		return c.JSON(fiber.Map{
			"message":             "User suspended after reaching 3 false alarm strikes.",
			"false_alarm_strikes": newStrikes,
			"account_status":     "banned",
		})
	}

	database.DB.Model(&user).Update("false_alarm_strikes", newStrikes)
	remaining := 3 - newStrikes

	services.SafeGo(func() {
		_ = services.NotifyUser(
			user.UserID,
			fmt.Sprintf("False Alarm Strike %d of 3", newStrikes),
			fmt.Sprintf("This report was marked as a false alarm by MDRRMO. %d more strike(s) will result in account suspension.", remaining),
			map[string]string{"type": "false_alarm_strike"},
		)
		if userEmail != "" {
			_ = services.SendFalseAlarmStrikeEmail(userName, userEmail, newStrikes, 3, "Emergency report marked as false alarm during responder on-site verification.", "active")
		}
	})

	websocket.BroadcastEmergency("false_alarm", req.RequestID)

	return c.JSON(fiber.Map{
		"message":             fmt.Sprintf("Strike %d recorded. %d more will result in automatic suspension.", newStrikes, remaining),
		"false_alarm_strikes": newStrikes,
		"account_status":     user.AccountStatus,
	})
}

func strPtr(s string) *string {
	return &s
}
