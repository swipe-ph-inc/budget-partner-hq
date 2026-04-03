import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy | Budget Partner HQ",
  description:
    "Refund and billing policy for Budget Partner HQ subscriptions and paid features.",
};

const LAST_UPDATED = "April 3, 2026";

export default function RefundPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 animate-fade-in">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Refund Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            1. Scope
          </h2>
          <p>
            This Refund Policy applies to fees you pay to Budget Partner HQ (&quot;we&quot;, &quot;us&quot;) for
            subscriptions, premium features, or other paid digital services we offer from time to
            time. It does not cover third-party products (e.g. your bank, card issuer, or app store
            billing rules beyond our control).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            2. Free access
          </h2>
          <p>
            Where the Service or parts of it are offered without charge, no payment is taken and no
            refund applies. Optional paid upgrades are governed by the terms shown at checkout and
            this policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            3. Subscription billing
          </h2>
          <p>
            Paid plans are generally billed in advance for each billing period (e.g. monthly or
            annually). Unless stated otherwise at purchase, subscriptions renew automatically until
            you cancel. You can cancel future renewals through your account or billing portal; doing
            so stops charges after the end of the current paid period.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            4. Refund eligibility
          </h2>
          <p>
            <strong className="text-foreground">Digital services.</strong> Because the Service is
            delivered digitally, refunds are considered on a case-by-case basis and may be limited
            where you have already received substantial use of the paid period.
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>
              <strong className="text-foreground">Within 14 days of initial purchase</strong> of
              a new paid subscription (first payment only): you may request a full refund if you
              have not materially abused the Service and we can verify the purchase. This cooling-off
              period may not apply where mandatory law provides differently.
            </li>
            <li>
              <strong className="text-foreground">Renewals</strong> are generally non-refundable
              once the new period has started, except where required by law or at our discretion for
              billing errors or duplicate charges.
            </li>
            <li>
              <strong className="text-foreground">Annual plans</strong>: if you cancel mid-term,
              we may, at our discretion, offer a pro-rata refund for unused whole months or credit
              toward a future plan—this is not guaranteed unless required by applicable law.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            5. Non-refundable situations
          </h2>
          <p>We typically do not provide refunds in the following cases:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Violation of our Terms &amp; Conditions leading to suspension or termination.</li>
            <li>Change of mind after the eligible window, where no billing error occurred.</li>
            <li>
              Issues caused by your device, network, or third-party integrations outside our
              reasonable control.
            </li>
            <li>Fees collected and controlled solely by an app store or payment processor under their policies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            6. How to request a refund
          </h2>
          <p>
            Email or contact us through the support channel listed in the app or on our website.
            Include your account email, date of charge, and amount. We will respond within a
            reasonable time (typically within ten (10) business days) and may ask for additional
            verification to prevent fraud.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            7. Processing and timing
          </h2>
          <p>
            Approved refunds are issued to the original payment method where possible. Banks and card
            issuers may take additional days to post credits to your statement. Currency differences
            or fees charged by your bank are outside our control.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            8. Changes to this policy
          </h2>
          <p>
            We may update this Refund Policy. The &quot;Last updated&quot; date will change; material changes
            may be communicated by email or in-app notice where appropriate. Continued use of paid
            features after changes constitutes acceptance unless applicable law requires otherwise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            9. Contact
          </h2>
          <p>
            For refund questions, use the official support contact published in Budget Partner HQ or
            on our website. We will work in good faith to resolve billing disputes.
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        See also:{" "}
        <Link href="/terms" className="font-medium text-primary hover:underline">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </article>
  );
}
