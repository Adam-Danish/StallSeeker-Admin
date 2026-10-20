# Vendor email lookup

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
