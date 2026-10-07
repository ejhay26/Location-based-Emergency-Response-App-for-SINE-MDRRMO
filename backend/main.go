package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/backup"
	"sine-mdrrmo-backend/internal/config"
	"sine-mdrrmo-backend/internal/cron"
	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/handlers"
	"sine-mdrrmo-backend/internal/middleware"
	"sine-mdrrmo-backend/internal/services"
	"sine-mdrrmo-backend/internal/websocket"

	fiberws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// 1. Load Configuration
	config.Load()
	cfg := config.AppConfig

	// Check for CLI subcommands (e.g. ./server backup create / list / prune, ./server test-mail <email>)
	if len(os.Args) > 1 && os.Args[1] == "backup" {
		handleBackupCli()
		return
	}
	if len(os.Args) > 2 && os.Args[1] == "test-mail" {
		targetEmail := os.Args[2]
		mailer := services.NewMailer()
		sentAtFormatted := time.Now().In(time.Local).Format("Monday, January 02, 2006 at 03:04:05 PM MST (GMT+8)")
		err := mailer.Send(targetEmail, "SINE-MDRRMO Go Fiber Mailer Verification Test", `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <div style="max-width: 500px; margin: auto; background: white; border: 1px solid #ddd; border-radius: 8px; padding: 24px;">
    <h2 style="color: #059669;">SINE-MDRRMO Go Fiber Live Mailer Test</h2>
    <p>This email confirms that the <strong>Go Fiber backend</strong> running on your VPS is successfully integrated with the Resend transactional email API.</p>
    <p style="color: #333; font-size: 13px;"><strong>Sent at:</strong> `+sentAtFormatted+`</p>
  </div>
</body>
</html>`)
		if err != nil {
			fmt.Printf("FAIL: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("SUCCESS: Sent test email to %s (Time: %s)\n", targetEmail, sentAtFormatted)
		return
	}

	// 2. Connect Database
	database.Connect()

	// 3. Automigrate Schema & Seed Initial Data
	database.AutoMigrate()
	database.Seed()

	// 4. Initialize WebSocket Broadcast Hub
	websocket.InitHub()

	// 5. Start Background Cron Scheduler
	cron.StartScheduler()

	// 6. Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName:      cfg.AppName,
		BodyLimit:    30 * 1024 * 1024, // 30 MB for base64 media uploads
		ServerHeader: "Go-Fiber-SINE",
	})

	// Global Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))

	// Trusted CORS middleware for Angular / Ionic / Capacitor / Tauri / VPS clients
	allowedOrigins := map[string]bool{
		"http://localhost:8100":   true,
		"http://localhost:4200":   true,
		"http://localhost:3000":   true,
		"http://127.0.0.1:8100":   true,
		"http://127.0.0.1:4200":   true,
		"http://127.0.0.1:3000":   true,
		"capacitor://localhost":   true,
		"http://localhost":        true,
		"https://localhost":       true,
		"tauri://localhost":       true,
		"http://tauri.localhost":  true,
		"https://tauri.localhost": true,
	}

	app.Use(func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		if origin != "" {
			if allowedOrigins[origin] || strings.HasPrefix(origin, "http://159.223.42.159") || strings.HasPrefix(origin, "https://159.223.42.159") {
				c.Set("Access-Control-Allow-Origin", origin)
				c.Set("Access-Control-Allow-Credentials", "true")
			} else {
				c.Set("Access-Control-Allow-Origin", origin)
			}
		} else {
			c.Set("Access-Control-Allow-Origin", "*")
		}

		reqHeaders := c.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			c.Set("Access-Control-Allow-Headers", reqHeaders)
		} else {
			c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Socket-ID, ngrok-skip-browser-warning, Cache-Control, Pragma, X-CSRF-TOKEN")
		}

		c.Set("Access-Control-Allow-Methods", "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS")
		c.Set("Access-Control-Expose-Headers", "Content-Length, Content-Type, Authorization, Content-Disposition")
		c.Set("Access-Control-Max-Age", "86400")

		if c.Method() == fiber.MethodOptions {
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	})

	// Static Storage Directory (equivalent to php artisan storage:link)
	storageDir := os.Getenv("STORAGE_PATH")
	if storageDir == "" {
		baseDir := "."
		if execPath, err := os.Executable(); err == nil {
			if realPath, err := filepath.EvalSymlinks(execPath); err == nil {
				baseDir = filepath.Dir(realPath)
			} else {
				baseDir = filepath.Dir(execPath)
			}
		}
		storageDir = filepath.Join(baseDir, "storage", "app", "public")
	}
	_ = os.MkdirAll(storageDir, 0755)
	app.Static("/storage", storageDir)
	app.Static("/storage-proxy", storageDir)

	// ─── WebSocket Routes (Native & Reverb / Pusher Compatible) ───────────
	wsUpgrade := func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}

	app.Use("/ws", wsUpgrade)
	app.Get("/ws", fiberws.New(websocket.Handler()))

	app.Use("/app", wsUpgrade)
	app.Get("/app/:app_key", fiberws.New(websocket.Handler()))

	// Route registrar that registers endpoints under both "/" and "/api"
	// ensuring compatibility with both frontend configurations.
	registerRoutes(app)

	// Start server
	port := cfg.AppPort
	if port == "" {
		port = "3000"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	fmt.Printf("\n🚀 %s running high-performance Go Fiber server on %s\n", cfg.AppName, port)
	log.Fatal(app.Listen(port))
}

func registerRoutes(app *fiber.App) {
	groups := []fiber.Router{
		app.Group(""),
		app.Group("/api"),
	}

	auth := middleware.AuthSanctum()
	adminAuth := middleware.RequireAbility("admin")
	dispAuth := middleware.RequireAbility("dispatcher")

	for _, g := range groups {
		// Public routes
		g.Get("/health", handlers.Health)

		// Map Tiles Proxy
		g.Get("/tiles/osm/:z/:x/:y.png", handlers.OsmTileProxy)
		g.Get("/tiles/satellite/:z/:y/:x", handlers.SatelliteTileProxy)
		g.Get("/tiles/satellite/:z/:y/:x.:ext", handlers.SatelliteTileProxy)

		// Auth & Verification (Rate-limited per IP)
		g.Post("/register", middleware.Throttle(5, 1), handlers.Register)
		g.Post("/login", middleware.Throttle(10, 1), handlers.Login)
		g.Post("/login-send-otp", middleware.Throttle(3, 1), handlers.LoginSendOtp)
		g.Post("/login-verify-otp", middleware.Throttle(5, 1), handlers.LoginVerifyOtp)
		g.Post("/verify-otp", middleware.Throttle(10, 1), handlers.VerifyOtp)
		g.Post("/resend-registration-otp", middleware.Throttle(3, 1), handlers.ResendRegistrationOtp)
		g.Post("/check-verification-status", middleware.Throttle(10, 1), handlers.CheckVerificationStatus)
		g.Get("/check-username", middleware.Throttle(20, 1), handlers.CheckUsername)
		g.Get("/check-email", middleware.Throttle(20, 1), handlers.CheckEmail)
		g.Post("/forgot-password", middleware.Throttle(3, 1), handlers.ForgotPassword)
		g.Post("/verify-reset-otp", middleware.Throttle(5, 1), handlers.VerifyResetOtp)
		g.Post("/reset-password", middleware.Throttle(5, 1), handlers.ResetPassword)

		// Authenticated operational feeds (Restricted to Dispatchers & Admins to protect citizen PII)
		g.Get("/active-emergencies", auth, dispAuth, handlers.GetActiveEmergencies)
		g.Get("/active-hazards", auth, dispAuth, handlers.GetActiveHazards)
		g.Get("/active-broadcast", auth, handlers.GetActiveBroadcast)
		g.Get("/dispatch-assets", auth, dispAuth, handlers.GetDispatchAssets)
		g.Get("/analytics", auth, dispAuth, handlers.GetAnalytics)
		g.Get("/archived-emergencies", auth, dispAuth, handlers.GetArchivedEmergencies)
		g.Post("/logout", auth, handlers.Logout)

		// Profile & Account
		g.Post("/update-profile-picture", auth, handlers.UpdateProfilePicture)
		g.Post("/update-password", auth, handlers.UpdatePassword)
		g.Post("/send-password-change-otp", auth, middleware.Throttle(3, 1), handlers.SendPasswordChangeOtp)
		g.Post("/verify-password-change-otp", auth, middleware.Throttle(5, 1), handlers.VerifyPasswordChangeOtp)
		g.Post("/update-medical-profile", auth, handlers.UpdateMedicalProfile)
		g.Post("/complete-account-setup", auth, handlers.CompleteAccountSetup)

		// User Settings
		g.Get("/settings", auth, handlers.GetUserSettings)
		g.Get("/settings/:user_id", auth, handlers.GetUserSettings)
		g.Post("/settings", auth, handlers.SetUserSettings)

		// Push Notifications
		g.Post("/save-push-token", auth, handlers.SavePushToken)
		g.Post("/delete-push-token", auth, handlers.DeletePushToken)

		// Citizen Actions
		g.Post("/submit-sos", auth, middleware.Throttle(5, 1), handlers.SubmitSos)
		g.Post("/cancel-sos", auth, handlers.CancelEmergency)
		g.Post("/submit-hazard", auth, middleware.Throttle(5, 1), handlers.SubmitHazard)
		g.Get("/my-emergencies", auth, handlers.GetMyEmergencies)
		g.Get("/my-emergencies/:user_id", auth, handlers.GetMyEmergencies)
		g.Get("/my-hazards", auth, handlers.GetMyHazards)
		g.Get("/my-hazards/:user_id", auth, handlers.GetMyHazards)

		// Feedback
		g.Post("/feedback", auth, middleware.Throttle(10, 1), handlers.StoreFeedback)

		// Admin-Only Routes
		g.Post("/create-dispatcher", auth, adminAuth, handlers.CreateDispatcher)
		g.Get("/pending-verifications", auth, adminAuth, handlers.GetPendingVerifications)
		g.Get("/dispatchers", auth, adminAuth, handlers.GetDispatchers)
		g.Post("/update-dispatcher", auth, adminAuth, handlers.UpdateDispatcher)
		g.Post("/deactivate-dispatcher", auth, adminAuth, handlers.DeactivateDispatcher)
		g.Post("/approve-user", auth, adminAuth, handlers.ApproveUser)
		g.Post("/reject-user", auth, adminAuth, handlers.RejectUser)
		g.Get("/citizens", auth, adminAuth, handlers.GetCitizens)
		g.Post("/suspend-citizen", auth, adminAuth, handlers.SuspendCitizen)
		g.Post("/reactivate-citizen", auth, adminAuth, handlers.ReactivateCitizen)
		g.Post("/issue-strike", auth, adminAuth, handlers.IssueStrike)
		g.Post("/reset-strikes", auth, adminAuth, handlers.ResetStrikes)
		g.Get("/feedback", auth, adminAuth, handlers.IndexFeedback)
		g.Post("/feedback/clear", auth, adminAuth, handlers.ClearFeedback)
		g.Get("/feedback/export", auth, adminAuth, handlers.ExportFeedback)
		g.Post("/feedback/:id/forward-bug", auth, adminAuth, handlers.ForwardBug)
		g.Post("/feedback/:id/archive", auth, adminAuth, handlers.ArchiveFeedbackItem)
		g.Post("/feedback/:id/restore", auth, adminAuth, handlers.RestoreFeedbackItem)
		g.Post("/feedback/purge", auth, adminAuth, handlers.PurgeFeedbackTrash)

		// Dispatcher-Operational Routes
		g.Post("/dispatch-emergency", auth, dispAuth, handlers.DispatchEmergency)
		g.Post("/resolve-emergency", auth, dispAuth, handlers.ResolveEmergency)
		g.Post("/mark-false-alarm", auth, dispAuth, handlers.MarkFalseAlarm)
		g.Post("/resolve-hazard", auth, dispAuth, handlers.ResolveHazard)
		g.Post("/create-broadcast", auth, dispAuth, handlers.CreateBroadcast)
		g.Post("/clear-broadcast", auth, dispAuth, handlers.ClearBroadcast)
		g.Post("/delete-draft", auth, dispAuth, handlers.DeleteDraft)
	}
}

func handleBackupCli() {
	action := "create"
	if len(os.Args) > 2 {
		action = os.Args[2]
	}

	switch action {
	case "create", "snapshot":
		fmt.Println("📦 Creating database backup snapshot...")
		snap, err := backup.CreateSnapshot("emergencydb")
		if err != nil {
			fmt.Printf("❌ Backup failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✅ Backup created: %s (%.2f MB)\n", snap.Filename, snap.SizeMB)

	case "list":
		list, err := backup.ListBackups()
		if err != nil {
			fmt.Printf("❌ Failed to list backups: %v\n", err)
			os.Exit(1)
		}
		if len(list) == 0 {
			fmt.Println("No backups found in storage/app/backups")
			return
		}
		fmt.Printf("%-35s %-12s %-20s\n", "FILENAME", "SIZE", "CREATED AT")
		fmt.Println(strings.Repeat("-", 70))
		for _, b := range list {
			fmt.Printf("%-35s %-12.2f MB %-20s\n", b.Filename, b.SizeMB, b.CreatedAt.Format("2006-01-02 15:04:05"))
		}

	case "prune":
		fmt.Println("🧹 Pruning backups older than 7 days...")
		pruned := backup.PruneOldBackups(7)
		fmt.Printf("✅ Pruning complete. %d backup(s) removed.\n", pruned)

	default:
		fmt.Printf("Unknown backup command '%s'. Available: create, list, prune\n", action)
		os.Exit(1)
	}
}
