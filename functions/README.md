# Admin services

## History pagination

The admin dashboard displays users, vendors, bookings, and activity in pages of
10, 25, or 50 records, with date/name sorting and matching record counts. Search,
filter, sort, and page-size changes return to page 1. Users and vendors now use
the directory paging service described below. Booking/activity history retain
their existing client pagination.

Booking and activity history request bounded batches using document-ID cursors,
including legacy records with missing dates. The client loads all batches before
applying global search, sort, and pagination. This keeps counts and filters
complete across the prototype's mixed date fields, but memory and initial load
time still grow with the full history size. Undated records sort last in both
date directions. Bookings in `bookings` take precedence over `bookingPayment`
when document IDs match, including across batch boundaries.

Deploy the updated history services before publishing the updated frontend:

```sh
firebase deploy --only functions:getBookingHistory,functions:adminActivity,functions:getAdminActivity --project stallseeker-c2ffe
```

The pagination contract is versioned. The new frontend shows an error if the
services have not been updated, instead of silently displaying truncated history.
Existing clients can continue using the original non-paginated responses.

## User and vendor directory pagination

The Users and Vendors screens request one page of 10, 25, or 50 records at a
time through the administrator-only `getAdminDirectoryPage` callable. They no
longer start full `users`/`vendors` listeners. Only the current page stays in
browser memory; Previous/Next retain value-based cursors, including when the
cursor record is deleted. Changing search, filter, sort, or page size resets
to page 1. Dashboard, analytics, and map screens still use their complete live
datasets; analytics listeners now run only while that screen is open.

The `adminDirectory` collection is a derived index, not a new source of truth.
`syncAdminUserDirectory` and `syncAdminVendorDirectory` re-read both source
profiles in a transaction. A vendor profile wins over a user profile with the
same UID, matching the existing account list. Legacy creation-date aliases are
normalized to milliseconds; undated records remain last in both date orders.
Phone/email aliases and matching-user fallbacks remain supported. Auth email
fallbacks are resolved on synchronization, rather than for every profile on
every page load. After Auth-only email changes, rerun the backfill to refresh
those fallbacks.

Substring search uses character grams to narrow indexed candidates and checks
the full text before returning a match. Each request reads at most 200
candidates plus one lookahead and returns at most the selected page size. A
rare, sparse search may return a short or empty batch with a Next cursor;
the UI explicitly lets the admin continue searching. It never presents a
candidate count as an exact match count. The role-tab and vendor summary totals
are global aggregate counts, not the size of the loaded page. Category options
come from transactional category counts in `adminDirectoryCategories`.

Current-page directory records have bounded live listeners (UID chunks of 30)
using the administrator-only read rule in `admin-directory.rules.fragment`.
New records and changes outside the page are picked up every 30 seconds while the
tab is visible, on returning to the tab, or using Refresh. Account management
also synchronizes its directory entry before responding, with the source
trigger retrying if that synchronization fails. Page queries use the admin-only
callable; directory listeners read only the current page directly. Client
writes to all derived collections remain denied.
These server-owned collections (`adminDirectory`, `adminDirectoryCategories`,
`adminDirectoryMeta`) must not allow client writes or non-admin reads in the
project's existing rules. Check this before the backfill; a permissive recursive
allow rule also applies to new collections and cannot be overridden by adding
a narrower deny rule. This repository does not contain the project's current
rules, so index deployment deliberately does not replace them.

### Rollout order

1. Install the existing function dependencies (`npm ci` inside `functions`). The
   functions use Node.js 22. Merge `admin-directory.rules.fragment` inside the
   existing database-document match and deploy the combined rules, preserving
   the project's other rules. The fragment grants directory reads only to
   administrators; it is not a replacement for the complete rules file.
2. Deploy the indexes and directory functions **before** publishing the frontend:

   ```sh
   firebase deploy --only firestore:indexes --project stallseeker-c2ffe
   firebase deploy --only functions:getAdminDirectoryPage,functions:syncAdminUserDirectory,functions:syncAdminVendorDirectory,functions:adminUserAction --project stallseeker-c2ffe --force
   ```

   Keep these commands separate: `--force` accepts the new functions' reviewed
   retry policy, but must not be applied to the index deployment because the
   project has other indexes and field overrides maintained outside this repo.
   The sync triggers run beside the database in `asia-southeast1`; the callable
   and existing account action remain in `us-central1`.
   Wait until the new indexes finish building in the Firebase console.

3. Run the one-time backfill using Application Default Credentials with access
   to the intended Firebase project (the Firebase CLI login alone does not
   supply these credentials). From PowerShell at the repository root:

   ```powershell
   $env:GOOGLE_CLOUD_PROJECT = "stallseeker-c2ffe"
   node functions/scripts/rebuild-admin-directory.cjs
   ```

   The backfill reads source profiles in batches of 100 and synchronizes at most
   five UIDs concurrently. It does not modify source profiles. It is idempotent;
   use `--resume` after an interruption. Keep the source triggers deployed while
   it runs so new/updated/deleted profiles are covered. It marks
   `adminDirectoryMeta/state` ready only after all batches succeed. Until then,
   the new frontend shows a directory-unavailable message rather than a
   misleading empty list. The old frontend continues to work during rollout.

4. Publish the frontend with the normal Hosting deployment.

Verify locally with `npm run test:directory`, `npm run test:pagination`, and
`npm run build`. The directory tests cover read budgets, records beyond 500,
substring filtering, cursor validation/deletion, legacy dates, duplicate UIDs,
idempotent synchronization, index coverage, and administrator access checks.

## Vendor email lookup

The admin app calls `getVendorEmails` in `us-central1` when a vendor's Firestore
record does not contain an email address. The callable reads email addresses
from Firebase Authentication; it does not write them to Firestore.

The signed-in caller must have a `users/{uid}` Firestore document whose
`role`, `userRole`, or `type` field is `admin`. Vendor document IDs must match
the vendor's Firebase Authentication UID for the email lookup to succeed.

Install the Firebase CLI if needed, then deploy the function to the configured
StallSeeker project:

```sh
firebase deploy --only functions:getVendorEmails --project stallseeker-c2ffe
```
