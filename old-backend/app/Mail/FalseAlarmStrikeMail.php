<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * FalseAlarmStrikeMail — Dispatched to citizens when an emergency report
 * is flagged as a false alarm or a disciplinary strike is issued by an admin.
 */
class FalseAlarmStrikeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $firstName,
        public readonly string $recipientEmail,
        public readonly int $strikeNumber,
        public readonly int $strikesTotal,
        public readonly string $reason,
        public readonly string $accountStatus
    ) {
    }

    public function envelope(): Envelope
    {
        $subject = $this->strikeNumber >= 3
            ? '🚨 URGENT: Account Suspended (3 False Alarm Strikes) — MDRRMO San Isidro'
            : "⚠️ Official Notice: False Alarm Strike {$this->strikeNumber} of 3 — MDRRMO San Isidro";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.false-alarm-strike',
            text: 'emails.false-alarm-strike-text',
            with: [
                'firstName'        => $this->firstName,
                'recipientEmail'   => $this->recipientEmail,
                'strikeNumber'     => $this->strikeNumber,
                'strikesTotal'     => $this->strikesTotal,
                'remainingStrikes' => max(0, 3 - $this->strikeNumber),
                'reason'           => $this->reason,
                'accountStatus'    => $this->accountStatus,
            ],
        );
    }
}
