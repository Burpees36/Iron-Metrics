import { db } from "./db";
import { gyms, members, gymMonthlyMetrics } from "@shared/schema";
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
