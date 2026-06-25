using Microsoft.EntityFrameworkCore;
using JobTracker.API.Data;
using JobTracker.API.Models;

namespace JobTracker.API.Services;

public class GhostDetectionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<GhostDetectionService> _logger;

    public GhostDetectionService(IServiceScopeFactory scopeFactory, ILogger<GhostDetectionService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await RunGhostDetectionAsync();
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }

    private async Task RunGhostDetectionAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow.AddDays(-30);

        var stale = await db.Applications
            .Where(a => a.Status == ApplicationStatus.Applied && a.AppliedAt < cutoff)
            .ToListAsync();

        if (stale.Count == 0) return;

        foreach (var app in stale)
        {
            app.Status = ApplicationStatus.Ghosted;
            app.IsAutoGhosted = true;
            app.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Ghost detection: marked {Count} applications as Ghosted.", stale.Count);
    }
}
