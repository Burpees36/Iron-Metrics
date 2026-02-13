import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, date, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

export const gyms = pgTable("gyms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gymsRelations = relations(gyms, ({ one, many }) => ({
  owner: one(users, { fields: [gyms.ownerId], references: [users.id] }),
  members: many(members),
  monthlyMetrics: many(gymMonthlyMetrics),
}));

export const insertGymSchema = createInsertSchema(gyms).omit({ id: true, createdAt: true });
export type InsertGym = z.infer<typeof insertGymSchema>;
export type Gym = typeof gyms.$inferSelect;

export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  name: text("name").notNull(),
  email: text("email"),
  status: text("status").notNull().default("active"),
  joinDate: date("join_date").notNull(),
  cancelDate: date("cancel_date"),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
}, (table) => [
  index("idx_members_gym_id").on(table.gymId),
  index("idx_members_status").on(table.status),
]);

export const membersRelations = relations(members, ({ one }) => ({
  gym: one(gyms, { fields: [members.gymId], references: [gyms.id] }),
}));

export const insertMemberSchema = createInsertSchema(members).omit({ id: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

export const memberContacts = pgTable("member_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => members.id),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  contactedAt: timestamp("contacted_at").defaultNow(),
  note: text("note"),
}, (table) => [
  index("idx_member_contacts_member").on(table.memberId),
  index("idx_member_contacts_gym").on(table.gymId),
]);

export const memberContactsRelations = relations(memberContacts, ({ one }) => ({
  member: one(members, { fields: [memberContacts.memberId], references: [members.id] }),
  gym: one(gyms, { fields: [memberContacts.gymId], references: [gyms.id] }),
}));

export const insertMemberContactSchema = createInsertSchema(memberContacts).omit({ id: true, contactedAt: true });
export type InsertMemberContact = z.infer<typeof insertMemberContactSchema>;
export type MemberContact = typeof memberContacts.$inferSelect;

export const importJobs = pgTable("import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  uploadedBy: varchar("uploaded_by").notNull(),
  filename: text("filename").notNull(),
  fileHash: text("file_hash").notNull(),
  rawCsv: text("raw_csv").notNull(),
  columnMapping: text("column_mapping"),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errors: text("errors"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_import_jobs_gym").on(table.gymId),
  index("idx_import_jobs_hash").on(table.fileHash),
]);

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  gym: one(gyms, { fields: [importJobs.gymId], references: [gyms.id] }),
}));

export const insertImportJobSchema = createInsertSchema(importJobs).omit({ id: true, createdAt: true, completedAt: true });
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

export const gymMonthlyMetrics = pgTable("gym_monthly_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  monthStart: date("month_start").notNull(),
  activeMembers: integer("active_members").notNull().default(0),
  activeStartOfMonth: integer("active_start_of_month").notNull().default(0),
  newMembers: integer("new_members").notNull().default(0),
  cancels: integer("cancels").notNull().default(0),
  churnRate: numeric("churn_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  rollingChurn3m: numeric("rolling_churn_3m", { precision: 5, scale: 2 }),
  mrr: numeric("mrr", { precision: 12, scale: 2 }).notNull().default("0"),
  arm: numeric("arm", { precision: 10, scale: 2 }).notNull().default("0"),
  ltv: numeric("ltv", { precision: 12, scale: 2 }).notNull().default("0"),
  rsi: integer("rsi").notNull().default(0),
  res: numeric("res", { precision: 5, scale: 1 }).notNull().default("0"),
  ltveImpact: numeric("ltve_impact", { precision: 12, scale: 2 }).notNull().default("0"),
  memberRiskCount: integer("member_risk_count").notNull().default(0),
  generatedAt: timestamp("generated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_gym_month").on(table.gymId, table.monthStart),
]);

export const gymMonthlyMetricsRelations = relations(gymMonthlyMetrics, ({ one }) => ({
  gym: one(gyms, { fields: [gymMonthlyMetrics.gymId], references: [gyms.id] }),
}));

export const insertGymMonthlyMetricsSchema = createInsertSchema(gymMonthlyMetrics).omit({ id: true, generatedAt: true });
export type InsertGymMonthlyMetrics = z.infer<typeof insertGymMonthlyMetricsSchema>;
export type GymMonthlyMetrics = typeof gymMonthlyMetrics.$inferSelect;
