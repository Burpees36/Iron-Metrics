import type { OperatorOutput, OperatorPill, OperatorTaskType } from "@shared/schema";

interface MetricsSummary {
  activeMembers?: number;
  churnRate?: number;
  mrr?: number;
  rsi?: number;
  newLeads?: number;
  conversionRate?: number;
  avgLtv?: number;
}

const STUB_OUTPUTS: Record<OperatorPill, Record<string, (m: MetricsSummary) => OperatorOutput[]>> = {
  retention: {
    "7-day plan": (m) => [{
      headline: "7-Day Retention Stabilization Plan",
      why_it_matters: `Your gym has ${m.activeMembers ?? "unknown"} active members. Stabilizing retention this week prevents compounding churn next month.`,
      actions: [
        "Audit all members who haven't attended in 14+ days",
        "Send personal check-in messages to top 5 at-risk members",
        "Schedule 1 community event this week (social WOD, potluck, or bring-a-friend)",
        "Review cancellation requests — offer a pause option before processing",
        "Update your front-desk greeting script to include a personal touch",
      ],
      metrics_used: ["Active Members", "Churn Rate", "Attendance Frequency", "RSI"],
      confidence_label: "Med",
    }],
    "Member outreach drafts": (m) => [{
      headline: "At-Risk Member Outreach Drafts",
      why_it_matters: "Members who disengage silently are 3x more likely to cancel. Proactive outreach catches them before they leave.",
      actions: [
        "Identify members with declining attendance (2+ weeks inactive)",
        "Personalize each message with their name and last class attended",
        "Send messages during peak engagement hours (7-9am or 5-7pm)",
        "Follow up within 48 hours if no response",
        "Log all outreach in member contact notes",
      ],
      drafts: [
        { channel: "sms", message: "Hey [Name], we noticed you haven't been in for a bit. Everything okay? We've got a great class lineup this week — would love to see you back. Let me know if I can help with anything." },
        { channel: "email", message: "Subject: We miss you at the box\n\nHi [Name],\n\nJust checking in — it's been a couple weeks since your last visit. Life gets busy, and that's totally okay.\n\nIf your schedule changed, we have new class times that might work better. If something else is going on, I'm happy to chat.\n\nYour spot is always here.\n\n— [Coach Name]" },
        { channel: "in_person", message: "When [Name] comes in: 'Hey, great to see you! I was actually thinking about you this week — glad you're here. How's everything going?'" },
      ],
      metrics_used: ["Attendance Frequency", "Last Attended Date", "Membership Tenure"],
      confidence_label: "High",
    }],
    "Sales follow-up sequence": (m) => [{
      headline: "Retention-Focused Follow-Up Sequence",
      why_it_matters: "New members in their first 90 days are most vulnerable to dropping off. A structured follow-up sequence improves 90-day retention by up to 25%.",
      actions: [
        "Day 1: Welcome message with what to expect this week",
        "Day 7: Check-in on first-week experience",
        "Day 14: Invite to a community event or partner WOD",
        "Day 30: Goal-setting conversation with a coach",
        "Day 60: Progress check and program adjustment",
        "Day 90: Milestone celebration and long-term plan discussion",
      ],
      metrics_used: ["New Member Count", "90-Day Retention Rate", "First 30-Day Attendance"],
      confidence_label: "High",
    }],
    "Staff coaching note": (m) => [{
      headline: "Coaching Brief: Retention Awareness",
      why_it_matters: "Coaches are the front line of retention. When they know who's at risk, they can intervene naturally during class.",
      actions: [
        "Share this week's at-risk member list with all coaches",
        "Brief coaches on the 'notice and name' technique — greet at-risk members by name",
        "Ask coaches to note any members who seem disengaged or frustrated",
        "Set up a 5-minute weekly huddle to review retention signals",
        "Celebrate coach-driven saves in your next team meeting",
      ],
      metrics_used: ["At-Risk Member Count", "Coach-to-Member Ratio", "Attendance Trends"],
      confidence_label: "Med",
    }],
    "Event plan": (m) => [{
      headline: "Community Retention Event Plan",
      why_it_matters: "Members who attend at least 1 community event per quarter are 40% less likely to cancel. Events build bonds that classes alone can't.",
      actions: [
        "Pick a date within the next 2 weeks (Saturday mornings work best)",
        "Choose format: Partner WOD + potluck, Bring-a-Friend day, or Member Appreciation BBQ",
        "Create a simple sign-up sheet (digital or whiteboard)",
        "Personally invite 5 at-risk members by name",
        "Take photos and share on your gym's social channels within 24 hours",
        "Follow up with attendees: 'Great seeing you Saturday — see you in class this week?'",
      ],
      metrics_used: ["Community Engagement Score", "At-Risk Members", "Event Attendance History"],
      confidence_label: "Med",
    }],
  },
  sales: {
    "7-day plan": (m) => [{
      headline: "7-Day Sales Acceleration Plan",
      why_it_matters: `With ${m.newLeads ?? "incoming"} recent leads, this week's focus is converting warm interest into booked consults.`,
      actions: [
        "Respond to all new leads within 5 minutes of inquiry",
        "Follow up on all booked-but-not-confirmed consults",
        "Call (don't text) any lead older than 48 hours without response",
        "Prepare a 'this week only' incentive for fence-sitters",
        "Block 2 consult slots per day for walk-ins",
      ],
      metrics_used: ["New Leads", "Conversion Rate", "Speed to Lead", "Funnel Stage Distribution"],
      confidence_label: "Med",
    }],
    "Member outreach drafts": (m) => [{
      headline: "Lead Nurture Outreach Templates",
      why_it_matters: "Leads who receive a personal follow-up within 24 hours are 7x more likely to book a consult.",
      actions: [
        "Segment leads by source (referral, social, walk-in)",
        "Use the referral template for warm leads",
        "Use the cold outreach template for social/ad leads",
        "Always include a specific call-to-action with a date",
        "Track response rates to refine messaging",
      ],
      drafts: [
        { channel: "sms", message: "Hi [Name], thanks for reaching out about [Gym Name]! I'd love to set up a free intro session so you can see what we're all about. Do you have 30 min this [Day]?" },
        { channel: "email", message: "Subject: Your free intro at [Gym Name]\n\nHi [Name],\n\nThanks for your interest in [Gym Name]. We'd love to learn about your fitness goals and show you how our community can help.\n\nI have a few spots open this week for a free intro session:\n- [Day/Time 1]\n- [Day/Time 2]\n\nWhich works best for you?\n\n— [Your Name]" },
        { channel: "in_person", message: "When a walk-in arrives: 'Welcome! Have you been to a CrossFit gym before? Let me show you around and we can chat about what you're looking for.'" },
      ],
      metrics_used: ["Lead Source Distribution", "Speed to Lead", "Consult Booking Rate"],
      confidence_label: "High",
    }],
    "Sales follow-up sequence": (m) => [{
      headline: "5-Touch Sales Follow-Up Sequence",
      why_it_matters: "80% of sales require 5+ follow-ups, but most gyms stop after 1-2. A structured sequence closes the gap.",
      actions: [
        "Touch 1 (Day 0): Immediate response — confirm interest, offer consult times",
        "Touch 2 (Day 1): Personal video message or voice note",
        "Touch 3 (Day 3): Share a member success story relevant to their goals",
        "Touch 4 (Day 5): Offer a free drop-in class with no commitment",
        "Touch 5 (Day 7): Final follow-up with a specific deadline",
        "After Day 7: Move to monthly nurture sequence",
      ],
      metrics_used: ["Conversion Rate", "Average Days to Close", "Follow-Up Response Rate"],
      confidence_label: "High",
    }],
    "Staff coaching note": (m) => [{
      headline: "Sales Coaching Brief for Your Team",
      why_it_matters: "Coaches who feel confident in consultations close at 2x the rate of those who wing it.",
      actions: [
        "Review the consultation script with all coaches this week",
        "Role-play a consultation scenario in your next team meeting",
        "Share this week's lead pipeline status with the team",
        "Assign each coach 1-2 leads to personally follow up on",
        "Debrief on any lost leads — identify patterns and refine approach",
      ],
      metrics_used: ["Coach Conversion Rates", "Consultation Close Rate", "Lost Lead Reasons"],
      confidence_label: "Med",
    }],
    "Event plan": (m) => [{
      headline: "Lead Generation Event Plan",
      why_it_matters: "Bring-a-Friend events generate 3-5 warm leads per event on average, with higher conversion rates than cold outreach.",
      actions: [
        "Schedule a Bring-a-Friend Saturday within 2 weeks",
        "Create a simple registration form to capture guest info",
        "Ask each current member to invite 1 specific person",
        "Design a beginner-friendly WOD that's challenging but not intimidating",
        "Have consult slots available immediately after the event",
        "Follow up with every guest within 4 hours of the event",
      ],
      metrics_used: ["Lead Sources", "Referral Conversion Rate", "Event-to-Member Pipeline"],
      confidence_label: "Med",
    }],
  },
  coaching: {
    "7-day plan": (m) => [{
      headline: "7-Day Coaching Development Plan",
      why_it_matters: "Coaching quality directly correlates with retention. Members who rate coaching highly stay 2.5x longer.",
      actions: [
        "Observe each coach during at least 1 class this week",
        "Provide 1 specific piece of positive feedback per coach",
        "Identify 1 area for improvement per coach (movement cueing, energy, inclusivity)",
        "Schedule 15-min 1:1 check-ins with each coach",
        "Share a coaching resource (article, video, or podcast) with the team",
      ],
      metrics_used: ["Coach-to-Member Ratio", "Class Attendance by Coach", "Member Satisfaction"],
      confidence_label: "Med",
    }],
    "Member outreach drafts": (m) => [{
      headline: "Coach-to-Member Connection Templates",
      why_it_matters: "Personal coaching outreach makes members feel seen and valued — it's the difference between a gym and a community.",
      actions: [
        "Assign each coach 5 members to personally check in with this week",
        "Focus on members approaching a milestone (100th class, 1-year anniversary, PR)",
        "Use the templates below as starting points, then personalize",
        "Log all outreach in member notes",
        "Review response quality in your weekly coaching huddle",
      ],
      drafts: [
        { channel: "sms", message: "Hey [Name], great work on [specific movement] today — your [specific improvement] is really showing. Keep it up!" },
        { channel: "email", message: "Subject: Your progress update\n\nHi [Name],\n\nI wanted to take a moment to highlight something I've noticed: [specific observation about their progress].\n\nKeep showing up — consistency is everything, and you're doing it.\n\nSee you in class,\n[Coach Name]" },
      ],
      metrics_used: ["Member Tenure", "Attendance Frequency", "PR History"],
      confidence_label: "High",
    }],
    "Sales follow-up sequence": (m) => [{
      headline: "New Member Coaching Onboarding Sequence",
      why_it_matters: "The first 30 days determine whether a new member stays for years or leaves after a month. Structured coaching touchpoints are critical.",
      actions: [
        "Day 1: Assign a primary coach and introduce them personally",
        "Day 3: Coach checks in after first few classes",
        "Day 7: Goal-setting session (15 min before/after class)",
        "Day 14: Movement assessment and scaling conversation",
        "Day 30: Progress review and program adjustment",
      ],
      metrics_used: ["New Member Count", "30-Day Retention", "Coach Assignment Coverage"],
      confidence_label: "High",
    }],
    "Staff coaching note": (m) => [{
      headline: "Weekly Coaching Team Brief",
      why_it_matters: "Aligned coaches deliver consistent experiences. Consistency builds trust, and trust builds retention.",
      actions: [
        "Share this week's programming focus and coaching cues",
        "Review any member concerns or feedback from the past week",
        "Discuss scaling options for this week's movements",
        "Assign at-risk member check-ins to specific coaches",
        "Celebrate 1 coaching win from the past week",
      ],
      metrics_used: ["Class Attendance Trends", "Member Feedback", "At-Risk Member List"],
      confidence_label: "Med",
    }],
    "Event plan": (m) => [{
      headline: "Coach Development Workshop Plan",
      why_it_matters: "Investing in coaches reduces turnover and improves the member experience across every class.",
      actions: [
        "Block 2 hours on a low-traffic day for a team workshop",
        "Pick 1 focus area: movement cueing, class energy, or member connection",
        "Have each coach demo their approach, then give peer feedback",
        "Record key takeaways and share with the team afterward",
        "Schedule the next workshop within 30 days",
      ],
      metrics_used: ["Coach Tenure", "Class Ratings", "Coaching Certification Status"],
      confidence_label: "Low",
    }],
  },
  community: {
    "7-day plan": (m) => [{
      headline: "7-Day Community Strengthening Plan",
      why_it_matters: "Strong community bonds reduce churn by up to 30%. Members stay for the people as much as the workouts.",
      actions: [
        "Post a member spotlight on social media (with their permission)",
        "Start a weekly 'Athlete of the Week' recognition on the whiteboard",
        "Plan 1 social event outside the gym this month",
        "Create a buddy system for new members joining this week",
        "Encourage 3 members to share their story in your community channel",
      ],
      metrics_used: ["Community Engagement Score", "Social Media Mentions", "Member Referral Rate"],
      confidence_label: "Med",
    }],
    "Member outreach drafts": (m) => [{
      headline: "Community Building Outreach",
      why_it_matters: "Members who feel connected to 3+ other members have a 90-day retention rate above 95%.",
      actions: [
        "Identify members who primarily train alone or during off-peak hours",
        "Personally invite them to a group activity or social event",
        "Introduce them to 2-3 members with similar schedules or interests",
        "Follow up after the introduction to see how it went",
        "Create small accountability groups (3-4 members) for ongoing connection",
      ],
      drafts: [
        { channel: "sms", message: "Hey [Name], we're doing a team workout this [Day] — I think you'd really enjoy it. A few members from your usual class time will be there. Want me to save you a spot?" },
        { channel: "in_person", message: "[Name], have you met [Other Member]? You two are usually in the same class — [Other Member] just hit a [milestone] last week. [Other Member], [Name] has been crushing [movement] lately." },
      ],
      metrics_used: ["Training Schedule Patterns", "Social Connection Score", "Event Attendance"],
      confidence_label: "Med",
    }],
    "Sales follow-up sequence": (m) => [{
      headline: "Community Integration Sequence for New Members",
      why_it_matters: "New members who attend a social event in their first month are 60% more likely to remain active at 6 months.",
      actions: [
        "Week 1: Introduce to 2 existing members during their first class",
        "Week 2: Invite to the next community event or social WOD",
        "Week 3: Add to the gym's social/communication channel",
        "Week 4: Pair with a training buddy for partner WODs",
        "Month 2: Invite to volunteer or help at a community event",
      ],
      metrics_used: ["New Member Onboarding Status", "Community Event Calendar", "Social Connections"],
      confidence_label: "Med",
    }],
    "Staff coaching note": (m) => [{
      headline: "Community-Building Coaching Brief",
      why_it_matters: "Coaches set the tone. When they actively build connections between members, the community grows organically.",
      actions: [
        "Encourage coaches to learn 3 personal facts about each member",
        "Use partner/team workouts at least 2x per week",
        "Have coaches introduce new members to regulars by name",
        "Start each class with a brief community announcement or shout-out",
        "End each class with a 'good work' moment highlighting someone specific",
      ],
      metrics_used: ["Class Format Distribution", "Member Satisfaction", "Community Feedback"],
      confidence_label: "Med",
    }],
    "Event plan": (m) => [{
      headline: "Monthly Community Event Plan",
      why_it_matters: "Gyms that host monthly community events see 15-20% higher retention than those that don't.",
      actions: [
        "Choose a format: Social WOD, Potluck, Charity Event, or Theme Day",
        "Set the date 3 weeks out to give members time to plan",
        "Create a simple sign-up (Google Form or whiteboard)",
        "Assign 2-3 members as 'event ambassadors' to help spread the word",
        "Budget $50-100 for food/drinks/supplies",
        "Document with photos and share within 24 hours",
      ],
      metrics_used: ["Past Event Attendance", "Member Demographics", "Seasonal Calendar"],
      confidence_label: "High",
    }],
  },
  owner: {
    "7-day plan": (m) => [{
      headline: "7-Day Owner Stability Plan",
      why_it_matters: `With an RSI of ${m.rsi ?? "N/A"} and ${m.activeMembers ?? "unknown"} active members, this week's priority is reducing owner overwhelm while maintaining operational momentum.`,
      actions: [
        "Block 2 hours of 'CEO time' — no coaching, no admin, just strategic thinking",
        "Review your top 3 financial metrics (MRR, churn rate, ARM) and note trends",
        "Delegate 1 task you've been holding onto to a coach or staff member",
        "Set 1 clear weekly goal that moves the business forward",
        "Schedule a 15-minute daily shutdown ritual to separate work from personal time",
      ],
      metrics_used: ["RSI", "MRR", "Churn Rate", "Owner Hours Worked"],
      confidence_label: "Med",
    }],
    "Member outreach drafts": (m) => [{
      headline: "Owner-to-Member Connection Templates",
      why_it_matters: "When the owner personally reaches out, members feel the gym's heartbeat. These are your highest-impact touchpoints.",
      actions: [
        "Personally message 3 long-tenured members this week to say thanks",
        "Reach out to 2 members who recently returned after a break",
        "Send a personal note to any member celebrating a milestone",
        "Check in with 1 member you haven't talked to in a while",
        "Keep messages authentic — no templates feel like templates",
      ],
      drafts: [
        { channel: "sms", message: "Hey [Name], just wanted to say thanks for being part of [Gym Name]. You've been showing up consistently and it doesn't go unnoticed. Glad you're here." },
        { channel: "email", message: "Subject: Quick note from [Your Name]\n\nHi [Name],\n\nI don't send these often, but I wanted to personally thank you for being part of our community. Members like you are the reason we do this.\n\nIf there's ever anything we can do better, my door is always open.\n\n— [Your Name], Owner" },
      ],
      metrics_used: ["Member Tenure", "Attendance Consistency", "Milestone Tracking"],
      confidence_label: "High",
    }],
    "Sales follow-up sequence": (m) => [{
      headline: "Owner's Strategic Sales Review Sequence",
      why_it_matters: "As the owner, your time in sales should be strategic, not tactical. This sequence keeps you informed without getting pulled into every deal.",
      actions: [
        "Monday: Review the pipeline — how many leads, where are they stuck?",
        "Wednesday: Check in with your sales lead — any deals need owner involvement?",
        "Friday: Review the week's closes and losses — what can you learn?",
        "Monthly: Analyze source ROI — which channels bring your best members?",
        "Quarterly: Evaluate your sales process — is it systematized or personality-dependent?",
      ],
      metrics_used: ["Pipeline Value", "Conversion Rate", "Lead Source ROI", "Sales Cycle Length"],
      confidence_label: "Med",
    }],
    "Staff coaching note": (m) => [{
      headline: "Owner's Leadership Brief",
      why_it_matters: "Your team looks to you for clarity and direction. A brief, consistent communication rhythm builds trust and alignment.",
      actions: [
        "Send a Monday morning team update (3-5 bullet points max)",
        "Highlight 1 win from last week",
        "Share 1 focus area for this week",
        "Acknowledge 1 team member publicly",
        "End with an open question: 'What do you need from me this week?'",
      ],
      metrics_used: ["Team Size", "Key Metrics Summary", "Upcoming Events"],
      confidence_label: "High",
    }],
    "Event plan": (m) => [{
      headline: "30-Day Owner Stabilization Plan",
      why_it_matters: "Owner burnout is the #1 silent killer of gyms. This plan creates breathing room while keeping the business moving forward.",
      actions: [
        "Week 1: Audit your time — track where every hour goes for 5 days",
        "Week 1: Identify your top 3 energy drains and delegate or eliminate 1",
        "Week 2: Set up 1 automated system (billing reminders, class check-ins, or lead follow-up)",
        "Week 2: Schedule 1 non-gym activity that recharges you",
        "Week 3: Have a strategic conversation with a mentor or peer owner",
        "Week 4: Review and adjust — what worked? What needs more time?",
      ],
      metrics_used: ["Owner Time Allocation", "Delegation Coverage", "Business Health Metrics"],
      confidence_label: "Med",
    }],
  },
};

export function generateStubOutput(
  pill: OperatorPill,
  taskType: OperatorTaskType,
  metrics: MetricsSummary
): OperatorOutput[] {
  const pillOutputs = STUB_OUTPUTS[pill];
  if (!pillOutputs) return [];
  const generator = pillOutputs[taskType];
  if (!generator) return [];
  return generator(metrics);
}

export function buildInputSummary(
  pill: OperatorPill,
  taskType: OperatorTaskType,
  metrics: MetricsSummary
): Record<string, unknown> {
  return {
    pill,
    taskType,
    metricsSnapshot: {
      activeMembers: metrics.activeMembers ?? null,
      churnRate: metrics.churnRate ?? null,
      mrr: metrics.mrr ?? null,
      rsi: metrics.rsi ?? null,
      newLeads: metrics.newLeads ?? null,
      conversionRate: metrics.conversionRate ?? null,
      avgLtv: metrics.avgLtv ?? null,
    },
    generatedAt: new Date().toISOString(),
    aiEnabled: false,
  };
}
