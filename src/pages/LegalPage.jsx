import React from 'react';

/**
 * StudyStack Terms of Service + Privacy Policy.
 *
 * A few things below are placeholders you should fill in before this goes live:
 *   - CONTACT_EMAIL: where account-deletion / data / legal requests should land.
 *   - EFFECTIVE_DATE: bump this any time you materially change either document.
 *
 * Everything else was written to match how StudyStack actually works: Supabase handles auth
 * AND the textbook marketplace (sellers, seller contacts, listings, contact requests, and
 * listing photos in Supabase Storage - see marketplace_schema.sql), while the uploaded
 * timetable PDF is still parsed client-side (parsePdf) and never reaches a server.
 * If that changes (analytics, payments, notifications, a new subprocessor), update below.
 * Have a South African lawyer review this before launch; it is a good-faith draft, not legal advice.
 */

const CONTACT_EMAIL = 'studystacksupport@gmail.com';
const EFFECTIVE_DATE = 'September 24, 2026';

function Section({ id, title, children }) {
  return (
    <section id={id} className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TermsContent() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Effective {EFFECTIVE_DATE}</p>

      <p>
        These Terms of Service ("Terms") govern your use of StudyStack (the "Service"). StudyStack is an
        independent, student-built tool and is <strong>not affiliated with, endorsed by, or operated by the
        University of Pretoria ("UP")</strong>. References to UP, module codes, groups, and venues describe
        the University's own published timetable data and exist only so the Service can be useful to UP
        students. By creating an account or otherwise using StudyStack, you agree to these Terms.
      </p>

      <Section title="1. Eligibility">
        <p>
          StudyStack is intended for currently registered UP students with a valid student email address in
          the form <code>u&lt;8-digit student number&gt;@tuks.co.za</code>. By creating an account, you
          confirm that:
        </p>
        <ul>
          <li>the student email you provide belongs to you and you're entitled to use it;</li>
          <li>you are the age of majority in your jurisdiction, or you have a parent or legal guardian's
            permission to use the Service if you are not; and</li>
          <li>the information you give us is accurate.</li>
        </ul>
      </Section>

      <Section title="2. Your account">
        <p>
          You're responsible for keeping your password confidential and for all activity that happens under
          your account. Let us know at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you think
          someone else has access to it. We may suspend or terminate an account that violates these Terms,
          is used to process someone else's timetable data without their permission, or is used to
          misrepresent someone's identity or student status.
        </p>
      </Section>

      <Section title="3. What StudyStack does — and doesn't do">
        <p>
          StudyStack reads the timetable PDF you upload (the same export available from UP's own systems),
          works out combinations of your groups that don't overlap, and shows or exports them as a weekly
          grid or PDF. It's a planning aid, nothing more:
        </p>
        <ul>
          <li>StudyStack does <strong>not</strong> register, enrol, or change your modules or groups with
            the University in any way;</li>
          <li>StudyStack does not connect to, or receive data from, any official UP system on your behalf —
            you provide the timetable file yourself; and</li>
          <li>you should always check your final module and group choices against UP's own official
            timetable or student portal before relying on them, since StudyStack's output can only be as
            accurate as the file you upload and the logic that processes it.</li>
        </ul>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>upload, or otherwise process, another student's timetable data without their permission;</li>
          <li>try to probe, break, reverse-engineer, or interfere with StudyStack or the services it relies
            on, or use bots, scrapers, or other automated access against it;</li>
          <li>use StudyStack for anything unlawful; or</li>
          <li>attempt to access another user's account.</li>
        </ul>
      </Section>

      <Section title="5. Content you upload">
        <p>
          You keep ownership of the timetable file you upload. You just give StudyStack the limited
          permission needed to process that file, in your own browser, to generate your schedule. See our{' '}
          <button type="button" className="legal-inline-link" data-legal-nav="privacy">Privacy Policy</button>{' '}
          for exactly how that file is (and isn't) handled. You're responsible for making sure you're
          allowed to upload the file you provide.
        </p>
        <p>
          Marketplace listings and listing photos are different: they're meant to be seen. By posting one you
          give StudyStack permission to display it to other users of the Service. You keep ownership, and you
          confirm you have the right to post the photo. Listings are public to anyone who visits the
          marketplace, even without an account.
        </p>
      </Section>

      <Section title="6. Textbook marketplace">
        <p>
          StudyStack lets students list second-hand textbooks and ask sellers for their contact details.
          StudyStack only provides the noticeboard and the introduction. It is <strong>not a party to any
          sale</strong>, doesn't handle payments or deliveries, doesn't inspect or guarantee any book, and
          can't guarantee that a listing is accurate or that a buyer or seller will follow through.
        </p>
        <p>If you use the marketplace, you agree that:</p>
        <ul>
          <li>you'll only list books you own and are entitled to sell, and describe their condition, edition
            and price honestly (and not sell counterfeit or pirated copies);</li>
          <li>a buyer's request to contact a seller is shared with that seller, including the name, contact
            detail and message the buyer typed, and a seller's contact detail is shown to a buyer only
            after the seller approves that buyer's request;</li>
          <li>you won't use contact details you receive for anything other than arranging that sale, and
            won't spam, harass, or pressure other students;</li>
          <li>you're responsible for meeting safely (we suggest a public spot on campus), for checking the
            book before you pay, and for any agreement you make; and</li>
          <li>you won't post anything unlawful, misleading, or offensive, including in listing photos or
            descriptions.</li>
        </ul>
        <p>
          We may remove listings and suspend accounts that break these rules. To report a listing or
          user, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="7. Intellectual property">
        <p>
          The StudyStack name, logo, visual design, and underlying code belong to StudyStack's creator(s) or
          their licensors. Nothing here gives you rights to any of that beyond using the Service as intended.
        </p>
      </Section>

      <Section title="8. No warranty">
        <p>
          StudyStack is a free, independently built tool, provided "as is" and "as available," without
          warranties of any kind — including as to accuracy, reliability, availability, or fitness for a
          particular purpose. Timetable generation is provided on a best-effort basis and may contain bugs
          or be affected by unusual or malformed source PDFs.
        </p>
      </Section>

      <Section title="9. Limitation of liability">
        <p>
          To the fullest extent permitted by law, StudyStack and its creator(s) are not liable for indirect,
          incidental, or consequential losses, or for missed classes, tests, exams, registration deadlines,
          or other losses arising from your use of, or inability to use, the Service, or from relying on a
          timetable it generated instead of your official university records, or from any transaction
          or meeting arranged through the marketplace.
        </p>
      </Section>

      <Section title="10. Changes, suspension, and termination">
        <p>
          We may change, suspend, or discontinue StudyStack, or these Terms, at any time, and will update
          the effective date above when we do. Continuing to use StudyStack after a change means you accept
          the updated Terms. You're free to stop using StudyStack, and to delete your account, whenever you
          like.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These Terms are governed by the laws of South Africa, and any dispute arising from them will be
          handled under South African law, without regard to conflict-of-law rules.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these Terms? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Effective {EFFECTIVE_DATE}</p>

      <p>
        This Privacy Policy explains what personal information StudyStack collects, why, and what control
        you have over it. StudyStack is an independent student project built for University of Pretoria
        students and is not affiliated with the University. We've tried to design it to collect as little
        personal information as possible, and this policy is written to match that.
      </p>

      <Section title="1. Who this policy covers, and who to contact">
        <p>
          StudyStack ("we," "us") decides how your personal information is processed through the Service.
          For any privacy question, request, or concern, contact{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you're in South Africa, you can also
          contact the Information Regulator (<a href="https://inforegulator.org.za" target="_blank" rel="noreferrer">inforegulator.org.za</a>) about
          how your personal information is handled, under the Protection of Personal Information Act
          ("POPIA").
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p><strong>Account information.</strong> When you create an account, we collect the UP student
          email address you sign up with (which contains your student number) and a password. Authentication
          is handled by Supabase, our authentication provider — your password is never stored or visible to
          us in plain text; Supabase stores it hashed, on our behalf.
        </p>
        <p><strong>Marketplace information.</strong> If you use the textbook marketplace we store, in our database
          (Supabase): if you become a seller, your display name (public on your listings) and your chosen contact
          detail (an email address or WhatsApp number), which is private until you approve a specific buyer's
          request; the listings you create (title, author, module code, edition, condition, price,
          description, status) and any photo you upload; and if you ask a seller for contact, the name, contact
          detail and message you provide, plus whether the seller approved or declined. Please don't put
          anything sensitive in listing descriptions, photos or messages.
        </p>
        <p><strong>The timetable file you upload.</strong> StudyStack processes your timetable PDF entirely
          in your own browser to work out a clash-free schedule. That file — and the module, group, venue
          and time details inside it — is not uploaded to, or stored on, any StudyStack server. It stays on
          your device for the current session and is cleared when you close or reload the tab.
        </p>
        <p><strong>Your selections in the app.</strong> The modules, groups, and schedule preferences you
          pick while using the generator are likewise only ever held in your browser to build your
          timetable — we don't transmit or store them on a server.
        </p>
        <p><strong>Basic technical information.</strong> Our hosting provider may automatically log routine
          technical details (like IP address and browser type) for security and reliability, the way most
          websites do. We don't run separate advertising or analytics tracking on top of that.
        </p>
      </Section>

      <Section title="3. Cookies and local storage">
        <p>
          StudyStack doesn't use advertising or tracking cookies. Our authentication provider (Supabase)
          keeps a session token in your browser's local storage so you don't have to sign in every time you
          open the app. That token is only used to keep you signed in, and is cleared when you sign out.
        </p>
      </Section>

      <Section title="4. Why we process your information">
        <ul>
          <li>To create, secure, and let you sign in to your account.</li>
          <li>To generate your timetable, inside your own browser.</li>
          <li>To run the textbook marketplace: showing listings, passing your contact requests to sellers,
            and revealing a seller's contact to a buyer the seller has approved.</li>
          <li>To keep StudyStack secure and prevent misuse of the Service.</li>
        </ul>
        <p>We don't sell your personal information, and we don't use it for advertising.</p>
      </Section>

      <Section title="5. Who we share information with">
        <ul>
          <li><strong>Other students</strong> — but only what's described in section 2: listings and seller
            display names are visible to everyone; a buyer's name, contact detail and message go to the seller
            they asked; and a seller's contact goes to a buyer once that seller approves.</li>
          <li><strong>Supabase, Inc.</strong> — our authentication, database and file-storage provider. It stores your
            account email and hashed password, and your marketplace information and listing photos, on our behalf, under its own security practices. Supabase's infrastructure
            may be located outside South Africa (for example, in the EU or US); using StudyStack means this
            transfer happens as a necessary part of giving you an account.</li>
          <li><strong>Our website hosting provider</strong> — to serve you the StudyStack pages themselves.</li>
        </ul>
        <p>
          We don't share your information with anyone else, except where required by law, or to protect
          StudyStack's rights, users, or the public.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <p>
          We keep your account email and password for as long as your account exists. Marketplace
          listings, requests and photos are kept until you delete them or your account is deleted (deleting a listing
          also removes its photo, and deleting your account removes your seller profile, listings and requests). If you ask us to
          delete your account (see your rights below), we delete that account record from our authentication
          provider. As explained above, we don't retain your uploaded timetable file, your module
          selections, or your generated schedule at all, so there's nothing server-side to delete for those.
          Note that if a buyer has already been shown your contact detail, we can't make them forget it.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          Account security relies on Supabase's authentication infrastructure — passwords are hashed, and
          connections are encrypted in transit. No system is 100% secure, but we rely on established,
          reputable infrastructure rather than handling credentials ourselves.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p>Under POPIA, and similar laws elsewhere, you can ask to:</p>
        <ul>
          <li>find out what personal information we hold about you, and get a copy of it;</li>
          <li>have inaccurate information corrected;</li>
          <li>have your account, and the personal information tied to it, deleted;</li>
          <li>object to, or ask us to restrict, certain processing; and</li>
          <li>withdraw consent at any time — for instance, simply by deleting your account.</li>
        </ul>
        <p>
          To do any of this, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Because a
          StudyStack account is tied to your student number, we may ask you to verify your identity first.
          You can also lodge a complaint with South Africa's Information Regulator at any time.
        </p>
      </Section>

      <Section title="9. Children's privacy">
        <p>
          StudyStack is built for university students and isn't directed at children. We don't knowingly
          collect personal information from anyone under 18 without appropriate consent from a parent or
          guardian.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. The effective date at the top will always
          reflect the latest version, and if a change is significant, we'll try to make that clear within
          the app.
        </p>
      </Section>

      <Section title="11. Contact us">
        <p>
          Questions, requests, or concerns about your information? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </>
  );
}

export function LegalPage({ page, onNavigate }) {
  const isPrivacy = page === 'privacy';

  const go = (target) => {
    if (onNavigate) onNavigate(target);
  };

  // Lets the inline "Privacy Policy" link inside the Terms content switch documents
  // without needing every paragraph to receive its own callback prop.
  const handleContentClick = (event) => {
    const target = event.target.closest('[data-legal-nav]');
    if (target) go(target.getAttribute('data-legal-nav'));
  };

  return (
    <div className="legal-root">
      <style>{`
        .legal-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .legal-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px clamp(16px, 4vw, 48px);
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 5;
        }

        .legal-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          padding: 8px 10px;
          margin-left: -10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .legal-back:hover { color: #0e3868; background: #f1f5f9; }

        .legal-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          color: #0e3868;
        }
        .legal-brand-logo {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }

        .legal-shell {
          flex: 1;
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
          padding: 40px clamp(16px, 4vw, 48px) 64px;
        }

        .legal-switch {
          display: inline-flex;
          background: #eef2f7;
          border-radius: 10px;
          padding: 4px;
          gap: 4px;
          margin-bottom: 28px;
        }
        .legal-switch button {
          font: inherit;
          font-size: 13.5px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #64748b;
          padding: 8px 16px;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .legal-switch button.active {
          background: #ffffff;
          color: #0e3868;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }

        .legal-doc h1 {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .legal-updated {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 24px;
        }
        .legal-doc > p {
          font-size: 15px;
          line-height: 1.65;
          color: #334155;
          margin-bottom: 20px;
        }
        .legal-section {
          margin-top: 32px;
        }
        .legal-section h2 {
          font-size: 17px;
          font-weight: 700;
          color: #0e3868;
          margin-bottom: 10px;
        }
        .legal-section p {
          font-size: 14.5px;
          line-height: 1.65;
          color: #334155;
          margin-bottom: 12px;
        }
        .legal-section ul {
          margin: 0 0 12px;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .legal-section li {
          font-size: 14.5px;
          line-height: 1.6;
          color: #334155;
        }
        .legal-doc code {
          font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
          background: #eef2f7;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 13px;
        }
        .legal-doc a {
          color: #2563eb;
          font-weight: 600;
          text-decoration: none;
        }
        .legal-doc a:hover { text-decoration: underline; }
        .legal-inline-link {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .legal-inline-link:hover { text-decoration: underline; }

        .legal-footer {
          padding: 20px clamp(16px, 4vw, 48px);
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }

        @media (max-width: 640px) {
          .legal-doc h1 { font-size: 24px; }
        }
      `}</style>

      <header className="legal-topbar">
        <button type="button" className="legal-back" onClick={() => go('landing')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to home
        </button>
        <div className="legal-brand">
          <img src="/studystack-mark.png" alt="" className="legal-brand-logo" />
          <span>StudyStack</span>
        </div>
      </header>

      <div className="legal-shell">
        <nav className="legal-switch" role="tablist" aria-label="Legal documents">
          <button type="button" role="tab" aria-selected={!isPrivacy} className={!isPrivacy ? 'active' : ''} onClick={() => go('terms')}>
            Terms of Service
          </button>
          <button type="button" role="tab" aria-selected={isPrivacy} className={isPrivacy ? 'active' : ''} onClick={() => go('privacy')}>
            Privacy Policy
          </button>
        </nav>

        <article className="legal-doc" onClick={handleContentClick}>
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </article>
      </div>

      <footer className="legal-footer">
        © {new Date().getFullYear()} StudyStack. Independent student project — not affiliated with or
        endorsed by the University of Pretoria.
      </footer>
    </div>
  );
}

export default LegalPage;
