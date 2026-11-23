package handlers

import (
	"database/sql/driver"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/config"
)

// FlexTime scans both time.Time drivers (MySQL) and aggregate string timestamps (SQLite MAX()).
type FlexTime struct {
	t   time.Time
	set bool
}

func (ft FlexTime) Value() (driver.Value, error) {
	if !ft.set {
		return nil, nil
	}
	return ft.t, nil
}

func (ft *FlexTime) Scan(value interface{}) error {
	if value == nil {
		ft.set = false
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		ft.t = v
		ft.set = true
	case []byte:
		return ft.parseString(string(v))
	case string:
		return ft.parseString(v)
	}
	return nil
}

func (ft *FlexTime) parseString(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		ft.set = false
		return nil
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, s); err == nil {
			ft.t = parsed
			ft.set = true
			return nil
		}
	}
	return nil
}

func (ft FlexTime) MarshalJSON() ([]byte, error) {
	if !ft.set {
		return []byte("null"), nil
	}
	return json.Marshal(ft.t)
}

// FlexJSON scans both MySQL ([]byte) and SQLite (string) JSON/TEXT columns cleanly.
type FlexJSON []byte

func (j *FlexJSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		*j = append((*j)[0:0], v...)
	case string:
		*j = append((*j)[0:0], []byte(v)...)
	default:
		*j = nil
	}
	return nil
}

func (j FlexJSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func ConcatName(firstCol, lastCol string) string {
	if config.AppConfig != nil && config.AppConfig.DBDriver == "sqlite" {
		return "(COALESCE(" + firstCol + ", '') || ' ' || COALESCE(" + lastCol + ", ''))"
	}
	return "CONCAT(COALESCE(" + firstCol + ", ''), ' ', COALESCE(" + lastCol + ", ''))"
}

func DateYMDExpr(col string) string {
	if config.AppConfig != nil && config.AppConfig.DBDriver == "sqlite" {
		return "substr(CAST(" + col + " AS TEXT), 1, 10)"
	}
	return "DATE_FORMAT(" + col + ", '%Y-%m-%d')"
}

func GetDispatchSub() string {
	if config.AppConfig != nil && config.AppConfig.DBDriver == "sqlite" {
		return "(SELECT d1.request_id, " +
			"REPLACE(GROUP_CONCAT(DISTINCT d1.agency), ',', ', ') AS agency, " +
			"REPLACE(GROUP_CONCAT(DISTINCT NULLIF(d1.unit_name, '')), ',', ', ') AS unit_name, " +
			"MAX(d1.dispatch_time) AS dispatch_time, " +
			"REPLACE(GROUP_CONCAT(DISTINCT NULLIF(TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.last_name, '')), '')), ',', ', ') AS dispatched_by_name " +
			"FROM dispatch d1 " +
			"LEFT JOIN user_profiles dp ON d1.dispatched_by = dp.user_id " +
			"GROUP BY d1.request_id) ld"
	}
	return "(SELECT d1.request_id, " +
		"GROUP_CONCAT(DISTINCT d1.agency ORDER BY d1.dispatch_id SEPARATOR ', ') AS agency, " +
		"GROUP_CONCAT(DISTINCT NULLIF(d1.unit_name, '') ORDER BY d1.dispatch_id SEPARATOR ', ') AS unit_name, " +
		"MAX(d1.dispatch_time) AS dispatch_time, " +
		"GROUP_CONCAT(DISTINCT NULLIF(TRIM(CONCAT(COALESCE(dp.first_name, ''), ' ', COALESCE(dp.last_name, ''))), '') SEPARATOR ', ') AS dispatched_by_name " +
		"FROM dispatch d1 " +
		"LEFT JOIN user_profiles dp ON d1.dispatched_by = dp.user_id " +
		"GROUP BY d1.request_id) ld"
}

func parseFlexibleFloat64(val any) float64 {
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	case json.Number:
		f, _ := v.Float64()
		return f
	default:
		return 0
	}
}

func parseFlexibleInt(val any) int {
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(v))
		return i
	case json.Number:
		i, _ := v.Int64()
		return int(i)
	default:
		return 0
	}
}
