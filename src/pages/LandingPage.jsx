import React, { useState } from 'react';
import { PortalGuideModal } from '../components/PortalGuideModal.jsx';
import { TimetableDemo } from '../components/TimetableDemo.jsx';

const IconZap = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconSunrise = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 0 0-10 0"></path>
    <line x1="12" y1="2" x2="12" y2="9"></line>
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line>
    <line x1="1" y1="18" x2="3" y2="18"></line>
    <line x1="21" y1="18" x2="23" y2="18"></line>
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line>
    <line x1="23" y1="22" x2="1" y2="22"></line>
    <polyline points="8 6 12 2 16 6"></polyline>
  </svg>
);

const IconSunset = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 0 0-10 0"></path>
    <line x1="12" y1="9" x2="12" y2="2"></line>
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line>
    <line x1="1" y1="18" x2="3" y2="18"></line>
    <line x1="21" y1="18" x2="23" y2="18"></line>
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line>
    <line x1="23" y1="22" x2="1" y2="22"></line>
    <polyline points="16 5 12 9 8 5"></polyline>
  </svg>
);

const IconCalendar = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const IconFastForward = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 19 22 12 13 5 13 19"></polygon>
    <polygon points="2 19 11 12 2 5 2 19"></polygon>
  </svg>
);

const IconUpload = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const IconCpu = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
    <rect x="9" y="9" width="6" height="6"></rect>
    <line x1="9" y1="1" x2="9" y2="4"></line>
    <line x1="15" y1="1" x2="15" y2="4"></line>
    <line x1="9" y1="20" x2="9" y2="23"></line>
    <line x1="15" y1="20" x2="15" y2="23"></line>
    <line x1="20" y1="9" x2="23" y2="9"></line>
    <line x1="20" y1="14" x2="23" y2="14"></line>
    <line x1="1" y1="9" x2="4" y2="9"></line>
    <line x1="1" y1="14" x2="4" y2="14"></line>
  </svg>
);

const IconLock = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const IconBook = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
);
const IconShuffle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8"></polyline>
    <line x1="4" y1="20" x2="21" y2="3"></line>
    <polyline points="21 16 21 21 16 21"></polyline>
    <line x1="15" y1="15" x2="21" y2="21"></line>
    <line x1="4" y1="4" x2="9" y2="9"></line>
  </svg>
);

const IconPrinter = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"></polyline>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
    <rect x="6" y="14" width="12" height="8"></rect>
  </svg>
);

const IconSearch = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export function LandingPage({ onLaunchGenerator, onNavigate }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [showPortalGuide, setShowPortalGuide] = useState(false);

  const NAV_OFFSET = 84; // sticky nav height plus a little breathing room

  // Custom eased scroll, independent of the browser's native smooth-scroll (which some
  // browsers/OS "reduce motion" settings silently turn into an instant jump). Duration
  // scales a bit with distance so short hops and long jumps both feel natural.
  const scrollToY = (targetY, duration = 700) => {
    const startY = window.pageYOffset;
    const distance = targetY - startY;
    const startTime = performance.now();

    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo({ top: startY + distance * easeInOutCubic(progress), behavior: 'instant' });
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const handleNavClick = (sectionId) => (e) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;
    const distance = Math.abs(top - window.pageYOffset);
    // Cap so a very long scroll doesn't drag on forever, floor so short hops still animate.
    const duration = Math.min(1100, Math.max(450, distance * 0.5));
    scrollToY(top, duration);
  };

  const faqs = [
    {
      q: "Do I need to sign up or log in to use StudyStack?",
      a: "Yes, with a quick one-time sign up using your UP student email: the letter u, your 8-digit student number, then @tuks.co.za (for example u12345678@tuks.co.za). Other email addresses can't be used. Once you're in, upload your UP module timetable PDF and produce conflict-free schedules in seconds."
    },
    {
      q: "Is my personal student schedule data private?",
      a: "Yes. StudyStack processes your timetable right inside your browser using client-side JavaScript. Your PDF file, course selections, and generated timetable never get sent to any server or cloud database. Only your account (your UP email and a hashed password) is stored, by our authentication provider. If you use the textbook marketplace, the listings and contact details you choose to share are stored too. See our Privacy Policy for the details."
    },
    {
      q: "How does the textbook marketplace work?",
      a: "Sellers list a book with its module code, condition and price. Buyers browse and search by module code, then request the seller's contact details. The seller sees who is asking and decides whether to approve. Only after approval does the buyer see how to reach them (email or WhatsApp), so your number is never public. Browsing needs no account; listing a book or requesting contact needs your UP student email."
    },
    {
      q: "Does StudyStack handle payment or delivery for textbooks?",
      a: "No. StudyStack only connects students. You agree the price and hand-over yourselves, so meet somewhere public on campus and check the book before you pay."
    },
    {
      q: "Where do I get the timetable PDF from?",
      a: (
        <>
          Download your module timetable export directly from the University of Pretoria Student Portal
          (my.up.ac.za). The official exported file name usually starts with UP_MOD_XLS (for example:
          UP_MOD_XLS_2026.pdf).{' '}
          <button
            type="button"
            onClick={() => setShowPortalGuide(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontWeight: 600,
              color: '#2563eb',
              cursor: 'pointer',
            }}
          >
            See the step-by-step guide →
          </button>
        </>
      )
    },
    {
      q: "What schedule optimization preferences are available?",
      a: "You can choose between Morning (prioritizes earlier class slots), Afternoon (pushes sessions later for late risers), Free Day (maximizes days with zero classes), and Early Friday (finishes your Friday sessions as early as possible so your weekend starts sooner)."
    },
    {
      q: "Can I mix different groups for lectures, practicals, and tutorials?",
      a: "Yes! StudyStack allows you to manually adjust or lock specific groups for each activity (Lecture, Practical, Tutorial) and will recalculate any clashes immediately."
    }
  ];

  return (
    <div className="landing-root">
      <PortalGuideModal open={showPortalGuide} onClose={() => setShowPortalGuide(false)} />
      <style>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
        }

        .landing-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          line-height: 1.6;
          overflow-x: hidden;
        }

        /* Nav Bar */
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #e2e8f0;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(16px, 4vw, 48px);
        }

        .landing-nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          cursor: pointer;
        }

        .landing-nav-logo {
          height: 38px;
          width: auto;
          object-fit: contain;
        }

        .landing-nav-title {
          font-size: 18px;
          font-weight: 800;
          color: #0e3868;
          letter-spacing: -0.02em;
        }

        .landing-nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .landing-nav-link {
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .landing-nav-link:hover {
          color: #0e3868;
        }

        .landing-nav-link-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          cursor: pointer;
        }

        .landing-nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #0e3868;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(14, 56, 104, 0.15);
        }

        .landing-nav-cta:hover {
          background: #144e8c;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(14, 56, 104, 0.2);
        }

        /* Hero Section */
        .landing-hero {
          position: relative;
          padding: 72px 24px 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          background: radial-gradient(circle at 50% 20%, #eff6ff 0%, #ffffff 70%);
          border-bottom: 1px solid #e2e8f0;
        }

        .hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #e0f2fe;
          border: 1px solid #bae6fd;
          color: #0369a1;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 9999px;
          margin-bottom: 28px;
          box-shadow: 0 1px 3px rgba(3, 105, 161, 0.08);
        }

        .hero-logo-showcase {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
        }

        .hero-main-logo {
          max-width: 320px;
          height: auto;
          filter: drop-shadow(0 10px 25px rgba(14, 56, 104, 0.12));
          transition: transform 0.3s ease;
        }

        .hero-main-logo:hover {
          transform: scale(1.02);
        }

        .hero-headline {
          font-size: clamp(32px, 5.5vw, 56px);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: #0e3868;
          max-width: 820px;
          margin-bottom: 18px;
        }

        .hero-subhead {
          font-size: clamp(16px, 2vw, 19px);
          color: #475569;
          max-width: 680px;
          margin-bottom: 38px;
          line-height: 1.6;
        }

        /* Central Action Button */
        .hero-cta-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-bottom: 48px;
        }

        .hero-primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #0e3868;
          color: #ffffff;
          font-size: 18px;
          font-weight: 700;
          padding: 18px 38px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 25px -3px rgba(14, 56, 104, 0.35), 0 4px 6px -2px rgba(14, 56, 104, 0.1);
        }

        .hero-primary-btn:hover {
          background: #144e8c;
          transform: translateY(-2px);
          box-shadow: 0 16px 32px -4px rgba(14, 56, 104, 0.45), 0 6px 10px -3px rgba(14, 56, 104, 0.15);
        }

        .hero-primary-btn:active {
          transform: translateY(0);
        }

        .hero-btn-arrow {
          transition: transform 0.2s ease;
        }

        .hero-primary-btn:hover .hero-btn-arrow {
          transform: translateX(4px);
        }

        .hero-secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #ffffff;
          color: #0e3868;
          font-size: 15px;
          font-weight: 600;
          padding: 12px 26px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hero-secondary-btn:hover {
          border-color: #0e3868;
          background: #f8fafc;
        }

        .hero-trust-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: center;
          font-size: 13px;
          color: #64748b;
        }

        .hero-trust-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hero-trust-check {
          color: #16a34a;
          display: inline-flex;
        }

        .hero-trust-dot {
          color: #cbd5e1;
        }

        /* Feature Cards (Preferences) */
        .hero-preference-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
          max-width: 960px;
          width: 100%;
          margin-top: 10px;
          text-align: left;
          scroll-margin-top: 84px;
        }

        .pref-preview-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 18px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
        }

        .pref-preview-card:hover {
          border-color: #93c5fd;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(14, 56, 104, 0.08);
        }

        .pref-icon-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .pref-icon {
          color: #2563eb;
          display: inline-flex;
        }

        .pref-title {
          font-size: 14px;
          font-weight: 700;
          color: #0e3868;
        }

        .pref-desc {
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
        }

        /* Section Container */
        .landing-section {
          padding: 80px 24px;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          scroll-margin-top: 84px;
        }

        .section-header-center {
          text-align: center;
          margin-bottom: 56px;
        }

        .section-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          display: inline-block;
        }

        .section-title {
          font-size: clamp(26px, 3.5vw, 36px);
          font-weight: 800;
          color: #0e3868;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }

        .section-desc {
          font-size: 16px;
          color: #64748b;
          max-width: 600px;
          margin: 0 auto;
        }

        /* Steps Row */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 28px;
        }

        .step-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 32px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: border-color 0.2s ease;
        }

        .step-card:hover {
          border-color: #94a3b8;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }

        .step-num-pill {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #0e3868;
          color: #ffffff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-heading {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }

        .step-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .feature-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 28px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          transition: all 0.2s ease;
        }

        .feature-box:hover {
          transform: translateY(-3px);
          border-color: #bfdbfe;
          box-shadow: 0 12px 28px rgba(14, 56, 104, 0.08);
        }

        .feature-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          margin-bottom: 16px;
        }

        .feature-title {
          font-size: 17px;
          font-weight: 700;
          color: #0e3868;
          margin-bottom: 8px;
        }

        .feature-desc {
          font-size: 14px;
          color: #64748b;
          line-height: 1.55;
        }

        /* Banner CTA */
        .banner-cta-container {
          background: linear-gradient(135deg, #0e3868 0%, #172554 100%);
          border-radius: 0;
          padding: 72px clamp(20px, 4vw, 48px);
          text-align: center;
          color: #ffffff;
          margin: 0;
          width: 100%;
          max-width: none;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .banner-logo-mark {
          height: 64px;
          width: auto;
          object-fit: contain;
          margin-bottom: 4px;
        }

        .banner-headline {
          font-size: clamp(24px, 3.5vw, 36px);
          font-weight: 800;
          letter-spacing: -0.02em;
          max-width: 600px;
        }

        .banner-subhead {
          font-size: 16px;
          color: #93c5fd;
          max-width: 520px;
          line-height: 1.5;
        }

        .banner-btn {
          background: #ffffff;
          color: #0e3868;
          font-size: 16px;
          font-weight: 700;
          padding: 14px 32px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .banner-btn:hover {
          background: #eff6ff;
          transform: scale(1.03);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
        }

        .banner-btn-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
        }
        .banner-btn-outline {
          background: transparent;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: none;
        }
        .banner-btn-outline:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }

        /* Textbook marketplace section */
        .market-cta-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin-top: 40px;
        }
        .market-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #0e3868;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          padding: 14px 30px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .market-cta-btn:hover { background: #144e8c; }
        .market-cta-link {
          background: none;
          border: none;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .market-cta-link:hover { text-decoration: underline; }

        /* FAQ Accordion */
        .faq-accordion {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 780px;
          margin: 0 auto;
        }

        .faq-item {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }

        .faq-item:hover {
          border-color: #cbd5e1;
        }

        .faq-question-btn {
          width: 100%;
          padding: 18px 20px;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          text-align: left;
          cursor: pointer;
        }

        .faq-question-btn:hover {
          color: #0e3868;
        }

        .faq-answer {
          padding: 0 20px 18px;
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
        }

        /* Footer */
        .landing-footer {
          background: #0f172a;
          color: #94a3b8;
          padding: 48px clamp(16px, 4vw, 48px) 36px;
          border-top: 1px solid #1e293b;
        }

        .footer-content {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .footer-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 24px;
        }

        .footer-brand-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 360px;
        }

        .footer-logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footer-logo-img {
          height: 32px;
          width: auto;
          object-fit: contain;
        }

        .footer-brand-title {
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
        }

        .footer-brand-desc {
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        .footer-links-row {
          display: flex;
          gap: 32px;
          flex-wrap: wrap;
        }

        .footer-link-item {
          color: #cbd5e1;
          font-size: 14px;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .footer-link-item:hover {
          color: #ffffff;
        }

        .footer-legal-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footer-legal-link {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          font-size: 12px;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .footer-legal-link:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        .footer-legal-sep {
          color: #334155;
          font-size: 12px;
        }

        .footer-disclaimer-card {
          padding-top: 24px;
          border-top: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 12px;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .landing-nav-links {
            display: none;
          }
          .hero-preference-grid {
            grid-template-columns: 1fr 1fr;
          }
          .hero-primary-btn {
            width: 100%;
            padding: 16px 24px;
            font-size: 16px;
          }
        }

        @media (max-width: 520px) {
          .hero-preference-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Top Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-brand" onClick={() => scrollToY(0)}>
          <img src="/studystack-mark.png" alt="StudyStack Logo" className="landing-nav-logo" />
          <span className="landing-nav-title">StudyStack</span>
        </div>

        <div className="landing-nav-links">
          <a href="#how-it-works" className="landing-nav-link" onClick={handleNavClick('how-it-works')}>How it works</a>
          <a href="#preferences" className="landing-nav-link" onClick={handleNavClick('preferences')}>Preferences</a>
          <a href="#demo" className="landing-nav-link" onClick={handleNavClick('demo')}>Demo</a>
          <a href="#faq" className="landing-nav-link" onClick={handleNavClick('faq')}>FAQ</a>
          <button
            type="button"
            className="landing-nav-link landing-nav-link-btn"
            onClick={() => onNavigate?.('books')}
          >
            Textbook Market
          </button>
        </div>

        <button className="landing-nav-cta" onClick={onLaunchGenerator}>
          <span>Open Generator</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-pill-badge">
          <IconZap size={14} />
          <span>Built for University of Pretoria Students • Timetables Stay Private in Your Browser</span>
        </div>

        <div className="hero-logo-showcase">
          <img
            src="/studystack-logo-cropped.png"
            alt="StudyStack – UP timetable generator logo"
            className="hero-main-logo"
          />
        </div>

        <h1 className="hero-headline">
          UP Timetable Generator: clash-free schedules in seconds
        </h1>

        <p className="hero-subhead">
          Upload your official University of Pretoria (Tuks) module timetable PDF. StudyStack automatically tests lecture,
          practical, and tutorial combinations to find zero-clash schedules tailored to your lifestyle.
          Then pick up the textbooks for your modules from other UP students.
        </p>

        {/* Central Hero Call to Action Button */}
        <div className="hero-cta-box">
          <button
            className="hero-primary-btn"
            onClick={onLaunchGenerator}
            autoFocus
          >
            <IconZap size={18} />
            <span>Generate Your Timetable</span>
            <svg className="hero-btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>

          <button
            type="button"
            className="hero-secondary-btn"
            onClick={() => onNavigate?.('books')}
          >
            <IconBook size={16} />
            <span>Browse UP Textbooks</span>
          </button>

          <div className="hero-trust-row">
            <span className="hero-trust-item">
              <span className="hero-trust-check"><IconCheck /></span> Sign in with your UP student email
            </span>
            <span className="hero-trust-dot">•</span>
            <span className="hero-trust-item">
              <span className="hero-trust-check"><IconCheck /></span> Timetable never leaves your browser
            </span>
            <span className="hero-trust-dot">•</span>
            <span className="hero-trust-item">
              <span className="hero-trust-check"><IconCheck /></span> Instant UP_MOD_XLS parsing
            </span>
          </div>
        </div>

        {/* 4 Schedule Optimization Preferences Preview */}
        <div id="preferences" className="hero-preference-grid">
          <div className="pref-preview-card">
            <div className="pref-icon-header">
              <span className="pref-icon"><IconSunrise /></span>
              <h3 className="pref-title">Morning Schedule</h3>
            </div>
            <p className="pref-desc">Prioritizes earlier classes so you finish early and free up afternoons.</p>
          </div>

          <div className="pref-preview-card">
            <div className="pref-icon-header">
              <span className="pref-icon"><IconSunset /></span>
              <h3 className="pref-title">Afternoon Schedule</h3>
            </div>
            <p className="pref-desc">Schedules classes later in the day for late risers and commuters.</p>
          </div>

          <div className="pref-preview-card">
            <div className="pref-icon-header">
              <span className="pref-icon"><IconCalendar /></span>
              <h3 className="pref-title">Free Day Maximizer</h3>
            </div>
            <p className="pref-desc">Concentrates sessions into fewer days to unlock entire weekdays with 0 classes.</p>
          </div>

          <div className="pref-preview-card">
            <div className="pref-icon-header">
              <span className="pref-icon"><IconFastForward /></span>
              <h3 className="pref-title">Early Friday</h3>
            </div>
            <p className="pref-desc">Finishes your Friday schedule early so your weekend starts ahead of time.</p>
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section id="demo" className="landing-section" style={{ paddingTop: 40 }}>
        <div className="section-header-center">
          <span className="section-tag">Live Demo</span>
          <h2 className="section-title">See It Work</h2>
          <p className="section-desc">
            Switch the preference or flick through options. Every schedule below is clash-free.
          </p>
        </div>
        <TimetableDemo onLaunchGenerator={onLaunchGenerator} />
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Simple 3-Step Process</span>
          <h2 className="section-title">How StudyStack Works</h2>
          <p className="section-desc">
            Skip hours of cross-referencing conflicting PDF tables. Let our backtracking algorithm solve your schedule.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-num-pill">01</div>
            <h3 className="step-heading">Download your UP PDF</h3>
            <p className="step-text">
              Log into your UP student portal and export your official module timetable PDF (file name begins with <code>UP_MOD_XLS</code>).
            </p>
          </div>

          <div className="step-card">
            <div className="step-num-pill">02</div>
            <h3 className="step-heading">Select Modules & Vibe</h3>
            <p className="step-text">
              Pick your enrolled modules for Semester 1 or 2, and select your preferred schedule style (Morning, Afternoon, Free Day, Early Friday).
            </p>
          </div>

          <div className="step-card">
            <div className="step-num-pill">03</div>
            <h3 className="step-heading">Export Clash-Free Schedule</h3>
            <p className="step-text">
              View your clean interactive timetable grid, inspect room assignments, and export a high-resolution landscape PDF ready to print.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-section" style={{ background: '#f8fafc', borderRadius: 20, maxWidth: 1180 }}>
        <div className="section-header-center">
          <span className="section-tag">Engineered for Students</span>
          <h2 className="section-title">Everything You Need to Ace Registration</h2>
          <p className="section-desc">
            Built specifically around the University of Pretoria's unique timetable format.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconUpload /></div>
            <h3 className="feature-title">100% Automated PDF Parsing</h3>
            <p className="feature-desc">
              No manual typing. Directly reads complex UP column layouts, merging multi-lab practicals and detecting period slots.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconCpu /></div>
            <h3 className="feature-title">Constraint Satisfaction Solver</h3>
            <p className="feature-desc">
              Backtracking search tests hundreds of group arrangements across Lectures, Practicals, and Tutorials to ensure zero overlapping periods.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconLock /></div>
            <h3 className="feature-title">Private by Design</h3>
            <p className="feature-desc">
              Your timetable and academic data never leave your device. No analytics trackers and no cloud uploads of your PDF.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconShuffle /></div>
            <h3 className="feature-title">Custom Group Overrides</h3>
            <p className="feature-desc">
              Want a specific practical group with friends? Lock individual group codes for any activity and see updated clashes live.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconPrinter /></div>
            <h3 className="feature-title">Crisp PDF & CSV Export</h3>
            <p className="feature-desc">
              Download your schedule formatted specifically for A4 landscape printing, or export raw CSV data to import into spreadsheets.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-icon-wrapper"><IconSearch /></div>
            <h3 className="feature-title">Session & Venue Inspector</h3>
            <p className="feature-desc">
              Click any class block in the grid to view venue details, campus locations, activity designations, and period numbers.
            </p>
          </div>
        </div>
      </section>

      {/* Textbook Marketplace Section */}
      <section id="textbooks" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Textbook Marketplace</span>
          <h2 className="section-title">Buy and Sell Textbooks with Other UP Students</h2>
          <p className="section-desc">
            Got your timetable sorted? Find last semester's prescribed books second-hand, or sell the ones
            you no longer need.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="feature-icon-wrapper" style={{ marginBottom: 0 }}><IconSearch /></div>
            <h3 className="step-heading">Search by module code</h3>
            <p className="step-text">
              Type a module like <code>COS 132</code> and see who is selling the prescribed book, with its
              edition, condition and price. Browsing is open to everyone.
            </p>
          </div>

          <div className="step-card">
            <div className="feature-icon-wrapper" style={{ marginBottom: 0 }}><IconShuffle /></div>
            <h3 className="step-heading">Request the seller's contact</h3>
            <p className="step-text">
              Found a match? Send a short request with your name and how to reach you. The seller reviews it
              and approves or declines.
            </p>
          </div>

          <div className="step-card">
            <div className="feature-icon-wrapper" style={{ marginBottom: 0 }}><IconLock /></div>
            <h3 className="step-heading">Contact shared only once approved</h3>
            <p className="step-text">
              Sellers' email or WhatsApp stays hidden until they say yes, so you choose who gets your details.
              Then arrange a hand-over on campus.
            </p>
          </div>
        </div>

        <div className="market-cta-row">
          <button type="button" className="market-cta-btn" onClick={() => onNavigate?.('books')}>
            <IconBook size={18} />
            <span>Browse Textbooks</span>
          </button>
          <button type="button" className="market-cta-link" onClick={() => onNavigate?.('books')}>
            Have a book to sell? List it in a minute →
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Frequently Asked Questions</span>
          <h2 className="section-title">Got Questions? We've Got Answers</h2>
          <p className="section-desc">
            Quick answers about using StudyStack for your UP timetable.
          </p>
        </div>

        <div className="faq-accordion">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} className="faq-item">
                <button
                  className="faq-question-btn"
                  aria-expanded={isOpen}
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: 18, color: '#0e3868' }}>{isOpen ? '−' : '+'}</span>
                </button>
                <div className="faq-answer" style={{ display: isOpen ? 'block' : 'none' }}>
                  {faq.a}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Call to action Banner */}
      <div className="banner-cta-container">
        <img src="/studystack-mark.png" alt="StudyStack Emblem" className="banner-logo-mark" />
        <h2 className="banner-headline">Ready to generate your conflict-free timetable?</h2>
        <p className="banner-subhead">
          Join UP students who build their class schedules in seconds, then find the textbooks to match.
        </p>
        <div className="banner-btn-row">
          <button className="banner-btn" onClick={onLaunchGenerator}>
            <IconZap size={18} />
            <span>Launch Timetable Generator</span>
          </button>
          <button className="banner-btn banner-btn-outline" onClick={() => onNavigate?.('books')}>
            <IconBook size={18} />
            <span>Browse Textbooks</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-top-row">
            <div className="footer-brand-block">
              <div className="footer-logo-row">
                <img src="/studystack-mark.png" alt="StudyStack" className="footer-logo-img" />
                <span className="footer-brand-title">StudyStack</span>
              </div>
              <p className="footer-brand-desc">
                Fast, private, clash-free timetable generator and student textbook marketplace for University of Pretoria (Tuks) students.
              </p>
            </div>

            <div className="footer-links-row">
              <a href="#features" className="footer-link-item" onClick={handleNavClick('features')}>Features</a>
              <a href="#how-it-works" className="footer-link-item" onClick={handleNavClick('how-it-works')}>How it works</a>
              <a href="#preferences" className="footer-link-item" onClick={handleNavClick('preferences')}>Preferences</a>
              <a href="#demo" className="footer-link-item" onClick={handleNavClick('demo')}>Demo</a>
              <a href="#textbooks" className="footer-link-item" onClick={handleNavClick('textbooks')}>Textbooks</a>
              <a href="#faq" className="footer-link-item" onClick={handleNavClick('faq')}>FAQ</a>
              <button
                onClick={() => onNavigate?.('books')}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Browse Textbooks →
              </button>
              <button
                onClick={onLaunchGenerator}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Open Generator →
              </button>
            </div>
          </div>

          <div className="footer-legal-row">
            <button type="button" className="footer-legal-link" onClick={() => onNavigate?.('terms')}>
              Terms of Service
            </button>
            <span className="footer-legal-sep" aria-hidden="true">·</span>
            <button type="button" className="footer-legal-link" onClick={() => onNavigate?.('privacy')}>
              Privacy Policy
            </button>
          </div>

          <div className="footer-disclaimer-card">
            <span>© {new Date().getFullYear()} StudyStack. All rights reserved.</span>
            <span>Independent student project. Not affiliated with or endorsed by the University of Pretoria.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
