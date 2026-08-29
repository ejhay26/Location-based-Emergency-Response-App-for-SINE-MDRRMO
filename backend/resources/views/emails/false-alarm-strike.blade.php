<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MDRRMO False Alarm Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);max-width:92%;">
          
          <!-- Header with MDRRMO Branding -->
          <tr>
            <td style="background-color:{{ $strikeNumber >= 3 ? '#b71c1c' : '#D32F2F' }};padding:26px 32px;text-align:left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">SINE MDRRMO</span>
                    <br>
                    <span style="color:#ffebee;font-size:13px;opacity:0.9;">Municipal Disaster Risk Reduction & Management Office</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <!-- Status Badge -->
              <div style="display:inline-block;background-color:{{ $strikeNumber >= 3 ? '#ffebee' : '#fff8e1' }};border-left:4px solid {{ $strikeNumber >= 3 ? '#c62828' : '#f57f17' }};padding:8px 14px;border-radius:4px;margin-bottom:20px;">
                <span style="color:{{ $strikeNumber >= 3 ? '#c62828' : '#b26a00' }};font-size:13px;font-weight:bold;">
                  {{ $strikeNumber >= 3 ? 'ACCOUNT STATUS: SUSPENDED (3 OF 3 STRIKES)' : 'DISCIPLINARY NOTICE: STRIKE ' . $strikeNumber . ' OF 3' }}
                </span>
              </div>

              <p style="margin:0 0 14px 0;font-size:18px;font-weight:bold;color:#222428;line-height:1.4;">
                {{ $strikeNumber >= 3 ? 'Account Suspension Notice' : 'False Alarm Warning Notice' }}
              </p>

              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                Dear {{ $firstName }},
              </p>

              <p style="margin:0 0 16px 0;font-size:14px;color:#444444;line-height:1.6;">
                @if($strikeNumber >= 3)
                  This is an official notice from the <strong>San Isidro MDRRMO</strong> that your citizen account has received its <strong>3rd False Alarm Strike</strong>. In accordance with municipal public safety regulations, your account has been <strong>automatically suspended</strong>.
                @else
                  This is an official notice from the <strong>San Isidro MDRRMO</strong> regarding an emergency incident report submitted through your account that was verified as a <strong>false alarm</strong> or invalid dispatch request.
                @endif
              </p>

              <!-- Incident Strike Details Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:10px;padding:18px 20px;margin:20px 0;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px 0;font-size:13px;font-weight:bold;text-transform:uppercase;color:#555555;letter-spacing:0.5px;">
                      Strike Record Summary
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#333;">
                      <tr>
                        <td style="padding:4px 0;width:140px;color:#777;">Current Strike Count:</td>
                        <td style="padding:4px 0;font-weight:bold;color:{{ $strikeNumber >= 3 ? '#c62828' : '#d32f2f' }};">
                          {{ $strikeNumber }} / 3 Strikes
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#777;">Stated Reason / Finding:</td>
                        <td style="padding:4px 0;font-weight:600;color:#222;">
                          {{ $reason }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#777;">Date Recorded:</td>
                        <td style="padding:4px 0;font-weight:500;">
                          {{ now()->format('F j, Y, g:i A') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#777;">Remaining Strikes:</td>
                        <td style="padding:4px 0;font-weight:bold;color:{{ $remainingStrikes === 0 ? '#c62828' : '#2e7d32' }};">
                          {{ $remainingStrikes === 0 ? '0 (Suspended)' : $remainingStrikes . ' strike(s) remaining before automatic ban' }}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Policy Explanation -->
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#222428;">
                Why are false alarm strikes issued?
              </p>
              <p style="margin:0 0 16px 0;font-size:13.5px;color:#555555;line-height:1.6;">
                Emergency response teams (Ambulance, BFP Firefighters, Police, and Rescue Units) are dispatched based on active SOS reports. False alarms divert critical first-responder resources away from real life-threatening emergencies. Reaching <strong>3 strikes</strong> results in permanent or administrative suspension from sending SOS alerts.
              </p>

              <!-- Appeals Info -->
              <p style="margin:16px 0 0 0;font-size:13px;color:#666666;line-height:1.5;">
                If you believe this strike was issued in error or wish to submit an appeal with supporting information, you may contact or visit the MDRRMO San Isidro Emergency Command Desk.
              </p>

              <!-- 24/7 Hotline Section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed #dee2e6;margin-top:24px;padding-top:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:bold;color:#D32F2F;">
                      🚨 MDRRMO San Isidro Contact & Inquiries:
                    </p>
                    <p style="margin:0;font-size:13px;color:#555555;line-height:1.6;">
                      • <strong>Globe Hotline:</strong> 0917-891-2345<br>
                      • <strong>Smart Hotline:</strong> 0920-891-6789<br>
                      • <strong>Landline:</strong> (044) 958-1234<br>
                      • <strong>Office Location:</strong> Municipal Hall Compound, San Isidro, Nueva Ecija
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="margin:0;font-size:12px;color:#888888;">
                © {{ date('Y') }} MDRRMO San Isidro • Emergency Operations Center. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
