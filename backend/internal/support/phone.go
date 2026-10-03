package support

import (
	"regexp"
	"strings"
)

var nonDigitsRegex = regexp.MustCompile(`\D+`)

// Normalize converts various Philippine mobile formats to canonical "639XXXXXXXXX" (12 digits)
func NormalizePhone(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	digits := nonDigitsRegex.ReplaceAllString(trimmed, "")

	// 12 digits starting with 63: canonical already
	if len(digits) == 12 && strings.HasPrefix(digits, "63") {
		if isValidMobileSuffix(digits) {
			return &digits
		}
		return nil
	}

	// 11 digits starting with 0: e.g. 09171234567 -> 639171234567
	if len(digits) == 11 && strings.HasPrefix(digits, "0") {
		candidate := "63" + digits[1:]
		if isValidMobileSuffix(candidate) {
			return &candidate
		}
		return nil
	}

	// 10 digits starting with 9: e.g. 9171234567 -> 639171234567
	if len(digits) == 10 && strings.HasPrefix(digits, "9") {
		candidate := "63" + digits
		if isValidMobileSuffix(candidate) {
			return &candidate
		}
		return nil
	}

	return nil
}

func isValidMobileSuffix(canonical string) bool {
	return len(canonical) == 12 && canonical[2] == '9'
}
