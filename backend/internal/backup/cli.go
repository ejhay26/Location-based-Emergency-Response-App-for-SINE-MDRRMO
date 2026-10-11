package backup

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/database"
)

var validActions = map[string]string{
	"create":   "Create an instant gzip-compressed database snapshot",
	"run":      "Alias for create",
	"list":     "List all available backup snapshots with sizes and ages",
	"desc":     "Inspect and count table records inside a snapshot without restoring",
	"describe": "Alias for desc",
	"restore":  "Safely restore the database from a snapshot with diff preview",
	"salvage":  "Scan storage files and logs for unbacked records in the snapshot gap",
	"notify":   "Send polite recovery notification emails/SMS to citizens affected by a restore",
	"prune":    "Clean up old backups beyond the retention limits (12 intraday, 7 daily)",
	"status":   "Check automated backup schedule status and system health",
	"watch":    "Run the automated background backup schedule worker in foreground",
	"daemon":   "Alias for watch",
	"help":     "Display available disaster recovery commands and examples",
}

// HandleCli is the main CLI dispatcher for all backup subcommands
func HandleCli(args []string) {
	action := "help"
	var target string
	force := false
	showAll := false
	var customLimit int

	for i := 0; i < len(args); i++ {
		arg := args[i]
		if arg == "--force" || arg == "-f" {
			force = true
		} else if arg == "--all" || arg == "-a" {
			showAll = true
		} else if arg == "--help" || arg == "-h" {
			action = "help"
		} else if action == "help" && !strings.HasPrefix(arg, "-") {
			action = strings.ToLower(arg)
		} else if target == "" && !strings.HasPrefix(arg, "-") {
			target = arg
			if num, err := strconv.Atoi(arg); err == nil && action == "list" {
				customLimit = num
				target = ""
			}
		}
	}

	if _, exists := validActions[action]; !exists {
		closest := findClosestAction(action)
		fmt.Printf("\n ❌ Unknown action: \"%s\"\n", action)
		if closest != "" {
			fmt.Printf(" 💡 Did you mean: \"%s\"?\n", closest)
		}
		fmt.Println()
		displayHelp()
		os.Exit(1)
	}

	switch action {
	case "create", "run":
		handleCreateCli()
	case "list":
		handleListCli(showAll, customLimit)
	case "desc", "describe":
		handleDescCli(target, force)
	case "restore":
		handleRestoreCli(target, force)
	case "salvage":
		handleSalvageCli(target, force)
	case "notify":
		handleNotifyCli(target, force)
	case "prune":
		handlePruneCli()
	case "status":
		handleStatusCli()
	case "watch", "daemon":
		handleWatchCli()
	case "help":
		displayHelp()
	}
}

func handleCreateCli() {
	fmt.Println("🔄 Creating database snapshot...")
	snap, err := CreateSnapshot("emergencydb")
	if err != nil {
		fmt.Printf(" ❌ Failed to create database snapshot: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println("\n ✅ Snapshot created successfully!")
	fmt.Printf(" • File: %s\n", snap.Filename)
	fmt.Printf(" • Size: %s\n", snap.SizeHuman)
	fmt.Printf(" • Path: %s\n\n", snap.Path)
}

func handleListCli(showAll bool, customLimit int) {
	backups, err := ListBackups()
	if err != nil {
		fmt.Printf(" ❌ Failed to list backups: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n 📦 SINE MDRRMO Database Snapshots (%d total)\n", len(backups))
	fmt.Printf(" Directory: %s\n\n", GetBackupDir())

	if len(backups) == 0 {
		fmt.Println(" No snapshots found. Run 'backup create' to generate your first backup.\n")
		return
	}

	limit := 15
	if showAll {
		limit = len(backups)
	} else if customLimit > 0 {
		limit = customLimit
	}
	if limit > len(backups) {
		limit = len(backups)
	}

	headers := []string{"#", "Filename", "Size", "Created At", "Age", "Type"}
	var rows [][]string
	for i := 0; i < limit; i++ {
		b := backups[i]
		rows = append(rows, []string{
			fmt.Sprintf("%d", i+1),
			b.Filename,
			b.SizeHuman,
			b.DateFormatted,
			b.AgeHuman,
			b.Type,
		})
	}

	renderTable(headers, rows)

	if !showAll && len(backups) > limit {
		fmt.Printf(" ℹ️  Showing newest %d of %d snapshots. Use 'backup list --all' or 'backup list %d' to show more.\n", limit, len(backups), len(backups))
	}
	fmt.Println(" 💡 Tip: Run backup desc <filename> to inspect record counts.\n")
}

func handleDescCli(target string, force bool) {
	selected := resolveTarget(target, force)
	if selected == "" {
		return
	}

	fmt.Printf(" 🔍 Inspecting snapshot: %s\n", selected)
	desc, err := DescribeSnapshot(selected)
	if err != nil {
		fmt.Printf(" ❌ Failed to inspect snapshot: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println("\n 📋 Snapshot Metadata & Compression:")
	fmt.Printf(" • Filename:        %s\n", desc.Filename)
	fmt.Printf(" • Snapshot Date:   %s\n", desc.DateFormatted)
	fmt.Printf(" • Storage Size:    %s (Raw SQL: %s, Savings: %s)\n", desc.SizeCompressed, desc.SizeRaw, desc.CompressionRatio)
	fmt.Printf(" • Total Tables:    %d\n", desc.TotalTables)
	fmt.Printf(" • Grand Total Rows:%d records\n", desc.TotalRecords)

	if desc.LatestIncident != "" {
		fmt.Printf(" • Latest SOS In Archive: %s\n", desc.LatestIncident)
	}

	fmt.Printf("\n 📊 Complete Database Tables Breakdown (%d tables):\n", len(desc.TableCounts))

	// Sort table names alphabetically for tidy display
	var tableNames []string
	for tbl := range desc.TableCounts {
		tableNames = append(tableNames, tbl)
	}
	sort.Strings(tableNames)

	headers := []string{"Table Name", "Rows in Snapshot"}
	var rows [][]string
	for _, tbl := range tableNames {
		rows = append(rows, []string{tbl, fmt.Sprintf("%d", desc.TableCounts[tbl])})
	}
	renderTable(headers, rows)
	fmt.Println()
}

func handleRestoreCli(target string, force bool) {
	selected := resolveTarget(target, force)
	if selected == "" {
		return
	}

	// Initialize database connection to pull live table row counts
	database.Connect()

	fmt.Println(" ⚠️  PRE-RESTORE COMPARISON (Live DB vs Snapshot):")
	preview, err := GetDiffPreview(selected)
	if err != nil {
		fmt.Printf(" ❌ Failed to generate diff preview: %v\n\n", err)
		os.Exit(1)
	}

	var tableNames []string
	for tbl := range preview.Diff {
		tableNames = append(tableNames, tbl)
	}
	sort.Strings(tableNames)

	headers := []string{"Table", "Live Records", "Backup Records", "Net Difference"}
	var rows [][]string
	for _, tbl := range tableNames {
		d := preview.Diff[tbl]
		diffStr := fmt.Sprintf("%d", d.Difference)
		if d.Difference > 0 {
			diffStr = "+" + diffStr
		}
		rows = append(rows, []string{
			tbl,
			fmt.Sprintf("%d", d.Live),
			fmt.Sprintf("%d", d.Backup),
			diffStr,
		})
	}
	renderTable(headers, rows)

	if !force {
		fmt.Printf("\n ❓ Are you sure you want to RESTORE from \"%s\"?\n    (An automatic safety snapshot of the live database will be created first) [y/N]: ", selected)
		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(strings.ToLower(input))
		if input != "y" && input != "yes" {
			fmt.Println(" ⏹️ Restoration cancelled by user.\n")
			return
		}
	}

	fmt.Println("\n 🔄 Creating safety snapshot and restoring database...")
	result, err := RestoreSnapshot(selected)
	if err != nil {
		fmt.Printf(" ❌ Restoration failed: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println("\n ✅ Database restored successfully!")
	fmt.Printf(" • Restored from: %s\n", result.RestoredFile)
	fmt.Printf(" • Safety pre-restore snapshot saved: %s\n", result.SafetyBackup)
	fmt.Printf(" 💡 Next step: Run backup salvage %s to check for unbacked registrations during the gap.\n\n", selected)
}

func handleSalvageCli(target string, force bool) {
	selected := resolveTarget(target, force)
	if selected == "" {
		return
	}

	fmt.Println(" 🔍 Scanning storage proofs and logs for unbacked gap data...")
	salvage, err := SalvageGapData(selected)
	if err != nil {
		fmt.Printf(" ❌ Salvage scan failed: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println()
	fmt.Printf(" ⏱️ Snapshot Timestamp: %s\n", salvage.SnapshotTime)
	fmt.Printf(" 📁 New Proof Files in Storage since snapshot: %d\n", salvage.GapFilesCount)

	if salvage.GapFilesCount > 0 {
		headers := []string{"Relative File Path", "Size", "Created At"}
		var rows [][]string
		for _, f := range salvage.GapFiles {
			rows = append(rows, []string{f.Path, f.Size, f.CreatedAt})
		}
		renderTable(headers, rows)
	}

	fmt.Println()
	fmt.Printf(" 👥 Unbacked Registrations / OTP Activity Detected: %d\n", salvage.GapCitizensCount)

	if salvage.GapCitizensCount > 0 {
		headers := []string{"Channel", "Target Identifier", "Activity Timestamp"}
		var rows [][]string
		for ph, timeStr := range salvage.GapPhones {
			rows = append(rows, []string{"SMS / Phone", ph, timeStr})
		}
		for em, timeStr := range salvage.GapEmails {
			rows = append(rows, []string{"Email", em, timeStr})
		}
		renderTable(headers, rows)

		fmt.Printf("\n 💡 Run backup notify %s to send polite recovery notices to these citizens.\n\n", selected)
	} else {
		fmt.Println(" ✅ Zero gap data detected. The database was 100% synchronized with the snapshot!\n")
	}
}

func handleNotifyCli(target string, force bool) {
	selected := resolveTarget(target, force)
	if selected == "" {
		return
	}

	if !force {
		fmt.Printf("\n ❓ Send recovery notice emails and SMS to citizens identified in the gap of \"%s\"? [y/N]: ", selected)
		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(strings.ToLower(input))
		if input != "y" && input != "yes" {
			fmt.Println(" ⏹️ Notification dispatch cancelled.\n")
			return
		}
	}

	fmt.Println(" 📨 Dispatching recovery notifications...")
	res, err := NotifyGapCitizens(selected)
	if err != nil {
		fmt.Printf(" ❌ Notification dispatch failed: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println("\n ✅ Notification dispatch complete!")
	fmt.Printf(" • Total Targets: %d\n", res.TotalTargets)
	fmt.Printf(" • Successfully Sent: %d\n", res.Notified)
	if res.Failed > 0 {
		fmt.Printf(" • Failed: %d\n", res.Failed)
	}
	fmt.Println()
}

func handlePruneCli() {
	fmt.Println(" 🧹 Enforcing backup retention limits (12 intraday / 7 daily)...")
	pruned := PruneOldBackups()
	fmt.Printf(" ✅ Pruning complete. %d old snapshot(s) deleted.\n\n", pruned)
}

func handleStatusCli() {
	status, err := GetStatus()
	if err != nil {
		fmt.Printf(" ❌ Failed to retrieve status: %v\n\n", err)
		os.Exit(1)
	}

	fmt.Println("\n 📊 SINE MDRRMO Disaster Recovery Status & Health:\n")
	statusStr := "● ON (Active in .env)"
	if !status.AutoEnabled {
		statusStr = "○ OFF (Disabled in .env)"
	}

	fmt.Printf(" • Automated Backup:   %s\n", statusStr)
	fmt.Printf(" • Backup Interval:    Every %d Hours\n", status.IntervalHours)
	fmt.Printf(" • Retention Limits:   %d Intraday / %d Daily Snapshots\n", status.MaxIntraday, status.MaxDaily)
	fmt.Printf(" • Total Snapshots:    %d archives\n", status.TotalSnapshots)

	if status.LatestSnapshot != nil {
		fmt.Printf(" • Latest Snapshot:    %s (%s, %s)\n",
			status.LatestSnapshot.Filename,
			status.LatestSnapshot.SizeHuman,
			status.LatestSnapshot.AgeHuman,
		)
	} else {
		fmt.Println(" • Latest Snapshot:    None yet (run 'backup create')")
	}

	fmt.Println("\n 💡 Automated daemon operations:")
	fmt.Println(" • Inside Go Backend:    Managed automatically by embedded goroutine cron scheduler")
	fmt.Println(" • On Linux / VPS:       Managed 24/7 by systemd (backend.service)\n")
}

func handleWatchCli() {
	fmt.Println(" 🔄 Starting SINE MDRRMO automated backup schedule daemon in foreground...")
	fmt.Println(" Press Ctrl+C to stop.\n")

	ticker := time.NewTicker(2 * time.Hour)
	defer ticker.Stop()

	// Initial run
	fmt.Println("📦 Triggering immediate snapshot...")
	_, _ = CreateSnapshot("emergencydb")

	for range ticker.C {
		fmt.Printf("[%s] 📦 Automated snapshot triggering...\n", time.Now().Format("15:04:05"))
		_, _ = CreateSnapshot("emergencydb")
	}
}

func resolveTarget(target string, force bool) string {
	backups, err := ListBackups()
	if err != nil || len(backups) == 0 {
		fmt.Printf(" ❌ No backup files found in %s\n\n", GetBackupDir())
		return ""
	}

	clean := strings.TrimSpace(target)

	// 1. Target provided
	if clean != "" {
		// Numeric index e.g. "1" or "#1"
		if strings.HasPrefix(clean, "#") {
			clean = strings.TrimPrefix(clean, "#")
		}
		if idx, err := strconv.Atoi(clean); err == nil {
			idx = idx - 1
			if idx >= 0 && idx < len(backups) {
				fmt.Printf(" 🎯 Selected #%d: %s\n\n", idx+1, backups[idx].Filename)
				return backups[idx].Filename
			}
		}

		// Keywords
		lower := strings.ToLower(clean)
		if lower == "latest" || lower == "newest" || lower == "recent" || lower == "last" {
			fmt.Printf(" 🎯 Selected latest snapshot: %s\n\n", backups[0].Filename)
			return backups[0].Filename
		}

		// Exact match
		for _, b := range backups {
			if b.Filename == clean {
				return b.Filename
			}
		}

		// Substring match
		var matches []BackupInfo
		for _, b := range backups {
			if strings.Contains(strings.ToLower(b.Filename), strings.ToLower(clean)) {
				matches = append(matches, b)
			}
		}

		if len(matches) == 1 {
			fmt.Printf(" 🎯 Matched snapshot: %s\n\n", matches[0].Filename)
			return matches[0].Filename
		}

		if len(matches) > 1 {
			fmt.Printf(" 🔍 Multiple snapshots matched \"%s\":\n", clean)
			for i, m := range matches {
				fmt.Printf(" [%d] %s (%s, %s)\n", i, m.Filename, m.SizeHuman, m.AgeHuman)
			}
			fmt.Println(" [c] ❌ Cancel / Exit")
			fmt.Print(" Select a snapshot: ")
			reader := bufio.NewReader(os.Stdin)
			choiceStr, _ := reader.ReadString('\n')
			choiceStr = strings.TrimSpace(choiceStr)
			if choiceStr == "c" || choiceStr == "C" {
				fmt.Println(" ⏹️ Operation cancelled.\n")
				return ""
			}
			if selIdx, err := strconv.Atoi(choiceStr); err == nil && selIdx >= 0 && selIdx < len(matches) {
				return matches[selIdx].Filename
			}
			fmt.Println(" ❌ Invalid selection.\n")
			return ""
		}

		fmt.Printf(" ❌ No snapshot found matching \"%s\".\n\n", clean)
	}

	// 2. Force mode with no target defaults to latest
	if force {
		return backups[0].Filename
	}

	// 3. Paginated interactive selection menu
	page := 0
	perPage := 5
	total := len(backups)
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}

	reader := bufio.NewReader(os.Stdin)
	for {
		start := page * perPage
		end := start + perPage
		if end > total {
			end = total
		}
		slice := backups[start:end]

		fmt.Printf("\n 📦 Available Snapshots (Page %d of %d):\n", page+1, totalPages)
		for i, b := range slice {
			label := ""
			if (page*perPage)+i == 0 {
				label = "[Latest] "
			}
			fmt.Printf(" [%d] %s%s (%s, %s)\n", i, label, b.Filename, b.SizeHuman, b.AgeHuman)
		}

		if page+1 < totalPages {
			fmt.Printf(" [n] ➡️  Next Page (Page %d)\n", page+2)
		}
		if page > 0 {
			fmt.Printf(" [p] ⬅️  Previous Page (Page %d)\n", page)
		}
		fmt.Println(" [c] ❌ Cancel / Exit")
		fmt.Print(" Select a snapshot to proceed: ")

		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if input == "c" || input == "C" {
			fmt.Println(" ⏹️ Operation cancelled.\n")
			return ""
		}
		if (input == "n" || input == "N") && page+1 < totalPages {
			page++
			continue
		}
		if (input == "p" || input == "P") && page > 0 {
			page--
			continue
		}

		if selIdx, err := strconv.Atoi(input); err == nil && selIdx >= 0 && selIdx < len(slice) {
			fmt.Println()
			return slice[selIdx].Filename
		}

		fmt.Println(" ⚠️  Please enter a valid choice.")
	}
}

func renderTable(headers []string, rows [][]string) {
	colWidths := make([]int, len(headers))
	for i, h := range headers {
		colWidths[i] = len(h)
	}
	for _, row := range rows {
		for i, val := range row {
			if i < len(colWidths) && len(val) > colWidths[i] {
				colWidths[i] = len(val)
			}
		}
	}

	// Border separator
	var sepParts []string
	for _, w := range colWidths {
		sepParts = append(sepParts, strings.Repeat("-", w+2))
	}
	sep := "+" + strings.Join(sepParts, "+") + "+"

	fmt.Println(sep)

	// Header row
	var headerParts []string
	for i, h := range headers {
		headerParts = append(headerParts, fmt.Sprintf(" %-*s ", colWidths[i], h))
	}
	fmt.Println("|" + strings.Join(headerParts, "|") + "|")
	fmt.Println(sep)

	// Data rows
	for _, row := range rows {
		var rowParts []string
		for i, val := range row {
			if i < len(colWidths) {
				rowParts = append(rowParts, fmt.Sprintf(" %-*s ", colWidths[i], val))
			}
		}
		fmt.Println("|" + strings.Join(rowParts, "|") + "|")
	}

	fmt.Println(sep)
}

func findClosestAction(input string) string {
	closest := ""
	shortest := -1

	for act := range validActions {
		dist := levenshteinDistance(input, act)
		if dist <= 3 && (dist < shortest || shortest < 0) {
			closest = act
			shortest = dist
		}
	}
	return closest
}

func levenshteinDistance(s1, s2 string) int {
	r1, r2 := []rune(s1), []rune(s2)
	l1, l2 := len(r1), len(r2)
	dp := make([][]int, l1+1)
	for i := range dp {
		dp[i] = make([]int, l2+1)
		dp[i][0] = i
	}
	for j := 0; j <= l2; j++ {
		dp[0][j] = j
	}

	for i := 1; i <= l1; i++ {
		for j := 1; j <= l2; j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}
			del := dp[i-1][j] + 1
			ins := dp[i][j-1] + 1
			sub := dp[i-1][j-1] + cost

			min := del
			if ins < min {
				min = ins
			}
			if sub < min {
				min = sub
			}
			dp[i][j] = min
		}
	}
	return dp[l1][l2]
}

func displayHelp() {
	fmt.Println("\n SINE MDRRMO Disaster Recovery Engine — High-Level Backup & Recovery CLI")
	fmt.Println(" Usage: backup <action> [target_file] [--force] [--all]")
	fmt.Println("\n Available Actions:")

	var rows [][]string
	for _, act := range []string{"create", "list", "desc", "restore", "salvage", "notify", "prune", "status", "watch", "help"} {
		rows = append(rows, []string{act, validActions[act]})
	}
	renderTable([]string{"Action", "Description"}, rows)

	fmt.Println("\n Examples:")
	fmt.Println(" • backup create                     Take an instant compressed database snapshot")
	fmt.Println(" • backup list                       Show available snapshots (clean table format)")
	fmt.Println(" • backup list --all                 Show all snapshots without truncation")
	fmt.Println(" • backup desc                       Inspect table record counts (interactive select)")
	fmt.Println(" • backup desc 1                     Inspect newest snapshot #1")
	fmt.Println(" • backup desc 144415                Inspect snapshot matching timestamp fragment")
	fmt.Println(" • backup restore                    Safe interactive restore with diff preview")
	fmt.Println(" • backup restore 1 --force          Restore snapshot #1 non-interactively")
	fmt.Println(" • backup salvage                    Scan storage and logs for unbacked gap data")
	fmt.Println(" • backup notify                     Send recovery notice SMS/emails to gap citizens")
	fmt.Println(" • backup prune                      Enforce retention limits (12 intraday / 7 daily)")
	fmt.Println(" • backup status                     Check automated schedule status and health\n")
}
