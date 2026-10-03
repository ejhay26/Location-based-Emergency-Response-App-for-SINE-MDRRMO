package services

import (
	"context"
	"fmt"

	"sine-mdrrmo-backend/internal/config"

	"github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

// Mailer wraps the Resend SDK for sending emails with HTML templates.
// Replaces Laravel's Mail facade + Mailable classes.
type Mailer struct {
	client *resend.Client
	from   string
}

func NewMailer() *Mailer {
	return &Mailer{
		client: resend.NewClient(config.AppConfig.ResendAPIKey),
		from:   fmt.Sprintf("%s <%s>", config.AppConfig.MailFromName, config.AppConfig.MailFromAddress),
	}
}

// Send dispatches an HTML email via Resend.
func (m *Mailer) Send(to, subject, html string) error {
	if config.AppConfig.ResendAPIKey == "" {
		log.Warn().Str("to", to).Str("subject", subject).Msg("Mailer: Resend API key is empty, skipping email")
		return nil
	}

	params := &resend.SendEmailRequest{
		From:    m.from,
		To:      []string{to},
		Subject: subject,
		Html:    html,
	}

	_, err := m.client.Emails.SendWithContext(context.Background(), params)
	if err != nil {
		log.Error().Err(err).Str("to", to).Str("subject", subject).Msg("Mailer: failed to send email")
		return err
	}

	log.Info().Str("to", to).Str("subject", subject).Msg("Mailer: email sent successfully")
	return nil
}

// SendOtpEmail sends an OTP verification email
func (m *Mailer) SendOtpEmail(to string, otp int, purpose string) error {
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
<div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #1a56db, #7c3aed); padding: 32px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Verification Code</h1>
  </div>
  <div style="padding: 32px;">
    <p style="color: #374151; font-size: 16px;">Your code for <strong>%s</strong>:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a56db; background: #eef2ff; padding: 16px 32px; border-radius: 8px; display: inline-block;">%06d</span>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">MDRRMO San Isidro Emergency Response System</p>
  </div>
</div>
</body>
</html>`, purpose, otp)

	return m.Send(to, fmt.Sprintf("SINE MDRRMO — Verification Code (%06d)", otp), html)
}

// SendWelcomeEmail sends the welcome email after account approval
func (m *Mailer) SendWelcomeEmail(to, firstName string) error {
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
<div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Welcome, %s!</h1>
  </div>
  <div style="padding: 32px;">
    <p style="color: #374151; font-size: 16px;">Your MDRRMO San Isidro account has been <strong>approved</strong>. You're all set to use the emergency response app.</p>
    <p style="color: #6b7280; font-size: 14px;">Stay safe and don't hesitate to report emergencies in your area.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">MDRRMO San Isidro Emergency Response System</p>
  </div>
</div>
</body>
</html>`, firstName)

	return m.Send(to, "Welcome to MDRRMO San Isidro! ✅", html)
}

// SendVerificationDeclinedEmail sends the rejection email
func (m *Mailer) SendVerificationDeclinedEmail(to, firstName string) error {
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
<div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Verification Declined</h1>
  </div>
  <div style="padding: 32px;">
    <p style="color: #374151; font-size: 16px;">Hi %s,</p>
    <p style="color: #374151; font-size: 16px;">Your MDRRMO San Isidro account verification could not be approved. Please re-register with clearer identification documents.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">MDRRMO San Isidro Emergency Response System</p>
  </div>
</div>
</body>
</html>`, firstName)

	return m.Send(to, "MDRRMO San Isidro — Verification Declined", html)
}

// SendFalseAlarmStrikeEmail sends a false alarm warning/suspension email
func (m *Mailer) SendFalseAlarmStrikeEmail(to, firstName string, strikes, maxStrikes int, reason, accountStatus string) error {
	statusColor := "#f59e0b"
	statusText := fmt.Sprintf("Strike %d of %d", strikes, maxStrikes)
	if accountStatus == "banned" {
		statusColor = "#dc2626"
		statusText = "Account Suspended"
	}

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
<div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="background: %s; padding: 32px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ %s</h1>
  </div>
  <div style="padding: 32px;">
    <p style="color: #374151; font-size: 16px;">Hi %s,</p>
    <p style="color: #374151; font-size: 16px;">A false alarm strike has been recorded on your account.</p>
    <p style="color: #374151; font-size: 14px;"><strong>Reason:</strong> %s</p>
    <p style="color: #374151; font-size: 14px;"><strong>Current strikes:</strong> %d / %d</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">MDRRMO San Isidro Emergency Response System</p>
  </div>
</div>
</body>
</html>`, statusColor, statusText, firstName, reason, strikes, maxStrikes)

	return m.Send(to, fmt.Sprintf("MDRRMO San Isidro — %s", statusText), html)
}

// SendBugReportEmail forwards a bug report to the dev team
func (m *Mailer) SendBugReportEmail(to string, feedbackID int, citizenName, citizenEmail, category, message, createdAt, adminNotes string) error {
	notesSection := ""
	if adminNotes != "" {
		notesSection = fmt.Sprintf(`<p><strong>Admin Notes:</strong> %s</p>`, adminNotes)
	}

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 0;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="background: #1e293b; padding: 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">🐛 Technical Bug Report #%d</h1>
  </div>
  <div style="padding: 24px;">
    <p><strong>From:</strong> %s (%s)</p>
    <p><strong>Category:</strong> %s</p>
    <p><strong>Submitted:</strong> %s</p>
    <hr style="margin: 16px 0;">
    <p><strong>Message:</strong></p>
    <p style="background: #f9fafb; padding: 16px; border-radius: 8px;">%s</p>
    %s
  </div>
</div>
</body>
</html>`, feedbackID, citizenName, citizenEmail, category, createdAt, message, notesSection)

	return m.Send(to, fmt.Sprintf("SINE MDRRMO Bug Report #%d — %s", feedbackID, category), html)
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
	devEmail := "ejcp2005@gmail.com"
	if config.AppConfig != nil && config.AppConfig.DevSupportEmail != "" {
		devEmail = config.AppConfig.DevSupportEmail
	}
	return GetMailer().SendBugReportEmail(devEmail, feedbackID, citizenName, citizenEmail, category, message, createdAt, adminNotes)
}

