import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuthPage } from './AuthPage.jsx';
import {
  CONDITIONS,
  conditionLabel,
  MarketplaceError,
  getListings,
  getMySellerProfile,
  getMySellerContact,
  updateSellerContact,
  getPendingRequestCount,
  registerSeller,
  getMyListings,
  createListing,
  updateListing,
  markListingSold,
  relistListing,
  deleteListing,
  uploadListingImage,
  requestContact,
  getMyContactRequests,
  getRequestsForMyListings,
  respondToRequest,
} from '../lib/books.js';

/* ---------------------------------- icons ---------------------------------- */

const Icon = {
  ArrowLeft: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  Search: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Close: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  Plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Book: (p) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  ),
  Check: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  Clock: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  Trash: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    </svg>
  ),
  Edit: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  Image: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <path d="M21 15l-5-5L5 21"></path>
    </svg>
  ),
  Store: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9l1.5-5h15L21 9"></path>
      <path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"></path>
      <path d="M9 20v-6h6v6"></path>
    </svg>
  ),
  Inbox: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
    </svg>
  ),
};

/* --------------------------------- helpers --------------------------------- */

function formatPrice(value) {
  const n = Number(value);
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ConditionBadge({ condition }) {
  const tone = {
    new: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    like_new: { bg: '#f0fdfa', text: '#115e59', border: '#99f6e4' },
    good: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    fair: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    worn: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
  }[condition] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
  return (
    <span
      className="mkt-badge"
      style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
    >
      {conditionLabel(condition)}
    </span>
  );
}

function StatusPill({ status }) {
  const tone = {
    pending: { bg: '#fffbeb', text: '#92400e', label: 'Pending' },
    approved: { bg: '#f0fdf4', text: '#166534', label: 'Approved' },
    declined: { bg: '#fff1f2', text: '#9f1239', label: 'Declined' },
    active: { bg: '#f0fdf4', text: '#166534', label: 'Active' },
    sold: { bg: '#f1f5f9', text: '#334155', label: 'Sold' },
    removed: { bg: '#fff1f2', text: '#9f1239', label: 'Removed' },
  }[status] || { bg: '#f1f5f9', text: '#334155', label: status };
  return (
    <span className="mkt-pill" style={{ background: tone.bg, color: tone.text }}>
      {tone.label}
    </span>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// PostgREST returns a one-to-one embed as an object, but be defensive in case it comes back as an array.
function pickContact(request) {
  const c = request?.book_listings?.sellers?.seller_contacts;
  return Array.isArray(c) ? c[0] || null : c || null;
}

function ContactReveal({ contact }) {
  if (!contact) return null;
  return (
    <p className="mkt-contact-reveal">
      {contact.contact_method === 'whatsapp' ? 'WhatsApp' : 'Email'}: <strong>{contact.contact_value}</strong>
    </p>
  );
}

function RequestStatusNote({ request }) {
  if (request.status === 'approved') {
    const contact = pickContact(request);
    return (
      <div className="mkt-note mkt-note-success mkt-note-col">
        <span><Icon.Check /> The seller approved your request. Here's how to reach them:</span>
        {contact ? <ContactReveal contact={contact} /> : <span>Their contact will show under "My textbooks" → "My requests".</span>}
      </div>
    );
  }
  if (request.status === 'declined') {
    return <div className="mkt-note mkt-note-muted">The seller declined this request, so their contact stays private.</div>;
  }
  return (
    <div className="mkt-note mkt-note-info">
      <Icon.Clock /> Request sent {timeAgo(request.created_at)}. You'll see the seller's contact here as soon as they approve it.
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function BooksPage({ session, authChecked, onNavigate }) {
  const [authMode, setAuthMode] = useState(false);
  const [pendingIntent, setPendingIntent] = useState(null); // { type: 'sell' | 'contact', listingId? }

  /* browsing */
  const [filters, setFilters] = useState({ search: '', moduleCode: '', condition: '', maxPrice: '' });
  const [draftSearch, setDraftSearch] = useState('');
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState('');

  /* detail + contact request */
  const [selectedListing, setSelectedListing] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSent, setContactSent] = useState(false);

  /* seller state */
  const [sellerProfile, setSellerProfile] = useState(undefined); // undefined = not checked yet, null = not a seller
  const [showRegister, setShowRegister] = useState(false);

  /* dashboard */
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashTab, setDashTab] = useState('sell'); // 'sell' | 'incoming' | 'mine'
  const [myListings, setMyListings] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [showListingForm, setShowListingForm] = useState(null); // null | 'new' | listing object being edited
  const [dashError, setDashError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [sellerContact, setSellerContact] = useState({ method: 'email', value: '' });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSavedMsg, setContactSavedMsg] = useState('');

  const fileInputRef = useRef(null);
  const searchSeq = useRef(0);

  /* ------------------------------ load listings ------------------------------ */

  async function runSearch(nextFilters) {
    // Each keystroke in a filter box fires a search; only the newest one may update the screen,
    // otherwise a slow earlier response could overwrite a newer one.
    const seq = ++searchSeq.current;
    setListingsLoading(true);
    setListingsError('');
    try {
      const data = await getListings(nextFilters);
      if (seq === searchSeq.current) setListings(data);
    } catch (err) {
      if (seq === searchSeq.current) {
        setListingsError(err instanceof MarketplaceError ? err.message : 'Could not load listings.');
      }
    } finally {
      if (seq === searchSeq.current) setListingsLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => runSearch(filters), 250); // debounce typing in the filter boxes
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.moduleCode, filters.condition, filters.maxPrice, filters.search]);

  function submitSearch(e) {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: draftSearch }));
  }

  /* ------------------------------ seller profile ------------------------------ */

  async function refreshMyRequests() {
    try {
      setMyRequests(await getMyContactRequests());
    } catch {
      /* non-fatal: the listing panel just won't know about earlier requests */
    }
  }

  async function refreshPendingCount() {
    try {
      setPendingIncoming(await getPendingRequestCount());
    } catch {
      /* non-fatal: the badge just doesn't show */
    }
  }

  // Keyed on the email, not the session object: Supabase hands out a fresh object on every
  // token refresh / tab refocus, which would otherwise refetch all of this each time.
  useEffect(() => {
    if (!session) {
      setSellerProfile(undefined);
      setMyRequests([]);
      setPendingIncoming(0);
      setShowDashboard(false);
      return;
    }
    getMySellerProfile()
      .then(setSellerProfile)
      .catch(() => setSellerProfile(null));
    refreshMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email]);

  useEffect(() => {
    if (sellerProfile) refreshPendingCount();
    else setPendingIncoming(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerProfile?.id]);

  /* ------------------------------ escape closes the topmost panel ------------------------------ */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showListingForm) setShowListingForm(null);
      else if (showRegister) setShowRegister(false);
      else if (showDashboard) setShowDashboard(false);
      else if (selectedListing) closeListing();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showListingForm, showRegister, showDashboard, selectedListing]);

  /* ------------------------------ resume intent after sign-in ------------------------------ */

  useEffect(() => {
    if (!session || !pendingIntent) return;
    if (pendingIntent.type === 'sell') {
      // sellerProfile may not have resolved yet; a small delay lets the effect above settle.
      getMySellerProfile()
        .then((profile) => {
          setSellerProfile(profile);
          if (profile) {
            setShowDashboard(true);
            setDashTab('sell');
          } else {
            setShowRegister(true);
          }
        })
        .catch(() => setShowRegister(true));
    } else if (pendingIntent.type === 'contact') {
      setShowContactForm(true);
      setContactValue((v) => v || session.email);
    }
    setPendingIntent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /* ------------------------------ actions ------------------------------ */

  function requireAuth(intent) {
    setPendingIntent(intent);
    setAuthMode(true);
  }

  function handleSellClick() {
    if (!session) return requireAuth({ type: 'sell' });
    if (sellerProfile === undefined) return; // still checking
    if (sellerProfile) {
      setShowDashboard(true);
      setDashTab('sell');
      setShowListingForm('new');
    } else {
      setShowRegister(true);
    }
  }

  function openDashboard() {
    setShowDashboard(true);
    if (!sellerProfile) setDashTab('mine');
    else setDashTab(pendingIncoming > 0 ? 'incoming' : 'sell');
  }

  function openListing(listing) {
    setSelectedListing(listing);
    setShowContactForm(false);
    setContactSent(false);
    setContactError('');
    setContactMsg('');
    setContactName(sellerProfile?.display_name || '');
    setContactValue(session?.email || '');
  }

  function closeListing() {
    setSelectedListing(null);
    setShowContactForm(false);
  }

  function startContactFlow() {
    if (!session) return requireAuth({ type: 'contact', listingId: selectedListing?.id });
    setShowContactForm(true);
  }

  async function submitContact(e) {
    e.preventDefault();
    if (!selectedListing) return;
    if (!contactName.trim() || !contactValue.trim()) {
      setContactError('Fill in your name and a way for the seller to reach you.');
      return;
    }
    setContactBusy(true);
    setContactError('');
    try {
      await requestContact(selectedListing.id, {
        requesterName: contactName,
        requesterContact: contactValue,
        message: contactMsg,
      });
      setContactSent(true);
      setShowContactForm(false);
      refreshMyRequests();
    } catch (err) {
      if (err instanceof MarketplaceError && err.code === 'already_requested') refreshMyRequests();
      setContactError(err instanceof MarketplaceError ? err.message : 'Could not send that request.');
    } finally {
      setContactBusy(false);
    }
  }

  async function loadDashboardData(tab) {
    setDashLoading(true);
    try {
      if (tab === 'sell') setMyListings(await getMyListings());
      if (tab === 'incoming') {
        setIncomingRequests(await getRequestsForMyListings());
        refreshPendingCount();
      }
      if (tab === 'mine') setMyRequests(await getMyContactRequests());
      if (tab === 'contact') {
        const c = await getMySellerContact();
        setSellerContact(c ? { method: c.contact_method, value: c.contact_value } : { method: 'email', value: session?.email || '' });
      }
    } catch (err) {
      setDashError(err instanceof MarketplaceError ? err.message : 'Could not load this. Please try again.');
    } finally {
      setDashLoading(false);
    }
  }

  useEffect(() => {
    if (!showDashboard) return;
    setDashError('');
    setConfirmDeleteId(null);
    setContactSavedMsg('');
    loadDashboardData(dashTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDashboard, dashTab]);

  // Wraps a dashboard action so a failure shows in the panel instead of vanishing as an unhandled rejection.
  async function guarded(fn) {
    setDashError('');
    try {
      await fn();
    } catch (err) {
      setDashError(err instanceof MarketplaceError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function saveSellerContact(e) {
    e.preventDefault();
    setContactSaving(true);
    setContactSavedMsg('');
    await guarded(async () => {
      await updateSellerContact({ contactMethod: sellerContact.method, contactValue: sellerContact.value });
      setContactSavedMsg('Saved. Buyers you approve from now on will see this.');
    });
    setContactSaving(false);
  }

  async function handleRegisterSubmit(fields) {
    await registerSeller(fields);
    const profile = await getMySellerProfile();
    setSellerProfile(profile);
    setShowRegister(false);
    setShowDashboard(true);
    setDashTab('sell');
  }

  async function handleCreateOrEditListing(fields, editingId) {
    if (editingId) {
      await updateListing(editingId, fields);
    } else {
      await createListing(fields);
    }
    setShowListingForm(null);
    loadDashboardData('sell');
    runSearch(filters);
  }

  async function handleDeleteListing(id) {
    setConfirmDeleteId(null);
    await guarded(async () => {
      await deleteListing(id);
      await loadDashboardData('sell');
      runSearch(filters);
    });
  }

  async function handleToggleSold(listing) {
    await guarded(async () => {
      if (listing.status === 'sold') await relistListing(listing.id);
      else await markListingSold(listing.id);
      await loadDashboardData('sell');
      runSearch(filters);
    });
  }

  async function handleRespond(requestId, approve) {
    await guarded(async () => {
      await respondToRequest(requestId, approve);
      await loadDashboardData('incoming');
    });
  }

  /* ------------------------------ render: auth takeover ------------------------------ */

  if (authMode) {
    return (
      <AuthPage
        onAuthenticated={() => setAuthMode(false)}
        onBack={() => {
          setAuthMode(false);
          setPendingIntent(null);
        }}
        onNavigate={onNavigate}
      />
    );
  }

  const isOwnListing = Boolean(selectedListing && sellerProfile && selectedListing.seller_id === sellerProfile.id);
  const existingRequest = selectedListing ? myRequests.find((r) => r.listing_id === selectedListing.id) : null;

  return (
    <div className="mkt-root">
      <style>{MKT_STYLES}</style>

      <nav className="mkt-nav">
        <button type="button" className="mkt-nav-brand" onClick={() => onNavigate?.('landing')}>
          <img src="/studystack-mark.png" alt="" className="mkt-nav-logo" />
          <span className="mkt-nav-title">StudyStack</span>
          <span className="mkt-nav-badge">Textbooks</span>
        </button>

        <div className="mkt-nav-actions">
          <button type="button" className="mkt-btn mkt-btn-ghost" onClick={() => onNavigate?.('landing')}>
            <Icon.ArrowLeft /> <span>Home</span>
          </button>
          {session && (
            <button type="button" className="mkt-btn mkt-btn-ghost" onClick={openDashboard}>
              <Icon.Inbox /> <span>My textbooks</span>
              {pendingIncoming > 0 && <span className="mkt-count-badge" aria-label={`${pendingIncoming} pending requests`}>{pendingIncoming}</span>}
            </button>
          )}
          <button type="button" className="mkt-btn mkt-btn-primary" onClick={handleSellClick} disabled={!authChecked}>
            <Icon.Store />
            <span>{sellerProfile ? 'Sell a textbook' : 'Become a seller'}</span>
          </button>
        </div>
      </nav>

      <header className="mkt-hero">
        <h1>Buy &amp; sell textbooks with other UP students</h1>
        <p>Search by module code, browse what's listed, and request a seller's contact once you're ready to buy.</p>

        <form className="mkt-search-row" onSubmit={submitSearch}>
          <div className="mkt-search-input-wrap">
            <Icon.Search className="mkt-search-icon" />
            <input
              type="text"
              placeholder="Search by title, author, or module code…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
            />
          </div>
          <input
            type="text"
            className="mkt-filter-input"
            placeholder="Module code (e.g. COS 132)"
            value={filters.moduleCode}
            onChange={(e) => setFilters((f) => ({ ...f, moduleCode: e.target.value }))}
          />
          <select
            className="mkt-filter-input"
            value={filters.condition}
            onChange={(e) => setFilters((f) => ({ ...f, condition: e.target.value }))}
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            className="mkt-filter-input mkt-filter-input-narrow"
            placeholder="Max price"
            value={filters.maxPrice}
            onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
          />
          <button type="submit" className="mkt-btn mkt-btn-primary">Search</button>
        </form>
      </header>

      <main className="mkt-main">
        {listingsLoading && <div className="mkt-state-msg">Loading listings…</div>}
        {!listingsLoading && listingsError && <div className="mkt-state-msg mkt-state-error">{listingsError}</div>}
        {!listingsLoading && !listingsError && listings.length === 0 && (
          <div className="mkt-state-msg">
            No listings match yet. {sellerProfile ? 'Be the first to add one.' : 'Check back soon, or register as a seller to add the first one.'}
          </div>
        )}

        {!listingsLoading && !listingsError && listings.length > 0 && (
          <div className="mkt-grid">
            {listings.map((l) => (
              <button type="button" key={l.id} className="mkt-card" onClick={() => openListing(l)}>
                <div className="mkt-card-thumb">
                  {l.image_url ? <img src={l.image_url} alt="" /> : <Icon.Book />}
                </div>
                <div className="mkt-card-body">
                  <div className="mkt-card-top">
                    {l.module_code && <span className="mkt-module-tag">{l.module_code}</span>}
                    <ConditionBadge condition={l.condition} />
                  </div>
                  <h3 className="mkt-card-title">{l.title}</h3>
                  {l.author && <p className="mkt-card-author">{l.author}</p>}
                  <div className="mkt-card-bottom">
                    <span className="mkt-card-price">{formatPrice(l.price)}</span>
                    <span className="mkt-card-seller">{l.sellers?.display_name || 'Seller'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* -------------------------- listing detail overlay -------------------------- */}
      {selectedListing && (
        <div className="mkt-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && closeListing()}>
          <div className="mkt-panel">
            <div className="mkt-panel-header">
              <h2>{selectedListing.title}</h2>
              <button type="button" className="mkt-icon-btn" onClick={closeListing} aria-label="Close"><Icon.Close /></button>
            </div>
            <div className="mkt-panel-body">
              <div className="mkt-detail-thumb">
                {selectedListing.image_url ? <img src={selectedListing.image_url} alt="" /> : <Icon.Book />}
              </div>
              <div className="mkt-detail-meta">
                {selectedListing.module_code && <span className="mkt-module-tag">{selectedListing.module_code}</span>}
                <ConditionBadge condition={selectedListing.condition} />
              </div>
              {selectedListing.author && <p className="mkt-detail-line"><strong>Author:</strong> {selectedListing.author}</p>}
              {selectedListing.edition && <p className="mkt-detail-line"><strong>Edition:</strong> {selectedListing.edition}</p>}
              <p className="mkt-detail-line"><strong>Price:</strong> {formatPrice(selectedListing.price)}</p>
              <p className="mkt-detail-line"><strong>Seller:</strong> {selectedListing.sellers?.display_name || 'Seller'}</p>
              {selectedListing.description && <p className="mkt-detail-desc">{selectedListing.description}</p>}

              {isOwnListing ? (
                <div className="mkt-note mkt-note-info">
                  This is your listing. Edit it, mark it sold, or handle requests from "My textbooks".
                </div>
              ) : existingRequest ? (
                <RequestStatusNote request={existingRequest} />
              ) : contactSent ? (
                <div className="mkt-note mkt-note-success">
                  <Icon.Check /> Request sent — you'll see the seller's contact info here under "My requests" once they approve it.
                </div>
              ) : showContactForm ? (
                <form className="mkt-contact-form" onSubmit={submitContact}>
                  {contactError && <div className="mkt-form-error">{contactError}</div>}
                  <label className="mkt-field">
                    <span>Your name</span>
                    <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="So the seller knows who's asking" required />
                  </label>
                  <label className="mkt-field">
                    <span>Your contact (email or WhatsApp)</span>
                    <input value={contactValue} onChange={(e) => setContactValue(e.target.value)} required />
                  </label>
                  <label className="mkt-field">
                    <span>Message (optional)</span>
                    <textarea rows={2} value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} placeholder="e.g. Still available? Can meet on campus." />
                  </label>
                  <div className="mkt-form-actions">
                    <button type="button" className="mkt-btn mkt-btn-ghost" onClick={() => setShowContactForm(false)}>Cancel</button>
                    <button type="submit" className="mkt-btn mkt-btn-primary" disabled={contactBusy}>
                      {contactBusy ? 'Sending…' : 'Send request'}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="mkt-btn mkt-btn-primary mkt-btn-block" onClick={startContactFlow}>
                  Request seller's contact
                </button>
              )}

              {!isOwnListing && (
                <p className="mkt-safety">
                  Meet somewhere public on campus and check the book before you pay. StudyStack doesn't handle
                  payments or deliveries, so the deal is between you and the seller.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------- dashboard -------------------------- */}
      {showDashboard && (
        <div className="mkt-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setShowDashboard(false)}>
          <div className="mkt-panel mkt-panel-wide">
            <div className="mkt-panel-header">
              <h2>My textbooks</h2>
              <button type="button" className="mkt-icon-btn" onClick={() => setShowDashboard(false)} aria-label="Close"><Icon.Close /></button>
            </div>
            <div className="mkt-tabs">
              {sellerProfile && (
                <button type="button" className={dashTab === 'sell' ? 'active' : ''} onClick={() => setDashTab('sell')}>My listings</button>
              )}
              {sellerProfile && (
                <button type="button" className={dashTab === 'incoming' ? 'active' : ''} onClick={() => setDashTab('incoming')}>
                  Incoming requests
                  {pendingIncoming > 0 && <span className="mkt-count-badge">{pendingIncoming}</span>}
                </button>
              )}
              <button type="button" className={dashTab === 'mine' ? 'active' : ''} onClick={() => setDashTab('mine')}>My requests</button>
              {sellerProfile && (
                <button type="button" className={dashTab === 'contact' ? 'active' : ''} onClick={() => setDashTab('contact')}>Contact details</button>
              )}
            </div>

            <div className="mkt-panel-body">
              {dashError && <div className="mkt-form-error">{dashError}</div>}
              {dashTab === 'sell' && (
                <div>
                  <div className="mkt-dash-row">
                    <span>{myListings.length} listing{myListings.length === 1 ? '' : 's'}</span>
                    <button type="button" className="mkt-btn mkt-btn-primary mkt-btn-sm" onClick={() => setShowListingForm('new')}>
                      <Icon.Plus /> New listing
                    </button>
                  </div>
                  {dashLoading && <div className="mkt-state-msg">Loading…</div>}
                  {!dashLoading && myListings.length === 0 && <div className="mkt-state-msg">You haven't listed anything yet.</div>}
                  {myListings.map((l) => (
                    <div className="mkt-my-listing" key={l.id}>
                      <div className="mkt-my-listing-thumb">
                        {l.image_url ? <img src={l.image_url} alt="" /> : <Icon.Book />}
                      </div>
                      <div className="mkt-my-listing-info">
                        <div className="mkt-my-listing-top">
                          <strong>{l.title}</strong>
                          <StatusPill status={l.status} />
                        </div>
                        <span className="mkt-my-listing-sub">{l.module_code || 'No module code'} · {formatPrice(l.price)}</span>
                      </div>
                      <div className="mkt-my-listing-actions">
                        <button type="button" className="mkt-icon-btn" title="Edit" onClick={() => setShowListingForm(l)}><Icon.Edit /></button>
                        <button type="button" className="mkt-icon-btn" title={l.status === 'sold' ? 'Relist' : 'Mark as sold'} onClick={() => handleToggleSold(l)}>
                          {l.status === 'sold' ? <Icon.Store /> : <Icon.Check />}
                        </button>
                        {confirmDeleteId === l.id ? (
                          <>
                            <button type="button" className="mkt-btn mkt-btn-sm mkt-btn-danger" onClick={() => handleDeleteListing(l.id)}>Delete</button>
                            <button type="button" className="mkt-btn mkt-btn-sm mkt-btn-ghost" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                          </>
                        ) : (
                          <button type="button" className="mkt-icon-btn mkt-icon-btn-danger" title="Delete" onClick={() => setConfirmDeleteId(l.id)}><Icon.Trash /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {dashTab === 'incoming' && (
                <div>
                  {dashLoading && <div className="mkt-state-msg">Loading…</div>}
                  {!dashLoading && incomingRequests.length === 0 && <div className="mkt-state-msg">No one has requested your contact info yet.</div>}
                  {incomingRequests.map((r) => (
                    <div className="mkt-request-row" key={r.id}>
                      <div className="mkt-request-info">
                        <strong>{r.requester_name}</strong> wants your contact for <em>{r.book_listings?.title}</em>
                        {r.message && <p className="mkt-request-msg">"{r.message}"</p>}
                        <p className="mkt-request-contact">Their contact: <strong>{r.requester_contact}</strong></p>
                        <span className="mkt-request-meta">{timeAgo(r.created_at)}</span>
                      </div>
                      {r.status === 'pending' ? (
                        <div className="mkt-request-actions">
                          <button type="button" className="mkt-btn mkt-btn-sm mkt-btn-ghost" onClick={() => handleRespond(r.id, false)}>Decline</button>
                          <button type="button" className="mkt-btn mkt-btn-sm mkt-btn-primary" onClick={() => handleRespond(r.id, true)}>Approve</button>
                        </div>
                      ) : (
                        <StatusPill status={r.status} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {dashTab === 'mine' && (
                <div>
                  {dashLoading && <div className="mkt-state-msg">Loading…</div>}
                  {!dashLoading && myRequests.length === 0 && <div className="mkt-state-msg">You haven't requested contact for anything yet.</div>}
                  {myRequests.map((r) => {
                    const contact = pickContact(r);
                    return (
                      <div className="mkt-request-row" key={r.id}>
                        <div className="mkt-request-info">
                          <strong>{r.book_listings?.title}</strong>
                          <span className="mkt-request-meta"> · {r.book_listings ? formatPrice(r.book_listings.price) : ''}</span>
                          <div><StatusPill status={r.status} /></div>
                          {r.status === 'approved' && <ContactReveal contact={contact} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {dashTab === 'contact' && (
                <form className="mkt-contact-settings" onSubmit={saveSellerContact}>
                  <p className="mkt-form-intro">
                    This is only shown to a buyer after you approve their request. Change it here if your number or email changes.
                  </p>
                  <label className="mkt-field">
                    <span>Contact method</span>
                    <select value={sellerContact.method} onChange={(e) => setSellerContact({ method: e.target.value, value: '' })}>
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </label>
                  <label className="mkt-field">
                    <span>{sellerContact.method === 'whatsapp' ? 'WhatsApp number' : 'Email address'}</span>
                    <input value={sellerContact.value} onChange={(e) => setSellerContact((c) => ({ ...c, value: e.target.value }))} required />
                  </label>
                  {contactSavedMsg && <div className="mkt-note mkt-note-success"><Icon.Check /> {contactSavedMsg}</div>}
                  <div className="mkt-form-actions">
                    <button type="submit" className="mkt-btn mkt-btn-primary" disabled={contactSaving || dashLoading}>
                      {contactSaving ? 'Saving…' : 'Save contact details'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------- seller registration -------------------------- */}
      {showRegister && (
        <RegisterSellerModal
          defaultEmail={session?.email || ''}
          onClose={() => setShowRegister(false)}
          onSubmit={handleRegisterSubmit}
        />
      )}

      {/* -------------------------- listing form (new/edit) -------------------------- */}
      {showListingForm && (
        <ListingFormModal
          listing={showListingForm === 'new' ? null : showListingForm}
          onClose={() => setShowListingForm(null)}
          onSubmit={handleCreateOrEditListing}
          fileInputRef={fileInputRef}
        />
      )}
    </div>
  );
}

/* ---------------------------------- seller registration modal ---------------------------------- */

function RegisterSellerModal({ defaultEmail, onClose, onSubmit }) {
  const [displayName, setDisplayName] = useState('');
  const [contactMethod, setContactMethod] = useState('email');
  const [contactValue, setContactValue] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim() || !contactValue.trim()) {
      setError('Fill in a display name and a way for buyers to reach you.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ displayName, contactMethod, contactValue });
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not register you as a seller.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mkt-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mkt-panel mkt-panel-narrow">
        <div className="mkt-panel-header">
          <h2>Register to become a seller</h2>
          <button type="button" className="mkt-icon-btn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>
        <form className="mkt-panel-body" onSubmit={handleSubmit}>
          {error && <div className="mkt-form-error">{error}</div>}
          <p className="mkt-form-intro">
            This is only shared with a buyer once you approve their request — it's never public.
          </p>
          <label className="mkt-field">
            <span>Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How buyers will see you" required />
          </label>
          <label className="mkt-field">
            <span>Contact method</span>
            <select value={contactMethod} onChange={(e) => { setContactMethod(e.target.value); setContactValue(e.target.value === 'email' ? defaultEmail : ''); }}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="mkt-field">
            <span>{contactMethod === 'whatsapp' ? 'WhatsApp number' : 'Email address'}</span>
            <input value={contactValue} onChange={(e) => setContactValue(e.target.value)} required />
          </label>
          <div className="mkt-form-actions">
            <button type="button" className="mkt-btn mkt-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy}>
              {busy ? 'Registering…' : 'Register as a seller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------- listing create/edit modal ---------------------------------- */

function ListingFormModal({ listing, onClose, onSubmit, fileInputRef }) {
  const editing = Boolean(listing);
  const [title, setTitle] = useState(listing?.title || '');
  const [author, setAuthor] = useState(listing?.author || '');
  const [moduleCode, setModuleCode] = useState(listing?.module_code || '');
  const [edition, setEdition] = useState(listing?.edition || '');
  const [condition, setCondition] = useState(listing?.condition || 'good');
  const [price, setPrice] = useState(listing?.price ?? '');
  const [description, setDescription] = useState(listing?.description || '');
  const [imageUrl, setImageUrl] = useState(listing?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadListingImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Image upload failed — you can still save the listing without a photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || price === '' || Number(price) < 0) {
      setError('A title and a valid price are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title, author, moduleCode, edition, condition, price, description, imageUrl }, listing?.id);
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not save this listing.');
      setBusy(false);
    }
  }

  return (
    <div className="mkt-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mkt-panel mkt-panel-narrow">
        <div className="mkt-panel-header">
          <h2>{editing ? 'Edit listing' : 'New listing'}</h2>
          <button type="button" className="mkt-icon-btn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>
        <form className="mkt-panel-body" onSubmit={handleSubmit}>
          {error && <div className="mkt-form-error">{error}</div>}

          <div className="mkt-image-picker">
            <div className="mkt-image-preview">
              {imageUrl ? <img src={imageUrl} alt="" /> : <Icon.Image />}
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImagePick} disabled={uploading} />
              <p className="mkt-hint">Optional. JPG, PNG or WebP under 5 MB. A clear photo of the cover works best.</p>
              {imageUrl && !uploading && (
                <button type="button" className="mkt-link-btn" onClick={() => { setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove photo</button>
              )}
              {uploading && <p className="mkt-hint">Uploading…</p>}
            </div>
          </div>

          <label className="mkt-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="mkt-field-row">
            <label className="mkt-field">
              <span>Author</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <label className="mkt-field">
              <span>Edition</span>
              <input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="e.g. 7th" />
            </label>
          </div>
          <div className="mkt-field-row">
            <label className="mkt-field">
              <span>Module code</span>
              <input value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} placeholder="e.g. COS 132" />
            </label>
            <label className="mkt-field">
              <span>Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <label className="mkt-field">
            <span>Price (ZAR)</span>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
          <label className="mkt-field">
            <span>Description (optional)</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition notes, highlighting, which chapters you used, etc." />
          </label>

          <div className="mkt-form-actions">
            <button type="button" className="mkt-btn mkt-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy || uploading}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------- styles ---------------------------------- */

const MKT_STYLES = `
  .mkt-root {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    min-height: 100vh;
  }
  .mkt-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px clamp(20px, 4vw, 56px);
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .mkt-nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .mkt-nav-logo { width: 30px; height: 30px; object-fit: contain; }
  .mkt-nav-title { font-size: 17px; font-weight: 800; color: #0e3868; letter-spacing: -0.02em; }
  .mkt-nav-badge {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
    background: #f0f9ff; color: #0369a1; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.05em;
  }
  .mkt-nav-actions { display: flex; align-items: center; gap: 10px; }

  .mkt-btn {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 7px;
    border: 1px solid transparent; cursor: pointer; transition: all .15s ease; white-space: nowrap;
  }
  .mkt-btn-sm { padding: 6px 12px; font-size: 12.5px; }
  .mkt-btn-block { width: 100%; justify-content: center; }
  .mkt-btn-primary { background: #0e3868; color: #fff; box-shadow: 0 1px 2px rgba(14,56,104,.15); }
  .mkt-btn-primary:hover { background: #144e8c; }
  .mkt-btn-primary:disabled { opacity: .6; cursor: default; }
  .mkt-btn-ghost { background: #fff; color: #334155; border-color: #e2e8f0; }
  .mkt-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }

  .mkt-icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff;
    color: #475569; cursor: pointer;
  }
  .mkt-icon-btn:hover { background: #f1f5f9; color: #0e3868; }
  .mkt-icon-btn-danger:hover { background: #fff1f2; color: #b91c1c; border-color: #fecdd3; }

  .mkt-hero {
    padding: 40px clamp(20px, 4vw, 56px) 28px;
    background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
    border-bottom: 1px solid #e2e8f0;
  }
  .mkt-hero h1 { font-size: clamp(22px, 3vw, 30px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 8px; max-width: 640px; }
  .mkt-hero p { color: #475569; font-size: 14.5px; margin: 0 0 22px; max-width: 560px; }

  .mkt-search-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .mkt-search-input-wrap { position: relative; flex: 2 1 260px; min-width: 220px; }
  .mkt-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
  .mkt-search-input-wrap input {
    width: 100%; padding: 10px 12px 10px 34px; border-radius: 7px; border: 1px solid #cbd5e1;
    font-size: 13.5px; background: #fff; box-sizing: border-box;
  }
  .mkt-filter-input {
    flex: 1 1 160px; min-width: 140px; padding: 10px 12px; border-radius: 7px; border: 1px solid #cbd5e1;
    font-size: 13.5px; background: #fff;
  }
  .mkt-filter-input-narrow { flex: 0 1 110px; min-width: 100px; }

  .mkt-main { padding: 28px clamp(20px, 4vw, 56px) 60px; }
  .mkt-state-msg { text-align: center; padding: 40px 20px; color: #64748b; font-size: 13.5px; }
  .mkt-state-error { color: #b91c1c; }

  .mkt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
  .mkt-card {
    text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    cursor: pointer; padding: 0; display: flex; flex-direction: column; transition: all .15s ease;
  }
  .mkt-card:hover { border-color: #93c5fd; box-shadow: 0 4px 14px rgba(14,56,104,.08); transform: translateY(-1px); }
  .mkt-card-thumb {
    height: 140px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8;
  }
  .mkt-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .mkt-card-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
  .mkt-card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .mkt-card-title { font-size: 14px; font-weight: 700; margin: 0; line-height: 1.3; }
  .mkt-card-author { font-size: 12.5px; color: #64748b; margin: 0; }
  .mkt-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
  .mkt-card-price { font-size: 14.5px; font-weight: 800; color: #0e3868; }
  .mkt-card-seller { font-size: 11.5px; color: #94a3b8; }

  .mkt-module-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 700;
    background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px;
  }
  .mkt-badge { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; border: 1px solid; }
  .mkt-pill { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }

  .mkt-overlay {
    position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
  }
  .mkt-panel {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; width: min(480px, 100%);
    max-height: min(700px, 90vh); box-shadow: 0 12px 40px rgba(0,0,0,.16); overflow: hidden;
    display: flex; flex-direction: column;
  }
  .mkt-panel-narrow { width: min(440px, 100%); }
  .mkt-panel-wide { width: min(680px, 100%); }
  .mkt-panel-header {
    padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center;
    justify-content: space-between; background: #f8fafc; flex-shrink: 0;
  }
  .mkt-panel-header h2 { font-size: 15px; font-weight: 800; color: #0e3868; margin: 0; }
  .mkt-panel-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }

  .mkt-detail-thumb { height: 180px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; overflow: hidden; }
  .mkt-detail-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .mkt-detail-meta { display: flex; gap: 8px; align-items: center; }
  .mkt-detail-line { font-size: 13.5px; color: #334155; margin: 0; }
  .mkt-detail-desc { font-size: 13px; color: #475569; line-height: 1.55; margin: 4px 0 0; }

  .mkt-note { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 7px; font-size: 12.5px; line-height: 1.5; }
  .mkt-note-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }

  .mkt-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: #334155; flex: 1; }
  .mkt-field input, .mkt-field select, .mkt-field textarea {
    font-family: inherit; font-size: 13.5px; font-weight: 400; padding: 9px 11px; border-radius: 6px;
    border: 1px solid #cbd5e1; background: #fff; resize: vertical; box-sizing: border-box;
  }
  .mkt-field-row { display: flex; gap: 10px; }
  .mkt-form-intro { font-size: 12.5px; color: #64748b; margin: 0; }
  .mkt-form-error {
    background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; font-size: 12.5px;
    padding: 9px 12px; border-radius: 6px;
  }
  .mkt-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .mkt-hint { font-size: 11.5px; color: #94a3b8; margin: 4px 0 0; }

  .mkt-image-picker { display: flex; gap: 14px; align-items: center; }
  .mkt-image-preview {
    width: 72px; height: 72px; border-radius: 8px; background: #f1f5f9; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; color: #94a3b8; overflow: hidden;
  }
  .mkt-image-preview img { width: 100%; height: 100%; object-fit: cover; }

  .mkt-tabs { display: flex; gap: 4px; padding: 10px 20px 0; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0; }
  .mkt-tabs button {
    background: none; border: none; padding: 9px 12px; font-size: 12.5px; font-weight: 600; color: #64748b;
    cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
  }
  .mkt-tabs button.active { color: #0e3868; border-bottom-color: #0e3868; }

  .mkt-dash-row { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: #64748b; margin-bottom: 4px; }

  .mkt-my-listing { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .mkt-my-listing-thumb { width: 44px; height: 44px; border-radius: 6px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; overflow: hidden; flex-shrink: 0; }
  .mkt-my-listing-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .mkt-my-listing-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .mkt-my-listing-top { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .mkt-my-listing-sub { font-size: 12px; color: #64748b; }
  .mkt-my-listing-actions { display: flex; gap: 6px; }

  .mkt-request-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
  .mkt-request-info { font-size: 13px; color: #334155; }
  .mkt-request-msg { font-size: 12.5px; color: #64748b; margin: 4px 0; font-style: italic; }
  .mkt-request-meta { font-size: 11.5px; color: #94a3b8; }
  .mkt-request-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .mkt-contact-reveal { font-size: 13px; margin: 6px 0 0; background: #f0f9ff; border: 1px solid #bae6fd; padding: 8px 10px; border-radius: 6px; }

  .mkt-count-badge {
    display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px;
    padding: 0 5px; margin-left: 6px; border-radius: 9px; background: #dc2626; color: #fff;
    font-size: 10.5px; font-weight: 700; line-height: 1;
  }
  .mkt-btn-danger { background: #b91c1c; color: #fff; }
  .mkt-btn-danger:hover { background: #991b1b; }
  .mkt-btn:disabled { opacity: .6; cursor: default; }
  .mkt-link-btn { background: none; border: none; padding: 0; margin-top: 4px; font-size: 11.5px; font-weight: 600; color: #2563eb; cursor: pointer; }
  .mkt-link-btn:hover { text-decoration: underline; }
  .mkt-note-info { background: #f0f9ff; color: #0c4a6e; border: 1px solid #bae6fd; }
  .mkt-note-muted { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
  .mkt-note-col { flex-direction: column; align-items: flex-start; }
  .mkt-note-col .mkt-contact-reveal { margin: 0; background: #fff; border-color: #bbf7d0; color: #0f172a; }
  .mkt-safety { font-size: 11.5px; line-height: 1.5; color: #94a3b8; margin: 2px 0 0; }
  .mkt-request-contact { font-size: 12.5px; color: #475569; margin: 2px 0 4px; }
  .mkt-contact-settings { display: flex; flex-direction: column; gap: 12px; }
  .mkt-tabs button { display: inline-flex; align-items: center; }

  @media (max-width: 640px) {
    .mkt-nav { flex-wrap: wrap; gap: 10px; }
    .mkt-search-row { flex-direction: column; }
    .mkt-filter-input, .mkt-filter-input-narrow { flex: 1 1 auto; }
  }
`;

export default BooksPage;
