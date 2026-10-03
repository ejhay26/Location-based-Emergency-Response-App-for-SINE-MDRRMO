package handlers

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"

	"github.com/gofiber/fiber/v2"
)

type DailyStat struct {
	Date    string `json:"date"`
	Fire    int    `json:"fire"`
	Flood   int    `json:"flood"`
	Medical int    `json:"medical"`
	Crime   int    `json:"crime"`
	Others  int    `json:"others"`
	Total   int    `json:"total"`
}

type TypeStat struct {
	IncidentName string `json:"incident_name"`
	Total        int    `json:"total"`
}

type BarangayStat struct {
	BarangayName string `json:"barangay_name"`
	Total        int    `json:"total"`
}

type HazardTypeStat struct {
	HazardType string `json:"hazard_type"`
	Total      int    `json:"total"`
}

type HazardDailyStat struct {
	Date       string `json:"date"`
	Flood      int    `json:"flood"`
	Road       int    `json:"road"`
	Tree       int    `json:"tree"`
	Electrical int    `json:"electrical"`
	Others     int    `json:"others"`
	Total      int    `json:"total"`
}

func GetAnalytics(c *fiber.Ctx) error {
	days := 7
	if d := c.Query("days"); d != "" {
		if val, err := strconv.Atoi(d); err == nil && val > 0 {
			days = val
		}
	}

	since := time.Now().AddDate(0, 0, -days)

	// 1. Daily Stats
	var dailyStats []DailyStat
	database.DB.Table("emergency_requests").
		Select(`DATE(emergency_requests.request_time) as date,
			SUM(CASE WHEN incident_types.incident_name = 'Fire'    THEN 1 ELSE 0 END) as fire,
			SUM(CASE WHEN incident_types.incident_name = 'Flood'   THEN 1 ELSE 0 END) as flood,
			SUM(CASE WHEN incident_types.incident_name = 'Medical' THEN 1 ELSE 0 END) as medical,
			SUM(CASE WHEN incident_types.incident_name = 'Crime'   THEN 1 ELSE 0 END) as crime,
			SUM(CASE WHEN incident_types.incident_name = 'Others'  THEN 1 ELSE 0 END) as others,
			COUNT(*) as total`).
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Where("emergency_requests.request_time >= ?", since).
		Group("DATE(emergency_requests.request_time)").
		Order("date ASC").
		Scan(&dailyStats)

	// 2. Type Stats
	var typeStats []TypeStat
	database.DB.Table("emergency_requests").
		Select("incident_types.incident_name, COUNT(*) as total").
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Where("emergency_requests.request_time >= ?", since).
		Group("incident_types.incident_name").
		Scan(&typeStats)

	// 3. Recent Records
	var recentRecords []EmergencyDetailRow
	database.DB.Table("emergency_requests").
		Select("emergency_requests.*, user_profiles.first_name, user_profiles.last_name, user_medical_profiles.blood_type, user_medical_profiles.allergies, user_medical_profiles.medical_conditions, user_medical_profiles.pwd_status, incident_types.incident_name, barangays.barangay_name").
		Joins("JOIN users ON emergency_requests.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Joins("JOIN incident_types ON emergency_requests.incident_type_id = incident_types.incident_type_id").
		Joins("LEFT JOIN barangays ON emergency_requests.barangay_id = barangays.barangay_id").
		Joins("LEFT JOIN user_medical_profiles ON users.user_id = user_medical_profiles.user_id").
		Where("emergency_requests.request_time >= ?", since).
		Order("emergency_requests.request_time DESC").
		Limit(100).
		Scan(&recentRecords)

	for i := range recentRecords {
		if len(recentRecords[i].ProofFiles) == 0 || string(recentRecords[i].ProofFiles) == "null" {
			recentRecords[i].ProofFiles = json.RawMessage("[]")
		}
	}

	// 4. Barangay Stats
	var barangayStats []BarangayStat
	database.DB.Table("emergency_requests").
		Select("barangays.barangay_name, COUNT(*) as total").
		Joins("JOIN barangays ON emergency_requests.barangay_id = barangays.barangay_id").
		Where("emergency_requests.request_time >= ?", since).
		Group("barangays.barangay_name").
		Order("total DESC").
		Scan(&barangayStats)

	// 5. Hazard Stats
	var rawHazardStats []struct {
		HazardType *string `json:"hazard_type"`
		Total      int     `json:"total"`
	}
	database.DB.Table("hazards").
		Select("hazard_type, COUNT(*) as total").
		Where("created_at >= ?", since).
		Group("hazard_type").
		Scan(&rawHazardStats)

	var hazardStats []HazardTypeStat
	for _, r := range rawHazardStats {
		ht := "Others"
		if r.HazardType != nil && strings.TrimSpace(*r.HazardType) != "" {
			ht = strings.TrimSpace(*r.HazardType)
		}
		hazardStats = append(hazardStats, HazardTypeStat{HazardType: ht, Total: r.Total})
	}

	// 6. Hazard Daily Stats
	var hazardDailyStats []HazardDailyStat
	database.DB.Table("hazards").
		Select(`DATE(created_at) as date,
			SUM(CASE WHEN hazard_type = 'Flooded Street' OR hazard_type LIKE '%Flood%' THEN 1 ELSE 0 END) as flood,
			SUM(CASE WHEN hazard_type = 'Road Obstruction' OR hazard_type LIKE '%Road%' OR hazard_type LIKE '%Block%' THEN 1 ELSE 0 END) as road,
			SUM(CASE WHEN hazard_type = 'Fallen Tree' OR hazard_type LIKE '%Tree%' THEN 1 ELSE 0 END) as tree,
			SUM(CASE WHEN hazard_type = 'Downed Wire' OR hazard_type LIKE '%Wire%' OR hazard_type LIKE '%Electric%' THEN 1 ELSE 0 END) as electrical,
			SUM(CASE WHEN (hazard_type IS NULL OR (hazard_type NOT IN ('Flooded Street', 'Road Obstruction', 'Fallen Tree', 'Downed Wire') AND hazard_type NOT LIKE '%Flood%' AND hazard_type NOT LIKE '%Road%' AND hazard_type NOT LIKE '%Tree%' AND hazard_type NOT LIKE '%Wire%')) THEN 1 ELSE 0 END) as others,
			COUNT(*) as total`).
		Where("created_at >= ?", since).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&hazardDailyStats)

	// 7. Hazard Barangay Stats
	var hazardBarangayStats []BarangayStat
	database.DB.Table("hazards").
		Select("barangays.barangay_name, COUNT(*) as total").
		Joins("JOIN barangays ON hazards.barangay_id = barangays.barangay_id").
		Where("hazards.created_at >= ?", since).
		Group("barangays.barangay_name").
		Order("total DESC").
		Scan(&hazardBarangayStats)

	return c.JSON(fiber.Map{
		"daily_stats":           dailyStats,
		"type_stats":            typeStats,
		"recent_records":        recentRecords,
		"barangay_stats":        barangayStats,
		"hazard_stats":          hazardStats,
		"hazard_daily_stats":    hazardDailyStats,
		"hazard_barangay_stats": hazardBarangayStats,
		"timeframe":             days,
	})
}
