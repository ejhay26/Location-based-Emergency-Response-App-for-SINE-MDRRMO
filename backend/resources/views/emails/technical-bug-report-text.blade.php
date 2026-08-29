[TECHNICAL BUG REPORT #{{ $feedbackId }}] — SINE MDRRMO
==================================================

CATEGORY: {{ strtoupper($category) }} (Rating: {{ $rating }}/5 Stars)
RECEIVED: {{ \Carbon\Carbon::parse($createdAt)->format('F j, Y, g:i A') }} (PHT)

REPORTER INFORMATION
--------------------
- Name: {{ $citizenName }}
- Username: @{{ $citizenUsername }}
- Email: {{ $citizenEmail }}

CITIZEN MESSAGE / BUG DESCRIPTION
---------------------------------
{{ $messageContent }}

@if(!empty($adminNotes))
ADMIN NOTE:
{{ $adminNotes }}
@endif

DEVICE & SYSTEM DIAGNOSTICS
---------------------------
- Platform: {{ $deviceInfo['platform'] ?? 'Web / Mobile' }}
- OS / Device: {{ $deviceInfo['os'] ?? 'Unknown' }}
- Browser / Engine: {{ $deviceInfo['browser'] ?? 'WebKit / Chromium' }}
- Screen Resolution: {{ $deviceInfo['screen'] ?? 'N/A' }}
- User Agent: {{ $deviceInfo['user_agent'] ?? (request()->header('User-Agent') ?? 'Unknown') }}

==================================================
Target Developer Support: ejcp2005@gmail.com
SINE MDRRMO — Municipal Disaster Risk Reduction & Management Office
