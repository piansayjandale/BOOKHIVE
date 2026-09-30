import { pool } from "../src/db/pool.js";

async function run() {
  try {
    // 1. Inspect users and courses
    const users = await pool.query(`
      SELECT id, name, id_number, role, department, course 
      FROM users 
      LIMIT 20;
    `);
    console.log("USERS COUNT:", users.rows.length);
    console.log("SAMPLE USERS:", users.rows);

    const userCourses = await pool.query(`
      SELECT course, count(*)::int as count 
      FROM users 
      GROUP BY course 
      ORDER BY count DESC;
    `);
    console.log("USER COURSES:", userCourses.rows);

    // 2. Inspect transactions joined with users
    const txByCourse = await pool.query(`
      SELECT 
        COALESCE(u.course, 'General Education') as course,
        COUNT(*)::int as borrow_count
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id OR t.student_id = u.id_number
      GROUP BY 1
      ORDER BY borrow_count DESC;
    `);
    console.log("TRANSACTIONS BY COURSE:", txByCourse.rows);

    const txDetails = await pool.query(`
      SELECT t.id, t.student_name, t.student_id, t.resource_title, t.department, t.type, t.status, u.course
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id OR t.student_id = u.id_number;
    `);
    console.log("ALL TRANSACTIONS WITH COURSE:", txDetails.rows);

    // 3. Inspect search logs or searches
    const aiSearchLogs = await pool.query(`
      SELECT * FROM ai_search_logs LIMIT 20;
    `);
    console.log("AI SEARCH LOGS COUNT:", aiSearchLogs.rows.length);
    console.log("AI SEARCH LOGS:", aiSearchLogs.rows);

    // 4. Inspect history logs for search or views
    const historySearch = await pool.query(`
      SELECT * FROM history_logs 
      WHERE action ILIKE '%search%' OR module ILIKE '%search%' OR target ILIKE '%search%' OR detail ILIKE '%search%'
      LIMIT 20;
    `);
    console.log("HISTORY SEARCH LOGS:", historySearch.rows);

    // 5. Inspect activity logs
    const activitySearch = await pool.query(`
      SELECT * FROM activity_logs
      WHERE category ILIKE '%search%' OR message ILIKE '%search%'
      LIMIT 20;
    `);
    console.log("ACTIVITY SEARCH LOGS:", activitySearch.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
