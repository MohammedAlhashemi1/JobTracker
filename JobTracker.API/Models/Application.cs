namespace JobTracker.API.Models;

public class Application
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string? JobUrl { get; set; }
    public string? JobDescription { get; set; }
    public string Status { get; set; } = "Applied";
    public string? Notes { get; set; }
    public string? CoverLetter { get; set; }
    public string? TailoredResume { get; set; }
    public string? InterviewPrep { get; set; }
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsAutoGhosted { get; set; } = false;

    public User User { get; set; } = null!;
}
