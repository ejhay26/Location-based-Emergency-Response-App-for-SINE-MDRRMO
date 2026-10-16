package database

import (
	"fmt"
	"log"
	"os"

	"sine-mdrrmo-backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AutoMigrate runs schema migrations for all models
func AutoMigrate() {
	if DB == nil {
		log.Fatal("Database not initialized")
	}

	DB.Exec("SET FOREIGN_KEY_CHECKS = 0")
	defer DB.Exec("SET FOREIGN_KEY_CHECKS = 1")

	err := DB.AutoMigrate(
		&models.Barangay{},
		&models.IncidentType{},
		&models.User{},
		&models.UserProfile{},
		&models.UserVerification{},
		&models.UserMedicalProfile{},
		&models.EmergencyRequest{},
		&models.Hazard{},
		&models.Broadcast{},
		&models.Dispatch{},
		&models.DeviceToken{},
		&models.PersonalAccessToken{},
		&models.Feedback{},
		&models.UserSetting{},
	)
	if err != nil {
		log.Printf("[Notice] AutoMigrate (tables may already exist): %v", err)
	} else {
		fmt.Println("[Success] Database schema migrated successfully")
	}
}


// Seed populates initial reference data and default accounts if they do not exist
func Seed() {
	if DB == nil {
		return
	}

	// 1. Barangays
	barangays := []models.Barangay{
		{BarangayID: 1, BarangayName: "Alua"},
		{BarangayID: 2, BarangayName: "Calaba"},
		{BarangayID: 3, BarangayName: "Malapit"},
		{BarangayID: 4, BarangayName: "Mangga"},
		{BarangayID: 5, BarangayName: "Poblacion"},
		{BarangayID: 6, BarangayName: "Pulo"},
		{BarangayID: 7, BarangayName: "San Roque"},
		{BarangayID: 8, BarangayName: "Santo Cristo"},
		{BarangayID: 9, BarangayName: "Tabon"},
	}
	for _, b := range barangays {
		DB.Where("barangay_id = ?", b.BarangayID).FirstOrCreate(&b)
	}

	// 2. Incident Types
	incidentTypes := []models.IncidentType{
		{IncidentTypeID: 1, IncidentName: "Fire"},
		{IncidentTypeID: 2, IncidentName: "Flood"},
		{IncidentTypeID: 3, IncidentName: "Medical"},
		{IncidentTypeID: 4, IncidentName: "Crime"},
		{IncidentTypeID: 5, IncidentName: "Others"},
	}
	for _, it := range incidentTypes {
		DB.Where("incident_type_id = ?", it.IncidentTypeID).FirstOrCreate(&it)
	}

	// 3. Default Admin & Dispatcher Users (configured via environment variables)
	adminPass := os.Getenv("DEFAULT_ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "Admin123!"
	}
	dispPass := os.Getenv("DEFAULT_DISPATCHER_PASSWORD")
	if dispPass == "" {
		dispPass = "Dispatcher123!"
	}

	seedUser(
		"admin_user@sine.gov.ph",
		adminPass,
		"admin",
		"Admin",
		"MDRRMO",
		"admin",
		"09123456789",
		5,
	)

	seedUser(
		"dis@mail.com",
		dispPass,
		"dispatcher",
		"Dispatcher",
		"One",
		"dispatcher1",
		"09123456789",
		5,
	)

	fmt.Println("✅ Database seeded successfully")
}

func seedUser(email, plainPass, role, firstName, lastName, username, phone string, barangayId int) {
	var user models.User
	err := DB.Where("email = ?", email).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(plainPass), bcrypt.DefaultCost)
		hashStr := string(hashed)

		user = models.User{
			Email:         &email,
			Password:      &hashStr,
			Role:          role,
			AccountStatus: "active",
		}
		if err := DB.Create(&user).Error; err != nil {
			log.Printf("Failed to seed user %s: %v", email, err)
			return
		}

		profile := models.UserProfile{
			UserID:         user.UserID,
			FirstName:      &firstName,
			LastName:       &lastName,
			Username:       &username,
			Phone:          &phone,
			BarangayID:     &barangayId,
			SetupCompleted: true,
		}
		DB.Create(&profile)
	}
}
