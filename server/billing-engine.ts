import { storage } from "./storage";
import type { Member, MemberBilling } from "@shared/schema";

export interface BillingRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  membershipType: string | null;
  monthlyRate: number;
  billingDay: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  amountDue: number;
  amountPaid: number;
  paidAt: string | null;
  notes: string | null;
  billingId: string | null;
}

export interface CollectionScheduleDay {
  day: number;
  date: string;
  expectedAmount: number;
  collectedAmount: number;
  memberCount: number;
  members: { name: string; amount: number; status: "paid" | "pending" | "overdue" }[];
}

export interface BillingSummary {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  collectionRate: number;
  projectedEndOfMonth: number;
}

function getBillingDay(joinDate: string): number {
  const day = new Date(joinDate + "T12:00:00Z").getUTCDate();
  return Math.min(day, 28);
}

function getDueDate(year: number, month: number, billingDay: number): string {
  const d = new Date(Date.UTC(year, month, billingDay));
  return d.toISOString().split("T")[0];
}

export async function generateBillingData(
  gymId: string,
  year: number,
  month: number
): Promise<{
  records: BillingRecord[];
  schedule: CollectionScheduleDay[];
  summary: BillingSummary;
}> {
  const billingMonthStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const allMembers = await storage.getMembersByGym(gymId);
  const activeMembers = allMembers.filter((m) => {
    if (m.status !== "active") {
      if (m.cancelDate) {
        const cancelDate = new Date(m.cancelDate + "T12:00:00Z");
        const monthEnd = new Date(Date.UTC(year, month + 1, 0));
        if (cancelDate < new Date(Date.UTC(year, month, 1))) return false;
      } else {
        return false;
      }
    }
    const joinDate = new Date(m.joinDate + "T12:00:00Z");
    if (joinDate > new Date(Date.UTC(year, month + 1, 0))) return false;
    return true;
  });

  const existingBilling = await storage.getMemberBillingByGym(gymId, billingMonthStr);
  const billingMap = new Map<string, MemberBilling>();
  for (const b of existingBilling) {
    billingMap.set(b.memberId, b);
  }

  const today = new Date();
  const currentDay = today.getUTCDate();
  const isCurrentMonth =
    today.getUTCFullYear() === year && today.getUTCMonth() === month;
  const isPastMonth =
    year < today.getUTCFullYear() ||
    (year === today.getUTCFullYear() && month < today.getUTCMonth());

  const records: BillingRecord[] = [];

  for (const member of activeMembers) {
    const rate = Number(member.monthlyRate) || 0;
    if (rate <= 0) continue;

    const billingDay = getBillingDay(member.joinDate);
    const dueDate = getDueDate(year, month, billingDay);

    const existing = billingMap.get(member.id);

    let status: "paid" | "pending" | "overdue";
    let amountPaid = 0;
    let paidAt: string | null = null;
    let notes: string | null = null;
    let billingId: string | null = null;

    if (existing) {
      status = existing.status as "paid" | "pending" | "overdue";
      amountPaid = Number(existing.amountPaid) || 0;
      paidAt = existing.paidAt ? existing.paidAt.toISOString() : null;
      notes = existing.notes;
      billingId = existing.id;
    } else {
      if (isPastMonth) {
        status = "overdue";
      } else if (isCurrentMonth) {
        status = billingDay <= currentDay ? "overdue" : "pending";
      } else {
        status = "pending";
      }
    }

    records.push({
      id: member.id,
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      membershipType: member.membershipType || null,
      monthlyRate: rate,
      billingDay,
      dueDate,
      status,
      amountDue: rate,
      amountPaid,
      paidAt,
      notes,
      billingId,
    });
  }

  records.sort((a, b) => a.billingDay - b.billingDay);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const scheduleMap = new Map<number, CollectionScheduleDay>();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    scheduleMap.set(d, {
      day: d,
      date: dateStr,
      expectedAmount: 0,
      collectedAmount: 0,
      memberCount: 0,
      members: [],
    });
  }

  for (const r of records) {
    const dayEntry = scheduleMap.get(r.billingDay);
    if (dayEntry) {
      dayEntry.expectedAmount += r.amountDue;
      dayEntry.memberCount++;
      if (r.status === "paid") {
        dayEntry.collectedAmount += r.amountPaid;
      }
      dayEntry.members.push({
        name: r.memberName,
        amount: r.amountDue,
        status: r.status,
      });
    }
  }

  const schedule = Array.from(scheduleMap.values()).filter(
    (d) => d.memberCount > 0
  );

  const totalExpected = records.reduce((s, r) => s + r.amountDue, 0);
  const totalCollected = records
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amountPaid, 0);
  const paidCount = records.filter((r) => r.status === "paid").length;
  const pendingCount = records.filter((r) => r.status === "pending").length;
  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const totalPending = records
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amountDue, 0);
  const totalOverdue = records
    .filter((r) => r.status === "overdue")
    .reduce((s, r) => s + r.amountDue, 0);

  let projectedEndOfMonth = totalCollected;
  for (const r of records) {
    if (r.status === "pending") {
      projectedEndOfMonth += r.amountDue;
    }
  }

  const summary: BillingSummary = {
    totalExpected,
    totalCollected,
    totalPending,
    totalOverdue,
    paidCount,
    pendingCount,
    overdueCount,
    collectionRate:
      totalExpected > 0
        ? Math.round((totalCollected / totalExpected) * 100)
        : 0,
    projectedEndOfMonth,
  };

  return { records, schedule, summary };
}
