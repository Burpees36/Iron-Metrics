import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { IronMetricsLogoCompact } from "@/components/brand-logos";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsOfService() {
  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-14">
          <Link href="/">
            <div className="flex items-center cursor-pointer" data-testid="link-logo-home">
              <IronMetricsLogoCompact className="h-9 w-auto" variant="dark" />
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="pt-24 pb-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="text-terms-effective">Effective Date: January 1, 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Iron Metrics ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service. The Service is operated by Iron Metrics, Inc. ("we," "us," or "our").</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>Iron Metrics is a SaaS platform that provides retention intelligence, churn prediction, billing analytics, and AI-powered operational recommendations for fitness businesses. The Service analyzes member data you provide to generate insights, risk scores, and suggested interventions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Account Registration</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration and to keep it updated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Subscriptions and Payment</h2>
            <p>Access to the Service requires a paid subscription after the trial period. Subscription fees are billed in advance on a monthly basis. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice. Your subscription will automatically renew unless you cancel before the end of the current billing period.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Free Trial</h2>
            <p>New accounts may be eligible for a 14-day free trial. During the trial, you will have access to all features of your selected plan. If you do not subscribe before the trial ends, your access to premium features will be suspended. No payment information is required to start a trial.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Cancellation</h2>
            <p>You may cancel your subscription at any time from your account settings. Upon cancellation, you will retain access to the Service until the end of your current billing period. After that, your account will be downgraded and access to premium features will be suspended. Your data will be retained for 90 days after cancellation, during which time you may export it.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Your Data</h2>
            <p>You retain ownership of all data you upload to the Service ("Your Data"). By using the Service, you grant us a limited license to process Your Data solely for the purpose of providing the Service. We will not sell, share, or use Your Data for any purpose other than delivering the Service to you.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. AI-Generated Content Disclaimer</h2>
            <p>The Service uses artificial intelligence to generate recommendations, risk assessments, and operational suggestions. These outputs are provided for informational purposes only and should not be considered professional business, financial, or legal advice. AI-generated content may contain inaccuracies. You are solely responsible for any decisions made based on the Service's outputs. We do not guarantee the accuracy, completeness, or reliability of AI-generated recommendations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Acceptable Use</h2>
            <p>You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to gain unauthorized access to the Service or its systems; (c) interfere with or disrupt the Service; (d) upload malicious code or content; (e) resell or redistribute the Service without authorization; (f) use the Service to store or process data in violation of applicable privacy laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Service Availability</h2>
            <p>We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We will make reasonable efforts to provide advance notice of planned downtime.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Iron Metrics shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact</h2>
            <p>If you have questions about these Terms, please contact us at <span className="text-foreground font-medium">legal@ironmetrics.io</span>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <IronMetricsLogoCompact className="h-8 w-auto" variant="dark" />
          <div className="flex items-center gap-4">
            <Link href="/terms"><span className="hover:underline cursor-pointer" data-testid="link-footer-terms">Terms</span></Link>
            <Link href="/privacy"><span className="hover:underline cursor-pointer" data-testid="link-footer-privacy">Privacy</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
