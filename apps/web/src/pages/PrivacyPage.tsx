const LAST_UPDATED = "19 April 2026";
const CONTACT_EMAIL = "joe@arusinnovation.com";
const COMPANY = "Arus Innovation";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-10 leading-relaxed">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

        <section className="mb-6">
          <p>
            ReviewApp (“we”, “us”) is operated by {COMPANY}. This policy explains what personal
            data we collect when you use the ReviewApp mobile app, web dashboard, or public review
            page, how we use it, and the choices you have.
          </p>
        </section>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. Data we collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><b>Account data:</b> email address, phone number, display name, profile photo, and a Firebase user ID used to sign you in.</li>
          <li><b>Review data:</b> the qualities you tag, thumbs-up signal, and any optional text, voice, or video you record. Voice and video are stored only if you choose to attach them.</li>
          <li><b>Device & anti-fraud data:</b> a device fingerprint (a hash of browser/device attributes), IP address, and timestamps, used to prevent duplicate or fraudulent reviews.</li>
          <li><b>Subscription data:</b> for Employer/Recruiter accounts, a Stripe customer ID and subscription status. We do not store card numbers — Stripe handles payments.</li>
          <li><b>Usage data:</b> standard server logs (request path, status, user agent) retained for up to 30 days for security and debugging.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">2. How we use it</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To create and operate your individual reputation profile.</li>
          <li>To authenticate you and protect the account (OTP, fingerprinting, rate limits).</li>
          <li>To let reviewers leave a review for you via a QR code or public link.</li>
          <li>To let Employer/Recruiter subscribers search individuals and send references, where the individual has consented.</li>
          <li>To process subscription payments through Stripe.</li>
          <li>To send transactional messages (OTP, login notices). We do not send marketing email without opt-in.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">3. Who we share it with</h2>
        <p>We share only what each processor needs to operate the service:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><b>Google Firebase</b> — authentication, push notifications.</li>
          <li><b>Google Cloud Platform</b> — hosting, Cloud SQL, Cloud Run, Secret Manager (Singapore region).</li>
          <li><b>Stripe</b> — subscription billing for paid accounts.</li>
          <li><b>Twilio / email provider</b> — OTP delivery.</li>
        </ul>
        <p className="mt-2">We do <b>not</b> sell personal data. We do not run third-party ads or ad-tracking SDKs.</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">4. Data retention</h2>
        <p>
          Your profile and reviews are retained for as long as your account exists. Server logs are
          retained up to 30 days. You can request deletion at any time (see section 6) and we will
          erase your account and associated reviews within 30 days, subject to any legal hold.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">5. Security</h2>
        <p>
          Data is encrypted in transit (TLS) and at rest (Google Cloud managed encryption).
          Passwords are hashed with bcrypt. Access to production data is restricted to authorised
          engineers under least-privilege IAM.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">6. Your rights</h2>
        <p>You may request at any time:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>A copy of your personal data we hold.</li>
          <li>Correction of inaccurate data (editable in the app for most fields).</li>
          <li>Deletion of your account and associated data.</li>
          <li>Withdrawal of consent for optional processing.</li>
        </ul>
        <p className="mt-2">
          Email <a className="text-blue-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from
          the address on your account and we will respond within 30 days.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">7. Children</h2>
        <p>ReviewApp is not intended for users under 16. We do not knowingly collect data from children.</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">8. Changes</h2>
        <p>
          We may update this policy. The “Last updated” date above will change. Material changes
          will also be surfaced in-app.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">9. Contact</h2>
        <p>
          {COMPANY} · <a className="text-blue-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
