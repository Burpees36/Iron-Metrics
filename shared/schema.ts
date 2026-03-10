import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, date, timestamp, uniqueIndex, index, jsonb, boolean, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value === "string") {
      return value.replace(/[\[\]]/g, "").split(",").map(Number);
    }
    return value as unknown as number[];
  },
});

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
  staff: many(gymStaff),
}));

export const insertGymSchema = createInsertSchema(gyms).omit({ id: true, createdAt: true });
export type InsertGym = z.infer<typeof insertGymSchema>;
export type Gym = typeof gyms.$inferSelect;

export const GYM_STAFF_ROLES = ["owner", "admin", "coach"] as const;
export type GymStaffRole = typeof GYM_STAFF_ROLES[number];

export const gymStaff = pgTable("gym_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_gym_staff_unique").on(table.gymId, table.userId),
  index("idx_gym_staff_user").on(table.userId),
]);

export const gymStaffRelations = relations(gymStaff, ({ one }) => ({
  gym: one(gyms, { fields: [gymStaff.gymId], references: [gyms.id] }),
  user: one(users, { fields: [gymStaff.userId], references: [users.id] }),
}));

export const insertGymStaffSchema = createInsertSchema(gymStaff).omit({ id: true, createdAt: true });
export type InsertGymStaff = z.infer<typeof insertGymStaffSchema>;
export type GymStaff = typeof gymStaff.$inferSelect;

export const INVITE_STATUSES = ["pending", "accepted", "expired", "cancelled"] as const;
export type InviteStatus = typeof INVITE_STATUSES[number];

export const staffInvites = pgTable("staff_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_staff_invites_token").on(table.token),
  index("idx_staff_invites_email").on(table.email),
  index("idx_staff_invites_gym").on(table.gymId),
]);

export const staffInvitesRelations = relations(staffInvites, ({ one }) => ({
  gym: one(gyms, { fields: [staffInvites.gymId], references: [gyms.id] }),
  inviter: one(users, { fields: [staffInvites.invitedBy], references: [users.id] }),
}));

export const insertStaffInviteSchema = createInsertSchema(staffInvites).omit({ id: true, createdAt: true });
export type InsertStaffInvite = z.infer<typeof insertStaffInviteSchema>;
export type StaffInvite = typeof staffInvites.$inferSelect;

export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  name: text("name").notNull(),
  email: text("email"),
  status: text("status").notNull().default("active"),
  joinDate: date("join_date").notNull(),
  cancelDate: date("cancel_date"),
  lastAttendedDate: date("last_attended_date"),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  membershipType: text("membership_type"),
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
  type: text("type").notNull().default("members"),
  stageMapping: jsonb("stage_mapping"),
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

export const recommendationCards = pgTable("recommendation_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  periodStart: date("period_start").notNull(),
  recommendationType: text("recommendation_type").notNull(),
  headline: text("headline").notNull(),
  checklistItems: jsonb("checklist_items").$type<Array<{ itemId: string; text: string }>>().notNull(),
  baselineForecast: jsonb("baseline_forecast").$type<{
    baselineMembers: number;
    baselineMrr: number;
    baselineChurn: number;
  }>().notNull(),
  executionStrengthThreshold: numeric("execution_strength_threshold", { precision: 4, scale: 2 }).notNull().default("0.60"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_recommendation_cards_scope").on(table.gymId, table.periodStart, table.recommendationType, table.headline),
  index("idx_recommendation_cards_gym").on(table.gymId),
]);

export const checklistItemCompletions = pgTable("checklist_item_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recommendationId: varchar("recommendation_id").notNull().references(() => recommendationCards.id),
  itemId: text("item_id").notNull(),
  checked: boolean("checked").notNull().default(false),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
  note: text("note"),
}, (table) => [
  uniqueIndex("idx_checklist_item_completion_unique").on(table.recommendationId, table.itemId),
  index("idx_checklist_completion_recommendation").on(table.recommendationId),
]);

export const ownerAdditionalActions = pgTable("owner_additional_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  periodStart: date("period_start").notNull(),
  text: text("text").notNull(),
  classificationType: text("classification_type"),
  classificationConfidence: numeric("classification_confidence", { precision: 4, scale: 2 }),
  classificationStatus: text("classification_status").notNull().default("unclassified"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_owner_actions_gym").on(table.gymId),
]);

export const recommendationLearningStats = pgTable("recommendation_learning_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recommendationType: text("recommendation_type").notNull(),
  gymId: varchar("gym_id").references(() => gyms.id),
  expectedImpact: numeric("expected_impact", { precision: 12, scale: 4 }).notNull().default("0"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull().default("0.1"),
  sampleSize: integer("sample_size").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_recommendation_learning_scope").on(table.recommendationType, table.gymId),
]);

export const recommendationLearningEvents = pgTable("recommendation_learning_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recommendationId: varchar("recommendation_id").notNull().references(() => recommendationCards.id),
  recommendationType: text("recommendation_type").notNull(),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  evaluationWindowDays: integer("evaluation_window_days").notNull(),
  executionStrength: numeric("execution_strength", { precision: 5, scale: 4 }).notNull(),
  overlapWeight: numeric("overlap_weight", { precision: 5, scale: 2 }).notNull().default("1"),
  impactScore: numeric("impact_score", { precision: 12, scale: 4 }).notNull(),
  deltaMembers: integer("delta_members").notNull(),
  deltaMrr: numeric("delta_mrr", { precision: 12, scale: 2 }).notNull(),
  deltaChurn: numeric("delta_churn", { precision: 7, scale: 3 }).notNull(),
  learnedAt: timestamp("learned_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_recommendation_learning_event_unique").on(table.recommendationId, table.evaluationWindowDays),
]);

export const wodifyConnections = pgTable("wodify_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  status: text("status").notNull().default("disconnected"),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  apiKeyFingerprint: text("api_key_fingerprint").notNull(),
  wodifyLocationName: text("wodify_location_name"),
  wodifyProgramName: text("wodify_program_name"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  lastCursorAt: timestamp("last_cursor_at"),
  syncWindowDays: integer("sync_window_days").notNull().default(90),
}, (table) => [
  uniqueIndex("idx_wodify_connection_gym").on(table.gymId),
]);

export const wodifyConnectionsRelations = relations(wodifyConnections, ({ one }) => ({
  gym: one(gyms, { fields: [wodifyConnections.gymId], references: [gyms.id] }),
}));

export const insertWodifyConnectionSchema = createInsertSchema(wodifyConnections).omit({ id: true, connectedAt: true, lastSuccessAt: true, lastErrorAt: true, lastErrorMessage: true, lastCursorAt: true });
export type InsertWodifyConnection = z.infer<typeof insertWodifyConnectionSchema>;
export type WodifyConnection = typeof wodifyConnections.$inferSelect;

export const wodifySyncRuns = pgTable("wodify_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  connectionId: varchar("connection_id").notNull().references(() => wodifyConnections.id),
  runType: text("run_type").notNull().default("incremental"),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  cursorStart: timestamp("cursor_start"),
  cursorEnd: timestamp("cursor_end"),
  clientsPulled: integer("clients_pulled").notNull().default(0),
  clientsUpserted: integer("clients_upserted").notNull().default(0),
  membershipsPulled: integer("memberships_pulled").notNull().default(0),
  membershipsUpserted: integer("memberships_upserted").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetails: text("error_details"),
}, (table) => [
  index("idx_wodify_sync_runs_gym").on(table.gymId),
  index("idx_wodify_sync_runs_connection").on(table.connectionId),
]);

export const wodifySyncRunsRelations = relations(wodifySyncRuns, ({ one }) => ({
  gym: one(gyms, { fields: [wodifySyncRuns.gymId], references: [gyms.id] }),
  connection: one(wodifyConnections, { fields: [wodifySyncRuns.connectionId], references: [wodifyConnections.id] }),
}));

export const insertWodifySyncRunSchema = createInsertSchema(wodifySyncRuns).omit({ id: true, startedAt: true, finishedAt: true });
export type InsertWodifySyncRun = z.infer<typeof insertWodifySyncRunSchema>;
export type WodifySyncRun = typeof wodifySyncRuns.$inferSelect;

export const wodifyRawClients = pgTable("wodify_raw_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  wodifyClientId: text("wodify_client_id").notNull(),
  payload: jsonb("payload").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at"),
  ingestedAt: timestamp("ingested_at").defaultNow(),
  syncRunId: varchar("sync_run_id").references(() => wodifySyncRuns.id),
}, (table) => [
  uniqueIndex("idx_wodify_raw_client_unique").on(table.gymId, table.wodifyClientId),
  index("idx_wodify_raw_clients_gym").on(table.gymId),
]);

export const insertWodifyRawClientSchema = createInsertSchema(wodifyRawClients).omit({ id: true, ingestedAt: true });
export type InsertWodifyRawClient = z.infer<typeof insertWodifyRawClientSchema>;
export type WodifyRawClient = typeof wodifyRawClients.$inferSelect;

export const wodifyRawMemberships = pgTable("wodify_raw_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  wodifyMembershipId: text("wodify_membership_id").notNull(),
  wodifyClientId: text("wodify_client_id").notNull(),
  payload: jsonb("payload").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at"),
  ingestedAt: timestamp("ingested_at").defaultNow(),
  syncRunId: varchar("sync_run_id").references(() => wodifySyncRuns.id),
}, (table) => [
  uniqueIndex("idx_wodify_raw_membership_unique").on(table.gymId, table.wodifyMembershipId),
  index("idx_wodify_raw_memberships_gym").on(table.gymId),
]);

export const insertWodifyRawMembershipSchema = createInsertSchema(wodifyRawMemberships).omit({ id: true, ingestedAt: true });
export type InsertWodifyRawMembership = z.infer<typeof insertWodifyRawMembershipSchema>;
export type WodifyRawMembership = typeof wodifyRawMemberships.$inferSelect;

export const outcomeSnapshots = pgTable("outcome_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  periodStart: date("period_start").notNull(),
  activeMembers: integer("active_members").notNull(),
  newMembers: integer("new_members").notNull(),
  cancels: integer("cancels").notNull(),
  churnRate: numeric("churn_rate", { precision: 5, scale: 2 }).notNull(),
  mrr: numeric("mrr", { precision: 12, scale: 2 }).notNull(),
  arm: numeric("arm", { precision: 10, scale: 2 }).notNull(),
  ltv: numeric("ltv", { precision: 12, scale: 2 }).notNull(),
  memberRiskCount: integer("member_risk_count").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_outcome_snapshot_gym_period").on(table.gymId, table.periodStart),
]);

export const knowledgeSources = pgTable("knowledge_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull().default("youtube_playlist"),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  lastIngestedAt: timestamp("last_ingested_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_knowledge_source_url").on(table.url),
]);

export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources).omit({ id: true, lastIngestedAt: true, createdAt: true });
export type InsertKnowledgeSource = z.infer<typeof insertKnowledgeSourceSchema>;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => knowledgeSources.id),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  channelName: text("channel_name"),
  durationSeconds: integer("duration_seconds"),
  rawTranscript: text("raw_transcript"),
  status: text("status").notNull().default("pending"),
  chunkCount: integer("chunk_count").notNull().default(0),
  ingestedAt: timestamp("ingested_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_knowledge_doc_external").on(table.sourceId, table.externalId),
  index("idx_knowledge_doc_source").on(table.sourceId),
]);

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({ id: true, ingestedAt: true });
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => knowledgeDocuments.id),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding"),
  taxonomy: jsonb("taxonomy").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  tsv: text("tsv"),
  tokenCount: integer("token_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_knowledge_chunk_doc").on(table.documentId),
  index("idx_knowledge_chunk_taxonomy").using("gin", table.taxonomy),
]);

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).omit({ id: true, createdAt: true });
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;

export const recommendationChunkAudit = pgTable("recommendation_chunk_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  periodStart: date("period_start").notNull(),
  recommendationType: text("recommendation_type").notNull(),
  chunkId: varchar("chunk_id").notNull().references(() => knowledgeChunks.id),
  similarityScore: numeric("similarity_score", { precision: 6, scale: 4 }),
  usedAt: timestamp("used_at").defaultNow(),
}, (table) => [
  index("idx_rec_chunk_audit_gym").on(table.gymId, table.periodStart),
  index("idx_rec_chunk_audit_chunk").on(table.chunkId),
]);

export const insertRecommendationChunkAuditSchema = createInsertSchema(recommendationChunkAudit).omit({ id: true, usedAt: true });
export type InsertRecommendationChunkAudit = z.infer<typeof insertRecommendationChunkAuditSchema>;
export type RecommendationChunkAudit = typeof recommendationChunkAudit.$inferSelect;

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  source: text("source").notNull().default("Unknown"),
  status: text("status").notNull().default("new"),
  firstContactAt: timestamp("first_contact_at"),
  metadata: jsonb("metadata"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  coachId: varchar("coach_id"),
  notes: text("notes"),
  lostReason: text("lost_reason"),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  bookedAt: timestamp("booked_at"),
  consultDate: timestamp("consult_date"),
  showedAt: timestamp("showed_at"),
  lastContactAt: timestamp("last_contact_at"),
  nextActionDate: timestamp("next_action_date"),
  followUpNotes: text("follow_up_notes"),
}, (table) => [
  index("idx_leads_gym").on(table.gymId),
  index("idx_leads_created").on(table.createdAt),
]);

export const leadsRelations = relations(leads, ({ one }) => ({
  gym: one(gyms, { fields: [leads.gymId], references: [gyms.id] }),
}));

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const consults = pgTable("consults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  bookedAt: timestamp("booked_at").defaultNow().notNull(),
  scheduledFor: timestamp("scheduled_for"),
  showedAt: timestamp("showed_at"),
  noShowAt: timestamp("no_show_at"),
  coachId: varchar("coach_id"),
  notes: text("notes"),
}, (table) => [
  index("idx_consults_gym").on(table.gymId),
  index("idx_consults_lead").on(table.leadId),
  index("idx_consults_booked").on(table.bookedAt),
]);

export const consultsRelations = relations(consults, ({ one }) => ({
  gym: one(gyms, { fields: [consults.gymId], references: [gyms.id] }),
  lead: one(leads, { fields: [consults.leadId], references: [leads.id] }),
}));

export const insertConsultSchema = createInsertSchema(consults).omit({ id: true });
export type InsertConsult = z.infer<typeof insertConsultSchema>;
export type Consult = typeof consults.$inferSelect;

export const salesMemberships = pgTable("sales_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sales_memberships_gym").on(table.gymId),
  index("idx_sales_memberships_lead").on(table.leadId),
  index("idx_sales_memberships_started").on(table.startedAt),
]);

export const salesMembershipsRelations = relations(salesMemberships, ({ one }) => ({
  gym: one(gyms, { fields: [salesMemberships.gymId], references: [gyms.id] }),
  lead: one(leads, { fields: [salesMemberships.leadId], references: [leads.id] }),
}));

export const insertSalesMembershipSchema = createInsertSchema(salesMemberships).omit({ id: true, createdAt: true });
export type InsertSalesMembership = z.infer<typeof insertSalesMembershipSchema>;
export type SalesMembership = typeof salesMemberships.$inferSelect;

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  membershipId: varchar("membership_id").notNull().references(() => salesMemberships.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
}, (table) => [
  index("idx_payments_gym").on(table.gymId),
  index("idx_payments_membership").on(table.membershipId),
]);

export const paymentsRelations = relations(payments, ({ one }) => ({
  gym: one(gyms, { fields: [payments.gymId], references: [gyms.id] }),
  membership: one(salesMemberships, { fields: [payments.membershipId], references: [salesMemberships.id] }),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export const ingestJobs = pgTable("ingest_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => knowledgeSources.id),
  status: text("status").notNull().default("pending"),
  videosFound: integer("videos_found").notNull().default(0),
  videosProcessed: integer("videos_processed").notNull().default(0),
  chunksCreated: integer("chunks_created").notNull().default(0),
  errorDetails: text("error_details"),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("idx_ingest_job_source").on(table.sourceId),
]);

export const insertIngestJobSchema = createInsertSchema(ingestJobs).omit({ id: true, startedAt: true, finishedAt: true });
export type InsertIngestJob = z.infer<typeof insertIngestJobSchema>;
export type IngestJob = typeof ingestJobs.$inferSelect;

export const aiOperatorRuns = pgTable("ai_operator_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  pill: text("pill").notNull(),
  taskType: text("task_type").notNull(),
  inputSummaryJson: jsonb("input_summary_json"),
  outputJson: jsonb("output_json"),
  status: text("status").notNull().default("draft"),
  error: text("error"),
  llmModel: text("llm_model"),
  contextSnapshotJson: jsonb("context_snapshot_json"),
  retryCount: integer("retry_count").notNull().default(0),
  validationPassed: boolean("validation_passed"),
  promptVersion: text("prompt_version"),
  doctrineVersion: text("doctrine_version"),
  reasoningSummary: text("reasoning_summary"),
  riskFilterTriggered: boolean("risk_filter_triggered"),
  confidenceScore: integer("confidence_score"),
  dataCompletenessScore: integer("data_completeness_score"),
}, (table) => [
  index("idx_ai_operator_runs_gym").on(table.gymId),
  index("idx_ai_operator_runs_user").on(table.createdByUserId),
  index("idx_ai_operator_runs_created").on(table.createdAt),
]);

export const aiOperatorRunsRelations = relations(aiOperatorRuns, ({ one }) => ({
  gym: one(gyms, { fields: [aiOperatorRuns.gymId], references: [gyms.id] }),
}));

export const insertAiOperatorRunSchema = createInsertSchema(aiOperatorRuns).omit({ id: true, createdAt: true });
export type InsertAiOperatorRun = z.infer<typeof insertAiOperatorRunSchema>;
export type AiOperatorRun = typeof aiOperatorRuns.$inferSelect;

export const projectedImpactSchema = z.object({
  members_affected: z.number(),
  arm: z.number(),
  months_remaining: z.number(),
  estimated_lift_pct: z.number(),
  expected_revenue_impact: z.number(),
  impact_tier: z.enum(["High", "Moderate", "Low"]),
  urgency_multiplier: z.number().optional(),
});

export type ProjectedImpact = z.infer<typeof projectedImpactSchema>;

export const operatorOutputSchema = z.object({
  headline: z.string(),
  why_it_matters: z.string(),
  actions: z.array(z.string()).min(4).max(7),
  drafts: z.array(z.object({
    channel: z.enum(["sms", "email", "in_person"]),
    message: z.string(),
  })).optional(),
  metrics_used: z.array(z.string()),
  confidence_label: z.enum(["Low", "Med", "High"]),
  reasoning_summary: z.string().optional(),
  projected_impact: projectedImpactSchema.optional(),
});

export type OperatorOutput = z.infer<typeof operatorOutputSchema>;

export const OPERATOR_PILLS = ["retention", "sales", "coaching", "community", "owner"] as const;
export type OperatorPill = typeof OPERATOR_PILLS[number];

export const OPERATOR_TASK_TYPES = [
  "7-day plan",
  "Member outreach drafts",
  "Sales follow-up sequence",
  "Staff coaching note",
  "Event plan",
] as const;
export type OperatorTaskType = typeof OPERATOR_TASK_TYPES[number];

export const OPERATOR_ROLES = ["gym_owner", "analyst", "coach_view"] as const;
export type OperatorRole = typeof OPERATOR_ROLES[number];

export const OPERATOR_TASK_STATUSES = ["pending", "in_progress", "complete"] as const;
export type OperatorTaskStatus = typeof OPERATOR_TASK_STATUSES[number];

export const operatorTasks = pgTable("operator_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  operatorRunId: varchar("operator_run_id").notNull().references(() => aiOperatorRuns.id),
  title: text("title").notNull(),
  assignedToUserId: varchar("assigned_to_user_id"),
  dueDate: timestamp("due_date"),
  impactValueEstimate: numeric("impact_value_estimate"),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  executionResult: text("execution_result"),
  observedImpact: text("observed_impact"),
  pill: text("pill").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_operator_tasks_gym").on(table.gymId),
  index("idx_operator_tasks_run").on(table.operatorRunId),
  index("idx_operator_tasks_status").on(table.status),
]);

export const operatorTasksRelations = relations(operatorTasks, ({ one }) => ({
  gym: one(gyms, { fields: [operatorTasks.gymId], references: [gyms.id] }),
  run: one(aiOperatorRuns, { fields: [operatorTasks.operatorRunId], references: [aiOperatorRuns.id] }),
}));

export const insertOperatorTaskSchema = createInsertSchema(operatorTasks).omit({ id: true, createdAt: true });
export type InsertOperatorTask = z.infer<typeof insertOperatorTaskSchema>;
export type OperatorTask = typeof operatorTasks.$inferSelect;

export const interventionOutcomes = pgTable("intervention_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  interventionType: text("intervention_type").notNull(),
  gymArchetype: text("gym_archetype").notNull(),
  membersAffected: integer("members_affected"),
  projectedImpact: numeric("projected_impact"),
  observedResult: text("observed_result"),
  outcomeNotes: text("outcome_notes"),
  operatorRunId: varchar("operator_run_id").references(() => aiOperatorRuns.id),
  pill: text("pill"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_intervention_outcomes_gym").on(table.gymId),
]);

export const interventionOutcomesRelations = relations(interventionOutcomes, ({ one }) => ({
  gym: one(gyms, { fields: [interventionOutcomes.gymId], references: [gyms.id] }),
  run: one(aiOperatorRuns, { fields: [interventionOutcomes.operatorRunId], references: [aiOperatorRuns.id] }),
}));

export const insertInterventionOutcomeSchema = createInsertSchema(interventionOutcomes).omit({ id: true, createdAt: true });
export type InsertInterventionOutcome = z.infer<typeof insertInterventionOutcomeSchema>;
export type InterventionOutcome = typeof interventionOutcomes.$inferSelect;

export const memberBilling = pgTable("member_billing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  memberId: varchar("member_id").notNull().references(() => members.id),
  billingMonth: date("billing_month").notNull(),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  dueDate: date("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_member_billing_gym").on(table.gymId),
  index("idx_member_billing_member").on(table.memberId),
  index("idx_member_billing_month").on(table.billingMonth),
]);

export const memberBillingRelations = relations(memberBilling, ({ one }) => ({
  gym: one(gyms, { fields: [memberBilling.gymId], references: [gyms.id] }),
  member: one(members, { fields: [memberBilling.memberId], references: [members.id] }),
}));

export const insertMemberBillingSchema = createInsertSchema(memberBilling).omit({ id: true, createdAt: true });
export type InsertMemberBilling = z.infer<typeof insertMemberBillingSchema>;
export type MemberBilling = typeof memberBilling.$inferSelect;

// Stripe Billing Integration (gym's own Stripe account for member payments)
export const stripeConnections = pgTable("stripe_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  status: text("status").notNull().default("disconnected"),
  stripeAccountId: text("stripe_account_id"),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  apiKeyFingerprint: text("api_key_fingerprint").notNull(),
  webhookSecret: text("webhook_secret"),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  recordsSynced: integer("records_synced").notNull().default(0),
  fallbackNotes: text("fallback_notes"),
}, (table) => [
  uniqueIndex("idx_stripe_connection_gym").on(table.gymId),
]);

export const stripeConnectionsRelations = relations(stripeConnections, ({ one }) => ({
  gym: one(gyms, { fields: [stripeConnections.gymId], references: [gyms.id] }),
}));

export const insertStripeConnectionSchema = createInsertSchema(stripeConnections).omit({
  id: true, connectedAt: true, lastSyncAt: true, lastErrorAt: true, lastErrorMessage: true, recordsSynced: true,
});
export type InsertStripeConnection = z.infer<typeof insertStripeConnectionSchema>;
export type StripeConnection = typeof stripeConnections.$inferSelect;

export const stripeSyncRuns = pgTable("stripe_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  connectionId: varchar("connection_id").notNull().references(() => stripeConnections.id),
  runType: text("run_type").notNull().default("full"),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  customersFound: integer("customers_found").notNull().default(0),
  subscriptionsFound: integer("subscriptions_found").notNull().default(0),
  invoicesFound: integer("invoices_found").notNull().default(0),
  chargesFound: integer("charges_found").notNull().default(0),
  refundsFound: integer("refunds_found").notNull().default(0),
  recordsCreated: integer("records_created").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetails: text("error_details"),
  warningMessages: text("warning_messages"),
  syncWindowDays: integer("sync_window_days"),
  isDryRun: boolean("is_dry_run").notNull().default(false),
  dryRunSummary: jsonb("dry_run_summary"),
}, (table) => [
  index("idx_stripe_sync_runs_gym").on(table.gymId),
  index("idx_stripe_sync_runs_connection").on(table.connectionId),
]);

export const stripeSyncRunsRelations = relations(stripeSyncRuns, ({ one }) => ({
  gym: one(gyms, { fields: [stripeSyncRuns.gymId], references: [gyms.id] }),
  connection: one(stripeConnections, { fields: [stripeSyncRuns.connectionId], references: [stripeConnections.id] }),
}));

export const insertStripeSyncRunSchema = createInsertSchema(stripeSyncRuns).omit({ id: true, startedAt: true, finishedAt: true });
export type InsertStripeSyncRun = z.infer<typeof insertStripeSyncRunSchema>;
export type StripeSyncRun = typeof stripeSyncRuns.$inferSelect;

export const STRIPE_BILLING_STATUSES = ["payment_succeeded", "failed", "refunded", "overdue"] as const;
export type StripeBillingStatus = typeof STRIPE_BILLING_STATUSES[number];

export const stripeBillingRecords = pgTable("stripe_billing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  memberId: varchar("member_id").references(() => members.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripeChargeId: text("stripe_charge_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull(),
  paymentDate: timestamp("payment_date"),
  dueDate: timestamp("due_date"),
  description: text("description"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  source: text("source").notNull().default("stripe"),
  expectedAmount: integer("expected_amount"),
  varianceAmount: integer("variance_amount"),
  varianceType: text("variance_type").default("none"),
  expectedBillingDate: timestamp("expected_billing_date"),
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
  reconciliationStatus: text("reconciliation_status").notNull().default("unreconciled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stripe_billing_records_gym").on(table.gymId),
  index("idx_stripe_billing_records_customer").on(table.stripeCustomerId),
  index("idx_stripe_billing_records_member").on(table.memberId),
  uniqueIndex("idx_stripe_billing_record_invoice").on(table.gymId, table.stripeInvoiceId),
]);

export const stripeBillingRecordsRelations = relations(stripeBillingRecords, ({ one }) => ({
  gym: one(gyms, { fields: [stripeBillingRecords.gymId], references: [gyms.id] }),
  member: one(members, { fields: [stripeBillingRecords.memberId], references: [members.id] }),
}));

export const insertStripeBillingRecordSchema = createInsertSchema(stripeBillingRecords).omit({ id: true, createdAt: true });
export type InsertStripeBillingRecord = z.infer<typeof insertStripeBillingRecordSchema>;
export type StripeBillingRecord = typeof stripeBillingRecords.$inferSelect;

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  stripeEventId: text("stripe_event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  status: text("status").notNull().default("processed"),
}, (table) => [
  uniqueIndex("idx_stripe_webhook_event_unique").on(table.stripeEventId),
  index("idx_stripe_webhook_events_gym").on(table.gymId),
]);

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({ id: true, processedAt: true });
export type InsertStripeWebhookEvent = z.infer<typeof insertStripeWebhookEventSchema>;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;

export const STRIPE_MATCH_STATUSES = ["auto_matched", "manually_matched", "unmatched", "ambiguous", "ignored"] as const;
export type StripeMatchStatus = typeof STRIPE_MATCH_STATUSES[number];

export const STRIPE_MATCH_METHODS = ["exact_email", "normalized_name_email", "normalized_name_only", "manual", "none"] as const;
export type StripeMatchMethod = typeof STRIPE_MATCH_METHODS[number];

export const stripeCustomerMatches = pgTable("stripe_customer_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeCustomerEmail: text("stripe_customer_email"),
  stripeCustomerName: text("stripe_customer_name"),
  memberId: varchar("member_id").references(() => members.id),
  matchStatus: text("match_status").notNull().default("unmatched"),
  matchMethod: text("match_method").notNull().default("none"),
  matchConfidence: integer("match_confidence").notNull().default(0),
  matchedAt: timestamp("matched_at"),
  matchedBy: varchar("matched_by"),
  notes: text("notes"),
}, (table) => [
  index("idx_stripe_customer_matches_gym").on(table.gymId),
  index("idx_stripe_customer_matches_status").on(table.matchStatus),
  uniqueIndex("idx_stripe_customer_match_unique").on(table.gymId, table.stripeCustomerId),
]);

export const stripeCustomerMatchesRelations = relations(stripeCustomerMatches, ({ one }) => ({
  gym: one(gyms, { fields: [stripeCustomerMatches.gymId], references: [gyms.id] }),
  member: one(members, { fields: [stripeCustomerMatches.memberId], references: [members.id] }),
}));

export const insertStripeCustomerMatchSchema = createInsertSchema(stripeCustomerMatches).omit({ id: true, matchedAt: true });
export type InsertStripeCustomerMatch = z.infer<typeof insertStripeCustomerMatchSchema>;
export type StripeCustomerMatch = typeof stripeCustomerMatches.$inferSelect;

export const stripeIntegrationEvents = pgTable("stripe_integration_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  eventType: text("event_type").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_stripe_integration_events_gym").on(table.gymId),
  index("idx_stripe_integration_events_type").on(table.eventType),
]);

export const stripeIntegrationEventsRelations = relations(stripeIntegrationEvents, ({ one }) => ({
  gym: one(gyms, { fields: [stripeIntegrationEvents.gymId], references: [gyms.id] }),
}));

export const insertStripeIntegrationEventSchema = createInsertSchema(stripeIntegrationEvents).omit({ id: true, createdAt: true });
export type InsertStripeIntegrationEvent = z.infer<typeof insertStripeIntegrationEventSchema>;
export type StripeIntegrationEvent = typeof stripeIntegrationEvents.$inferSelect;

export const SUBSCRIPTION_PLANS = ["starter", "pro"] as const;
export type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "unpaid"] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gymId: varchar("gym_id").notNull().references(() => gyms.id),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subscriptions_gym").on(table.gymId),
  index("idx_subscriptions_stripe_customer").on(table.stripeCustomerId),
  index("idx_subscriptions_stripe_sub").on(table.stripeSubscriptionId),
]);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  gym: one(gyms, { fields: [subscriptions.gymId], references: [gyms.id] }),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
