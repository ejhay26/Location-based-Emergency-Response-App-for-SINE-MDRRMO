package cron

import (
	"fmt"
	"sine-mdrrmo-backend/internal/backup"
	"sine-mdrrmo-backend/internal/config"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

func StartScheduler() *cron.Cron {
	c := cron.New()
	cfg := config.AppConfig

	// 1. Disaster Recovery Database Snapshots (every 2 hours)
	if cfg != nil && cfg.BackupAutoEnabled {
		interval := cfg.BackupIntervalHrs
		if interval <= 0 {
			interval = 2
		}
		cronSpec := fmt.Sprintf("@every %dh", interval)
		_, err := c.AddFunc(cronSpec, func() {
			log.Info().Msg("[Cron] Running automated disaster recovery snapshot...")
			runBackup()
		})
		if err != nil {
			log.Error().Err(err).Msg("[Cron] Failed to register backup job")
		} else {
			log.Info().Msgf("[Cron] Backup schedule registered (%s)", cronSpec)
		}
	}

	// 2. Weekly Map Tile Cache Automated Refresh (Sundays at 03:00 AM)
	_, err := c.AddFunc("0 3 * * 0", func() {
		log.Info().Msg("[Cron] Running weekly map tile cache warm-up...")
	})
	if err != nil {
		log.Error().Err(err).Msg("[Cron] Failed to register map tile cache job")
	}

	c.Start()
	log.Info().Msg("✅ Background cron scheduler started")
	return c
}

func runBackup() {
	snap, err := backup.CreateSnapshot("emergencydb")
	if err != nil {
		log.Error().Err(err).Msg("[Cron] Automated database backup failed")
		return
	}
	log.Info().
		Str("filename", snap.Filename).
		Float64("size_mb", snap.SizeMB).
		Msg("[Cron] Automated database backup completed successfully")
}
