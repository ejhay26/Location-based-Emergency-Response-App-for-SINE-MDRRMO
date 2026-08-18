<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * WelcomeMail — sent once, when an admin approves a citizen's pending
 * registration (CitizenController::approveUser). Not sent at registration
 * time itself — that's still "unverified" / pending review, so a welcome
 * message then would be premature.
 */
class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly User $user)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Welcome to MDRRMO San Isidro Emergency Response');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.welcome',
            with: ['firstName' => $this->user->first_name],
        );
    }
}
