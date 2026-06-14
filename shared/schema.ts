import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Briefings table
export const briefings = sqliteTable("briefings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  passingScore: integer("passing_score").notNull().default(70), // % to pass
  itemType: text("item_type").notNull().default("briefing"), // "briefing" | "lesson"
});

// Personnel table
export const personnel = sqliteTable("personnel", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rank: text("rank").notNull().default(""),
  unit: text("unit").notNull().default(""),
  briefingId: integer("briefing_id").notNull(),
  accessToken: text("access_token").notNull().default(""),
});

// Questions table
export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  briefingId: integer("briefing_id").notNull(),
  text: text("text").notNull(),
  type: text("type").notNull().default("single"), // "single" | "multiple"
  options: text("options").notNull().default("[]"), // JSON array of {id, text}
  correctOptions: text("correct_options").notNull().default("[]"), // JSON array of option ids
  orderIndex: integer("order_index").notNull().default(0),
});

// Test results table
export const testResults = sqliteTable("test_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personnelId: integer("personnel_id").notNull(),
  briefingId: integer("briefing_id").notNull(),
  score: integer("score").notNull().default(0), // percentage 0-100
  correctCount: integer("correct_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  answers: text("answers").notNull().default("[]"), // JSON [{questionId, selectedOptions}]
  attemptNumber: integer("attempt_number").notNull().default(1),
  completedAt: text("completed_at").notNull().default(""),
});

// Insert schemas
export const insertBriefingSchema = createInsertSchema(briefings).omit({ id: true });
export const insertPersonnelSchema = createInsertSchema(personnel).omit({ id: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });
export const insertTestResultSchema = createInsertSchema(testResults).omit({ id: true });

// Types
export type InsertBriefing = z.infer<typeof insertBriefingSchema>;
export type Briefing = typeof briefings.$inferSelect;
export type InsertPersonnel = z.infer<typeof insertPersonnelSchema>;
export type Personnel = typeof personnel.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
export type TestResult = typeof testResults.$inferSelect;

// Extended types
export type QuestionOption = { id: string; text: string };
export type QuestionWithParsed = Question & {
  parsedOptions: QuestionOption[];
  parsedCorrect: string[];
};

export type PersonnelWithStatus = Personnel & {
  acknowledged: boolean;
  acknowledgedAt?: string;
  testPassed?: boolean;
  testScore?: number;
  testAttempts?: number;
};

export type BriefingWithStats = Briefing & {
  totalPersonnel: number;
  acknowledgedCount: number;
  allAcknowledged: boolean;
  questionCount: number;
  passedCount: number;
};
