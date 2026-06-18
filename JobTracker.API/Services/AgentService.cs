using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Models;

namespace JobTracker.API.Services;

public class AgentService
{
    private readonly AppDbContext _db;
    private readonly AnthropicClient _client;

    public AgentService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _client = new AnthropicClient { ApiKey = config["Anthropic:ApiKey"]! };
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
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 1024,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Job: {app.JobTitle} at {app.Company}\n\n{app.JobDescription}", user.ResumeUrl) }]
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

        var resumeNote = HasResume(user)
            ? "\nThe candidate's full resume is attached as a PDF. Rewrite bullet points based on the actual experience shown in the resume, tailored to the job."
            : "";

        var system = $"""
You are a professional resume writer specializing in tailoring resumes to specific job postings.

Candidate Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}{resumeNote}

Rewrite resume bullet points specifically tailored to the job posting. For each bullet:
- Match keywords from the job description exactly
- Quantify achievements where possible
- Lead with strong action verbs
- Highlight what this specific employer cares about

Return only the tailored bullet points as formatted text the candidate can copy directly into their resume.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Tailor my resume for:\n{app.JobTitle} at {app.Company}\n{app.Location}\n\n{app.JobDescription}", user.ResumeUrl) }]
        });

        var tailored = ExtractText(response);
        app.TailoredResume = tailored;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return new ResumeTailorResult { TailoredBullets = tailored };
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

        var system = $"""
You are a professional cover letter writer. Write compelling, specific cover letters that get interviews.

Candidate Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}{resumeNote}

Write a complete, ready-to-send cover letter that:
- Opens with a strong hook tied to this specific company and role
- Uses exact keywords from the job description naturally
- Highlights the most relevant experience for this position
- Shows genuine knowledge of what this role requires
- Closes with a clear call to action
- Includes standard formatting (date placeholder, company address placeholder, signature line)

Write it as if you are the candidate. Make it sound human, not AI-generated.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Write a cover letter for:\n{app.JobTitle} at {app.Company}\n{app.Location}\n\n{app.JobDescription}", user.ResumeUrl) }]
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
            a.Status,
            a.IsAutoGhosted,
            AppliedAt = a.AppliedAt.ToString("yyyy-MM-dd"),
            UpdatedAt = a.UpdatedAt.ToString("yyyy-MM-dd")
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
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = "Run a full strategy analysis on my job search. Be direct and honest." }]
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
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 512,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Email:\n\n{emailText}", user.ResumeUrl) }]
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

        if (app.Status != "InterviewScheduled")
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
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Prepare me for my interview at {app.Company} for the {app.JobTitle} role.\n\nJob Description:\n{app.JobDescription}", user.ResumeUrl) }]
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

        var daysSince = (int)(DateTime.UtcNow - app.AppliedAt).TotalDays;
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
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 1024,
            System = system,
            Messages = [new() { Role = "user", Content = $"Write a follow-up email for my application to {app.Company} for the {app.JobTitle} role." }]
        });

        return new FollowUpResult { Email = ExtractText(response) };
    }

    public async Task<ResumeTailorResult> TailorResumeAnonymousAsync(string jobDescription, string? resumeBase64)
    {
        var resumeNote = !string.IsNullOrWhiteSpace(resumeBase64) && resumeBase64.StartsWith("data:application/pdf;base64,")
            ? "\nThe candidate's full resume is attached as a PDF. Rewrite bullet points based on the actual experience shown in the resume, tailored to the job."
            : "";

        var system = $"""
You are a professional resume writer specializing in tailoring resumes to specific job postings.{resumeNote}

Rewrite resume bullet points specifically tailored to the job posting. For each bullet:
- Match keywords from the job description exactly
- Quantify achievements where possible
- Lead with strong action verbs
- Highlight what this specific employer cares about

Return only the tailored bullet points as formatted text the candidate can copy directly into their resume.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Tailor my resume for this job:\n\n{jobDescription}", resumeBase64) }]
        });

        return new ResumeTailorResult { TailoredBullets = ExtractText(response) };
    }

    public async Task<CoverLetterResult> WriteCoverLetterAnonymousAsync(string jobDescription, string? resumeBase64)
    {
        var resumeNote = !string.IsNullOrWhiteSpace(resumeBase64) && resumeBase64.StartsWith("data:application/pdf;base64,")
            ? "\nThe candidate's full resume is attached as a PDF. Draw specific details from their actual experience when writing the letter."
            : "";

        var system = $"""
You are a professional cover letter writer. Write compelling, specific cover letters that get interviews.{resumeNote}

Write a complete, ready-to-send cover letter that:
- Opens with a strong hook tied to this specific company and role
- Uses exact keywords from the job description naturally
- Highlights the most relevant experience for this position
- Shows genuine knowledge of what this role requires
- Closes with a clear call to action
- Includes standard formatting (date placeholder, company address placeholder, signature line)

Write it as if you are the candidate. Make it sound human, not AI-generated.
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model = Model.ClaudeSonnet4_6,
            MaxTokens = 4096,
            System = system,
            Messages = [new() { Role = "user", Content = BuildUserMessage($"Write a cover letter for this job:\n\n{jobDescription}", resumeBase64) }]
        });

        return new CoverLetterResult { CoverLetter = ExtractText(response) };
    }

    private static bool HasResume(User user) =>
        !string.IsNullOrWhiteSpace(user.ResumeUrl) &&
        user.ResumeUrl.StartsWith("data:application/pdf;base64,");

    private static MessageParamContent BuildUserMessage(string text, string? resumeUrl)
    {
        if (!string.IsNullOrWhiteSpace(resumeUrl) && resumeUrl.StartsWith("data:application/pdf;base64,"))
        {
            var base64 = resumeUrl["data:application/pdf;base64,".Length..];
            ContentBlockParam docBlock = new DocumentBlockParam
            {
                Source = new DocumentBlockParamSource(new Base64PdfSource { Data = base64 })
            };
            ContentBlockParam textBlock = new TextBlockParam { Text = text };
            return new List<ContentBlockParam> { docBlock, textBlock };
        }
        return text;
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
        var end = raw.LastIndexOf(close);
        return start >= 0 && end > start ? raw[start..(end + 1)] : raw;
    }

    private static readonly JsonSerializerOptions CaseInsensitive =
        new() { PropertyNameCaseInsensitive = true };
}
