SINE MDRRMO - DISCIPLINARY NOTICE: FALSE ALARM STRIKE {{ $strikeNumber }} OF 3
================================================================

Dear {{ $firstName }},

{{ $strikeNumber >= 3 ? 'Your citizen account has received its 3rd False Alarm Strike and has been AUTOMATICALLY SUSPENDED.' : 'An emergency report submitted through your account was marked as a false alarm by MDRRMO San Isidro.' }}

RECORD SUMMARY:
----------------------------------------------------------------
• Strike Number: {{ $strikeNumber }} of 3
• Stated Reason: {{ $reason }}
• Date Recorded: {{ now()->format('F j, Y, g:i A') }}
• Remaining Strikes: {{ $remainingStrikes === 0 ? '0 (Account Suspended)' : $remainingStrikes . ' strike(s) remaining before account suspension' }}

POLICY:
False alarm reports divert critical first responders away from real life-threatening emergencies. Reaching 3 false alarm strikes results in automatic account suspension.

For questions, appeals, or assistance:
• Globe Hotline: 0917-891-2345
• Smart Hotline: 0920-891-6789
• Landline: (044) 958-1234
• MDRRMO San Isidro Municipal Hall Compound, San Isidro, Nueva Ecija

(c) {{ date('Y') }} MDRRMO San Isidro. All rights reserved.
