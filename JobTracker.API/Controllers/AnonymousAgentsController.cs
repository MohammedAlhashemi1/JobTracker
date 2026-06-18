using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using JobTracker.API.DTOs;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[Authorize]
[ApiController]
[Route("api/agents/anonymous")]
public class AnonymousAgentsController : ControllerBase
{
    private readonly AgentService _agents;

    public AnonymousAgentsController(AgentService agents)
    {
        _agents = agents;
    }

    [HttpPost("tailor")]
    public async Task<IActionResult> TailorResume([FromBody] AnonymousAgentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.JobDescription))
            return BadRequest(new { message = "Job description is required." });
        try
        {
            return Ok(await _agents.TailorResumeAnonymousAsync(req.JobDescription, req.ResumeBase64));
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
            return Ok(await _agents.WriteCoverLetterAnonymousAsync(req.JobDescription, req.ResumeBase64));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
