<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * DisasterRecoveryNoticeMail — polite notification dispatched to citizens
 * who registered or updated their account during a database synchronization gap.
 */
class DisasterRecoveryNoticeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientEmail,
        public readonly ?string $snapshotTime = null
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Important Notice: SINE MDRRMO System Synchronization & Account Verification Update'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.disaster-recovery',
            text: 'emails.disaster-recovery-text',
            with: [
                'recipientEmail' => $this->recipientEmail,
                'snapshotTime'   => $this->snapshotTime,
            ],
        );
    }
}
