using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Services;

namespace JobTracker.API.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blob;

    public ProfileController(AppDbContext db, IBlobStorageService blob)
    {
        _db   = db;
        _blob = blob;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        return Ok(MapToDto(user));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateProfileDto dto)
    {
        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        if (dto.FullName        is not null) user.FullName        = dto.FullName;
        if (dto.ExperienceLevel is not null) user.ExperienceLevel = dto.ExperienceLevel;
        if (dto.TargetRoles     is not null) user.TargetRoles     = dto.TargetRoles;

        await _db.SaveChangesAsync();
        return Ok(MapToDto(user));
    }

    // Issue 3: override the 1 MB global Kestrel limit for this endpoint.
    // A 5 MB file encodes to ≈ 6.7 MB in base64; 8 MB covers that plus JSON overhead.
    [HttpPost("resume")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> UploadResume([FromBody] UploadResumeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ResumeBase64))
            return BadRequest(new { message = "No file data provided." });

        var user = await _db.Users.FindAsync(GetUserId());
        if (user is null) return NotFound();

        // Parse data URL: "data:<mime>;base64,<data>"
        var commaIdx = dto.ResumeBase64.IndexOf(',');
        if (commaIdx < 0)
            return BadRequest(new { message = "Invalid file data: expected a data URL." });

        var meta = dto.ResumeBase64[..commaIdx];           // e.g. "data:application/pdf;base64"
        var base64Data = dto.ResumeBase64[(commaIdx + 1)..];

        byte[] bytes;
        try { bytes = Convert.FromBase64String(base64Data); }
        catch { return BadRequest(new { message = "Invalid base64 payload." }); }

        var contentType = meta.Replace("data:", "").Replace(";base64", "");
        if (string.IsNullOrWhiteSpace(contentType)) contentType = "application/octet-stream";

        var ext      = contentType.Contains("pdf") ? "pdf" : "docx";
        var fileName = $"resume.{ext}";

        string resumeUrl;
        if (_blob.IsEnabled)
        {
            // Upload to blob storage; store only the URL.
            resumeUrl = await _blob.UploadResumeAsync(bytes, fileName, contentType, user.Id);
        }
        else
        {
            // Blob storage not configured — fall back to storing the data URL directly.
            resumeUrl = dto.ResumeBase64;
        }

        user.ResumeUrl = resumeUrl;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Resume uploaded.", resumeUrl });
    }

    private static ProfileResponseDto MapToDto(Models.User user) => new()
    {
        Id              = user.Id,
        Email           = user.Email,
        FullName        = user.FullName,
        ExperienceLevel = user.ExperienceLevel,
        TargetRoles     = user.TargetRoles,
        ResumeUrl       = user.ResumeUrl,
        CreatedAt       = user.CreatedAt,
    };

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
