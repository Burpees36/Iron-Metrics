import {
  gyms, members, gymMonthlyMetrics, memberContacts, importJobs,
  recommendationLearningStats,
  wodifyConnections, wodifySyncRuns, wodifyRawClients, wodifyRawMemberships,
  knowledgeSources, knowledgeDocuments, knowledgeChunks,
  recommendationChunkAudit, ingestJobs,
  type Gym, type InsertGym,
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
} from "@shared/schema";
import { db } from "./db";
import { pool } from "./db";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";

export interface IStorage {
  createGym(gym: InsertGym): Promise<Gym>;
  getGym(id: string): Promise<Gym | undefined>;
  getGymsByOwner(ownerId: string): Promise<Gym[]>;

  upsertMember(member: InsertMember): Promise<{ action: "inserted" | "updated" }>;
  getMembersByGym(gymId: string): Promise<Member[]>;
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
        await db
          .update(members)
          .set({
            name: member.name,
            status: member.status,
            joinDate: member.joinDate,
            cancelDate: member.cancelDate,
            monthlyRate: member.monthlyRate,
          })
          .where(eq(members.id, existing.id));
        return { action: "updated" };
      }
    }

    await db.insert(members).values(member);
    return { action: "inserted" };
  }

  async getMembersByGym(gymId: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.gymId, gymId));
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
    const tsQuery = query.split(/\s+/).filter(Boolean).map(w => w.replace(/[^\w]/g, "")).filter(Boolean).join(" & ");
    if (!tsQuery) return [];

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
}

export const storage = new DatabaseStorage();
