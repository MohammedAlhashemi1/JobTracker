using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using JobTracker.API.DTOs;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/agents")]
[Authorize]
public class AgentsController : ControllerBase
{
    private readonly AgentService _agents;

    public AgentsController(AgentService agents) => _agents = agents;

    [HttpPost("match/{applicationId:int}")]
    public async Task<IActionResult> Match(int applicationId)
    {
        try { return Ok(await _agents.AnalyzeMatchAsync(applicationId, GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("resume-tailor/{applicationId:int}")]
    public async Task<IActionResult> TailorResume(int applicationId)
    {
        try { return Ok(await _agents.TailorResumeAsync(applicationId, GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("cover-letter/{applicationId:int}")]
    public async Task<IActionResult> CoverLetter(int applicationId)
    {
        try { return Ok(await _agents.WriteCoverLetterAsync(applicationId, GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("strategy")]
    public async Task<IActionResult> Strategy()
    {
        try { return Ok(await _agents.RunStrategyAsync(GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("email-interpret/{applicationId:int}")]
    public async Task<IActionResult> EmailInterpret(int applicationId, [FromBody] EmailInterpretRequest dto)
    {
        try { return Ok(await _agents.InterpretEmailAsync(applicationId, GetUserId(), dto.EmailText)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("interview-prep/{applicationId:int}")]
    public async Task<IActionResult> InterviewPrep(int applicationId)
    {
        try { return Ok(await _agents.PrepareInterviewAsync(applicationId, GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("follow-up/{applicationId:int}")]
    public async Task<IActionResult> FollowUp(int applicationId)
    {
        try { return Ok(await _agents.GenerateFollowUpAsync(applicationId, GetUserId())); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
