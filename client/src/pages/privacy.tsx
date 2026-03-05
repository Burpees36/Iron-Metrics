import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { IronMetricsLogoCompact } from "@/components/brand-logos";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
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

        <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="text-privacy-effective">Effective Date: January 1, 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>Iron Metrics, Inc. ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform ("the Service"). By using the Service, you consent to the practices described in this policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Information We Collect</h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Account Information:</span> Name, email address, and authentication credentials when you create an account.</li>
              <li><span className="text-foreground font-medium">Gym Member Data:</span> Data you upload about your gym members, including names, contact information, attendance records, membership status, and billing history. This data is provided by you and processed solely to deliver the Service.</li>
              <li><span className="text-foreground font-medium">Usage Data:</span> Information about how you interact with the Service, including pages visited, features used, and session duration.</li>
              <li><span className="text-foreground font-medium">Payment Information:</span> Billing details processed through our payment provider (Stripe). We do not store credit card numbers on our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve the Service</li>
              <li>To generate retention analytics, risk scores, and AI-powered recommendations from your uploaded data</li>
              <li>To process payments and manage your subscription</li>
              <li>To send important service-related communications</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. AI Processing</h2>
            <p>The Service uses artificial intelligence to analyze your uploaded data and generate insights. Your data may be processed by third-party AI providers (such as OpenAI) to generate recommendations and analysis. We send only the minimum necessary data to these providers, and they are contractually prohibited from using your data for training or any purpose other than providing responses to our requests. AI-generated outputs are not guaranteed to be accurate and should be reviewed before acting upon them.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal information or your gym member data. We may share information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Service Providers:</span> Third-party companies that help us operate the Service (e.g., hosting, payment processing, AI providers), bound by confidentiality agreements.</li>
              <li><span className="text-foreground font-medium">Legal Requirements:</span> When required by law, regulation, or legal process.</li>
              <li><span className="text-foreground font-medium">Business Transfers:</span> In connection with a merger, acquisition, or sale of assets, with appropriate notice to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data, including encryption in transit (TLS) and at rest, secure authentication, access controls, and regular security reviews. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide the Service. If you cancel your subscription, we will retain your data for 90 days to allow for data export, after which it will be permanently deleted. You may request earlier deletion by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict certain processing activities</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <span className="text-foreground font-medium">privacy@ironmetrics.io</span>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Cookies and Tracking</h2>
            <p>We use essential cookies to maintain your session and authentication state. We do not use third-party advertising cookies or tracking pixels. Usage analytics are collected in aggregate form to improve the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Children's Privacy</h2>
            <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us so we can take appropriate action.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. International Data Transfers</h2>
            <p>Your data may be processed in countries other than your country of residence. We ensure appropriate safeguards are in place for international transfers in compliance with applicable data protection laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification at least 30 days before they take effect. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact us at <span className="text-foreground font-medium">privacy@ironmetrics.io</span>.</p>
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
