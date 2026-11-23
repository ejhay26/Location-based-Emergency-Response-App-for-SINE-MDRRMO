package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
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

	// Check for CLI subcommands (e.g. ./server backup ..., ./server test-mail <email>)
	if len(os.Args) > 1 && os.Args[1] == "backup" {
		backup.HandleCli(os.Args[2:])
		return
	}
	if len(os.Args) > 2 && os.Args[1] == "test-mail" {
		targetEmail := os.Args[2]
		templateType := "otp"
		if len(os.Args) > 3 {
			templateType = strings.ToLower(os.Args[3])
		}

		mailer := services.NewMailer()
		sentAtFormatted := time.Now().In(time.Local).Format("Monday, January 02, 2006 at 03:04:05 PM MST (GMT+8)")
		var err error

		switch templateType {
		case "welcome":
			err = mailer.SendWelcomeEmail(targetEmail, "Juan")
		case "bug":
			err = mailer.SendBugReportEmail(
				targetEmail,
				1,
				"Juan Dela Cruz",
				"citizen@sine-mdrrmo.gov.ph",
				"Application Crash",
				"App closes unexpectedly when navigating near Barangay Alua on the emergency map.",
				time.Now().Format("2006-01-02 15:04:05"),
				"Forwarded by Admin to technical development team for immediate investigation.",
			)
		default:
			err = mailer.SendOtpEmail(targetEmail, 584920, "verifying your new account")
		}

		if err != nil {
			fmt.Printf("FAIL: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("SUCCESS: Sent templated [%s] email to %s (Time: %s)\n", templateType, targetEmail, sentAtFormatted)
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

	isAllowedOrigin := func(origin string) bool {
		if origin == "" {
			return false
		}
		if allowedOrigins[origin] {
			return true
		}
		if strings.Contains(origin, "ngrok") || strings.Contains(origin, "ngrok-free") {
			return true
		}
		if strings.HasPrefix(origin, "http://10.") || strings.HasPrefix(origin, "http://192.168.") || strings.HasPrefix(origin, "http://172.") {
			return true
		}
		if strings.HasPrefix(origin, "http://159.223.42.159") || strings.HasPrefix(origin, "https://159.223.42.159") {
			return true
		}
		if strings.HasPrefix(origin, "capacitor://") || strings.HasPrefix(origin, "ionic://") || strings.HasPrefix(origin, "tauri://") || strings.HasPrefix(origin, "file://") {
			return true
		}
		if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "https://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") || strings.HasPrefix(origin, "https://127.0.0.1:") {
			return true
		}
		return false
	}

	app.Use(func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		path := c.Path()

		if strings.HasPrefix(path, "/tiles/") || path == "/health" || path == "/api/health" {
			c.Set("Access-Control-Allow-Origin", "*")
		} else if isAllowedOrigin(origin) {
			c.Set("Access-Control-Allow-Origin", origin)
			c.Set("Access-Control-Allow-Credentials", "true")
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
			if origin != "" && !isAllowedOrigin(origin) && !strings.HasPrefix(path, "/tiles/") && path != "/health" && path != "/api/health" {
				return c.SendStatus(fiber.StatusForbidden)
			}
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	})

	// Base execution directory
	baseDir := "."
	if execPath, err := os.Executable(); err == nil {
		if realPath, err := filepath.EvalSymlinks(execPath); err == nil {
			baseDir = filepath.Dir(realPath)
		} else {
			baseDir = filepath.Dir(execPath)
		}
	}

	// Static Storage Directory (equivalent to php artisan storage:link)
	storageDir := os.Getenv("STORAGE_PATH")
	if storageDir == "" {
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

	// Static Frontend Serving (PWA & Web Client) with SPA Fallback
	frontendDir := filepath.Join(baseDir, "..", "frontend", "www")
	for _, candidate := range []string{
		filepath.Join(baseDir, "..", "frontend", "www"),
		filepath.Join(baseDir, "frontend", "www"),
		filepath.Join(baseDir, "www"),
	} {
		if _, err := os.Stat(filepath.Join(candidate, "index.html")); err == nil {
			frontendDir = candidate
			break
		}
	}
	if info, err := os.Stat(frontendDir); err == nil && info.IsDir() {
		app.Static("/", frontendDir, fiber.Static{
			Index: "index.html",
		})
		app.Use(func(c *fiber.Ctx) error {
			path := c.Path()
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") ||
				strings.HasPrefix(path, "/storage") || strings.HasPrefix(path, "/tiles") ||
				strings.HasPrefix(path, "/app") {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Not Found"})
			}
			return c.SendFile(filepath.Join(frontendDir, "index.html"))
		})
	}

	// Start server
	port := cfg.AppPort
	if port == "" {
		port = "3000"
	}
	portNum := strings.TrimPrefix(port, ":")
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	// Ensure Ngrok tunnel is active automatically so single-click startup serves both local & public URLs
	go ensureNgrokTunnel(portNum)

	fmt.Printf("\n🚀 %s running all-in-one Go Fiber + SQLite + Frontend server on http://localhost:%s\n", cfg.AppName, portNum)
	log.Fatal(app.Listen(port))
}

func queryNgrokPublicURL() string {
	client := &http.Client{Timeout: 800 * time.Millisecond}
	resp, err := client.Get("http://127.0.0.1:4040/api/tunnels")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}
	var parsed struct {
		Tunnels []struct {
			PublicURL string `json:"public_url"`
		} `json:"tunnels"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || len(parsed.Tunnels) == 0 {
		return ""
	}
	for _, t := range parsed.Tunnels {
		if strings.HasPrefix(t.PublicURL, "https://") {
			return t.PublicURL
		}
	}
	return parsed.Tunnels[0].PublicURL
}

func ensureNgrokTunnel(portNum string) {
	if existing := queryNgrokPublicURL(); existing != "" {
		fmt.Printf("🌐 Ngrok tunnel already active: %s\n", existing)
		return
	}

	ngrokBin, err := exec.LookPath("ngrok")
	if err != nil {
		winAppsCandidate := filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "WindowsApps", "ngrok.exe")
		if _, statErr := os.Stat(winAppsCandidate); statErr == nil {
			ngrokBin = winAppsCandidate
		}
	}
	if ngrokBin == "" {
		fmt.Println("⚠️  ngrok executable not found in PATH; serving local/LAN only.")
		return
	}

	cmd := exec.Command(ngrokBin, "http", portNum)
	if err := cmd.Start(); err != nil {
		fmt.Printf("⚠️  Could not auto-start ngrok: %v\n", err)
		return
	}

	for i := 0; i < 12; i++ {
		time.Sleep(350 * time.Millisecond)
		if url := queryNgrokPublicURL(); url != "" {
			fmt.Printf("🌐 Ngrok Public HTTPS URL ready: %s\n", url)
			return
		}
	}
	fmt.Println("⚠️  Ngrok started; tunnel URL still initializing.")
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

