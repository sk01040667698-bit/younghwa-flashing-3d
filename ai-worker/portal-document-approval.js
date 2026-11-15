/**
 * Server-only approval policy for adding EXISTING portal documents to Pansooni AI.
 *
 * This file is a safety boundary and integration template, not a live admin UI.
 * No portal documents are imported or exposed until explicitly registered,
 * approved AND verified as public-safe, and the portal's existing authorization
 * is integrated server-side.
 *
 * Admin UI requirements:
 * - load file metadata from the actual portal's authenticated document repository;
 * - an admin-only checkbox controls an explicit allowed list, default false;
 * - enforce permissions BEFORE reading any document body, not in the browser;
 * - edits require authentication, a CSRF-protected write endpoint, and an audit log;
 * - never send non-approved document names, contents, snippets or text to the model.
 */

export const PORTAL_DOCUMENT_DEFAULT = Object.freeze({
  aiSearchAllowed: false,
  classification: "unreviewed",
});

export function mayExposeDocumentToPublicAI(documentRecord) {
  // The current AI is on a publicly accessible GitHub Pages site.
  // Consequently "approved" is NOT sufficient: the document must also
  // be explicitly classified for publication outside the company.
  return Boolean(
    documentRecord &&
    documentRecord.aiSearchAllowed === true &&
    documentRecord.classification === "public" &&
    documentRecord.reviewedByAdmin === true &&
    typeof documentRecord.id === "string" &&
    documentRecord.id.length > 0
  );
}

export function filterPublicAIAllowedDocuments(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(mayExposeDocumentToPublicAI);
}
