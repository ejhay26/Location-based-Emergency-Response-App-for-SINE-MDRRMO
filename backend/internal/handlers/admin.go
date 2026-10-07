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
	"sine-mdrrmo-backend/internal/support"
	"sine-mdrrmo-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// ─── Citizen Management ────────────────────────────────────────────────

func GetCitizens(c *fiber.Ctx) error {
	search := strings.TrimSpace(c.Query("search"))
	status := strings.TrimSpace(c.Query("status"))

	query := database.DB.
		Preload("Profile").
		Preload("Verification").
		Preload("MedicalProfile").
		Where("role = 'citizen'")

	if status != "" {
		query = query.Where("account_status = ?", status)
	}

	if search != "" {
		likeTerm := "%" + search + "%"
		query = query.Joins("LEFT JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Where("users.email LIKE ? OR user_profiles.first_name LIKE ? OR user_profiles.last_name LIKE ? OR user_profiles.username LIKE ? OR user_profiles.phone LIKE ?",
				likeTerm, likeTerm, likeTerm, likeTerm, likeTerm)
	}

	var users []models.User
	query.Order("created_at desc").Find(&users)

	resp := make([]models.UserResponse, 0)
	for _, u := range users {
		resp = append(resp, u.ToResponse())
	}

	return c.JSON(resp)
}

func SuspendCitizen(c *fiber.Ctx) error {
	var req struct {
		UserID int    `json:"user_id"`
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 || req.Reason == "" {
		return c.Status(422).JSON(fiber.Map{"message": "user_id and reason are required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen'", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Citizen not found."})
	}

	now := time.Now()
	database.DB.Model(&user).Updates(map[string]interface{}{
		"account_status": "banned",
		"ban_reason":     &req.Reason,
		"banned_at":      &now,
	})
	database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})

	websocket.BroadcastUser("suspended", user.UserID)

	user.AccountStatus = "banned"
	user.BanReason = &req.Reason
	user.BannedAt = &now

	return c.JSON(fiber.Map{"message": "Account suspended.", "user": user.ToResponse()})
}

func ReactivateCitizen(c *fiber.Ctx) error {
	var req struct {
		UserID int `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "user_id is required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen'", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Citizen not found."})
	}

	database.DB.Model(&user).Updates(map[string]interface{}{
		"account_status": "active",
		"ban_reason":     nil,
		"banned_at":      nil,
	})

	websocket.BroadcastUser("reinstated", user.UserID)

	user.AccountStatus = "active"
	user.BanReason = nil
	user.BannedAt = nil

	return c.JSON(fiber.Map{"message": "Account reactivated.", "user": user.ToResponse()})
}

func IssueStrike(c *fiber.Ctx) error {
	var req struct {
		UserID int    `json:"user_id"`
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 || req.Reason == "" {
		return c.Status(422).JSON(fiber.Map{"message": "user_id and reason are required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen'", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Citizen not found."})
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
		reason := fmt.Sprintf("Automatically suspended after 3 false alarm strikes. (Reason: %s)", req.Reason)
		database.DB.Model(&user).Updates(map[string]interface{}{
			"false_alarm_strikes": newStrikes,
			"account_status":     "banned",
			"ban_reason":         &reason,
			"banned_at":          &now,
		})
		database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})

		services.SafeGo(func() {
			_ = services.NotifyUser(user.UserID, "Account Suspended (3 False Alarm Strikes)",
				fmt.Sprintf("Your account has been suspended due to repeated false alarm reports. Stated reason: %s", req.Reason),
				map[string]string{"type": "suspended"})
			if userEmail != "" {
				_ = services.SendFalseAlarmStrikeEmail(userName, userEmail, newStrikes, 3, req.Reason, "banned")
			}
		})

		websocket.BroadcastUser("suspended", user.UserID)

		user.FalseAlarmStrikes = newStrikes
		user.AccountStatus = "banned"
		user.BanReason = &reason
		user.BannedAt = &now

		return c.JSON(fiber.Map{
			"message":             "Citizen received Strike 3 and account has been suspended.",
			"false_alarm_strikes": newStrikes,
			"account_status":     "banned",
			"user":               user.ToResponse(),
		})
	}

	database.DB.Model(&user).Update("false_alarm_strikes", newStrikes)
	remaining := 3 - newStrikes

	services.SafeGo(func() {
		_ = services.NotifyUser(user.UserID, fmt.Sprintf("False Alarm Strike %d of 3", newStrikes),
			fmt.Sprintf("A false alarm strike was recorded on your account. Reason: %s. %d more strike(s) will result in automatic suspension.", req.Reason, remaining),
			map[string]string{"type": "false_alarm_strike"})
		if userEmail != "" {
			_ = services.SendFalseAlarmStrikeEmail(userName, userEmail, newStrikes, 3, req.Reason, "active")
		}
	})

	websocket.BroadcastUser("updated", user.UserID)

	user.FalseAlarmStrikes = newStrikes
	return c.JSON(fiber.Map{
		"message":             fmt.Sprintf("Strike %d of 3 recorded. %d more will result in automatic suspension.", newStrikes, remaining),
		"false_alarm_strikes": newStrikes,
		"account_status":     user.AccountStatus,
		"user":               user.ToResponse(),
	})
}

func ResetStrikes(c *fiber.Ctx) error {
	var req struct {
		UserID int `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "user_id is required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen'", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Citizen not found."})
	}

	wasBanned := user.AccountStatus == "banned"
	updates := map[string]interface{}{
		"false_alarm_strikes": 0,
	}
	if wasBanned {
		updates["account_status"] = "active"
		updates["ban_reason"] = nil
		updates["banned_at"] = nil
	}
	database.DB.Model(&user).Updates(updates)

	services.SafeGo(func() {
		_ = services.NotifyUser(user.UserID, "False Alarm Strikes Cleared",
			"Your false alarm strikes have been reset to 0 by MDRRMO administration.",
			map[string]string{"type": "strikes_cleared"})
	})

	websocket.BroadcastUser("reinstated", user.UserID)

	user.FalseAlarmStrikes = 0
	if wasBanned {
		user.AccountStatus = "active"
		user.BanReason = nil
		user.BannedAt = nil
	}

	return c.JSON(fiber.Map{
		"message":             "False alarm strikes reset to 0. Account record cleared.",
		"false_alarm_strikes": 0,
		"account_status":     user.AccountStatus,
		"user":               user.ToResponse(),
	})
}

// ─── Verification Queue ────────────────────────────────────────────────

func GetPendingVerifications(c *fiber.Ctx) error {
	var users []models.User
	database.DB.
		Preload("Profile").
		Preload("Verification").
		Preload("MedicalProfile").
		Where("account_status = 'unverified'").
		Order("created_at desc").
		Find(&users)

	resp := make([]models.UserResponse, 0)
	for _, u := range users {
		resp = append(resp, u.ToResponse())
	}

	return c.JSON(resp)
}

func ApproveUser(c *fiber.Ctx) error {
	var req struct {
		UserID int `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "user_id is required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen'", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Citizen not found."})
	}

	adminUser := middleware.GetUser(c)
	var adminID *int
	if adminUser != nil {
		adminID = &adminUser.UserID
	}

	now := time.Now()
	database.DB.Model(&user).Update("account_status", "active")
	database.DB.Model(&models.UserVerification{}).Where("user_id = ?", user.UserID).Updates(map[string]interface{}{
		"verification_status": "approved",
		"reviewed_by":         adminID,
		"reviewed_at":         &now,
	})

	websocket.BroadcastUser("approved", user.UserID)

	firstName := "Citizen"
	if user.Profile != nil && user.Profile.FirstName != nil {
		firstName = *user.Profile.FirstName
	}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	services.SafeGo(func() {
		if email != "" {
			_ = services.SendWelcomeEmail(firstName, email)
		}
		_ = services.NotifyUser(user.UserID, "Welcome to MDRRMO San Isidro!",
			fmt.Sprintf("Hi %s, your account has been approved. You're all set to use the app.", firstName),
			nil)
	})

	user.AccountStatus = "active"
	return c.JSON(fiber.Map{
		"message": "User approved successfully.",
		"user":    user.ToResponse(),
	})
}

func RejectUser(c *fiber.Ctx) error {
	var req struct {
		UserID int `json:"user_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "user_id is required."})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("user_id = ? AND role = 'citizen' AND account_status IN ('unverified', 'pending_otp')", req.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Pending citizen verification not found."})
	}

	firstName := "Citizen"
	if user.Profile != nil && user.Profile.FirstName != nil {
		firstName = *user.Profile.FirstName
	}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	username := ""
	if user.Profile != nil && user.Profile.Username != nil {
		username = *user.Profile.Username
	}

	services.SafeGo(func() {
		if email != "" {
			_ = services.SendVerificationDeclinedEmail(firstName, email)
		}
	})

	// Clean up files
	if username != "" {
		_ = os.RemoveAll(filepath.Join(".", "storage", "app", "public", "verification_ids", username))
	}
	_ = os.RemoveAll(filepath.Join(".", "storage", "app", "public", "profiles", fmt.Sprintf("%d", user.UserID)))

	database.DB.Where("user_id = ?", user.UserID).Delete(&models.UserVerification{})
	database.DB.Where("user_id = ?", user.UserID).Delete(&models.UserMedicalProfile{})
	database.DB.Where("user_id = ?", user.UserID).Delete(&models.UserProfile{})
	database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})
	database.DB.Delete(&user)

	websocket.BroadcastUser("rejected", req.UserID)

	return c.JSON(fiber.Map{"message": "User request rejected and deleted."})
}

// ─── Dispatcher Management ────────────────────────────────────────────

func GetDispatchers(c *fiber.Ctx) error {
	var users []models.User
	database.DB.
		Preload("Profile").
		Where("role = 'dispatcher'").
		Order("created_at desc").
		Find(&users)

	resp := make([]models.UserResponse, 0)
	for _, u := range users {
		resp = append(resp, u.ToResponse())
	}

	return c.JSON(resp)
}

type CreateDispatcherRequest struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Phone      string `json:"phone"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	BarangayID int    `json:"barangay_id"`
}

func CreateDispatcher(c *fiber.Ctx) error {
	var req CreateDispatcherRequest
	if err := c.BodyParser(&req); err != nil || req.Email == "" || req.Username == "" || req.Password == "" {
		return c.Status(422).JSON(fiber.Map{"message": "All fields are required."})
	}

	normPhone := support.NormalizePhone(req.Phone)
	if normPhone == nil {
		return c.Status(422).JSON(fiber.Map{"message": "Please enter a valid Philippine mobile number."})
	}

	// Check duplicates
	var count int64
	database.DB.Model(&models.User{}).Where("email = ?", req.Email).Count(&count)
	if count > 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Email is already taken."})
	}

	database.DB.Model(&models.UserProfile{}).Where("username = ?", req.Username).Count(&count)
	if count > 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Username is already taken."})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Password hash error."})
	}
	hashStr := string(hashed)

	now := time.Now()
	user := models.User{
		Email:         &req.Email,
		Password:      &hashStr,
		Role:          "dispatcher",
		AccountStatus: "active",
		CreatedAt:     &now,
		UpdatedAt:     &now,
	}
	if err := database.DB.Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create dispatcher."})
	}

	profile := models.UserProfile{
		UserID:         user.UserID,
		FirstName:      &req.FirstName,
		LastName:       &req.LastName,
		Phone:          normPhone,
		Username:       &req.Username,
		BarangayID:     &req.BarangayID,
		SetupCompleted: true,
		CreatedAt:      &now,
		UpdatedAt:      &now,
	}
	database.DB.Create(&profile)

	return c.Status(201).JSON(fiber.Map{"message": "Dispatcher created successfully!"})
}

type UpdateDispatcherRequest struct {
	UserID     int    `json:"user_id"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	BarangayID int    `json:"barangay_id"`
}

func UpdateDispatcher(c *fiber.Ctx) error {
	var req UpdateDispatcherRequest
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid payload required."})
	}

	normPhone := support.NormalizePhone(req.Phone)
	if normPhone == nil {
		return c.Status(422).JSON(fiber.Map{"message": "Please enter a valid Philippine mobile number."})
	}

	var dispatcher models.User
	if err := database.DB.Preload("Profile").Where("user_id = ? AND role = 'dispatcher'", req.UserID).First(&dispatcher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Dispatcher not found."})
	}

	database.DB.Model(&dispatcher).Update("email", req.Email)

	now := time.Now()
	if dispatcher.Profile != nil {
		database.DB.Model(dispatcher.Profile).Updates(map[string]interface{}{
			"first_name":  &req.FirstName,
			"last_name":   &req.LastName,
			"phone":       normPhone,
			"barangay_id": &req.BarangayID,
			"updated_at":  &now,
		})
	}

	var fresh models.User
	database.DB.Preload("Profile").Where("user_id = ?", dispatcher.UserID).First(&fresh)

	return c.JSON(fiber.Map{
		"message": "Dispatcher updated successfully!",
		"user":    fresh.ToResponse(),
	})
}

func DeactivateDispatcher(c *fiber.Ctx) error {
	var req struct {
		UserID int     `json:"user_id"`
		Reason *string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil || req.UserID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "user_id is required."})
	}

	var dispatcher models.User
	if err := database.DB.Preload("Profile").Where("user_id = ? AND role = 'dispatcher'", req.UserID).First(&dispatcher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Dispatcher not found."})
	}

	reason := "Deactivated by admin."
	if req.Reason != nil && *req.Reason != "" {
		reason = *req.Reason
	}

	now := time.Now()
	database.DB.Model(&dispatcher).Updates(map[string]interface{}{
		"account_status": "banned",
		"ban_reason":     &reason,
		"banned_at":      &now,
	})
	database.DB.Where("tokenable_id = ?", dispatcher.UserID).Delete(&models.PersonalAccessToken{})

	var fresh models.User
	database.DB.Preload("Profile").Where("user_id = ?", dispatcher.UserID).First(&fresh)

	return c.JSON(fiber.Map{
		"message": "Dispatcher deactivated.",
		"user":    fresh.ToResponse(),
	})
}
