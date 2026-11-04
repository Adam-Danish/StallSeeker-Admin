# StallSeeker Admin

Admin dashboard for StallSeeker.

## Run locally

```sh
npm ci
npm run dev
```

## Deploy to Firebase Hosting

Pushes to `main` deploy the history services and then the production Hosting site
through GitHub Actions. Before the first automated deployment, add a repository
Actions secret named `FIREBASE_SERVICE_ACCOUNT` containing the JSON key for a
service account with permission to deploy Firebase Functions and Hosting to
project `stallseeker-c2ffe`. Publishing history services first keeps the history
pages compatible with their backend pagination contract.

To deploy manually from an authenticated local Firebase CLI session:

```sh
npm run deploy
```

Install function dependencies with `npm ci --prefix functions` before deploying
for the first time. The deployment publishes the booking/activity history
services before Hosting. To update only those services, run `npm run deploy:history`.

Before deploying the paginated Users/Vendors screens for the first time, follow
the [directory service rollout](functions/README.md#user-and-vendor-directory-pagination)
to deploy its Firebase indexes/functions and backfill existing accounts.
