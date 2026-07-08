import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookhive';
const client = new Client({ connectionString });

const DEV_CREDENTIALS = [
  {
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
    department: "Library Administration",
    course: "Library Administration",
  },
  {
    name: "Joseph Tan",
    email: "joseph.tan@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-002",
    department: "Library",
    course: "Library Services",
  }
];

async function run() {
  try {
    console.log(`Connecting to PostgreSQL database at ${connectionString.split('@')[1] || connectionString}...`);
    await client.connect();

    // 1. Run schema.sql
    const sqlPath = path.join(__dirname, '../db/schema.sql');
    console.log(`Reading schema from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Initializing database schema...");
    await client.query(sql);
    console.log("PostgreSQL schema initialized successfully.");

    // 2. Seed initial admin and librarian users
    console.log("Seeding default administrative users...");
    for (const cred of DEV_CREDENTIALS) {
      // Check if user already exists
      const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [cred.email]);
      if (checkRes.rows.length === 0) {
        const passwordHash = await bcrypt.hash(cred.password, 10);
        const query = `
          INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
          RETURNING id
        `;
        const insertRes = await client.query(query, [
          cred.name,
          cred.idNumber,
          cred.email,
          passwordHash,
          cred.role,
          cred.department,
          cred.course
        ]);
        console.log(`Created user: ${cred.name} (${cred.role}) with ID ${insertRes.rows[0].id}`);
      } else {
        console.log(`User ${cred.email} already exists. Skipping.`);
      }
    }

    console.log("Database initialization and seeding completed successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
