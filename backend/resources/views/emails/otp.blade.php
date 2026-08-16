<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8;font-family:Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#D32F2F;padding:24px 32px;">
              <span style="color:#ffffff;font-size:18px;font-weight:bold;">MDRRMO San Isidro</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px 0;font-size:15px;color:#222428;">
                Use the verification code below for {{ $purpose ?? 'verifying your account' }}. It expires in 10 minutes.
              </p>
              <div style="text-align:center;margin:8px 0 28px 0;">
                <span style="display:inline-block;font-size:40px;font-weight:800;letter-spacing:14px;color:#D32F2F;padding:0 0 0 14px;">
                  {{ $otp }}
                </span>
              </div>
              <p style="margin:0;font-size:13px;color:#666666;line-height:1.5;">
                If you did not request this code, you can safely ignore this email — no changes were made to your account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f5f8;padding:20px 32px;border-top:1px solid #e6e6e6;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;">
                MDRRMO San Isidro<br>
                San Isidro, Nueva Ecija, Philippines 3106
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
