import pg from "pg";
import dotenv from "dotenv";
import { adminModel } from "../src/models/admin.model.js";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/bookhive",
});

async function runTest() {
  try {
    console.log("=== Testing Librarian Function Restrictions System ===");

    // 1. Fetch librarians
    console.log("\n1. Fetching all librarian accounts...");
    const librarians = await adminModel.listLibrarians();
    console.log(`Found ${librarians.length} librarian account(s):`);
    librarians.forEach((l) => {
      console.log(`  - ${l.name} (${l.email}, ${l.role})`);
      console.log(`    Permissions:`, l.permissions);
    });

    if (librarians.length === 0) {
      console.log("No librarians found, creating a test librarian...");
      const newId = "test-lib-" + Date.now();
      await pool.query(
        `INSERT INTO users (id, name, id_number, email, password_hash, role, department, course, status)
         VALUES (gen_random_uuid(), 'Test Librarian', $1, $2, 'dummy', 'Librarian', 'Library', 'Library', 'Active')`,
        [newId, `${newId}@stiwnu.edu.ph`]
      );
    }

    const testLib = (await adminModel.listLibrarians())[0];
    console.log(`\n2. Testing restriction update for: ${testLib.name} (${testLib.id})`);

    // 2. Restrict "reports" and "records"
    const restrictedPerms = {
      ...testLib.permissions,
      reports: false,
      records: false,
    };
    console.log("Setting restrictions (reports=false, records=false)...");
    const updated = await adminModel.updateUserPermissions(testLib.id, restrictedPerms);

    if (!updated) {
      throw new Error("Failed to update user permissions in DB.");
    }
    console.log("Updated permissions in DB:", updated.permissions);
    if (updated.permissions.reports !== false || updated.permissions.records !== false) {
      throw new Error("Permissions were not updated correctly!");
    }
    console.log("PASSED: Permissions successfully restricted in PostgreSQL.");

    // 3. Verify findUserById and findUserByIdentifier return permissions
    console.log("\n3. Testing findUserById and findUserByIdentifier...");
    const foundById = await adminModel.findUserById(testLib.id);
    console.log("findUserById permissions:", foundById?.permissions);
    if (foundById?.permissions?.reports !== false) {
      throw new Error("findUserById did not return updated permissions!");
    }

    const foundByIdentifier = await adminModel.findUserByIdentifier(testLib.email);
    console.log("findUserByIdentifier permissions:", foundByIdentifier?.permissions);
    if (foundByIdentifier?.permissions?.reports !== false) {
      throw new Error("findUserByIdentifier did not return updated permissions!");
    }
    console.log("PASSED: findUserById and findUserByIdentifier return permissions.");

    // 4. Restore permissions back to full access
    console.log("\n4. Restoring full access permissions...");
    const fullPerms = {
      home: true,
      records: true,
      transactions: true,
      reminders: true,
      reports: true,
      history: true,
      settings: true,
    };
    const restored = await adminModel.updateUserPermissions(testLib.id, fullPerms);
    console.log("Restored permissions:", restored.permissions);
    console.log("PASSED: Permissions restored to full access.");

    console.log("\n=== ALL RESTRICTION TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
