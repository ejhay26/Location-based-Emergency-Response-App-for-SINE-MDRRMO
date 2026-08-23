<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * VerificationDeclinedMail — polite notification dispatched to citizens
 * when their ID verification / KYC registration was not approved.
 */
class VerificationDeclinedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $firstName,
        public readonly string $recipientEmail
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Important: SINE MDRRMO Registration Verification Status'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.verification-declined',
            text: 'emails.verification-declined-text',
            with: [
                'firstName'      => $this->firstName,
                'recipientEmail' => $this->recipientEmail,
            ],
        );
    }
}
