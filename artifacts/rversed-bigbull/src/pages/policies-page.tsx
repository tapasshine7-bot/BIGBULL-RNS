import { FileText, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <article className="policies-panel">
      <div className="policies-panel-heading">
        <div className="policies-section-label"><Icon size={13} strokeWidth={1.8} /><span>{title}</span></div>
      </div>
      <div className="policies-body">{children}</div>
    </article>
  );
}

export function PoliciesPage() {
  return (
    <div className="route-in dashboard-page">
      <header className="dashboard-topbar">
        <div>
          <div className="dashboard-kicker">Legal</div>
          <h1 className="dashboard-welcome">Site <span>policies</span></h1>
          <p className="dashboard-subtitle">Last updated: August 19, 2026</p>
        </div>
        <div className="network-nominal"><span className="signal-pulse" /> rnsbigbull.site</div>
      </header>

      <div className="policies-grid">
        <Section title="Terms & Conditions" icon={Scale}>
          <p>Welcome to <b>rnsbigbull.site</b> (&ldquo;the Site&rdquo;). By accessing or using the Site, you agree to these Terms &amp; Conditions. If you do not agree, please do not use the Site.</p>
          <h3>1. Acceptable use</h3>
          <p>The Site provides free access to player tools and informational content. You agree not to misuse, reverse-engineer, scrape, or attack the Site, its tools, or its API. Automated or bulk access of any kind is prohibited.</p>
          <h3>2. No account required</h3>
          <p>The Site is fully open access. No registration, login, or payment is required to use any feature. Nothing on the Site will ever ask you for passwords, payment details, or personal identifiers.</p>
          <h3>3. Third-party tools</h3>
          <p>The Site may link to external (&ldquo;partner&rdquo;) tools and websites. Those external services are operated by third parties and are subject to their own terms. We are not responsible for the content, availability, or behaviour of third-party services.</p>
          <h3>4. Content ownership</h3>
          <p>All design, branding, logos, and original content on the Site are the property of RVRSED BIGBULL. You may not copy, redistribute, or resell any part of the Site without written permission.</p>
          <h3>5. Changes to terms</h3>
          <p>We may update these terms at any time. Continued use of the Site after a change means you accept the revised terms. The &ldquo;Last updated&rdquo; date above reflects the most recent revision.</p>
        </Section>

        <Section title="Privacy Policy" icon={ShieldCheck}>
          <p>We keep this simple: <b>the Site does not collect personal data.</b></p>
          <h3>What we don&rsquo;t collect</h3>
          <p>No accounts, no logins, no emails, no phone numbers, no payment details. Nothing you type or generate with the tools (such as bios) is stored or sent back to us.</p>
          <h3>What happens automatically</h3>
          <p>Like most websites, the Site is delivered through Cloudflare, a standard content-delivery service. Cloudflare may log routine technical data such as IP addresses, request timestamps, and browser type, purely to keep the Site fast, secure, and online. This data is subject to Cloudflare&rsquo;s own privacy policy, not ours.</p>
          <h3>Local storage</h3>
          <p>The Site is a Progressive Web App (PWA). Installable-app data (cache, service worker) lives only on your own device and can be cleared at any time through your browser settings.</p>
          <h3>Cookies &amp; tracking</h3>
          <p>The Site uses no advertising cookies, no third-party trackers, and no analytics scripts.</p>
          <h3>Contact</h3>
          <p>For any privacy question, write to us at <b>support@rversedbigbull.com</b>.</p>
        </Section>

        <Section title="Disclaimer" icon={FileText}>
          <p>The Site and its tools are provided <b>&ldquo;as is&rdquo;</b> without warranties of any kind, express or implied.</p>
          <h3>No guarantees</h3>
          <p>We do not guarantee uninterrupted availability, accuracy, or fitness of the Site or any linked tool for any particular purpose. Status indicators shown on the Site are informational only.</p>
          <h3>Not affiliated with third parties</h3>
          <p>RVRSED BIGBULL is not affiliated with, endorsed by, or connected to any third-party platform or service linked from the Site. All trademarks mentioned belong to their respective owners.</p>
          <h3>Your responsibility</h3>
          <p>You are responsible for how you use any tool or output from the Site and for complying with the terms of any external service you use through it.</p>
          <h3>Limitation of liability</h3>
          <p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential loss arising from the use or inability to use the Site.</p>
          <p className="policies-closing">By using rnsbigbull.site you acknowledge that you have read and accept these policies.</p>
        </Section>
      </div>

      <div className="policies-footer">
        <span>Need help? </span>
        <Link href="/gateway" className="policies-back-link">Back to dashboard</Link>
        <span className="policies-footer-sep">•</span>
        <a href="mailto:support@rversedbigbull.com" className="policies-back-link">support@rversedbigbull.com</a>
      </div>
    </div>
  );
}
