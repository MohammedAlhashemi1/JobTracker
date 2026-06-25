using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using JobTracker.API.DTOs;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly AiService _ai;

    public AiController(AiService ai) => _ai = ai;

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequestDto dto)
    {
        try
        {
            var result = await _ai.ChatAsync(dto.Message, GetUserId());
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // Issue 7: load last 50 messages so the frontend can hydrate on mount.
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _ai.GetHistoryAsync(GetUserId());
        return Ok(result);
    }

    [HttpGet("insights")]
    public async Task<IActionResult> GetInsights()
    {
        var result = await _ai.GetInsightsAsync(GetUserId());
        return Ok(result);
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
