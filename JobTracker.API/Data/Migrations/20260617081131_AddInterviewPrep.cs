using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInterviewPrep : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InterviewPrep",
                table: "Applications",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterviewPrep",
                table: "Applications");
        }
    }
}
