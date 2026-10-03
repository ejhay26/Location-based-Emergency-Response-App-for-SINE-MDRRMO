package handlers

import (
	"encoding/json"
	"strconv"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"
	"sine-mdrrmo-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
)

type SubmitHazardRequest struct {
	Description string   `json:"description"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	ProofFiles  []string `json:"proof_files"`
	HazardType  *string  `json:"hazard_type"`
}

func SubmitHazard(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req SubmitHazardRequest
	if err := c.BodyParser(&req); err != nil || req.Description == "" || len(req.ProofFiles) == 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Description, coordinates, and at least 1 proof photo are required."})
	}

	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		return c.Status(422).JSON(fiber.Map{"message": "Coordinates are out of range."})
	}

	proofJSON, err := services.ProcessProofFiles(req.ProofFiles, user.UserID, "hazard", 2)
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Failed to process proof files."})
	}

	var barangayID *int
	if resolved := services.ResolveBarangay(req.Latitude, req.Longitude); resolved != 0 {
		barangayID = &resolved
	}

	now := time.Now()
	status := "Active"
	hazard := models.Hazard{
		UserID:      &user.UserID,
		Description: &req.Description,
		HazardType:  req.HazardType,
		ProofFiles:  &proofJSON,
		Latitude:    &req.Latitude,
		Longitude:   &req.Longitude,
		BarangayID:  barangayID,
		Status:      &status,
		CreatedAt:   &now,
		UpdatedAt:   &now,
	}

	if err := database.DB.Create(&hazard).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to report hazard."})
	}

	websocket.BroadcastHazard("submitted", hazard.HazardID)

	go func() {
		_ = services.NotifyAdminsAndDispatchers(
			"⚠️ Public Hazard Reported",
			"New public road hazard reported in San Isidro.",
			map[string]string{
				"type":      "hazard",
				"hazard_id": strconv.Itoa(hazard.HazardID),
			},
		)
	}()

	return c.JSON(fiber.Map{"message": "Hazard reported successfully!"})
}

func ResolveHazard(c *fiber.Ctx) error {
	var req struct {
		HazardID int `json:"hazard_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.HazardID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid hazard_id is required."})
	}

	database.DB.Model(&models.Hazard{}).Where("hazard_id = ?", req.HazardID).Update("status", "Resolved")

	websocket.BroadcastHazard("resolved", req.HazardID)

	return c.JSON(fiber.Map{"message": "Hazard removed from active monitoring."})
}

type HazardDetailRow struct {
	HazardID       int             `json:"hazard_id"`
	UserID         *int            `json:"user_id"`
	Description    *string         `json:"description"`
	HazardType     *string         `json:"hazard_type"`
	ProofFiles     json.RawMessage `json:"proof_files"`
	Latitude       *float64        `json:"latitude"`
	Longitude      *float64        `json:"longitude"`
	BarangayID     *int            `json:"barangay_id"`
	Status         *string         `json:"status"`
	CreatedAt      *time.Time      `json:"created_at"`
	UpdatedAt      *time.Time      `json:"updated_at"`
	FirstName      *string         `json:"first_name"`
	LastName       *string         `json:"last_name"`
	ProfilePicture *string         `json:"profile_picture"`
	BarangayName   *string         `json:"barangay_name"`
}

func GetActiveHazards(c *fiber.Ctx) error {
	rows := make([]HazardDetailRow, 0)
	err := database.DB.Table("hazards").
		Select("hazards.*, user_profiles.first_name, user_profiles.last_name, user_profiles.profile_picture, barangays.barangay_name").
		Joins("JOIN users ON hazards.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Joins("LEFT JOIN barangays ON hazards.barangay_id = barangays.barangay_id").
		Where("hazards.status = 'Active'").
		Order("hazards.created_at DESC").
		Scan(&rows).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Database query error."})
	}

	for i := range rows {
		if len(rows[i].ProofFiles) == 0 || string(rows[i].ProofFiles) == "null" {
			rows[i].ProofFiles = json.RawMessage("[]")
		}
	}

	return c.JSON(rows)
}
