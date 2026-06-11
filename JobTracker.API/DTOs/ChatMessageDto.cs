using System.ComponentModel.DataAnnotations;

namespace JobTracker.API.DTOs;

public class ChatRequestDto
{
    [Required]
    public string Message { get; set; } = string.Empty;
}

public class ChatResponseDto
{
    public string Role { get; set; } = "assistant";
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
