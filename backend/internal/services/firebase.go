package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/oauth2/google"
)

// FirebasePushService replicates App\Services\FirebasePushService —
// sends push notifications via Firebase Cloud Messaging v1 HTTP API.
type FirebasePushService struct {
	projectID string
	client    *http.Client
}

func NewFirebasePushService() *FirebasePushService {
	return &FirebasePushService{
		projectID: os.Getenv("FIREBASE_PROJECT_ID"),
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

// getAccessToken generates a short-lived OAuth2 access token from the service account credentials.
func (s *FirebasePushService) getAccessToken() (string, error) {
	credFile := os.Getenv("FIREBASE_CREDENTIALS")
	if credFile == "" {
		return "", fmt.Errorf("FIREBASE_CREDENTIALS not set")
	}

	data, err := os.ReadFile(credFile)
	if err != nil {
		return "", fmt.Errorf("read credentials: %w", err)
	}

	creds, err := google.CredentialsFromJSON(context.Background(), data, "https://www.googleapis.com/auth/firebase.messaging")
	if err != nil {
		return "", fmt.Errorf("parse credentials: %w", err)
	}

	tok, err := creds.TokenSource.Token()
	if err != nil {
		return "", fmt.Errorf("get token: %w", err)
	}

	return tok.AccessToken, nil
}

// SendToDevice sends a push notification to a single device token.
// Platform controls payload shape: Android gets data-only, iOS gets notification.
func (s *FirebasePushService) SendToDevice(token, title, body, platform string, extraData map[string]string) error {
	if s.projectID == "" || token == "" {
		return nil // silently skip — matches Laravel's fail-open behavior
	}

	accessToken, err := s.getAccessToken()
	if err != nil {
		log.Error().Err(err).Msg("Firebase: failed to get access token")
		return err
	}

	payload := s.buildPayload(token, title, body, platform, extraData)

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", s.projectID)
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("token", token[:10]+"...").Msg("Firebase: HTTP request failed")
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(resp.Body)
	log.Error().Int("status", resp.StatusCode).Str("body", string(respBody)).Msg("Firebase: send failed")
	return fmt.Errorf("FCM send failed: %d", resp.StatusCode)
}

func (s *FirebasePushService) buildPayload(token, title, body, platform string, data map[string]string) map[string]interface{} {
	if data == nil {
		data = make(map[string]string)
	}
	data["title"] = title
	data["body"] = body

	message := map[string]interface{}{
		"token": token,
		"data":  data,
	}

	if platform == "android" {
		// Android: data-only message (no notification key) — the Flutter
		// onBackgroundMessage handler will create a local notification.
		message["android"] = map[string]interface{}{
			"priority": "high",
		}
	} else {
		// iOS: standard notification payload
		message["notification"] = map[string]interface{}{
			"title": title,
			"body":  body,
		}
		message["apns"] = map[string]interface{}{
			"payload": map[string]interface{}{
				"aps": map[string]interface{}{
					"sound": "default",
				},
			},
		}
	}

	return map[string]interface{}{"message": message}
}
