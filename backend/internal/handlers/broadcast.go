package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"
	"sine-mdrrmo-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
)

type CreateBroadcastRequest struct {
	BroadcastID *int     `json:"broadcast_id"`
	Title       *string  `json:"title"`
	Message     string   `json:"message"`
	BarangayIDs []int    `json:"barangay_ids"`
	MediaFiles  []string `json:"media_files"`
	ScheduledAt *string  `json:"scheduled_at"`
	IsDraft     bool     `json:"is_draft"`
}

func CreateBroadcast(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	userId := 1
	if user != nil {
		userId = user.UserID
	}

	var req CreateBroadcastRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Message is required."})
	}

	// Process media files
	var mediaPaths []string
	for _, m := range req.MediaFiles {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}
		if strings.HasPrefix(m, "http") || strings.HasPrefix(m, "/storage/") || strings.HasPrefix(m, "reports/") {
			mediaPaths = append(mediaPaths, m)
			continue
		}
		path, err := services.ProcessAndStorePublic("broadcast", fmt.Sprintf("reports/broadcasts/%d", userId), "proof", m, userId)
		if err == nil && path != nil {
			mediaPaths = append(mediaPaths, *path)
		}
	}
	mediaJSON, _ := json.Marshal(mediaPaths)
	mediaJSONStr := string(mediaJSON)

	var parsedSchedule *time.Time
	if req.ScheduledAt != nil && *req.ScheduledAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.ScheduledAt); err == nil {
			parsedSchedule = &t
		} else if t, err := time.Parse("2006-01-02 15:04:05", *req.ScheduledAt); err == nil {
			parsedSchedule = &t
		}
	}
	isFuture := parsedSchedule != nil && parsedSchedule.After(time.Now())

	isActive := 1
	isDraft := 0
	if req.IsDraft {
		isActive = 0
		isDraft = 1
	}

	var broadcast models.Broadcast
	now := time.Now()

	if req.BroadcastID != nil && *req.BroadcastID > 0 {
		if err := database.DB.Where("broadcast_id = ?", *req.BroadcastID).First(&broadcast).Error; err == nil {
			broadcast.Title = req.Title
			broadcast.Message = &req.Message
			broadcast.MediaFiles = &mediaJSONStr
			broadcast.IsActive = isActive
			broadcast.IsDraft = isDraft
			broadcast.ScheduledAt = parsedSchedule
			database.DB.Save(&broadcast)

			// Sync barangays
			database.DB.Exec("DELETE FROM broadcast_barangays WHERE broadcast_id = ?", broadcast.BroadcastID)
			for _, bid := range req.BarangayIDs {
				database.DB.Exec("INSERT INTO broadcast_barangays (broadcast_id, barangay_id) VALUES (?, ?)", broadcast.BroadcastID, bid)
			}
		}
	} else {
		broadcast = models.Broadcast{
			Title:       req.Title,
			Message:     &req.Message,
			MediaFiles:  &mediaJSONStr,
			IsActive:    isActive,
			IsDraft:     isDraft,
			ScheduledAt: parsedSchedule,
			CreatedAt:   &now,
		}
		database.DB.Create(&broadcast)
		for _, bid := range req.BarangayIDs {
			database.DB.Exec("INSERT INTO broadcast_barangays (broadcast_id, barangay_id) VALUES (?, ?)", broadcast.BroadcastID, bid)
		}
	}

	location := getLocationLabel(req.BarangayIDs)

	if req.IsDraft {
		websocket.BroadcastMessage("draft_saved", broadcast.BroadcastID)
		return c.JSON(fiber.Map{
			"message":      "Announcement saved as draft for later review.",
			"broadcast_id": broadcast.BroadcastID,
		})
	}

	if !isFuture {
		notifTitle := fmt.Sprintf("SINE MDRRMO Alert — %s", location)
		if req.Title != nil && *req.Title != "" {
			notifTitle = fmt.Sprintf("MDRRMO Alert: %s", *req.Title)
		}

		scope := "town"
		if len(req.BarangayIDs) > 0 {
			scope = "barangay"
		}

		notifData := map[string]string{
			"type":         "broadcast",
			"broadcast_id": strconv.Itoa(broadcast.BroadcastID),
			"scope":        scope,
			"location":     location,
		}
		if req.Title != nil {
			notifData["title"] = *req.Title
		}

		go func() {
			if len(req.BarangayIDs) == 0 {
				_ = services.NotifyAllCitizens(notifTitle, req.Message, notifData)
			} else {
				_ = services.NotifyCitizensInBarangays(req.BarangayIDs, notifTitle, req.Message, notifData)
			}
		}()
	}

	websocket.BroadcastMessage("created", broadcast.BroadcastID)

	respMsg := fmt.Sprintf("Broadcast pushed to %s!", location)
	if isFuture {
		respMsg = fmt.Sprintf("Announcement scheduled for %s (%s)!", parsedSchedule.Format("Jan 02, 2006 03:04 PM"), location)
	}

	return c.JSON(fiber.Map{
		"message":      respMsg,
		"broadcast_id": broadcast.BroadcastID,
	})
}

type FormattedBroadcast struct {
	BroadcastID int             `json:"broadcast_id"`
	Title       string          `json:"title"`
	Message     string          `json:"message"`
	MediaFiles  json.RawMessage `json:"media_files"`
	IsActive    int             `json:"is_active"`
	IsDraft     int             `json:"is_draft"`
	ScheduledAt *string         `json:"scheduled_at"`
	CreatedAt   *time.Time      `json:"created_at"`
	Scope       string          `json:"scope"`
	Location    string          `json:"location"`
	BarangayIDs []int           `json:"barangay_ids"`
}

func GetActiveBroadcast(c *fiber.Ctx) error {
	user := middleware.GetUser(c)

	var all []models.Broadcast
	database.DB.Preload("Barangays").Order("created_at desc").Find(&all)

	// If citizen: only return currently active scheduled or immediate broadcasts
	if user != nil && user.Role == "citizen" {
		var list []FormattedBroadcast
		var userBarangayID int
		if user.Profile != nil && user.Profile.BarangayID != nil {
			userBarangayID = *user.Profile.BarangayID
		}

		now := time.Now()
		for _, b := range all {
			if b.IsDraft == 1 || b.IsActive == 0 {
				continue
			}
			if b.ScheduledAt != nil && b.ScheduledAt.After(now) {
				continue
			}

			// Barangay scope check
			if len(b.Barangays) > 0 {
				matched := false
				for _, bg := range b.Barangays {
					if bg.BarangayID == userBarangayID {
						matched = true
						break
					}
				}
				if !matched {
					continue
				}
			}

			list = append(list, formatBroadcast(b))
		}
		return c.JSON(list)
	}

	// For admin/dispatcher: grouped into drafts, active, scheduled, archived
	var drafts []FormattedBroadcast
	var active []FormattedBroadcast
	var scheduled []FormattedBroadcast
	var archived []FormattedBroadcast

	now := time.Now()
	for _, b := range all {
		fb := formatBroadcast(b)
		if b.IsDraft == 1 {
			drafts = append(drafts, fb)
		} else if b.IsActive == 0 {
			archived = append(archived, fb)
		} else if b.ScheduledAt != nil && b.ScheduledAt.After(now) {
			scheduled = append(scheduled, fb)
		} else {
			active = append(active, fb)
		}
	}

	if len(archived) > 30 {
		archived = archived[:30]
	}

	return c.JSON(fiber.Map{
		"drafts":    drafts,
		"active":    active,
		"scheduled": scheduled,
		"archived":  archived,
	})
}

func ClearBroadcast(c *fiber.Ctx) error {
	var req struct {
		BroadcastID int `json:"broadcast_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.BroadcastID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid broadcast_id is required."})
	}

	var broadcast models.Broadcast
	if err := database.DB.Where("broadcast_id = ?", req.BroadcastID).First(&broadcast).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "Broadcast not found."})
	}

	if broadcast.IsDraft == 1 {
		database.DB.Exec("DELETE FROM broadcast_barangays WHERE broadcast_id = ?", broadcast.BroadcastID)
		database.DB.Delete(&broadcast)
		websocket.BroadcastMessage("deleted", req.BroadcastID)
		return c.JSON(fiber.Map{"message": "Draft announcement discarded."})
	}

	database.DB.Model(&broadcast).Update("is_active", 0)
	websocket.BroadcastMessage("cleared", req.BroadcastID)

	return c.JSON(fiber.Map{"message": "Broadcast alert cleared and moved to archive."})
}

func DeleteDraft(c *fiber.Ctx) error {
	return ClearBroadcast(c)
}

func formatBroadcast(b models.Broadcast) FormattedBroadcast {
	title := ""
	if b.Title != nil {
		title = *b.Title
	}
	msg := ""
	if b.Message != nil {
		msg = *b.Message
	}

	media := json.RawMessage("[]")
	if b.MediaFiles != nil && *b.MediaFiles != "" {
		media = json.RawMessage(*b.MediaFiles)
	}

	var schedStr *string
	if b.ScheduledAt != nil {
		s := b.ScheduledAt.Format(time.RFC3339)
		schedStr = &s
	}

	var bIDs []int
	var bNames []string
	for _, bg := range b.Barangays {
		bIDs = append(bIDs, bg.BarangayID)
		bNames = append(bNames, bg.BarangayName)
	}

	scope := "town"
	location := "Town-wide"
	if len(bNames) > 0 {
		scope = "barangay"
		location = strings.Join(bNames, ", ")
	}

	return FormattedBroadcast{
		BroadcastID: b.BroadcastID,
		Title:       title,
		Message:     msg,
		MediaFiles:  media,
		IsActive:    b.IsActive,
		IsDraft:     b.IsDraft,
		ScheduledAt: schedStr,
		CreatedAt:   b.CreatedAt,
		Scope:       scope,
		Location:    location,
		BarangayIDs: bIDs,
	}
}

func getLocationLabel(ids []int) string {
	if len(ids) == 0 {
		return "Town-wide"
	}
	var names []string
	database.DB.Table("barangays").Where("barangay_id IN ?", ids).Pluck("barangay_name", &names)
	if len(names) == 0 {
		return "Town-wide"
	}
	return strings.Join(names, ", ")
}
