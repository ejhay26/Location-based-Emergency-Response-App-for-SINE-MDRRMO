package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"sine-mdrrmo-backend/internal/config"
	"sine-mdrrmo-backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AutoMigrate runs schema migrations for all models
func AutoMigrate() {
	if DB == nil {
		log.Fatal("Database not initialized")
	}

	if config.AppConfig != nil && config.AppConfig.DBDriver == "sqlite" {
		DB.Exec("PRAGMA foreign_keys = OFF;")
		defer DB.Exec("PRAGMA foreign_keys = ON;")
	} else {
		DB.Exec("SET FOREIGN_KEY_CHECKS = 0")
		defer DB.Exec("SET FOREIGN_KEY_CHECKS = 1")
	}

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

func strPtr(s string) *string { return &s }

// Seed populates initial reference data, accounts, and comprehensive operational mock data across all panels
func Seed() {
	if DB == nil {
		return
	}

	// 1. Barangays (San Isidro, Nueva Ecija)
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

	// 3. Default Admin & Dispatchers
	adminPass := os.Getenv("DEFAULT_ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "Admin123!"
	}
	dispPass := os.Getenv("DEFAULT_DISPATCHER_PASSWORD")
	if dispPass == "" {
		dispPass = "Dispatcher123!"
	}

	adminUser := seedUser("admin_user@sine.gov.ph", adminPass, "admin", "Admin", "MDRRMO", "admin", "639123456789", 5, 0, "")
	dispUser1 := seedUser("dis@mail.com", dispPass, "dispatcher", "Dispatcher", "One", "dispatcher1", "639171002001", 5, 0, "")
	seedUser("roberto.gomez@sine.gov.ph", dispPass, "dispatcher", "Roberto", "Gomez", "disp_roberto", "639173344556", 1, 0, "")
	seedUser("carla.mendoza@sine.gov.ph", dispPass, "dispatcher", "Carla", "Mendoza", "disp_carla", "639187766554", 3, 0, "")

	// 4. Pending Citizen Verifications (Verifications Panel) — valid /assets/*.svg paths
	juanUser := seedCitizenVerification(
		"juan.delacruz@sine.gov.ph", "Citizen123!", "Juan", "Dela Cruz", "juandelacruz", "639171234567", 1,
		"unverified", "Philippine National ID (PhilSys)", "1234-5678-9012-3456",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "O+", "None", "None", "No",
	)
	seedCitizenVerification(
		"maria.santos@sine.gov.ph", "Citizen123!", "Maria Clara", "Santos", "mariasantos", "639189876543", 3,
		"unverified", "Driver's License", "N02-21-123456",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "A+", "None", "None", "No",
	)
	seedCitizenVerification(
		"carlos.reyes@sine.gov.ph", "Citizen123!", "Carlos Miguel", "Reyes", "carlosreyes", "639192233445", 8,
		"unverified", "Philippine Passport", "P8492015B",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "B+", "Aspirin", "None", "No",
	)

	// 5. Active, Strike-Warned, and Suspended Citizens (Citizens Panel)
	elenaUser := seedCitizenVerification(
		"elena.bautista@sine.gov.ph", "Citizen123!", "Elena Mae", "Bautista", "elenamae", "639205556677", 5,
		"active", "PhilHealth ID", "12-345678901-2",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "O+", "Penicillin", "Mild Asthma", "No",
	)
	rafaelUser := seedCitizenVerification(
		"rafael.garcia@sine.gov.ph", "Citizen123!", "Rafael Antonio", "Garcia", "rafaelgarcia", "639178889900", 2,
		"active", "UMID / SSS ID", "01-2345678-9",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "A+", "None", "Hypertension", "No",
	)
	lizaUser := seedCitizenVerification(
		"liza.aquino@sine.gov.ph", "Citizen123!", "Liza Marie", "Aquino", "lizaaquino", "639281112233", 7,
		"active", "Postal ID", "PRN-3106-8821",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		1, "", "B+", "Dust Mites", "None", "No",
	)
	noelUser := seedCitizenVerification(
		"noel.villanueva@sine.gov.ph", "Citizen123!", "Noelito", "Villanueva", "noelvillanueva", "639394445566", 4,
		"active", "PWD ID", "PWD-0349-00142",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		2, "", "AB+", "None", "Type 2 Diabetes", "Yes (Mobility)",
	)
	maritesUser := seedCitizenVerification(
		"marites.cruz@sine.gov.ph", "Citizen123!", "Marites", "Dela Rosa", "maritescruz", "639987654321", 9,
		"active", "Barangay ID", "BRGY-TABON-2026-089",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		0, "", "O-", "Seafood, NSAIDs", "None", "No",
	)
	kevinUser := seedCitizenVerification(
		"kevin.ramos@sine.gov.ph", "Citizen123!", "Kevin Jay", "Ramos", "kevinramos", "639157778899", 6,
		"banned", "Philippine National ID (PhilSys)", "9988-1122-3344-5566",
		"/assets/sample-id-front.svg", "/assets/sample-id-back.svg", "/assets/sample-id-selfie.svg",
		3, "Automatically suspended after 3 false alarm strikes.", "A-", "None", "None", "No",
	)

	// Guard against duplicate operational seed runs
	var existingReqCount int64
	DB.Model(&models.EmergencyRequest{}).Count(&existingReqCount)
	if existingReqCount == 0 {
		now := time.Now().In(config.PhilippineTZ)
		dispatcherID := adminUser.UserID
		if dispUser1 != nil {
			dispatcherID = dispUser1.UserID
		}
		adminID := adminUser.UserID

		// 6. Active Emergencies (4 Active: 3 Pending, 1 Multi-Agency Dispatched — all inside San Isidro GeoJSON bounds)
		seedEmergency(elenaUser.UserID, 1, 5, 15.3032, 120.9060,
			"Visible residential fire and heavy dark smoke near San Isidro Public Market block.",
			"Pending", 0, nil, now.Add(-12*time.Minute), nil, nil)

		seedEmergency(rafaelUser.UserID, 3, 1, 15.3026, 120.8947,
			"Elderly resident experiencing sudden chest pain and shortness of breath at Purok 3.",
			"Pending", 0, nil, now.Add(-25*time.Minute), nil, nil)

		calabaFlood := seedEmergency(maritesUser.UserID, 2, 2, 15.2892, 120.8732,
			"Rapidly rising waist-deep floodwater trapping 4 family members inside residence.",
			"Dispatched", 0, nil, now.Add(-40*time.Minute), nil, nil)
		if calabaFlood != nil {
			dTime := now.Add(-34 * time.Minute)
			DB.Create(&models.Dispatch{
				RequestID: &calabaFlood.RequestID, DispatchedBy: &dispatcherID,
				Agency: strPtr("MDRRMO Rescue Team"), UnitName: strPtr("RES-01 - Rescue Team 1"),
				Notes: strPtr("Deployed rubber boat and swift-water rescue gear."), DispatchTime: &dTime, Status: strPtr("Dispatched"),
			})
			DB.Create(&models.Dispatch{
				RequestID: &calabaFlood.RequestID, DispatchedBy: &dispatcherID,
				Agency: strPtr("Rural Health Unit (RHU / Medical)"), UnitName: strPtr("AMB-01 - Ambulance Alpha"),
				Notes: strPtr("Medical standby team staging at Calaba Brgy Hall."), DispatchTime: &dTime, Status: strPtr("Dispatched"),
			})
		}

		seedEmergency(lizaUser.UserID, 4, 3, 15.3028, 120.9167,
			"Traffic collision and heated altercation blocking northbound lane along Gapan-Olongapo Rd.",
			"Pending", 0, nil, now.Add(-55*time.Minute), nil, nil)

		// 7. Archived Emergencies (Resolved, False Alarms, Cancelled across Today & past 6 days for Log Archive & Analytics)
		archivedSpecs := []struct {
			uid, typeId, brgyId int
			lat, lng            float64
			desc, status        string
			isFalse             int
			ago                 time.Duration
			ag1, u1, ag2, u2    string
		}{
			{juanUser.UserID, 1, 5, 15.3032, 120.9077, "Electrical short circuit grass fire behind San Isidro High School.", "Resolved", 0, 2 * time.Hour, "San Isidro BFP (Firefighters)", "ENG-02 - Fire Engine 2", "", ""},
			{elenaUser.UserID, 3, 7, 15.2836, 120.8805, "Motorcycle slip injury along San Roque feeder road; lacerations treated.", "Resolved", 0, 4 * time.Hour, "Rural Health Unit (RHU / Medical)", "RHU-01 - RHU Mobile Nurse", "MDRRMO Rescue Team", "AMB-01 - Ambulance Alpha"},
			{kevinUser.UserID, 4, 6, 15.2353, 120.9236, "Unverified anonymous disturbance call; patrol found area completely calm.", "Resolved", 1, 26 * time.Hour, "San Isidro PNP (Police)", "PAT-01 - Police Patrol 1", "", ""},
			{noelUser.UserID, 2, 4, 15.2289, 120.9047, "Creek overflow near Mangga footbridge; sandbagging completed with brgy tanods.", "Resolved", 0, 50 * time.Hour, "MDRRMO Rescue Team", "RES-01 - Rescue Team 1", "", ""},
			{lizaUser.UserID, 5, 8, 15.2911, 120.8906, "citizen pressed SOS accidentally while securing phone holster.", "Cancelled", 0, 74 * time.Hour, "", "", "", ""},
			{rafaelUser.UserID, 1, 2, 15.2913, 120.8711, "Dry rice husk pile smoldering near bodega perimeter wall.", "Resolved", 0, 98 * time.Hour, "San Isidro BFP (Firefighters)", "ENG-02 - Fire Engine 2", "MDRRMO Rescue Team", "AMB-02 - Ambulance Bravo"},
			{maritesUser.UserID, 3, 9, 15.2682, 120.9102, "Heat exhaustion case during barangay assembly; stabilized on scene.", "Resolved", 0, 122 * time.Hour, "Rural Health Unit (RHU / Medical)", "RHU-01 - RHU Mobile Nurse", "", ""},
			{kevinUser.UserID, 5, 6, 15.2353, 120.9264, "Repeated prank SOS call near vacant lot — Strike 3 issued.", "Resolved", 1, 146 * time.Hour, "San Isidro PNP (Police)", "PAT-01 - Police Patrol 1", "", ""},
		}

		for _, s := range archivedSpecs {
			reqTime := now.Add(-s.ago)
			resTime := reqTime.Add(22 * time.Minute)
			var resBy *int
			var resAt *time.Time
			if s.status == "Resolved" {
				resBy = &adminID
				resAt = &resTime
			}
			er := seedEmergency(s.uid, s.typeId, s.brgyId, s.lat, s.lng, s.desc, s.status, s.isFalse, resBy, reqTime, resAt, &resTime)
			if er != nil && s.ag1 != "" {
				dTime := reqTime.Add(4 * time.Minute)
				compStatus := "Completed"
				DB.Create(&models.Dispatch{
					RequestID: &er.RequestID, DispatchedBy: &dispatcherID,
					Agency: strPtr(s.ag1), UnitName: strPtr(s.u1),
					Notes: strPtr("Responded and cleared incident."), DispatchTime: &dTime, ArrivalTime: &resTime, Status: &compStatus,
				})
				if s.ag2 != "" {
					DB.Create(&models.Dispatch{
						RequestID: &er.RequestID, DispatchedBy: &dispatcherID,
						Agency: strPtr(s.ag2), UnitName: strPtr(s.u2),
						Notes: strPtr("Joint multi-agency support unit deployed."), DispatchTime: &dTime, ArrivalTime: &resTime, Status: &compStatus,
					})
				}
			}
		}
	}

	// 8. Active & Resolved Hazards (Incident Map + Analytics)
	var hazardCount int64
	DB.Model(&models.Hazard{}).Count(&hazardCount)
	if hazardCount == 0 {
		now := time.Now().In(config.PhilippineTZ)
		hazards := []models.Hazard{
			{UserID: &rafaelUser.UserID, BarangayID: intPtr(2), HazardType: strPtr("Flooded Street"), Description: strPtr("Knee-deep floodwater across Calaba provincial road; avoid with low-clearance vehicles."), Latitude: floatPtr(15.2892), Longitude: floatPtr(120.8753), Status: strPtr("Active"), CreatedAt: timePtr(now.Add(-30 * time.Minute)), UpdatedAt: timePtr(now.Add(-30 * time.Minute))},
			{UserID: &lizaUser.UserID, BarangayID: intPtr(7), HazardType: strPtr("Fallen Tree"), Description: strPtr("Uprooted acacia tree blocking one lane near San Roque chapel."), Latitude: floatPtr(15.2836), Longitude: floatPtr(120.8826), Status: strPtr("Active"), CreatedAt: timePtr(now.Add(-75 * time.Minute)), UpdatedAt: timePtr(now.Add(-75 * time.Minute))},
			{UserID: &elenaUser.UserID, BarangayID: intPtr(3), HazardType: strPtr("Downed Wire"), Description: strPtr("Low-hanging utility line sparking near Malapit elementary crossing."), Latitude: floatPtr(15.3028), Longitude: floatPtr(120.9184), Status: strPtr("Active"), CreatedAt: timePtr(now.Add(-2 * time.Hour)), UpdatedAt: timePtr(now.Add(-2 * time.Hour))},
			{UserID: &maritesUser.UserID, BarangayID: intPtr(9), HazardType: strPtr("Road Obstruction"), Description: strPtr("Spilled gravel cleared by municipal engineering crew."), Latitude: floatPtr(15.2682), Longitude: floatPtr(120.9138), Status: strPtr("Resolved"), CreatedAt: timePtr(now.Add(-28 * time.Hour)), UpdatedAt: timePtr(now.Add(-24 * time.Hour))},
			{UserID: &juanUser.UserID, BarangayID: intPtr(1), HazardType: strPtr("Flooded Street"), Description: strPtr("Temporary drainage clog near Alua market subsided."), Latitude: floatPtr(15.3026), Longitude: floatPtr(120.8963), Status: strPtr("Resolved"), CreatedAt: timePtr(now.Add(-54 * time.Hour)), UpdatedAt: timePtr(now.Add(-50 * time.Hour))},
		}
		for i := range hazards {
			h := hazards[i]
			DB.Create(&h)
		}
	}

	// 9. Broadcast Advisories (Active, Targeted, Scheduled, Draft, Archived)
	var bCount int64
	DB.Model(&models.Broadcast{}).Count(&bCount)
	if bCount == 0 {
		now := time.Now().In(config.PhilippineTZ)
		b1 := models.Broadcast{
			Title: strPtr("PAGASA Orange Rainfall & Flood Advisory"),
			Message: strPtr("Moderate to heavy monsoon rains expected over San Isidro within the next 3 hours. Residents in low-lying riverside areas prepare go-bags and monitor updates."),
			IsActive: 1, IsDraft: 0, CreatedAt: timePtr(now.Add(-45 * time.Minute)),
		}
		DB.Create(&b1)

		b2 := models.Broadcast{
			Title: strPtr("San Isidro River Water Level Monitoring"),
			Message: strPtr("MDRRMO water-level sensor indicates Alert Level 1 along Pampanga River tributaries. Barangay DRRMCs in Alua, Calaba, and Poblacion maintain standby watch."),
			IsActive: 1, IsDraft: 0, CreatedAt: timePtr(now.Add(-3 * time.Hour)),
		}
		DB.Create(&b2)
		for _, bid := range []int{1, 2, 5} {
			DB.Exec("INSERT INTO broadcast_barangays (broadcast_id, barangay_id) VALUES (?, ?)", b2.BroadcastID, bid)
		}

		b3 := models.Broadcast{
			Title: strPtr("Municipal Earthquake & Evacuation Readiness Drill"),
			Message: strPtr("Reminder: Simultaneous Duck-Cover-Hold drill across municipal offices and schools tomorrow at 09:00 AM. Follow marshals to open evacuation zones."),
			IsActive: 1, IsDraft: 0, ScheduledAt: timePtr(now.Add(24 * time.Hour)), CreatedAt: timePtr(now.Add(-6 * time.Hour)),
		}
		DB.Create(&b3)

		b4 := models.Broadcast{
			Title: strPtr("Draft: Weekend Rescue Vehicle Staging Advisory"),
			Message: strPtr("Temporary lane diversion around Poblacion plaza during joint BFP-MDRRMO extrication training."),
			IsActive: 0, IsDraft: 1, CreatedAt: timePtr(now.Add(-12 * time.Hour)),
		}
		DB.Create(&b4)
		DB.Model(&b4).Update("is_active", 0)
		for _, bid := range []int{3, 5} {
			DB.Exec("INSERT INTO broadcast_barangays (broadcast_id, barangay_id) VALUES (?, ?)", b4.BroadcastID, bid)
		}

		b5 := models.Broadcast{
			Title: strPtr("All-Clear: Calaba Feeder Line Power Restored"),
			Message: strPtr("NEECO II linemen completed pole repair in Barangay Calaba. Normal electrical supply has resumed."),
			IsActive: 0, IsDraft: 0, CreatedAt: timePtr(now.Add(-48 * time.Hour)),
		}
		DB.Create(&b5)
		DB.Model(&b5).Update("is_active", 0)
	}

	// 10. Citizen Feedback Records (Feedback Panel)
	var fbCount int64
	DB.Model(&models.Feedback{}).Count(&fbCount)
	if fbCount == 0 {
		now := time.Now().In(config.PhilippineTZ)
		devMeta := `{"platform":"Android PWA","os":"Android 15","app_version":"0.99.4"}`
		feedbacks := []models.Feedback{
			{UserID: elenaUser.UserID, Category: "general", Rating: 5, Status: "active", Message: "Napakabilis ng sagot ng dispatcher nang nag-report kami ng usok malapit sa palengke. Salamat MDRRMO San Isidro!", DeviceInfo: &devMeta, CreatedAt: timePtr(now.Add(-2 * time.Hour))},
			{UserID: rafaelUser.UserID, Category: "suggestion", Rating: 5, Status: "active", Message: "Maganda ang bagong live card frame sa ID scanner — mas madaling ilagay ang senior at PhilSys ID nang hindi nakatagilid.", DeviceInfo: &devMeta, CreatedAt: timePtr(now.Add(-8 * time.Hour))},
			{UserID: lizaUser.UserID, Category: "bug", Rating: 3, Status: "active", IsForwarded: true, ForwardedAt: timePtr(now.Add(-10 * time.Hour)), Message: "Kapag mahina ang signal sa bandang San Roque, matagal mag-refresh ng street map tiles kung naka-zoom in.", DeviceInfo: &devMeta, CreatedAt: timePtr(now.Add(-18 * time.Hour))},
			{UserID: noelUser.UserID, Category: "suggestion", Rating: 4, Status: "active", Message: "Sana may mabilis ding button para makapili kung ambulansya o rescue truck ang kailangan kahit may medical profile na.", DeviceInfo: &devMeta, CreatedAt: timePtr(now.Add(-36 * time.Hour))},
			{UserID: maritesUser.UserID, Category: "general", Rating: 5, Status: "archived", Message: "Duplicate test feedback sent during barangay orientation.", DeviceInfo: &devMeta, CreatedAt: timePtr(now.Add(-72 * time.Hour)), DeletedAt: timePtr(now.Add(-70 * time.Hour))},
		}
		for i := range feedbacks {
			f := feedbacks[i]
			DB.Create(&f)
		}
	}

	fmt.Println("✅ Database seeded successfully")
}

func intPtr(i int) *int              { return &i }
func floatPtr(f float64) *float64    { return &f }
func timePtr(t time.Time) *time.Time { return &t }

func seedEmergency(userId, typeId, brgyId int, lat, lng float64, desc, status string, isFalseAlarm int, resolvedBy *int, reqTime time.Time, resAt *time.Time, updatedAt *time.Time) *models.EmergencyRequest {
	upd := reqTime
	if updatedAt != nil {
		upd = *updatedAt
	}
	req := models.EmergencyRequest{
		UserID:         &userId,
		IncidentTypeID: &typeId,
		Description:    &desc,
		ProofFiles:     strPtr("[]"),
		Latitude:       &lat,
		Longitude:      &lng,
		BarangayID:     &brgyId,
		Status:         &status,
		ResolvedBy:     resolvedBy,
		ResolvedAt:     resAt,
		IsFalseAlarm:   isFalseAlarm,
		RequestTime:    &reqTime,
		CreatedAt:      &reqTime,
		UpdatedAt:      &upd,
	}
	if err := DB.Create(&req).Error; err != nil {
		log.Printf("Failed to seed emergency: %v", err)
		return nil
	}
	return &req
}

func seedCitizenVerification(
	email, plainPass, firstName, lastName, username, phone string,
	barangayId int, status, idType, idNum, frontProof, backProof, selfieProof string,
	strikes int, banReason, bloodType, allergies, conditions, pwdStatus string,
) *models.User {
	var user models.User
	err := DB.Where("email = ?", email).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(plainPass), bcrypt.DefaultCost)
		hashStr := string(hashed)
		now := time.Now().In(config.PhilippineTZ)

		var banPtr *string
		var bannedAtPtr *time.Time
		if banReason != "" {
			banPtr = &banReason
			bannedAtPtr = &now
		}
		var emailVerAt *time.Time
		if status == "active" || status == "unverified" || status == "banned" {
			emailVerAt = &now
		}

		user = models.User{
			Email:             &email,
			EmailVerifiedAt:   emailVerAt,
			Password:          &hashStr,
			Role:              "citizen",
			AccountStatus:     status,
			BanReason:         banPtr,
			BannedAt:          bannedAtPtr,
			FalseAlarmStrikes: strikes,
			CreatedAt:         &now,
			UpdatedAt:         &now,
		}
		if err := DB.Create(&user).Error; err != nil {
			log.Printf("Failed to seed citizen %s: %v", email, err)
			return &user
		}

		profile := models.UserProfile{
			UserID:         user.UserID,
			FirstName:      &firstName,
			LastName:       &lastName,
			Username:       &username,
			Phone:          &phone,
			BarangayID:     &barangayId,
			SetupCompleted: true,
			CreatedAt:      &now,
			UpdatedAt:      &now,
		}
		DB.Create(&profile)

		verifStatus := "pending"
		if status == "active" {
			verifStatus = "approved"
		} else if status == "banned" {
			verifStatus = "approved"
		}
		verif := models.UserVerification{
			UserID:             user.UserID,
			ValidIDType:        &idType,
			ValidIDNumber:      &idNum,
			ValidIDProof:       &frontProof,
			ValidIDProofBack:   &backProof,
			SelfieWithIDProof:  &selfieProof,
			VerificationStatus: verifStatus,
			CreatedAt:          &now,
			UpdatedAt:          &now,
		}
		DB.Create(&verif)

		if bloodType != "" {
			med := models.UserMedicalProfile{
				UserID:            user.UserID,
				BloodType:         &bloodType,
				Allergies:         &allergies,
				MedicalConditions: &conditions,
				PWDStatus:         &pwdStatus,
				CreatedAt:         &now,
				UpdatedAt:         &now,
			}
			DB.Create(&med)
		}
	}
	return &user
}

func seedUser(email, plainPass, role, firstName, lastName, username, phone string, barangayId, strikes int, banReason string) *models.User {
	var user models.User
	err := DB.Where("email = ?", email).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(plainPass), bcrypt.DefaultCost)
		hashStr := string(hashed)
		now := time.Now().In(config.PhilippineTZ)

		user = models.User{
			Email:             &email,
			EmailVerifiedAt:   &now,
			Password:          &hashStr,
			Role:              role,
			AccountStatus:     "active",
			FalseAlarmStrikes: strikes,
			CreatedAt:         &now,
			UpdatedAt:         &now,
		}
		if err := DB.Create(&user).Error; err != nil {
			log.Printf("Failed to seed user %s: %v", email, err)
			return &user
		}

		profile := models.UserProfile{
			UserID:         user.UserID,
			FirstName:      &firstName,
			LastName:       &lastName,
			Username:       &username,
			Phone:          &phone,
			BarangayID:     &barangayId,
			SetupCompleted: true,
			CreatedAt:      &now,
			UpdatedAt:      &now,
		}
		DB.Create(&profile)
	}
	return &user
}
