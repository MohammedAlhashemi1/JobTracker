using Microsoft.EntityFrameworkCore;
using JobTracker.API.Data;
using JobTracker.API.DTOs;
using JobTracker.API.Models;

namespace JobTracker.API.Services;

public class ApplicationService
{
    private readonly AppDbContext _db;

    public ApplicationService(AppDbContext db)
    {
        _db = db;
    }

    // Issue 6: pagination. Callers pass page/pageSize; page is 1-based.
    public async Task<PagedResult<ApplicationResponseDto>> GetAllAsync(
        int userId, int page = 1, int pageSize = 50)
    {
        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 500);

        var query = _db.Applications.Where(a => a.UserId == userId);
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.AppliedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<ApplicationResponseDto>
        {
            Items     = items.Select(MapToDto),
            TotalCount = total,
            Page      = page,
            PageSize  = pageSize
        };
    }

    public async Task<ApplicationResponseDto?> GetByIdAsync(int id, int userId)
    {
        var app = await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        return app is null ? null : MapToDto(app);
    }

    public async Task<ApplicationResponseDto> CreateAsync(CreateApplicationDto dto, int userId)
    {
        var app = new Application
        {
            UserId         = userId,
            JobTitle       = dto.JobTitle,
            Company        = dto.Company,
            Location       = dto.Location,
            JobUrl         = dto.JobUrl,
            JobDescription = dto.JobDescription,
            Notes          = dto.Notes,
            Status         = ApplicationStatus.Applied,
            AppliedAt      = dto.AppliedAt?.ToUniversalTime() ?? DateTime.UtcNow,
            UpdatedAt      = DateTime.UtcNow
        };

        _db.Applications.Add(app);
        await _db.SaveChangesAsync();
        return MapToDto(app);
    }

    public async Task<ApplicationResponseDto?> UpdateAsync(int id, UpdateApplicationDto dto, int userId)
    {
        var app = await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (app is null) return null;

        if (dto.JobTitle       is not null) app.JobTitle       = dto.JobTitle;
        if (dto.Company        is not null) app.Company        = dto.Company;
        if (dto.Location       is not null) app.Location       = dto.Location;
        if (dto.JobUrl         is not null) app.JobUrl         = dto.JobUrl;
        if (dto.JobDescription is not null) app.JobDescription = dto.JobDescription;
        if (dto.Notes          is not null) app.Notes          = dto.Notes;

        // Issue 5: parse the validated status string into the enum.
        if (dto.Status is not null && Enum.TryParse<ApplicationStatus>(dto.Status, out var parsed))
        {
            app.Status = parsed;
            if (app.IsAutoGhosted && parsed != ApplicationStatus.Ghosted)
                app.IsAutoGhosted = false;
        }

        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return MapToDto(app);
    }

    public async Task<bool> DeleteAsync(int id, int userId)
    {
        var app = await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (app is null) return false;

        _db.Applications.Remove(app);
        await _db.SaveChangesAsync();
        return true;
    }

    private static ApplicationResponseDto MapToDto(Application a) => new()
    {
        Id             = a.Id,
        UserId         = a.UserId,
        JobTitle       = a.JobTitle,
        Company        = a.Company,
        Location       = a.Location,
        JobUrl         = a.JobUrl,
        JobDescription = a.JobDescription,
        Status         = a.Status.ToString(), // Issue 5: serialize enum → string for frontend
        Notes          = a.Notes,
        CoverLetter    = a.CoverLetter,
        TailoredResume = a.TailoredResume,
        InterviewPrep  = a.InterviewPrep,
        AppliedAt      = a.AppliedAt,
        UpdatedAt      = a.UpdatedAt,
        IsAutoGhosted  = a.IsAutoGhosted
    };
}
