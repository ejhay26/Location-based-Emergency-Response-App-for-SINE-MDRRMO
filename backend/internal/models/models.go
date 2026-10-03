package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// ─── Barangay ───────────────────────────────────────────────────────

type Barangay struct {
	BarangayID   int    `gorm:"column:barangay_id;primaryKey;autoIncrement" json:"barangay_id"`
	BarangayName string `gorm:"column:barangay_name;size:100" json:"barangay_name"`
}

func (Barangay) TableName() string { return "barangays" }

// ─── IncidentType ───────────────────────────────────────────────────

type IncidentType struct {
	IncidentTypeID int    `gorm:"column:incident_type_id;primaryKey;autoIncrement" json:"incident_type_id"`
	IncidentName   string `gorm:"column:incident_name;size:100" json:"incident_name"`
}

func (IncidentType) TableName() string { return "incident_types" }

// ─── Responder ──────────────────────────────────────────────────────

type Responder struct {
	ResponderID int    `gorm:"column:responder_id;primaryKey;autoIncrement" json:"responder_id"`
	Name        string `gorm:"column:name;size:100" json:"name"`
	Role        string `gorm:"column:role;size:50" json:"role"`
	Contact     string `gorm:"column:contact;size:20" json:"contact"`
	Status      string `gorm:"column:status;size:50" json:"status"`
}

func (Responder) TableName() string { return "responders" }

// ─── Vehicle ────────────────────────────────────────────────────────

type Vehicle struct {
	VehicleID   int    `gorm:"column:vehicle_id;primaryKey;autoIncrement" json:"vehicle_id"`
	ResponderID *int   `gorm:"column:responder_id" json:"responder_id"`
	Name        string `gorm:"column:name;size:100" json:"name"`
	Type        string `gorm:"column:type;size:50" json:"type"`
	Plate       string `gorm:"column:plate;size:50" json:"plate"`
	Status      string `gorm:"column:status;size:50" json:"status"`
}

func (Vehicle) TableName() string { return "vehicles" }

// ─── User ───────────────────────────────────────────────────────────

type User struct {
	UserID            int            `gorm:"column:user_id;primaryKey;autoIncrement" json:"user_id"`
	Email             *string        `gorm:"column:email;size:100;uniqueIndex" json:"email"`
	EmailVerifiedAt   *time.Time     `gorm:"column:email_verified_at" json:"email_verified_at"`
	Password          *string        `gorm:"column:password;size:255" json:"-"`
	Role              string         `gorm:"column:role;size:20;default:citizen" json:"role"`
	AccountStatus     string         `gorm:"column:account_status;size:20;default:active" json:"account_status"`
	BanReason         *string        `gorm:"column:ban_reason;size:500" json:"ban_reason"`
	BannedAt          *time.Time     `gorm:"column:banned_at" json:"banned_at"`
	FalseAlarmStrikes int            `gorm:"column:false_alarm_strikes;default:0" json:"false_alarm_strikes"`
	CreatedAt         *time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt         *time.Time     `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt         sql.NullTime   `gorm:"column:deleted_at" json:"deleted_at,omitempty"`

	// Relationships (eager-loaded like Laravel's $with)
	Profile        *UserProfile        `gorm:"foreignKey:UserID;references:UserID" json:"profile,omitempty"`
	Verification   *UserVerification   `gorm:"foreignKey:UserID;references:UserID" json:"verification,omitempty"`
	MedicalProfile *UserMedicalProfile `gorm:"foreignKey:UserID;references:UserID" json:"medical_profile,omitempty"`
}

func (User) TableName() string { return "users" }

// UserResponse is the JSON shape sent to the frontend, matching Laravel's appended accessors
type UserResponse struct {
	UserID            int        `json:"user_id"`
	Email             *string    `json:"email"`
	EmailVerifiedAt   *time.Time `json:"email_verified_at"`
	Role              string     `json:"role"`
	AccountStatus     string     `json:"account_status"`
	BanReason         *string    `json:"ban_reason"`
	BannedAt          *time.Time `json:"banned_at"`
	FalseAlarmStrikes int        `json:"false_alarm_strikes"`
	CreatedAt         *time.Time `json:"created_at"`
	UpdatedAt         *time.Time `json:"updated_at"`

	// Flattened from Profile
	FirstName      *string `json:"first_name"`
	LastName       *string `json:"last_name"`
	Username       *string `json:"username"`
	Phone          *string `json:"phone"`
	Birthdate      *string `json:"birthdate"`
	ProfilePicture *string `json:"profile_picture"`
	BarangayID     *int    `json:"barangay_id"`
	SetupCompleted bool    `json:"setup_completed"`

	// Flattened from Verification
	ValidIDType      *string          `json:"valid_id_type"`
	ValidIDNumber    *string          `json:"valid_id_number"`
	ValidIDExpiry    *string          `json:"valid_id_expiry"`
	ValidIDDetails   *json.RawMessage `json:"valid_id_details"`
	ValidIDProof     *string          `json:"valid_id_proof"`
	ValidIDProofBack *string          `json:"valid_id_proof_back"`
	SelfieWithIDProof *string         `json:"selfie_with_id_proof"`

	// Flattened from MedicalProfile
	BloodType         *string `json:"blood_type"`
	Allergies         *string `json:"allergies"`
	MedicalConditions *string `json:"medical_conditions"`
	PWDStatus         *string `json:"pwd_status"`

	// Nested profile for backward compat
	Profile *UserProfile `json:"profile,omitempty"`
}

// ToResponse flattens the user's related models into the response shape
// that matches the Laravel backend's appended accessors exactly.
func (u *User) ToResponse() UserResponse {
	r := UserResponse{
		UserID:            u.UserID,
		Email:             u.Email,
		EmailVerifiedAt:   u.EmailVerifiedAt,
		Role:              u.Role,
		AccountStatus:     u.AccountStatus,
		BanReason:         u.BanReason,
		BannedAt:          u.BannedAt,
		FalseAlarmStrikes: u.FalseAlarmStrikes,
		CreatedAt:         u.CreatedAt,
		UpdatedAt:         u.UpdatedAt,
		Profile:           u.Profile,
	}

	if p := u.Profile; p != nil {
		r.FirstName = p.FirstName
		r.LastName = p.LastName
		r.Username = p.Username
		r.Phone = p.Phone
		if p.Birthdate != nil {
			s := p.Birthdate.Format("2006-01-02")
			r.Birthdate = &s
		}
		r.ProfilePicture = p.ProfilePicture
		r.BarangayID = p.BarangayID
		r.SetupCompleted = p.SetupCompleted
	}

	if v := u.Verification; v != nil {
		r.ValidIDType = v.ValidIDType
		r.ValidIDNumber = v.ValidIDNumber
		if v.ValidIDExpiry != nil {
			s := v.ValidIDExpiry.Format("2006-01-02")
			r.ValidIDExpiry = &s
		}
		r.ValidIDDetails = v.ValidIDDetails
		r.ValidIDProof = v.ValidIDProof
		r.ValidIDProofBack = v.ValidIDProofBack
		r.SelfieWithIDProof = v.SelfieWithIDProof
	}

	if m := u.MedicalProfile; m != nil {
		r.BloodType = m.BloodType
		r.Allergies = m.Allergies
		r.MedicalConditions = m.MedicalConditions
		r.PWDStatus = m.PWDStatus
	}

	return r
}

// ─── UserProfile ────────────────────────────────────────────────────

type UserProfile struct {
	ProfileID      int        `gorm:"column:profile_id;primaryKey;autoIncrement" json:"profile_id"`
	UserID         int        `gorm:"column:user_id;uniqueIndex" json:"user_id"`
	FirstName      *string    `gorm:"column:first_name;size:100" json:"first_name"`
	LastName       *string    `gorm:"column:last_name;size:100" json:"last_name"`
	Username       *string    `gorm:"column:username;size:50;uniqueIndex" json:"username"`
	Phone          *string    `gorm:"column:phone;size:20" json:"phone"`
	Birthdate      *time.Time `gorm:"column:birthdate;type:date" json:"birthdate"`
	ProfilePicture *string    `gorm:"column:profile_picture;size:255" json:"profile_picture"`
	BarangayID     *int       `gorm:"column:barangay_id" json:"barangay_id"`
	SetupCompleted bool       `gorm:"column:setup_completed;default:false" json:"setup_completed"`
	CreatedAt      *time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (UserProfile) TableName() string { return "user_profiles" }

// ─── UserVerification ───────────────────────────────────────────────

type UserVerification struct {
	VerificationID     int              `gorm:"column:verification_id;primaryKey;autoIncrement" json:"verification_id"`
	UserID             int              `gorm:"column:user_id" json:"user_id"`
	ValidIDType        *string          `gorm:"column:valid_id_type;size:50" json:"valid_id_type"`
	ValidIDNumber      *string          `gorm:"column:valid_id_number;size:100" json:"valid_id_number"`
	ValidIDExpiry      *time.Time       `gorm:"column:valid_id_expiry;type:date" json:"valid_id_expiry"`
	ValidIDDetails     *json.RawMessage `gorm:"column:valid_id_details;type:json" json:"valid_id_details"`
	ValidIDProof       *string          `gorm:"column:valid_id_proof;size:255" json:"valid_id_proof"`
	ValidIDProofBack   *string          `gorm:"column:valid_id_proof_back;size:255" json:"valid_id_proof_back"`
	SelfieWithIDProof  *string          `gorm:"column:selfie_with_id_proof;size:255" json:"selfie_with_id_proof"`
	VerificationStatus string           `gorm:"column:verification_status;size:20;default:pending" json:"verification_status"`
	RejectionReason    *string          `gorm:"column:rejection_reason;size:500" json:"rejection_reason"`
	ReviewedBy         *int             `gorm:"column:reviewed_by" json:"reviewed_by"`
	ReviewedAt         *time.Time       `gorm:"column:reviewed_at" json:"reviewed_at"`
	CreatedAt          *time.Time       `gorm:"column:created_at" json:"created_at"`
	UpdatedAt          *time.Time       `gorm:"column:updated_at" json:"updated_at"`
}

func (UserVerification) TableName() string { return "user_verifications" }

// ─── UserMedicalProfile ─────────────────────────────────────────────

type UserMedicalProfile struct {
	ProfileID         int        `gorm:"column:profile_id;primaryKey;autoIncrement" json:"profile_id"`
	UserID            int        `gorm:"column:user_id;uniqueIndex" json:"user_id"`
	BloodType         *string    `gorm:"column:blood_type;size:10" json:"blood_type"`
	Allergies         *string    `gorm:"column:allergies;type:text" json:"allergies"`
	MedicalConditions *string    `gorm:"column:medical_conditions;type:text" json:"medical_conditions"`
	PWDStatus         *string    `gorm:"column:pwd_status;size:100" json:"pwd_status"`
	CreatedAt         *time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt         *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (UserMedicalProfile) TableName() string { return "user_medical_profiles" }

// ─── EmergencyRequest ───────────────────────────────────────────────

type EmergencyRequest struct {
	RequestID      int          `gorm:"column:request_id;primaryKey;autoIncrement" json:"request_id"`
	UserID         *int         `gorm:"column:user_id" json:"user_id"`
	IncidentTypeID *int         `gorm:"column:incident_type_id" json:"incident_type_id"`
	ProofFiles     *string      `gorm:"column:proof_files;type:longtext" json:"proof_files"`
	Description    *string      `gorm:"column:description;type:text" json:"description"`
	Latitude       *float64     `gorm:"column:latitude;type:decimal(10,8)" json:"latitude"`
	Longitude      *float64     `gorm:"column:longitude;type:decimal(11,8)" json:"longitude"`
	BarangayID     *int         `gorm:"column:barangay_id" json:"barangay_id"`
	Status         *string      `gorm:"column:status;size:50" json:"status"`
	RequestTime    *time.Time   `gorm:"column:request_time" json:"request_time"`
	CreatedAt      *time.Time   `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      *time.Time   `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt      sql.NullTime `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
	IsFalseAlarm   int          `gorm:"column:is_false_alarm;default:0" json:"is_false_alarm"`
}

func (EmergencyRequest) TableName() string { return "emergency_requests" }

// ─── Hazard ─────────────────────────────────────────────────────────

type Hazard struct {
	HazardID    int        `gorm:"column:hazard_id;primaryKey;autoIncrement" json:"hazard_id"`
	UserID      *int       `gorm:"column:user_id" json:"user_id"`
	Description *string    `gorm:"column:description;size:255" json:"description"`
	HazardType  *string    `gorm:"column:hazard_type;size:50" json:"hazard_type"`
	ProofFiles  *string    `gorm:"column:proof_files;type:longtext" json:"proof_files"`
	Latitude    *float64   `gorm:"column:latitude;type:decimal(10,8)" json:"latitude"`
	Longitude   *float64   `gorm:"column:longitude;type:decimal(11,8)" json:"longitude"`
	BarangayID  *int       `gorm:"column:barangay_id" json:"barangay_id"`
	Status      *string    `gorm:"column:status;size:50;default:Active" json:"status"`
	CreatedAt   *time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Hazard) TableName() string { return "hazards" }

// ─── Broadcast ──────────────────────────────────────────────────────

type Broadcast struct {
	BroadcastID int        `gorm:"column:broadcast_id;primaryKey;autoIncrement" json:"broadcast_id"`
	Title       *string    `gorm:"column:title;size:255" json:"title"`
	Message     *string    `gorm:"column:message;type:text" json:"message"`
	MediaFiles  *string    `gorm:"column:media_files;type:longtext" json:"media_files"`
	IsActive    int        `gorm:"column:is_active;default:1" json:"is_active"`
	IsDraft     int        `gorm:"column:is_draft;default:0" json:"is_draft"`
	ScheduledAt *time.Time `gorm:"column:scheduled_at" json:"scheduled_at"`
	CreatedAt   *time.Time `gorm:"column:created_at" json:"created_at"`

	// Many-to-many via broadcast_barangays pivot
	Barangays []Barangay `gorm:"many2many:broadcast_barangays;foreignKey:BroadcastID;joinForeignKey:broadcast_id;References:BarangayID;joinReferences:barangay_id" json:"barangays,omitempty"`
}

func (Broadcast) TableName() string { return "broadcasts" }

// ─── Dispatch ───────────────────────────────────────────────────────

type Dispatch struct {
	DispatchID   int        `gorm:"column:dispatch_id;primaryKey;autoIncrement" json:"dispatch_id"`
	RequestID    *int       `gorm:"column:request_id" json:"request_id"`
	ResponderID  *int       `gorm:"column:responder_id" json:"responder_id"`
	VehicleID    *int       `gorm:"column:vehicle_id" json:"vehicle_id"`
	DispatchTime *time.Time `gorm:"column:dispatch_time" json:"dispatch_time"`
	ArrivalTime  *time.Time `gorm:"column:arrival_time" json:"arrival_time"`
	Status       *string    `gorm:"column:status;size:50" json:"status"`
}

func (Dispatch) TableName() string { return "dispatch" }

// ─── DeviceToken ────────────────────────────────────────────────────

type DeviceToken struct {
	ID        int        `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID    int        `gorm:"column:user_id" json:"user_id"`
	Token     string     `gorm:"column:token;size:255" json:"token"`
	Platform  string     `gorm:"column:platform;size:20;default:android" json:"platform"`
	CreatedAt *time.Time `gorm:"column:created_at" json:"created_at"`
}

func (DeviceToken) TableName() string { return "device_tokens" }

// ─── PersonalAccessToken (Sanctum-compatible) ───────────────────────

type PersonalAccessToken struct {
	ID            uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	TokenableType string     `gorm:"column:tokenable_type;size:255" json:"tokenable_type"`
	TokenableID   int        `gorm:"column:tokenable_id" json:"tokenable_id"`
	Name          string     `gorm:"column:name;size:255" json:"name"`
	Token         string     `gorm:"column:token;size:64;uniqueIndex" json:"-"`
	Abilities     *string    `gorm:"column:abilities;type:text" json:"abilities"`
	LastUsedAt    *time.Time `gorm:"column:last_used_at" json:"last_used_at"`
	ExpiresAt     *time.Time `gorm:"column:expires_at" json:"expires_at"`
	CreatedAt     *time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (PersonalAccessToken) TableName() string { return "personal_access_tokens" }

// ─── Feedback ───────────────────────────────────────────────────────

type Feedback struct {
	ID          uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID      int        `gorm:"column:user_id" json:"user_id"`
	Message     string     `gorm:"column:message;type:text" json:"message"`
	Category    string     `gorm:"column:category;size:50;default:general" json:"category"`
	Rating      int        `gorm:"column:rating;default:5" json:"rating"`
	Status      string     `gorm:"column:status;size:20;default:active" json:"status"`
	IsForwarded bool       `gorm:"column:is_forwarded;default:false" json:"is_forwarded"`
	ForwardedAt *time.Time `gorm:"column:forwarded_at" json:"forwarded_at"`
	DeviceInfo  *string    `gorm:"column:device_info;type:json" json:"device_info"`
	CreatedAt   *time.Time `gorm:"column:created_at" json:"created_at"`
	DeletedAt   *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
}

func (Feedback) TableName() string { return "feedback" }

// ─── UserSetting ────────────────────────────────────────────────────

type UserSetting struct {
	ID        uint64     `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID    int        `gorm:"column:user_id" json:"user_id"`
	Key       string     `gorm:"column:key;size:64" json:"key"`
	Value     *string    `gorm:"column:value;size:255" json:"value"`
	UpdatedAt *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (UserSetting) TableName() string { return "user_settings" }
