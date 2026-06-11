using System.ComponentModel.DataAnnotations;

namespace JobTracker.API.DTOs;

public class ScrapeRequestDto
{
    [Required, Url]
    public string Url { get; set; } = string.Empty;
}

public class ScrapeResponseDto
{
    public string? JobTitle { get; set; }
    public string? Company { get; set; }
    public string? Location { get; set; }
    public string? JobDescription { get; set; }
    public string Url { get; set; } = string.Empty;
}
