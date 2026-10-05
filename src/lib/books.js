/**
 * StudyStack textbook marketplace service.
 *
 * Backed by the same Supabase project as auth.js — see marketplace_schema.sql
 * for the tables and Row Level Security policies this file relies on. Run
 * that file once in the Supabase SQL Editor before using anything here.
 *
 * The approval gate (a buyer only learns a seller's contact info once the
 * seller approves their request) is enforced by RLS on seller_contacts, not
 * by this file — getMyContactRequests() below simply won't receive contact
 * details from Supabase until that's true, however it's called.
 *
 * BooksPage.jsx is the only caller of this file, same shape as auth.js/AuthPage.
 */

import { supabase } from './supabaseClient.js';

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'worn', label: 'Worn' },
];

export function conditionLabel(value) {
  return CONDITIONS.find((c) => c.value === value)?.label || value;
}

export class MarketplaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MarketplaceError';
    this.code = code;
  }
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new MarketplaceError('unknown', error.message);
  return data.user;
}

function requireUser(user) {
  if (!user) throw new MarketplaceError('not_signed_in', 'Sign in to do that.');
  return user;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit in marketplace_schema.sql
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PRICE = 10000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null if `value` is a plausible email / WhatsApp number for `method`. */
export function validateContact(method, value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter a contact detail.';
  if (method === 'whatsapp') {
    const digits = v.replace(/[\s()-]/g, '');
    if (!/^\+?\d{9,15}$/.test(digits)) return 'Enter a valid WhatsApp number, e.g. 082 123 4567 or +27 82 123 4567.';
    return null;
  }
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address.';
  return null;
}

/** Buyers can give either kind of contact when asking; accept whichever one it looks like. */
export function validateAnyContact(value) {
  return validateContact('email', value) && validateContact('whatsapp', value)
    ? 'Enter a valid email address or WhatsApp number.'
    : null;
}

function validateListingFields(f) {
  if (!f.title?.trim()) throw new MarketplaceError('invalid_listing', 'A title is required.');
  if (f.title.trim().length > 200) throw new MarketplaceError('invalid_listing', 'Keep the title under 200 characters.');
  const price = Number(f.price);
  if (f.price === '' || f.price === null || Number.isNaN(price) || price < 0) {
    throw new MarketplaceError('invalid_listing', 'Enter a valid price.');
  }
  if (price > MAX_PRICE) throw new MarketplaceError('invalid_listing', `Prices are capped at R${MAX_PRICE.toLocaleString('en-ZA')}.`);
  if (f.description && f.description.length > 2000) {
    throw new MarketplaceError('invalid_listing', 'Keep the description under 2000 characters.');
  }
}

/** Turns a raw Supabase/Postgres error into something a student can act on. */
function friendly(error, fallbackCode) {
  if (error?.code === '42501') {
    return new MarketplaceError('not_allowed', "You can't do that. It may be your own listing, or it's no longer available.");
  }
  return new MarketplaceError(fallbackCode, error?.message || 'Something went wrong. Please try again.');
}

/* ============================== Browsing (public) ============================== */

/**
 * Active listings, newest first. `filters` are all optional:
 *   search      - matches title, author, or module code
 *   moduleCode  - narrows to a specific module code
 *   condition   - one of CONDITIONS' values
 *   maxPrice    - number
 */
export async function getListings(filters = {}) {
  const { search = '', moduleCode = '', condition = '', maxPrice = null } = filters;

  let query = supabase
    .from('book_listings')
    .select('id, title, author, module_code, edition, condition, price, image_url, created_at, seller_id, sellers(display_name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (escaped) query = query.or(`title.ilike.%${escaped}%,author.ilike.%${escaped}%,module_code.ilike.%${escaped}%`);
  }
  if (moduleCode.trim()) query = query.ilike('module_code', `%${moduleCode.trim()}%`);
  if (condition) query = query.eq('condition', condition);
  if (maxPrice !== null && maxPrice !== '') query = query.lte('price', Number(maxPrice));

  const { data, error } = await query;
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

export async function getListing(id) {
  const { data, error } = await supabase
    .from('book_listings')
    .select('*, sellers(display_name)')
    .eq('id', id)
    .single();
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

/* ============================== Seller registration ============================== */

/** Returns { id, display_name, created_at } or null if this student hasn't registered as a seller yet. */
export async function getMySellerProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase.from('sellers').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

export async function registerSeller({ displayName, contactMethod, contactValue }) {
  const user = requireUser(await currentUser());

  if (!displayName?.trim()) throw new MarketplaceError('invalid_contact', 'Enter a display name.');
  if (displayName.trim().length > 60) throw new MarketplaceError('invalid_contact', 'Keep your display name under 60 characters.');
  const contactProblem = validateContact(contactMethod, contactValue);
  if (contactProblem) throw new MarketplaceError('invalid_contact', contactProblem);

  // upsert (not insert) so that if a previous attempt saved the seller row but failed on the
  // contact row, trying again finishes the job instead of failing with a duplicate-key error.
  const { error: sellerErr } = await supabase
    .from('sellers')
    .upsert({ id: user.id, display_name: displayName.trim() });
  if (sellerErr) throw new MarketplaceError('register_failed', sellerErr.message);

  const { error: contactErr } = await supabase
    .from('seller_contacts')
    .upsert({ id: user.id, contact_method: contactMethod, contact_value: contactValue.trim() });
  if (contactErr) throw new MarketplaceError('register_failed', contactErr.message);

  return true;
}

/** The signed-in seller's own contact details (RLS lets a seller read only their own), or null. */
export async function getMySellerContact() {
  const user = requireUser(await currentUser());
  const { data, error } = await supabase.from('seller_contacts').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

export async function updateSellerContact({ contactMethod, contactValue }) {
  const user = requireUser(await currentUser());
  const contactProblem = validateContact(contactMethod, contactValue);
  if (contactProblem) throw new MarketplaceError('invalid_contact', contactProblem);
  const { error } = await supabase
    .from('seller_contacts')
    .upsert({ id: user.id, contact_method: contactMethod, contact_value: contactValue.trim() });
  if (error) throw new MarketplaceError('update_failed', error.message);
  return true;
}

/* ============================== Listing management (seller) ============================== */

/** All of the signed-in student's own listings, any status, newest first. */
export async function getMyListings() {
  const user = requireUser(await currentUser());
  const { data, error } = await supabase
    .from('book_listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

export async function createListing(fields) {
  const user = requireUser(await currentUser());
  validateListingFields(fields);
  const { data, error } = await supabase
    .from('book_listings')
    .insert({
      seller_id: user.id,
      title: fields.title.trim(),
      author: fields.author?.trim() || null,
      module_code: fields.moduleCode?.trim().toUpperCase() || null,
      edition: fields.edition?.trim() || null,
      condition: fields.condition,
      price: Number(fields.price),
      description: fields.description?.trim() || null,
      image_url: fields.imageUrl || null,
    })
    .select()
    .single();
  if (error) throw new MarketplaceError('create_failed', error.message);
  return data;
}

export async function updateListing(id, fields) {
  if (fields.title !== undefined || fields.price !== undefined) {
    // full-form edits always send both; status-only patches (sold/relist) skip this
    validateListingFields({ title: fields.title ?? 'x', price: fields.price ?? 0, description: fields.description });
  }
  const patch = {};
  if (fields.title !== undefined) patch.title = fields.title.trim();
  if (fields.author !== undefined) patch.author = fields.author?.trim() || null;
  if (fields.moduleCode !== undefined) patch.module_code = fields.moduleCode?.trim().toUpperCase() || null;
  if (fields.edition !== undefined) patch.edition = fields.edition?.trim() || null;
  if (fields.condition !== undefined) patch.condition = fields.condition;
  if (fields.price !== undefined) patch.price = Number(fields.price);
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (fields.imageUrl !== undefined) patch.image_url = fields.imageUrl || null;
  if (fields.status !== undefined) patch.status = fields.status;

  const { error } = await supabase.from('book_listings').update(patch).eq('id', id);
  if (error) throw new MarketplaceError('update_failed', error.message);
  return true;
}

export async function markListingSold(id) {
  return updateListing(id, { status: 'sold' });
}

export async function relistListing(id) {
  return updateListing(id, { status: 'active' });
}

/** Storage path inside the book-images bucket for a public URL we generated, or null. */
function imagePathFromUrl(url) {
  const marker = '/book-images/';
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

export async function deleteListing(id) {
  const { data: row } = await supabase.from('book_listings').select('image_url').eq('id', id).maybeSingle();

  const { error } = await supabase.from('book_listings').delete().eq('id', id);
  if (error) throw new MarketplaceError('delete_failed', error.message);

  // Best effort: don't leave the photo orphaned in storage. A failure here isn't worth
  // telling the student about - the listing itself is already gone.
  const path = imagePathFromUrl(row?.image_url);
  if (path) await supabase.storage.from('book-images').remove([path]).catch(() => {});
  return true;
}

/** Uploads to the `book-images` storage bucket (see marketplace_schema.sql) and returns its public URL. */
export async function uploadListingImage(file) {
  const user = requireUser(await currentUser());
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new MarketplaceError('upload_failed', 'Use a JPG, PNG, or WebP photo.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new MarketplaceError('upload_failed', 'That photo is over 5 MB. Try a smaller one.');
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('book-images').upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new MarketplaceError('upload_failed', error.message);

  const { data } = supabase.storage.from('book-images').getPublicUrl(path);
  return data.publicUrl;
}

/* ============================== Contact requests ============================== */

/**
 * Buyer asks to be given a seller's contact info. `requesterName` and
 * `requesterContact` are shown to the seller so they have something to go
 * on when deciding whether to approve — pass session-derived defaults from
 * BooksPage and let the student edit them.
 */
export async function requestContact(listingId, { requesterName, requesterContact, message = '' }) {
  const user = requireUser(await currentUser());
  if (!requesterName?.trim()) throw new MarketplaceError('invalid_contact', 'Enter your name.');
  const contactProblem = validateAnyContact(requesterContact);
  if (contactProblem) throw new MarketplaceError('invalid_contact', contactProblem);
  if (message.length > 500) throw new MarketplaceError('invalid_contact', 'Keep your message under 500 characters.');
  const { error } = await supabase.from('contact_requests').insert({
    listing_id: listingId,
    requester_id: user.id,
    requester_name: requesterName.trim(),
    requester_contact: requesterContact.trim(),
    message: message.trim() || null,
  });
  if (error) {
    if (error.code === '23505') {
      throw new MarketplaceError('already_requested', "You've already requested contact for this listing.");
    }
    throw friendly(error, 'request_failed');
  }
  return true;
}

/** Requests the signed-in student has made, as a buyer — with seller contact info once approved. */
export async function getMyContactRequests() {
  const user = requireUser(await currentUser());
  const { data, error } = await supabase
    .from('contact_requests')
    .select(
      'id, message, status, created_at, responded_at, listing_id, ' +
      'book_listings(title, module_code, price, image_url, seller_id, ' +
      'sellers(display_name, seller_contacts(contact_method, contact_value)))'
    )
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

/** Pending/decided requests against the signed-in student's own listings, as a seller. */
export async function getRequestsForMyListings() {
  const user = requireUser(await currentUser());
  const { data, error } = await supabase
    .from('contact_requests')
    .select(
      'id, message, status, created_at, responded_at, requester_name, requester_contact, listing_id, ' +
      'book_listings!inner(title, module_code, seller_id)'
    )
    .eq('book_listings.seller_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return data;
}

/** How many requests on the signed-in seller's listings are still waiting on them (for the nav badge). */
export async function getPendingRequestCount() {
  const user = requireUser(await currentUser());
  const { count, error } = await supabase
    .from('contact_requests')
    .select('id, book_listings!inner(seller_id)', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('book_listings.seller_id', user.id);
  if (error) throw new MarketplaceError('fetch_failed', error.message);
  return count || 0;
}

export async function respondToRequest(requestId, approve) {
  const { error } = await supabase
    .from('contact_requests')
    .update({ status: approve ? 'approved' : 'declined' }) // responded_at is stamped by a DB trigger
    .eq('id', requestId);
  if (error) throw new MarketplaceError('respond_failed', error.message);
  return true;
}
