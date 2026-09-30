import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

async function initBookhive2nd() {
  console.log("==================================================");
  console.log("Creating dedicated database 'bookhive_2nd' for BOOKHIVE-2nd");
  console.log("==================================================");

  const pgHost = process.env.PGHOST || '127.0.0.1';
  const pgPort = Number(process.env.PGPORT || 5432);
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD || 'postgres';

  // 1. Connect to PostgreSQL server
  const serverClient = new Client({
    user: pgUser,
    host: pgHost,
    password: pgPassword,
    port: pgPort,
    database: 'postgres',
  });

  try {
    await serverClient.connect();
    console.log(`✓ Connected to PostgreSQL server on ${pgHost}:${pgPort}`);

    // Check if bookhive_2nd database exists
    const checkDbRes = await serverClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'bookhive_2nd'"
    );

    if (checkDbRes.rows.length === 0) {
      console.log("Creating database 'bookhive_2nd'...");
      await serverClient.query("CREATE DATABASE bookhive_2nd");
      console.log("✓ Database 'bookhive_2nd' created successfully!");
    } else {
      console.log("✓ Database 'bookhive_2nd' already exists.");
    }
  } catch (err) {
    console.error("Failed to connect or create database:", err.message);
    process.exit(1);
  } finally {
    await serverClient.end();
  }

  // 2. Connect to bookhive_2nd database and apply schema
  const dbClient = new Client({
    user: pgUser,
    host: pgHost,
    password: pgPassword,
    port: pgPort,
    database: process.env.PGDATABASE || 'bookhive_2nd',
  });

  try {
    await dbClient.connect();
    console.log("✓ Connected to database 'bookhive_2nd'");

    const schemaPath = path.join(__dirname, '../db/schema.sql');
    console.log(`Reading schema from ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Applying schema to 'bookhive_2nd'...");
    await dbClient.query(schemaSql);
    console.log("✓ PostgreSQL schema and tables applied successfully to 'bookhive_2nd'.");

    // 3. Seed initial staff accounts in bookhive_2nd
    console.log("Seeding staff accounts in 'bookhive_2nd'...");
    const superPass = await bcrypt.hash("BookHiveSuperAdmin!2026", 10);
    const adminPass = await bcrypt.hash("BookHiveAdmin!2026", 10);
    const libPass = await bcrypt.hash("BookHiveLibrarian!2026", 10);

    const initialUsers = [
      {
        name: "Super Administrator",
        email: "superadmin@stiwnu.edu.ph",
        idNumber: "SUP-2026-0001",
        passwordHash: superPass,
        role: "Super Admin",
        department: "Executive System Governance",
        course: "Platform Infrastructure",
      },
      {
        name: "Yana Palmares",
        email: "admin@stiwnu.edu.ph",
        idNumber: "ADM-2026-0001",
        passwordHash: adminPass,
        role: "Admin",
        department: "Library Administration",
        course: "Library Administration",
      },
      {
        name: "Yana Brich R. Palmares",
        email: "librarian@stiwnu.edu.ph",
        idNumber: "LIB-2026-0001",
        passwordHash: libPass,
        role: "Librarian",
        department: "Circulation",
        course: "Library Services",
      },
    ];

    for (const u of initialUsers) {
      const existing = await dbClient.query("SELECT id FROM users WHERE email = $1", [u.email]);
      if (existing.rows.length === 0) {
        const res = await dbClient.query(`
          INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
          RETURNING id
        `, [u.name, u.idNumber, u.email, u.passwordHash, u.role, u.department, u.course]);
        console.log(`✓ Created user: ${u.name} (${u.role}) -> ${u.email}`);
      } else {
        console.log(`✓ User ${u.email} already exists.`);
      }
    }

    const res = await dbClient.query("SELECT id, name, email, id_number, role, status FROM users");
    console.log("\nUsers in 'bookhive_2nd':");
    console.table(res.rows);

    console.log("\n==================================================");
    console.log("🎉 'bookhive_2nd' database setup complete!");
    console.log("==================================================");
  } catch (err) {
    console.error("Initialization error:", err);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

initBookhive2nd();
