import { storage } from "./storage";
import { generateEmbedding, chunkTranscript, autoTag } from "./knowledge-ingestion";

interface DoctrineArticle {
  sourceSlug: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  externalId: string;
  content: string;
}

const DOCTRINE_CONTENT: DoctrineArticle[] = [
  {
    sourceSlug: "two-brain-retention",
    sourceName: "Two-Brain Business",
    sourceUrl: "https://twobrainbusiness.com/gym-retention/",
    title: "5 Things That Actually Keep Members Longer - Chris Cooper",
    externalId: "twobrain-retention-5things",
    content: `Chris Cooper, founder of Two-Brain Business and 14-year CrossFit affiliate owner, identifies the five core strategies that actually keep gym members longer based on data from over 2,000 gyms.

Strategy one is structured onboarding, also called on-ramp. Without onboarding, average member retention is approximately 78 days. With a structured onboarding process, retention extends to approximately 8 months. Members who stay beyond 8 months are likely to reach 2 or more years. The key is to eliminate friction and justify the "why" early in the member journey. Effective onboarding includes personal intro sessions, clear progression pathways, and creating early wins through PRs and milestones.

Strategy two is regular goal reviews every 3 to 6 months. Coaches should measure progress in strength, body composition, attendance, and skills. This prevents the "silent breakup" where members cancel without warning. Clients need to see momentum to stay engaged. Quarterly check-ins showing data from tracking systems, PRs, and attendance streaks are essential. The key question to ask is: "Are we still helping you reach your goals?"

Strategy three is visible progress tracking. Members need proof they are moving forward. Without an ascension path, they feel like they are just showing up. Track PRs, attendance, and milestones. Use tools like Beyond the Whiteboard. Celebrate wins publicly through "Bright Spots Friday" recognition programs.

Strategy four is meaningful relationships. Long-term members need two meaningful relationships: one with a coach and one with another member. Being "friendly in class" is not enough. Intentionally pair quieter or newer members with experienced ones. Host social events. Coaches must connect one-on-one outside of class.

Strategy five is member referrals. When members refer someone, they stay approximately 6 months longer. They become emotionally invested in the gym's success. Build a referral culture rather than just offering rewards. Use "bring-a-friend" workouts and affinity marketing to make sharing easy.

The financial impact of these strategies is significant. Keeping members just 2 months longer translates to tens of thousands in extra annual revenue. Two-Brain clients average 20 or more months of length of engagement. The target should be 98 percent or higher monthly retention with churn under 2 percent.

Common mistakes include focusing only on marketing which will not fix retention leaks, using random challenges, swag, and badges which are secondary to the 5 core strategies, ignoring data where most gyms do not track length of engagement, and having no follow-up after the initial sale.

Cooper emphasizes that "Retention is sales over time" and "You can't change lives if clients leave in 3 months." Gym owners must track Length of Engagement (LEG) instead of just churn rate because it reveals who is leaving and when, allowing you to fix specific gaps in the client journey.`,
  },
  {
    sourceSlug: "two-brain-business-models",
    sourceName: "Two-Brain Business",
    sourceUrl: "https://twobrainbusiness.com/two-brain-radio-affiliate-model/",
    title: "Three Business Models That Work in a CrossFit Affiliate",
    externalId: "twobrain-3-business-models",
    content: `Chris Cooper of Two-Brain Business outlines three proven business models for CrossFit affiliates based on research from over 2,000 gyms worldwide.

Model One is the Owner-Coach model. This is where the gym owner coaches most or all classes themselves. It is passionate but fragile. The owner is heavily involved in daily operations and coaching. Revenue is limited by the owner's time and energy. This model works for new gyms but becomes unsustainable as the gym grows. The risk is burnout and the gym cannot operate without the owner.

Model Two adds staff and personal training to the equation. The owner still coaches but has hired additional coaches. Approximately 30 percent of revenue comes from personal training sessions. This model shifts the gym from breakeven to approximately $100,000 per year in owner benefit. The key insight is that personal training dramatically increases Average Revenue per Member (ARM). Members who do both group classes and personal training stay longer and pay more.

Model Three is the Owner-Operator with delegation. The owner focuses on business operations rather than daily coaching. Systems and processes are documented and delegated. Leadership team handles day-to-day operations. This is the sustainable long-term model. It allows the owner to work ON the business rather than IN the business.

Key metrics that all three models should track include Average Revenue per Member (ARM), which is the total revenue divided by total members. The target should be $205 or more per member per month when including personal training and other services. Length of Engagement (LEG) measures how long members stay on average. The target is 14 months minimum, with top performers achieving 20 or more months. Revenue per coach-hour is calculated as class price times capacity times utilization rate. Attrition rate by month with the industry average being 3 to 5 percent monthly should be tracked. Break-even timeline which averages 6 to 19 months to profitability is important to monitor.

The transition from Model One to Model Two requires hiring at least one additional coach, implementing personal training offerings, creating systems for scheduling and billing personal training, and pricing personal training to be profitable while accessible.

The transition from Model Two to Model Three requires documenting all operational processes, hiring a general manager or head coach, creating leadership development programs, implementing financial dashboards and KPI tracking, and building a culture that operates independently of the owner.

Two-Brain data shows that gyms following these progression models achieve significantly higher owner benefit, member retention, and overall business sustainability compared to gyms that remain stuck in Model One.`,
  },
  {
    sourceSlug: "bhotd-pricing-strategy",
    sourceName: "Best Hour of Their Day",
    sourceUrl: "https://www.besthouroftheirday.com/",
    title: "CrossFit Pricing Crisis: The 7-7-7 Strategy for 2026",
    externalId: "bhotd-777-pricing",
    content: `Jason Fernandez and Christian Genson from Best Hour of Their Day discuss why rising operational costs and inflation mean current CrossFit pricing models will result in lower profits in 2026. They introduce the "7-7-7" strategy to help gym owners reverse-engineer revenue goals to protect profit margins without chasing unrealistic member growth.

The 7-7-7 strategy works by identifying three numbers: 7 represents the target monthly profit margin percentage, 7 represents the percentage annual price increase needed, and 7 represents the number of new members needed per month to replace natural attrition. This framework helps owners see the mathematical relationship between pricing, growth, and profitability.

Current CrossFit pricing benchmarks for 2024-2025 show unlimited monthly memberships ranging from $150 to $250 with an average of $167.76 ARPM (Average Revenue Per Member). Urban and premium markets command $200 to $250 or more. Rural and suburban areas range from $100 to $150. Limited plans for 2 to 3 times per week cost $75 to $120. Drop-in rates are $20 to $30 per class. Beginner on-ramp programs cost $100 to $300 for 4 to 8 weeks.

The retention data from the 2024 State of the Industry report is encouraging. Average client retention in the US increased from 7.8 months in 2023 to 18.6 months in 2024. Average client retention in Europe reached 23.7 months. The revenue impact of adding just 2 months of retention is approximately $45,000 per year in additional owner income.

BHOTD ranked affiliate priorities in a tier list. S-Tier or critical priorities are Sales and Retention (the math behind growth) and Coaching Quality (member experience drives retention). A-Tier or high priority items are Marketing (filling the funnel) and Programming (keeping workouts engaging). B-Tier or important but secondary is Branding (differentiation in the local market).

Owner economics from 2024 show the average owner benefit mean is $7,291 per month. The median owner benefit is $4,000 per month. Average revenue per member is $167.76 per month. Coach pay for group classes averages $32.50 per hour. Average annual coach salary is $29,338. The key insight is that more than 50 percent of owners earn $4,000 per month or less, highlighting the urgent need for better pricing and retention strategies.

Why CrossFit costs more than traditional gyms: every session has a certified trainer versus self-service gyms. Small group sizes of 10 to 20 people allow for personalized attention. Community and accountability drive higher retention through social support. Structured programming with daily WODs is designed for progressive development. Operational costs include facility rent spread across fewer members compared to thousands at big chain gyms.`,
  },
  {
    sourceSlug: "bhotd-growth-math",
    sourceName: "Best Hour of Their Day",
    sourceUrl: "https://www.besthouroftheirday.com/",
    title: "Retention Over Growth: Why Most CrossFit Gyms Fail at Math",
    externalId: "bhotd-retention-math",
    content: `Best Hour of Their Day emphasizes that most CrossFit gyms don't fail because they're invisible. They fail because they're leaking members. Growth is often a math problem, not a marketing or motivation issue.

The fundamental equation is simple. If you lose 5 members per month and gain 5 new members per month, you are stuck. Most gym owners focus all their energy on the acquisition side of this equation while ignoring the retention leak. Fixing retention is almost always more cost-effective than increasing marketing spend.

The math of retention improvement shows that increasing client retention by just 2 months can add $45,000 per year in owner income. This was confirmed by the 2024 State of the Industry report. If your average member pays $175 per month and stays 12 months, their lifetime value is $2,100. If you increase retention to 14 months, their lifetime value becomes $2,450. That additional $350 per member across 100 members is $35,000 in additional annual revenue with zero additional marketing cost.

The growth formula that actually works starts with fixing the leak first. Map out where members are leaving in their journey. Common drop-off points are after the free trial or intro, within the first 30 days, at the 3-month mark when the novelty wears off, and at the 6-month mark when life gets busy.

For each drop-off point, implement a specific intervention. After the intro, follow up within 24 hours with a personal message. In the first 30 days, assign a workout buddy and schedule a goal-setting session. At the 3-month mark, conduct a progress review and celebrate wins. At the 6-month mark, introduce new challenges or programming tracks.

Sales process optimization is the second lever. Track your sales funnel: website visitors to leads, leads to No Sweat Intros (consultations), No Sweat Intros to trials, trials to members. Industry benchmarks suggest a healthy conversion rate from No Sweat Intro to member is 70 to 80 percent. If your rate is below 50 percent, the problem is likely your sales process, not your marketing.

Marketing funnel components include traffic (website visitors), lead generation (opt-ins), bookings (scheduled visits), shows (actual walk-ins), and sold (conversions to members). Each step in this funnel should be measured and optimized.

The referral multiplier is the third lever. Members who refer others stay 6 months longer on average. Create a systematic referral program rather than relying on organic word-of-mouth. "Bring a Friend" workouts, referral rewards, and public recognition of referrers all contribute to a referral culture.

The bottom line is that before spending more on Facebook ads or Google marketing, fix your retention first. A gym with 5 percent monthly churn needs to add 60 new members per year just to stay flat. Reducing churn to 3 percent means you only need 36 new members per year to stay flat, effectively giving you 24 "free" members worth of growth.`,
  },
  {
    sourceSlug: "crossfit-onboarding-system",
    sourceName: "CrossFit Affiliate Playbook",
    sourceUrl: "https://www.crossfit.com/playbook",
    title: "The 180-Day New Member Journey for CrossFit Affiliates",
    externalId: "cf-180day-onboarding",
    content: `The CrossFit Affiliate Playbook and successful affiliate case studies outline a comprehensive 180-day new member journey that dramatically improves retention and member satisfaction.

The first critical window is days 1 through 7, the Welcome Week. Before their first class, send a welcome email or text with what to expect, what to wear, and where to park. On day 1, the coach should greet the new member by name, introduce them to at least 3 other members, explain the class structure, and scale every movement appropriately. After the first class, the head coach or owner sends a personal follow-up message asking how they felt and answering any questions.

Days 2 through 7 should include a follow-up check-in after their second class, an invitation to the gym's social media group or community platform, and a clear schedule recommendation based on their goals. The target is getting the new member to attend at least 3 classes in their first week.

The second window is days 8 through 30, the Foundation Phase. Week 2 includes a scheduled goal-setting session with a coach to define 3 specific and measurable goals. Week 3 includes an introduction to workout tracking and explaining how to log results. Week 4 features a 30-day check-in meeting to review initial progress, adjust goals if needed, and address any concerns or barriers.

During this phase, coaches should be proactively watching for signs of frustration or overwhelm. New members who miss more than 3 consecutive scheduled classes should receive a personal outreach within 24 hours of the third missed class.

The third window is days 31 through 90, the Integration Phase. Monthly touchpoints should include progress photos or measurements if the member opted in, skill milestone celebrations such as first pull-up, first rope climb, or first Rx workout. Community integration events like Friday Night Lights, gym barbecues, or charity workouts should be offered. At the 90-day mark, conduct a formal progress review comparing to initial benchmarks.

The fourth window is days 91 through 180, the Commitment Phase. At this point, members should be encouraged to sign up for competitions or challenges, take on small leadership roles like welcoming newer members, explore additional services such as nutrition coaching, specialty classes, or personal training, and participate in the gym's referral program.

By day 180, a member who has gone through this journey is statistically likely to become a long-term member. Data from successful affiliates shows that members who complete the full 180-day journey have an average retention exceeding 24 months.

Key implementation tips include assigning one staff member as the "Client Success Manager" whose sole focus is ensuring new members follow this journey. Use a CRM or simple spreadsheet to track each member's progress through these phases. Automate reminder emails and texts where possible but ensure personal touchpoints remain genuinely personal. Train all coaches on the journey so every interaction reinforces the system.

The case study from Odin CrossFit in Frederick, Maryland shows that implementing this 180-day journey resulted in a 40 percent reduction in first-90-day cancellations and a 25 percent increase in referrals from members in their first 6 months.`,
  },
  {
    sourceSlug: "affiliate-coaching-quality",
    sourceName: "Best Hour of Their Day - The Knowledge",
    sourceUrl: "https://www.besthouroftheirday.com/",
    title: "Coaching Excellence: The Foundation of Member Retention",
    externalId: "bhotd-coaching-excellence",
    content: `Jason Ackerman and Jason Fernandez from Best Hour of Their Day, both CrossFit Level 4 trainers, emphasize that coaching quality is the single most important factor in member retention. Their program "The Knowledge" is built around developing coaches who deliver consistently excellent class experiences.

The 5 pillars of coaching excellence in a CrossFit affiliate are: presence and energy, movement standards, individualization, connection, and class management.

Presence and energy means the coach sets the tone for every class. They arrive early, greet every member by name, and bring genuine enthusiasm. A coach who is checking their phone or seems disinterested will create a class that feels transactional rather than transformational.

Movement standards means the coach maintains high standards for movement quality without being a drill sergeant. They understand the difference between coaching and correcting. The best coaches use a "sandwich" approach: positive observation, coaching cue, encouragement. For example: "Great depth on that squat, Sarah. Now let's work on keeping your chest up at the bottom. You're going to crush this."

Individualization means scaling is not an afterthought. The best coaches present scaling options proactively before members need to ask. They know each member's current abilities, limitations, and goals. They provide different stimulus targets for different fitness levels. A workout that is "as prescribed" should challenge an advanced athlete, but the scaled version should provide an equally challenging relative stimulus for a newer member.

Connection means coaches build genuine relationships with members beyond just the workout. They know about members' lives outside the gym including their jobs, families, and challenges. They follow up on things members share. This creates a sense of belonging that goes far beyond physical training.

Class management means the coach runs an efficient and organized class. Time management ensures all components are addressed including the warmup, skill or strength work, the workout, and cool down. Equipment transitions are smooth. The workout brief is clear and concise, covering the intended stimulus, scaling options, and any safety considerations.

The Coach's Eye Class Review is a unique BHOTD program where CF-L4 staff review video recordings of actual classes and provide detailed feedback on coaching performance. This systematic approach to coach development creates consistency across all coaches in a gym.

Common coaching mistakes that drive members away include ignoring newer or struggling members during workouts, providing one-size-fits-all scaling that does not account for individual needs, running over time consistently which disrespects members' schedules, creating a competitive culture that alienates non-competitive members, and failing to explain the "why" behind programming decisions.

The financial impact of coaching quality is measurable. Gyms with higher-rated coaching consistently show longer member retention, higher referral rates, and greater willingness to pay premium prices. A study of Two-Brain Business clients found that gyms investing in formal coach development saw an average 15 percent increase in member retention within 6 months.`,
  },
  {
    sourceSlug: "crossfit-sales-system",
    sourceName: "CrossFit Affiliate Operations",
    sourceUrl: "https://www.crossfit.com/open-crossfit-gym",
    title: "The No Sweat Intro: Converting Prospects to Members",
    externalId: "cf-no-sweat-intro",
    content: `The No Sweat Intro (NSI) is the industry-standard sales consultation process used by successful CrossFit affiliates to convert interested prospects into committed members. This 15 to 30 minute meeting is the single highest-leverage activity in a gym's sales process.

The purpose of the No Sweat Intro is NOT to sell a membership. It is to understand the prospect's goals, challenges, and current situation, then recommend the best path forward for them specifically. When done correctly, the membership sells itself.

The NSI structure follows a proven framework. Phase 1 is rapport building for 3 to 5 minutes. Welcome them warmly and offer water. Give a brief tour focusing on the community rather than equipment. Ask open-ended questions about how they heard about the gym.

Phase 2 is discovery for 10 to 15 minutes. This is the most important phase. Ask about their fitness history and what they have tried before. Ask what is motivating them to make a change right now, which reveals urgency. Ask what their ideal outcome looks like in 3, 6, and 12 months. Ask what has prevented them from reaching their goals in the past, which reveals obstacles you can address. Listen more than you talk, the ratio should be 80 percent listening, 20 percent talking.

Phase 3 is the prescription for 5 to 10 minutes. Based on what you learned in discovery, recommend a specific path. This might be foundations classes leading into group membership, personal training first to build confidence then transitioning to group, a combination of group classes and periodic personal training, or nutrition coaching alongside group membership.

Phase 4 is the commitment for 2 to 3 minutes. Present the recommended membership option with pricing. Address any concerns directly and honestly. If they need to discuss with a spouse or partner, schedule a specific follow-up time rather than leaving it open-ended.

Key metrics for No Sweat Intros include conversion rate from NSI to membership. Industry benchmark is 70 to 80 percent. If below 50 percent, the sales process needs attention. Show rate represents the percentage of booked NSIs that actually show up. Target 85 percent or higher. Use confirmation texts and reminders. Speed to lead measures how quickly you respond to an inquiry. Studies show responding within 5 minutes increases conversion by 400 percent compared to responding within 30 minutes.

Common NSI mistakes include talking too much about yourself or the gym instead of listening. Presenting pricing before understanding the prospect's goals makes price the focus rather than value. Not having a clear next step so the prospect leaves without a commitment or scheduled follow-up. Being pushy or using high-pressure sales tactics that are inappropriate for a relationship-based business. Not following up with prospects who did not immediately commit where a systematic follow-up sequence can convert 20 to 30 percent of initial non-buyers.

The follow-up sequence after NSI for prospects who did not join should include a thank-you text within 2 hours, a follow-up call at 48 hours asking if they have any questions, a value-add email at 1 week sharing a success story from a similar member, a final outreach at 2 weeks offering a free class or limited-time incentive. After this sequence, move them to a long-term nurture campaign with monthly value-based content.

Top-performing affiliates report that implementing a structured NSI process increased their close rate from 40 percent to over 75 percent within 3 months.`,
  },
  {
    sourceSlug: "gym-financial-management",
    sourceName: "Two-Brain Business",
    sourceUrl: "https://twobrainbusiness.com/p-and-l/",
    title: "P&L Statements and Financial Management for Gym Owners",
    externalId: "twobrain-financial-pl",
    content: `Chris Cooper of Two-Brain Business outlines essential financial management practices every gym owner must master to build a sustainable and profitable CrossFit affiliate.

The Profit and Loss statement or P&L is the most important financial document for a gym owner. It shows revenue minus expenses equals profit (or loss) for a specific period. Most gym owners should review their P&L monthly, but many never look at it at all. This is like driving with your eyes closed.

Revenue categories for a typical CrossFit affiliate include group class memberships which is the primary revenue stream typically representing 60 to 70 percent of total revenue. Personal training and individual programming add approximately 15 to 25 percent of revenue and are the highest-margin service. Specialty programs such as nutrition coaching, yoga, kids classes, and competition training contribute 5 to 15 percent. Retail including apparel, supplements, and accessories add 2 to 5 percent. Events and challenges provide 2 to 5 percent and serve a dual purpose of revenue and retention.

Expense categories include facility costs (rent, utilities, insurance, maintenance) which should be under 25 percent of revenue. Staff costs including coach pay, admin, and cleaning should be 40 to 44 percent of revenue. Marketing and advertising should be 3 to 5 percent of revenue. Technology including gym management software, website, and payment processing costs 2 to 3 percent. Equipment replacement and maintenance costs 2 to 3 percent. Affiliate fees at $4,500 per year average approximately 1 to 2 percent. Professional services including accounting, legal, and business coaching cost 2 to 3 percent.

Target financial metrics for a healthy CrossFit affiliate include gross profit margin of 30 percent or higher, owner benefit (owner salary plus profits) of $100,000 per year minimum as a target, revenue per square foot of $30 to $50 per square foot per month, and average revenue per member (ARM) of $205 or higher when including all services.

The 4/9ths model for staff pay is a Two-Brain framework where total staff costs including the owner's salary should equal approximately 44 percent (4/9ths) of gross revenue. The remaining 56 percent covers facility at 22 percent, cost of goods at 4 percent, and owner profit at 30 percent.

Cash flow management is critical because gym revenue is often cyclical. January through March is typically the highest enrollment period due to New Year's resolutions. June through August sees a summer slowdown with vacations and outdoor activities competing for attention. September through October brings a fall rebound as routines restart. November through December experiences a holiday dip. Build a cash reserve of 3 to 6 months of operating expenses to weather seasonal fluctuations.

Pricing strategy should be based on your costs plus desired profit margin, not on what competitors charge. The formula is total monthly expenses plus desired owner benefit divided by total members equals minimum monthly rate. If your break-even point requires more members than your facility and schedule can serve, your prices are too low.

Revenue diversification is essential for stability. Gyms that rely on group memberships alone for more than 80 percent of revenue are vulnerable to seasonal fluctuations and market changes. Adding personal training, nutrition coaching, and specialty programs creates multiple revenue streams and increases average revenue per member.`,
  },
  {
    sourceSlug: "community-culture-building",
    sourceName: "CrossFit Community Practices",
    sourceUrl: "https://www.crossfit.com/essentials/affiliate-owners-share-struggles-on-path-to-success",
    title: "Building an Unbreakable Community Culture in Your CrossFit Gym",
    externalId: "cf-community-culture",
    content: `Community is the moat that protects CrossFit affiliates from competition. No globo gym, home workout app, or online program can replicate the genuine human connection found in a well-run CrossFit box. Building this community intentionally rather than hoping it develops organically is what separates thriving gyms from struggling ones.

The foundation of community culture starts with the coach. Every class interaction is an opportunity to strengthen or weaken community bonds. Coaches should arrive 10 to 15 minutes early to greet arriving members and facilitate conversations between members who might not naturally interact. During workouts, coaches should pair members of different ability levels for partner workouts, creating connections across the gym's social groups.

Bright Spots Friday is a practice popularized by Two-Brain Business and widely adopted across CrossFit affiliates. Every Friday, members are encouraged to share a "bright spot" from their week, whether fitness-related or personal. This creates a culture of positivity, vulnerability, and mutual support. Many gym owners report that Bright Spots Friday is the single most impactful community-building practice they have implemented.

Structured social events should happen at minimum quarterly and ideally monthly. These include gym barbecues and potlucks during warmer months, holiday parties and themed workouts during festive seasons, charity workouts like Murph on Memorial Day, intramural competitions that emphasize fun over performance, and family-friendly events that include members' spouses and children.

The CrossFit Open is the single biggest community event of the year. Friday Night Lights, where members complete Open workouts together on Friday evenings with judges, music, and spectators, creates an electric atmosphere that bonds the community. Even members who are not competitive should be encouraged to participate because the Open is about doing something challenging together, not about qualifying for the Games.

Member milestone celebrations reinforce that every member matters regardless of their fitness level. Celebrate first pull-ups, first muscle-ups, first Rx workouts, attendance milestones at 100 classes, 1-year anniversaries, and personal records. Use a bell, whiteboard, or social media posts to make these moments visible to the entire community.

Handling toxic members is essential for protecting community culture. A single negative, overly competitive, or disrespectful member can drive away multiple positive members. Have clear behavioral expectations posted and enforced. If a member consistently undermines the community culture despite direct conversations, it is better for the long-term health of the gym to ask them to leave, even if it means losing revenue in the short term.

Creating member-led initiatives empowers the community to take ownership. Examples include member-organized social outings, study groups for nutrition or mobility, community clean-up or volunteer days, and mentorship programs where experienced members help newcomers.

The financial value of community is measurable. Members who report feeling "part of a community" at their gym stay an average of 3 times longer than those who describe their experience as "just a workout." In a gym with 150 members at $175 per month, improving community connection enough to extend average retention by just 3 months adds over $78,000 in annual revenue.`,
  },
  {
    sourceSlug: "staff-hiring-development",
    sourceName: "CrossFit Affiliate Operations",
    sourceUrl: "https://www.crossfit.com/open-crossfit-gym",
    title: "Hiring, Developing, and Retaining Coaches in Your CrossFit Affiliate",
    externalId: "cf-staffing-coaches",
    content: `Staffing is one of the most challenging aspects of CrossFit affiliate ownership. Finding, developing, and retaining quality coaches directly impacts every other aspect of the business from member retention to revenue growth.

The hiring process should prioritize character and coachability over credentials. A CF-L1 certification is the minimum requirement, but the best coaches are made, not found. Look for candidates who demonstrate genuine care for helping others, strong communication skills, humility and willingness to learn, reliability and professionalism, and alignment with your gym's values and culture.

Where to find coaching candidates includes your existing membership base which is the best source because they already understand and love the culture. Local CrossFit and fitness communities, college exercise science programs, military veterans transitioning to civilian careers, and other CrossFit affiliates whose coaches may be looking for more hours or a new environment are all good sources.

The interview process should include a practical coaching evaluation. Have candidates coach a 15-minute segment to a small group. Evaluate their ability to explain movements clearly, correct form without being condescending, manage the energy of the group, and adapt on the fly when something is not working.

Coach compensation models vary but Two-Brain Business recommends the following framework. Entry-level coaches earn $25 to $35 per class hour for group coaching. Experienced coaches earn $35 to $50 per class hour. Personal training rates are typically $40 to $75 per hour with the coach receiving 40 to 44 percent of the session fee. Additional compensation can include free membership, continuing education allowance, performance bonuses based on member retention, and revenue sharing for personal training clients.

The 2024 industry data shows average coach pay for group classes is $32.50 per hour and average annual coach salary is $29,338. This is a challenge for the industry because it is difficult to attract and retain talented coaches at these compensation levels.

Coach development should be systematic and ongoing. Weekly coach meetings to discuss programming, member concerns, and skill development. Monthly coaching evaluations using video review similar to BHOTD's Coach's Eye program. Annual investment in continuing education including CF-L2, specialty certificates, and external training. Mentorship pairing where new coaches shadow experienced coaches for 4 to 8 weeks.

Preventing coach burnout is critical for retention. Limit coaches to 20 to 25 class hours per week. Provide clear boundaries around communication expectations with members. Offer schedule flexibility and time off. Create a career development path so coaching does not feel like a dead-end. Include coaches in business decisions that affect their classes.

Building a coaching culture means establishing clear standards that all coaches follow. Create a coaching playbook that documents class flow expectations, movement standards, scaling guidelines, member interaction protocols, emergency procedures, and communication templates. This ensures consistency across all classes regardless of which coach is leading, which is essential for member experience and retention.

Common staffing mistakes include hiring friends without proper evaluation, promoting the most experienced athlete rather than the best communicator, underpaying coaches and then being surprised when they leave, not investing in ongoing development, and failing to provide constructive feedback for improvement.`,
  },
  {
    sourceSlug: "marketing-lead-generation",
    sourceName: "CrossFit Affiliate Marketing",
    sourceUrl: "https://www.pushpress.com/blog/crossfit-affiliate",
    title: "Marketing and Lead Generation for CrossFit Affiliates",
    externalId: "cf-marketing-leads",
    content: `Marketing for CrossFit affiliates requires a different approach than traditional gym marketing. The goal is not to compete with $10 per month big-box gyms on price but to attract people who value coaching, community, and results and are willing to pay a premium for them.

The marketing funnel for CrossFit affiliates has five stages. Traffic means getting people to your website or social media. Lead generation converts visitors into contacts by capturing their information. Bookings get leads to schedule a No Sweat Intro or free class. Shows ensure booked prospects actually walk through the door. Sold converts prospects into paying members. Each stage should be measured and optimized independently.

Content marketing is the most effective long-term strategy. Share member transformation stories with permission that emphasize lifestyle changes not just physical results. Post educational content about fitness, nutrition, and wellness. Show behind-the-scenes glimpses of classes, coaching, and community. Create "day in the life" content showing what a typical member experience looks like. Video content significantly outperforms static images on social media.

Local SEO is critical because CrossFit is an inherently local business. Optimize your Google Business Profile with current hours, photos, and responding to all reviews. Encourage satisfied members to leave Google reviews because reviews are the number one factor in local search ranking. Use location-specific keywords on your website such as "CrossFit in [city name]" and "functional fitness [neighborhood]."

Social media strategy should focus on two to three platforms maximum. Instagram is the primary platform for CrossFit content because of its visual nature. Facebook is important for community groups and local targeting. TikTok is growing and works well for short workout clips and gym culture content. Post consistently, at minimum 3 to 5 times per week, with a mix of educational content at 40 percent, community and culture content at 30 percent, promotional content at 20 percent, and user-generated content at 10 percent.

Paid advertising should supplement not replace organic marketing. Facebook and Instagram ads targeting people within 10 miles who have interests in fitness, CrossFit, or functional training. Google Ads targeting search terms like "CrossFit near me" and "gym [city name]." Landing pages should be simple with a clear call-to-action to book a No Sweat Intro. Track cost per lead and cost per acquisition. Industry benchmarks suggest $30 to $75 per lead and $100 to $300 per acquired member.

Referral marketing is the highest-converting and lowest-cost acquisition channel. Create a formal referral program with clear incentives for both the referrer and the new member. "Bring a Friend" workouts create a low-pressure way for members to introduce their friends to CrossFit. Ask for referrals at peak satisfaction moments like after a PR, completing a challenge, or reaching a milestone. The best time to ask for referrals is at the 90-day mark when members are past the honeymoon phase but still enthusiastic.

Retention-focused marketing is often overlooked. Most gyms focus all marketing spend on acquisition while ignoring existing members. Retention-focused marketing includes monthly newsletters highlighting community wins and upcoming events, birthday and anniversary messages, re-engagement campaigns for members who have been absent, and exclusive offers for existing members such as bring-a-friend events and loyalty rewards.

Common marketing mistakes include competing on price which attracts price-sensitive members who churn quickly, using stock photos instead of real photos of your actual gym and members, not responding quickly to inquiries where speed to lead is critical, spending on marketing before fixing retention issues which means pouring water into a leaky bucket, and not tracking ROI on marketing spend.`,
  },
  {
    sourceSlug: "member-experience-journey",
    sourceName: "CrossFit Member Experience",
    sourceUrl: "https://www.pushpress.com/blog/membership-retention-crossfit",
    title: "Optimizing Every Touchpoint in the Member Experience Journey",
    externalId: "cf-member-journey",
    content: `The member experience journey in a CrossFit affiliate encompasses every interaction a member has with the gym, from their first Google search to their decision to stay for years or leave. Optimizing each touchpoint creates a seamless experience that drives retention and referrals.

The pre-member experience begins before someone ever walks through the door. Your website should clearly communicate what CrossFit is and is not, what a typical class looks like, pricing transparency or at minimum a starting point, real member testimonials and transformation stories, and an easy way to book a consultation or free class. Response time to inquiries is critical. Industry data shows that responding within 5 minutes increases conversion by 400 percent compared to a 30-minute response time. Use automated responses for after-hours inquiries but ensure personal follow-up within business hours.

The first visit experience sets the tone for the entire membership. Greet the prospect by name since they shared it when they booked. Give a facility tour emphasizing the community rather than the equipment. Introduce them to at least 2 to 3 current members. If they are attending a class, the coach should be briefed beforehand and provide extra attention. After the visit, send a personal follow-up within 2 hours thanking them and offering to answer any questions.

The class experience is the core product. Every class should feel like the "best hour of their day," which is the standard that BHOTD promotes. The warmup should be engaging and purposeful, not just "run 400 meters and stretch." The workout brief should clearly explain the intended stimulus, movement standards, and scaling options. During the workout, coaches should provide individualized attention, encouragement, and coaching. The cool-down should include a brief community moment such as sharing results or celebrating wins. The overall energy should be positive, inclusive, and motivating.

Communication touchpoints throughout the member journey include weekly emails or newsletters covering upcoming events, programming highlights, and member spotlights. Monthly social media features of member stories and achievements. Quarterly goal review sessions with a coach. Annual membership anniversary recognition.

Technology should enhance rather than replace the personal experience. A gym management app for scheduling, billing, and workout tracking. Automated billing and payment reminders to reduce awkward money conversations. An online booking system for classes, personal training, and consultations. Performance tracking tools where members can see their progress over time.

Handling complaints and issues is a defining moment in the member experience. Acknowledge the concern immediately without being defensive. Take ownership even if the member's perception differs from your intention. Resolve the issue promptly and follow up to ensure satisfaction. View complaints as gifts because most dissatisfied members simply leave without saying anything.

The exit experience is often completely ignored but is critically important. When a member cancels, conduct an exit interview to understand why. This provides invaluable feedback for improving the experience. Make the cancellation process respectful and not guilt-inducing. Leave the door open for return with a genuine invitation. Continue to include them in community events even after they leave because many members who leave eventually return if the relationship was maintained.

Measuring member experience should be done through regular surveys such as Net Promoter Score quarterly, tracking attendance patterns as a leading indicator of satisfaction, monitoring social media mentions and reviews, and conducting informal check-ins during classes.

The financial impact of optimized member experience is significant. Members who rate their experience as "excellent" have 5 times higher retention than those who rate it as "good." They are 3 times more likely to refer friends. They are 2 times more willing to purchase additional services. In a gym with 150 members, moving 20 members from "good" to "excellent" experience can add $50,000 or more in annual revenue through extended retention and referrals.`,
  },
  {
    sourceSlug: "crossfit-programming-strategy",
    sourceName: "CrossFit Programming",
    sourceUrl: "https://www.crossfit.com/playbook",
    title: "Programming Strategy for Member Retention and Results",
    externalId: "cf-programming-retention",
    content: `Programming in a CrossFit affiliate is not just about writing workouts. It is a strategic business decision that directly impacts member retention, satisfaction, and results. The best programming balances challenge and accessibility, variety and consistency, competition and inclusion.

The core programming philosophy should prioritize constantly varied functional movements performed at high intensity, which is the CrossFit definition. However, "constantly varied" does not mean random. Effective programming follows a structured template that ensures balanced stimulus across the week while appearing varied to members.

A typical weekly template might include 2 to 3 days with heavy lifting or strength focus, 2 to 3 days with metabolic conditioning emphasis, 1 to 2 days with gymnastics or skill development, and at least 1 day with a longer endurance-style workout. This template ensures members develop across all fitness domains without overemphasizing any single modality.

Scaling is the most important programming consideration for retention. Every workout must have at minimum 3 levels. Rx which is the prescribed workout for advanced athletes. Scaled which represents a modified version maintaining the intended stimulus for intermediate athletes. Foundations level for newer members still developing basic movement patterns.

The goal of scaling is not to make the workout "easier" but to ensure every member receives an appropriate stimulus. A newer member who completes a properly scaled workout in 12 minutes should feel similarly challenged to the advanced member who completed the Rx version in 12 minutes.

Programming for different member segments requires thoughtfulness. Competitive athletes representing 5 to 10 percent of most gyms need additional volume and competition-specific preparation, but this should not dominate the group class experience. Fitness enthusiasts representing 60 to 70 percent of most gyms are the backbone of the membership. They want challenging, varied, and fun workouts with visible progress. Newer members representing 15 to 25 percent need extra coaching attention, modified movements, and encouragement. They should never feel lost or overwhelmed. Masters athletes over 40 need thoughtful programming that accounts for longer recovery needs, joint health, and mobility limitations.

Seasonal programming can boost engagement. Quarterly strength cycles where you test and retest specific lifts give members tangible progress markers. Open preparation programming in the 4 to 6 weeks before the CrossFit Open creates excitement and community. Summer programming might include more outdoor workouts or running-focused work. Holiday-themed workouts like "12 Days of Christmas" create fun traditions.

Common programming mistakes that hurt retention include too much volume which leads to injuries and burnout. Not explaining the "why" behind workout choices which makes programming feel random. Cherry-picking friendly programming where workouts are designed so athletes can choose which days to attend based on what they like. This creates inconsistent development. Ignoring warm-up quality where a thoughtful warmup is a coaching opportunity and injury prevention tool, not just a checkbox. Programming for the top 5 percent of athletes which alienates the other 95 percent.

The role of programming in member retention is often underestimated. Members who feel the programming helps them improve stay longer. Members who understand why they are doing what they are doing stay longer. Members who feel challenged but not broken stay longer. Members who see variety but also consistency stay longer.

Programming reviews should happen monthly with your coaching team. Discuss what is working, what is not, and what members are saying. Track injury rates as a signal that programming may be too aggressive. Monitor attendance patterns because if certain days consistently have lower attendance, the programming for those days may need adjustment.`,
  },
  {
    sourceSlug: "gym-operations-systems",
    sourceName: "CrossFit Affiliate Operations",
    sourceUrl: "https://www.crossfit.com/playbook",
    title: "Operational Systems That Scale: SOPs for CrossFit Affiliates",
    externalId: "cf-operations-sops",
    content: `Standard Operating Procedures (SOPs) are what transform a CrossFit affiliate from a personality-dependent business into a scalable system. Without documented processes, the gym cannot operate effectively when the owner is absent, quality becomes inconsistent across different coaches and shifts, training new staff takes months instead of weeks, and small problems compound into systemic issues.

The essential SOPs every CrossFit affiliate should document include opening and closing procedures. Opening covers arriving 15 to 30 minutes before first class, unlocking and doing a safety walkthrough checking equipment for damage, turning on music and lights, reviewing the day's programming and preparing equipment, greeting early-arriving members, and posting the workout to social media and the gym app. Closing covers ensuring all members have left, equipment is cleaned and returned to proper storage, bathrooms and floors are clean, trash is taken out, security system is armed and doors are locked.

Class management SOPs include coach arrives 10 minutes before class start time, class begins and ends on time with no exceptions, following a consistent class flow of whiteboard brief, warmup, skill or strength, workout, and cool-down. Music volume should be set to allow coaching cues to be heard. All members must sign in for attendance tracking. Equipment should be returned and cleaned by members with coach oversight.

Sales SOPs cover responding to all inquiries within 5 minutes during business hours. Following the No Sweat Intro framework for all prospects. Documenting every interaction in the CRM. Following the post-NSI sequence for both converted and unconverted leads. Monthly review of sales metrics including lead volume, show rate, and close rate.

Member management SOPs include tracking attendance daily and flagging members who miss 3 consecutive scheduled sessions. Following the 180-day new member journey for all new sign-ups. Conducting quarterly goal reviews. Processing cancellations with an exit interview. Managing billing issues promptly and professionally.

Communication SOPs cover sending weekly newsletters every Monday. Posting to social media 3 to 5 times per week. Responding to all reviews within 24 hours. Sending birthday and anniversary messages. Following up on any member complaints within 4 hours.

Facility maintenance SOPs include daily cleaning checklist, weekly deep clean schedule, monthly equipment inspection and maintenance, quarterly HVAC and plumbing checks, and annual lease review and renewal planning.

Financial SOPs cover daily bank reconciliation, weekly P&L review, monthly financial statements and KPI dashboard update, quarterly tax preparation, and annual budget planning and rate review.

Emergency procedures should cover medical emergency protocol including AED location and CPR certification requirements, severe weather procedures, facility emergency such as fire, flood, or power outage, and member behavioral issues including when and how to ask someone to leave.

Implementing SOPs starts with documenting your current processes, even if they are not perfect. Then refine one SOP per week based on feedback from coaches and staff. Use a shared digital document such as Google Drive or Notion for easy access. Review and update all SOPs quarterly. Include SOPs in new staff onboarding from day one.

The sign of a well-systemized gym is that the owner can take a 2-week vacation and the gym operates at the same quality level as when they are present. If that is not possible today, the gap is in your SOPs.`,
  },
  {
    sourceSlug: "churn-prevention-system",
    sourceName: "Two-Brain Business",
    sourceUrl: "https://twobrainbusiness.com/retention-what-actually-matters/",
    title: "Churn Prevention: Identifying and Saving At-Risk Members",
    externalId: "twobrain-churn-prevention",
    content: `Churn prevention is a systematic approach to identifying members who are at risk of canceling and intervening before they make the decision to leave. Two-Brain Business and other industry leaders have developed data-driven approaches to churn prevention.

The leading indicators of churn that every gym owner should track include attendance decline. When a member goes from 4 sessions per week to 2 sessions per week, they are at risk. A member who has not attended in 7 days needs immediate outreach. After 14 days of absence, the probability of cancellation increases dramatically. Most gym management software can flag these patterns automatically.

Payment issues are another leading indicator. Failed credit card payments that go unresolved are both a revenue leak and a churn signal. Members who switch from unlimited to limited memberships are often in the process of mentally disengaging. Requests for temporary holds or freezes frequently become permanent departures.

Engagement decline beyond attendance includes stopping participation in social events, stopping interaction with gym social media, not participating in the CrossFit Open or gym challenges, and avoiding conversation with coaches or other members.

Life event triggers are the most common reasons members cancel. These include job changes including relocation, new commute, or schedule changes. Family changes such as new baby, divorce, or family health issues. Financial pressure from job loss, unexpected expenses, or budget tightening. Injury or health issues either gym-related or external. Boredom or plateau where they feel they are not making progress.

The intervention framework for at-risk members follows a progression. Level 1 is the automated touchpoint. When attendance drops below their normal pattern, an automated text or email is sent acknowledging their absence and expressing that they are missed. This should feel personal even if automated.

Level 2 is the personal outreach from the coach. If the member does not respond to automated outreach or continues to be absent, their primary coach should reach out directly with a phone call or personal text. The tone should be caring, not accusatory. "Hey Sarah, I noticed you haven't been in this week. Everything okay? We miss you in the 6 AM crew."

Level 3 is the goal review intervention. If the member expresses wavering commitment, schedule a goal review session. Revisit their original goals, show them the progress they have made, and set new engaging goals. Sometimes members just need to be reminded of why they started.

Level 4 is the flexibility offer. If the member is considering canceling due to schedule, financial, or life changes, explore alternatives before accepting the cancellation. Options include schedule adjustment to different class times, membership tier change to reduce cost while maintaining connection, temporary hold with a specific return date, and payment plan adjustment.

Level 5 is the graceful exit. If the member has decided to leave despite all interventions, make the exit experience positive. Conduct a brief exit interview. Express genuine gratitude for their time as a member. Leave the door open for return. Continue to include them in community events.

Tracking churn metrics is essential. Monthly churn rate should be calculated as members lost divided by total members at the start of the month. Target under 3 percent per month. Annual churn rate represents the percentage of members who leave within 12 months. Length of Engagement (LEG) is the average time members stay. Track LEG by cohort to identify if recent changes are improving or worsening retention. Revenue churn tracks the dollar value of lost memberships, which accounts for the fact that losing a high-paying personal training client impacts revenue more than losing a basic membership.

The cost of churn is staggering. If acquiring a new member costs $200 in marketing and sales time, and a member's lifetime value at $175 per month for 12 months is $2,100, then losing that member means losing $1,900 in potential revenue plus the $200 acquisition cost. Preventing even 2 cancellations per month at these numbers saves $50,400 per year.`,
  },
  {
    sourceSlug: "crossfit-south-brooklyn",
    sourceName: "Best Hour of Their Day",
    sourceUrl: "https://www.besthouroftheirday.com/",
    title: "Case Study: CrossFit South Brooklyn - Growing to 800+ Members Without Funnels",
    externalId: "bhotd-cfsb-case-study",
    content: `CrossFit South Brooklyn (CFSB) is one of the most successful CrossFit affiliates in the United States, growing to over 800 members without relying on traditional marketing funnels, paid advertising, or aggressive sales tactics. Their story, featured on the Best Hour of Their Day podcast, provides a masterclass in community-driven growth.

The CFSB growth model is built on four pillars: exceptional coaching, inclusive culture, strategic location, and organic word-of-mouth.

Exceptional coaching at CFSB means every coach undergoes an extensive apprenticeship program before leading classes independently. New coaches shadow experienced coaches for months, gradually taking on more responsibility. Class quality is consistently high regardless of which coach is leading, because the standards are clear and rigorously maintained.

Inclusive culture is perhaps CFSB's greatest strength. The gym deliberately creates an environment where everyone from a complete beginner to a Games-level competitor feels welcome and challenged. The competition culture exists but does not dominate. Social events, volunteer activities, and community traditions create bonds that extend far beyond the gym floor.

Strategic location in Brooklyn, New York gives CFSB access to a large, health-conscious, community-oriented population base. However, many gyms in similar markets fail to achieve anything close to CFSB's success, proving that location alone is not sufficient.

Organic word-of-mouth drives the majority of CFSB's growth. Members are so enthusiastic about their experience that they naturally invite friends, family, and coworkers. The gym does not need to incentivize referrals heavily because the product speaks for itself. When members genuinely love their gym experience, they become unpaid but highly effective marketers.

Key operational insights from CFSB include running multiple class times to accommodate a large membership base without overcrowding individual classes. Investing heavily in coach development rather than marketing. Maintaining a waitlist mentality where membership feels valuable and somewhat exclusive. Creating programming that is accessible to all levels while still challenging the most advanced athletes. Building traditions and rituals that create a sense of belonging and identity.

The financial model at scale with 800 plus members differs from a typical 150-member affiliate. Revenue is higher but so are costs including larger facility, more coaches, more equipment, and higher rent in Brooklyn. The lesson is not that every gym should aim for 800 members but that the principles of exceptional coaching, inclusive culture, and organic growth work at any scale.

What smaller affiliates can learn from CFSB includes prioritizing coaching quality over everything else, creating a culture where members feel they belong to something special, not relying on marketing shortcuts when the product is not yet excellent, building systems that maintain quality as the gym grows, and understanding that sustainable growth comes from happy members not clever marketing.

The counterintuitive lesson from CFSB is that sometimes the best growth strategy is to stop focusing on growth and start focusing on making every existing member's experience extraordinary. When you do that, growth takes care of itself.`,
  },
];

export async function seedKnowledgeBase(): Promise<{
  sourcesCreated: number;
  documentsCreated: number;
  chunksCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sourcesCreated = 0;
  let documentsCreated = 0;
  let chunksCreated = 0;

  for (const article of DOCTRINE_CONTENT) {
    try {
      const seedUrl = `https://ironmetrics.app/knowledge/${article.sourceSlug}`;

      let source = await storage.getKnowledgeSourceByUrl(seedUrl);
      if (!source) {
        source = await storage.createKnowledgeSource({
          name: `${article.sourceName}: ${article.title.substring(0, 60)}`,
          url: seedUrl,
          sourceType: "article",
        });
        sourcesCreated++;
      }

      const doc = await storage.upsertKnowledgeDocument({
        sourceId: source.id,
        externalId: article.externalId,
        title: article.title,
        url: article.sourceUrl,
        channelName: article.sourceName,
        durationSeconds: null,
        rawTranscript: article.content,
        status: "pending",
        chunkCount: 0,
      });

      if (doc.status === "processed" && doc.chunkCount > 0) {
        documentsCreated++;
        chunksCreated += doc.chunkCount;
        console.log(`[SEED] Skipping already processed: ${article.title}`);
        continue;
      }

      await storage.deleteChunksByDocument(doc.id);

      const chunks = chunkTranscript(article.content);
      let docChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        const content = chunks[i];
        const taxonomy = autoTag(content);
        const embedding = await generateEmbedding(content);
        const tokenCount = Math.ceil(content.length / 4);

        await storage.createKnowledgeChunk({
          documentId: doc.id,
          chunkIndex: i,
          content,
          embedding,
          taxonomy,
          tsv: null,
          tokenCount,
        });
        docChunks++;
      }

      await storage.updateKnowledgeDocument(doc.id, {
        status: "processed",
        chunkCount: docChunks,
      });

      await storage.updateKnowledgeSource(source.id, { lastIngestedAt: new Date() });

      documentsCreated++;
      chunksCreated += docChunks;
      console.log(`[SEED] Processed: ${article.title} (${docChunks} chunks)`);

    } catch (err: any) {
      const msg = `Error seeding "${article.title}": ${err.message}`;
      console.error(`[SEED] ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`[SEED] Complete: ${sourcesCreated} sources, ${documentsCreated} docs, ${chunksCreated} chunks`);
  return { sourcesCreated, documentsCreated, chunksCreated, errors };
}
