# ATS Integration Setup Guide

## Quick Start

The ATS integration is now set up with **mock data fallback**, so your website will work immediately without needing to configure the ATS API first.

### Current Status: ✅ Working with Mock Data

Your website is now using mock job data, which means:
- ✅ Job listings display correctly
- ✅ Search and filtering work
- ✅ Job application forms work
- ✅ All features are functional for testing

## Staff dashboard auth

Staff sign-in protects `/dashboard` (applications, jobs, analytics). For full reference and wiring (env vars, dev bypass, Microsoft SSO, forgot password), see **[AUTH.md](./AUTH.md)**.

- **Development:** If `STAFF_PASSWORD` is not set, seed scripts default to password **`stabex-demo-hris`** (see `prisma/seed-staff.js`); override with `STAFF_PASSWORD` in production.
- **Production:** Set `STAFF_PASSWORD` (and optionally `STAFF_EMAIL`) in your environment.

---

## Environment Configuration

### Option 1: Use Mock Data (Current - No Setup Required)
The system is currently configured to use mock data. No additional setup is needed.

### Option 2: Connect to Your ATS API

To connect to your actual ATS system, create a `.env.local` file in your project root:

```bash
# .env.local
NEXT_PUBLIC_ATS_API_URL=https://your-ats-api.com
NEXT_PUBLIC_ATS_API_KEY=your_api_key_here
NEXT_PUBLIC_DEBUG_ATS=true
```

## Testing the Integration

### 1. View Job Listings
- Navigate to `/careers`
- You should see 4 mock job listings
- Test the search and filter functionality

### 2. Test Job Application
- Click on any job to view details
- Click "Apply Now" to test the application form
- The form will work with mock data

### 3. Test Search and Filtering
- Use the search bar to filter jobs
- Try different location and category filters
- All filtering works with the mock data

## Mock Data Features

The current mock data includes:

### Job Listings (4 jobs)
1. **CEO and Trust Secretary** - Executive, Nairobi
2. **Sales Representative – Coast Region** - Sales & Marketing, Coast Region  
3. **Senior Lecturer in Software Development** - Education & Training, Nairobi
4. **ICT Security Officer** - Technology, Nairobi

### Features Working
- ✅ Job listing display
- ✅ Search by keyword, location, category
- ✅ Job detail pages
- ✅ Application form submission
- ✅ Resume upload simulation
- ✅ Responsive design
- ✅ Animations and interactions

## Next Steps

### Phase 1: Test Current Implementation
1. **Test all features** with mock data
2. **Verify responsive design** on mobile/tablet
3. **Check user experience** flow
4. **Gather feedback** from stakeholders

### Phase 2: Connect Real ATS (When Ready)
1. **Set up your ATS API** with the required endpoints
2. **Configure environment variables** in `.env.local`
3. **Test API integration** with real data
4. **Deploy to production**

## API Endpoints Required

When you're ready to connect your ATS, you'll need these endpoints:

```
GET    /api/jobs                    # List jobs with filters
GET    /api/jobs/:id                # Get specific job
POST   /api/applications            # Submit application
POST   /api/candidates              # Create candidate
POST   /api/upload/resume           # Upload resume
```

## Troubleshooting

### If you see errors:
1. **Check browser console** for any error messages
2. **Verify all files** are saved correctly
3. **Restart development server** if needed
4. **Clear browser cache** and refresh

### Common Issues:
- **"Failed to fetch" errors**: Normal with mock data, will be resolved when ATS API is connected
- **Styling issues**: Check if Tailwind CSS is properly configured
- **Component errors**: Verify all imports are correct

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## File Structure

```
src/
├── components/ats/
│   ├── DynamicJobListings.tsx     # Main job listings component
│   ├── JobApplicationForm.tsx     # Application form
│   └── EmployerDashboard.tsx      # Employer dashboard
├── lib/
│   ├── ats-api.ts                 # API client with mock data
│   ├── config.ts                  # Configuration settings
│   └── env.ts                     # Environment configuration
├── types/
│   └── ats.ts                     # TypeScript types
└── app/careers/
    ├── page.tsx                   # Updated careers page
    └── apply/[id]/page.tsx        # Job application page
```

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Test with mock data first before connecting real API

The integration is designed to be robust and will gracefully handle both mock data and real API connections.

