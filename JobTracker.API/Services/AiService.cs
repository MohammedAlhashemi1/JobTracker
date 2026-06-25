using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Models;

namespace JobTracker.API.Services;

public class AiService
{
    private readonly AppDbContext _db;
    private readonly AnthropicClient _client;

    public AiService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _client = new AnthropicClient { ApiKey = config["Anthropic:ApiKey"]! };
    }

    public async Task<ChatResponseDto> ChatAsync(string userMessage, int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) throw new InvalidOperationException("User not found");

        var applications = await _db.Applications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.AppliedAt)
            .ToListAsync();

        var systemPrompt = BuildSystemPrompt(user, applications);

        var userMsg = new ChatMessage { UserId = userId, Role = "user", Content = userMessage };
        _db.ChatMessages.Add(userMsg);
        await _db.SaveChangesAsync();

        var history = await _db.ChatMessages
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(20)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var messages = history.Select(m => new MessageParam
        {
            Role    = m.Role == "user" ? "user" : "assistant",
            Content = m.Content
        }).ToList();

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 2048,
            System    = systemPrompt,
            Messages  = messages
        });

        var assistantContent = ExtractText(response);

        var assistantMsg = new ChatMessage { UserId = userId, Role = "assistant", Content = assistantContent };
        _db.ChatMessages.Add(assistantMsg);
        await _db.SaveChangesAsync();

        return new ChatResponseDto { Content = assistantContent, CreatedAt = assistantMsg.CreatedAt };
    }

    // Issue 7: return last 50 messages for the chat history mount.
    public async Task<List<ChatResponseDto>> GetHistoryAsync(int userId)
    {
        return await _db.ChatMessages
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .Take(50)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatResponseDto
            {
                Role      = m.Role,
                Content   = m.Content,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<string[]> GetInsightsAsync(int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return [];

        var applications = await _db.Applications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.AppliedAt)
            .ToListAsync();

        var userData = JsonSerializer.Serialize(new
        {
            user.FullName,
            user.ExperienceLevel,
            user.TargetRoles,
            Applications = applications.Select(a => new
            {
                a.JobTitle,
                a.Company,
                a.Location,
                Status     = a.Status.ToString(),
                AppliedAt  = a.AppliedAt.ToString("yyyy-MM-dd")
            })
        });

        var prompt = $"""
Based on this user's job application data, return exactly 3 short insight strings (max 20 words each) as a JSON array. Be specific and honest. Examples: "Your response rate on fullstack roles is 3x higher than backend-only roles." or "You haven't applied to anything in 9 days."

Data: {userData}

Return format: ["insight 1", "insight 2", "insight 3"]
""";

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model     = Model.ClaudeSonnet4_6,
            MaxTokens = 256,
            Messages  = [new() { Role = "user", Content = prompt }]
        });

        var raw = ExtractText(response);

        try
        {
            var start = raw.IndexOf('[');
            var end   = raw.LastIndexOf(']');
            if (start >= 0 && end > start)
                raw = raw[start..(end + 1)];
            return JsonSerializer.Deserialize<string[]>(raw) ?? [];
        }
        catch { return []; }
    }

    private static string ExtractText(Message response)
    {
        foreach (var block in response.Content)
        {
            if (block.TryPickText(out var textBlock))
                return textBlock.Text;
        }
        return string.Empty;
    }

    private static string BuildSystemPrompt(User user, List<Application> apps)
    {
        // Issue 5: use .ToString() to serialise the enum to its string name.
        var total      = apps.Count;
        var responded  = apps.Count(a => a.Status is ApplicationStatus.Responded
                                      or ApplicationStatus.InterviewScheduled
                                      or ApplicationStatus.Offer);
        var interviews = apps.Count(a => a.Status is ApplicationStatus.InterviewScheduled);
        var offers     = apps.Count(a => a.Status == ApplicationStatus.Offer);
        var rejected   = apps.Count(a => a.Status == ApplicationStatus.Rejected);
        var ghosted    = apps.Count(a => a.Status == ApplicationStatus.Ghosted);
        var responseRate = total > 0 ? (responded * 100.0 / total) : 0;

        var recent = apps.Take(10)
            .Select(a => $"- {a.JobTitle} at {a.Company} ({a.Status}) — {a.AppliedAt:yyyy-MM-dd}");

        var allAppsJson = JsonSerializer.Serialize(apps.Select(a => new
        {
            a.JobTitle,
            a.Company,
            a.Location,
            Status    = a.Status.ToString(),
            AppliedAt = a.AppliedAt.ToString("yyyy-MM-dd")
        }));

        return $"""
You are a job search assistant. You have full access to this user's job application history.

User Profile:
- Name: {user.FullName}
- Experience Level: {user.ExperienceLevel}
- Target Roles: {user.TargetRoles}

Application Summary:
- Total Applications: {total}
- Responded: {responded} ({responseRate:F1}%)
- Interviews: {interviews}
- Offers: {offers}
- Rejected: {rejected}
- Ghosted: {ghosted}

Recent Applications (last 10):
{string.Join("\n", recent)}

Full Application History:
{allAppsJson}

Give specific, honest, personalized advice based on this data. Do not give generic job search tips.
""";
    }
}
