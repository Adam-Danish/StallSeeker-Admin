# Admin services

## History pagination

The admin dashboard displays users, vendors, bookings, and activity in pages of
10, 25, or 50 records, with date/name sorting and matching record counts. Search,
filter, sort, and page-size changes return to page 1. Live user/vendor listeners
remain unchanged; deleting records clamps the selected page to the last page.

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
