import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions | Budget Partner HQ",
  description:
    "Terms of use for Budget Partner HQ — personal finance tracking and planning tools.",
};

const LAST_UPDATED = "April 3, 2026";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 animate-fade-in">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            1. Agreement to these terms
          </h2>
          <p>
            By accessing or using Budget Partner HQ (&quot;the Service&quot;), you agree to be bound
            by these Terms &amp; Conditions. If you do not agree, do not use the Service. We may
            update these terms from time to time; the &quot;Last updated&quot; date above will change,
            and continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            2. Description of the Service
          </h2>
          <p>
            Budget Partner HQ provides tools to help you organise and visualise personal financial
            information—such as accounts, transactions, budgets, debts, subscriptions, and related
            records—along with optional features that may include automated insights or AI-assisted
            guidance. The Service is provided for informational and organisational purposes only.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            3. Not financial, legal, or tax advice
          </h2>
          <p>
            Nothing in the Service constitutes financial, investment, legal, or tax advice. Outputs
            (including AI-generated suggestions, alerts, or calculations) are illustrative and may
            be incomplete or inaccurate. You are solely responsible for your financial decisions. You
            should consult qualified professionals before acting on information from the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            4. Eligibility and accounts
          </h2>
          <p>
            You must be able to enter a binding contract in your jurisdiction to use the Service.
            You agree to provide accurate registration information and to keep your credentials
            secure. You are responsible for all activity under your account. Notify us promptly if
            you suspect unauthorised access.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            5. Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the Service for any unlawful purpose or in violation of applicable laws.</li>
            <li>
              Attempt to gain unauthorised access to the Service, other users&apos; data, or our
              systems.
            </li>
            <li>
              Upload malware, scrape or overload the Service, or interfere with its operation or
              security.
            </li>
            <li>Misrepresent your identity or misuse another person&apos;s information.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            6. Your data and privacy
          </h2>
          <p>
            You retain ownership of information you submit. You grant us the rights necessary to
            host, process, and display that information to operate the Service. We handle personal
            data as described in our privacy practices (where applicable) and in accordance with
            the functionality you enable. You are responsible for the accuracy of data you enter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            7. AI and automated features
          </h2>
          <p>
            If you use AI-assisted or automated features, you understand that responses may contain
            errors or omissions and should not be relied upon as sole authority for decisions. Do not
            enter highly sensitive secrets (e.g. full card numbers or government IDs) unless the
            Service explicitly requires them and you accept the risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            8. Availability and changes
          </h2>
          <p>
            We aim for reliable operation but do not guarantee uninterrupted or error-free
            access. We may modify, suspend, or discontinue features with reasonable notice where
            practicable. We are not liable for loss arising from downtime or changes beyond our
            reasonable control.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            9. Disclaimer of warranties
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind,
            whether express or implied, including merchantability, fitness for a particular purpose,
            or non-infringement, to the fullest extent permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            10. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, Budget Partner HQ and its operators shall not
            be liable for any indirect, incidental, special, consequential, or punitive damages, or
            any loss of profits, data, or goodwill, arising from your use of the Service. Our
            aggregate liability for any claim relating to the Service shall not exceed the greater of
            (a) the amounts you paid us for the Service in the twelve (12) months before the claim,
            or (b) zero if you have not paid fees. Some jurisdictions do not allow certain
            limitations; in those cases, our liability is limited to the fullest extent permitted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            11. Indemnity
          </h2>
          <p>
            You agree to indemnify and hold harmless Budget Partner HQ and its operators from
            claims, damages, and expenses (including reasonable legal fees) arising from your use of
            the Service, your content, or your violation of these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            12. Termination
          </h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate access if you
            breach these terms, create risk, or where required by law. Provisions that by their nature
            should survive (e.g. disclaimers, limitations, indemnity) will survive termination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            13. Governing law
          </h2>
          <p>
            These terms are governed by the laws applicable in your primary place of residence or,
            where the operator designates a jurisdiction, that jurisdiction—without regard to
            conflict-of-law principles. Courts in that jurisdiction shall have exclusive venue,
            subject to mandatory consumer protections in your country.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            14. Contact
          </h2>
          <p>
            For questions about these terms, use the contact or support channel indicated in the
            application or on our website, or write to the operator of Budget Partner HQ at the
            official support address published there.
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        See also:{" "}
        <Link href="/refund-policy" className="font-medium text-primary hover:underline">
          Refund Policy
        </Link>
        .
      </p>
    </article>
  );
}
