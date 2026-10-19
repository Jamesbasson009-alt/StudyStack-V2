// Global styles for the timetable generator (design tokens + every generator class).
// Kept as one string and injected by App as a <style> tag, exactly as before, so nothing
// leaks into the landing, legal or books pages until the generator is open.
export const GENERATOR_CSS = `
        :root {
          --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --font-mono: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
          --bg-canvas: #f1f5f9;
          --bg-surface: #ffffff;
          --bg-subtle: #f8fafc;
          --border-color: #e2e8f0;
          --border-subtle: #edf2f7;
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #64748b;
          --accent-blue: #0284c7;
          --accent-blue-subtle: #f0f9ff;
          --success: #16a34a;
          --success-bg: #f0fdf4;
          --success-border: #bbf7d0;
          --danger: #dc2626;
          --danger-bg: #fef2f2;
          --danger-border: #fecaca;
          --action-primary: #0f172a;
          --action-primary-hover: #1e293b;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--font-sans);
          font-size: 14px;
          background: var(--bg-canvas);
          color: var(--text-primary);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        .app-shell {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* Top Header Bar */
        .header-bar {
          height: 58px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo-mark {
          width: 34px;
          height: 34px;
          background: #0f172a;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #1e293b;
          flex-shrink: 0;
        }

        .brand-text-block {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .brand-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-title-main {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .brand-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          background: #0284c7;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .header-brand-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          background: #f0f9ff;
          color: #0369a1;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .brand-subtext {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .header-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tab-item {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          padding: 7px 12px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.1s ease;
        }

        .tab-item:hover {
          color: var(--text-primary);
          background: var(--bg-subtle);
        }

        .tab-item.active {
          color: var(--text-primary);
          background: var(--bg-subtle);
          border-color: var(--border-color);
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .user-menu {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 12px;
          margin-left: 2px;
          border-left: 1px solid var(--border-color);
        }
        .user-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        /* Buttons & Segmented Controls */
        .btn {
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-primary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.1s ease;
        }

        .btn:hover {
          background: var(--bg-subtle);
          border-color: #cbd5e1;
        }

        .btn-primary {
          background: var(--action-primary);
          color: #ffffff;
          border-color: var(--action-primary);
        }

        .btn-primary:hover {
          background: var(--action-primary-hover);
          border-color: var(--action-primary-hover);
        }

        .btn-sm {
          font-size: 12px;
          padding: 4px 8px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .segmented-group {
          display: inline-flex;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 2px;
          gap: 2px;
        }

        .segmented-btn {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 9px;
          border-radius: 3px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .segmented-btn:hover {
          color: var(--text-primary);
        }

        .segmented-btn.active {
          background: var(--bg-surface);
          color: var(--text-primary);
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        /* Workstation Layout */
        .workspace-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          flex: 1;
          min-height: calc(100vh - 58px);
        }

        .sidebar-rail {
          background: var(--bg-surface);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          max-height: calc(100vh - 58px);
        }

        .sidebar-section {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-heading {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Dropzone Component */
        .dropzone {
          border: 1px dashed var(--border-color);
          background: var(--bg-subtle);
          border-radius: 4px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dropzone:hover {
          border-color: #94a3b8;
          background: #e2e8f0;
        }

        .dropzone-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-top: 4px;
        }

        .dropzone-hint {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Large drag-and-drop zone shown in the main canvas before a PDF is uploaded */
        .main-dropzone {
          width: 100%;
          max-width: 480px;
          box-sizing: border-box;
          border: 2px dashed #94a3b8;
          background: var(--bg-subtle);
          border-radius: 12px;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #0e3868;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }

        .main-dropzone:hover {
          border-color: #0e3868;
          background: #eef4fb;
        }

        .main-dropzone.dragging {
          border-color: #0e3868;
          background: #dbeafe;
          transform: scale(1.01);
        }

        .main-dropzone.processing {
          pointer-events: none;
          opacity: 0.7;
        }

        .main-dropzone-title {
          font-size: 15px;
          font-weight: 700;
          color: #0e3868;
        }

        .main-dropzone-or {
          font-size: 12px;
          color: var(--text-muted);
        }

        .portal-guide-trigger {
          display: block;
          width: 100%;
          text-align: center;
          background: none;
          border: none;
          padding: 8px 0 0;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
        }
        .portal-guide-trigger:hover { text-decoration: underline; }

        .file-status-card {
          margin-top: 10px;
          padding: 8px 10px;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .file-status-name {
          font-family: var(--font-mono);
          font-weight: 500;
          color: var(--text-primary);
          word-break: break-all;
        }

        .file-status-count {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .alert-error {
          margin-top: 10px;
          padding: 8px 10px;
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          color: var(--danger);
          font-size: 13px;
          border-radius: 4px;
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        /* Schedule Status Banner in Sidebar */
        .schedule-status-banner {
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 12px;
        }

        .schedule-status-banner.has-clash-banner {
          background: var(--danger-bg);
          border-color: var(--danger-border);
        }

        .schedule-status-title {
          font-weight: 600;
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }

        .schedule-status-title.has-clash-title {
          color: var(--danger);
        }

        .schedule-status-meta {
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.4;
        }

        /* Sidebar Timetable Controls */
        .sidebar-controls-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background: #fafaf9;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sidebar-ctrl-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .sidebar-ctrl-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .sidebar-pref-group {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 3px;
        }

        .sidebar-pref-btn {
          font-family: var(--font-sans);
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 8px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.1s ease;
        }

        .sidebar-pref-btn:hover {
          color: var(--text-primary);
          background: var(--bg-subtle);
        }

        .sidebar-pref-btn.active {
          background: #0e3868;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .sidebar-pref-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Solution Carousel Navigator */
        .solution-navigator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 6px 10px;
          gap: 8px;
        }

        .solution-nav-info {
          font-size: 12px;
          font-family: var(--font-mono);
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
        }

        /* Enrolled Modules List with Collapsible Cards */
        .enrolled-module-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .enrolled-module-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          transition: all 0.1s ease;
          overflow: hidden;
        }

        .enrolled-module-card.focused {
          border-color: #0284c7;
          box-shadow: 0 0 0 1px #0284c7;
        }

        .enrolled-module-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          gap: 8px;
          cursor: pointer;
          background: var(--bg-surface);
          user-select: none;
        }

        .enrolled-module-row:hover {
          background: var(--bg-subtle);
        }

        .module-main-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .module-swatch {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          flex-shrink: 0;
        }

        .module-code-text {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .module-act-summary {
          font-size: 10.5px;
          font-family: var(--font-mono);
          background: #f1f5f9;
          color: var(--text-muted);
          padding: 1px 5px;
          border-radius: 3px;
        }

        .module-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mix-toggle-pill {
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: var(--bg-subtle);
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          transition: all 0.1s ease;
        }

        .mix-toggle-pill:hover {
          color: var(--text-primary);
          border-color: #94a3b8;
        }

        .mix-toggle-pill.active {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #0284c7;
        }

        .module-expand-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
        }

        .module-expand-btn.expanded {
          transform: rotate(180deg);
        }

        .activity-selectors-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px 12px 10px;
          background: #f8fafc;
          border-top: 1px solid var(--border-subtle);
        }

        .activity-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }

        .activity-label {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .group-select {
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 3px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: #ffffff;
          color: var(--text-primary);
          cursor: pointer;
        }

        /* Clean Single-Column Setup Wizard */
        .setup-workflow-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 36px 32px;
          max-width: 720px;
          margin: 32px auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        }

        .setup-workflow-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .setup-workflow-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-top: 10px;
          margin-bottom: 6px;
        }

        .setup-workflow-desc {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          max-width: 520px;
          margin: 0 auto;
        }

        .setup-step-section {
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .setup-step-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .setup-step-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .setup-step-badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .setup-step-title {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .setup-step-desc {
          font-size: 12.5px;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.4;
        }

        /* Module Checkbox Grid in Setup */
        .module-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
          gap: 8px;
          max-height: 180px;
          overflow-y: auto;
          padding: 8px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          margin-top: 10px;
        }

        .module-checkbox-label {
          font-family: var(--font-mono);
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background: #ffffff;
          color: var(--text-secondary);
          transition: all 0.1s ease;
        }

        .module-checkbox-label:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .module-checkbox-label.selected {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1e40af;
        }

        /* 4 Goal Cards in 2x2 Grid */
        .setup-goals-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .setup-goal-card {
          border: 1px solid var(--border-color);
          background: #ffffff;
          padding: 12px 14px;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .setup-goal-card:hover {
          border-color: #94a3b8;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .setup-goal-card.active {
          border-color: #0e3868;
          background: #f0f7ff;
          box-shadow: 0 0 0 1.5px #0e3868;
        }

        .setup-goal-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .setup-goal-title {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .setup-goal-desc {
          font-size: 11.5px;
          color: var(--text-muted);
          line-height: 1.35;
        }

        /* Accordion for Lecture Mixing */
        .setup-mix-accordion {
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.15s ease;
        }

        .setup-mix-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #ffffff;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
        }

        .setup-mix-trigger:hover {
          background: #fafaf9;
        }

        .setup-mix-content {
          padding: 12px 16px 16px;
          border-top: 1px solid var(--border-subtle);
          background: #fafaf9;
        }

        /* Main Workspace Canvas */
        .main-canvas {
          background: var(--bg-canvas);
          display: flex;
          flex-direction: column;
          overflow-x: auto;
        }

        .canvas-toolbar {
          padding: 10px 20px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .canvas-meta {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .status-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          background: #e0f2fe;
          color: #0369a1;
          padding: 3px 8px;
          border-radius: 3px;
          border: 1px solid #bae6fd;
        }

        .clash-warning-box {
          margin: 14px 20px 0;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 13px;
          color: #991b1b;
        }

        .clash-warning-box strong {
          display: block;
          margin-bottom: 4px;
        }

        .clash-item-bullet {
          font-family: var(--font-mono);
          font-size: 12px;
          margin-left: 18px;
          margin-top: 3px;
        }

        /* Timetable Schedule Grid */
        .timetable-container {
          padding: 20px;
          flex: 1;
        }

        .timetable-board {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow: hidden;
        }

        .timetable-grid {
          display: grid;
          grid-template-columns: 74px repeat(5, minmax(150px, 1fr));
          border-collapse: collapse;
          width: 100%;
        }

        .grid-header-cell {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          text-align: center;
        }

        .time-col-cell {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-subtle);
          padding: 10px 8px;
          border-bottom: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          text-align: center;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .slot-cell {
          border-bottom: 1px solid var(--border-subtle);
          border-right: 1px solid var(--border-subtle);
          padding: 6px;
          min-height: 94px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          background: var(--bg-surface);
          position: relative;
        }

        .slot-cell.has-clash {
          background: #fff1f2 !important;
          outline: 2px solid #ef4444;
          outline-offset: -2px;
          z-index: 2;
        }

        .clash-indicator-badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 2px;
          align-self: flex-start;
          line-height: 1.2;
        }

        .clash-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          display: inline-block;
          flex-shrink: 0;
        }

        .clash-summary-chip {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          background: #fef2f2;
          color: #dc2626;
          padding: 3px 8px;
          border-radius: 3px;
          border: 1px solid #fecaca;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        /* Class Block Cards */
        .class-block {
          border-radius: 4px;
          padding: 8px 10px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform 0.05s ease, border-color 0.1s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 74px;
        }

        .class-block.class-block-clashing {
          border-left: 4px solid #ef4444 !important;
        }

        .class-block:hover {
          border-color: #64748b !important;
        }

        .class-block-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
        }

        .class-module-title {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }

        .class-act-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          opacity: 0.85;
          border: 1px solid currentColor;
          border-radius: 2px;
          padding: 0 4px;
          line-height: 1.2;
        }

        .class-block-body {
          margin-top: 5px;
        }

        .class-venue {
          font-size: 12px;
          font-weight: 500;
          line-height: 1.3;
          color: var(--text-primary);
        }

        .class-group {
          font-size: 11px;
          font-family: var(--font-mono);
          opacity: 0.85;
          margin-top: 2px;
        }

        /* Inspector Drawer / Modal */
        .inspector-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .inspector-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          width: min(480px, 100%);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }

        .inspector-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-subtle);
        }

        .inspector-title {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .inspector-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
        }

        .inspector-close-btn:hover {
          color: var(--text-primary);
          background: var(--border-color);
        }

        .inspector-grid {
          padding: 18px;
          display: grid;
          grid-template-columns: 110px 1fr;
          row-gap: 12px;
          font-size: 13px;
        }

        .inspector-key {
          color: var(--text-muted);
          font-weight: 500;
        }

        .inspector-val {
          color: var(--text-primary);
          font-weight: 500;
        }

        .inspector-val.mono {
          font-family: var(--font-mono);
        }

        .inspector-footer {
          padding: 12px 18px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        /* Tabular View Page */
        .table-view-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
        }

        .table-summary-bar {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .summary-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .summary-badge {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--success);
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          padding: 3px 8px;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .search-control {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          display: flex;
        }

        .table-search-input {
          width: 100%;
          padding: 10px 14px 10px 36px;
          font-family: var(--font-sans);
          font-size: 13px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          outline: none;
        }

        .table-search-input:focus {
          border-color: #94a3b8;
        }

        .data-table-wrap {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow-x: auto;
          max-height: calc(100vh - 240px);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: left;
        }

        .data-table th {
          background: var(--bg-subtle);
          color: var(--text-secondary);
          font-weight: 600;
          padding: 10px 14px;
          position: sticky;
          top: 0;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
          z-index: 10;
        }

        .data-table td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          white-space: nowrap;
        }

        .data-table tr:hover td {
          background: var(--bg-subtle);
        }

        .badge-tag {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          background: var(--bg-subtle);
          color: var(--text-secondary);
        }

        .badge-l {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
        }

        .badge-p {
          background: #fffbeb;
          border-color: #fde68a;
          color: #92400e;
        }

        .badge-t {
          background: #faf5ff;
          border-color: #e9d5ff;
          color: #6b21a8;
        }

        .font-mono {
          font-family: var(--font-mono);
        }

        @media (max-width: 860px) {
          .user-chip {
            display: none;
          }
          .workspace-grid {
            grid-template-columns: 1fr;
          }
          .sidebar-rail {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
          }
          .setup-steps-grid {
            grid-template-columns: 1fr;
          }
        }
`;
