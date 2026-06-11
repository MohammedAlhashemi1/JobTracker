using System.ComponentModel.DataAnnotations;

namespace JobTracker.API.DTOs;

public class CreateApplicationDto
{
    [Required]
    public string JobTitle { get; set; } = string.Empty;

    [Required]
    public string Company { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;
    public string? JobUrl { get; set; }
    public string? JobDescription { get; set; }
    public string? Notes { get; set; }
    public DateTime? AppliedAt { get; set; }
}

public class UpdateApplicationDto
{
    public string? JobTitle { get; set; }
    public string? Company { get; set; }
    public string? Location { get; set; }
    public string? JobUrl { get; set; }
    public string? JobDescription { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class ApplicationResponseDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string? JobUrl { get; set; }
    public string? JobDescription { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime AppliedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsAutoGhosted { get; set; }
    public int DaysSinceApplied => (int)(DateTime.UtcNow - AppliedAt).TotalDays;
}
