package services

import (
	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/models"

	"github.com/rs/zerolog/log"
)

// NotificationService replicates App\Services\NotificationService — a fan-out
// push notification dispatcher that sends to individual users, all citizens,
// citizens in specific barangays, or all admins/dispatchers.
type NotificationService struct {
	firebase *FirebasePushService
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		firebase: NewFirebasePushService(),
	}
}

// NotifyUser sends a push notification to all devices belonging to a specific user.
func (s *NotificationService) NotifyUser(userID int, title, body string, data map[string]string) {
	var tokens []models.DeviceToken
	database.DB.Where("user_id = ?", userID).Find(&tokens)

	for _, dt := range tokens {
		if err := s.firebase.SendToDevice(dt.Token, title, body, dt.Platform, data); err != nil {
			log.Error().Err(err).Int("user_id", userID).Msg("NotificationService: failed to notify user device")
		}
	}
}

// NotifyAdminsAndDispatchers sends a push to all admin and dispatcher device tokens.
func (s *NotificationService) NotifyAdminsAndDispatchers(title, body string, data map[string]string) {
	var tokens []models.DeviceToken
	database.DB.
		Joins("JOIN users ON device_tokens.user_id = users.user_id").
		Where("users.role IN (?, ?)", "admin", "dispatcher").
		Find(&tokens)

	for _, dt := range tokens {
		if err := s.firebase.SendToDevice(dt.Token, title, body, dt.Platform, data); err != nil {
			log.Error().Err(err).Msg("NotificationService: failed to notify admin/dispatcher device")
		}
	}
}

// NotifyAllCitizens sends a push to all citizen device tokens (town-wide broadcast).
func (s *NotificationService) NotifyAllCitizens(title, body string, data map[string]string) {
	var tokens []models.DeviceToken
	database.DB.
		Joins("JOIN users ON device_tokens.user_id = users.user_id").
		Where("users.role = ?", "citizen").
		Where("users.account_status = ?", "active").
		Find(&tokens)

	for _, dt := range tokens {
		if err := s.firebase.SendToDevice(dt.Token, title, body, dt.Platform, data); err != nil {
			log.Error().Err(err).Msg("NotificationService: failed to notify citizen device")
		}
	}
}

// NotifyCitizensInBarangays sends a push to citizen devices in specific barangays.
func (s *NotificationService) NotifyCitizensInBarangays(barangayIDs []int, title, body string, data map[string]string) {
	var tokens []models.DeviceToken
	database.DB.
		Joins("JOIN users ON device_tokens.user_id = users.user_id").
		Joins("LEFT JOIN user_profiles ON users.user_id = user_profiles.user_id").
		Where("users.role = ?", "citizen").
		Where("users.account_status = ?", "active").
		Where("user_profiles.barangay_id IN ?", barangayIDs).
		Find(&tokens)

	for _, dt := range tokens {
		if err := s.firebase.SendToDevice(dt.Token, title, body, dt.Platform, data); err != nil {
			log.Error().Err(err).Msg("NotificationService: failed to notify barangay citizen device")
		}
	}
}

var globalNotificationService *NotificationService

func GetNotificationService() *NotificationService {
	if globalNotificationService == nil {
		globalNotificationService = NewNotificationService()
	}
	return globalNotificationService
}

func NotifyUser(userID int, title, body string, data map[string]string) error {
	GetNotificationService().NotifyUser(userID, title, body, data)
	return nil
}

func NotifyAdminsAndDispatchers(title, body string, data map[string]string) error {
	GetNotificationService().NotifyAdminsAndDispatchers(title, body, data)
	return nil
}

func NotifyAllCitizens(title, body string, data map[string]string) error {
	GetNotificationService().NotifyAllCitizens(title, body, data)
	return nil
}

func NotifyCitizensInBarangays(barangayIDs []int, title, body string, data map[string]string) error {
	GetNotificationService().NotifyCitizensInBarangays(barangayIDs, title, body, data)
	return nil
}

