using System.ComponentModel.DataAnnotations;

namespace JobTracker.API.DTOs;

public class RegisterDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FullName { get; set; } = string.Empty;

    [Required]
    public string ExperienceLevel { get; set; } = string.Empty;

    public string TargetRoles { get; set; } = string.Empty;
}
