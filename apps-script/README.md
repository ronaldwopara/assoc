# ASOSC payments & invoices pipeline — Apps Script

Adapted from the original design in `~/Downloads/files/IMPLEMENTATION_PLAN.md`
(InteracLogger.gs / InvoiceArchiver.gs / Setup.gs), retargeted at what's
live now instead of a not-yet-created "Transactions/Invoices/Members" sheet:

| Effect | Target |
|---|---|
| Mark a membership paid | [Membership - Website](https://docs.google.com/spreadsheets/d/11mIi1S1NYREgQXCVEGwVgkSVVJz504dklGuiIoF30cI) → current-year tab (e.g. `2026`) → `PAID OR NOT` column |
| Log money received | [ASOSC Finances](https://docs.google.com/spreadsheets/d/19TLj5PN53evcHMUVV7f0gaZagjC7p0JSoPvGyelMwS4) → `<year>-Income` |
| Log an invoice/expense + save its attachment | same Finances sheet → `<year>-Expenditure`, file saved to a Drive folder |
| Audit trail + dedupe guard for both jobs | Finances sheet → `Automation Log` tab (created by setup) |

This code has **not been run** — I can write and reason about Apps Script
from here, but there's no sandbox to execute it in. Test it by hand before
trusting it (steps below), the same way the original plan called for.

## What's not in scope here (out of this repo)

The website side is already done (separate work, same session): the
membership form writes rows directly to the Membership sheet via the Sheets
API (`lib/membership-sheet.ts`), including a `Membership Card URL` column
holding a Cloudinary link to the member's card image. Once this script marks
`PAID OR NOT` as `Paid`, **something still needs to actually email that card
to the member** — this pipeline only flips the column, it doesn't send
anything. That's a deliberate gap, not an oversight: wire up
`MailApp.sendEmail` in `markMembershipPaidByEmail` (or a small trigger
watching for the transition) once you're ready for it, using the row's
`Membership Card URL` cell.

## Install

1. Open the **ASOSC Finances** spreadsheet as `africanssocietyofsc@gmail.com`
   (the account that receives the Interac emails — Phase 0 of the original
   plan is right that authorizing from any other account produces a script
   that works in testing and silently returns nothing in production).
2. Extensions → Apps Script.
3. Create four script files matching the names here — `Config.gs`,
   `PaymentsLogger.gs`, `InvoiceArchiver.gs`, `Setup.gs` — and paste each
   file's contents in.
4. Save, then run `setupEverything` from the function picker (▶ button next
   to the dropdown at the top). Authorize when prompted — this needs Gmail,
   Sheets, and Drive scopes.
5. Reload the spreadsheet tab. An **ASOSC** menu should now appear.

## Test before trusting it

Run these from the **ASOSC** menu, in order, and read the results before
walking away:

1. **Test invoice detection** — tells you whether `category:purchases`
   actually returns anything in this account. It's an undocumented Gmail
   smart-label; if it returns 0, the allowlist and keyword strategies are
   carrying the invoice detection alone, which is worth knowing before this
   gets relied on.
2. **Check for new payments now** — runs `processInteracEmails` once by
   hand. Open the `Automation Log` tab afterward and check a few rows
   against emails you know about. Then check the Membership sheet: did
   `PAID OR NOT` actually flip for a payment you know matches a member's
   registered email?
3. **Check for new invoices now** — same idea; check the `Automation Log`,
   the `2026-Expenditure` tab, and the `ASOSC Invoices` Drive folder.
4. **Run pipeline health check** — should log "Health check OK" the first
   time (a fresh `lastInteracRun` heartbeat was just set by step 2).

## Decisions carried over from the original plan (still true here)

- **Reply-To is the identity key** for inbound Interac mail, not the display
  name — matching is done in `markMembershipPaidByEmail` against the
  Membership sheet's `Email` column only (no name fallback — see the
  "Match strategy" decision below).
- **Line-anchored regex, never positional** — Interac reorders the Transfer
  Details block by direction (`Message:` appears before `Date:` on inbound,
  after on outbound). Don't "simplify" `parseMessage` into a sequential
  field walk.
- **Amount is not a membership-tier identifier** — ASOSC takes donations at
  the same amounts as membership tiers constantly. `TIERS` is carried over
  as an informational hint only and is never used to decide anything.
- **DKIM verification stays on** — the `From` header is trivially spoofable
  and this ledger influences who's treated as a paid member, so a forged
  "Interac" email is a live fraud path. Failed verification skips both the
  membership match and the ledger write, logging
  `Blocked — failed verification` instead of silently disappearing.
- **Anchored amounts on invoices, never largest-value** — `guessAmount`
  binds to labels like `Total Due`/`Balance Due`; an unlabeled figure is
  left blank rather than guessed, because a wrong number in a bookkeeping
  export is worse than an empty cell.
- **Dedupe guarded twice** — a Gmail label (never re-read) plus the
  `Automation Log`'s own Gmail Message ID column (so a labeling mishap can't
  double-write). Manual entries from the menu have a blank message ID and
  are invisible to this guard on purpose.

## Decisions made new for this adaptation

- **Match strategy: email-only, no name fallback.** The Membership sheet
  currently has no separate "confirmed this is my Interac email" field (an
  earlier version of the membership form had one; it was simplified away).
  So matching is Reply-To vs. the sheet's plain `Email` column. A member who
  pays from a different email than they registered with won't auto-match —
  `showManualPaymentDialog` → "membership" covers that by hand.
- **Income/Expenditure rows fill facts only, never categorization.** The
  live `2026-Income`/`2026-Expenditure` tabs have real bookkeeping columns —
  `Total recognized in PL`, `Deferred Income`, `Expense Type`, `Category` —
  that are the bookkeeper's judgment calls, not something a parser should
  guess at (this is the same principle §3.5 of the original plan states for
  match confidence: "the ledger makes no claims"). Every automated row fills
  only Vendor/Donor, Amount, Date, and a Notes cell carrying the Gmail link
  (and Drive links, for invoices) — categorization columns are left blank
  for Busayo to fill in directly on the sheet.
- **No new "Transactions"/"Invoices"/"Members" tabs.** The original plan's
  architecture assumed a not-yet-created sheet built around those three
  tabs. Since the real Membership and Finances sheets already exist with
  their own shapes, this adaptation writes into what's actually there and
  uses a single `Automation Log` tab (created by setup) for the dedupe/audit
  role those three tabs used to serve, combined.
- **Year tabs are never auto-created.** `2025-Income`/`2025-Expenditure` and
  `2026-Income`/`2026-Expenditure` already have subtly different header
  columns from each other (`2025-Income`'s first column is literally titled
  "Category of Donor"; `2026-Income`'s equivalent column has no header text
  at all). Fabricating a `2027-Income` tab automatically risks getting that
  shape wrong. Instead, `checkPipelineHealth` and `setupEverything` both
  warn if the current year's tabs don't exist yet — create it by duplicating
  last year's tab (keeping its header row) and renaming it.

## Open items (yours to decide, not assumed here)

1. **Emailing the membership card on payment.** See "What's not in scope"
   above — this pipeline flips `PAID OR NOT`, nothing sends the email yet.
2. **Outbound Interac routing.** Every outbound transfer currently logs to
   `<year>-Expenditure` unconditionally. If some outbound transfers are
   actually refunds/reimbursements that shouldn't count as an expense,
   that's a judgment call this script can't make — it logs the fact, review
   catches the exception.
3. **Backfill.** Same caution as the original plan: this only processes
   emails going forward from install (label-based). A real backfill wants a
   date-bounded runner, not `processInteracEmails` pointed at years of
   history unattended.
4. **`Account Ending` retention** — carried through parsing but not written
   anywhere in this adaptation (there's no column for it on the current
   Income/Expenditure tabs). Drop the extraction entirely if it's not
   wanted, per the original plan's "the cheapest way to protect data is not
   to hold it."
