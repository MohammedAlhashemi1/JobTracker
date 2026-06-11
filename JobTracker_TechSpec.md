# Job Application Tracker — Full Technical Spec

## Project Overview
A full-stack web application that lets job seekers log, track, and analyze their job applications. A Chrome extension enables one-click logging directly from LinkedIn, Indeed, and Glassdoor. An AI assistant with full access to the user's application history provides personalized insights and recommendations.

---

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS, Recharts (for charts)
- **Backend:** ASP.NET Core Web API (.NET 8)
- **Database:** SQL Server with Entity Framework Core
- **Auth:** JWT Authentication
- **AI:** Claude API (claude-sonnet-4-20250514)
- **Chrome Extension:** Vanilla JS (Manifest V3)
- **Hosting:** Railway or Render (free tier)

---

## Database Schema

### Users
```
Id (int, PK)
Email (string, unique)
PasswordHash (string)
FullName (string)
ExperienceLevel (string) — Junior / Mid / Senior
TargetRoles (string) — comma separated e.g. "Software Developer, Fullstack Developer"
ResumeUrl (string, nullable)
CreatedAt (datetime)
```

### Applications
```
Id (int, PK)
UserId (int, FK → Users)
JobTitle (string)
Company (string)
Location (string)
JobUrl (string, nullable)
JobDescription (text, nullable)
Status (string) — Applied / Responded / InterviewScheduled / Offer / Rejected / Ghosted
Notes (string, nullable)
AppliedAt (datetime)
UpdatedAt (datetime)
IsAutoGhosted (bool, default false)
```

### ChatMessages
```
Id (int, PK)
UserId (int, FK → Users)
Role (string) — user / assistant
Content (text)
CreatedAt (datetime)
```

---

## API Endpoints

### Auth
```
POST /api/auth/register        — create account
POST /api/auth/login           — returns JWT token
```

### Applications
```
GET    /api/applications               — get all for logged in user
GET    /api/applications/{id}          — get single application
POST   /api/applications               — create new application
PUT    /api/applications/{id}          — update application (status, notes)
DELETE /api/applications/{id}          — delete application
POST   /api/applications/scrape        — accepts a job URL, scrapes and returns job data (does not save yet)
```

### AI
```
POST /api/ai/chat              — send a message, returns AI response with full user context injected automatically
GET  /api/ai/insights          — returns passive dashboard insights based on user data
```

### Profile
```
GET  /api/profile              — get user profile
PUT  /api/profile              — update profile
POST /api/profile/resume       — upload resume (store as file or base64)
```

---

## Frontend Pages & Components

### 1. Auth Pages
- `/register` — name, email, password, experience level
- `/login` — email, password

### 2. Dashboard `/`
- Stats row: Total Applied, Response Rate, Interview Rate, Offers
- Pipeline board: Applied → Responded → Interview → Offer → Rejected → Ghosted (count per column)
- Line chart: Applications logged over time (by week)
- AI Insight Card: 2-3 auto-generated insights pulled from `/api/ai/insights`

### 3. Applications Page `/applications`
- Filterable table: filter by Status, Date Range, Location
- Columns: Company, Job Title, Location, Status, Date Applied, Days Since Applied
- Click any row → opens a side drawer with full job details + description + notes field + status updater
- "Add Manually" button → modal form for manual entry
- Color coded status badges

### 4. AI Chat Page `/chat`
- Chat interface (messages thread)
- Input at bottom
- AI already has full context — no need for user to explain their history
- Suggested starter prompts shown when chat is empty:
  - "Why am I not getting responses?"
  - "What roles should I focus on?"
  - "Am I applying to the right companies?"

### 5. Profile Page `/profile`
- Full name, email, experience level, target roles
- Resume upload
- Account settings

### 6. Navbar
- Logo, Dashboard, Applications, AI Chat, Profile
- Logout button

---

## Auto-Ghost Logic
- Run a background job (or check on dashboard load) for all applications where:
  - Status is still "Applied"
  - AppliedAt is more than 30 days ago
- Automatically set Status to "Ghosted" and IsAutoGhosted to true
- Show these with a grey badge

---

## AI Context Injection
Every call to `/api/ai/chat` must inject the following as a system prompt before the user message:

```
You are a job search assistant. You have full access to this user's job application history.

User Profile:
- Name: {name}
- Experience Level: {experienceLevel}
- Target Roles: {targetRoles}

Application Summary:
- Total Applications: {total}
- Responded: {responded} ({responseRate}%)
- Interviews: {interviews}
- Offers: {offers}
- Rejected: {rejected}
- Ghosted: {ghosted}

Recent Applications (last 10):
{list of recent applications with title, company, status, date}

Full Application History:
{all applications as JSON}

Give specific, honest, personalized advice based on this data. Do not give generic job search tips.
```

---

## AI Insights Endpoint Logic
`GET /api/ai/insights` should call Claude with the user's full data and ask it to return 3 insight strings in JSON format:

Prompt:
```
Based on this user's job application data, return exactly 3 short insight strings (max 20 words each) as a JSON array. Be specific and honest. Examples: "Your response rate on fullstack roles is 3x higher than backend-only roles." or "You haven't applied to anything in 9 days."

Data: {user data as JSON}

Return format: ["insight 1", "insight 2", "insight 3"]
```

---

## Chrome Extension (Manifest V3)

### Files
```
manifest.json
popup.html
popup.js
content.js
background.js
styles.css
```

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Job Tracker",
  "version": "1.0",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://www.linkedin.com/*", "https://ca.indeed.com/*", "https://www.indeed.com/*", "https://www.glassdoor.com/*"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/jobs/*", "https://*.indeed.com/viewjob*", "https://www.glassdoor.com/job-listing/*"],
      "js": ["content.js"]
    }
  ]
}
```

### How it works
1. User opens a job posting on LinkedIn, Indeed, or Glassdoor
2. content.js runs and scrapes: job title, company name, location, job description, current page URL
3. User clicks extension icon → popup.html opens
4. popup.js requests scraped data from content.js via chrome.tabs.sendMessage
5. Popup shows pre-filled card: title, company, location
6. User clicks "Log Application" button
7. popup.js sends POST to `/api/applications` with JWT token stored in chrome.storage
8. Shows success confirmation

### Auth in Extension
- On first use, popup shows a login form
- On successful login, JWT token stored in chrome.storage.local
- All subsequent requests use stored token

---

## Scraping Selectors (content.js)

### LinkedIn
```js
title: document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText
company: document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText
location: document.querySelector('.job-details-jobs-unified-top-card__bullet')?.innerText
description: document.querySelector('.jobs-description__content')?.innerText
```

### Indeed
```js
title: document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.innerText
company: document.querySelector('[data-testid="inlineHeader-companyName"]')?.innerText
location: document.querySelector('[data-testid="job-location"]')?.innerText
description: document.querySelector('#jobDescriptionText')?.innerText
```

### Glassdoor
```js
title: document.querySelector('[data-test="job-title"]')?.innerText
company: document.querySelector('[data-test="employer-name"]')?.innerText
location: document.querySelector('[data-test="location"]')?.innerText
description: document.querySelector('.jobDescriptionContent')?.innerText
```

---

## URL Scrape Fallback (for mobile / paste a link)
`POST /api/applications/scrape` accepts a job URL.
Backend uses HtmlAgilityPack (C# library) to fetch and parse the page server-side.
Returns title, company, location, description as JSON.
User reviews it in the frontend then confirms to save.

---

## Folder Structure

### Backend
```
JobTracker.API/
  Controllers/
    AuthController.cs
    ApplicationsController.cs
    AiController.cs
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
  Services/
    AuthService.cs
    ApplicationService.cs
    AiService.cs
    ScraperService.cs
    GhostDetectionService.cs
  Data/
    AppDbContext.cs
  Program.cs
  appsettings.json
```

### Frontend
```
src/
  pages/
    Dashboard.jsx
    Applications.jsx
    Chat.jsx
    Profile.jsx
    Login.jsx
    Register.jsx
  components/
    Navbar.jsx
    PipelineBoard.jsx
    ApplicationsTable.jsx
    ApplicationDrawer.jsx
    InsightCard.jsx
    ChatWindow.jsx
    StatusBadge.jsx
  services/
    api.js         — axios instance with JWT interceptor
    auth.js
  App.jsx
  main.jsx
```

### Chrome Extension
```
extension/
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

### Backend (appsettings.json)
```
ConnectionStrings:DefaultConnection — SQL Server connection string
Jwt:Secret — JWT signing key
Jwt:ExpiryDays — token expiry
Anthropic:ApiKey — Claude API key
```

### Frontend (.env)
```
VITE_API_URL — backend base URL
```

---

## Build Order (Recommended for Claude Code)

1. Backend — Models, DbContext, EF migrations
2. Backend — Auth (register, login, JWT)
3. Backend — Applications CRUD endpoints
4. Backend — Scraper service (URL scrape + HtmlAgilityPack)
5. Backend — AI service (chat + insights)
6. Backend — Ghost detection logic
7. Frontend — Auth pages (login, register)
8. Frontend — Dashboard page
9. Frontend — Applications page + drawer
10. Frontend — AI Chat page
11. Frontend — Profile page
12. Chrome Extension — content.js scrapers
13. Chrome Extension — popup UI + auth
14. Chrome Extension — log application flow
15. End to end testing + polish
