using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using JobTracker.API.Data;
using JobTracker.API.Filters;
using JobTracker.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Issue 3: global Kestrel body-size limit (1 MB). Individual endpoints that
// legitimately need more override this with [RequestSizeLimit]. ───────────────
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = 1 * 1024 * 1024);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ApplicationService>();
builder.Services.AddHttpClient<ScraperService>();
builder.Services.AddScoped<AiService>();
builder.Services.AddScoped<AgentService>();
// Issue 2: blob storage — singleton because BlobServiceClient is thread-safe.
builder.Services.AddSingleton<IBlobStorageService, BlobStorageService>();
builder.Services.AddScoped<AiCallLimitFilter>();
builder.Services.AddHostedService<GhostDetectionService>();

var jwtSecret = builder.Configuration["Jwt:Secret"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

// ── Rate limiters ─────────────────────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    // Per-user fixed-window limiter for authenticated AI endpoints.
    options.AddPolicy("ai-policy", context =>
    {
        var partitionKey =
            context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit          = 10,
            Window               = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit           = 0
        });
    });

    // One free trial generate per IP per 24 hours for unauthenticated users.
    // PermitLimit = 3 because one full generate fires 3 parallel API calls
    // (tailor-preserve, tailor, cover-letter) and all three must succeed together.
    // Authenticated users bypass this entirely — they use the AiCallLimitFilter instead.
    // X-Forwarded-For is read because Railway sits behind a reverse proxy and
    // Connection.RemoteIpAddress would otherwise be the same proxy IP for everyone.
    options.AddPolicy("anonymous-trial", context =>
    {
        if (context.User.Identity?.IsAuthenticated == true)
            return RateLimitPartition.GetNoLimiter("authenticated");

        var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                     ?.Split(',')[0].Trim()
                 ?? context.Connection.RemoteIpAddress?.ToString()
                 ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter($"anon:{ip}", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit          = 3,
            Window               = TimeSpan.FromHours(24),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit           = 0,
        });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode  = 429;
        context.HttpContext.Response.ContentType = "application/json";
        var body = context.HttpContext.User.Identity?.IsAuthenticated == true
            ? """{"message":"Too many requests — please wait a moment and try again."}"""
            : """{"message":"You've used your free trial generation. Create a free account to keep going.","trialExpired":true}""";
        await context.HttpContext.Response.WriteAsync(body, token);
    };
});

// ── Issue 4: CORS — exact extension ID allowlist loaded from config ──────────
// PLACEHOLDER: add your real extension ID to AllowedExtensions in appsettings.
var allowedExtensions =
    builder.Configuration.GetSection("AllowedExtensions").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173", "https://job-tracker-three-umber.vercel.app")
              .AllowAnyHeader()
              .AllowAnyMethod());

    options.AddPolicy("AllowExtension", policy =>
        policy.SetIsOriginAllowed(origin =>
            allowedExtensions.Contains(origin) ||
            origin == "http://localhost:5173" ||
            origin == "https://job-tracker-three-umber.vercel.app")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();

app.UseCors("AllowExtension");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();

app.Run();
