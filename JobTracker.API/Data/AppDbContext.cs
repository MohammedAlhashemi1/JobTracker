using Microsoft.EntityFrameworkCore;
using JobTracker.API.Models;

namespace JobTracker.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.FullName).HasMaxLength(256).IsRequired();
            e.Property(u => u.ExperienceLevel).HasMaxLength(50);
            e.Property(u => u.TargetRoles).HasMaxLength(1024);
        });

        modelBuilder.Entity<Application>(e =>
        {
            e.Property(a => a.JobTitle).HasMaxLength(512).IsRequired();
            e.Property(a => a.Company).HasMaxLength(512).IsRequired();
            e.Property(a => a.Location).HasMaxLength(512);
            e.Property(a => a.Status).HasMaxLength(50);
            e.Property(a => a.JobDescription).HasColumnType("nvarchar(max)");
            e.Property(a => a.Notes).HasMaxLength(4000);
            e.HasOne(a => a.User)
             .WithMany(u => u.Applications)
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.Property(c => c.Role).HasMaxLength(20).IsRequired();
            e.Property(c => c.Content).HasColumnType("nvarchar(max)").IsRequired();
            e.HasOne(c => c.User)
             .WithMany(u => u.ChatMessages)
             .HasForeignKey(c => c.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
