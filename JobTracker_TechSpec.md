# Job Application Tracker — Full Technical Spec

## Project Overview
A full-stack web application that lets job seekers log, track, and analyze their job applications. A Chrome extension enables one-click logging directly from LinkedIn, Indeed, and Glassdoor. An AI assistant with full access to the user's application history provides personalized insights and recommendations. A suite of purpose-built AI agents automate document generation, interview preparation, job match analysis, and email follow-up drafting.

---

## Tech Stack
- **Frontend:** React 19 + TypeScript (Vite), Tailwind CSS, Recharts (charts), `docx` (Word file generation)
- **Backend:** ASP.NET Core Web API (.NET 8)
- **Database:** SQL Server with Entity Framework Core (code-first migrations)
- **Auth:** JWT Authentication (HS256, no issuer/audience validation)
- **AI:** Anthropic SDK v12.29.0 for .NET — `AnthropicClient`, `Model.ClaudeSonnet4_6`
- **Chrome Extension:** Vanilla JS (Manifest V3)
- **Hosting:** Railway or Render (free tier)

---

## Database Schema

### Users
```
Id (int, PK)
Email (string, unique, max 256)
PasswordHash (string)
FullName (string, max 256)
ExperienceLevel (string, max 50) — Junior / Mid / Senior
TargetRoles (string, max 1024) — e.g. "Software Developer, Fullstack Developer"
ResumeUrl (string, nullable)
CreatedAt (datetime)
```

### Applications
```
Id (int, PK)
UserId (int, FK → Users, cascade delete)
JobTitle (string, max 512)
Company (string, max 512)
Location (string, max 512)
JobUrl (string, nullable)
JobDescription (nvarchar(max), nullable)
Status (string, max 50) — Applied / Responded / InterviewScheduled / Offer / Rejected / Ghosted
Notes (string, max 4000, nullable)
CoverLetter (nvarchar(max), nullable) — saved output from Cover Letter agent
TailoredResume (nvarchar(max), nullable) — saved output from Resume Tailor agent
InterviewPrep (nvarchar(max), nullable) — saved output from Interview Prep agent
AppliedAt (datetime)
UpdatedAt (datetime)
IsAutoGhosted (bool, default false)
```

### ChatMessages
```
Id (int, PK)
UserId (int, FK → Users, cascade delete)
Role (string, max 20) — user / assistant
Content (nvarchar(max))
CreatedAt (datetime)
```

### EF Migrations (applied in order)
1. `InitialCreate` — Users, Applications (base fields), ChatMessages
2. `AddCoverLetterAndTailoredResume` — adds CoverLetter, TailoredResume columns
3. `AddInterviewPrep` — adds InterviewPrep column

---

## API Endpoints

### Auth
```
POST /api/auth/register        — create account
POST /api/auth/login           — returns JWT token
```

### Applications
```
GET    /api/applications               — get all for logged-in user
GET    /api/applications/{id}          — get single application
POST   /api/applications               — create new application
PUT    /api/applications/{id}          — update application (status, notes, etc.)
DELETE /api/applications/{id}          — delete application
POST   /api/applications/scrape        — accepts a job URL, scrapes and returns job data (does not save)
```

### AI Chat & Insights
```
POST /api/ai/chat              — send a message; returns AI response with full user context injected
GET  /api/ai/insights          — returns 3 passive dashboard insights based on user data
```

### AI Agents (all require JWT, all POST)
```
POST /api/agents/match/{applicationId}            — Job Match Analyzer
POST /api/agents/resume-tailor/{applicationId}    — Resume Tailor (saves to Application.TailoredResume)
POST /api/agents/cover-letter/{applicationId}     — Cover Letter Writer (saves to Application.CoverLetter)
POST /api/agents/strategy                         — Job Search Strategist (full history analysis)
POST /api/agents/email-interpret/{applicationId}  — Email Interpreter (body: { emailText })
POST /api/agents/interview-prep/{applicationId}   — Interview Prep Generator (saves to Application.InterviewPrep)
POST /api/agents/follow-up/{applicationId}        — Follow-up Email Drafter (not saved, returned for copy)
```

### Profile
```
GET  /api/profile              — get user profile
PUT  /api/profile              — update profile
POST /api/profile/resume       — upload resume (stored as base64 in ResumeUrl)
```

---

## AI Agent Descriptions

All agents use `Model.ClaudeSonnet4_6`, `MaxTokens = 4096` (except Match: 1024, EmailInterpret: 512, FollowUp: 1024). Each agent injects user profile (name, experience level, target roles) as a system prompt alongside the relevant application data.

### 1. Job Match Analyzer (`match/{id}`)
Analyzes how well the candidate matches the job description. Requires `JobDescription` on the application. Returns JSON:
```json
{ "score": 85, "matchingSkills": ["React", "TypeScript"], "missingSkills": ["AWS"], "emphasis": "..." }
```
Result displayed in the drawer with a color-coded score bar (green ≥70, amber ≥40, red <40) and skill chips.

### 2. Resume Tailor (`resume-tailor/{id}`)
Rewrites resume bullet points tailored to the job description. Requires `JobDescription`. Saves output to `Application.TailoredResume` in the database. Returns `{ tailoredBullets: string }`. Download as `.docx` available in the drawer.

### 3. Cover Letter Writer (`cover-letter/{id}`)
Writes a complete, ready-to-send cover letter tied to the specific job and company. Requires `JobDescription`. Saves output to `Application.CoverLetter` in the database. Returns `{ coverLetter: string }`. Download as `.docx` available in the drawer.

### 4. Job Search Strategist (`strategy`)
Runs a deep analysis of the user's entire application history. Returns a markdown-structured report with sections: What the data shows / What's working / What's not working / Role & company focus / Immediate action items. Displayed in the Dashboard with a Copy button.

### 5. Email Interpreter (`email-interpret/{id}`)
Reads a pasted recruiter email and determines what it means. Returns JSON:
```json
{ "suggestedStatus": "InterviewScheduled", "explanation": "...", "summary": "..." }
```
Shows the suggested status with an "Apply status update" button — does not auto-apply.

### 6. Interview Prep Generator (`interview-prep/{id}`)
Available only when `application.status === 'InterviewScheduled'`. Requires `JobDescription`. Generates:
- 5 likely technical interview questions tailored to the role
- 3 behavioral questions (STAR-format)
- 2 smart questions for the candidate to ask the interviewer

Saves output to `Application.InterviewPrep`. Displayed in the drawer in a scrollable collapsible panel with Copy button. Persists — reopening the drawer shows the saved prep immediately.

### 7. Follow-up Email Drafter (`follow-up/{id}`)
Drafts a short professional follow-up email for applications where no response has been received. Output includes a Subject line and 3–4 paragraph body. **Not saved to the database** — generated on demand and copied by the user. Triggered from the Dashboard Follow-up Reminders section.

---

## Frontend Pages & Components

### 1. Auth Pages
- `/register` — name, email, password, experience level
- `/login` — email, password

### 2. Dashboard `/`
- Stats row: Total Applied, Response Rate, Interview Rate, Offers
- Pipeline board: Applied → Responded → Interview → Offer → Rejected → Ghosted (count per column, up to 5 cards per column)
- **Follow-up Reminders card** — filters applications where `status === 'Applied'` and `daysSinceApplied > 7`; shows company, job title, days elapsed, and a "Draft Follow-up" button per row; hidden if no qualifying applications
- Line chart: Applications logged over time (by week)
- AI Insights card: 3 auto-generated insights from `/api/ai/insights`
- **Strategy Analysis card** — "Run Strategy Analysis" button with credit warning → loading → renders full markdown report with Copy button

### 3. Applications Page `/applications`
- Filterable table: Status, Location text search, Date range (from/to)
- Columns: Company, Job Title, Location, Status, Applied, Days
- Click any row → side drawer with full job details

#### Application Drawer
- Header: Job title, company, location
- Meta: Applied date, days since applied, Job URL link
- Status selector: button group for all 6 statuses
- Job description: collapsible read-only panel (shown when present)
- Notes: textarea with explicit Save button
- **Interview Prep section** (shown only when `status === 'InterviewScheduled'`): "Prepare for Interview" button with credit warning; result saved to DB and shown immediately on next open with View/Collapse/Copy/Regenerate controls
- **AI Agents section**: credit warning badge, saved-document rows for Cover Letter and Tailored Resume (each with "Download .docx" and "Regenerate"), agent buttons (Analyze Match, Tailor Resume, Cover Letter, Interpret Email), email textarea for the email interpreter
- Delete button (with confirmation)

#### Add Manually Modal
Fields: Job Title (required), Company (required), Location, Job URL, Date Applied, **Job Description** (textarea — required for agents to work), Notes.

### 4. AI Chat Page `/chat`
- Chat interface (messages thread) with suggested starter prompts when empty
- Full application history injected as AI context automatically

### 5. Profile Page `/profile`
- Full name, email, experience level, target roles
- Resume upload (stored as base64)

### 6. Navbar
- Logo, Dashboard, Applications, AI Chat, Profile, Logout

---

## Document Downloads (`.docx`)
The `docx` npm package is used client-side. `src/lib/downloadDocx.ts` converts a plain-text string (split on newlines into paragraphs) into a Word document and triggers a browser download. Used for Cover Letter and Tailored Resume.

---

## Auto-Ghost Logic
Background service (`GhostDetectionService`) runs periodically. For all applications where `status === 'Applied'` and `AppliedAt` is more than 30 days ago, automatically sets `status = 'Ghosted'` and `isAutoGhosted = true`. Shown with a grey badge.

---

## AI Context Injection (Chat & Insights)
Every call to `/api/ai/chat` injects a system prompt with the user's full profile and application history (all fields). The insights endpoint calls Claude with user data and requests exactly 3 short insight strings as a JSON array.

---

## Chrome Extension (Manifest V3)

### Supported Sites
LinkedIn (`/jobs/*`), Indeed (`/viewjob*`), Glassdoor (`/job-listing/*`)

### Flow
1. `content.js` scrapes job title, company, location, description, and URL from the active tab
2. Popup opens → pre-fills scraped data → user reviews
3. "Log Application" sends `POST /api/applications` with JWT from `chrome.storage.local`
4. Job description is included in the saved application so agents can run immediately after logging

### Auth in Extension
Login form shown on first use. JWT stored in `chrome.storage.local` and attached to all API requests.

---

## Folder Structure

### Backend
```
JobTracker.API/
  Controllers/
    AuthController.cs
    ApplicationsController.cs
    AiController.cs
    AgentsController.cs
    ProfileController.cs
  Models/
    User.cs
    Application.cs
    ChatMessage.cs
  DTOs/
    LoginDto.cs
    RegisterDto.cs
    ApplicationDto.cs
    ChatMessageDto.cs
    AgentDtos.cs         — JobMatchResult, ResumeTailorResult, CoverLetterResult,
                           StrategyResult, EmailInterpretResult, EmailInterpretRequest,
                           InterviewPrepResult, FollowUpResult
    ProfileDto.cs
    ScrapeDto.cs
    AuthResponseDto.cs
  Services/
    AuthService.cs
    ApplicationService.cs
    AiService.cs
    AgentService.cs      — all 7 agent methods
    ScraperService.cs
    GhostDetectionService.cs
  Data/
    AppDbContext.cs
    Migrations/
  Program.cs
  appsettings.json
```

### Frontend
```
src/
  pages/
    Dashboard.tsx        — stats, pipeline, follow-up reminders, strategy analysis, chart
    Applications.tsx     — table, drawer (agents + interview prep), add modal
    Chat.tsx
    Profile.tsx
    Login.tsx
    Register.tsx
  components/
    Navbar.tsx
    Layout.tsx
    StatusBadge.tsx
    AgentResultPanel.tsx — match / text / email result display
  lib/
    api.ts               — axios instance with JWT interceptor
    downloadDocx.ts      — docx package wrapper for .docx downloads
  context/
    AuthContext.tsx
  types.ts               — Application, all agent result interfaces
  App.tsx
  main.tsx
```

### Chrome Extension
```
JobTracker.Extension/
  manifest.json
  popup.html
  popup.js
  content.js
  background.js
  styles.css
  icons/
```

---

## Environment Variables

### Backend (appsettings.json / secrets)
```
ConnectionStrings:DefaultConnection — SQL Server connection string
Jwt:Secret                          — JWT signing key
Jwt:ExpiryDays                      — token lifetime in days
Anthropic:ApiKey                    — Claude API key (keep out of source control)
```

### Frontend (.env)
```
VITE_API_URL — backend base URL (e.g. http://localhost:5000/api)
```
