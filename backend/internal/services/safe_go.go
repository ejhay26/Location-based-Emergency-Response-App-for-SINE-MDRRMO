package services

import (
	"runtime/debug"

	"github.com/rs/zerolog/log"
)

// SafeGo executes a function in a new goroutine with panic recovery
// to prevent unexpected panics from terminating the Fiber process.
func SafeGo(fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().
					Interface("panic", r).
					Str("stack", string(debug.Stack())).
					Msg("Recovered from panic in background goroutine")
			}
		}()
		fn()
	}()
}
