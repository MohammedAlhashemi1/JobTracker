using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using JobTracker.API.Data;

namespace JobTracker.API.Filters;

public class AiCallLimitFilter : IAsyncActionFilter
{
    private const int FreeLimit = 5;
    private readonly AppDbContext _db;

    public AiCallLimitFilter(AppDbContext db) => _db = db;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var userIdStr = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
        {
            await next();
            return;
        }

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
        {
            await next();
            return;
        }

        if (user.AiCallsUsed >= FreeLimit)
        {
            context.Result = new ObjectResult(new
            {
                message = $"You've used your {FreeLimit} free AI credits. Subscribe to continue."
            })
            { StatusCode = 403 };
            return;
        }

        user.AiCallsUsed++;
        await _db.SaveChangesAsync();

        await next();
    }
}
