# Unified Inbox

**Open source unified inbox for WhatsApp, Instagram, Messenger, Telegram, X (Twitter), Reddit, and Bluesky.** A WhatsApp Web-style chat UI for all your social DMs, built on the [Zernio API](https://zernio.com).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fzernio-dev%2Funified-inbox&env=ZERNIO_API_KEY&envDescription=Your%20Zernio%20API%20key&envLink=https%3A%2F%2Fzernio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Unified Inbox, light mode](https://cdn.jsdelivr.net/gh/zernio-dev/unified-inbox@main/assets/screenshot-light.png)

<details>
<summary>Dark mode and mobile</summary>

![Unified Inbox, dark mode](https://cdn.jsdelivr.net/gh/zernio-dev/unified-inbox@main/assets/screenshot-dark.png)

<img src="https://cdn.jsdelivr.net/gh/zernio-dev/unified-inbox@main/assets/screenshot-mobile.png" width="390" alt="Unified Inbox, mobile" />

</details>

## Features

- **One inbox, seven platforms.** WhatsApp, Instagram, Messenger, Telegram, X, Reddit, and Bluesky conversations in a single list, with platform filters and search.
- **Full WhatsApp messaging.** Templates with variable preview, interactive buttons, lists, CTA links, WhatsApp Flows, location and contact cards, voice notes recorded in the browser, reactions, and quoted replies.
- **24-hour window enforcement.** Outside WhatsApp's customer service window the composer switches to approved templates automatically.
- **Read receipts and delivery ticks.** Sent, delivered, read (blue ticks), failed with the platform's error message, plus optimistic sending states.
- **Start conversations.** New outbound DMs on X, Bluesky, Reddit, and WhatsApp (template-based).
- **Rich message rendering.** Photos, videos, voice messages, files, stickers, shared posts, story replies, edits with history, deleted-message indicators.
- **Block and unblock** WhatsApp contacts from the thread.
- **WhatsApp Business Calling** dial pad (optional, behind a flag).
- **Light and dark mode**, fully responsive, real-time via polling.
- **Stateless by design.** No database. Your Zernio API key is the only configuration, and it never reaches the browser.

## Quickstart

1. **Get an API key.** Create an account at [zernio.com](https://zernio.com), connect your social accounts, and copy an API key from the dashboard.
2. **Clone and install:**

```bash
git clone https://github.com/zernio-dev/unified-inbox
cd unified-inbox
npm install
```

3. **Configure:**

```bash
cp .env.example .env.local
# set ZERNIO_API_KEY=sk_... in .env.local
```

4. **Run:**

```bash
npm run dev
# open http://localhost:4100
```

Or click the **Deploy with Vercel** button above and paste your API key when prompted.

## Environment variables

```bash
# Required. Get yours from the Zernio dashboard.
ZERNIO_API_KEY=

# Optional. Defaults to https://zernio.com/api
# ZERNIO_API_URL=

# Optional. Set to 'true' to enable the WhatsApp Business Calling dial pad.
# NEXT_PUBLIC_WHATSAPP_CALLING_ENABLED=
```

## Security note

This app has **no authentication layer of its own**. Anyone who can reach your deployment can read and send messages through your API key. Run it locally, deploy it behind your own auth (for example Vercel Deployment Protection), or keep the URL private.

## How it works

A stateless Next.js 15 app. Server-side proxy routes attach your `ZERNIO_API_KEY` and forward to the Zernio API, so the key never ships to the browser. React Query polls the conversation list every 10 seconds and the open thread every 5 seconds, with optimistic sends and automatic backoff when rate limited. Which accounts to track is stored in a cookie. There is nothing else to operate: no database, no workers, no webhooks.

Built with Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, and TanStack Query.

## API documentation

Everything this app does is available as a REST API: [docs.zernio.com](https://docs.zernio.com). Conversations, messages, templates, broadcasts, contacts, webhooks, and more.

## Contributing

Issues and PRs welcome. Keep it simple.

## License

[MIT](LICENSE)

<p align="center">
  <a href="https://zernio.com">
    <img src="https://zernio.com/brand/powered-by-zernio.svg" alt="Powered by Zernio" width="180">
  </a>
</p>
