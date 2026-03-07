import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpServer } from "http";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("tasks.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

// Migration: Add due_date if it doesn't exist (for existing databases)
const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
const hasDueDate = tableInfo.some((col: any) => col.name === 'due_date');

if (!hasDueDate) {
  try {
    db.exec("ALTER TABLE tasks ADD COLUMN due_date TEXT");
    console.log("Migration: Added due_date column to tasks table.");
  } catch (e) {
    console.error("Migration failed:", e);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  app.use(express.json());

  // Broadcast to all clients
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    const tasksWithSubtasks = tasks.map((task: any) => {
      const subtasks = db.prepare("SELECT * FROM subtasks WHERE task_id = ?").all(task.id);
      return { ...task, subtasks };
    });
    res.json(tasksWithSubtasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { id, title, description, priority, due_date } = req.body;
    db.prepare("INSERT INTO tasks (id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)")
      .run(id, title, description, priority, due_date);
    
    const newTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    (newTask as any).subtasks = [];
    
    broadcast({ type: 'TASK_CREATED', payload: newTask });
    res.status(201).json(newTask);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { status, priority, due_date } = req.body;
    
    if (status) {
      db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
    }
    if (priority) {
      db.prepare("UPDATE tasks SET priority = ? WHERE id = ?").run(priority, id);
    }
    if (due_date !== undefined) {
      db.prepare("UPDATE tasks SET due_date = ? WHERE id = ?").run(due_date, id);
    }

    broadcast({ type: 'TASK_UPDATED', payload: { id, status, priority, due_date } });
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    broadcast({ type: 'TASK_DELETED', payload: id });
    res.json({ success: true });
  });

  app.post("/api/ai/breakdown", async (req, res) => {
    const { title, description } = req.body;
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp", // Using a stable model name
        contents: `Break down this task into 3-5 actionable sub-tasks. Return ONLY a JSON array of strings. 
        Task: ${title}
        Description: ${description}`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const subtasks = JSON.parse(response.text || "[]");
      res.json({ subtasks });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate sub-tasks" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
