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

type SubmitSosRequest struct {
	IncidentTypeID int      `json:"incident_type_id"`
	Latitude       float64  `json:"latitude"`
	Longitude      float64  `json:"longitude"`
	ProofFiles     []string `json:"proof_files"`
	Description    *string  `json:"description"`
}

func SubmitSos(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req SubmitSosRequest
	if err := c.BodyParser(&req); err != nil || req.IncidentTypeID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid incident type and location are required."})
	}

	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		return c.Status(422).JSON(fiber.Map{"message": "Coordinates are out of range."})
	}

	// Check if already active
	var activeCount int64
	database.DB.Model(&models.EmergencyRequest{}).
		Where("user_id = ? AND status IN ('Pending', 'Dispatched') AND deleted_at IS NULL", user.UserID).
		Count(&activeCount)
	if activeCount > 0 {
		return c.Status(429).JSON(fiber.Map{"message": "You already have an active emergency request!"})
	}

	// Process proof files
	var proofFilesJSON *string
	if len(req.ProofFiles) > 0 {
		jsonStr, err := services.ProcessProofFiles(req.ProofFiles, user.UserID, "sos", 2)
		if err == nil {
			proofFilesJSON = &jsonStr
		}
	}

	// Server-side authoritative barangay resolution
	var barangayID *int
	if resolved := services.ResolveBarangay(req.Latitude, req.Longitude); resolved != 0 {
		barangayID = &resolved
	}

	now := time.Now()
	status := "Pending"
	created := models.EmergencyRequest{
		UserID:         &user.UserID,
		IncidentTypeID: &req.IncidentTypeID,
		Description:    req.Description,
		ProofFiles:     proofFilesJSON,
		Latitude:       &req.Latitude,
		Longitude:      &req.Longitude,
		BarangayID:     barangayID,
		Status:         &status,
		RequestTime:    &now,
		CreatedAt:      &now,
		UpdatedAt:      &now,
	}

	if err := database.DB.Create(&created).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to submit emergency request."})
	}

	// Real-time broadcast
	websocket.BroadcastEmergency("submitted", created.RequestID)

	// Send Push Notification
	go func() {
		_ = services.NotifyAdminsAndDispatchers(
			"🚨 Emergency SOS Received",
			"New emergency request pending response in San Isidro.",
			map[string]string{
				"type":       "emergency",
				"request_id": strconv.Itoa(created.RequestID),
			},
		)
	}()

	return c.Status(201).JSON(fiber.Map{
		"message":    "Emergency SOS sent!",
		"request_id": created.RequestID,
	})
}

func CancelEmergency(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	var req struct {
		RequestID int `json:"request_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.RequestID <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid request_id is required."})
	}

	query := database.DB.Model(&models.EmergencyRequest{}).
		Where("request_id = ? AND status = 'Pending' AND deleted_at IS NULL", req.RequestID)

	if !middleware.TokenCan(c, "admin") && !middleware.TokenCan(c, "dispatcher") {
		query = query.Where("user_id = ?", user.UserID)
	}

	res := query.Update("status", "Cancelled")
	if res.RowsAffected > 0 {
		websocket.BroadcastEmergency("cancelled", req.RequestID)
		return c.JSON(fiber.Map{"message": "Emergency request cancelled."})
	}

	return c.Status(400).JSON(fiber.Map{"message": "Cannot cancel — request may already be dispatched or was not found."})
}

type EmergencyDetailRow struct {
	RequestID         int             `json:"request_id"`
	UserID            *int            `json:"user_id"`
	IncidentTypeID    *int            `json:"incident_type_id"`
	ProofFiles        json.RawMessage `json:"proof_files"`
	Description       *string         `json:"description"`
	Latitude          *float64        `json:"latitude"`
	Longitude         *float64        `json:"longitude"`
	BarangayID        *int            `json:"barangay_id"`
	Status            *string         `json:"status"`
	RequestTime       *time.Time      `json:"request_time"`
	CreatedAt         *time.Time      `json:"created_at"`
	UpdatedAt         *time.Time      `json:"updated_at"`
	IsFalseAlarm      int             `json:"is_false_alarm"`
	FirstName         *string         `json:"first_name"`
	LastName          *string         `json:"last_name"`
	Phone             *string         `json:"phone"`
	ProfilePicture    *string         `json:"profile_picture"`
	BloodType         *string         `json:"blood_type"`
	Allergies         *string         `json:"allergies"`
	MedicalConditions *string         `json:"medical_conditions"`
	PWDStatus         *string         `json:"pwd_status"`
	FalseAlarmStrikes int             `json:"false_alarm_strikes"`
	IncidentName      string          `json:"incident_name"`
	BarangayName      *string         `json:"barangay_name"`
}

func GetActiveEmergencies(c *fiber.Ctx) error {
	rows := make([]EmergencyDetailRow, 0)
	err := database.DB.Table("emergency_requests").
		Select("emergency_requests.*, user_profiles.first_name, user_profiles.last_name, user_profiles.phone, user_profiles.profile_picture, user_medical_profiles.blood_type, user_medical_profiles.allergies, user_medical_profiles.medical_conditions, user_medical_profiles.pwd_status, users.false_alarm_strikes, incident_types.incident_name, barangays.barangay_name").
		Joins("JOIN users ON emergency_requests.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Joins("LEFT JOIN barangays ON emergency_requests.barangay_id = barangays.barangay_id").
		Joins("LEFT JOIN user_medical_profiles ON users.user_id = user_medical_profiles.user_id").
		Where("emergency_requests.status IN ('Pending', 'Dispatched') AND emergency_requests.deleted_at IS NULL").
		Order("emergency_requests.request_time DESC").
		Scan(&rows).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Database query error."})
	}

	normalizeProofFiles(rows)
	return c.JSON(rows)
}

func GetArchivedEmergencies(c *fiber.Ctx) error {
	rows := make([]EmergencyDetailRow, 0)
	err := database.DB.Table("emergency_requests").
		Select("emergency_requests.*, user_profiles.first_name, user_profiles.last_name, user_profiles.phone, user_profiles.profile_picture, user_medical_profiles.blood_type, user_medical_profiles.allergies, user_medical_profiles.medical_conditions, user_medical_profiles.pwd_status, users.false_alarm_strikes, incident_types.incident_name, barangays.barangay_name").
		Joins("JOIN users ON emergency_requests.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Joins("LEFT JOIN barangays ON emergency_requests.barangay_id = barangays.barangay_id").
		Joins("LEFT JOIN user_medical_profiles ON users.user_id = user_medical_profiles.user_id").
		Where("emergency_requests.status IN ('Resolved', 'Cancelled') AND emergency_requests.deleted_at IS NULL").
		Order("emergency_requests.request_time DESC").
		Scan(&rows).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Database query error."})
	}

	normalizeProofFiles(rows)
	return c.JSON(rows)
}

func GetMyEmergencies(c *fiber.Ctx) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated."})
	}

	targetID := user.UserID
	if param := c.Params("user_id"); param != "" {
		if id, err := strconv.Atoi(param); err == nil && id != 0 {
			if id != user.UserID && !middleware.TokenCan(c, "admin") && !middleware.TokenCan(c, "dispatcher") {
				return c.Status(403).JSON(fiber.Map{"message": "Unauthorized to view emergencies for another user."})
			}
			targetID = id
		}
	}

	rows := make([]EmergencyDetailRow, 0)
	err := database.DB.Table("emergency_requests").
		Select("emergency_requests.*, incident_types.incident_name").
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Where("emergency_requests.user_id = ? AND emergency_requests.deleted_at IS NULL", targetID).
		Order("emergency_requests.request_time DESC").
		Scan(&rows).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Database query error."})
	}

	normalizeProofFiles(rows)
	return c.JSON(rows)
}

func normalizeProofFiles(rows []EmergencyDetailRow) {
	for i := range rows {
		if len(rows[i].ProofFiles) == 0 || string(rows[i].ProofFiles) == "null" {
			rows[i].ProofFiles = json.RawMessage("[]")
		}
	}
}
