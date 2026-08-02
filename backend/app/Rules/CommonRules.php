<?php

namespace App\Rules;

/**
 * Shared validation rule fragments used across AuthController.
 *
 * These are plain rule-array constants, not Form Request classes —
 * kept that way deliberately so every ->validate() call site keeps its
 * exact current error response shape (422 JSON, same field keys, same
 * default Laravel messages). Only the duplication is removed.
 */
class CommonRules
{
    /**
     * Password complexity used identically in register(), updatePassword(),
     * resetPassword(): min 8 chars, at least one lowercase, uppercase,
     * digit, and special character. Same 4 regex fragments as before.
     */
    public static function strongPassword(): array
    {
        return ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'];
    }
}
