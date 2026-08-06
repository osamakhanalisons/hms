/**
 * Apply Mobile App Database Fixes
 * 
 * This script applies the required database schema changes to fix
 * mobile app errors related to missing columns:
 * - complaints.created_by
 * - poll_votes.option_selected
 * - amenity_bookings.status (change from ENUM to VARCHAR)
 */

import mysql from "mysql2/promise";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env file from project root
dotenv.config({ path: path.join(rootDir, ".env") });

async function applyMigration() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";

  console.log("📱 Mobile App Database Fix");
  console.log("==========================");
  console.log(`Host: ${host}:${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}`);
  console.log("");

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log("✅ Connected to database");
    console.log("");

    // Check current schema
    console.log("🔍 Checking current schema...");
    
    const [complaintsColumns] = await connection.query(
      "SHOW COLUMNS FROM complaints"
    ) as any[];
    const hasCreatedBy = complaintsColumns.some((col: any) => col.Field === "created_by");
    
    const [pollVotesColumns] = await connection.query(
      "SHOW COLUMNS FROM poll_votes"
    ) as any[];
    const hasOptionSelected = pollVotesColumns.some((col: any) => col.Field === "option_selected");
    
    const [amenityBookingsColumns] = await connection.query(
      "SHOW COLUMNS FROM amenity_bookings"
    ) as any[];
    const statusColumn = amenityBookingsColumns.find((col: any) => col.Field === "status");

    console.log(`  complaints.created_by: ${hasCreatedBy ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  poll_votes.option_selected: ${hasOptionSelected ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  amenity_bookings.status type: ${statusColumn?.Type || 'N/A'}`);
    console.log("");

    // Apply migrations
    console.log("🔧 Applying migrations...");
    
    if (!hasCreatedBy) {
      console.log("  → Adding created_by to complaints...");
      await connection.query(`
        ALTER TABLE complaints
        ADD COLUMN created_by VARCHAR(36) NULL COMMENT 'User who created the complaint'
      `);
      console.log("    ✅ Done");
    } else {
      console.log("  ⏭️  complaints.created_by already exists");
    }

    if (!hasOptionSelected) {
      console.log("  → Adding option_selected to poll_votes...");
      await connection.query(`
        ALTER TABLE poll_votes
        ADD COLUMN option_selected VARCHAR(128) NULL COMMENT 'Selected option id/string'
      `);
      console.log("    ✅ Done");
    } else {
      console.log("  ⏭️  poll_votes.option_selected already exists");
    }

    if (statusColumn?.Type.includes('enum')) {
      console.log("  → Updating amenity_bookings.status from ENUM to VARCHAR...");
      await connection.query(`
        ALTER TABLE amenity_bookings
        MODIFY COLUMN status VARCHAR(64) NULL DEFAULT 'pending' 
        COMMENT 'Status: pending, approved, cancelled, completed, confirmed'
      `);
      console.log("    ✅ Done");
    } else if (statusColumn?.Type.includes('varchar')) {
      console.log("  ⏭️  amenity_bookings.status is already VARCHAR");
    }

    // Add indexes
    console.log("");
    console.log("📊 Adding indexes for performance...");
    
    try {
      await connection.query(`
        CREATE INDEX idx_complaints_created_by ON complaints(created_by)
      `);
      console.log("  ✅ Created index on complaints.created_by");
    } catch (e: any) {
      if (e.message.includes('Duplicate key name')) {
        console.log("  ⏭️  Index on complaints.created_by already exists");
      } else {
        throw e;
      }
    }

    try {
      await connection.query(`
        CREATE INDEX idx_poll_votes_selected ON poll_votes(option_selected)
      `);
      console.log("  ✅ Created index on poll_votes.option_selected");
    } catch (e: any) {
      if (e.message.includes('Duplicate key name')) {
        console.log("  ⏭️  Index on poll_votes.option_selected already exists");
      } else {
        throw e;
      }
    }

    // Add 'general' category to complaints if needed
    console.log("");
    console.log("🔧 Checking complaints category...");
    const categoryColumn = complaintsColumns.find((col: any) => col.Field === "category");
    if (categoryColumn?.Type.includes('enum') && !categoryColumn.Type.includes('general')) {
      console.log("  → Adding 'general' to category ENUM...");
      await connection.query(`
        ALTER TABLE complaints
        MODIFY COLUMN category ENUM('electrical','plumbing','security','cleaning','lift','water','civil','hvac','other','general') 
        NOT NULL DEFAULT 'other'
      `);
      console.log("    ✅ Done");
    } else {
      console.log("  ⏭️  Category already supports 'general' or is VARCHAR");
    }

    await connection.end();

    console.log("");
    console.log("🎉 Migration completed successfully!");
    console.log("");
    console.log("📱 Your mobile app should now work without database errors.");
    console.log("   Test the following features:");
    console.log("   - File Complaint");
    console.log("   - Vote on Polls");
    console.log("   - Book Amenities");
    console.log("");

  } catch (error: any) {
    console.error("");
    console.error("❌ Migration failed:");
    console.error(error.message);
    console.error("");
    console.error("Stack trace:");
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
applyMigration();
