# Email Setup Guide for Contact Form

## Overview
The contact form now sends emails directly to `info@example.com` using a Next.js API route and Nodemailer.

## Setup Instructions

### 1. Create Environment Variables
Create a `.env.local` file in your project root with the following variables:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 2. Email Provider Options

#### Option A: Gmail (Recommended)
1. Use your Gmail account
2. Enable 2-Factor Authentication
3. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `SMTP_PASS`

#### Option B: Custom Email Server
If you have your own email server (e.g., `mail.example.com`):
```env
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=info@example.com
SMTP_PASS=your-email-password
```

### 3. Vercel Deployment
For Vercel deployment, add these environment variables in your Vercel dashboard:
1. Go to your project settings
2. Environment Variables section
3. Add each variable:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`

### 4. Testing
1. Fill out the contact form
2. Submit the form
3. Check `info@example.com` inbox for the email

## Email Format
The email will include:
- Sender's contact information
- Subject line
- Full message
- Professional HTML formatting

## Troubleshooting
- Ensure SMTP credentials are correct
- Check firewall settings for SMTP ports
- Verify email provider allows SMTP access
- Check Vercel function logs for errors
