import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

async function setup() {
  console.log("=== BookHive PostgreSQL Database Setup ===");

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

    // Check if bookhive database exists
    const checkDbRes = await serverClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'bookhive'"
    );

    if (checkDbRes.rows.length === 0) {
      console.log("Creating database 'bookhive'...");
      await serverClient.query("CREATE DATABASE bookhive");
      console.log("✓ Database 'bookhive' created successfully.");
    } else {
      console.log("✓ Database 'bookhive' already exists.");
    }
  } catch (err) {
    console.error("Failed to connect or create database:", err.message);
    process.exit(1);
  } finally {
    await serverClient.end();
  }

  // 2. Connect to bookhive database and run schema
  const dbClient = new Client({
    user: pgUser,
    host: pgHost,
    password: pgPassword,
    port: pgPort,
    database: process.env.PGDATABASE || 'bookhive',
  });

  try {
    await dbClient.connect();
    console.log("✓ Connected to database 'bookhive'");

    const schemaPath = path.join(__dirname, '../db/schema.sql');
    console.log(`Reading schema from ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Applying schema...");
    await dbClient.query(schemaSql);
    console.log("✓ PostgreSQL schema and tables applied successfully.");

    // 3. Seed core staff accounts
    console.log("Seeding core staff accounts...");
    const coreUsers = [
      {
        name: "Super Administrator",
        email: "superadmin@stiwnu.edu.ph",
        role: "Super Admin",
        password: "BookHiveSuperAdmin!2026",
        idNumber: "SUP-2026-0001",
        department: "Executive System Governance",
        course: "Platform Infrastructure",
      },
      {
        name: "Library Administrator",
        email: "admin@stiwnu.edu.ph",
        role: "Admin",
        password: "BookHiveAdmin!2026",
        idNumber: "ADM-2026-0001",
        department: "Library Administration",
        course: "Library Administration",
      },
      {
        name: "Yana Brich R. Palmares",
        email: "librarian@stiwnu.edu.ph",
        role: "Librarian",
        password: "BookHiveLibrarian!2026",
        idNumber: "LIB-2026-0001",
        department: "Library Services",
        course: "Library Services",
      },
    ];

    for (const u of coreUsers) {
      const existing = await dbClient.query("SELECT id FROM users WHERE email = $1", [u.email]);
      if (existing.rows.length === 0) {
        const passwordHash = await bcrypt.hash(u.password, 10);
        const insertRes = await dbClient.query(`
          INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
          RETURNING id
        `, [u.name, u.idNumber, u.email, passwordHash, u.role, u.department, u.course]);
        console.log(`✓ Created account: ${u.name} (${u.role}) -> ${u.email}`);
      } else {
        console.log(`✓ Account already exists: ${u.email}`);
      }
    }

    console.log("\n=============================================");
    console.log("🎉 Database setup complete! PostgreSQL is READY!");
    console.log("=============================================");
  } catch (err) {
    console.error("Schema initialization error:", err);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

setup();
