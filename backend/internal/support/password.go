package support

import (
	"errors"
	"strings"
	"unicode"
)

// ValidateStrongPassword checks password complexity matching Laravel CommonRules::strongPassword():
// min 8 characters, at least one lowercase, uppercase, digit, and special character.
func ValidateStrongPassword(p string) error {
	if len(p) < 8 {
		return errors.New("Password must be at least 8 characters.")
	}
	var hasLower, hasUpper, hasDigit, hasSpecial bool
	for _, r := range p {
		switch {
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsDigit(r):
			hasDigit = true
		case strings.ContainsRune("@$!%*#?&^_-+=()[]{}<>~`'\"/\\|:;,.", r):
			hasSpecial = true
		}
	}
	if !hasLower || !hasUpper || !hasDigit || !hasSpecial {
		return errors.New("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.")
	}
	return nil
}
