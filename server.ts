import { createClient } from "@supabase/supabase-js";
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createHttpServer } from "http";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

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
  app.get("/api/tasks", async (req, res) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

  app.post("/api/tasks", async (req, res) => {
  const { id, title, description, priority, due_date } = req.body;

  const { data, error } = await supabase
    .from("tasks")
    .insert([{ id, title, description, priority, due_date }])
    .select();

  if (error) return res.status(500).json(error);

  broadcast({ type: "TASK_CREATED", payload: data[0] }); // 👈 add this

  res.status(201).json(data);
});

  app.patch("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("tasks")
    .update(req.body)
    .eq("id", id);

  if (error) return res.status(500).json(error);

  broadcast({ type: "TASK_UPDATED", payload: { id, ...req.body } }); // 👈 add

  res.json({ success: true });
});

  app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  broadcast({ type: "TASK_DELETED", payload: id }); // 👈 add this

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
