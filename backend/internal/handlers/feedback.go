package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type StoreFeedbackRequest struct {
	Message    string                 `json:"message"`
	Category   *string                `json:"category"`
	Rating     *int                   `json:"rating"`
	DeviceInfo map[string]interface{} `json:"device_info"`
}

func StoreFeedback(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req StoreFeedbackRequest
	if err := c.BodyParser(&req); err != nil || len(strings.TrimSpace(req.Message)) < 5 {
		return c.Status(422).JSON(fiber.Map{"message": "Feedback message must be at least 5 characters."})
	}

	category := "general"
	if req.Category != nil && *req.Category != "" {
		category = *req.Category
	}

	rating := 5
	if req.Rating != nil && *req.Rating >= 1 && *req.Rating <= 5 {
		rating = *req.Rating
	}

	var devInfoJSON *string
	if req.DeviceInfo != nil {
		if b, err := json.Marshal(req.DeviceInfo); err == nil {
			s := string(b)
			devInfoJSON = &s
		}
	}

	now := time.Now()
	fb := models.Feedback{
		UserID:      user.UserID,
		Message:     req.Message,
		Category:    category,
		Rating:      rating,
		Status:      "active",
		DeviceInfo:  devInfoJSON,
		CreatedAt:   &now,
	}

	if err := database.DB.Create(&fb).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to submit feedback."})
	}

	return c.JSON(fiber.Map{
		"message": "Feedback submitted. Thank you!",
		"id":      fb.ID,
	})
}

type FeedbackRow struct {
	ID          uint64          `json:"id"`
	UserID      int             `json:"user_id"`
	Message     string          `json:"message"`
	Category    string          `json:"category"`
	Rating      int             `json:"rating"`
	Status      string          `json:"status"`
	IsForwarded bool            `json:"is_forwarded"`
	ForwardedAt *time.Time      `json:"forwarded_at"`
	DeviceInfo  json.RawMessage `json:"device_info"`
	CreatedAt   *time.Time      `json:"created_at"`
	DeletedAt   *time.Time      `json:"deleted_at"`
	FullName    string          `json:"full_name"`
	Username    *string         `json:"username"`
	Email       *string         `json:"email"`
}

func IndexFeedback(c *fiber.Ctx) error {
	rows := make([]FeedbackRow, 0)
	err := database.DB.Table("feedback").
		Select("feedback.*, CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name, user_profiles.username, users.email").
		Joins("JOIN users ON feedback.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Order("feedback.created_at DESC").
		Scan(&rows).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Database error."})
	}

	for i := range rows {
		if len(rows[i].DeviceInfo) == 0 || string(rows[i].DeviceInfo) == "null" {
			rows[i].DeviceInfo = json.RawMessage("{}")
		}
	}

	return c.JSON(rows)
}

func ForwardBug(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil || id == 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Invalid feedback id."})
	}

	var req struct {
		AdminNotes string `json:"admin_notes"`
	}
	_ = c.BodyParser(&req)

	var row FeedbackRow
	err = database.DB.Table("feedback").
		Select("feedback.*, CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name, user_profiles.username, users.email").
		Joins("JOIN users ON feedback.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Where("feedback.id = ?", id).
		First(&row).Error

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Feedback submission not found."})
	}

	var devInfo map[string]interface{}
	if len(row.DeviceInfo) > 0 {
		_ = json.Unmarshal(row.DeviceInfo, &devInfo)
	}
	if devInfo == nil {
		devInfo = make(map[string]interface{})
	}
	if _, ok := devInfo["user_agent"]; !ok {
		devInfo["user_agent"] = c.Get("User-Agent")
	}

	citizenName := row.FullName
	if citizenName == "" {
		citizenName = "Citizen"
	}
	citizenUsername := "user"
	if row.Username != nil {
		citizenUsername = *row.Username
	}
	citizenEmail := "no-email@sine-mdrrmo.gov.ph"
	if row.Email != nil {
		citizenEmail = *row.Email
	}
	createdStr := ""
	if row.CreatedAt != nil {
		createdStr = row.CreatedAt.Format("2006-01-02 15:04:05")
	}

	err = services.SendTechnicalBugReportEmail(
		int(row.ID),
		citizenName,
		citizenUsername,
		citizenEmail,
		strings.Title(row.Category),
		row.Rating,
		row.Message,
		createdStr,
		devInfo,
		req.AdminNotes,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Could not send bug report email. Please verify mail configuration.",
			"details": err.Error(),
		})
	}

	now := time.Now()
	database.DB.Table("feedback").Where("id = ?", id).Updates(map[string]interface{}{
		"is_forwarded": true,
		"forwarded_at": &now,
	})

	return c.JSON(fiber.Map{
		"message":      "Technical bug report successfully forwarded.",
		"is_forwarded": true,
		"forwarded_at": now.Format(time.RFC3339),
	})
}

func ClearFeedback(c *fiber.Ctx) error {
	now := time.Now()
	database.DB.Table("feedback").Where("status != 'archived'").Updates(map[string]interface{}{
		"status":     "archived",
		"deleted_at": &now,
	})
	return c.JSON(fiber.Map{"message": "All feedback moved to Trash Archive."})
}

func ArchiveFeedbackItem(c *fiber.Ctx) error {
	id := c.Params("id")
	now := time.Now()
	database.DB.Table("feedback").Where("id = ?", id).Updates(map[string]interface{}{
		"status":     "archived",
		"deleted_at": &now,
	})
	return c.JSON(fiber.Map{"message": "Feedback moved to Trash."})
}

func RestoreFeedbackItem(c *fiber.Ctx) error {
	id := c.Params("id")
	database.DB.Table("feedback").Where("id = ?", id).Updates(map[string]interface{}{
		"status":     "active",
		"deleted_at": nil,
	})
	return c.JSON(fiber.Map{"message": "Feedback restored to active list."})
}

func PurgeFeedbackTrash(c *fiber.Ctx) error {
	res := database.DB.Where("status = 'archived'").Delete(&models.Feedback{})
	return c.JSON(fiber.Map{"message": fmt.Sprintf("Permanently purged %d archived feedback items.", res.RowsAffected)})
}

func ExportFeedback(c *fiber.Ctx) error {
	var rows []FeedbackRow
	database.DB.Table("feedback").
		Select("feedback.*, CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name, user_profiles.username, users.email").
		Joins("JOIN users ON feedback.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Order("feedback.created_at DESC").
		Scan(&rows)

	filename := fmt.Sprintf("feedback_export_%s.csv", time.Now().Format("2006-01-02_150405"))
	c.Set("Content-Type", "text/csv; charset=UTF-8")
	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	var buf strings.Builder
	// Write UTF-8 BOM
	buf.WriteString("\xEF\xBB\xBF")

	writer := csv.NewWriter(&buf)
	_ = writer.Write([]string{"ID", "Date & Time", "Citizen Name", "Username", "Email", "Category", "Rating (1-5)", "Status", "Message"})

	for _, r := range rows {
		createdStr := ""
		if r.CreatedAt != nil {
			createdStr = r.CreatedAt.Format("2006-01-02 15:04:05")
		}
		username := ""
		if r.Username != nil {
			username = *r.Username
		}
		email := ""
		if r.Email != nil {
			email = *r.Email
		}

		_ = writer.Write([]string{
			strconv.FormatUint(r.ID, 10),
			createdStr,
			r.FullName,
			username,
			email,
			strings.Title(r.Category),
			fmt.Sprintf("%d / 5 Stars", r.Rating),
			strings.Title(r.Status),
			r.Message,
		})
	}
	writer.Flush()

	return c.SendString(buf.String())
}
