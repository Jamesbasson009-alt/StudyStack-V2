import React from 'react';
import { STEPS } from '../components/PortalGuideModal.jsx';
import { NavLink } from '../components/NavLink.jsx';
import { useSeo } from '../lib/useSeo.js';

export function GuidePage({ onNavigate }) {
  useSeo({
    title: 'How to Download UP Timetable PDF (UP_MOD_XLS) | StudyStack Guide',
    description: 'Step-by-step instructions for University of Pretoria (Tuks) students on downloading your official UP_MOD_XLS module timetable PDF from my.up.ac.za.',
    path: '/guide/up-timetable-pdf',
  });

  return (
    <div className="guide-root">
      <style>{`
        .guide-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          line-height: 1.6;
        }

        .guide-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px clamp(16px, 4vw, 48px);
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .guide-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
        }
        .guide-back:hover { color: #0e3868; }

        .guide-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 16px;
          color: #0e3868;
        }
        .guide-brand-logo {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        .guide-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 48px clamp(16px, 4vw, 48px) 64px;
          width: 100%;
          box-sizing: border-box;
        }

        .guide-pill {
          display: inline-flex;
          align-items: center;
          background: #e0f2fe;
          color: #0369a1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          margin-bottom: 16px;
          text-transform: uppercase;
        }

        .guide-title {
          font-size: clamp(28px, 4vw, 38px);
          font-weight: 800;
          color: #0e3868;
          line-height: 1.2;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }

        .guide-subtitle {
          font-size: 17px;
          color: #475569;
          margin-bottom: 36px;
          line-height: 1.6;
        }

        .guide-steps-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 40px;
        }

        .guide-step-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          gap: 18px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .guide-step-badge {
          width: 36px;
          height: 36px;
          background: #0e3868;
          color: #ffffff;
          border-radius: 10px;
          font-weight: 700;
          font-size: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .guide-step-body h2 {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px;
        }

        .guide-step-body p {
          font-size: 14.5px;
          color: #475569;
          margin: 0;
          line-height: 1.6;
        }

        .guide-step-body code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          background: #eef2f7;
          color: #0e3868;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .guide-step-body a {
          color: #2563eb;
          font-weight: 600;
          text-decoration: underline;
        }

        .guide-note-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 18px 20px;
          font-size: 14px;
          color: #166534;
          margin-bottom: 36px;
        }

        .guide-cta-card {
          background: linear-gradient(135deg, #0e3868 0%, #1e3a8a 100%);
          border-radius: 14px;
          padding: 36px clamp(20px, 4vw, 36px);
          color: #ffffff;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .guide-cta-title {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }

        .guide-cta-sub {
          font-size: 15px;
          color: #bfdbfe;
          max-width: 500px;
          margin: 0;
        }

        .guide-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          color: #0e3868;
          font-weight: 700;
          font-size: 15px;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.15s ease;
          border: none;
        }
        .guide-cta-btn:hover { transform: translateY(-2px); }

        .guide-footer {
          padding: 24px clamp(16px, 4vw, 48px);
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
          margin-top: auto;
        }
      `}</style>

      <header className="guide-topbar">
        <NavLink view="landing" onNavigate={onNavigate} className="guide-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to home
        </NavLink>
        <div className="guide-brand">
          <img src="/studystack-mark.png" alt="" className="guide-brand-logo" />
          <span>StudyStack</span>
        </div>
      </header>

      <main className="guide-content">
        <span className="guide-pill">UP Portal Tutorial</span>
        <h1 className="guide-title">How to Download Your UP Timetable PDF</h1>
        <p className="guide-subtitle">
          To generate a clash-free schedule with StudyStack, you need your official class timetable export from the University of Pretoria Student Portal. Follow these 5 steps to download it in under a minute.
        </p>

        <div className="guide-steps-container">
          {STEPS.map((step, idx) => (
            <article className="guide-step-card" key={idx}>
              <div className="guide-step-badge">{idx + 1}</div>
              <div className="guide-step-body">
                <h2>{step.title}</h2>
                <div>{step.body}</div>
              </div>
            </article>
          ))}
        </div>

        <div className="guide-note-box">
          <strong>Tip:</strong> The exported PDF filename always begins with <code>UP_MOD_XLS</code> (for example: <code>UP_MOD_XLS_2026.pdf</code>). Do not rename this file, as StudyStack verifies the file format to ensure 100% parsing accuracy.
        </div>

        <div className="guide-cta-card">
          <h2 className="guide-cta-title">Got your UP_MOD_XLS PDF ready?</h2>
          <p className="guide-cta-sub">
            Upload it to StudyStack to automatically test all lecture, practical, and tutorial combinations and build your clash-free weekly schedule.
          </p>
          <NavLink view="landing" onNavigate={onNavigate} className="guide-cta-btn">
            Open Timetable Generator →
          </NavLink>
        </div>
      </main>

      <footer className="guide-footer">
        © {new Date().getFullYear()} StudyStack. Independent student project — not affiliated with or endorsed by the University of Pretoria.
      </footer>
    </div>
  );
}

export default GuidePage;
