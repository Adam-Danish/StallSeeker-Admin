# StallSeeker Admin

Admin dashboard for StallSeeker.

## Run locally

```sh
npm ci
npm run dev
```

## Deploy to Firebase Hosting

Pushes to `main` deploy the production Hosting site through GitHub Actions. Before the first automated deployment, add a repository Actions secret named `FIREBASE_SERVICE_ACCOUNT` containing the JSON key for a service account with permission to deploy Firebase Hosting to project `stallseeker-c2ffe`.

To deploy manually from an authenticated local Firebase CLI session:

```sh
npm run deploy
```
