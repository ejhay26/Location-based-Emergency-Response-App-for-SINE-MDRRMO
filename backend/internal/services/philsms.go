package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"sine-mdrrmo-backend/internal/config"

	"github.com/rs/zerolog/log"
)

// PhilSmsService replicates App\Services\PhilSmsService — sends SMS via PhilSMS API.
type PhilSmsService struct {
	token    string
	sender   string
	client   *http.Client
}

func NewPhilSmsService() *PhilSmsService {
	return &PhilSmsService{
		token:  config.AppConfig.PhilSMSToken,
		sender: config.AppConfig.PhilSMSSender,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// SendOtp sends an OTP code via SMS. Returns true on success.
func (s *PhilSmsService) SendOtp(phone string, otp string, purpose string) bool {
	message := fmt.Sprintf("Your SINE MDRRMO verification code for %s is: %s. This code expires in 10 minutes. Do not share it with anyone.", purpose, otp)
	return s.send(phone, message)
}

func (s *PhilSmsService) send(recipient string, message string) bool {
	if s.token == "" {
		log.Warn().Msg("PhilSMS: token is empty, skipping SMS")
		return false
	}

	body := map[string]interface{}{
		"sender_id":  s.sender,
		"recipient":  recipient,
		"message":    message,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		log.Error().Err(err).Msg("PhilSMS: failed to marshal request body")
		return false
	}

	req, err := http.NewRequest("POST", "https://app.philsms.com/api/v3/sms/send", bytes.NewReader(jsonBody))
	if err != nil {
		log.Error().Err(err).Msg("PhilSMS: failed to create HTTP request")
		return false
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)

	resp, err := s.client.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("PhilSMS: HTTP request failed")
		return false
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Info().Str("recipient", recipient).Msg("PhilSMS: SMS sent successfully")
		return true
	}

	log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Msg("PhilSMS: SMS send failed")
	return false
}

var globalPhilSms *PhilSmsService

func GetPhilSmsService() *PhilSmsService {
	if globalPhilSms == nil {
		globalPhilSms = NewPhilSmsService()
	}
	return globalPhilSms
}

func SendPhilSmsOtp(phone string, otp string, purpose string) error {
	ok := GetPhilSmsService().SendOtp(phone, otp, purpose)
	if !ok {
		return fmt.Errorf("philsms delivery failed or token not set")
	}
	return nil
}

