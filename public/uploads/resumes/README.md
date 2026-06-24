# Resume uploads

- **Live uploads:** When candidates apply via the careers form, resumes are saved here (e.g. `1234567890-abc123.pdf`).
- **Seed preview:** To show a resume preview for seed candidates, place **one** PDF file here and name it:
  - **`sample-resume.pdf`**

Then run:

```bash
npm run db:update-resume-paths
```

That updates all candidates and applications in the database to use `/uploads/resumes/sample-resume.pdf`, so the sidebar preview works for every seed application.

You can use any PDF as `sample-resume.pdf` (e.g. a real CV, or a dummy one-page PDF).
