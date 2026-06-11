namespace JobTracker.API.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty;
    public string TargetRoles { get; set; } = string.Empty;
    public string? ResumeUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Application> Applications { get; set; } = new List<Application>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
