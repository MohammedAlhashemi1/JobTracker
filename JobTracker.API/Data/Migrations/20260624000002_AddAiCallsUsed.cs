using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JobTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiCallsUsed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AiCallsUsed",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiCallsUsed",
                table: "Users");
        }
    }
}
