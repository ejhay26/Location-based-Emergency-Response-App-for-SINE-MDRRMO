<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * TechnicalBugReportMail — Dispatched to developers / technical support team
 * when citizen feedback or a software issue is forwarded by MDRRMO administrators.
 */
class TechnicalBugReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly int $feedbackId,
        public readonly string $citizenName,
        public readonly string $citizenUsername,
        public readonly string $citizenEmail,
        public readonly string $category,
        public readonly ?int $rating,
        public readonly string $messageContent,
        public readonly string $createdAt,
        public readonly ?array $deviceInfo = null,
        public readonly ?string $adminNotes = null
    ) {
    }

    public function envelope(): Envelope
    {
        $subject = "🛠️ [Technical Bug Report #{$this->feedbackId}] {$this->category} — SINE MDRRMO";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.technical-bug-report',
            text: 'emails.technical-bug-report-text',
            with: [
                'feedbackId'      => $this->feedbackId,
                'citizenName'     => $this->citizenName,
                'citizenUsername' => $this->citizenUsername,
                'citizenEmail'    => $this->citizenEmail,
                'category'        => $this->category,
                'rating'          => $this->rating ?? 5,
                'messageContent'  => $this->messageContent,
                'createdAt'       => $this->createdAt,
                'deviceInfo'      => $this->deviceInfo ?? [],
                'adminNotes'      => $this->adminNotes,
            ],
        );
    }
}
