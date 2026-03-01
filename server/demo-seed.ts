import { db } from "./db";
import { gyms, members, gymMonthlyMetrics, leads, consults, salesMemberships, payments } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { DEMO_GYM_ID, DEMO_USER_ID } from "./replit_integrations/auth";
import { recomputeAllMetrics } from "./metrics";
import { storage } from "./storage";

let seeded = false;

export async function ensureDemoData(): Promise<void> {
  if (seeded) return;

  const existing = await db.select().from(gyms).where(eq(gyms.id, DEMO_GYM_ID));
  if (existing.length > 0) {
    seeded = true;
    return;
  }

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

  const now = new Date();
  const memberData = generateDemoMembers(DEMO_GYM_ID, now);

  for (const m of memberData) {
    await db.insert(members).values(m);
  }

  console.log(`[DEMO] Seeded ${memberData.length} members`);

  try {
    await seedDemoLeads(DEMO_GYM_ID);
    console.log("[DEMO] Lead pipeline data seeded");
  } catch (e) {
    console.error("[DEMO] Lead seeding error (non-fatal):", e);
  }

  try {
    await recomputeAllMetrics(DEMO_GYM_ID);
    console.log("[DEMO] Metrics computed successfully");
  } catch (e) {
    console.error("[DEMO] Metrics computation error (non-fatal):", e);
  }

  seeded = true;
  console.log("[DEMO] Demo data seeding complete");
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
    "Riley", "Scott", "Tara", "Uma", "Victor"
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
    "Griffin", "Diaz", "Hayes", "Myers", "Ford", "Hamilton", "Graham", "Sullivan"
  ];

  const rates = [149, 159, 169, 179, 189, 199, 209, 219, 229, 249, 275, 299];

  const result: any[] = [];
  const totalMembers = 108;

  for (let i = 0; i < totalMembers; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 0 ? i : ""}@example.com`;

    const isCancelled = i >= 90;
    const tenureDays = isCancelled
      ? Math.floor(60 + Math.random() * 400)
      : Math.floor(14 + Math.random() * 730);
    const joinDate = new Date(now.getTime() - tenureDays * 86400000);
    const joinStr = joinDate.toISOString().split("T")[0];

    let cancelStr: string | null = null;
    if (isCancelled) {
      const cancelDaysAgo = Math.floor(Math.random() * 90);
      const cancelDate = new Date(now.getTime() - cancelDaysAgo * 86400000);
      cancelStr = cancelDate.toISOString().split("T")[0];
    }

    let lastAttendedStr: string | null = null;
    if (!isCancelled) {
      let daysSinceAttendance: number;
      if (i < 10) {
        daysSinceAttendance = Math.floor(Math.random() * 3);
      } else if (i < 50) {
        daysSinceAttendance = Math.floor(Math.random() * 7);
      } else if (i < 70) {
        daysSinceAttendance = Math.floor(7 + Math.random() * 14);
      } else if (i < 80) {
        daysSinceAttendance = Math.floor(14 + Math.random() * 21);
      } else {
        daysSinceAttendance = Math.floor(30 + Math.random() * 60);
      }
      const lastAttended = new Date(now.getTime() - daysSinceAttendance * 86400000);
      lastAttendedStr = lastAttended.toISOString().split("T")[0];
    }

    const rate = rates[i % rates.length];

    result.push({
      gymId,
      name,
      email,
      status: isCancelled ? "cancelled" : "active",
      joinDate: joinStr,
      cancelDate: cancelStr,
      lastAttendedDate: lastAttendedStr,
      monthlyRate: rate.toString(),
    });
  }

  return result;
}

async function seedDemoLeads(gymId: string) {
  const now = new Date();
  const coaches = ["Coach Mike", "Coach Sarah", "Coach Alex"];
  const sources = ["Referral", "Facebook", "Instagram", "Google", "Walk-in", "Website"];

  const demoLeads: Array<{
    name: string; email: string; phone: string; source: string;
    coachId: string; notes: string; status: string;
    daysAgo: number; consultDaysOffset?: number; salePrice?: string;
    lostReason?: string;
  }> = [
    { name: "Tom Bradley", email: "tom.b@example.com", phone: "(555) 100-0001", source: "Referral", coachId: coaches[0], notes: "Referred by member Jake", status: "new", daysAgo: 2 },
    { name: "Lisa Chen", email: "lisa.c@example.com", phone: "(555) 100-0002", source: "Facebook", coachId: coaches[1], notes: "Saw Facebook ad", status: "new", daysAgo: 1 },
    { name: "Marcus Wright", email: "marcus.w@example.com", phone: "(555) 100-0003", source: "Walk-in", coachId: coaches[2], notes: "Walked in during open gym", status: "new", daysAgo: 3 },
    { name: "Jenny Park", email: "jenny.p@example.com", phone: "(555) 100-0004", source: "Instagram", coachId: coaches[0], notes: "DM inquiry", status: "new", daysAgo: 0 },
    { name: "Carlos Rivera", email: "carlos.r@example.com", phone: "(555) 100-0005", source: "Google", coachId: coaches[1], notes: "Found via Google search", status: "new", daysAgo: 4 },

    { name: "Diana Foster", email: "diana.f@example.com", phone: "(555) 200-0001", source: "Referral", coachId: coaches[0], notes: "Friend of Sarah J.", status: "booked", daysAgo: 8, consultDaysOffset: 3 },
    { name: "Kevin O'Brien", email: "kevin.o@example.com", phone: "(555) 200-0002", source: "Website", coachId: coaches[1], notes: "Signed up through website form", status: "booked", daysAgo: 6, consultDaysOffset: 2 },
    { name: "Priya Sharma", email: "priya.s@example.com", phone: "(555) 200-0003", source: "Facebook", coachId: coaches[2], notes: "Responded to January challenge post", status: "booked", daysAgo: 5, consultDaysOffset: 1 },
    { name: "James Mitchell", email: "james.m@example.com", phone: "(555) 200-0004", source: "Referral", coachId: coaches[0], notes: "Referred by member Nate", status: "booked", daysAgo: 7, consultDaysOffset: 4 },

    { name: "Rachel Adams", email: "rachel.a@example.com", phone: "(555) 300-0001", source: "Walk-in", coachId: coaches[1], notes: "Came for free trial class", status: "showed", daysAgo: 12, consultDaysOffset: 5 },
    { name: "Derek Kim", email: "derek.k@example.com", phone: "(555) 300-0002", source: "Referral", coachId: coaches[2], notes: "Enjoyed consult, deciding", status: "showed", daysAgo: 10, consultDaysOffset: 4 },
    { name: "Amanda Wells", email: "amanda.w@example.com", phone: "(555) 300-0003", source: "Google", coachId: coaches[0], notes: "Very interested, comparing options", status: "showed", daysAgo: 14, consultDaysOffset: 6 },

    { name: "Brian Taylor", email: "brian.t@example.com", phone: "(555) 400-0001", source: "Referral", coachId: coaches[0], notes: "Signed up immediately after consult", status: "won", daysAgo: 30, consultDaysOffset: 7, salePrice: "199.00" },
    { name: "Megan Scott", email: "megan.s@example.com", phone: "(555) 400-0002", source: "Facebook", coachId: coaches[1], notes: "Great fit for community", status: "won", daysAgo: 25, consultDaysOffset: 5, salePrice: "179.00" },
    { name: "Jason Lee", email: "jason.l@example.com", phone: "(555) 400-0003", source: "Walk-in", coachId: coaches[2], notes: "Started with fundamentals", status: "won", daysAgo: 20, consultDaysOffset: 4, salePrice: "219.00" },
    { name: "Courtney Hall", email: "courtney.h@example.com", phone: "(555) 400-0004", source: "Instagram", coachId: coaches[0], notes: "Loved the atmosphere", status: "won", daysAgo: 18, consultDaysOffset: 3, salePrice: "189.00" },
    { name: "Tyler Brooks", email: "tyler.b@example.com", phone: "(555) 400-0005", source: "Referral", coachId: coaches[1], notes: "Referred by 2 existing members", status: "won", daysAgo: 15, consultDaysOffset: 6, salePrice: "249.00" },

    { name: "Nicole Perez", email: "nicole.p@example.com", phone: "(555) 500-0001", source: "Google", coachId: coaches[2], notes: "Too far from home", status: "lost", daysAgo: 22, lostReason: "chose_competitor" },
    { name: "Ryan Cooper", email: "ryan.c@example.com", phone: "(555) 500-0002", source: "Facebook", coachId: coaches[0], notes: "Budget concerns", status: "lost", daysAgo: 19, lostReason: "price" },
    { name: "Stephanie Evans", email: "stephanie.e@example.com", phone: "(555) 500-0003", source: "Walk-in", coachId: coaches[1], notes: "No-showed twice", status: "lost", daysAgo: 16, lostReason: "no_show" },
  ];

  for (const dl of demoLeads) {
    const createdAt = new Date(now.getTime() - dl.daysAgo * 86400000);
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
    };

    if (dl.status === "booked" || dl.status === "showed" || dl.status === "won") {
      leadData.bookedAt = new Date(createdAt.getTime() + 86400000);
      leadData.consultDate = new Date(createdAt.getTime() + (dl.consultDaysOffset || 3) * 86400000);
    }

    if (dl.status === "showed" || dl.status === "won") {
      leadData.showedAt = new Date(createdAt.getTime() + (dl.consultDaysOffset || 3) * 86400000);
    }

    if (dl.status === "won") {
      leadData.wonAt = new Date(createdAt.getTime() + ((dl.consultDaysOffset || 3) + 1) * 86400000);
      leadData.salePrice = dl.salePrice;
    }

    if (dl.status === "lost") {
      leadData.lostAt = new Date(createdAt.getTime() + 5 * 86400000);
      leadData.lostReason = dl.lostReason;
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
