using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Filters;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/agents/anonymous")]
[EnableRateLimiting("anonymous-trial")]
[ServiceFilter(typeof(AiCallLimitFilter))]
[RequestSizeLimit(5 * 1024 * 1024)] // 5 MB — resume base64 can be large
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
            var result = await _agents.TailorResumePreserveAsync(req.JobDescription, resume);
            if (result.Docx is null) return NoContent();
            return Ok(new
            {
                tailoredResumeDocx   = Convert.ToBase64String(result.Docx),
                originalMatchScore   = result.OriginalMatchScore,
                tailoredMatchScore   = result.TailoredMatchScore,
                tailoredDocxText     = result.TailoredDocxText
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // Authenticated users: fall back to their stored profile resume if no inline data.
    // Anonymous users: must supply the resume inline; no profile to look up.
    private async Task<string?> ResolveResumeAsync(string? inlineBase64)
    {
        if (inlineBase64 is not null) return inlineBase64;
        if (User.Identity?.IsAuthenticated != true) return null;
        var user = await _db.Users.FindAsync(GetUserId());
        return user?.ResumeUrl;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
