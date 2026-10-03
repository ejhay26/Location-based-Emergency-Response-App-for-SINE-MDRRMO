<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technical Bug Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%;">
          
          <!-- Header with Technical Dev Branding -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);padding:26px 32px;text-align:left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">🛠️ SINE MDRRMO &bull; Developer Support</span>
                    <br>
                    <span style="color:#94a3b8;font-size:13px;">Technical Bug & Citizen Feedback Report</span>
                  </td>
                  <td align="right">
                    <span style="background-color:#334155;color:#f8fafc;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;font-family:monospace;">#FB-{{ $feedbackId }}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <!-- Category Badge -->
              <div style="display:inline-block;background-color:#eff6ff;border-left:4px solid #3b82f6;padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:#1d4ed8;font-size:13px;font-weight:bold;text-transform:uppercase;">
                  CATEGORY: {{ strtoupper($category) }} ({{ $rating }}/5 ★)
                </span>
              </div>

              <p style="margin:0 0 8px 0;font-size:18px;font-weight:bold;color:#0f172a;line-height:1.4;">
                Citizen Bug Report Forwarded by MDRRMO Admin
              </p>
              <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">
                Received on {{ \Carbon\Carbon::parse($createdAt)->format('F j, Y, g:i A') }} (PHT)
              </p>

              <!-- Reporter Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px 0;font-size:12px;font-weight:bold;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">
                      Reporter Information
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;">
                      <tr>
                        <td style="padding:3px 0;width:120px;color:#64748b;">Full Name:</td>
                        <td style="padding:3px 0;font-weight:bold;color:#0f172a;">{{ $citizenName }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Username:</td>
                        <td style="padding:3px 0;font-weight:600;">{{ '@' . $citizenUsername }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Email Address:</td>
                        <td style="padding:3px 0;"><a href="mailto:{{ $citizenEmail }}" style="color:#2563eb;text-decoration:none;">{{ $citizenEmail }}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Citizen Message Box -->
              <div style="margin-bottom:20px;">
                <p style="margin:0 0 8px 0;font-size:13px;font-weight:bold;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
                  Citizen Message / Bug Description:
                </p>
                <div style="background-color:#ffffff;border:1.5px solid #cbd5e1;border-radius:10px;padding:16px;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">{{ $messageContent }}</div>
              </div>

              @if(!empty($adminNotes))
              <!-- Admin Forwarding Notes -->
              <div style="margin-bottom:20px;background-color:#fef3c7;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:6px;">
                <p style="margin:0 0 4px 0;font-size:12px;font-weight:bold;color:#92400e;text-transform:uppercase;">Admin Note / Observation:</p>
                <p style="margin:0;font-size:13.5px;color:#78350f;line-height:1.5;">{{ $adminNotes }}</p>
              </div>
              @endif

              <!-- Hardware, Device & System Diagnostics -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:10px;padding:16px 18px;margin-bottom:20px;color:#f8fafc;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px 0;font-size:12px;font-weight:bold;text-transform:uppercase;color:#38bdf8;letter-spacing:0.5px;font-family:monospace;">
                      🖥️ Device & System Diagnostics
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12.5px;font-family:monospace;color:#e2e8f0;">
                      <tr>
                        <td style="padding:3px 0;width:130px;color:#94a3b8;">Platform:</td>
                        <td style="padding:3px 0;color:#38bdf8;">{{ $deviceInfo['platform'] ?? 'Web / Android / iOS' }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#94a3b8;">OS / Device:</td>
                        <td style="padding:3px 0;">{{ $deviceInfo['os'] ?? 'Unknown' }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#94a3b8;">Browser / Engine:</td>
                        <td style="padding:3px 0;">{{ $deviceInfo['browser'] ?? 'WebKit / Chromium' }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#94a3b8;">Screen Resolution:</td>
                        <td style="padding:3px 0;">{{ $deviceInfo['screen'] ?? 'N/A' }}</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#94a3b8;">User Agent:</td>
                        <td style="padding:3px 0;word-break:break-all;color:#cbd5e1;">{{ $deviceInfo['user_agent'] ?? (request()->header('User-Agent') ?? 'Unknown') }}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">
                This automated report was generated by <strong>SINE MDRRMO System Administration</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Target Developer Support: <a href="mailto:ejcp2005@gmail.com" style="color:#2563eb;">ejcp2005@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
