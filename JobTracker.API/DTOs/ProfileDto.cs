namespace JobTracker.API.DTOs;

public class ProfileResponseDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty;
    public string TargetRoles { get; set; } = string.Empty;
    public string? ResumeUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateProfileDto
{
    public string? FullName { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? TargetRoles { get; set; }
}

public class UploadResumeDto
{
    public string ResumeBase64 { get; set; } = string.Empty;
}
