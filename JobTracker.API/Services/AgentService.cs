using Anthropic;
using Anthropic.Models.Messages;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Models;

namespace JobTracker.API.Services;

public class AgentService
{
    private readonly AppDbContext _db;
    private readonly AnthropicClient _client;
    private readonly IBlobStorageService _blob; // Issue 2

    public AgentService(AppDbContext db, IConfiguration config, IBlobStorageService blob)
    {
        _db    = db;
        _client = new AnthropicClient { ApiKey = config["Anthropic:ApiKey"]! };
        _blob  = blob;
    }

    public async Task<JobMatchResult> AnalyzeMatchAsync(int applicationId, int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        if (string.IsNullOrWhiteSpace(app.JobDescription))
            throw new InvalidOperationException("This application has no job description to analyze.");

        var resumeNote = HasResume(user) ? "\nThe candidate's full resume is attached as a PDF — use it as the primary source of their skills and experience." : "";

        var system = $"""
You are a career coach analyzing how well a candidate matches a job posting.

Candidate Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}{resumeNote}

Analyze the match and return ONLY a valid JSON object with exactly these keys:
- score: integer from 0 to 100
- matchingSkills: array of strings
- missingSkills: array of strings
- emphasis: string (one sentence on what to emphasize in this application)

No extra text, no markdown code blocks. Just the JSON object.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 1024,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Job: {app.JobTitle} at {app.Company}\n\n{app.JobDescription}", user.ResumeUrl) }]
        });

        var raw = ExtractText(response);
        try
        {
            raw = TrimToJson(raw, '{', '}');
            var result = JsonSerializer.Deserialize<JobMatchResult>(raw, CaseInsensitive);
            return result ?? Fallback();
        }
        catch { return Fallback(raw); }

        static JobMatchResult Fallback(string msg = "Could not parse result.") =>
            new() { Score = 0, Emphasis = msg };
    }

    public async Task<ResumeTailorResult> TailorResumeAsync(int applicationId, int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        if (string.IsNullOrWhiteSpace(app.JobDescription))
            throw new InvalidOperationException("This application has no job description to tailor against.");

        var system = $$"""
You are a professional resume optimizer. Parse the candidate's resume, tailor the content to match the job posting, and return ONLY a valid JSON object following the exact schema below. No extra text, no markdown fences.

Candidate Profile:
- Name: {{user.FullName}}
- Experience Level: {{user.ExperienceLevel}}
- Target Roles: {{user.TargetRoles}}

Rules:
- CRITICAL: Output sections in EXACTLY the same order they appear in the candidate's original resume. Do not reorder, merge, or drop sections.
- Keep every job title, company, date, and educational credential exactly as-is
- Do NOT add any named technology, tool, framework, cloud provider, or methodology that is not already explicitly present in the original resume text — not as a parenthetical, not as an implication, not as "familiarity." Reframe or reorder what is actually there; never extend it with inferred adjacent skills (e.g. if the resume lists Docker but not Kubernetes, do NOT add Kubernetes; if it lists Python but not AWS, do NOT add AWS or "cloud familiarity")
- DO rewrite bullet points using keywords and phrasing from the job posting; lead each bullet with the clause most relevant to the job first
- Write bullets with bold, confident language — open with strong action verbs (e.g. "Engineered," "Delivered," "Architected") and frame each accomplishment as proof the candidate can do this job, not just a description of what was done. This is a tone upgrade only: do NOT invent new facts, metrics, or claims — only rephrase existing true content more persuasively
- For bullets covering experience clearly irrelevant to this role, compress to a shorter neutral phrase rather than full technical detail — do not invent new claims
- DO reorder bullets within each entry so the most job-relevant ones appear first
- DO reorder entries (projects, roles, etc.) within each section so the most job-relevant ones appear first
- DO optimize the profile/summary section with matching keywords

Section types:
- "paragraph" — for profile/summary/objective sections (has "content" string)
- "entries"   — for experience/education/projects sections (has "items" array)
- "skills"    — for skills/technologies sections (has "items" array of key/value pairs)

Output this exact JSON schema (preserve the section order from the resume):
{
  "name": "candidate full name",
  "contact": ["contact line 1", "contact line 2"],
  "sections": [
    // one object per section, in the same order as the original resume
    {
      "title": "SECTION TITLE IN CAPS",
      "type": "paragraph | entries | skills",
      "content": "only for paragraph type",
      "items": [ /* only for entries or skills type */ ]
    }
  ]
}

For entries items: { "title": "...", "subtitle": "...", "date": "...", "bullets": ["..."] }
For skills items:  { "key": "Category", "value": "comma-separated values" }

Return ONLY the JSON.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 8192,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Optimize my resume for this role:\n{app.JobTitle} at {app.Company}\n\n{app.JobDescription}", user.ResumeUrl) }]
        });

        var tailored = ExtractText(response);
        app.TailoredResume = tailored;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var tailoredText = ExtractTextFromResumeJson(tailored);
        var origContent = await BuildUserMessageAsync($"Job: {app.JobTitle} at {app.Company}\n\n{app.JobDescription}", user.ResumeUrl);
        MessageParamContent tailoredContent = $"Candidate's resume:\n\n{tailoredText}\n\n---\n\nJob: {app.JobTitle} at {app.Company}\n\n{app.JobDescription}";
        var origScoreTask = ScoreMatchAsync(origContent);
        var tailoredScoreTask = ScoreMatchAsync(tailoredContent);
        await Task.WhenAll(origScoreTask, tailoredScoreTask);

        return new ResumeTailorResult
        {
            TailoredResume = tailored,
            OriginalMatchScore = origScoreTask.Result,
            TailoredMatchScore = tailoredScoreTask.Result
        };
    }

    public async Task<CoverLetterResult> WriteCoverLetterAsync(int applicationId, int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        if (string.IsNullOrWhiteSpace(app.JobDescription))
            throw new InvalidOperationException("This application has no job description to write a cover letter for.");

        var resumeNote = HasResume(user)
            ? "\nThe candidate's full resume is attached as a PDF. Draw specific details from their actual experience when writing the letter."
            : "";

        var today = DateTime.Now.ToString("MMMM d, yyyy");
        var system = $"""
You are a professional cover letter writer. Write compelling, specific cover letters that get interviews.

Candidate Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}{resumeNote}

Formatting rules — follow these exactly:
- Start with the date on its own line: {today}
- Next line: "Dear Hiring Manager,"
- Do NOT include a company address block
- Do NOT use any placeholder text like [Name], [Date], [Address], or [Company]
- End with a professional sign-off and the candidate's full name

Write a complete, ready-to-send cover letter that:
- Opens with a strong hook tied to this specific company and role
- Uses exact keywords from the job description naturally
- Highlights the most relevant experience for this position
- Shows genuine knowledge of what this role requires
- Closes with a clear call to action

Write it as if you are the candidate. Make it sound human, not AI-generated.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Write a cover letter for:\n{app.JobTitle} at {app.Company}\n{app.Location}\n\n{app.JobDescription}", user.ResumeUrl) }]
        });

        var letter = ExtractText(response);
        app.CoverLetter = letter;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return new CoverLetterResult { CoverLetter = letter };
    }

    public async Task<StrategyResult> RunStrategyAsync(int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var applications = await _db.Applications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.AppliedAt)
            .ToListAsync();

        if (applications.Count == 0)
            throw new InvalidOperationException("No applications yet — add some first.");

        var appsJson = JsonSerializer.Serialize(applications.Select(a => new
        {
            a.JobTitle,
            a.Company,
            a.Location,
            Status        = a.Status.ToString(), // Issue 5
            a.IsAutoGhosted,
            AppliedAt     = a.AppliedAt.ToString("yyyy-MM-dd"),
            UpdatedAt     = a.UpdatedAt.ToString("yyyy-MM-dd")
        }));

        var system = $"""
You are a senior career strategist doing a deep, data-driven analysis of a job seeker's search.

Candidate:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}

Application Data:
{appsJson}

Be brutally honest and specific. Use actual numbers and name specific companies and roles from the data. Do NOT give generic job search advice.

Structure your report with these exact sections using markdown bold headers:

**What the data shows**
Key metrics, response rates, timelines — be specific with numbers.

**What's working**
Specific things going well with evidence from the data.

**What's not working**
Specific problems, patterns of failure, with evidence.

**Role & company focus**
Which roles and company types to prioritize and why, based on what's actually getting responses.

**Immediate action items**
3–5 concrete, ordered next steps. Be specific — not "network more" but exactly what to do.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System    = system,
            Messages  = [new() { Role = "user", Content = "Run a full strategy analysis on my job search. Be direct and honest." }]
        });

        return new StrategyResult { Report = ExtractText(response) };
    }

    public async Task<EmailInterpretResult> InterpretEmailAsync(int applicationId, int userId, string emailText)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        var resumeNote = HasResume(user) ? "\nThe candidate's resume is attached as a PDF for additional context." : "";

        var system = $"""
You are an assistant that interprets recruiter emails for job seekers.

Application context:
- Role: {app.JobTitle} at {app.Company}
- Current Status: {app.Status}{resumeNote}

Valid statuses: Applied, Responded, InterviewScheduled, Offer, Rejected, Ghosted

Read the email and determine what it means. Return ONLY a valid JSON object with exactly these keys:
- suggestedStatus: one of the valid statuses listed above
- explanation: string, one sentence on why you chose that status
- summary: string, 1-2 sentences in plain English explaining what this email means to the candidate

No extra text, no markdown code blocks. Just the JSON object.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 512,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Email:\n\n{emailText}", user.ResumeUrl) }]
        });

        var raw = ExtractText(response);
        try
        {
            raw = TrimToJson(raw, '{', '}');
            var result = JsonSerializer.Deserialize<EmailInterpretResult>(raw, CaseInsensitive);
            return result ?? new EmailInterpretResult { Summary = "Could not parse email interpretation." };
        }
        catch { return new EmailInterpretResult { Summary = raw }; }
    }

    public async Task<InterviewPrepResult> PrepareInterviewAsync(int applicationId, int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new InvalidOperationException("User not found.");
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        // Issue 5: compare enum, not string
        if (app.Status != ApplicationStatus.InterviewScheduled)
            throw new InvalidOperationException("Interview prep is only available once an interview is scheduled.");

        if (string.IsNullOrWhiteSpace(app.JobDescription))
            throw new InvalidOperationException("This application has no job description to base interview prep on.");

        var resumeNote = HasResume(user)
            ? "\nThe candidate's full resume is attached as a PDF. Tailor the technical questions to the specific skills and experience shown in their resume."
            : "";

        var system = $"""
You are a professional interview coach preparing a candidate for a job interview.

Candidate Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}{resumeNote}

Generate interview preparation material for the candidate. Structure your response with exactly these three sections using these bold headers:

**TECHNICAL QUESTIONS**
List 5 likely technical interview questions tailored specifically to this role and job description. Number them 1–5.

**BEHAVIORAL QUESTIONS**
List 3 behavioral interview questions (STAR-format answers expected). Number them 1–3.

**QUESTIONS TO ASK THE INTERVIEWER**
List 2 smart, specific questions the candidate should ask the interviewer. Number them 1–2.

Make every question specific to this company and role — not generic.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Prepare me for my interview at {app.Company} for the {app.JobTitle} role.\n\nJob Description:\n{app.JobDescription}", user.ResumeUrl) }]
        });

        var prep = ExtractText(response);
        app.InterviewPrep = prep;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return new InterviewPrepResult { Prep = prep };
    }

    public async Task<FollowUpResult> GenerateFollowUpAsync(int applicationId, int userId)
    {
        var app = await _db.Applications.FirstOrDefaultAsync(a => a.Id == applicationId && a.UserId == userId)
            ?? throw new InvalidOperationException("Application not found.");

        var daysSince  = (int)(DateTime.UtcNow - app.AppliedAt).TotalDays;
        var appliedDate = app.AppliedAt.ToString("MMMM d, yyyy");

        var system = $"""
You are a professional writer helping a job seeker draft a concise follow-up email.

Write a follow-up email for this application:
- Position: {app.JobTitle}
- Company: {app.Company}
- Applied: {appliedDate} ({daysSince} days ago)

The email must:
- Start with a Subject line on its own line (format: "Subject: ...")
- Be followed by a blank line, then the email body
- Be 3–4 short paragraphs
- Restate interest in the role confidently but briefly
- Ask politely for an update on the timeline
- Be under 200 words total
- Sound human, not AI-generated

Return only the subject line and email body. No extra commentary.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 1024,
            System    = system,
            Messages  = [new() { Role = "user", Content = $"Write a follow-up email for my application to {app.Company} for the {app.JobTitle} role." }]
        });

        return new FollowUpResult { Email = ExtractText(response) };
    }

    public async Task<ResumeTailorResult> TailorResumeAnonymousAsync(string jobDescription, string? resumeData)
    {
        // Resolve blob URL once upfront so BuildUserMessageAsync doesn't re-download below
        if (!string.IsNullOrWhiteSpace(resumeData) && _blob.IsBlobUrl(resumeData))
        {
            var (blobBytes, contentType) = await _blob.DownloadResumeAsync(resumeData);
            resumeData = $"data:{contentType};base64,{Convert.ToBase64String(blobBytes)}";
        }

        // Extract original resume text for client-side diff display (DOCX only; PDF not extractable as text)
        var originalResumeText = string.Empty;
        if (!string.IsNullOrWhiteSpace(resumeData) &&
            (resumeData.StartsWith("data:application/vnd.openxmlformats") ||
             resumeData.StartsWith("data:application/msword")))
        {
            originalResumeText = ExtractDocxText(resumeData);
        }

        var system = """
You are a professional resume optimizer. Parse the candidate's resume, tailor the content to match the job posting, and return ONLY a valid JSON object following the exact schema below. No extra text, no markdown fences.

Rules:
- CRITICAL: Output sections in EXACTLY the same order they appear in the candidate's original resume. Do not reorder, merge, or drop sections.
- Keep every job, company, date, and educational credential exactly as-is
- Do NOT add any named technology, tool, framework, cloud provider, or methodology that is not already explicitly present in the original resume text — not as a parenthetical, not as an implication, not as "familiarity." Reframe or reorder what is actually there; never extend it with inferred adjacent skills (e.g. if the resume lists Docker but not Kubernetes, do NOT add Kubernetes; if it lists Python but not AWS, do NOT add AWS or "cloud familiarity")
- DO rewrite bullet points using keywords from the job posting; lead each bullet with the clause most relevant to the job first
- Write bullets with bold, confident language — open with strong action verbs (e.g. "Engineered," "Delivered," "Architected") and frame each accomplishment as proof the candidate can do this job, not just a description of what was done. This is a tone upgrade only: do NOT invent new facts, metrics, or claims — only rephrase existing true content more persuasively
- For bullets covering experience clearly irrelevant to this role, compress to a shorter neutral phrase rather than full technical detail — do not fabricate new claims
- DO reorder bullets within each entry so the most job-relevant ones appear first
- DO reorder entries (projects, roles, etc.) within each section so the most job-relevant ones appear first
- DO optimize the profile/summary section with matching job keywords

Section types:
- "paragraph" — for profile/summary/objective sections (has "content" string)
- "entries"   — for experience/education/projects sections (has "items" array)
- "skills"    — for skills/technologies sections (has "items" array of key/value pairs)

Output this exact JSON schema (preserve the section order from the resume):
{
  "name": "candidate full name",
  "contact": ["contact line 1", "contact line 2"],
  "sections": [
    // one object per section, in the same order as the original resume
    {
      "title": "SECTION TITLE IN CAPS",
      "type": "paragraph | entries | skills",
      "content": "only for paragraph type",
      "items": [ /* only for entries or skills type */ ]
    }
  ]
}

For entries items: { "title": "...", "subtitle": "...", "date": "...", "bullets": ["..."] }
For skills items:  { "key": "Category", "value": "comma-separated values" }

Return ONLY the JSON.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 8192,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Optimize my resume for this job posting:\n\n{jobDescription}", resumeData) }]
        });

        var tailored = ExtractText(response);
        var tailoredText = ExtractTextFromResumeJson(tailored);
        var origContent = await BuildUserMessageAsync($"Job posting:\n\n{jobDescription}", resumeData);
        MessageParamContent tailoredContent = $"Candidate's resume:\n\n{tailoredText}\n\n---\n\nJob posting:\n\n{jobDescription}";
        var origScoreTask = ScoreMatchAsync(origContent);
        var tailoredScoreTask = ScoreMatchAsync(tailoredContent);
        await Task.WhenAll(origScoreTask, tailoredScoreTask);

        return new ResumeTailorResult
        {
            TailoredResume = tailored,
            OriginalMatchScore = origScoreTask.Result,
            TailoredMatchScore = tailoredScoreTask.Result,
            OriginalResumeText = string.IsNullOrWhiteSpace(originalResumeText) ? null : originalResumeText
        };
    }

    public async Task<CoverLetterResult> WriteCoverLetterAnonymousAsync(string jobDescription, string? resumeData)
    {
        var hasResume = !string.IsNullOrWhiteSpace(resumeData);
        var resumeNote = hasResume
            ? "\nThe candidate's full resume is attached as a PDF. Draw specific details from their actual experience when writing the letter."
            : "";

        var today = DateTime.Now.ToString("MMMM d, yyyy");
        var system = $"""
You are a professional cover letter writer. Write compelling, specific cover letters that get interviews.{resumeNote}

Formatting rules — follow these exactly:
- Start with the date on its own line: {today}
- Next line: "Dear Hiring Manager,"
- Do NOT include a company address block
- Do NOT use any placeholder text like [Name], [Date], [Address], or [Company]
- End with a professional sign-off and the candidate's full name

Write a complete, ready-to-send cover letter that:
- Opens with a strong hook tied to this specific company and role
- Uses exact keywords from the job description naturally
- Highlights the most relevant experience for this position
- Shows genuine knowledge of what this role requires
- Closes with a clear call to action

Write it as if you are the candidate. Make it sound human, not AI-generated.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System    = system,
            Messages  = [new() { Role = "user", Content = await BuildUserMessageAsync($"Write a cover letter for this job:\n\n{jobDescription}", resumeData) }]
        });

        return new CoverLetterResult { CoverLetter = ExtractText(response) };
    }

    public async Task<TailorPreserveResult> TailorResumePreserveAsync(string jobDescription, string? resumeData)
    {
        if (string.IsNullOrWhiteSpace(resumeData)) return new TailorPreserveResult();

        // Issue 2: if the caller passed a blob URL, download it first and convert to a data URL
        // so the rest of this method's existing logic can work unchanged.
        if (_blob.IsBlobUrl(resumeData))
        {
            var (blobBytes, contentType) = await _blob.DownloadResumeAsync(resumeData);
            resumeData = $"data:{contentType};base64,{Convert.ToBase64String(blobBytes)}";
        }

        var commaIdx = resumeData.IndexOf(',');
        if (commaIdx < 0) return new TailorPreserveResult();
        var originalBytes = Convert.FromBase64String(resumeData[(commaIdx + 1)..]);

        var mimeOk  = resumeData.StartsWith("data:application/vnd.openxmlformats") ||
                      resumeData.StartsWith("data:application/msword");
        var magicOk = originalBytes.Length >= 4 &&
                      originalBytes[0] == 0x50 && originalBytes[1] == 0x4B &&
                      originalBytes[2] == 0x03 && originalBytes[3] == 0x04;

        if (!mimeOk && !magicOk) return new TailorPreserveResult();

        var paragraphs = ExtractDocxParagraphList(originalBytes);

        var editableIndices = new HashSet<int>();
        var editableLines   = new List<string>();
        for (int i = 0; i < paragraphs.Count; i++)
        {
            if (!IsEditableParagraph(paragraphs[i], i)) continue;
            editableIndices.Add(i);
            editableLines.Add($"{i}: {paragraphs[i]}");
        }

        var numberedList = string.Join("\n", editableLines);

        var system = """
You are a professional resume optimizer. You receive a numbered list of paragraphs from a candidate's resume — these are the ONLY ones you may change. Tailor them to match the job posting.

What to do:
- Long profile/summary text: rewrite using keywords from the job posting while keeping the candidate's real background
- Skill lines ("Category: values"): reorder existing values and substitute job-relevant synonyms for skills already listed — do NOT add any tool, technology, cloud provider (e.g. AWS, Azure), or methodology (e.g. CI/CD, Agile) that is not already explicitly written in the paragraph text; trim or reorder, never expand
- Bullet points (start with action verbs): rewrite leading with the clause most relevant to the job first; use bold, confident action verbs (e.g. "Engineered," "Delivered," "Architected") and frame accomplishments as proof the candidate can do this job — tone upgrade only, do NOT invent new facts, metrics, or claims; for bullets about experience clearly irrelevant to this role, compress to a shorter neutral phrase rather than full technical detail

Rules:
- NEVER add any named technology, tool, framework, cloud provider, or methodology that is not already explicitly present in the original resume text — not as a parenthetical, not as an implication, not as "familiarity." This is absolute: if a skill is not in the resume, it may not appear in the output under any framing
- NEVER reorder, insert, or delete paragraphs — only replace the text of paragraphs already in the list
- Return ONLY a valid JSON array. Start your response with [ and end with ]. No explanation, no markdown fences, nothing outside the array.
- Only include entries for paragraphs you actually changed

Format: [{"i": <index>, "t": "<full rewritten text>"}, ...]
""";

        var userMsg = $"Job Posting:\n{jobDescription}\n\nResume paragraphs:\n{numberedList}";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 8192,
            System    = system,
            Messages  = [new() { Role = "user", Content = userMsg }]
        });

        var raw = ExtractText(response).Trim();
        var changes = ParseParagraphChanges(raw);
        var resultBytes = ApplyDocxChanges(originalBytes, changes, editableIndices);

        var originalText = string.Join("\n", ExtractDocxParagraphList(originalBytes).Where(s => !string.IsNullOrWhiteSpace(s)));
        var tailoredDocxText = string.Join("\n", ExtractDocxParagraphList(resultBytes).Where(s => !string.IsNullOrWhiteSpace(s)));
        var origScoreTask2 = ScoreMatchAsync($"Candidate's resume:\n\n{originalText}\n\n---\n\nJob posting:\n\n{jobDescription}");
        var tailoredScoreTask2 = ScoreMatchAsync($"Candidate's resume:\n\n{tailoredDocxText}\n\n---\n\nJob posting:\n\n{jobDescription}");
        await Task.WhenAll(origScoreTask2, tailoredScoreTask2);

        return new TailorPreserveResult
        {
            Docx = resultBytes,
            OriginalMatchScore = origScoreTask2.Result,
            TailoredMatchScore = tailoredScoreTask2.Result,
            TailoredDocxText = tailoredDocxText
        };
    }

    // ── private helpers ────────────────────────────────────────────────────────

    // Issue 2: resolves a resume reference (data URL OR blob https URL) into the
    // Claude message content that includes the file.  Blob URLs are downloaded
    // transparently so callers don't need to know how the file is stored.
    private async Task<MessageParamContent> BuildUserMessageAsync(string text, string? resumeUrl)
    {
        if (string.IsNullOrWhiteSpace(resumeUrl))
            return text;

        // Blob URL → download bytes and rewrite as a data URL so the code below works unchanged.
        if (_blob.IsBlobUrl(resumeUrl))
        {
            var (bytes, contentType) = await _blob.DownloadResumeAsync(resumeUrl);
            resumeUrl = $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
        }

        // PDF: send as document block (Claude can read it natively).
        if (resumeUrl.StartsWith("data:application/pdf;base64,"))
        {
            var base64 = resumeUrl["data:application/pdf;base64,".Length..];
            ContentBlockParam docBlock = new DocumentBlockParam
            {
                Source = new DocumentBlockParamSource(new Base64PdfSource { Data = base64 })
            };
            ContentBlockParam textBlock = new TextBlockParam { Text = text };
            return new List<ContentBlockParam> { docBlock, textBlock };
        }

        // DOCX: extract plain text and inject into the prompt.
        if (resumeUrl.StartsWith("data:application/vnd.openxmlformats") ||
            resumeUrl.StartsWith("data:application/msword"))
        {
            var resumeText = ExtractDocxText(resumeUrl);
            if (!string.IsNullOrWhiteSpace(resumeText))
            {
                var combined = $"Candidate's resume:\n\n{resumeText}\n\n---\n\n{text}";
                return combined;
            }
        }

        return text;
    }

    // Any non-empty ResumeUrl means a resume has been stored (blob URL or legacy data URL).
    private static bool HasResume(User user) =>
        !string.IsNullOrWhiteSpace(user.ResumeUrl);

    private static List<string> ExtractDocxParagraphList(byte[] docxBytes)
    {
        try
        {
            using var stream = new MemoryStream(docxBytes);
            using var doc    = WordprocessingDocument.Open(stream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null) return [];
            return body.Descendants<Paragraph>()
                       .Select(p => p.InnerText)
                       .ToList();
        }
        catch { return []; }
    }

    private static bool IsEditableParagraph(string text, int index)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var t = text.Trim();

        // Skip short all-caps lines — these are section headings (SUMMARY, SKILLS, EXPERIENCE…)
        if (t.Length < 40 && t.ToUpperInvariant() == t &&
            t.All(c => char.IsLetter(c) || char.IsWhiteSpace(c) || c == '/' || c == '&'))
            return false;

        // Skip contact / header lines that use pipe separators
        if (t.Contains(" | ") || t.Contains(" · ")) return false;

        // Skill lines: "Category: value value value"
        if (System.Text.RegularExpressions.Regex.IsMatch(t, @"^[\w\s&/]+:\s+\S"))
            return true;

        // Summary / description paragraphs — long prose
        if (t.Length > 80) return true;

        // Bullet points starting with an action verb
        string[] verbs = ["Built", "Developed", "Designed", "Integrated", "Implemented",
                          "Created", "Led", "Managed", "Delivered", "Maintained",
                          "Strengthened", "Participated", "Utilized", "Collaborated",
                          "Contributed", "Established", "Produced", "Wrote", "Configured",
                          "Architected", "Deployed", "Migrated", "Optimized", "Automated",
                          "Reduced", "Increased", "Improved", "Launched", "Spearheaded"];
        if (t.Length > 40 && verbs.Any(v => t.StartsWith(v, StringComparison.OrdinalIgnoreCase)))
            return true;

        return false;
    }

    private record ParagraphChange(int Index, string Text);

    private static List<ParagraphChange> ParseParagraphChanges(string raw)
    {
        try
        {
            var start = raw.IndexOf('[');
            var end   = raw.LastIndexOf(']');
            if (start < 0 || end <= start) return [];
            var json = raw[start..(end + 1)];
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.EnumerateArray()
                .Where(el => el.TryGetProperty("i", out _) && el.TryGetProperty("t", out _))
                .Select(el => new ParagraphChange(
                    el.GetProperty("i").GetInt32(),
                    el.GetProperty("t").GetString() ?? ""))
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .ToList();
        }
        catch { return []; }
    }

    private static byte[] ApplyDocxChanges(byte[] original, List<ParagraphChange> changes, HashSet<int> editableIndices)
    {
        if (changes.Count == 0) return original;
        try
        {
            var stream = new MemoryStream();
            stream.Write(original, 0, original.Length);
            stream.Position = 0;

            using (var doc = WordprocessingDocument.Open(stream, true))
            {
                var body = doc.MainDocumentPart?.Document?.Body;
                if (body is null) return original;

                var paras = body.Descendants<Paragraph>().ToList();
                foreach (var change in changes)
                {
                    if (change.Index < 0 || change.Index >= paras.Count) continue;
                    if (!editableIndices.Contains(change.Index)) continue;
                    ReplaceParagraphText(paras[change.Index], change.Text);
                }
                doc.MainDocumentPart!.Document.Save();
            } // ZIP central directory finalized here

            return stream.ToArray();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TailorPreserve] ApplyDocxChanges EXCEPTION: {ex.GetType().Name}: {ex.Message}");
            return original;
        }
    }

    private static void ReplaceParagraphText(Paragraph para, string newText)
    {
        var firstRun = para.Elements<Run>().FirstOrDefault();
        var rPr = firstRun?.GetFirstChild<RunProperties>()?.CloneNode(true) as RunProperties;

        foreach (var run in para.Elements<Run>().ToList()) run.Remove();

        var newRun = new Run();
        if (rPr is not null) newRun.AppendChild(rPr);
        newRun.AppendChild(new Text(newText) { Space = SpaceProcessingModeValues.Preserve });
        para.AppendChild(newRun);
    }

    private static string ExtractDocxText(string dataUrl)
    {
        try
        {
            var commaIdx = dataUrl.IndexOf(',');
            if (commaIdx < 0) return string.Empty;
            var base64 = dataUrl[(commaIdx + 1)..];
            var bytes  = Convert.FromBase64String(base64);
            using var stream = new MemoryStream(bytes);
            using var doc    = WordprocessingDocument.Open(stream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null) return string.Empty;
            var sb = new StringBuilder();
            foreach (var para in body.Descendants<Paragraph>())
                sb.AppendLine(para.InnerText);
            return sb.ToString().Trim();
        }
        catch { return string.Empty; }
    }

    private static string ExtractText(Message response)
    {
        foreach (var block in response.Content)
            if (block.TryPickText(out var t)) return t.Text;
        return string.Empty;
    }

    private static string TrimToJson(string raw, char open, char close)
    {
        var start = raw.IndexOf(open);
        var end   = raw.LastIndexOf(close);
        return start >= 0 && end > start ? raw[start..(end + 1)] : raw;
    }

    private static readonly JsonSerializerOptions CaseInsensitive =
        new() { PropertyNameCaseInsensitive = true };

    private async Task<int?> ScoreMatchAsync(MessageParamContent content)
    {
        try
        {
            var response = await _client.Messages.Create(new MessageCreateParams
            {
                Model     = Model.ClaudeSonnet4_6,
                MaxTokens = 256,
                System    = """
You are a career coach scoring how well a candidate's resume matches a job posting.
Return ONLY a valid JSON object: {"score": <integer 0-100>, "matchingSkills": [], "missingSkills": [], "emphasis": ""}
No markdown fences, no extra text. Just the JSON object.
""",
                Messages = [new() { Role = "user", Content = content }]
            });
            var extracted = ExtractText(response);
            var raw = TrimToJson(extracted, '{', '}');
            Console.WriteLine($"[ScoreMatch] raw ({raw.Length} chars): {raw[..Math.Min(200, raw.Length)]}");
            using var doc = JsonDocument.Parse(raw);
            var score = doc.RootElement.GetProperty("score").GetInt32();
            return score;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ScoreMatch] FAILED — {ex.GetType().Name}: {ex.Message[..Math.Min(300, ex.Message.Length)]}");
            if (ex.InnerException != null)
                Console.WriteLine($"[ScoreMatch] Inner: {ex.InnerException.GetType().Name}: {ex.InnerException.Message[..Math.Min(200, ex.InnerException.Message.Length)]}");
            return null;
        }
    }

    private static string ExtractTextFromResumeJson(string json)
    {
        try
        {
            json = TrimToJson(json, '{', '}');
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var sb = new StringBuilder();

            if (root.TryGetProperty("name", out var name)) sb.AppendLine(name.GetString());
            if (root.TryGetProperty("contact", out var contact))
                foreach (var c in contact.EnumerateArray()) sb.AppendLine(c.GetString());

            if (root.TryGetProperty("sections", out var sections))
                foreach (var section in sections.EnumerateArray())
                {
                    if (section.TryGetProperty("title", out var title)) sb.AppendLine(title.GetString());
                    if (section.TryGetProperty("content", out var content)) sb.AppendLine(content.GetString());
                    if (section.TryGetProperty("items", out var items))
                        foreach (var item in items.EnumerateArray())
                        {
                            if (item.TryGetProperty("title", out var iTitle)) sb.AppendLine(iTitle.GetString());
                            if (item.TryGetProperty("subtitle", out var sub)) sb.AppendLine(sub.GetString());
                            if (item.TryGetProperty("key", out var key)) sb.Append(key.GetString() + ": ");
                            if (item.TryGetProperty("value", out var val)) sb.AppendLine(val.GetString());
                            if (item.TryGetProperty("bullets", out var bullets))
                                foreach (var b in bullets.EnumerateArray()) sb.AppendLine(b.GetString());
                        }
                }

            return sb.ToString().Trim();
        }
        catch { return json; }
    }
}
