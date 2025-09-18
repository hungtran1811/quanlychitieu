# Expense Manager Skeleton (Bootstrap + Firebase)

This is a minimal skeleton for a 4+ member expense manager built with HTML/CSS/JS (Bootstrap 5) and Firebase (Auth).

## Setup
1. Open `public/config/firebase.config.js` and replace placeholders with your **Firebase config** and **ADMIN UID**.
2. Serve `public/` with a static server (e.g., Live Server) or deploy to Netlify/Firebase Hosting.

## Netlify Deploy
- `netlify deploy --prod --dir=public`

## Files
- `public/index.html` — base layout, Bootstrap, Google Font (Exo), login/logout buttons
- `public/config/firebase.config.js` — Put your Firebase keys & admin UID here
- `public/js/firebase.js` — Initialize Firebase & export `auth`
- `public/js/auth.js` — Google Sign-In, Sign-Out, Auth state UI handling
- `public/js/ui.js` — simple toast helper
- `public/css/custom.css` — minimal styles
