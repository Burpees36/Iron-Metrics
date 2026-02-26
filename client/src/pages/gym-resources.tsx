import { useRoute } from "wouter";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Apple,
  Megaphone,
  Users,
  Handshake,
  ClipboardCheck,
  Target,
  Heart,
} from "lucide-react";
import { useGymData, GymPageShell, GymNotFound, GymDetailSkeleton, PageHeader } from "./gym-detail";

interface ResourcePhase {
  title: string;
  summary: string;
  details: string[];
}

interface Resource {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof BookOpen;
  category: string;
  phases: ResourcePhase[];
}

const RESOURCES: Resource[] = [
  {
    id: "onboarding",
    title: "New Member Onboarding Process",
    subtitle: "A structured 5-phase system to take leads from first contact through their 90-day goal review — and turn them into long-term members.",
    icon: UserPlus,
    category: "Retention",
    phases: [
      {
        title: "Phase 1 — Assess",
        summary: "First contact with a lead has one goal: get them to schedule a No Sweat Intro.",
        details: [
          "When a lead fills out your form, the only objective of that first call or text is to book a No Sweat Intro (NSI). Don't go over pricing or programs — just get them in the door.",
          "The NSI is a motivational interview. Ask 3-4 questions to understand why they want to work out, what they've tried before, and what their goals are.",
          "From there, the coach creates a prescription — the fastest path to results. That might be personal training, semi-private, group classes, nutrition coaching, or a combination.",
          "Each member gets their own goal sheet filled out during the NSI. If available, do an InBody scan to establish a baseline.",
        ],
      },
      {
        title: "Phase 2 — Admit & Affirm",
        summary: "Present the prescription, handle objections with empathy, and get them signed up for OnRamp before they leave.",
        details: [
          "Present the prescription: 'Based on what you told me, the fastest way to get you where you want is...' — show them the path.",
          "If they say it's too expensive: 'Given your budget, we can do it this way. It won't be as fast, but it will get you there.' Always have a Plan B.",
          "The goal of the NSI is to get them signed up for OnRamp (done 1-on-1). OnRamp is often seen as a barrier to entry — but when done right, it's a barrier to exiting.",
          "They should not leave the NSI without scheduling their first OnRamp appointment. Momentum matters — the gap between NSI and first session should be under 48 hours.",
          "Consider a Healthy Habits appointment early on to go over nutrition habits that will help long-term. This can be in-person, phone, or Zoom.",
          "A Client Success Manager (CSM) oversees each member's journey for the first 90 days — handling touchpoints, check-ins, and making sure nobody slips through the cracks.",
        ],
      },
      {
        title: "Phase 3 — Activate & Acclimate",
        summary: "OnRamp sessions teach foundational movements, build confidence, and create a sense of belonging before they ever hit a group class.",
        details: [
          "Start with the Healthy Habits appointment: discuss nutrition's role in their goals, provide first steps for habit change, and give them a habits tracking sheet to fill out until their goal review.",
          "Send the Sickness-Wellness-Fitness video with a short script — share foundational CrossFit knowledge early.",
          "Provide a Client Bill of Rights and Code of Conduct. This answers 'What do we do here?' and 'How are we different?' Most people quit because they don't feel like they fit in — this helps them belong from day one.",
          "Use the same structured workout for each OnRamp session so any coach can deliver a consistent experience. Show them how to log scores in your software — drive home the importance of tracking results.",
          "Assign homework after each session (stretching, mobility) and write it down for them.",
          "Each OnRamp session is a teaching opportunity: different movements, progress tracking, and follow-up from the CSM with educational videos on nutrition, exercise, and recovery.",
          "The final OnRamp workout should be something classic and shared — like Fran. It lets them experience intensity and feel part of the broader CrossFit community.",
          "All OnRamp sessions are 1-on-1. After completing them (aim for 6 sessions in 2 weeks), they're invited to try a group class. End with a Goal Review meeting.",
        ],
      },
      {
        title: "Phase 4 — Accomplish",
        summary: "The Goal Review locks in their prescription, sets up recurring payment, and schedules their next check-in at 90 days.",
        details: [
          "The Goal Review is the turning point. The coach who signed them up reviews their habits tracking sheet and progress, then writes their first prescription (Rx1).",
          "Ask: 'Do you want to continue 1-on-1 or move to group? Do you want more help with nutrition, or wait for the next challenge?' The goal is to provide the best possible prescription.",
          "At this meeting, set up their recurring payment and book their next Goal Review (90 days out).",
          "CSM sends a 30-day check-in congratulating them on their 1-month anniversary and asking how they're enjoying the program.",
          "CSM sends a 60-day check-in reminding them about the upcoming Goal Review session.",
          "If a member raised a flag during the 30-day check-in (discomfort, confusion, frustration), the CSM checks in with them weekly until it's resolved.",
        ],
      },
      {
        title: "Phase 5 — Adopt & Advocate",
        summary: "At the 90-day Goal Review, celebrate wins, ask for testimonials and referrals, and write the next prescription.",
        details: [
          "Do another InBody scan at the 90-day Goal Review. Review progress and ask: 'Are you completely satisfied with your results?'",
          "If yes — ask for a testimonial: 'Can you share your story so other people can experience what you have? If sharing your story can help one other person, what would you tell them?'",
          "Ask for referrals at this point. Members who've had a great experience are your best growth engine.",
          "Review their prescription (Rx2): Would private sessions accelerate their progress? Would a nutrition challenge help? This isn't upselling — it's your duty as a coach to prescribe what would help them most.",
          "Book the next Goal Review and continue the 30/60-day check-in cycle. This process never ends.",
          "The goal is to keep members at least 2 years — so you're not on a marketing treadmill and you can actually make an impact on people's lives.",
          "Start this process manually. Refine it until you love it and your clients love it before automating anything.",
        ],
      },
    ],
  },
  {
    id: "nutrition-challenge",
    title: "Running a Nutrition Challenge",
    subtitle: "A structured 4-6 week challenge that increases engagement, strengthens community bonds, and opens the door to ongoing nutrition coaching.",
    icon: Apple,
    category: "Community Depth",
    phases: [
      {
        title: "Planning & Setup",
        summary: "Design the challenge structure, pricing, and accountability system before you announce anything.",
        details: [
          "Decide on challenge length (4-6 weeks is the sweet spot — long enough for results, short enough to maintain excitement).",
          "Create accountability pods of 4-6 members. Mix experience levels so newer members learn from veterans and veterans feel like leaders.",
          "Pre-plan weekly education topics: 'How to track macros', 'Meal prep for busy people', 'Reading nutrition labels', 'Eating out without blowing your plan'.",
          "Set clear expectations: what's included, what members need to do, how results will be measured.",
          "Price it to be accessible but not free — people value what they pay for. Consider including it as an add-on to membership.",
        ],
      },
      {
        title: "Launch & Engagement",
        summary: "Run weekly check-ins, keep energy high, and use the challenge to create visible community moments.",
        details: [
          "Kick off with an in-person meeting: go over the plan, take before photos (optional), and set individual goals.",
          "Run a weekly group check-in (10 minutes before or after a popular class) to share wins, troubleshoot struggles, and keep accountability high.",
          "Create a shared progress board visible to the whole gym — could be a whiteboard, a Slack channel, or a shared doc.",
          "Post challenge content on social media: meal ideas, member check-ins, progress stories (with permission).",
          "Coaches should reference the challenge in class: 'How's the challenge going? Anyone try that meal prep hack?'",
        ],
      },
      {
        title: "Wrap-Up & Transition",
        summary: "Celebrate completion, publish transformation stories, and transition interested members into ongoing nutrition coaching.",
        details: [
          "Host a wrap-up event: share results, celebrate effort (not just the biggest transformation), and acknowledge everyone who finished.",
          "Collect testimonials and transformation stories — these are powerful for social proof and future challenge sign-ups.",
          "Offer a natural next step: ongoing nutrition coaching for members who want to keep going. The challenge is the gateway.",
          "Survey participants: What worked? What would you change? Use this to improve the next round.",
          "Plan your next challenge — running them quarterly keeps a steady rhythm of engagement and revenue.",
        ],
      },
    ],
  },
  {
    id: "referral-system",
    title: "Building a Referral System",
    subtitle: "Turn your happiest members into a reliable growth engine with a structured, repeatable referral process.",
    icon: Megaphone,
    category: "Acquisition",
    phases: [
      {
        title: "Foundation",
        summary: "Referrals don't happen by accident. Build the ask into your regular member touchpoints.",
        details: [
          "The best time to ask for referrals is during a Goal Review when a member has just acknowledged their progress and satisfaction.",
          "Script it simply: 'Who's one person in your life who would benefit from what you've experienced here?'",
          "Make the referral frictionless: a simple text or link the member can forward, not a complicated form.",
          "Train every coach to make the ask naturally — it shouldn't feel like a sales pitch.",
        ],
      },
      {
        title: "Incentives & Structure",
        summary: "Create a clear, time-bound referral window with incentives that motivate action.",
        details: [
          "Run a defined 2-week referral window rather than an open-ended 'refer a friend anytime' — urgency drives action.",
          "Set a clear incentive: free month, branded gear, credit toward supplements, or public recognition.",
          "Track every referral: who referred them, did they show up, did they sign up. Data tells you which members are your best advocates.",
          "Follow up with every referred lead within 24 hours of their first visit. Speed matters.",
        ],
      },
      {
        title: "Bring-A-Friend Events",
        summary: "Monthly structured events that give members a low-pressure way to introduce friends to the gym.",
        details: [
          "Schedule a monthly 'Bring Your Person' week — same week each month so it becomes a rhythm.",
          "Design the workout to be inclusive and fun, not intimidating. The goal is for the guest to leave thinking 'I could do this.'",
          "Coach greets every guest by name. After class, personally connect and invite them to a No Sweat Intro.",
          "Follow up within 24 hours with a personal text from the coach who met them — not an automated email.",
          "Track conversion: How many guests came? How many booked an NSI? How many signed up?",
        ],
      },
    ],
  },
  {
    id: "community-events",
    title: "Community Event Playbook",
    subtitle: "Events aren't extras — they're retention infrastructure. Members with gym friendships stay dramatically longer.",
    icon: Users,
    category: "Community Depth",
    phases: [
      {
        title: "Monthly Rhythm",
        summary: "Establish a predictable cadence of social and fitness events that members can count on.",
        details: [
          "Schedule one community event per month on a consistent day (e.g., first Friday). Predictability drives attendance.",
          "Alternate between social events (potlucks, game nights, BBQs) and fitness events (partner workouts, team competitions).",
          "Assign one staff member as the event owner — responsible for planning, promotion, and turnout.",
          "Keep it simple. A potluck after Saturday's workout costs nothing and builds real friendships.",
        ],
      },
      {
        title: "Competitions & Throwdowns",
        summary: "In-house competitions create shared experiences that transform 'I do CrossFit' into 'I belong here.'",
        details: [
          "Schedule one major competition per quarter: in-house throwdown, Hero WOD event, or holiday-themed workout.",
          "Make every competition inclusive with scaled divisions — so every member feels welcome to participate, not just the competitive athletes.",
          "Mix newer and experienced members on teams. This accelerates community integration for newer members.",
          "Capture photos and videos for social media content — these are your best marketing assets.",
          "Track which members participate vs. don't. Follow up with non-participants to understand barriers.",
        ],
      },
      {
        title: "The CrossFit Open",
        summary: "The Open is your single biggest retention and growth event of the year. Activate it fully.",
        details: [
          "Set a gym-wide participation goal — encourage every member to register regardless of fitness level.",
          "Run Friday Night Lights with heats, judges, and energy. Make it feel like a real event, not just another workout.",
          "Create intramural teams for friendly competition within the gym.",
          "Post member stories celebrating effort, not just scores. The Open is about participation and community.",
          "Plan a post-Open celebration for everyone who participated. This cements the shared experience.",
        ],
      },
    ],
  },
  {
    id: "coaching-development",
    title: "Coaching Quality & Development",
    subtitle: "Your coaches are the product. Consistent, high-quality coaching drives retention more than any program or price point.",
    icon: ClipboardCheck,
    category: "Coaching Quality",
    phases: [
      {
        title: "Standards & SOPs",
        summary: "Create clear standards so every member gets a consistent experience regardless of coach or time slot.",
        details: [
          "Define SOPs for class delivery: whiteboard brief structure, warm-up protocol, scaling conversation, cool-down and homework.",
          "Every coach should connect individually with at least 3 members per class — by name, with specific feedback on their movement.",
          "Scaling should be proactive, not reactive. Coaches present scaling options before the workout starts, not when someone is already struggling.",
          "The standard: a member should have a nearly identical experience at 6 AM and 5 PM, regardless of who's coaching.",
        ],
      },
      {
        title: "Observation & Feedback",
        summary: "Shadow each coach regularly and provide structured feedback — not criticism, but development.",
        details: [
          "Shadow each coach at least once per month. Observe the full class experience from warm-up through cool-down.",
          "After shadowing, have a follow-up meeting covering what they did well and one area to improve. Keep it constructive.",
          "Look for: Did they greet members by name? Did they explain the workout intent? Did they proactively scale? Did they provide individual feedback?",
          "Create a simple rubric so feedback is consistent and measurable over time.",
        ],
      },
      {
        title: "Ongoing Development",
        summary: "Monthly coaching meetings keep your staff growing and aligned on standards.",
        details: [
          "Hold monthly coaching development meetings focused on one improvement area — not everything at once.",
          "Rotate topics: movement coaching, class management, member engagement, scaling strategies, nutrition conversations.",
          "Encourage coaches to attend external education (seminars, certifications) and share what they learn with the team.",
          "Celebrate coaching wins publicly — when a member PRs because of great coaching cues, recognize the coach.",
        ],
      },
    ],
  },
  {
    id: "goal-reviews",
    title: "Goal Review System",
    subtitle: "Quarterly goal reviews are the single most important retention tool in your gym. They keep members growing, connected, and invested.",
    icon: Target,
    category: "Retention",
    phases: [
      {
        title: "Structure & Scheduling",
        summary: "Build goal reviews into your operating rhythm so they happen consistently, not when someone remembers.",
        details: [
          "Every member should have a goal review every 90 days. Book the next one at the end of each review.",
          "The first goal review happens at the end of OnRamp. Subsequent reviews happen quarterly.",
          "Assign goal reviews to the coach who knows the member best — relationship matters more than scheduling convenience.",
          "Block dedicated time for goal reviews on your calendar. They shouldn't compete with class prep or admin work.",
        ],
      },
      {
        title: "The Conversation",
        summary: "A goal review is a coaching conversation, not a sales meeting. Lead with their progress, listen to their experience.",
        details: [
          "Start with data: attendance trends, benchmark improvements, body composition changes (if tracking).",
          "Ask open-ended questions: 'What are you most proud of this quarter?' 'What's been challenging?' 'What do you want to focus on next?'",
          "Review their prescription: Is group still the right fit? Would semi-private help them break through a plateau? Is nutrition coaching the missing piece?",
          "This is your opportunity to prescribe — not upsell. The question is always 'What would help them most?'",
          "End with clear next steps and a booked follow-up. They should leave feeling seen, supported, and motivated.",
        ],
      },
      {
        title: "Follow-Through",
        summary: "The review itself is just the start. Consistent follow-up between reviews is what keeps members engaged.",
        details: [
          "CSM sends a 30-day check-in after each goal review: 'How are things going with your new plan?'",
          "CSM sends a 60-day check-in: reminder about the upcoming goal review, ask if anything has changed.",
          "If a member raises a concern at any check-in, increase frequency to weekly until it's resolved.",
          "Track goal review completion rates. If reviews are slipping, retention problems are coming.",
        ],
      },
    ],
  },
  {
    id: "social-proof",
    title: "Social Proof & Content Engine",
    subtitle: "Consistent, authentic content featuring real members is the most cost-effective lead generation you can do.",
    icon: Heart,
    category: "Acquisition",
    phases: [
      {
        title: "Content Calendar",
        summary: "Build a simple, repeatable weekly rhythm so content creation becomes a habit, not a burden.",
        details: [
          "Create a weekly content calendar with daily themes: Monday member spotlight, Tuesday PR celebration, Wednesday coach tip, Thursday transformation, Friday community moment.",
          "You don't need professional production. Phone videos and authentic moments outperform polished marketing.",
          "Batch content when possible — film 3-4 short clips during one Saturday workout and schedule them throughout the week.",
          "Every piece of content should answer one question for a potential lead: 'Could I see myself there?'",
        ],
      },
      {
        title: "Testimonials & Stories",
        summary: "Member stories are your most powerful marketing asset. Collect them systematically, not randomly.",
        details: [
          "Ask for testimonials at the 90-day Goal Review when satisfaction is highest. Script it: 'If sharing your story could help one other person, what would you tell them?'",
          "Capture both video and written testimonials. Video is more impactful, but written works too.",
          "Focus on the transformation story, not just the results: What was life like before? What changed? What does life look like now?",
          "Get explicit permission before posting. Members who agree to share their story become even more invested in the community.",
        ],
      },
      {
        title: "Lead Follow-Up",
        summary: "Content drives inquiries, but speed closes them. Have a system for responding to every lead same-day.",
        details: [
          "Respond to all inbound leads same-day — ideally within the hour. Every hour you wait, conversion drops significantly.",
          "Use a simple script: acknowledge their interest, ask one question about their goals, and invite them to a No Sweat Intro.",
          "Track which content types generate the most inbound inquiries. Double down on what works.",
          "The goal of every lead interaction is the same: book a No Sweat Intro. Don't try to sell over text or DM.",
        ],
      },
    ],
  },
  {
    id: "local-partnerships",
    title: "Local Partnership Activation",
    subtitle: "For gyms under 100 members, local partnerships are the highest-conversion growth channel available.",
    icon: Handshake,
    category: "Acquisition",
    phases: [
      {
        title: "Identifying Partners",
        summary: "Look for organizations whose members would naturally benefit from what you offer.",
        details: [
          "List 5-10 local organizations: businesses, schools, first responder stations, sports clubs, churches, physical therapy offices.",
          "Prioritize partners whose audience overlaps with your ideal member: health-conscious, community-oriented, active.",
          "Think about what you can offer them, not just what they can give you. A partnership should be mutually beneficial.",
          "Start with one or two partners. Prove the model works before scaling.",
        ],
      },
      {
        title: "Making the Connection",
        summary: "Lead with value — offer something meaningful before you ask for anything in return.",
        details: [
          "Offer a free team class or hosted community workout for the partner organization. Let them experience your gym firsthand.",
          "Create a simple co-branded offer: 'Show your [partner] badge for a free week' or 'Mention [partner] for 10% off your first month.'",
          "Attend their events, sponsor their teams, or host joint community activities. Be visible in their world.",
          "Build the relationship with the decision-maker personally. Business partnerships are really personal relationships.",
        ],
      },
      {
        title: "Converting & Tracking",
        summary: "Turn partnership interest into No Sweat Intros, and track which partnerships actually produce members.",
        details: [
          "Convert every interested contact into a scheduled No Sweat Intro immediately — don't let interest cool off.",
          "Track which partnerships generate actual signups, not just foot traffic. Some partnerships look good but don't convert.",
          "Ask every new member how they heard about you and log the source. This data tells you where to invest.",
          "Re-engage productive partnerships quarterly with a fresh offer or event. Partnerships need maintenance to stay active.",
        ],
      },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Retention": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Acquisition": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "Community Depth": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "Coaching Quality": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

function ResourceCard({ resource }: { resource: Resource }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const Icon = resource.icon;

  const togglePhase = (index: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (expandedPhases.size === resource.phases.length) {
      setExpandedPhases(new Set());
    } else {
      setExpandedPhases(new Set(resource.phases.map((_, i) => i)));
    }
  };

  return (
    <Card
      className="hover-elevate transition-all duration-300"
      data-testid={`card-resource-${resource.id}`}
    >
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full text-left p-5 flex items-start gap-4"
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && expandedPhases.size === 0) {
              setExpandedPhases(new Set([0]));
            }
          }}
          data-testid={`button-toggle-resource-${resource.id}`}
        >
          <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{resource.title}</h3>
              <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[resource.category] || ""}`}>
                {resource.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{resource.subtitle}</p>
          </div>
          <div className="flex-shrink-0 mt-1">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {resource.phases.length} Phases
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={(e) => { e.stopPropagation(); expandAll(); }}
                data-testid={`button-expand-all-${resource.id}`}
              >
                {expandedPhases.size === resource.phases.length ? "Collapse All" : "Expand All"}
              </Button>
            </div>

            {resource.phases.map((phase, i) => (
              <div key={i} className="border rounded-lg overflow-hidden" data-testid={`phase-${resource.id}-${i}`}>
                <button
                  type="button"
                  className="w-full text-left p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  onClick={(e) => { e.stopPropagation(); togglePhase(i); }}
                  data-testid={`button-toggle-phase-${resource.id}-${i}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {expandedPhases.has(i) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{phase.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{phase.summary}</p>
                  </div>
                </button>

                {expandedPhases.has(i) && (
                  <div className="px-3 pb-3 pl-9 space-y-2 animate-fade-in-up">
                    {phase.details.map((detail, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0 mt-1.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GymResources() {
  const [, params] = useRoute("/gyms/:id/resources");
  const gymId = params?.id;
  const [filter, setFilter] = useState<string | null>(null);

  const { data: gym, isLoading: gymLoading } = useGymData(gymId);

  if (gymLoading) return <GymDetailSkeleton />;
  if (!gym) return <GymNotFound />;

  const categories = Array.from(new Set(RESOURCES.map(r => r.category)));
  const filtered = filter ? RESOURCES.filter(r => r.category === filter) : RESOURCES;

  return (
    <GymPageShell gym={gym}>
      <div className="max-w-3xl space-y-6 animate-fade-in-up">
        <PageHeader
          title="Resources"
          subtitle="Playbooks and guides for running a stronger gym — from onboarding to coaching development. Reference these anytime to build or refine your systems."
          howTo="Click any resource to expand it. Each guide is broken into phases with actionable steps you can implement this week."
          icon={BookOpen}
        />

        <div className="flex flex-wrap gap-2" data-testid="resource-filters">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(null)}
            data-testid="filter-all"
          >
            All ({RESOURCES.length})
          </Button>
          {categories.map(cat => {
            const count = RESOURCES.filter(r => r.category === cat).length;
            return (
              <Button
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(filter === cat ? null : cat)}
                data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {cat} ({count})
              </Button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filtered.map(resource => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </div>
    </GymPageShell>
  );
}
