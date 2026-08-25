import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("dev.sqlite");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", JSON.stringify(tables));
try {
  const users = db.prepare("SELECT id, name, email, role, permissions FROM user").all();
  console.log("Users:", JSON.stringify(users, null, 2));
} catch (e) {
  console.log("No user table:", e.message);
}
db.close();
