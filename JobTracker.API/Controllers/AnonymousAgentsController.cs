using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Filters;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[Authorize]
[ApiController]
[Route("api/agents/anonymous")]
[EnableRateLimiting("ai-policy")]
[ServiceFilter(typeof(AiCallLimitFilter))]
public class AnonymousAgentsController : ControllerBase
{
    private readonly AgentService _agents;
    private readonly AppDbContext _db; // Issue 2: needed to look up stored resume URL

    public AnonymousAgentsController(AgentService agents, AppDbContext db)
    {
        _agents = agents;
        _db     = db;
    }

    [HttpPost("tailor")]
    public async Task<IActionResult> TailorResume([FromBody] AnonymousAgentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.JobDescription))
            return BadRequest(new { message = "Job description is required." });
        try
        {
            var resume = await ResolveResumeAsync(req.ResumeBase64);
            return Ok(await _agents.TailorResumeAnonymousAsync(req.JobDescription, resume));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("cover-letter")]
    public async Task<IActionResult> CoverLetter([FromBody] AnonymousAgentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.JobDescription))
            return BadRequest(new { message = "Job description is required." });
        try
        {
            var resume = await ResolveResumeAsync(req.ResumeBase64);
            return Ok(await _agents.WriteCoverLetterAnonymousAsync(req.JobDescription, resume));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("tailor-preserve")]
    public async Task<IActionResult> TailorPreserve([FromBody] AnonymousAgentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.JobDescription))
            return BadRequest(new { message = "Job description is required." });
        try
        {
            var resume = await ResolveResumeAsync(req.ResumeBase64);
            var bytes  = await _agents.TailorResumePreserveAsync(req.JobDescription, resume);
            if (bytes is null) return NoContent();
            return Ok(Convert.ToBase64String(bytes));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TailorPreserve] CONTROLLER EXCEPTION: {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // Issue 2: if the caller didn't supply an inline resume (because the frontend
    // no longer sends profile.resumeUrl as base64), look up the stored URL from the
    // user's profile.  AgentService.BuildUserMessageAsync then downloads it from blob.
    private async Task<string?> ResolveResumeAsync(string? inlineBase64)
    {
        if (inlineBase64 is not null) return inlineBase64;
        var user = await _db.Users.FindAsync(GetUserId());
        return user?.ResumeUrl;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
