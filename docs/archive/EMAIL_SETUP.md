# Email setup (applicant & contact)

The app sends emails from **recruitment@example.com** for:

- **Application received** – automatic confirmation to the applicant when they submit a successful application (and for your records).
- **Contact form** – messages from the website contact form (to info@example.com).
- More emails (e.g. status update, interview invite) can be added later using the same setup.

## Using recruitment@example.com with Microsoft 365

If **recruitment@example.com** is a Microsoft 365 / Outlook mailbox:

1. **App password (recommended)**  
   - Go to [Microsoft account security](https://account.microsoft.com/security) (or your org’s M365 admin).  
   - Turn on 2FA for the recruitment account if needed.  
   - Create an **App password** for “Mail” or “Other app”.  
   - Use that app password as `SMTP_PASS` (not your normal login password).

2. **Environment variables** (e.g. in `.env` or Vercel):

   ```env
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_USER=recruitment@example.com
   SMTP_PASS=your_app_password_here
   ```

   Optional:

   ```env
   SMTP_FROM_NAME="HRIS Demo Recruitment"
   ```

3. **Port 587** uses STARTTLS; the app is already configured for that. Do not use port 25 from most cloud hosts (often blocked).

If sending fails, check:

- App password is correct and not expired.  
- The mailbox recruitment@example.com is allowed to send (no “blocked” or “restricted” in M365).  
- Your host (e.g. Vercel) allows outbound SMTP on port 587.

## Using your own mail server (e.g. mail.example.com)

If you use a different SMTP server for recruitment@example.com:

```env
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_USER=recruitment@example.com
SMTP_PASS=your_password
```

Port 465 uses SSL; the app treats 465 as secure and 587 as STARTTLS.

## When SMTP is not set

If `SMTP_USER` or `SMTP_PASS` is missing, the app does not send any email. Application submissions still succeed; only the confirmation email is skipped. This is useful in local development without real SMTP.

## Adding more emails later

- **Status update** (e.g. shortlisted / rejected): call a new helper from the PATCH `/api/applications/[id]` handler when status changes.  
- **Interview invite**: call a helper from the interview creation API with date/time and candidate email.  
- Reuse the same transporter (see `src/lib/email.ts`) and add functions like `sendStatusUpdateEmail(...)` and `sendInterviewInviteEmail(...)` that use the same SMTP config.
