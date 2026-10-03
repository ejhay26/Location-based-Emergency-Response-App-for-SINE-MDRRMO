package handlers

import (
	"encoding/json"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/models"
	"sine-mdrrmo-backend/internal/services"
	"sine-mdrrmo-backend/internal/support"
	"sine-mdrrmo-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9._]{3,20}$`)

func Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── Login ─────────────────────────────────────────────────────────────

type LoginRequest struct {
	Login      string `json:"login"`
	Password   string `json:"password"`
	DeviceName string `json:"device_name"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil || req.Login == "" || req.Password == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Email/username and password are required."})
	}

	loginInput := strings.TrimSpace(req.Login)
	isEmail := strings.Contains(loginInput, "@")

	var user models.User
	query := database.DB.
		Preload("Profile").
		Preload("Verification").
		Preload("MedicalProfile")

	if isEmail {
		query = query.Where("email = ?", strings.ToLower(loginInput))
	} else {
		query = query.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Where("user_profiles.username = ?", strings.ToLower(loginInput))
	}

	err := query.First(&user).Error
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"message": "Invalid email or password."})
	}

	if user.AccountStatus == "pending_otp" {
		return c.Status(403).JSON(fiber.Map{
			"message": "Please verify the OTP code sent to your email to complete registration.",
			"reason":  "pending_otp",
			"email":   user.Email,
		})
	}
	if user.AccountStatus == "unverified" {
		return c.Status(403).JSON(fiber.Map{
			"message": "Your account registration is currently pending admin verification review.",
			"reason":  "unverified",
		})
	}
	if user.AccountStatus == "banned" {
		return c.Status(403).JSON(fiber.Map{
			"message": "This account has been suspended.",
			"reason":  "banned",
		})
	}

	if user.Password == nil || bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(req.Password)) != nil {
		return c.Status(401).JSON(fiber.Map{"message": "Invalid email or password."})
	}

	deviceName := req.DeviceName
	if deviceName == "" {
		deviceName = "app-token"
	}

	// Enforce single-device login: revoke all prior access tokens so any other logged-in device is immediately logged off
	database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})
	websocket.BroadcastUser("force-logout", user.UserID)

	var abilities []string
	switch user.Role {
	case "admin":
		abilities = []string{"admin", "dispatcher", "citizen"}
	case "dispatcher":
		abilities = []string{"dispatcher"}
	default:
		abilities = []string{"citizen"}
	}

	token, err := middleware.CreatePersonalAccessToken(user.UserID, deviceName, abilities)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create access token."})
	}

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"token":   token,
		"user":    user.ToResponse(),
		"role":    user.Role,
	})
}

// ─── Login with OTP ────────────────────────────────────────────────────

type LoginSendOtpRequest struct {
	OtpChannel string `json:"otp_channel"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
}

func LoginSendOtp(c *fiber.Ctx) error {
	var req LoginSendOtpRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Invalid payload."})
	}

	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	var user models.User
	var normalizedPhone *string
	var identifier string

	if channel == "phone" {
		if strings.TrimSpace(req.Phone) == "" {
			return c.Status(422).JSON(fiber.Map{"message": "Phone number is required."})
		}
		normalizedPhone = support.NormalizePhone(req.Phone)
		if normalizedPhone == nil {
			return c.Status(422).JSON(fiber.Map{"message": "Please enter a valid Philippine mobile number."})
		}
		identifier = *normalizedPhone
		err := database.DB.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Preload("Profile").
			Where("user_profiles.phone = ?", *normalizedPhone).
			First(&user).Error
		if err != nil {
			return c.JSON(fiber.Map{"message": "If that account exists, an OTP was sent."})
		}
	} else {
		if strings.TrimSpace(req.Email) == "" {
			return c.Status(422).JSON(fiber.Map{"message": "Email is required."})
		}
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
		err := database.DB.Preload("Profile").Where("email = ?", identifier).First(&user).Error
		if err != nil {
			return c.JSON(fiber.Map{"message": "If that account exists, an OTP was sent."})
		}
	}

	if user.AccountStatus == "banned" {
		return c.JSON(fiber.Map{"message": "If that account exists, an OTP was sent."})
	}
	if user.AccountStatus == "unverified" {
		return c.Status(403).JSON(fiber.Map{
			"message": "Your account is pending admin verification.",
			"reason":  "unverified",
		})
	}

	cacheKey := fmt.Sprintf("login_otp_%s_%s", channel, identifier)
	res := services.GetOtpService().RequestOtp(cacheKey, 10)
	if _, blocked := res["blocked"]; blocked {
		return c.JSON(fiber.Map{"message": "If that account exists, an OTP was sent."})
	}

	otp, _ := res["otp"].(int)
	otpStr := services.FormatOtp(otp)
	log.Info().Str("channel", channel).Str("identifier", identifier).Str("otp", otpStr).Msg("Login OTP generated")

	smsFailed := false
	if channel == "phone" && user.Profile != nil && user.Profile.Phone != nil {
		phone := *user.Profile.Phone
		if err := services.SendPhilSmsOtp(phone, otpStr, "logging in"); err != nil {
			smsFailed = true
			if user.Email != nil {
				_ = services.SendOtpEmail(*user.Email, otpStr, "logging in (SMS fallback)")
			}
		}
	} else if user.Email != nil {
		_ = services.SendOtpEmail(*user.Email, otpStr, "logging in")
	}

	msg := "If that account exists, an OTP was sent."
	if smsFailed {
		msg = "If that account exists, an OTP was sent to your email (SMS gateway was unavailable)."
	}
	return c.JSON(fiber.Map{"message": msg})
}

type LoginVerifyOtpRequest struct {
	OtpChannel string `json:"otp_channel"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Otp        int    `json:"otp"`
	DeviceName string `json:"device_name"`
}

func LoginVerifyOtp(c *fiber.Ctx) error {
	var req LoginVerifyOtpRequest
	if err := c.BodyParser(&req); err != nil || req.Otp <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid OTP is required."})
	}

	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	var identifier string
	var user models.User

	if channel == "phone" {
		norm := support.NormalizePhone(req.Phone)
		if norm == nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired code."})
		}
		identifier = *norm
		if err := database.DB.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Preload("Profile").Preload("Verification").Preload("MedicalProfile").
			Where("user_profiles.phone = ?", identifier).First(&user).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired code."})
		}
	} else {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
		if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
			Where("email = ?", identifier).First(&user).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired code."})
		}
	}

	cacheKey := fmt.Sprintf("login_otp_%s_%s", channel, identifier)
	if !services.GetOtpService().Verify(cacheKey, req.Otp) {
		return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired code."})
	}

	deviceName := req.DeviceName
	if deviceName == "" {
		deviceName = "app-token"
	}

	// Enforce single-device login: revoke all prior access tokens so any other logged-in device is immediately logged off
	database.DB.Where("tokenable_id = ?", user.UserID).Delete(&models.PersonalAccessToken{})
	websocket.BroadcastUser("force-logout", user.UserID)

	var abilities []string
	switch user.Role {
	case "admin":
		abilities = []string{"admin", "dispatcher", "citizen"}
	case "dispatcher":
		abilities = []string{"dispatcher"}
	default:
		abilities = []string{"citizen"}
	}

	token, err := middleware.CreatePersonalAccessToken(user.UserID, deviceName, abilities)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create access token."})
	}

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"token":   token,
		"user":    user.ToResponse(),
		"role":    user.Role,
	})
}

// ─── Registration ──────────────────────────────────────────────────────

type RegisterRequest struct {
	FirstName         string          `json:"first_name"`
	LastName          string          `json:"last_name"`
	Phone             string          `json:"phone"`
	Birthdate         string          `json:"birthdate"`
	Username          string          `json:"username"`
	Email             string          `json:"email"`
	Password          string          `json:"password"`
	BarangayID        int             `json:"barangay_id"`
	ValidIDImage      string          `json:"valid_id_image"`
	ValidIDImageBack  string          `json:"valid_id_image_back"`
	ValidIDType       string          `json:"valid_id_type"`
	ValidIDNumber     *string         `json:"valid_id_number"`
	ValidIDExpiry     *string         `json:"valid_id_expiry"`
	ValidIDDetails    json.RawMessage `json:"valid_id_details"`
	SelfieWithIDImage string          `json:"selfie_with_id_image"`
	OtpChannel        string          `json:"otp_channel"`
}

func Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Invalid request body."})
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Password == "" || req.Username == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Required fields are missing."})
	}

	if !usernameRegex.MatchString(req.Username) {
		return c.Status(422).JSON(fiber.Map{"message": "Username must be 3-20 alphanumeric characters or ._"})
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Please enter a valid email address."})
	}

	if len(req.Password) < 8 {
		return c.Status(422).JSON(fiber.Map{"message": "Password must be at least 8 characters."})
	}

	normPhone := support.NormalizePhone(req.Phone)
	if normPhone == nil {
		return c.Status(422).JSON(fiber.Map{"message": "Please enter a valid Philippine mobile number."})
	}

	// Check if ID number already exists
	if req.ValidIDNumber != nil && strings.TrimSpace(*req.ValidIDNumber) != "" {
		cleanNum := strings.TrimSpace(*req.ValidIDNumber)
		var existingIDCount int64
		database.DB.Table("user_verifications").
			Joins("JOIN users ON user_verifications.user_id = users.user_id").
			Where("user_verifications.valid_id_number = ? AND users.account_status IN ('active', 'unverified', 'pending_otp')", cleanNum).
			Count(&existingIDCount)
		if existingIDCount > 0 {
			return c.Status(422).JSON(fiber.Map{"message": "This ID number has already been registered or is pending review."})
		}
	}

	// Check if email, username, or phone already taken in active/unverified/banned
	var existingUser models.User
	err := database.DB.Joins("LEFT JOIN user_profiles ON user_profiles.user_id = users.user_id").
		Preload("Profile").
		Where("users.account_status IN ('active', 'unverified', 'banned') AND (users.email = ? OR user_profiles.username = ? OR user_profiles.phone = ?)",
			req.Email, req.Username, *normPhone).
		First(&existingUser).Error
	if err == nil {
		if existingUser.Profile != nil && existingUser.Profile.Username != nil && *existingUser.Profile.Username == req.Username {
			return c.Status(422).JSON(fiber.Map{"message": "This username is already registered."})
		}
		if existingUser.Email != nil && *existingUser.Email == req.Email {
			return c.Status(422).JSON(fiber.Map{"message": "This email address is already registered."})
		}
		return c.Status(422).JSON(fiber.Map{"message": "This phone number is already registered."})
	}

	// Prune stale pending_otp registrations for same email/username/phone
	var staleUsers []models.User
	database.DB.Joins("LEFT JOIN user_profiles ON user_profiles.user_id = users.user_id").
		Where("users.account_status = 'pending_otp' AND (users.email = ? OR user_profiles.username = ? OR user_profiles.phone = ?)",
			req.Email, req.Username, *normPhone).
		Find(&staleUsers)
	for _, su := range staleUsers {
		database.DB.Where("user_id = ?", su.UserID).Delete(&models.UserVerification{})
		database.DB.Where("user_id = ?", su.UserID).Delete(&models.UserProfile{})
		database.DB.Where("user_id = ?", su.UserID).Delete(&models.UserMedicalProfile{})
		database.DB.Delete(&su)
	}

	// Process ID images
	idBinary, err := services.DecodeBase64(req.ValidIDImage)
	if err != nil || !services.CheckSize(idBinary, "id") {
		return c.Status(422).JSON(fiber.Map{"message": "Your ID photo failed to process or exceeds 10 MB."})
	}
	_, idExt, ok := services.DetectMime(idBinary)
	if !ok {
		return c.Status(422).JSON(fiber.Map{"message": "ID photo must be a PNG or JPEG image."})
	}

	idBackBinary, err := services.DecodeBase64(req.ValidIDImageBack)
	if err != nil || !services.CheckSize(idBackBinary, "id") {
		return c.Status(422).JSON(fiber.Map{"message": "Your ID (back) photo failed to process or exceeds 10 MB."})
	}
	_, idBackExt, ok := services.DetectMime(idBackBinary)
	if !ok {
		return c.Status(422).JSON(fiber.Map{"message": "ID (back) photo must be a PNG or JPEG image."})
	}

	selfieBinary, err := services.DecodeBase64(req.SelfieWithIDImage)
	if err != nil || !services.CheckSize(selfieBinary, "id") {
		return c.Status(422).JSON(fiber.Map{"message": "Your selfie photo failed to process or exceeds 10 MB."})
	}
	_, selfieExt, ok := services.DetectMime(selfieBinary)
	if !ok {
		return c.Status(422).JSON(fiber.Map{"message": "Selfie photo must be a PNG or JPEG image."})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to encrypt password."})
	}
	hashStr := string(hashedPassword)

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	now := time.Now()
	newUser := models.User{
		Email:         &req.Email,
		Password:      &hashStr,
		Role:          "citizen",
		AccountStatus: "pending_otp",
		CreatedAt:     &now,
		UpdatedAt:     &now,
	}
	if err := tx.Create(&newUser).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create user account."})
	}

	var parsedBirthdate *time.Time
	if req.Birthdate != "" {
		if t, err := time.Parse("2006-01-02", req.Birthdate); err == nil {
			parsedBirthdate = &t
		}
	}

	newProfile := models.UserProfile{
		UserID:         newUser.UserID,
		FirstName:      &req.FirstName,
		LastName:       &req.LastName,
		Phone:          normPhone,
		Birthdate:      parsedBirthdate,
		Username:       &req.Username,
		BarangayID:     &req.BarangayID,
		SetupCompleted: false,
		CreatedAt:      &now,
		UpdatedAt:      &now,
	}
	if err := tx.Create(&newProfile).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create user profile."})
	}

	// Store files
	idPath := fmt.Sprintf("verification_ids/%s/id_%s_%s.%s", req.Username, now.Format("20060102150405"), services.MakeFilename("id", newUser.UserID, idExt), idExt)
	idUrl, _ := services.StorePublic(idPath, idBinary)

	idBackPath := fmt.Sprintf("verification_ids/%s/id_back_%s_%s.%s", req.Username, now.Format("20060102150405"), services.MakeFilename("id_back", newUser.UserID, idBackExt), idBackExt)
	idBackUrl, _ := services.StorePublic(idBackPath, idBackBinary)

	selfiePath := fmt.Sprintf("verification_ids/%s/selfie_%s_%s.%s", req.Username, now.Format("20060102150405"), services.MakeFilename("selfie", newUser.UserID, selfieExt), selfieExt)
	selfieUrl, _ := services.StorePublic(selfiePath, selfieBinary)

	var parsedExpiry *time.Time
	if req.ValidIDExpiry != nil && *req.ValidIDExpiry != "" {
		if t, err := time.Parse("2006-01-02", *req.ValidIDExpiry); err == nil {
			parsedExpiry = &t
		}
	}

	newVerification := models.UserVerification{
		UserID:             newUser.UserID,
		ValidIDType:        &req.ValidIDType,
		ValidIDNumber:      req.ValidIDNumber,
		ValidIDExpiry:      parsedExpiry,
		ValidIDDetails:     &req.ValidIDDetails,
		ValidIDProof:       &idUrl,
		ValidIDProofBack:   &idBackUrl,
		SelfieWithIDProof:  &selfieUrl,
		VerificationStatus: "pending",
		CreatedAt:          &now,
		UpdatedAt:          &now,
	}
	if err := tx.Create(&newVerification).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"message": "Failed to create verification record."})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to finalize registration."})
	}

	// Send Registration OTP
	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}
	otp := services.GetOtpService().GenerateAndStore("otp_"+req.Email, 15)
	otpStr := services.FormatOtp(otp)
	log.Info().Str("email", req.Email).Str("otp", otpStr).Msg("Registration OTP generated")

	smsFailed := false
	if channel == "sms" && normPhone != nil {
		if err := services.SendPhilSmsOtp(*normPhone, otpStr, "account registration"); err != nil {
			smsFailed = true
			_ = services.SendOtpEmail(req.Email, otpStr, "verifying your new account (SMS fallback)")
		}
	} else {
		_ = services.SendOtpEmail(req.Email, otpStr, "verifying your new account")
	}

	msg := "Verification code sent."
	if smsFailed {
		msg = "Verification code generated and sent to your email (SMS gateway was unavailable)."
	}
	return c.JSON(fiber.Map{"message": msg})
}

// ─── Verify Registration OTP ───────────────────────────────────────────

type VerifyOtpRequest struct {
	Email string `json:"email"`
	Otp   int    `json:"otp"`
}

func VerifyOtp(c *fiber.Ctx) error {
	var req VerifyOtpRequest
	if err := c.BodyParser(&req); err != nil || req.Otp <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid email and OTP required."})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !services.GetOtpService().Verify("otp_"+email, req.Otp) {
		return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
	}

	var user models.User
	if err := database.DB.Preload("Profile").Preload("Verification").Preload("MedicalProfile").
		Where("email = ?", email).First(&user).Error; err == nil {
		now := time.Now()
		database.DB.Model(&user).Updates(map[string]interface{}{
			"account_status":    "unverified",
			"email_verified_at": &now,
		})
		user.AccountStatus = "unverified"
		user.EmailVerifiedAt = &now
		return c.JSON(fiber.Map{
			"message": "Verification successful. Your account is now pending admin verification.",
			"user":    user.ToResponse(),
			"role":    user.Role,
		})
	}

	return c.Status(400).JSON(fiber.Map{"message": "Account not found."})
}

func ResendRegistrationOtp(c *fiber.Ctx) error {
	var req struct {
		Email      string `json:"email"`
		OtpChannel string `json:"otp_channel"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Email is required."})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	var user models.User
	if err := database.DB.Preload("Profile").Where("email = ? AND account_status IN ('unverified', 'pending_otp')", email).First(&user).Error; err != nil {
		return c.JSON(fiber.Map{"message": "If a pending registration exists, a new code was sent."})
	}

	res := services.GetOtpService().RequestOtp("otp_"+email, 15)
	if _, blocked := res["blocked"]; blocked {
		return c.JSON(fiber.Map{"message": "If a pending registration exists, a new code was sent."})
	}

	otp, _ := res["otp"].(int)
	otpStr := services.FormatOtp(otp)
	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	smsFailed := false
	if channel == "sms" && user.Profile != nil && user.Profile.Phone != nil {
		if err := services.SendPhilSmsOtp(*user.Profile.Phone, otpStr, "account registration"); err != nil {
			smsFailed = true
			_ = services.SendOtpEmail(email, otpStr, "verifying your new account (SMS fallback)")
		}
	} else {
		_ = services.SendOtpEmail(email, otpStr, "verifying your new account")
	}

	msg := "If a pending registration exists, a new code was sent."
	if smsFailed {
		msg = "A new code was sent to your email (SMS gateway was unavailable)."
	}
	return c.JSON(fiber.Map{"message": msg})
}

// ─── Username / Email Checks ───────────────────────────────────────────

func CheckUsername(c *fiber.Ctx) error {
	requested := strings.TrimSpace(c.Query("username"))
	if requested != "" && !usernameRegex.MatchString(requested) {
		return c.JSON(fiber.Map{
			"available":   false,
			"reason":      "invalid_format",
			"suggestions": []string{},
		})
	}

	var count int64
	database.DB.Table("user_profiles").
		Joins("JOIN users ON user_profiles.user_id = users.user_id").
		Where("user_profiles.username = ? AND users.account_status != 'unverified'", requested).
		Count(&count)

	exists := count > 0
	suggestions := []string{}

	if exists {
		for i := 1; i <= 4; i++ {
			cand := fmt.Sprintf("%s_%d", requested, 10*i+i)
			var cCount int64
			database.DB.Table("user_profiles").Where("username = ?", cand).Count(&cCount)
			if cCount == 0 {
				suggestions = append(suggestions, cand)
			}
		}
	}

	reason := ""
	if exists {
		reason = "taken"
	}

	return c.JSON(fiber.Map{
		"available":   !exists,
		"reason":      reason,
		"suggestions": suggestions,
	})
}

func CheckEmail(c *fiber.Ctx) error {
	email := strings.ToLower(strings.TrimSpace(c.Query("email")))
	var count int64
	if email != "" {
		database.DB.Model(&models.User{}).
			Where("email = ? AND account_status != 'unverified'", email).
			Count(&count)
	}

	exists := count > 0
	reason := ""
	if exists {
		reason = "taken"
	}

	return c.JSON(fiber.Map{
		"available": !exists,
		"reason":    reason,
	})
}

func CheckVerificationStatus(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
		Login string `json:"login"`
	}
	_ = c.BodyParser(&req)

	ident := req.Email
	if ident == "" {
		ident = req.Login
	}
	ident = strings.TrimSpace(ident)
	if ident == "" {
		return c.Status(422).JSON(fiber.Map{"message": "Email or username is required."})
	}

	var user models.User
	var err error
	if strings.Contains(ident, "@") {
		err = database.DB.Where("email = ?", strings.ToLower(ident)).First(&user).Error
	} else {
		err = database.DB.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Where("user_profiles.username = ?", strings.ToLower(ident)).First(&user).Error
	}

	if err != nil {
		return c.JSON(fiber.Map{"status": "not_found"})
	}

	return c.JSON(fiber.Map{"status": user.AccountStatus})
}

// ─── Forgot / Reset Password ───────────────────────────────────────────

type ForgotPasswordRequest struct {
	OtpChannel string `json:"otp_channel"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
}

func ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(422).JSON(fiber.Map{"message": "Invalid request."})
	}

	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	var user models.User
	var identifier string

	if channel == "phone" {
		norm := support.NormalizePhone(req.Phone)
		if norm == nil {
			return c.JSON(fiber.Map{"message": "If an account exists, an OTP was sent."})
		}
		identifier = *norm
		if err := database.DB.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Preload("Profile").Where("user_profiles.phone = ?", identifier).First(&user).Error; err != nil {
			return c.JSON(fiber.Map{"message": "If an account exists, an OTP was sent."})
		}
	} else {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
		if err := database.DB.Preload("Profile").Where("email = ?", identifier).First(&user).Error; err != nil {
			return c.JSON(fiber.Map{"message": "If an account exists, an OTP was sent."})
		}
	}

	cacheKey := fmt.Sprintf("reset_otp_%s_%s", channel, identifier)
	res := services.GetOtpService().RequestOtp(cacheKey, 15)
	if _, blocked := res["blocked"]; blocked {
		return c.JSON(fiber.Map{"message": "If an account exists, an OTP was sent."})
	}

	otp, _ := res["otp"].(int)
	otpStr := services.FormatOtp(otp)
	log.Info().Str("channel", channel).Str("identifier", identifier).Str("otp", otpStr).Msg("Forgot Password OTP generated")

	smsFailed := false
	if channel == "phone" && user.Profile != nil && user.Profile.Phone != nil {
		if err := services.SendPhilSmsOtp(*user.Profile.Phone, otpStr, "resetting your password"); err != nil {
			smsFailed = true
			if user.Email != nil {
				_ = services.SendOtpEmail(*user.Email, otpStr, "resetting your password (SMS fallback)")
			}
		}
	} else if user.Email != nil {
		_ = services.SendOtpEmail(*user.Email, otpStr, "resetting your password")
	}

	msg := "If an account exists, an OTP was sent."
	if smsFailed {
		msg = "If an account exists, an OTP was sent to your email (SMS gateway was unavailable)."
	}
	return c.JSON(fiber.Map{"message": msg})
}

type VerifyResetOtpRequest struct {
	OtpChannel string `json:"otp_channel"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Otp        int    `json:"otp"`
}

func VerifyResetOtp(c *fiber.Ctx) error {
	var req VerifyResetOtpRequest
	if err := c.BodyParser(&req); err != nil || req.Otp <= 0 {
		return c.Status(422).JSON(fiber.Map{"message": "Valid OTP required."})
	}

	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	var identifier string
	if channel == "phone" {
		norm := support.NormalizePhone(req.Phone)
		if norm == nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
		}
		identifier = *norm
	} else {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
	}

	cacheKey := fmt.Sprintf("reset_otp_%s_%s", channel, identifier)
	if !services.GetOtpService().Verify(cacheKey, req.Otp) {
		return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
	}

	services.CachePut(fmt.Sprintf("reset_verified_%s_%s", channel, identifier), 5*time.Minute)
	return c.JSON(fiber.Map{"message": "OTP verified."})
}

type ResetPasswordRequest struct {
	OtpChannel  string `json:"otp_channel"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	NewPassword string `json:"new_password"`
}

func ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil || len(req.NewPassword) < 8 {
		return c.Status(422).JSON(fiber.Map{"message": "Password must be at least 8 characters."})
	}

	channel := req.OtpChannel
	if channel == "" {
		channel = "email"
	}

	var identifier string
	var user models.User

	if channel == "phone" {
		norm := support.NormalizePhone(req.Phone)
		if norm == nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
		}
		identifier = *norm
		if err := database.DB.Joins("JOIN user_profiles ON user_profiles.user_id = users.user_id").
			Where("user_profiles.phone = ?", identifier).First(&user).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
		}
	} else {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
		if err := database.DB.Where("email = ?", identifier).First(&user).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"message": "Invalid or expired OTP"})
		}
	}

	flagKey := fmt.Sprintf("reset_verified_%s_%s", channel, identifier)
	if ok, _ := services.CacheGet(flagKey); !ok {
		return c.Status(403).JSON(fiber.Map{"message": "Identity verification required before resetting password."})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"message": "Failed to hash password."})
	}
	hashStr := string(hashed)

	now := time.Now()
	database.DB.Model(&user).Updates(map[string]interface{}{
		"password":   &hashStr,
		"updated_at": &now,
	})

	services.CacheForget(flagKey)
	return c.JSON(fiber.Map{"message": "Password reset successfully!"})
}

// ─── Logout ────────────────────────────────────────────────────────────

func Logout(c *fiber.Ctx) error {
	pat := middleware.GetToken(c)
	if pat != nil {
		database.DB.Delete(&pat)
	}
	return c.JSON(fiber.Map{"message": "Logged out."})
}
