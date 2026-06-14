import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  briefings, personnel, questions, testResults,
  type Briefing, type InsertBriefing,
  type Personnel, type InsertPersonnel,
  type Question, type InsertQuestion,
  type TestResult, type InsertTestResult,
  type PersonnelWithStatus, type BriefingWithStats,
  type QuestionWithParsed,
} from "@shared/schema";

function generateToken(): string {
  return randomBytes(16).toString("hex");
}

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    passing_score INTEGER NOT NULL DEFAULT 70
  );

  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rank TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '',
    briefing_id INTEGER NOT NULL,
    access_token TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    briefing_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'single',
    options TEXT NOT NULL DEFAULT '[]',
    correct_options TEXT NOT NULL DEFAULT '[]',
    order_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    briefing_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    answers TEXT NOT NULL DEFAULT '[]',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    completed_at TEXT NOT NULL DEFAULT ''
  );
`);

// Add passing_score column if upgrading from old DB
try { sqlite.exec(`ALTER TABLE briefings ADD COLUMN passing_score INTEGER NOT NULL DEFAULT 70`); } catch {}
// Add access_token column if upgrading
try { sqlite.exec(`ALTER TABLE personnel ADD COLUMN access_token TEXT NOT NULL DEFAULT ''`); } catch {}
// Add item_type column if upgrading
try { sqlite.exec(`ALTER TABLE briefings ADD COLUMN item_type TEXT NOT NULL DEFAULT 'briefing'`); } catch {}

export interface IStorage {
  getBriefings(itemType?: string): BriefingWithStats[];
  getBriefing(id: number): Briefing | undefined;
  createBriefing(data: InsertBriefing): Briefing;
  updateBriefing(id: number, data: Partial<InsertBriefing>): Briefing | undefined;
  deleteBriefing(id: number): void;

  getPersonnelByBriefing(briefingId: number): PersonnelWithStatus[];
  addPersonnel(data: InsertPersonnel): Personnel;
  updatePersonnel(id: number, data: Partial<InsertPersonnel>): Personnel | undefined;
  deletePersonnel(id: number): void;
  bulkAddPersonnel(items: InsertPersonnel[]): Personnel[];

  getQuestions(briefingId: number): QuestionWithParsed[];
  addQuestion(data: InsertQuestion): Question;
  updateQuestion(id: number, data: Partial<InsertQuestion>): Question | undefined;
  deleteQuestion(id: number): void;
  reorderQuestions(briefingId: number, orderedIds: number[]): void;

  submitTestResult(data: InsertTestResult): TestResult;
  getTestResults(briefingId: number): (TestResult & { personnelName: string; personnelRank: string })[];
  getLatestResult(personnelId: number, briefingId: number): TestResult | undefined;
  getAttemptCount(personnelId: number, briefingId: number): number;
}

export class SQLiteStorage implements IStorage {
  getBriefings(itemType?: string): BriefingWithStats[] {
    const all = db.select().from(briefings).all();
    const filtered = itemType ? all.filter(b => b.itemType === itemType) : all;
    return filtered.map((b) => {
      const persons = db.select().from(personnel).where(eq(personnel.briefingId, b.id)).all();
      const qs = db.select().from(questions).where(eq(questions.briefingId, b.id)).all();
      const results = db.select().from(testResults).where(eq(testResults.briefingId, b.id)).all();
      // Count unique personnel who passed
      const passedPersonnelIds = new Set(results.filter(r => r.passed).map(r => r.personnelId));
      // Count unique personnel who completed (any result)
      const completedIds = new Set(results.map(r => r.personnelId));
      return {
        ...b,
        totalPersonnel: persons.length,
        acknowledgedCount: completedIds.size,
        allAcknowledged: persons.length > 0 && completedIds.size >= persons.length,
        questionCount: qs.length,
        passedCount: passedPersonnelIds.size,
      };
    });
  }

  getBriefing(id: number): Briefing | undefined {
    return db.select().from(briefings).where(eq(briefings.id, id)).get();
  }

  createBriefing(data: InsertBriefing): Briefing {
    return db.insert(briefings).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  updateBriefing(id: number, data: Partial<InsertBriefing>): Briefing | undefined {
    return db.update(briefings).set(data).where(eq(briefings.id, id)).returning().get();
  }

  deleteBriefing(id: number): void {
    db.delete(testResults).where(eq(testResults.briefingId, id)).run();
    db.delete(questions).where(eq(questions.briefingId, id)).run();
    db.delete(personnel).where(eq(personnel.briefingId, id)).run();
    db.delete(briefings).where(eq(briefings.id, id)).run();
  }

  getPersonnelByBriefing(briefingId: number): PersonnelWithStatus[] {
    const persons = db.select().from(personnel).where(eq(personnel.briefingId, briefingId)).all();
    return persons.map((p) => {
      const latest = db.select().from(testResults)
        .where(and(eq(testResults.personnelId, p.id), eq(testResults.briefingId, briefingId)))
        .all()
        .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      const attempts = db.select().from(testResults)
        .where(and(eq(testResults.personnelId, p.id), eq(testResults.briefingId, briefingId)))
        .all().length;
      return {
        ...p,
        acknowledged: !!latest,
        acknowledgedAt: latest?.completedAt,
        testPassed: latest?.passed ?? false,
        testScore: latest?.score ?? undefined,
        testAttempts: attempts,
      };
    });
  }

  addPersonnel(data: InsertPersonnel): Personnel {
    return db.insert(personnel).values({ ...data, accessToken: generateToken() }).returning().get();
  }

  updatePersonnel(id: number, data: Partial<InsertPersonnel>): Personnel | undefined {
    return db.update(personnel).set(data).where(eq(personnel.id, id)).returning().get();
  }

  deletePersonnel(id: number): void {
    db.delete(testResults).where(eq(testResults.personnelId, id)).run();
    db.delete(personnel).where(eq(personnel.id, id)).run();
  }

  bulkAddPersonnel(items: InsertPersonnel[]): Personnel[] {
    return items.map(item => db.insert(personnel).values({ ...item, accessToken: generateToken() }).returning().get());
  }

  getQuestions(briefingId: number): QuestionWithParsed[] {
    const qs = db.select().from(questions).where(eq(questions.briefingId, briefingId)).all()
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return qs.map(q => ({
      ...q,
      parsedOptions: JSON.parse(q.options || "[]"),
      parsedCorrect: JSON.parse(q.correctOptions || "[]"),
    }));
  }

  addQuestion(data: InsertQuestion): Question {
    const existing = db.select().from(questions).where(eq(questions.briefingId, data.briefingId)).all();
    return db.insert(questions).values({ ...data, orderIndex: existing.length }).returning().get();
  }

  updateQuestion(id: number, data: Partial<InsertQuestion>): Question | undefined {
    return db.update(questions).set(data).where(eq(questions.id, id)).returning().get();
  }

  deleteQuestion(id: number): void {
    db.delete(questions).where(eq(questions.id, id)).run();
  }

  reorderQuestions(briefingId: number, orderedIds: number[]): void {
    orderedIds.forEach((id, idx) => {
      db.update(questions).set({ orderIndex: idx }).where(eq(questions.id, id)).run();
    });
  }

  submitTestResult(data: InsertTestResult): TestResult {
    const attempts = this.getAttemptCount(data.personnelId, data.briefingId);
    return db.insert(testResults).values({
      ...data,
      attemptNumber: attempts + 1,
      completedAt: new Date().toISOString(),
    }).returning().get();
  }

  getTestResults(briefingId: number): (TestResult & { personnelName: string; personnelRank: string })[] {
    const results = db.select().from(testResults).where(eq(testResults.briefingId, briefingId)).all();
    return results.map(r => {
      const p = db.select().from(personnel).where(eq(personnel.id, r.personnelId)).get();
      return { ...r, personnelName: p?.name ?? "—", personnelRank: p?.rank ?? "" };
    }).sort((a, b) => b.attemptNumber - a.attemptNumber);
  }

  getLatestResult(personnelId: number, briefingId: number): TestResult | undefined {
    return db.select().from(testResults)
      .where(and(eq(testResults.personnelId, personnelId), eq(testResults.briefingId, briefingId)))
      .all()
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  }

  getAttemptCount(personnelId: number, briefingId: number): number {
    return db.select().from(testResults)
      .where(and(eq(testResults.personnelId, personnelId), eq(testResults.briefingId, briefingId)))
      .all().length;
  }
}

export const storage = new SQLiteStorage();
