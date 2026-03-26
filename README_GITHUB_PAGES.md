# NTPORT GitHub Pages Deployment

This repository now includes a static GitHub Pages-compatible build.

## Publish steps

1. Push this branch to GitHub.
2. In repository settings, open **Pages**.
3. Set source to **Deploy from a branch**.
4. Select your branch and root folder (`/`).
5. Save, then open your Pages URL.

## Entry points

- `index.html` (landing)
- `login.html`
- `signup.html`
- `dashboard.html` (protected in-browser demo)
- `profile.html` (protected in-browser demo)
- `settings.html` (protected in-browser demo)

## Auth behavior

For GitHub Pages compatibility, auth/session is implemented as a frontend demo using `localStorage` in `static/app.js`.
