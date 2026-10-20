# GraySparks Offer Generator

A small web app that turns Airtasker task screenshots into a tailored offer
message draft for GraySparks Ltd. Drafting guidance and approved experience
claims live in [CLAUDE.md](./CLAUDE.md); [compliance.js](./compliance.js)
checks generated text against the key message restrictions.

## Run locally

Requirements: Node.js and an Anthropic API key.

1. Install dependencies with `npm install`.
2. Set `ANTHROPIC_API_KEY` in the environment. `PORT` is optional and defaults
   to `3000`.
3. Start the app with `npm start`, then open `http://localhost:3000`.

Upload up to five task screenshots (PNG, JPEG, GIF or WebP). Each file may be up to 10 MB. The
generator returns a draft and the compliance checker reports any detected
issues in the interface.

## Checks

Run the compliance tests with `npm test`.

The compliance result is a useful check, not a guarantee that the message is
accurate or suitable. Review every draft before use. The app only drafts and
copies messages; it does not post offers automatically.
