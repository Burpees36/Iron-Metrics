import {
  gyms, members, gymMonthlyMetrics, memberContacts, importJobs,
  recommendationLearningStats,
  wodifyConnections, wodifySyncRuns, wodifyRawClients, wodifyRawMemberships,
  knowledgeSources, knowledgeDocuments, knowledgeChunks,
  recommendationChunkAudit, ingestJobs,
  leads, consults, salesMemberships, payments,
  aiOperatorRuns, operatorTasks, interventionOutcomes,
  gymStaff, staffInvites, users,
  type Gym, type InsertGym,
  type GymStaff, type InsertGymStaff, type GymStaffRole,
  type StaffInvite, type InsertStaffInvite,
  type User,
  type Member, type InsertMember,
  type GymMonthlyMetrics, type InsertGymMonthlyMetrics,
  type MemberContact, type InsertMemberContact,
  type ImportJob, type InsertImportJob,
  type WodifyConnection, type InsertWodifyConnection,
  type WodifySyncRun, type InsertWodifySyncRun,
  type WodifyRawClient, type InsertWodifyRawClient,
  type WodifyRawMembership, type InsertWodifyRawMembership,
  type KnowledgeSource, type InsertKnowledgeSource,
  type KnowledgeDocument, type InsertKnowledgeDocument,
  type KnowledgeChunk, type InsertKnowledgeChunk,
  type RecommendationChunkAudit, type InsertRecommendationChunkAudit,
  type IngestJob, type InsertIngestJob,
  type Lead, type InsertLead,
  type Consult, type InsertConsult,
  type SalesMembership, type InsertSalesMembership,
  type Payment, type InsertPayment,
  type AiOperatorRun, type InsertAiOperatorRun,
  type OperatorTask, type InsertOperatorTask,
  type InterventionOutcome, type InsertInterventionOutcome,
  memberBilling,
  type MemberBilling, type InsertMemberBilling,
  subscriptions,
  type Subscription, type InsertSubscription,
  stripeConnections,
  type StripeConnection, type InsertStripeConnection,
  stripeSyncRuns,
  type StripeSyncRun, type InsertStripeSyncRun,
  stripeBillingRecords,
  type StripeBillingRecord, type InsertStripeBillingRecord,
  stripeWebhookEvents,
  type StripeWebhookEvent, type InsertStripeWebhookEvent,
  stripeCustomerMatches,
  type StripeCustomerMatch, type InsertStripeCustomerMatch,
  stripeIntegrationEvents,
  type StripeIntegrationEvent, type InsertStripeIntegrationEvent,
} from "@shared/schema";
import { db } from "./db";
import { pool } from "./db";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";

export interface IStorage {
  createGym(gym: InsertGym): Promise<Gym>;
  getGym(id: string): Promise<Gym | undefined>;
  getGymsByOwner(ownerId: string): Promise<Gym[]>;

  upsertMember(member: InsertMember): Promise<{ action: "inserted" | "updated" }>;
  getMemberById(id: string): Promise<Member | undefined>;
  getMembersByGym(gymId: string): Promise<Member[]>;
  updateGym(id: string, updates: Partial<Gym>): Promise<Gym>;
  getActiveMembers(gymId: string, asOfDate: string): Promise<Member[]>;
  getNewMembers(gymId: string, monthStart: string, monthEnd: string): Promise<Member[]>;
  getCancels(gymId: string, monthStart: string, monthEnd: string): Promise<Member[]>;
  getActiveStartOfMonth(gymId: string, monthStart: string): Promise<number>;

  logContact(contact: InsertMemberContact): Promise<MemberContact>;
  getLatestContacts(gymId: string): Promise<MemberContact[]>;
  getContactsForMember(memberId: string): Promise<MemberContact[]>;

  upsertMonthlyMetrics(metrics: InsertGymMonthlyMetrics): Promise<GymMonthlyMetrics>;
  getMonthlyMetrics(gymId: string, monthStart: string): Promise<GymMonthlyMetrics | undefined>;
  getAllMonthlyMetrics(gymId: string): Promise<GymMonthlyMetrics[]>;

  createImportJob(job: InsertImportJob): Promise<ImportJob>;
  getImportJob(id: string): Promise<ImportJob | undefined>;
  getImportJobsByGym(gymId: string): Promise<ImportJob[]>;
  updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob>;
  findImportByHash(gymId: string, fileHash: string): Promise<ImportJob | undefined>;
  getLearningStats(gymId: string, recommendationTypes: string[]): Promise<Array<{
    recommendationType: string;
    gymId: string | null;
    confidence: number;
    expectedImpact: number;
    sampleSize: number;
  }>>;

  getWodifyConnection(gymId: string): Promise<WodifyConnection | undefined>;
  upsertWodifyConnection(connection: InsertWodifyConnection): Promise<WodifyConnection>;
  updateWodifyConnection(id: string, updates: Partial<WodifyConnection>): Promise<WodifyConnection>;
  deleteWodifyConnection(gymId: string): Promise<void>;

  createWodifySyncRun(run: InsertWodifySyncRun): Promise<WodifySyncRun>;
  updateWodifySyncRun(id: string, updates: Partial<WodifySyncRun>): Promise<WodifySyncRun>;
  getWodifySyncRuns(gymId: string, limit?: number): Promise<WodifySyncRun[]>;

  upsertWodifyRawClient(client: InsertWodifyRawClient): Promise<void>;
  upsertWodifyRawMembership(membership: InsertWodifyRawMembership): Promise<void>;
  getWodifyRawClients(gymId: string): Promise<WodifyRawClient[]>;
  getWodifyRawMemberships(gymId: string): Promise<WodifyRawMembership[]>;

  createKnowledgeSource(source: InsertKnowledgeSource): Promise<KnowledgeSource>;
  getKnowledgeSources(): Promise<KnowledgeSource[]>;
  getKnowledgeSource(id: string): Promise<KnowledgeSource | undefined>;
  getKnowledgeSourceByUrl(url: string): Promise<KnowledgeSource | undefined>;
  updateKnowledgeSource(id: string, updates: Partial<KnowledgeSource>): Promise<KnowledgeSource>;
  deleteKnowledgeSource(id: string): Promise<void>;

  upsertKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  getKnowledgeDocuments(sourceId: string): Promise<KnowledgeDocument[]>;
  getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined>;
  updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument>;

  createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk>;
  getKnowledgeChunks(documentId: string): Promise<KnowledgeChunk[]>;
  getKnowledgeChunksByIds(ids: string[]): Promise<KnowledgeChunk[]>;
  searchChunksByVector(embedding: number[], taxonomyFilter: string[], limit: number): Promise<Array<KnowledgeChunk & { similarity: number; docTitle: string; docUrl: string }>>;
  searchChunksByText(query: string, taxonomyFilter: string[], limit: number): Promise<Array<KnowledgeChunk & { docTitle: string; docUrl: string }>>;
  deleteChunksByDocument(documentId: string): Promise<void>;
  getKnowledgeStats(): Promise<{ sources: number; documents: number; chunks: number; embeddedChunks: number }>;

  createRecommendationChunkAudit(audit: InsertRecommendationChunkAudit): Promise<RecommendationChunkAudit>;
  getRecommendationAudits(gymId: string, periodStart: string): Promise<Array<RecommendationChunkAudit & { chunkContent: string; docTitle: string; docUrl: string }>>;

  createIngestJob(job: InsertIngestJob): Promise<IngestJob>;
  updateIngestJob(id: string, updates: Partial<IngestJob>): Promise<IngestJob>;
  getIngestJobs(sourceId?: string): Promise<IngestJob[]>;

  createLead(lead: InsertLead): Promise<Lead>;
  getLeadsByGym(gymId: string, start: Date, end: Date): Promise<Lead[]>;
  getLeadById(id: string): Promise<Lead | undefined>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;
  getLeadsByGymAllTime(gymId: string): Promise<Lead[]>;

  createConsult(consult: InsertConsult): Promise<Consult>;
  getConsultsByGym(gymId: string, start: Date, end: Date): Promise<Consult[]>;
  getConsultsByGymAllTime(gymId: string): Promise<Consult[]>;
  updateConsult(id: string, updates: Partial<Consult>): Promise<Consult>;

  createSalesMembership(membership: InsertSalesMembership): Promise<SalesMembership>;
  getSalesMembershipsByGym(gymId: string, start: Date, end: Date): Promise<SalesMembership[]>;

  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByGym(gymId: string, start: Date, end: Date): Promise<Payment[]>;

  createAiOperatorRun(run: InsertAiOperatorRun): Promise<AiOperatorRun>;
  getAiOperatorRun(id: string): Promise<AiOperatorRun | undefined>;
  getAiOperatorRunsByGym(gymId: string): Promise<AiOperatorRun[]>;
  updateAiOperatorRun(id: string, updates: Partial<AiOperatorRun>): Promise<AiOperatorRun>;

  createOperatorTask(task: InsertOperatorTask): Promise<OperatorTask>;
  getOperatorTasksByGym(gymId: string, filters?: { status?: string; pill?: string }): Promise<OperatorTask[]>;
  getOperatorTasksByRun(runId: string): Promise<OperatorTask[]>;
  updateOperatorTask(id: string, updates: Partial<OperatorTask>): Promise<OperatorTask>;
  getOperatorTaskStats(gymId: string): Promise<{
    totalProjectedImpact: number;
    tasksByPill: Record<string, { pending: number; in_progress: number; complete: number }>;
    completionRate: number;
    totalTasks: number;
  }>;
  createInterventionOutcome(outcome: InsertInterventionOutcome): Promise<InterventionOutcome>;
  deleteOperatorTasksByGym(gymId: string): Promise<number>;

  getMemberBillingByGym(gymId: string, billingMonth: string): Promise<MemberBilling[]>;
  getAllMemberBillingByGym(gymId: string): Promise<MemberBilling[]>;
  upsertMemberBilling(billing: InsertMemberBilling): Promise<MemberBilling>;
  updateMemberBilling(id: string, updates: Partial<MemberBilling>): Promise<MemberBilling>;
  getMemberBillingByMember(memberId: string, billingMonth: string): Promise<MemberBilling | undefined>;

  getSubscriptionByGym(gymId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;

  getGymStaffRole(gymId: string, userId: string): Promise<GymStaffRole | null>;
  getGymsForUser(userId: string): Promise<Gym[]>;
  getGymStaff(gymId: string): Promise<GymStaff[]>;
  addGymStaff(staff: InsertGymStaff): Promise<GymStaff>;
  removeGymStaff(gymId: string, userId: string): Promise<void>;
  updateGymStaffRole(gymId: string, userId: string, role: GymStaffRole): Promise<GymStaff>;

  getUser(id: string): Promise<User | undefined>;
  getGymStaffByEmail(gymId: string, email: string): Promise<GymStaff | undefined>;
  createStaffInvite(invite: InsertStaffInvite): Promise<StaffInvite>;
  getStaffInviteByToken(token: string): Promise<StaffInvite | undefined>;
  updateStaffInviteStatus(id: string, status: string): Promise<void>;
  getGymStaffInvites(gymId: string): Promise<StaffInvite[]>;

  getStripeConnection(gymId: string): Promise<StripeConnection | undefined>;
  upsertStripeConnection(connection: InsertStripeConnection): Promise<StripeConnection>;
  updateStripeConnection(id: string, updates: Partial<StripeConnection>): Promise<StripeConnection>;
  deleteStripeConnection(gymId: string): Promise<void>;

  createStripeSyncRun(run: InsertStripeSyncRun): Promise<StripeSyncRun>;
  updateStripeSyncRun(id: string, updates: Partial<StripeSyncRun>): Promise<StripeSyncRun>;
  getStripeSyncRuns(gymId: string, limit?: number): Promise<StripeSyncRun[]>;

  upsertStripeBillingRecord(record: InsertStripeBillingRecord): Promise<StripeBillingRecord>;
  getStripeBillingRecords(gymId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<StripeBillingRecord[]>;
  getStripeBillingRecordCount(gymId: string): Promise<number>;

  createStripeWebhookEvent(event: InsertStripeWebhookEvent): Promise<StripeWebhookEvent>;
  getStripeWebhookEvent(stripeEventId: string): Promise<StripeWebhookEvent | undefined>;
  getStripeWebhookEvents(gymId: string, limit?: number): Promise<StripeWebhookEvent[]>;
  updateStripeWebhookEventStatus(stripeEventId: string, status: string): Promise<void>;

  getStripeCustomerMatches(gymId: string, options?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<StripeCustomerMatch[]>;
  upsertStripeCustomerMatch(data: InsertStripeCustomerMatch): Promise<StripeCustomerMatch>;
  updateStripeCustomerMatch(id: string, updates: Partial<StripeCustomerMatch>): Promise<StripeCustomerMatch>;
  getStripeMatchCounts(gymId: string): Promise<{ matched: number; unmatched: number; ambiguous: number; ignored: number; total: number }>;
  deleteStripeCustomerMatches(gymId: string): Promise<void>;

  createStripeIntegrationEvent(event: InsertStripeIntegrationEvent): Promise<StripeIntegrationEvent>;
  getStripeIntegrationEvents(gymId: string, limit?: number): Promise<StripeIntegrationEvent[]>;

  getUniqueStripeCustomers(gymId: string): Promise<Array<{ stripeCustomerId: string; customerEmail: string | null; customerName: string | null }>>;
  updateStripeBillingRecordsMemberId(gymId: string, stripeCustomerId: string, memberId: string | null): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createGym(gym: InsertGym): Promise<Gym> {
    const [created] = await db.insert(gyms).values(gym).returning();
    return created;
  }

  async getGym(id: string): Promise<Gym | undefined> {
    const [gym] = await db.select().from(gyms).where(eq(gyms.id, id));
    return gym;
  }

  async getGymsByOwner(ownerId: string): Promise<Gym[]> {
    return db.select().from(gyms).where(eq(gyms.ownerId, ownerId));
  }

  async upsertMember(member: InsertMember): Promise<{ action: "inserted" | "updated" }> {
    if (member.email) {
      const [existing] = await db
        .select()
        .from(members)
        .where(and(eq(members.gymId, member.gymId), eq(members.email, member.email)));

      if (existing) {
        const updates: Record<string, any> = {
          name: member.name,
          status: member.status,
          joinDate: member.joinDate,
          cancelDate: member.cancelDate,
          monthlyRate: member.monthlyRate,
        };
        if (member.lastAttendedDate !== undefined) {
          updates.lastAttendedDate = member.lastAttendedDate;
        }
        if (member.membershipType !== undefined) {
          updates.membershipType = member.membershipType;
        }
        await db
          .update(members)
          .set(updates)
          .where(eq(members.id, existing.id));
        return { action: "updated" };
      }
    }

    await db.insert(members).values(member);
    return { action: "inserted" };
  }

  async getMemberById(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member;
  }

  async getMembersByGym(gymId: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.gymId, gymId));
  }

  async updateGym(id: string, updates: Partial<Gym>): Promise<Gym> {
    const [updated] = await db.update(gyms).set(updates).where(eq(gyms.id, id)).returning();
    return updated;
  }

  async getActiveMembers(gymId: string, asOfDate: string): Promise<Member[]> {
    return db
      .select()
      .from(members)
      .where(
        and(
          eq(members.gymId, gymId),
          lte(members.joinDate, asOfDate),
          sql`(${members.cancelDate} IS NULL OR ${members.cancelDate} > ${asOfDate})`
        )
      );
  }

  async getNewMembers(gymId: string, monthStart: string, monthEnd: string): Promise<Member[]> {
    return db
      .select()
      .from(members)
      .where(
        and(
          eq(members.gymId, gymId),
          gte(members.joinDate, monthStart),
          lte(members.joinDate, monthEnd)
        )
      );
  }

  async getCancels(gymId: string, monthStart: string, monthEnd: string): Promise<Member[]> {
    return db
      .select()
      .from(members)
      .where(
        and(
          eq(members.gymId, gymId),
          gte(members.cancelDate, monthStart),
          lte(members.cancelDate, monthEnd)
        )
      );
  }

  async getActiveStartOfMonth(gymId: string, monthStart: string): Promise<number> {
    const dayBefore = new Date(monthStart + "T00:00:00");
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

    const active = await this.getActiveMembers(gymId, dayBeforeStr);
    return active.length;
  }

  async logContact(contact: InsertMemberContact): Promise<MemberContact> {
    const [created] = await db.insert(memberContacts).values(contact).returning();
    return created;
  }

  async getLatestContacts(gymId: string): Promise<MemberContact[]> {
    return db
      .select()
      .from(memberContacts)
      .where(eq(memberContacts.gymId, gymId))
      .orderBy(desc(memberContacts.contactedAt));
  }

  async getContactsForMember(memberId: string): Promise<MemberContact[]> {
    return db
      .select()
      .from(memberContacts)
      .where(eq(memberContacts.memberId, memberId))
      .orderBy(desc(memberContacts.contactedAt));
  }

  async upsertMonthlyMetrics(metrics: InsertGymMonthlyMetrics): Promise<GymMonthlyMetrics> {
    const [existing] = await db
      .select()
      .from(gymMonthlyMetrics)
      .where(
        and(
          eq(gymMonthlyMetrics.gymId, metrics.gymId),
          eq(gymMonthlyMetrics.monthStart, metrics.monthStart)
        )
      );

    if (existing) {
      const [updated] = await db
        .update(gymMonthlyMetrics)
        .set({ ...metrics, generatedAt: new Date() })
        .where(eq(gymMonthlyMetrics.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(gymMonthlyMetrics).values(metrics).returning();
    return created;
  }

  async getMonthlyMetrics(gymId: string, monthStart: string): Promise<GymMonthlyMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(gymMonthlyMetrics)
      .where(
        and(
          eq(gymMonthlyMetrics.gymId, gymId),
          eq(gymMonthlyMetrics.monthStart, monthStart)
        )
      );
    return metrics;
  }

  async getAllMonthlyMetrics(gymId: string): Promise<GymMonthlyMetrics[]> {
    return db
      .select()
      .from(gymMonthlyMetrics)
      .where(eq(gymMonthlyMetrics.gymId, gymId))
      .orderBy(desc(gymMonthlyMetrics.monthStart));
  }

  async createImportJob(job: InsertImportJob): Promise<ImportJob> {
    const [created] = await db.insert(importJobs).values(job).returning();
    return created;
  }

  async getImportJob(id: string): Promise<ImportJob | undefined> {
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, id));
    return job;
  }

  async getImportJobsByGym(gymId: string): Promise<ImportJob[]> {
    return db
      .select()
      .from(importJobs)
      .where(eq(importJobs.gymId, gymId))
      .orderBy(desc(importJobs.createdAt));
  }

  async updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob> {
    const [updated] = await db
      .update(importJobs)
      .set(updates)
      .where(eq(importJobs.id, id))
      .returning();
    return updated;
  }

  async findImportByHash(gymId: string, fileHash: string): Promise<ImportJob | undefined> {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.gymId, gymId), eq(importJobs.fileHash, fileHash)));
    return job;
  }

  async getLearningStats(gymId: string, recommendationTypes: string[]) {
    if (recommendationTypes.length === 0) return [];

    const rows = await db
      .select()
      .from(recommendationLearningStats)
      .where(
        and(
          inArray(recommendationLearningStats.recommendationType, recommendationTypes),
          sql`(${recommendationLearningStats.gymId} IS NULL OR ${recommendationLearningStats.gymId} = ${gymId})`
        )
      );

    return rows.map((row) => ({
      recommendationType: row.recommendationType,
      gymId: row.gymId,
      confidence: Number(row.confidence),
      expectedImpact: Number(row.expectedImpact),
      sampleSize: row.sampleSize,
    }));
  }

  async getWodifyConnection(gymId: string): Promise<WodifyConnection | undefined> {
    const [conn] = await db.select().from(wodifyConnections).where(eq(wodifyConnections.gymId, gymId));
    return conn;
  }

  async upsertWodifyConnection(connection: InsertWodifyConnection): Promise<WodifyConnection> {
    const existing = await this.getWodifyConnection(connection.gymId);
    if (existing) {
      const [updated] = await db
        .update(wodifyConnections)
        .set({ ...connection, connectedAt: new Date() })
        .where(eq(wodifyConnections.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(wodifyConnections).values(connection).returning();
    return created;
  }

  async updateWodifyConnection(id: string, updates: Partial<WodifyConnection>): Promise<WodifyConnection> {
    const [updated] = await db
      .update(wodifyConnections)
      .set(updates)
      .where(eq(wodifyConnections.id, id))
      .returning();
    return updated;
  }

  async deleteWodifyConnection(gymId: string): Promise<void> {
    await db.delete(wodifyConnections).where(eq(wodifyConnections.gymId, gymId));
  }

  async createWodifySyncRun(run: InsertWodifySyncRun): Promise<WodifySyncRun> {
    const [created] = await db.insert(wodifySyncRuns).values(run).returning();
    return created;
  }

  async updateWodifySyncRun(id: string, updates: Partial<WodifySyncRun>): Promise<WodifySyncRun> {
    const [updated] = await db
      .update(wodifySyncRuns)
      .set(updates)
      .where(eq(wodifySyncRuns.id, id))
      .returning();
    return updated;
  }

  async getWodifySyncRuns(gymId: string, limit = 20): Promise<WodifySyncRun[]> {
    return db
      .select()
      .from(wodifySyncRuns)
      .where(eq(wodifySyncRuns.gymId, gymId))
      .orderBy(desc(wodifySyncRuns.startedAt))
      .limit(limit);
  }

  async upsertWodifyRawClient(client: InsertWodifyRawClient): Promise<void> {
    await db
      .insert(wodifyRawClients)
      .values(client)
      .onConflictDoUpdate({
        target: [wodifyRawClients.gymId, wodifyRawClients.wodifyClientId],
        set: {
          payload: client.payload,
          sourceUpdatedAt: client.sourceUpdatedAt,
          ingestedAt: new Date(),
          syncRunId: client.syncRunId,
        },
      });
  }

  async upsertWodifyRawMembership(membership: InsertWodifyRawMembership): Promise<void> {
    await db
      .insert(wodifyRawMemberships)
      .values(membership)
      .onConflictDoUpdate({
        target: [wodifyRawMemberships.gymId, wodifyRawMemberships.wodifyMembershipId],
        set: {
          payload: membership.payload,
          wodifyClientId: membership.wodifyClientId,
          sourceUpdatedAt: membership.sourceUpdatedAt,
          ingestedAt: new Date(),
          syncRunId: membership.syncRunId,
        },
      });
  }

  async getWodifyRawClients(gymId: string): Promise<WodifyRawClient[]> {
    return db.select().from(wodifyRawClients).where(eq(wodifyRawClients.gymId, gymId));
  }

  async getWodifyRawMemberships(gymId: string): Promise<WodifyRawMembership[]> {
    return db.select().from(wodifyRawMemberships).where(eq(wodifyRawMemberships.gymId, gymId));
  }

  async createKnowledgeSource(source: InsertKnowledgeSource): Promise<KnowledgeSource> {
    const [created] = await db.insert(knowledgeSources).values(source).returning();
    return created;
  }

  async getKnowledgeSources(): Promise<KnowledgeSource[]> {
    return db.select().from(knowledgeSources).orderBy(desc(knowledgeSources.createdAt));
  }

  async getKnowledgeSource(id: string): Promise<KnowledgeSource | undefined> {
    const [source] = await db.select().from(knowledgeSources).where(eq(knowledgeSources.id, id));
    return source;
  }

  async getKnowledgeSourceByUrl(url: string): Promise<KnowledgeSource | undefined> {
    const [source] = await db.select().from(knowledgeSources).where(eq(knowledgeSources.url, url));
    return source;
  }

  async updateKnowledgeSource(id: string, updates: Partial<KnowledgeSource>): Promise<KnowledgeSource> {
    const [updated] = await db.update(knowledgeSources).set(updates).where(eq(knowledgeSources.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeSource(id: string): Promise<void> {
    const docs = await this.getKnowledgeDocuments(id);
    for (const doc of docs) {
      await this.deleteChunksByDocument(doc.id);
    }
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.sourceId, id));
    await db.delete(ingestJobs).where(eq(ingestJobs.sourceId, id));
    await db.delete(knowledgeSources).where(eq(knowledgeSources.id, id));
  }

  async upsertKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const [existing] = await db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.sourceId, doc.sourceId), eq(knowledgeDocuments.externalId, doc.externalId)));

    if (existing) {
      const [updated] = await db
        .update(knowledgeDocuments)
        .set({ title: doc.title, url: doc.url, channelName: doc.channelName, durationSeconds: doc.durationSeconds })
        .where(eq(knowledgeDocuments.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(knowledgeDocuments).values(doc).returning();
    return created;
  }

  async getKnowledgeDocuments(sourceId: string): Promise<KnowledgeDocument[]> {
    return db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.sourceId, sourceId)).orderBy(desc(knowledgeDocuments.ingestedAt));
  }

  async getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined> {
    const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    return doc;
  }

  async updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const [updated] = await db.update(knowledgeDocuments).set(updates).where(eq(knowledgeDocuments.id, id)).returning();
    return updated;
  }

  async createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
    const [created] = await db.insert(knowledgeChunks).values(chunk).returning();
    return created;
  }

  async getKnowledgeChunks(documentId: string): Promise<KnowledgeChunk[]> {
    return db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId)).orderBy(knowledgeChunks.chunkIndex);
  }

  async getKnowledgeChunksByIds(ids: string[]): Promise<KnowledgeChunk[]> {
    if (ids.length === 0) return [];
    return db.select().from(knowledgeChunks).where(inArray(knowledgeChunks.id, ids));
  }

  async searchChunksByVector(embedding: number[], taxonomyFilter: string[], limit: number): Promise<Array<KnowledgeChunk & { similarity: number; docTitle: string; docUrl: string }>> {
    const embeddingStr = `[${embedding.join(",")}]`;
    let taxonomyClause = "";
    const params: any[] = [embeddingStr, limit];

    if (taxonomyFilter.length > 0) {
      const tagConditions = taxonomyFilter.map((_, i) => `kc.taxonomy::jsonb @> $${i + 3}::jsonb`).join(" OR ");
      taxonomyClause = `AND (${tagConditions})`;
      for (const tag of taxonomyFilter) {
        params.push(JSON.stringify([tag]));
      }
    }

    const result = await pool.query(
      `SELECT kc.*, 1 - (kc.embedding <=> $1::vector) AS similarity,
              kd.title AS doc_title, kd.url AS doc_url
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.embedding IS NOT NULL ${taxonomyClause}
       ORDER BY kc.embedding <=> $1::vector
       LIMIT $2`,
      params
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: null as any,
      taxonomy: row.taxonomy,
      tsv: row.tsv,
      tokenCount: row.token_count,
      createdAt: row.created_at,
      similarity: parseFloat(row.similarity),
      docTitle: row.doc_title,
      docUrl: row.doc_url,
    }));
  }

  async searchChunksByText(query: string, taxonomyFilter: string[], limit: number): Promise<Array<KnowledgeChunk & { docTitle: string; docUrl: string }>> {
    const words = query.split(/\s+/).filter(Boolean).map(w => w.replace(/[^\w]/g, "")).filter(Boolean);
    if (words.length === 0) return [];
    const tsQuery = words.join(" | ");

    let taxonomyClause = "";
    const params: any[] = [tsQuery, limit];

    if (taxonomyFilter.length > 0) {
      const tagConditions = taxonomyFilter.map((_, i) => `kc.taxonomy::jsonb @> $${i + 3}::jsonb`).join(" OR ");
      taxonomyClause = `AND (${tagConditions})`;
      for (const tag of taxonomyFilter) {
        params.push(JSON.stringify([tag]));
      }
    }

    const result = await pool.query(
      `SELECT kc.*, kd.title AS doc_title, kd.url AS doc_url,
              ts_rank(to_tsvector('english', kc.content), to_tsquery('english', $1)) AS rank
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE to_tsvector('english', kc.content) @@ to_tsquery('english', $1)
       ${taxonomyClause}
       ORDER BY rank DESC
       LIMIT $2`,
      params
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: null as any,
      taxonomy: row.taxonomy,
      tsv: row.tsv,
      tokenCount: row.token_count,
      createdAt: row.created_at,
      docTitle: row.doc_title,
      docUrl: row.doc_url,
    }));
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await db.delete(recommendationChunkAudit).where(
      inArray(recommendationChunkAudit.chunkId,
        db.select({ id: knowledgeChunks.id }).from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId))
      )
    );
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  }

  async getKnowledgeStats(): Promise<{ sources: number; documents: number; chunks: number; embeddedChunks: number }> {
    const [srcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(knowledgeSources);
    const [docCount] = await db.select({ count: sql<number>`count(*)::int` }).from(knowledgeDocuments);
    const [chunkCount] = await db.select({ count: sql<number>`count(*)::int` }).from(knowledgeChunks);
    const [embCount] = await db.select({ count: sql<number>`count(*)::int` }).from(knowledgeChunks).where(sql`${knowledgeChunks.embedding} IS NOT NULL`);
    return {
      sources: srcCount.count,
      documents: docCount.count,
      chunks: chunkCount.count,
      embeddedChunks: embCount.count,
    };
  }

  async createRecommendationChunkAudit(audit: InsertRecommendationChunkAudit): Promise<RecommendationChunkAudit> {
    const [created] = await db.insert(recommendationChunkAudit).values(audit).returning();
    return created;
  }

  async getRecommendationAudits(gymId: string, periodStart: string): Promise<Array<RecommendationChunkAudit & { chunkContent: string; docTitle: string; docUrl: string }>> {
    const result = await pool.query(
      `SELECT rca.*, kc.content AS chunk_content, kd.title AS doc_title, kd.url AS doc_url
       FROM recommendation_chunk_audit rca
       JOIN knowledge_chunks kc ON kc.id = rca.chunk_id
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE rca.gym_id = $1 AND rca.period_start = $2
       ORDER BY rca.used_at DESC`,
      [gymId, periodStart]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      gymId: row.gym_id,
      periodStart: row.period_start,
      recommendationType: row.recommendation_type,
      chunkId: row.chunk_id,
      similarityScore: row.similarity_score,
      usedAt: row.used_at,
      chunkContent: row.chunk_content,
      docTitle: row.doc_title,
      docUrl: row.doc_url,
    }));
  }

  async createIngestJob(job: InsertIngestJob): Promise<IngestJob> {
    const [created] = await db.insert(ingestJobs).values(job).returning();
    return created;
  }

  async updateIngestJob(id: string, updates: Partial<IngestJob>): Promise<IngestJob> {
    const [updated] = await db.update(ingestJobs).set(updates).where(eq(ingestJobs.id, id)).returning();
    return updated;
  }

  async getIngestJobs(sourceId?: string): Promise<IngestJob[]> {
    if (sourceId) {
      return db.select().from(ingestJobs).where(eq(ingestJobs.sourceId, sourceId)).orderBy(desc(ingestJobs.startedAt));
    }
    return db.select().from(ingestJobs).orderBy(desc(ingestJobs.startedAt)).limit(50);
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async getLeadsByGym(gymId: string, start: Date, end: Date): Promise<Lead[]> {
    return db.select().from(leads).where(
      and(eq(leads.gymId, gymId), gte(leads.createdAt, start), lte(leads.createdAt, end))
    ).orderBy(desc(leads.createdAt));
  }

  async getLeadById(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const [updated] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
    return updated;
  }

  async getLeadsByGymAllTime(gymId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.gymId, gymId)).orderBy(desc(leads.createdAt));
  }

  async createConsult(consult: InsertConsult): Promise<Consult> {
    const [created] = await db.insert(consults).values(consult).returning();
    return created;
  }

  async getConsultsByGym(gymId: string, start: Date, end: Date): Promise<Consult[]> {
    return db.select().from(consults).where(
      and(eq(consults.gymId, gymId), gte(consults.bookedAt, start), lte(consults.bookedAt, end))
    ).orderBy(desc(consults.bookedAt));
  }

  async getConsultsByGymAllTime(gymId: string): Promise<Consult[]> {
    return db.select().from(consults).where(eq(consults.gymId, gymId)).orderBy(desc(consults.bookedAt));
  }

  async updateConsult(id: string, updates: Partial<Consult>): Promise<Consult> {
    const [updated] = await db.update(consults).set(updates).where(eq(consults.id, id)).returning();
    return updated;
  }

  async createSalesMembership(membership: InsertSalesMembership): Promise<SalesMembership> {
    const [created] = await db.insert(salesMemberships).values(membership).returning();
    return created;
  }

  async getSalesMembershipsByGym(gymId: string, start: Date, end: Date): Promise<SalesMembership[]> {
    return db.select().from(salesMemberships).where(
      and(eq(salesMemberships.gymId, gymId), gte(salesMemberships.startedAt, start), lte(salesMemberships.startedAt, end))
    ).orderBy(desc(salesMemberships.startedAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async getPaymentsByGym(gymId: string, start: Date, end: Date): Promise<Payment[]> {
    return db.select().from(payments).where(
      and(eq(payments.gymId, gymId), gte(payments.paidAt, start), lte(payments.paidAt, end))
    ).orderBy(desc(payments.paidAt));
  }

  async createAiOperatorRun(run: InsertAiOperatorRun): Promise<AiOperatorRun> {
    const [created] = await db.insert(aiOperatorRuns).values(run).returning();
    return created;
  }

  async getAiOperatorRun(id: string): Promise<AiOperatorRun | undefined> {
    const [run] = await db.select().from(aiOperatorRuns).where(eq(aiOperatorRuns.id, id));
    return run;
  }

  async getAiOperatorRunsByGym(gymId: string): Promise<AiOperatorRun[]> {
    return db.select().from(aiOperatorRuns)
      .where(eq(aiOperatorRuns.gymId, gymId))
      .orderBy(desc(aiOperatorRuns.createdAt));
  }

  async updateAiOperatorRun(id: string, updates: Partial<AiOperatorRun>): Promise<AiOperatorRun> {
    const [updated] = await db.update(aiOperatorRuns).set(updates).where(eq(aiOperatorRuns.id, id)).returning();
    return updated;
  }

  async createOperatorTask(task: InsertOperatorTask): Promise<OperatorTask> {
    const [created] = await db.insert(operatorTasks).values(task).returning();
    return created;
  }

  async getOperatorTasksByGym(gymId: string, filters?: { status?: string; pill?: string }): Promise<OperatorTask[]> {
    const conditions = [eq(operatorTasks.gymId, gymId)];
    if (filters?.status) {
      conditions.push(eq(operatorTasks.status, filters.status));
    }
    if (filters?.pill) {
      conditions.push(eq(operatorTasks.pill, filters.pill));
    }
    return db.select().from(operatorTasks)
      .where(and(...conditions))
      .orderBy(desc(operatorTasks.createdAt));
  }

  async getOperatorTasksByRun(runId: string): Promise<OperatorTask[]> {
    return db.select().from(operatorTasks)
      .where(eq(operatorTasks.operatorRunId, runId))
      .orderBy(operatorTasks.createdAt);
  }

  async updateOperatorTask(id: string, updates: Partial<OperatorTask>): Promise<OperatorTask> {
    const [updated] = await db.update(operatorTasks).set(updates).where(eq(operatorTasks.id, id)).returning();
    return updated;
  }

  async getOperatorTaskStats(gymId: string): Promise<{
    totalProjectedImpact: number;
    tasksByPill: Record<string, { pending: number; in_progress: number; complete: number }>;
    completionRate: number;
    totalTasks: number;
  }> {
    const tasks = await db.select().from(operatorTasks).where(eq(operatorTasks.gymId, gymId));

    let totalProjectedImpact = 0;
    const tasksByPill: Record<string, { pending: number; in_progress: number; complete: number }> = {};
    let completedCount = 0;

    for (const task of tasks) {
      if (task.status !== "complete" && task.impactValueEstimate) {
        totalProjectedImpact += Number(task.impactValueEstimate);
      }

      if (!tasksByPill[task.pill]) {
        tasksByPill[task.pill] = { pending: 0, in_progress: 0, complete: 0 };
      }
      const statusKey = task.status as "pending" | "in_progress" | "complete";
      if (tasksByPill[task.pill][statusKey] !== undefined) {
        tasksByPill[task.pill][statusKey]++;
      }

      if (task.status === "complete") {
        completedCount++;
      }
    }

    return {
      totalProjectedImpact,
      tasksByPill,
      completionRate: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
      totalTasks: tasks.length,
    };
  }

  async createInterventionOutcome(outcome: InsertInterventionOutcome): Promise<InterventionOutcome> {
    const [created] = await db.insert(interventionOutcomes).values(outcome).returning();
    return created;
  }

  async deleteOperatorTasksByGym(gymId: string): Promise<number> {
    const deleted = await db.delete(operatorTasks).where(eq(operatorTasks.gymId, gymId)).returning();
    return deleted.length;
  }

  async getMemberBillingByGym(gymId: string, billingMonth: string): Promise<MemberBilling[]> {
    return db.select().from(memberBilling)
      .where(and(eq(memberBilling.gymId, gymId), eq(memberBilling.billingMonth, billingMonth)))
      .orderBy(memberBilling.dueDate);
  }

  async getAllMemberBillingByGym(gymId: string): Promise<MemberBilling[]> {
    return db.select().from(memberBilling)
      .where(eq(memberBilling.gymId, gymId))
      .orderBy(desc(memberBilling.billingMonth));
  }

  async upsertMemberBilling(billing: InsertMemberBilling): Promise<MemberBilling> {
    const existing = await db.select().from(memberBilling)
      .where(and(
        eq(memberBilling.memberId, billing.memberId!),
        eq(memberBilling.billingMonth, billing.billingMonth!)
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(memberBilling)
        .set(billing)
        .where(eq(memberBilling.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(memberBilling).values(billing).returning();
    return created;
  }

  async updateMemberBilling(id: string, updates: Partial<MemberBilling>): Promise<MemberBilling> {
    const [updated] = await db.update(memberBilling)
      .set(updates)
      .where(eq(memberBilling.id, id))
      .returning();
    return updated;
  }

  async getMemberBillingByMember(memberId: string, billingMonth: string): Promise<MemberBilling | undefined> {
    const [record] = await db.select().from(memberBilling)
      .where(and(eq(memberBilling.memberId, memberId), eq(memberBilling.billingMonth, billingMonth)));
    return record;
  }

  async getSubscriptionByGym(gymId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.gymId, gymId));
    return sub;
  }

  async getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
    return sub;
  }

  async getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return sub;
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(sub).returning();
    return created;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const [updated] = await db.update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated;
  }

  async getGymStaffRole(gymId: string, userId: string): Promise<GymStaffRole | null> {
    const [row] = await db.select({ role: gymStaff.role })
      .from(gymStaff)
      .where(and(eq(gymStaff.gymId, gymId), eq(gymStaff.userId, userId)));
    return row ? (row.role as GymStaffRole) : null;
  }

  async getGymsForUser(userId: string): Promise<Gym[]> {
    const staffGyms = await db
      .select({ gym: gyms })
      .from(gymStaff)
      .innerJoin(gyms, eq(gymStaff.gymId, gyms.id))
      .where(eq(gymStaff.userId, userId));
    const staffGymIds = new Set(staffGyms.map(r => r.gym.id));
    const ownedGyms = await db.select().from(gyms).where(eq(gyms.ownerId, userId));
    const result = staffGyms.map(r => r.gym);
    for (const g of ownedGyms) {
      if (!staffGymIds.has(g.id)) result.push(g);
    }
    return result;
  }

  async getGymStaff(gymId: string): Promise<GymStaff[]> {
    return db.select().from(gymStaff).where(eq(gymStaff.gymId, gymId));
  }

  async addGymStaff(staff: InsertGymStaff): Promise<GymStaff> {
    const [created] = await db.insert(gymStaff).values(staff).returning();
    return created;
  }

  async removeGymStaff(gymId: string, userId: string): Promise<void> {
    await db.delete(gymStaff)
      .where(and(eq(gymStaff.gymId, gymId), eq(gymStaff.userId, userId)));
  }

  async updateGymStaffRole(gymId: string, userId: string, role: GymStaffRole): Promise<GymStaff> {
    const [updated] = await db.update(gymStaff)
      .set({ role })
      .where(and(eq(gymStaff.gymId, gymId), eq(gymStaff.userId, userId)))
      .returning();
    return updated;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getGymStaffByEmail(gymId: string, email: string): Promise<GymStaff | undefined> {
    const result = await db
      .select({ gymStaff })
      .from(gymStaff)
      .innerJoin(users, eq(gymStaff.userId, users.id))
      .where(and(eq(gymStaff.gymId, gymId), eq(users.email, email)));
    return result[0]?.gymStaff;
  }

  async createStaffInvite(invite: InsertStaffInvite): Promise<StaffInvite> {
    const [created] = await db.insert(staffInvites).values(invite).returning();
    return created;
  }

  async getStaffInviteByToken(token: string): Promise<StaffInvite | undefined> {
    const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.token, token));
    return invite;
  }

  async updateStaffInviteStatus(id: string, status: string): Promise<void> {
    await db.update(staffInvites).set({ status }).where(eq(staffInvites.id, id));
  }

  async getGymStaffInvites(gymId: string): Promise<StaffInvite[]> {
    return db.select().from(staffInvites)
      .where(eq(staffInvites.gymId, gymId))
      .orderBy(desc(staffInvites.createdAt));
  }

  async getStripeConnection(gymId: string): Promise<StripeConnection | undefined> {
    const [conn] = await db.select().from(stripeConnections).where(eq(stripeConnections.gymId, gymId));
    return conn;
  }

  async upsertStripeConnection(connection: InsertStripeConnection): Promise<StripeConnection> {
    const [result] = await db
      .insert(stripeConnections)
      .values(connection)
      .onConflictDoUpdate({
        target: [stripeConnections.gymId],
        set: {
          status: connection.status,
          stripeAccountId: connection.stripeAccountId,
          apiKeyEncrypted: connection.apiKeyEncrypted,
          apiKeyFingerprint: connection.apiKeyFingerprint,
          webhookSecret: connection.webhookSecret,
        },
      })
      .returning();
    return result;
  }

  async updateStripeConnection(id: string, updates: Partial<StripeConnection>): Promise<StripeConnection> {
    const [updated] = await db.update(stripeConnections).set(updates).where(eq(stripeConnections.id, id)).returning();
    return updated;
  }

  async deleteStripeConnection(gymId: string): Promise<void> {
    await db.delete(stripeCustomerMatches).where(eq(stripeCustomerMatches.gymId, gymId));
    await db.delete(stripeWebhookEvents).where(eq(stripeWebhookEvents.gymId, gymId));
    await db.delete(stripeBillingRecords).where(eq(stripeBillingRecords.gymId, gymId));
    await db.delete(stripeSyncRuns).where(eq(stripeSyncRuns.gymId, gymId));
    await db.delete(stripeIntegrationEvents).where(eq(stripeIntegrationEvents.gymId, gymId));
    await db.delete(stripeConnections).where(eq(stripeConnections.gymId, gymId));
  }

  async createStripeSyncRun(run: InsertStripeSyncRun): Promise<StripeSyncRun> {
    const [created] = await db.insert(stripeSyncRuns).values(run).returning();
    return created;
  }

  async updateStripeSyncRun(id: string, updates: Partial<StripeSyncRun>): Promise<StripeSyncRun> {
    const [updated] = await db.update(stripeSyncRuns).set(updates).where(eq(stripeSyncRuns.id, id)).returning();
    return updated;
  }

  async getStripeSyncRuns(gymId: string, limit = 10): Promise<StripeSyncRun[]> {
    return db.select().from(stripeSyncRuns)
      .where(eq(stripeSyncRuns.gymId, gymId))
      .orderBy(desc(stripeSyncRuns.startedAt))
      .limit(limit);
  }

  async upsertStripeBillingRecord(record: InsertStripeBillingRecord): Promise<StripeBillingRecord> {
    const [result] = await db
      .insert(stripeBillingRecords)
      .values(record)
      .onConflictDoUpdate({
        target: [stripeBillingRecords.gymId, stripeBillingRecords.stripeInvoiceId],
        set: {
          amount: record.amount,
          currency: record.currency,
          status: record.status,
          paymentDate: record.paymentDate,
          dueDate: record.dueDate,
          description: record.description,
          customerEmail: record.customerEmail,
          customerName: record.customerName,
          memberId: record.memberId,
          stripeChargeId: record.stripeChargeId,
        },
      })
      .returning();
    return result;
  }

  async getStripeBillingRecords(gymId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<StripeBillingRecord[]> {
    const conditions = [eq(stripeBillingRecords.gymId, gymId)];
    if (options?.status) {
      conditions.push(eq(stripeBillingRecords.status, options.status));
    }
    let query = db.select().from(stripeBillingRecords)
      .where(and(...conditions))
      .orderBy(desc(stripeBillingRecords.paymentDate))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
    return query;
  }

  async getStripeBillingRecordCount(gymId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(stripeBillingRecords).where(eq(stripeBillingRecords.gymId, gymId));
    return Number(result?.count ?? 0);
  }

  async createStripeWebhookEvent(event: InsertStripeWebhookEvent): Promise<StripeWebhookEvent> {
    const [created] = await db.insert(stripeWebhookEvents).values(event).returning();
    return created;
  }

  async getStripeWebhookEvent(stripeEventId: string): Promise<StripeWebhookEvent | undefined> {
    const [event] = await db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
    return event;
  }

  async getStripeWebhookEvents(gymId: string, limit = 20): Promise<StripeWebhookEvent[]> {
    return db.select().from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.gymId, gymId))
      .orderBy(desc(stripeWebhookEvents.processedAt))
      .limit(limit);
  }

  async updateStripeWebhookEventStatus(stripeEventId: string, status: string): Promise<void> {
    await db.update(stripeWebhookEvents)
      .set({ status, processedAt: new Date() })
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
  }

  async getStripeCustomerMatches(gymId: string, options?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<StripeCustomerMatch[]> {
    const conditions = [eq(stripeCustomerMatches.gymId, gymId)];
    if (options?.status) {
      conditions.push(eq(stripeCustomerMatches.matchStatus, options.status));
    }
    if (options?.search) {
      const searchLower = `%${options.search.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${stripeCustomerMatches.stripeCustomerEmail}) LIKE ${searchLower} OR LOWER(${stripeCustomerMatches.stripeCustomerName}) LIKE ${searchLower})`
      );
    }
    return db.select().from(stripeCustomerMatches)
      .where(and(...conditions))
      .orderBy(desc(stripeCustomerMatches.matchConfidence))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
  }

  async upsertStripeCustomerMatch(data: InsertStripeCustomerMatch): Promise<StripeCustomerMatch> {
    const [result] = await db
      .insert(stripeCustomerMatches)
      .values(data)
      .onConflictDoUpdate({
        target: [stripeCustomerMatches.gymId, stripeCustomerMatches.stripeCustomerId],
        set: {
          stripeCustomerEmail: data.stripeCustomerEmail,
          stripeCustomerName: data.stripeCustomerName,
          memberId: data.memberId,
          matchStatus: data.matchStatus,
          matchMethod: data.matchMethod,
          matchConfidence: data.matchConfidence,
          matchedAt: data.matchedAt || new Date(),
          matchedBy: data.matchedBy,
          notes: data.notes,
        },
      })
      .returning();
    return result;
  }

  async updateStripeCustomerMatch(id: string, updates: Partial<StripeCustomerMatch>): Promise<StripeCustomerMatch> {
    const [updated] = await db.update(stripeCustomerMatches)
      .set(updates)
      .where(eq(stripeCustomerMatches.id, id))
      .returning();
    return updated;
  }

  async getStripeMatchCounts(gymId: string): Promise<{ matched: number; unmatched: number; ambiguous: number; ignored: number; total: number }> {
    const rows = await db.select({
      status: stripeCustomerMatches.matchStatus,
      count: sql<number>`count(*)`,
    }).from(stripeCustomerMatches)
      .where(eq(stripeCustomerMatches.gymId, gymId))
      .groupBy(stripeCustomerMatches.matchStatus);

    const counts = { matched: 0, unmatched: 0, ambiguous: 0, ignored: 0, total: 0 };
    for (const row of rows) {
      const c = Number(row.count);
      counts.total += c;
      if (row.status === "auto_matched" || row.status === "manually_matched") counts.matched += c;
      else if (row.status === "unmatched") counts.unmatched += c;
      else if (row.status === "ambiguous") counts.ambiguous += c;
      else if (row.status === "ignored") counts.ignored += c;
    }
    return counts;
  }

  async deleteStripeCustomerMatches(gymId: string): Promise<void> {
    await db.delete(stripeCustomerMatches).where(
      and(eq(stripeCustomerMatches.gymId, gymId), sql`${stripeCustomerMatches.matchStatus} != 'manually_matched'`)
    );
  }

  async createStripeIntegrationEvent(event: InsertStripeIntegrationEvent): Promise<StripeIntegrationEvent> {
    const [created] = await db.insert(stripeIntegrationEvents).values(event).returning();
    return created;
  }

  async getStripeIntegrationEvents(gymId: string, limit = 50): Promise<StripeIntegrationEvent[]> {
    return db.select().from(stripeIntegrationEvents)
      .where(eq(stripeIntegrationEvents.gymId, gymId))
      .orderBy(desc(stripeIntegrationEvents.createdAt))
      .limit(limit);
  }

  async getUniqueStripeCustomers(gymId: string): Promise<Array<{ stripeCustomerId: string; customerEmail: string | null; customerName: string | null }>> {
    const rows = await db.selectDistinctOn([stripeBillingRecords.stripeCustomerId], {
      stripeCustomerId: stripeBillingRecords.stripeCustomerId,
      customerEmail: stripeBillingRecords.customerEmail,
      customerName: stripeBillingRecords.customerName,
    }).from(stripeBillingRecords)
      .where(eq(stripeBillingRecords.gymId, gymId));
    return rows;
  }

  async updateStripeBillingRecordsMemberId(gymId: string, stripeCustomerId: string, memberId: string | null): Promise<void> {
    await db.update(stripeBillingRecords)
      .set({ memberId })
      .where(and(
        eq(stripeBillingRecords.gymId, gymId),
        eq(stripeBillingRecords.stripeCustomerId, stripeCustomerId),
      ));
  }
}

export const storage = new DatabaseStorage();
