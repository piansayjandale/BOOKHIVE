import { studentModel } from "./src/models/student.model.js";

async function test() {
  try {
    console.log("Testing searchBooks with studentModel...");
    const query = "Find me a book that is about mathematics";
    const res = await studentModel.searchBooks(query, 1, 10);
    console.log("Found books count:", res.books.length);
    res.books.forEach(b => {
      console.log(`- Title: ${b.title}, Author: ${b.author}`);
    });
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
