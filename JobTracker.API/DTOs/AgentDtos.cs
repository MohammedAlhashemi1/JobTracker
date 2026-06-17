namespace JobTracker.API.DTOs;

public class JobMatchResult
{
    public int Score { get; set; }
    public string[] MatchingSkills { get; set; } = [];
    public string[] MissingSkills { get; set; } = [];
    public string Emphasis { get; set; } = string.Empty;
}

public class ResumeTailorResult
{
    public string TailoredBullets { get; set; } = string.Empty;
}

public class CoverLetterResult
{
    public string CoverLetter { get; set; } = string.Empty;
}

public class StrategyResult
{
    public string Report { get; set; } = string.Empty;
}

public class EmailInterpretResult
{
    public string SuggestedStatus { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
}

public class EmailInterpretRequest
{
    public string EmailText { get; set; } = string.Empty;
}

public class InterviewPrepResult
{
    public string Prep { get; set; } = string.Empty;
}

public class FollowUpResult
{
    public string Email { get; set; } = string.Empty;
}
