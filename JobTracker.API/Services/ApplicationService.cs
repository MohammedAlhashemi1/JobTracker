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

    public async Task<List<ApplicationResponseDto>> GetAllAsync(int userId)
    {
        var apps = await _db.Applications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.AppliedAt)
            .ToListAsync();
        return apps.Select(MapToDto).ToList();
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
            UserId = userId,
            JobTitle = dto.JobTitle,
            Company = dto.Company,
            Location = dto.Location,
            JobUrl = dto.JobUrl,
            JobDescription = dto.JobDescription,
            Notes = dto.Notes,
            Status = "Applied",
            AppliedAt = dto.AppliedAt?.ToUniversalTime() ?? DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
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

        if (dto.JobTitle is not null) app.JobTitle = dto.JobTitle;
        if (dto.Company is not null) app.Company = dto.Company;
        if (dto.Location is not null) app.Location = dto.Location;
        if (dto.JobUrl is not null) app.JobUrl = dto.JobUrl;
        if (dto.JobDescription is not null) app.JobDescription = dto.JobDescription;
        if (dto.Notes is not null) app.Notes = dto.Notes;
        if (dto.Status is not null)
        {
            app.Status = dto.Status;
            // Clear auto-ghost flag when status is manually changed
            if (app.IsAutoGhosted && dto.Status != "Ghosted")
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
        Id = a.Id,
        UserId = a.UserId,
        JobTitle = a.JobTitle,
        Company = a.Company,
        Location = a.Location,
        JobUrl = a.JobUrl,
        JobDescription = a.JobDescription,
        Status = a.Status,
        Notes = a.Notes,
        AppliedAt = a.AppliedAt,
        UpdatedAt = a.UpdatedAt,
        IsAutoGhosted = a.IsAutoGhosted
    };
}
