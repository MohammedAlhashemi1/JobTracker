using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using JobTracker.API.DTOs;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/applications")]
[Authorize]
public class ApplicationsController : ControllerBase
{
    private readonly ApplicationService _service;
    private readonly ScraperService _scraper;

    public ApplicationsController(ApplicationService service, ScraperService scraper)
    {
        _service = service;
        _scraper = scraper;
    }

    // Issue 6: page/pageSize are optional query params; defaults to page 1, 50 per page.
    // Pass pageSize=1000 (or any large number, capped at 500 internally) to load all apps.
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _service.GetAllAsync(GetUserId(), page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id, GetUserId());
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateApplicationDto dto)
    {
        var result = await _service.CreateAsync(dto, GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateApplicationDto dto)
    {
        var result = await _service.UpdateAsync(id, dto, GetUserId());
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id, GetUserId());
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("scrape")]
    public async Task<IActionResult> Scrape([FromBody] ScrapeRequestDto dto)
    {
        try
        {
            var result = await _scraper.ScrapeAsync(dto.Url);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return BadRequest(new { message = $"Could not fetch the URL: {ex.Message}" });
        }
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
