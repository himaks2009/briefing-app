import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBriefingSchema, insertPersonnelSchema, insertQuestionSchema } from "@shared/schema";
import { z } from "zod";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "briefing-admin-2026";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-admin-secret"] as string | undefined;
  if (header === ADMIN_SECRET) return next();
  return res.status(401).json({ error: "Доступ заборонено" });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // === BRIEFINGS ===
  app.get("/api/briefings", (req, res) => {
    const itemType = req.query.type as string | undefined;
    res.json(storage.getBriefings(itemType));
  });

  app.get("/api/briefings/:id", (req, res) => {
    const b = storage.getBriefing(parseInt(req.params.id));
    if (!b) return res.status(404).json({ error: "Не знайдено" });
    res.json(b);
  });

  app.post("/api/briefings", requireAdmin, (req, res) => {
    const parsed = insertBriefingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createBriefing(parsed.data));
  });

  app.patch("/api/briefings/:id", requireAdmin, (req, res) => {
    const b = storage.updateBriefing(parseInt(req.params.id), req.body);
    if (!b) return res.status(404).json({ error: "Не знайдено" });
    res.json(b);
  });

  app.delete("/api/briefings/:id", requireAdmin, (req, res) => {
    storage.deleteBriefing(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === PERSONNEL ===
  app.get("/api/briefings/:id/personnel", (req, res) => {
    const list = storage.getPersonnelByBriefing(parseInt(req.params.id));
    res.json(list.map(({ accessToken: _t, ...p }) => p));
  });

  app.get("/api/briefings/:id/personnel/tokens", requireAdmin, (req, res) => {
    res.json(storage.getPersonnelByBriefing(parseInt(req.params.id)));
  });

  app.post("/api/briefings/:id/personnel", requireAdmin, (req, res) => {
    const parsed = insertPersonnelSchema.safeParse({ ...req.body, briefingId: parseInt(req.params.id) });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.addPersonnel(parsed.data));
  });

  app.patch("/api/personnel/:id", requireAdmin, (req, res) => {
    const p = storage.updatePersonnel(parseInt(req.params.id), req.body);
    if (!p) return res.status(404).json({ error: "Не знайдено" });
    res.json(p);
  });

  app.delete("/api/personnel/:id", requireAdmin, (req, res) => {
    storage.deletePersonnel(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/briefings/:id/personnel/bulk", requireAdmin, (req, res) => {
    const schema = z.array(z.object({
      name: z.string(),
      rank: z.string().optional().default(""),
      unit: z.string().optional().default(""),
    }));
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const items = parsed.data.map(p => ({ ...p, briefingId: parseInt(req.params.id), rank: p.rank ?? "", unit: p.unit ?? "" }));
    res.json(storage.bulkAddPersonnel(items));
  });

  // === QUESTIONS ===
  app.get("/api/briefings/:id/questions", (req, res) => {
    // Public: return questions without correct answers (for taking the test)
    const qs = storage.getQuestions(parseInt(req.params.id));
    res.json(qs.map(q => ({ ...q, parsedCorrect: undefined, correctOptions: undefined })));
  });

  app.get("/api/briefings/:id/questions/admin", requireAdmin, (req, res) => {
    res.json(storage.getQuestions(parseInt(req.params.id)));
  });

  app.post("/api/briefings/:id/questions", requireAdmin, (req, res) => {
    const parsed = insertQuestionSchema.safeParse({ ...req.body, briefingId: parseInt(req.params.id) });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.addQuestion(parsed.data));
  });

  app.patch("/api/questions/:id", requireAdmin, (req, res) => {
    const q = storage.updateQuestion(parseInt(req.params.id), req.body);
    if (!q) return res.status(404).json({ error: "Не знайдено" });
    res.json(q);
  });

  app.delete("/api/questions/:id", requireAdmin, (req, res) => {
    storage.deleteQuestion(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // === TEST SUBMISSION ===
  app.post("/api/briefings/:briefingId/submit", (req, res) => {
    const briefingId = parseInt(req.params.briefingId);
    const schema = z.object({
      personnelId: z.number(),
      accessToken: z.string(),
      answers: z.array(z.object({
        questionId: z.number(),
        selectedOptions: z.array(z.string()),
      })),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { personnelId, accessToken, answers } = parsed.data;

    // Validate token
    const allPersonnel = storage.getPersonnelByBriefing(briefingId);
    const person = allPersonnel.find(p => p.id === personnelId);
    if (!person) return res.status(404).json({ error: "Особу не знайдено" });
    if (person.accessToken !== accessToken) return res.status(403).json({ error: "Невірний токен" });

    const briefing = storage.getBriefing(briefingId);
    if (!briefing) return res.status(404).json({ error: "Інструктаж не знайдено" });

    // Grade the test
    const qs = storage.getQuestions(briefingId);
    let correct = 0;
    for (const q of qs) {
      const answer = answers.find(a => a.questionId === q.id);
      if (!answer) continue;
      const selected = new Set(answer.selectedOptions);
      const correctSet = new Set(q.parsedCorrect);
      if (selected.size === correctSet.size && [...selected].every(s => correctSet.has(s))) {
        correct++;
      }
    }

    const total = qs.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= briefing.passingScore;

    const result = storage.submitTestResult({
      personnelId,
      briefingId,
      score,
      correctCount: correct,
      totalCount: total,
      passed,
      answers: JSON.stringify(answers),
      attemptNumber: 1,
      completedAt: "",
    });

    res.json({ ok: true, score, correct, total, passed, passingScore: briefing.passingScore, result });
  });

  // === RESULTS (admin) ===
  app.get("/api/briefings/:id/results", requireAdmin, (req, res) => {
    res.json(storage.getTestResults(parseInt(req.params.id)));
  });

  return httpServer;
}
