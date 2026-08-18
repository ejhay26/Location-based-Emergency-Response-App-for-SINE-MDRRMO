<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * OtpMail — registration email-OTP delivery.
 *
 * NOTE: this class did not previously exist even though
 * AuthController::register() already called `new \App\Mail\OtpMail($otp)`
 * for the email OTP channel — that call was fatal-erroring (class not
 * found) for every citizen who registered with "Email OTP" selected.
 * This fixes that; behavior/copy mirrors the working Mail::raw() calls
 * elsewhere in AuthController (login OTP, password reset OTP) for
 * consistency.
 */
class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param $purpose Short context shown above the code, e.g. "logging in"
     *                 or "resetting your password" — mirrors the wording
     *                 already used in the SMS channel (PhilSmsService) so
     *                 the two channels read consistently. Defaults to the
     *                 registration wording since that's OtpMail's original
     *                 caller.
     */
    public function __construct(
        public readonly int|string $otp,
        public readonly string $purpose = 'verifying your account',
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your MDRRMO San Isidro Verification Code');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp',
            text: 'emails.otp-text',
            with: ['otp' => $this->otp, 'purpose' => $this->purpose],
        );
    }
}
