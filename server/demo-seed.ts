import { db } from "./db";
import { gyms, members, memberContacts, gymMonthlyMetrics, leads, consults, salesMemberships, payments, memberBilling } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and } from "drizzle-orm";
import { DEMO_GYM_ID, DEMO_USER_ID } from "./replit_integrations/auth";
import { recomputeAllMetrics } from "./metrics";

let seeded = false;

export async function ensureDemoData(): Promise<void> {
  if (seeded) return;

  const existing = await db.select().from(gyms).where(eq(gyms.id, DEMO_GYM_ID));

  if (existing.length > 0) {
    await refreshDemoData();
  } else {
    await seedFreshDemoData();
  }

  seeded = true;
}

async function seedFreshDemoData() {
  console.log("[DEMO] Seeding demo gym data...");

  await db.insert(users).values({
    id: DEMO_USER_ID,
    email: "demo@ironmetrics.app",
    firstName: "Demo",
    lastName: "User",
  }).onConflictDoNothing();

  await db.insert(gyms).values({
    id: DEMO_GYM_ID,
    name: "CrossFit Gym",
    ownerId: DEMO_USER_ID,
    location: "Ozark, MO",
  });

  await populateDemoData(DEMO_GYM_ID);
  console.log("[DEMO] Demo data seeding complete");
}

async function refreshDemoData() {
  console.log("[DEMO] Refreshing demo data with current dates...");

  await db.delete(memberBilling).where(eq(memberBilling.gymId, DEMO_GYM_ID));
  await db.delete(payments).where(eq(payments.gymId, DEMO_GYM_ID));
  await db.delete(salesMemberships).where(eq(salesMemberships.gymId, DEMO_GYM_ID));
  await db.delete(consults).where(eq(consults.gymId, DEMO_GYM_ID));
  await db.delete(leads).where(eq(leads.gymId, DEMO_GYM_ID));
  await db.delete(memberContacts).where(eq(memberContacts.gymId, DEMO_GYM_ID));
  await db.delete(members).where(eq(members.gymId, DEMO_GYM_ID));
  await db.delete(gymMonthlyMetrics).where(eq(gymMonthlyMetrics.gymId, DEMO_GYM_ID));

  await populateDemoData(DEMO_GYM_ID);
  console.log("[DEMO] Demo data refresh complete");
}

async function populateDemoData(gymId: string) {
  const now = new Date();
  const memberData = generateDemoMembers(gymId, now);

  for (const m of memberData) {
    await db.insert(members).values(m);
  }
  console.log(`[DEMO] Seeded ${memberData.length} members`);

  try {
    await seedDemoLeads(gymId, now);
    console.log("[DEMO] Lead pipeline data seeded");
  } catch (e) {
    console.error("[DEMO] Lead seeding error (non-fatal):", e);
  }

  try {
    await seedDemoBilling(gymId, now);
    console.log("[DEMO] Billing data seeded");
  } catch (e) {
    console.error("[DEMO] Billing seeding error (non-fatal):", e);
  }

  try {
    await recomputeAllMetrics(gymId);
    console.log("[DEMO] Metrics computed successfully");
  } catch (e) {
    console.error("[DEMO] Metrics computation error (non-fatal):", e);
  }
}

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86400000).toISOString().split("T")[0];
}

function generateDemoMembers(gymId: string, now: Date) {
  const firstNames = [
    "Sarah", "Mike", "Jessica", "David", "Emily", "Chris", "Ashley", "Brian",
    "Lauren", "Ryan", "Amanda", "Justin", "Rachel", "Kevin", "Megan", "Andrew",
    "Brittany", "Josh", "Nicole", "Tyler", "Kayla", "Matt", "Stephanie", "Jason",
    "Heather", "Mark", "Danielle", "Eric", "Courtney", "Aaron", "Tiffany", "Derek",
    "Lindsey", "Brandon", "Kelly", "Sean", "Amber", "Kyle", "Michelle", "Travis",
    "Samantha", "Jake", "Rebecca", "Corey", "Katie", "Dustin", "Christina", "Zach",
    "Natalie", "Drew", "Morgan", "Ben", "Taylor", "Luke", "Jen", "Adam",
    "Alyssa", "Caleb", "Hannah", "Nate", "Brooke", "Jordan", "Melissa", "Chad",
    "Allison", "Cameron", "Leah", "Cody", "Crystal", "Trevor", "Diana", "Blake",
    "Erica", "Grant", "Holly", "Ian", "Jackie", "Keith", "Lori", "Marcus",
    "Paige", "Rob", "Sierra", "Tony", "Vanessa", "Wade", "Yvonne", "Zane",
    "Bethany", "Carter", "Dawn", "Evan", "Faith", "Gavin", "Hope", "Isaac",
    "Jade", "Kai", "Lily", "Mason", "Nina", "Owen", "Piper", "Quinn",
  ];

  const lastNames = [
    "Johnson", "Smith", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore",
    "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
    "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker",
    "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", "Hill",
    "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", "Mitchell",
    "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards",
    "Collins", "Stewart", "Sanchez", "Morris", "Rogers", "Reed", "Cook", "Morgan",
    "Bell", "Murphy", "Bailey", "Rivera", "Cooper", "Richardson", "Cox", "Howard",
    "Ward", "Torres", "Peterson", "Gray", "Ramirez", "James", "Watson", "Brooks",
    "Kelly", "Sanders", "Price", "Bennett", "Wood", "Barnes", "Ross", "Henderson",
    "Coleman", "Jenkins", "Perry", "Powell", "Long", "Patterson", "Hughes", "Flores",
    "Washington", "Butler", "Simmons", "Foster", "Gonzales", "Bryant", "Alexander", "Russell",
    "Griffin", "Diaz", "Hayes", "Myers", "Ford", "Hamilton", "Graham", "Sullivan",
  ];

  const rates = [149, 159, 169, 179, 189, 199, 209, 219, 229, 249, 275, 299];
  const membershipTypes = ["Unlimited", "Unlimited", "Unlimited", "3x/Week", "3x/Week", "5x/Week", "Competitor", "Drop-In", "Fundamentals", "Unlimited", "Unlimited", "5x/Week"];
  const result: any[] = [];

  // 100 total members: 88 active, 12 cancelled
  // Active breakdown by engagement:
  //   Core (tenure>90d, attended 0-3 days ago): ~62 members
  //   Rising (tenure≤90d, attended 0-3 days ago): ~10 members
  //   Drifter (attended 7-13 days ago): ~6 members
  //   At-Risk (attended 14-29 days ago): ~5 members
  //   Ghost (attended 30+ days ago): ~3 members
  //   Recent joins (tenure<30d, attending): ~2 members
  const totalActive = 88;
  const totalCancelled = 12;
  const totalMembers = totalActive + totalCancelled;

  for (let i = 0; i < totalMembers; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 0 ? i : ""}@example.com`;

    const isCancelled = i >= totalActive;
    let tenureDays: number;
    let daysSinceAttendance: number;

    if (isCancelled) {
      tenureDays = Math.floor(120 + Math.random() * 800);
      daysSinceAttendance = 0;
    } else if (i < 10) {
      // Veteran core — 3-5 year members, attended today or yesterday
      tenureDays = Math.floor(1100 + Math.random() * 700);
      daysSinceAttendance = Math.floor(Math.random() * 2);
    } else if (i < 30) {
      // Established core — 1-3 year members, attended within 3 days
      tenureDays = Math.floor(400 + Math.random() * 700);
      daysSinceAttendance = Math.floor(Math.random() * 3);
    } else if (i < 52) {
      // Solid core — 6-18 month members, attended within 3 days
      tenureDays = Math.floor(180 + Math.random() * 365);
      daysSinceAttendance = Math.floor(Math.random() * 4);
    } else if (i < 62) {
      // Recent core — 3-6 month members, attending regularly
      tenureDays = Math.floor(95 + Math.random() * 90);
      daysSinceAttendance = Math.floor(Math.random() * 3);
    } else if (i < 72) {
      // Rising — new members (<90 days) doing well
      tenureDays = Math.floor(15 + Math.random() * 75);
      daysSinceAttendance = Math.floor(Math.random() * 3);
    } else if (i < 78) {
      // Drifters — starting to slip (7-13 days since attendance)
      tenureDays = Math.floor(120 + Math.random() * 400);
      daysSinceAttendance = Math.floor(7 + Math.random() * 7);
    } else if (i < 83) {
      // At-risk — haven't been in 2-4 weeks
      tenureDays = Math.floor(90 + Math.random() * 500);
      daysSinceAttendance = Math.floor(14 + Math.random() * 16);
    } else if (i < 86) {
      // Ghosts — 30+ days absent
      tenureDays = Math.floor(150 + Math.random() * 600);
      daysSinceAttendance = Math.floor(32 + Math.random() * 30);
    } else {
      // Brand new members (< 2 weeks) — attending regularly
      tenureDays = Math.floor(3 + Math.random() * 12);
      daysSinceAttendance = Math.floor(Math.random() * 2);
    }

    const joinStr = daysAgo(now, tenureDays);

    let cancelStr: string | null = null;
    if (isCancelled) {
      const cancelDaysBack = Math.floor(5 + Math.random() * 85);
      cancelStr = daysAgo(now, cancelDaysBack);
    }

    let lastAttendedStr: string | null = null;
    if (!isCancelled) {
      lastAttendedStr = daysAgo(now, daysSinceAttendance);
    }

    const rate = rates[i % rates.length];
    const membershipType = isCancelled ? null : membershipTypes[i % membershipTypes.length];

    result.push({
      gymId,
      name,
      email,
      status: isCancelled ? "cancelled" : "active",
      joinDate: joinStr,
      cancelDate: cancelStr,
      lastAttendedDate: lastAttendedStr,
      monthlyRate: rate.toString(),
      membershipType,
    });
  }

  return result;
}

async function seedDemoLeads(gymId: string, now: Date) {
  const coaches = ["Coach Mike", "Coach Sarah", "Coach Alex"];

  const demoLeads: Array<{
    name: string; email: string; phone: string; source: string;
    coachId: string; notes: string; status: string;
    daysAgo: number; consultDaysOffset?: number; salePrice?: string;
    lostReason?: string;
  }> = [
    // NEW leads (6)
    { name: "Tom Bradley", email: "tom.b@example.com", phone: "(555) 100-0001", source: "Referral", coachId: coaches[0], notes: "Referred by member Jake — interested in CrossFit fundamentals", status: "new", daysAgo: 1 },
    { name: "Lisa Chen", email: "lisa.c@example.com", phone: "(555) 100-0002", source: "Facebook", coachId: coaches[1], notes: "Clicked on Facebook ad for January challenge", status: "new", daysAgo: 0 },
    { name: "Marcus Wright", email: "marcus.w@example.com", phone: "(555) 100-0003", source: "Walk-in", coachId: coaches[2], notes: "Walked in during open gym, left number", status: "new", daysAgo: 2 },
    { name: "Jenny Park", email: "jenny.p@example.com", phone: "(555) 100-0004", source: "Instagram", coachId: coaches[0], notes: "DM inquiry about class schedule", status: "new", daysAgo: 0 },
    { name: "Carlos Rivera", email: "carlos.r@example.com", phone: "(555) 100-0005", source: "Google", coachId: coaches[1], notes: "Found via Google search for CrossFit near me", status: "new", daysAgo: 3 },
    { name: "Aisha Johnson", email: "aisha.j@example.com", phone: "(555) 100-0006", source: "Website", coachId: coaches[2], notes: "Filled out website contact form", status: "new", daysAgo: 1 },

    // BOOKED leads (5) — have a consult scheduled
    { name: "Diana Foster", email: "diana.f@example.com", phone: "(555) 200-0001", source: "Referral", coachId: coaches[0], notes: "Friend of Sarah J — booked intro session", status: "booked", daysAgo: 6, consultDaysOffset: 2 },
    { name: "Kevin O'Brien", email: "kevin.o@example.com", phone: "(555) 200-0002", source: "Website", coachId: coaches[1], notes: "Signed up through website, confirmed consult", status: "booked", daysAgo: 5, consultDaysOffset: 1 },
    { name: "Priya Sharma", email: "priya.s@example.com", phone: "(555) 200-0003", source: "Facebook", coachId: coaches[2], notes: "Responded to challenge post, excited to start", status: "booked", daysAgo: 4, consultDaysOffset: 1 },
    { name: "James Mitchell", email: "james.m@example.com", phone: "(555) 200-0004", source: "Referral", coachId: coaches[0], notes: "Referred by member Nate — wants to try a class", status: "booked", daysAgo: 7, consultDaysOffset: 3 },
    { name: "Vanessa Cruz", email: "vanessa.c@example.com", phone: "(555) 200-0005", source: "Instagram", coachId: coaches[1], notes: "Saw member transformation post", status: "booked", daysAgo: 3, consultDaysOffset: 1 },

    // SHOWED leads (4) — attended consult, deciding
    { name: "Rachel Adams", email: "rachel.a@example.com", phone: "(555) 300-0001", source: "Walk-in", coachId: coaches[1], notes: "Came for free trial class — loved the energy", status: "showed", daysAgo: 10, consultDaysOffset: 4 },
    { name: "Derek Kim", email: "derek.k@example.com", phone: "(555) 300-0002", source: "Referral", coachId: coaches[2], notes: "Enjoyed consult, comparing with other gyms", status: "showed", daysAgo: 8, consultDaysOffset: 3 },
    { name: "Amanda Wells", email: "amanda.w@example.com", phone: "(555) 300-0003", source: "Google", coachId: coaches[0], notes: "Very interested, wants to talk to spouse first", status: "showed", daysAgo: 12, consultDaysOffset: 5 },
    { name: "Malik Thompson", email: "malik.t@example.com", phone: "(555) 300-0004", source: "Facebook", coachId: coaches[1], notes: "Great trial session — following up this week", status: "showed", daysAgo: 6, consultDaysOffset: 2 },

    // WON leads (8) — spread over last 90 days for sales trends
    { name: "Brian Taylor", email: "brian.t@example.com", phone: "(555) 400-0001", source: "Referral", coachId: coaches[0], notes: "Signed up immediately after consult", status: "won", daysAgo: 75, consultDaysOffset: 5, salePrice: "199.00" },
    { name: "Megan Scott", email: "megan.s@example.com", phone: "(555) 400-0002", source: "Facebook", coachId: coaches[1], notes: "Great fit for community", status: "won", daysAgo: 62, consultDaysOffset: 4, salePrice: "179.00" },
    { name: "Jason Lee", email: "jason.l@example.com", phone: "(555) 400-0003", source: "Walk-in", coachId: coaches[2], notes: "Started with fundamentals program", status: "won", daysAgo: 48, consultDaysOffset: 3, salePrice: "219.00" },
    { name: "Courtney Hall", email: "courtney.h@example.com", phone: "(555) 400-0004", source: "Instagram", coachId: coaches[0], notes: "Loved the atmosphere, signed same day", status: "won", daysAgo: 35, consultDaysOffset: 2, salePrice: "189.00" },
    { name: "Tyler Brooks", email: "tyler.b@example.com", phone: "(555) 400-0005", source: "Referral", coachId: coaches[1], notes: "Referred by 2 existing members", status: "won", daysAgo: 25, consultDaysOffset: 4, salePrice: "249.00" },
    { name: "Sophia Nguyen", email: "sophia.n@example.com", phone: "(555) 400-0006", source: "Google", coachId: coaches[2], notes: "Signed up after second visit", status: "won", daysAgo: 18, consultDaysOffset: 5, salePrice: "199.00" },
    { name: "Ethan Morris", email: "ethan.m@example.com", phone: "(555) 400-0007", source: "Website", coachId: coaches[0], notes: "Committed after fundamentals class", status: "won", daysAgo: 10, consultDaysOffset: 3, salePrice: "209.00" },
    { name: "Olivia Reyes", email: "olivia.r@example.com", phone: "(555) 400-0008", source: "Walk-in", coachId: coaches[1], notes: "Walked in, tried a class, signed up on the spot", status: "won", daysAgo: 5, consultDaysOffset: 1, salePrice: "189.00" },

    // LOST leads (4) — various reasons
    { name: "Nicole Perez", email: "nicole.p@example.com", phone: "(555) 500-0001", source: "Google", coachId: coaches[2], notes: "Too far from home — 30min drive", status: "lost", daysAgo: 45, lostReason: "chose_competitor" },
    { name: "Ryan Cooper", email: "ryan.c@example.com", phone: "(555) 500-0002", source: "Facebook", coachId: coaches[0], notes: "Budget concerns — looking at budget gyms", status: "lost", daysAgo: 30, lostReason: "price" },
    { name: "Stephanie Evans", email: "stephanie.e@example.com", phone: "(555) 500-0003", source: "Walk-in", coachId: coaches[1], notes: "No-showed consult twice, stopped responding", status: "lost", daysAgo: 20, lostReason: "no_show" },
    { name: "Greg Patterson", email: "greg.p@example.com", phone: "(555) 500-0004", source: "Referral", coachId: coaches[2], notes: "Decided to do home workouts instead", status: "lost", daysAgo: 55, lostReason: "not_interested" },
  ];

  for (const dl of demoLeads) {
    const createdAt = new Date(now.getTime() - dl.daysAgo * 86400000);
    const responseMinutes = 5 + Math.floor(Math.random() * 25);
    const firstContactAt = new Date(createdAt.getTime() + responseMinutes * 60000);

    const leadData: any = {
      gymId,
      name: dl.name,
      email: dl.email,
      phone: dl.phone,
      source: dl.source,
      coachId: dl.coachId,
      notes: dl.notes,
      status: dl.status,
      createdAt,
      firstContactAt,
      lastContactAt: firstContactAt,
    };

    if (dl.status !== "new") {
      const hoursLater = 2 + Math.floor(Math.random() * 24);
      leadData.lastContactAt = new Date(firstContactAt.getTime() + hoursLater * 3600000);
    }

    if (dl.status === "booked" || dl.status === "showed" || dl.status === "won") {
      leadData.bookedAt = new Date(createdAt.getTime() + 86400000);
      leadData.consultDate = new Date(createdAt.getTime() + (dl.consultDaysOffset || 3) * 86400000);
    }

    if (dl.status === "showed" || dl.status === "won") {
      leadData.showedAt = new Date(createdAt.getTime() + (dl.consultDaysOffset || 3) * 86400000);
      leadData.lastContactAt = leadData.showedAt;
    }

    if (dl.status === "won") {
      leadData.wonAt = new Date(createdAt.getTime() + ((dl.consultDaysOffset || 3) + 1) * 86400000);
      leadData.salePrice = dl.salePrice;
      leadData.lastContactAt = leadData.wonAt;
    }

    if (dl.status === "lost") {
      leadData.lostAt = new Date(createdAt.getTime() + 5 * 86400000);
      leadData.lostReason = dl.lostReason;
      leadData.lastContactAt = leadData.lostAt;
    }

    if (dl.status === "booked") {
      leadData.nextActionDate = leadData.consultDate;
    } else if (dl.status === "showed") {
      leadData.nextActionDate = new Date(now.getTime() + (1 + Math.floor(Math.random() * 3)) * 86400000);
    }

    const [lead] = await db.insert(leads).values(leadData).returning();

    if (dl.status === "booked" || dl.status === "showed" || dl.status === "won") {
      const consultData: any = {
        gymId,
        leadId: lead.id,
        bookedAt: leadData.bookedAt,
        scheduledFor: leadData.consultDate,
        coachId: dl.coachId,
      };
      if (dl.status === "showed" || dl.status === "won") {
        consultData.showedAt = leadData.showedAt;
      }
      await db.insert(consults).values(consultData);
    }

    if (dl.status === "won" && dl.salePrice) {
      const [membership] = await db.insert(salesMemberships).values({
        gymId,
        leadId: lead.id,
        startedAt: leadData.wonAt,
        priceMonthly: dl.salePrice,
        status: "active",
      }).returning();

      await db.insert(payments).values({
        gymId,
        membershipId: membership.id,
        amount: dl.salePrice,
        paidAt: leadData.wonAt,
      });
    }
  }
}

async function seedDemoBilling(gymId: string, now: Date) {
  const allMembers = await db.select().from(members).where(eq(members.gymId, gymId));
  const activeMembers = allMembers.filter(m => m.status === "active" && Number(m.monthlyRate) > 0);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Seed 3 months of billing history + current month
  for (let monthOffset = 3; monthOffset >= 0; monthOffset--) {
    const billingDate = new Date(currentYear, currentMonth - monthOffset, 1);
    const billingYear = billingDate.getFullYear();
    const billingMonth = billingDate.getMonth();
    const billingMonthStr = `${billingYear}-${String(billingMonth + 1).padStart(2, "0")}-01`;
    const isCurrentMonth = monthOffset === 0;

    let overdueCount = 0;

    for (const member of activeMembers) {
      const joinDate = new Date(member.joinDate + "T12:00:00Z");
      if (joinDate > billingDate) continue;

      const joinDay = Math.min(joinDate.getUTCDate(), 28);
      const rate = Number(member.monthlyRate);
      const dueDateStr = `${billingYear}-${String(billingMonth + 1).padStart(2, "0")}-${String(joinDay).padStart(2, "0")}`;

      let status: string;
      let amountPaid = "0";
      let paidAt: Date | null = null;

      if (!isCurrentMonth) {
        // Past months: 95% paid, 5% paid late
        status = "paid";
        amountPaid = rate.toString();
        const paidDay = joinDay + Math.floor(Math.random() * 3);
        paidAt = new Date(billingYear, billingMonth, Math.min(paidDay, 28));
      } else {
        // Current month billing
        if (joinDay < currentDay - 2) {
          // Due date has passed
          if (overdueCount < 3 && Math.random() < 0.06) {
            status = "overdue";
            overdueCount++;
          } else {
            status = "paid";
            amountPaid = rate.toString();
            const paidDay = joinDay + Math.floor(Math.random() * 2);
            paidAt = new Date(currentYear, currentMonth, Math.min(paidDay, currentDay));
          }
        } else if (joinDay <= currentDay) {
          // Due today or yesterday
          if (Math.random() < 0.7) {
            status = "paid";
            amountPaid = rate.toString();
            paidAt = new Date(currentYear, currentMonth, joinDay);
          } else {
            status = "pending";
          }
        } else {
          // Not yet due
          status = "pending";
        }
      }

      await db.insert(memberBilling).values({
        gymId,
        memberId: member.id,
        billingMonth: billingMonthStr,
        amountDue: rate.toString(),
        amountPaid,
        status,
        dueDate: dueDateStr,
        paidAt,
      });
    }

    // Guarantee at least 1 overdue in current month
    if (isCurrentMonth && overdueCount === 0) {
      const eligibleForOverdue = activeMembers.filter(m => {
        const jd = new Date(m.joinDate + "T12:00:00Z");
        return jd <= billingDate;
      });

      if (eligibleForOverdue.length > 0) {
        const target = eligibleForOverdue[0];
        const targetJoinDay = Math.min(new Date(target.joinDate + "T12:00:00Z").getUTCDate(), 28);
        const overdueDueDate = `${billingYear}-${String(billingMonth + 1).padStart(2, "0")}-${String(Math.min(targetJoinDay, currentDay > 1 ? currentDay - 1 : 1)).padStart(2, "0")}`;

        await db.update(memberBilling)
          .set({ status: "overdue", amountPaid: "0", paidAt: null, dueDate: overdueDueDate })
          .where(
            and(
              eq(memberBilling.gymId, gymId),
              eq(memberBilling.memberId, target.id),
              eq(memberBilling.billingMonth, billingMonthStr)
            )
          );
      }
    }
  }
}
