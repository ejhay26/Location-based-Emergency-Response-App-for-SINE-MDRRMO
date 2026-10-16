package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"time"

	"sine-mdrrmo-backend/internal/config"

	"github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

// Mailer wraps transactional email providers (Brevo HTTP API and Resend).
// Replaces Laravel's Mail facade + Mailable classes.
type Mailer struct {
	client *resend.Client
	from   string
}

func NewMailer() *Mailer {
	resendKey := ""
	if config.AppConfig != nil {
		resendKey = config.AppConfig.ResendAPIKey
	}
	from := "MDRRMO SAN ISIDRO <ejperez623@gmail.com>"
	if config.AppConfig != nil && config.AppConfig.MailFromAddress != "" {
		from = fmt.Sprintf("%s <%s>", config.AppConfig.MailFromName, config.AppConfig.MailFromAddress)
	}

	return &Mailer{
		client: resend.NewClient(resendKey),
		from:   from,
	}
}

type brevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type brevoRecipient struct {
	Email string `json:"email"`
}

type brevoEmailPayload struct {
	Sender      brevoSender      `json:"sender"`
	To          []brevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	HtmlContent string           `json:"htmlContent"`
}

func (m *Mailer) sendBrevo(to, subject, htmlContent string) error {
	payload := brevoEmailPayload{
		Sender: brevoSender{
			Name:  config.AppConfig.MailFromName,
			Email: config.AppConfig.MailFromAddress,
		},
		To: []brevoRecipient{
			{Email: to},
		},
		Subject:     subject,
		HtmlContent: htmlContent,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal brevo payload: %w", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), "POST", "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create brevo request: %w", err)
	}

	req.Header.Set("api-key", config.AppConfig.BrevoAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("to", to).Str("subject", subject).Msg("Brevo: failed to connect to API")
		return fmt.Errorf("brevo request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Error().Int("status", resp.StatusCode).Str("response", string(respBody)).Str("to", to).Msg("Brevo: API returned error")
		return fmt.Errorf("brevo api error (%d): %s", resp.StatusCode, string(respBody))
	}

	log.Info().Str("to", to).Str("subject", subject).Msg("Brevo: email sent successfully")
	return nil
}

// Send dispatches an HTML email via Brevo if configured, or Resend as fallback.
func (m *Mailer) Send(to, subject, htmlContent string) error {
	if config.AppConfig != nil && config.AppConfig.BrevoAPIKey != "" {
		return m.sendBrevo(to, subject, htmlContent)
	}

	if config.AppConfig == nil || config.AppConfig.ResendAPIKey == "" {
		log.Warn().Str("to", to).Str("subject", subject).Msg("Mailer: neither BREVO_API_KEY nor RESEND_API_KEY is configured, skipping email")
		return nil
	}

	params := &resend.SendEmailRequest{
		From:    m.from,
		To:      []string{to},
		Subject: subject,
		Html:    htmlContent,
	}

	_, err := m.client.Emails.SendWithContext(context.Background(), params)
	if err != nil {
		log.Error().Err(err).Str("to", to).Str("subject", subject).Msg("Mailer: failed to send email via Resend")
		return err
	}

	log.Info().Str("to", to).Str("subject", subject).Msg("Mailer: email sent successfully via Resend")
	return nil
}

// SendOtpEmail sends an OTP verification email using the authentic MDRRMO red theme
func (m *Mailer) SendOtpEmail(to string, otp int, purpose string) error {
	safePurpose := html.EscapeString(purpose)
	if safePurpose == "" {
		safePurpose = "verifying your account"
	}
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Invisible preheader text prevents Android notification preview stitching -->
  <div style="display:none;font-size:1px;color:#f4f5f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your verification code is %06d. Valid for 10 minutes.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:26px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span><br>
              <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:15px;color:#222428;line-height:1.5;">
                Use the verification code below for <strong>%s</strong>. It expires in <strong>10 minutes</strong>.
              </p>
              <div style="text-align:center;margin:12px 0 24px 0;background-color:#fff5f5;border:1px dashed #ef9a9a;border-radius:12px;padding:16px;">
                <span style="display:inline-block;font-size:38px;font-weight:800;letter-spacing:12px;color:#D32F2F;padding-left:12px;">
                  %06d
                </span>
              </div>
              <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
                If you did not request this code, you can safely ignore this email — no changes were made to your account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro<br>
                San Isidro, Nueva Ecija, Philippines 3106
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, otp, safePurpose, otp)

	return m.Send(to, "SINE MDRRMO — Verification Code", htmlBody)
}

// SendWelcomeEmail sends the welcome email after account approval using authentic MDRRMO red theme
func (m *Mailer) SendWelcomeEmail(to, firstName string) error {
	safeFirstName := html.EscapeString(firstName)
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MDRRMO San Isidro</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Invisible preheader text -->
  <div style="display:none;font-size:1px;color:#f4f5f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Welcome to SINE MDRRMO, %s! Your account registration has been reviewed and approved.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:28px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span><br>
              <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background-color:#e8f5e9;border-left:4px solid #2e7d32;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#1b5e20;font-size:13px;font-weight:bold;">ACCOUNT VERIFIED & APPROVED</span>
              </div>
              <p style="margin:0 0 16px 0;font-size:18px;font-weight:bold;color:#222428;line-height:1.4;">
                Welcome to SINE MDRRMO, %s!
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Great news! Your citizen identification and account registration have been reviewed and approved by the MDRRMO San Isidro dispatch team.
              </p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#222428;">
                      You can now use all app features:
                    </p>
                    <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                      <strong>One-Tap SOS:</strong> Instantly broadcast your exact GPS coordinates to dispatchers.<br>
                      <strong>Hazard Reports:</strong> Report road blockages, fallen trees, and flash floods.<br>
                      <strong>Emergency Broadcasts:</strong> Receive official municipal evacuation and weather alerts.<br>
                      <strong>Live Dispatch Tracking:</strong> Track assigned emergency response teams in real time.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
                Stay safe and do not hesitate to report emergencies in your area.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro<br>
                San Isidro, Nueva Ecija, Philippines 3106
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, safeFirstName, safeFirstName)

	return m.Send(to, "Welcome to MDRRMO San Isidro!", htmlBody)
}

// SendVerificationDeclinedEmail sends the rejection email using authentic MDRRMO red theme
func (m *Mailer) SendVerificationDeclinedEmail(to, firstName string) error {
	safeFirstName := html.EscapeString(firstName)
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MDRRMO Account Verification Update</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Invisible preheader text -->
  <div style="display:none;font-size:1px;color:#f4f5f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Update regarding your MDRRMO San Isidro account verification.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:28px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span><br>
              <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background-color:#ffebee;border-left:4px solid #D32F2F;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#c62828;font-size:13px;font-weight:bold;">REGISTRATION STATUS: NOT APPROVED</span>
              </div>
              <p style="margin:0 0 16px 0;font-size:17px;font-weight:bold;color:#222428;line-height:1.4;">
                Account Verification Update
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Dear %s,
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Thank you for your interest in registering for the <strong>SINE MDRRMO Emergency Response App</strong>. Our verification team has reviewed your submitted identification document, and unfortunately, we were unable to approve your registration at this time.
              </p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#222428;">
                      Common reasons for non-approval:
                    </p>
                    <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                      • The uploaded ID photo or selfie was blurry, cropped, or illegible.<br>
                      • The name or details on the ID do not match the registered profile.<br>
                      • The uploaded document is expired or not in our accepted IDs list.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
                You may submit a new registration with clearer identification documents at any time.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro<br>
                San Isidro, Nueva Ecija, Philippines 3106
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, safeFirstName)

	return m.Send(to, "MDRRMO San Isidro — Verification Declined", htmlBody)
}

// SendFalseAlarmStrikeEmail sends a false alarm warning/suspension email
func (m *Mailer) SendFalseAlarmStrikeEmail(to, firstName string, strikes, maxStrikes int, reason, accountStatus string) error {
	safeFirstName := html.EscapeString(firstName)
	safeReason := html.EscapeString(reason)
	statusText := fmt.Sprintf("Strike %d of %d", strikes, maxStrikes)
	if accountStatus == "banned" {
		statusText = "Account Suspended"
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MDRRMO False Alarm Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Invisible preheader text -->
  <div style="display:none;font-size:1px;color:#f4f5f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Notice: A false alarm incident has been recorded on your MDRRMO San Isidro account.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:28px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span><br>
              <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background-color:#fff3e0;border-left:4px solid #f57c00;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#e65100;font-size:13px;font-weight:bold;">FALSE ALARM NOTICE: %s</span>
              </div>
              <p style="margin:0 0 16px 0;font-size:16px;color:#222428;line-height:1.4;">
                Hi %s,
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                A false alarm strike has been recorded on your account following verification by the dispatch team.
              </p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 6px 0;font-size:13px;color:#444444;"><strong>Reason:</strong> %s</p>
                    <p style="margin:0;font-size:13px;color:#444444;"><strong>Current Strikes:</strong> %d / %d</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
                Reaching %d strikes will result in account suspension under municipal emergency dispatch policies.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro<br>
                San Isidro, Nueva Ecija, Philippines 3106
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, statusText, safeFirstName, safeReason, strikes, maxStrikes, maxStrikes)

	return m.Send(to, fmt.Sprintf("MDRRMO San Isidro — %s", statusText), htmlBody)
}

// SendBugReportEmail forwards a bug report to the dev team
func (m *Mailer) SendBugReportEmail(to string, feedbackID int, citizenName, citizenEmail, category, message, createdAt, adminNotes string) error {
	safeCitizenName := html.EscapeString(citizenName)
	safeCitizenEmail := html.EscapeString(citizenEmail)
	safeCategory := html.EscapeString(category)
	safeCreatedAt := html.EscapeString(createdAt)
	safeMessage := html.EscapeString(message)

	notesSection := ""
	if adminNotes != "" {
		notesSection = fmt.Sprintf(`
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:4px;padding:12px 16px;margin-top:16px;">
            <tr>
              <td>
                <span style="font-size:12px;font-weight:bold;color:#c2410c;text-transform:uppercase;">Admin Action Notes</span>
                <p style="margin:4px 0 0 0;font-size:13px;color:#7c2d12;line-height:1.5;">%s</p>
              </td>
            </tr>
          </table>`, html.EscapeString(adminNotes))
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technical Bug Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Invisible preheader text -->
  <div style="display:none;font-size:1px;color:#f4f5f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Bug report #%d forwarded: %s from %s.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:26px 32px;text-align:left;">
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO &bull; Technical Support</span><br>
                    <span style="color:#ffebee;font-size:13px;opacity:0.9;">Citizen Bug & Feedback Report</span>
                  </td>
                  <td align="right">
                    <span style="background-color:rgba(255,255,255,0.2);color:#ffffff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;font-family:monospace;">#FB-%d</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background-color:#eff6ff;border-left:4px solid #3b82f6;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#1d4ed8;font-size:13px;font-weight:bold;text-transform:uppercase;">
                  CATEGORY: %s
                </span>
              </div>
              <p style="margin:0 0 16px 0;font-size:17px;font-weight:bold;color:#0f172a;line-height:1.4;">
                Citizen Bug Report Forwarded by MDRRMO Admin
              </p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px 0;font-size:12px;font-weight:bold;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">
                      Reporter Information
                    </p>
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;">
                      <tr>
                        <td style="padding:3px 0;width:120px;color:#64748b;">Full Name:</td>
                        <td style="padding:3px 0;font-weight:bold;color:#0f172a;">%s</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Email:</td>
                        <td style="padding:3px 0;"><a href="mailto:%s" style="color:#2563eb;text-decoration:none;">%s</a></td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Submitted:</td>
                        <td style="padding:3px 0;color:#0f172a;">%s</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:16px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;font-size:12px;font-weight:bold;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">
                      Citizen Message
                    </p>
                    <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">%s</p>
                  </td>
                </tr>
              </table>
              %s
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro Emergency Response System &bull; Technical Support
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, feedbackID, safeCategory, safeCitizenName, feedbackID, safeCategory, safeCitizenName, safeCitizenEmail, safeCitizenEmail, safeCreatedAt, safeMessage, notesSection)

	return m.Send(to, fmt.Sprintf("SINE MDRRMO Bug Report #%d — %s", feedbackID, safeCategory), htmlBody)
}

var globalMailer *Mailer

func GetMailer() *Mailer {
	if globalMailer == nil {
		globalMailer = NewMailer()
	}
	return globalMailer
}

func SendOtpEmail(to string, otpStr string, purpose string) error {
	var otp int
	fmt.Sscanf(otpStr, "%d", &otp)
	return GetMailer().SendOtpEmail(to, otp, purpose)
}

func SendWelcomeEmail(firstName, email string) error {
	return GetMailer().SendWelcomeEmail(email, firstName)
}

func SendVerificationDeclinedEmail(firstName, email string) error {
	return GetMailer().SendVerificationDeclinedEmail(email, firstName)
}

func SendFalseAlarmStrikeEmail(firstName, email string, strikes, maxStrikes int, reason, status string) error {
	return GetMailer().SendFalseAlarmStrikeEmail(email, firstName, strikes, maxStrikes, reason, status)
}

func SendTechnicalBugReportEmail(feedbackID int, citizenName, citizenUsername, citizenEmail, category string, rating int, message, createdAt string, devInfo map[string]interface{}, adminNotes string) error {
	devEmail := "ejperez623@gmail.com"
	if config.AppConfig != nil && config.AppConfig.DevSupportEmail != "" {
		devEmail = config.AppConfig.DevSupportEmail
	}
	return GetMailer().SendBugReportEmail(devEmail, feedbackID, citizenName, citizenEmail, category, message, createdAt, adminNotes)
}

// SendDisasterRecoveryNotice sends polite recovery notifications to citizens identified during a restore gap.
func (m *Mailer) SendDisasterRecoveryNotice(to string, snapshotTime string) error {
	safeSnapshotTime := html.EscapeString(snapshotTime)
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MDRRMO System Synchronization Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%%;">
          <tr>
            <td style="background-color:#D32F2F;padding:28px 32px;text-align:left;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span><br>
              <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background-color:#fff3e0;border-left:4px solid #ff9800;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#e65100;font-size:13px;font-weight:bold;">SYSTEM RECOVERY & SYNCHRONIZATION ADVISORY</span>
              </div>
              <p style="margin:0 0 16px 0;font-size:17px;font-weight:bold;color:#222428;line-height:1.4;">
                Important Notice Regarding Your Account
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Dear Citizen,
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                The San Isidro Municipal Disaster Risk Reduction and Management Office (MDRRMO) recently performed an automated database synchronization at <strong>%s</strong> to maintain high system availability and emergency data integrity.
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Our audit records indicate you initiated an account registration or profile update immediately prior to or during this synchronization. While we make every effort to preserve all transactions, there is a possibility that your recent registration status may require a quick re-verification.
              </p>
              <div style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin:20px 0;">
                <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#222428;">What should you do?</p>
                <p style="margin:0;font-size:13px;color:#555555;line-height:1.5;">
                  • Open the <strong>SINE MDRRMO</strong> app on your device.<br>
                  • If your account shows unverified, please sign in or re-submit your verification at your convenience.<br>
                  • If everything looks normal, no further action is required.
                </p>
              </div>
              <p style="margin:0 0 8px 0;font-size:14px;color:#444444;line-height:1.6;">
                Thank you for your understanding and cooperation as we keep San Isidro safe.
              </p>
              <p style="margin:24px 0 0 0;font-size:13px;color:#888888;line-height:1.4;">
                — San Isidro MDRRMO Technical & Emergency Operations Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, safeSnapshotTime)

	return m.Send(to, "Important Notice: SINE MDRRMO System Synchronization & Account Verification Update", htmlBody)
}


