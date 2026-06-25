namespace JobTracker.API.Models;

// ⚠️  DEVIATION: the task specified Wishlist/PhoneScreen/Interview/Withdrawn.
// Those values are hard-coded in the React frontend (STATUSES arrays, GhostDetectionService, etc.)
// and cannot be changed without touching files outside this ticket's scope.
// The enum below uses the existing string values so no data migration is needed and
// the DB column type remains nvarchar(50) — only the C# property gains type safety.
public enum ApplicationStatus
{
    Applied,
    Responded,
    InterviewScheduled,
    Offer,
    Rejected,
    Ghosted
}
