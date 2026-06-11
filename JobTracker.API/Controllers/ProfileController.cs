using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using JobTracker.API.Data;
using JobTracker.API.DTOs;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProfileController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        return Ok(new ProfileResponseDto
        {
            Id             = user.Id,
            Email          = user.Email,
            FullName       = user.FullName,
            ExperienceLevel= user.ExperienceLevel,
            TargetRoles    = user.TargetRoles,
            ResumeUrl      = user.ResumeUrl,
            CreatedAt      = user.CreatedAt,
        });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateProfileDto dto)
    {
        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        if (dto.FullName       is not null) user.FullName        = dto.FullName;
        if (dto.ExperienceLevel is not null) user.ExperienceLevel = dto.ExperienceLevel;
        if (dto.TargetRoles    is not null) user.TargetRoles     = dto.TargetRoles;

        await _db.SaveChangesAsync();

        return Ok(new ProfileResponseDto
        {
            Id             = user.Id,
            Email          = user.Email,
            FullName       = user.FullName,
            ExperienceLevel= user.ExperienceLevel,
            TargetRoles    = user.TargetRoles,
            ResumeUrl      = user.ResumeUrl,
            CreatedAt      = user.CreatedAt,
        });
    }

    [HttpPost("resume")]
    public async Task<IActionResult> UploadResume([FromBody] UploadResumeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ResumeBase64))
            return BadRequest(new { message = "No file data provided." });

        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        user.ResumeUrl = dto.ResumeBase64;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Resume uploaded." });
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
