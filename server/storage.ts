import {
  gyms, members, gymMonthlyMetrics, memberContacts, importJobs,
  recommendationLearningStats,
  type Gym, type InsertGym,
  type Member, type InsertMember,
  type GymMonthlyMetrics, type InsertGymMonthlyMetrics,
  type MemberContact, type InsertMemberContact,
  type ImportJob, type InsertImportJob,
} from "@shared/schema";
import { db } from "./db";
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
}

export const storage = new DatabaseStorage();
