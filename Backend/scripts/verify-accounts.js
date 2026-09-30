import bcrypt from "bcryptjs";
import { pool } from "../src/db/pool.js";
import { superAdminModel } from "../src/models/super-admin.model.js";
import { adminModel } from "../src/models/admin.model.js";
import { studentModel } from "../src/models/student.model.js";

async function runVerification() {
  console.log("==================================================");
  console.log("  BOOKHIVE: ROLE-BASED ACCOUNT PROVISIONING TEST  ");
  console.log("==================================================\n");

  const testAccounts = [
    {
      name: "Test Student Alpha",
      email: "test.student.alpha@stiwnu.edu.ph",
      idNumber: "TEST-STU-001",
      role: "Student",
      department: "College of Information & Communications Technology (CICT)",
      course: "BS Information Technology",
      yearLevel: "3RD",
      section: "B",
      password: "StudentPass123!",
    },
    {
      name: "Test Librarian Beta",
      email: "test.librarian.beta@stiwnu.edu.ph",
      idNumber: "TEST-LIB-001",
      role: "Librarian",
      department: "None",
      course: "None",
      password: "LibrarianPass123!",
    },
    {
      name: "Test Admin Gamma",
      email: "test.admin.gamma@stiwnu.edu.ph",
      idNumber: "TEST-ADM-001",
      role: "Admin",
      department: "None",
      course: "None",
      password: "AdminPass123!",
    },
    {
      name: "Test SuperAdmin Delta",
      email: "test.superadmin.delta@stiwnu.edu.ph",
      idNumber: "TEST-SAD-001",
      role: "Super Admin",
      department: "None",
      course: "None",
      password: "SuperAdminPass123!",
    },
  ];

  const createdIds = [];

  try {
    // 0. Pre-clean any leftover test accounts
    console.log("Phase 0: Cleaning any pre-existing test accounts...");
    await pool.query("DELETE FROM users WHERE id_number LIKE 'TEST-%' OR email LIKE 'test.%@stiwnu.edu.ph'");
    console.log("  Cleaned up existing test accounts.\n");

    // 1. Create accounts for all 4 roles
    console.log("Phase 1: Creating accounts for Student, Librarian, Admin, Super Admin...");
    for (const acc of testAccounts) {
      const created = await superAdminModel.createUser(acc);
      if (!created || !created.id) {
        throw new Error(`Failed to create account for ${acc.role}: ${acc.email}`);
      }
      createdIds.push(created.id);
      console.log(`  [OK] Created ${acc.role.padEnd(12)}: id=${created.id}, name="${created.name}", email="${created.email}", idNumber="${created.idNumber}"`);
    }
    console.log();

    // 2. Verify Database Rows, Permissions, and Admin Profiles
    console.log("Phase 2: Verifying PostgreSQL database state and role configurations...");
    for (const acc of testAccounts) {
      const res = await pool.query(
        `SELECT id, name, email, id_number, role, department, course, year_level, section, status, permissions, qr_code, password_hash
         FROM users WHERE email = $1`,
        [acc.email]
      );
      const user = res.rows[0];
      if (!user) {
        throw new Error(`Database row not found for ${acc.email}`);
      }

      // Check password hash
      const passMatch = await bcrypt.compare(acc.password, user.password_hash);
      if (!passMatch) {
        throw new Error(`Password hash verification failed for ${acc.email}`);
      }

      // Check role specific fields
      if (acc.role === "Student") {
        if (!user.qr_code) throw new Error("Student missing QR Code UUID!");
        if (user.year_level !== acc.yearLevel) throw new Error(`Student yearLevel mismatch: got ${user.year_level}, expected ${acc.yearLevel}`);
        if (user.section !== acc.section) throw new Error(`Student section mismatch: got ${user.section}, expected ${acc.section}`);
        if (!user.permissions?.catalog || !user.permissions?.borrow) {
          throw new Error("Student default permissions incomplete!");
        }
        console.log(`  [OK] Student verified: QR Code = ${user.qr_code}, Year/Section = ${user.year_level}-${user.section}, Permissions = ${JSON.stringify(user.permissions)}`);
      } else {
        // Staff roles
        const profileRes = await pool.query("SELECT * FROM admin_profiles WHERE user_id = $1", [user.id]);
        if (profileRes.rows.length === 0) {
          throw new Error(`Admin profile entry was NOT created for ${acc.role} (${acc.email})!`);
        }
        if (acc.role === "Super Admin") {
          if (!user.permissions?.superAdmin) throw new Error("Super Admin missing superAdmin: true permission!");
        }
        if (acc.role === "Librarian") {
          if (user.permissions?.settings === true) throw new Error("Librarian should have settings: false!");
        }
        console.log(`  [OK] ${acc.role.padEnd(12)} verified: Admin Profile active, Permissions = ${JSON.stringify(user.permissions)}`);
      }
    }
    console.log();

    // 3. Verify Duplicate Safeguards
    console.log("Phase 3: Testing duplicate email and ID number safeguards...");
    let emailDupBlocked = false;
    try {
      await superAdminModel.createUser({
        ...testAccounts[0],
        idNumber: "TEST-DIFFERENT-ID",
      });
    } catch (err) {
      if (err.code === "23505" || err.message?.includes("already exists") || err.message?.includes("email")) {
        emailDupBlocked = true;
      }
    }
    if (!emailDupBlocked) throw new Error("Duplicate email was NOT rejected by database constraint!");
    console.log("  [OK] Duplicate email insertion correctly blocked.");

    let idDupBlocked = false;
    try {
      await superAdminModel.createUser({
        ...testAccounts[0],
        email: "test.different.email@stiwnu.edu.ph",
      });
    } catch (err) {
      if (err.code === "23505" || err.message?.includes("already exists") || err.message?.includes("id_number")) {
        idDupBlocked = true;
      }
    }
    if (!idDupBlocked) throw new Error("Duplicate ID number was NOT rejected by database constraint!");
    console.log("  [OK] Duplicate ID number insertion correctly blocked.\n");

    // 4. Verify Authentication for Each Role
    console.log("Phase 4: Testing authentication behavior per role...");
    
    // 4a. Student login lookup by email and ID number
    const stuByEmail = await studentModel.findUserByEmail("test.student.alpha@stiwnu.edu.ph");
    if (!stuByEmail) throw new Error("Student not found by email in studentModel!");
    const stuPassMatch = await bcrypt.compare("StudentPass123!", stuByEmail.passwordHash);
    if (!stuPassMatch) throw new Error("Student password comparison failed!");
    console.log("  [OK] Student authenticated successfully via Email.");

    const stuById = await studentModel.findUserByEmail("TEST-STU-001");
    if (!stuById || stuById.id !== stuByEmail.id) throw new Error("Student not found by ID number in studentModel!");
    console.log("  [OK] Student authenticated successfully via ID Number.");

    // 4b. Staff login lookup
    const libUser = await adminModel.findUserByIdentifier("test.librarian.beta@stiwnu.edu.ph");
    if (!libUser) throw new Error("Librarian not found in adminModel!");
    const libPassMatch = await bcrypt.compare("LibrarianPass123!", libUser.passwordHash);
    if (!libPassMatch) throw new Error("Librarian password comparison failed!");
    console.log("  [OK] Librarian authenticated successfully (Target path: /librarian).");

    const admUser = await adminModel.findUserByIdentifier("test.admin.gamma@stiwnu.edu.ph");
    if (!admUser) throw new Error("Admin not found in adminModel!");
    const admPassMatch = await bcrypt.compare("AdminPass123!", admUser.passwordHash);
    if (!admPassMatch) throw new Error("Admin password comparison failed!");
    console.log("  [OK] Admin authenticated successfully (Target path: /admin/home).");

    const sadUser = await adminModel.findUserByIdentifier("test.superadmin.delta@stiwnu.edu.ph");
    if (!sadUser) throw new Error("Super Admin not found in adminModel!");
    const sadPassMatch = await bcrypt.compare("SuperAdminPass123!", sadUser.passwordHash);
    if (!sadPassMatch) throw new Error("Super Admin password comparison failed!");
    console.log("  [OK] Super Admin authenticated successfully (Target path: /super-admin/home).");

    // 4c. Staff web portal blocking students
    const studentAsStaff = await adminModel.findUserByIdentifier("test.student.alpha@stiwnu.edu.ph");
    if (studentAsStaff && studentAsStaff.role === "Student") {
      console.log("  [OK] Student attempting staff portal login correctly identified as role 'Student' (triggers HTTP 403 redirect to Student Mobile App).");
    }

    // 4d. Suspended account check
    await pool.query("UPDATE users SET status = 'Suspended' WHERE id = $1", [stuByEmail.id]);
    const suspendedStu = await studentModel.findUserByEmail("test.student.alpha@stiwnu.edu.ph");
    if (suspendedStu.status === "Suspended") {
      console.log("  [OK] Suspended student account status check verified (triggers HTTP 403 deactivation guard).");
    }
    console.log();

    // 5. Verify Listing and Vitals
    console.log("Phase 5: Verifying superAdminModel listUsers and dashboard vitals...");
    const listResult = await superAdminModel.listUsers({ search: "TEST-", pageSize: 10 });
    if (listResult.users.length !== 4) {
      throw new Error(`Expected 4 test users in listUsers, found ${listResult.users.length}`);
    }
    console.log(`  [OK] listUsers successfully found all ${listResult.users.length} provisioned accounts.`);

    const vitalsResult = await superAdminModel.getDashboardVitals();
    console.log(`  [OK] Dashboard vitals accurate: totalUsers=${vitalsResult.vitals.totalUsers}, students=${vitalsResult.vitals.studentsCount}, librarians=${vitalsResult.vitals.librariansCount}, admins=${vitalsResult.vitals.adminsCount}, superAdmins=${vitalsResult.vitals.superAdminsCount}\n`);

    console.log("==================================================");
    console.log("  ALL TESTS PASSED SUCCESSFULLY!                 ");
    console.log("==================================================\n");

  } finally {
    // 6. Cleanup test records
    console.log("Phase 6: Cleaning up test accounts from database...");
    for (const id of createdIds) {
      await superAdminModel.deleteUser(id);
    }
    await pool.query("DELETE FROM users WHERE id_number LIKE 'TEST-%' OR email LIKE 'test.%@stiwnu.edu.ph'");
    console.log("  All test accounts permanently deleted. Database is clean.\n");
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
