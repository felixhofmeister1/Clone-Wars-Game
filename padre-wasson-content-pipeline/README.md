# Padre Wasson Foundation – Content Pipeline

A single-file web app (`index.html`) that turns raw notes, bullet points or meeting transcripts into a complete content campaign:

- **WordPress blog post**: title, excerpt, H2 sections, call to action
- **Social captions**: LinkedIn (professional, 3 hashtags), Facebook (warm, community), Google Business Profile (2 sentences)
- **Mailchimp newsletter**: subject line, preview text, body, button text, plus a copy-ready HTML email with Mailchimp merge tags
- **German / English**: generate one language or both, switch with the DE/EN toggle, and add a missing language later with one click

Every output can be edited inline and copied. The blog post can be sent to WordPress as a draft via the REST API (`/wp-json/wp/v2/posts`) using an Application Password.

This app is separate from the Clone Wars game in the rest of this repository.

## Running it

Open `index.html` in a browser, or serve the folder with any static web server. There is no build step. Tailwind CSS, fonts and the Anthropic SDK load from CDNs.

## Generation engines

Switch engines in **Settings** (the sliders icon in the header).

| Engine | What it does |
|---|---|
| **Simulated** (default) | Works offline. It analyzes the notes (facts, figures, quotes, next steps, theme) and fills localized templates. It does not translate the facts themselves: German notes stay German inside English templates, and a notice says so. |
| **Claude API** | Real AI writing and translation through the official Anthropic TypeScript SDK with structured JSON output. Default model: Claude Opus 5, with server-side refusal fallback enabled. Claude Sonnet 5 is also available. |

**API key security:** in Claude API mode the browser calls the API directly, so the key is visible to anyone who can use the page on that device. It is kept in memory unless you tick "Remember". For shared or public deployments, set **API base URL** to your own server-side proxy that adds the key, and leave the key field empty.

## WordPress export

1. In WordPress, go to **Users → Profile → Application Passwords** (WordPress 5.6+) and create a password.
2. Enter the site URL, your username and that password in step 4. Then click **Test connection** and **Export Draft to WordPress**.
3. Pick the status (draft, pending, private), the language (current, DE, EN, or both as two drafts) and the format: Gutenberg blocks or classic HTML.

The site must use HTTPS, and the user needs at least the Author role. If a security plugin or CORS policy blocks requests from the browser, **Copy as cURL** gives you an equivalent terminal command. The password is never stored. The site URL and username are only saved if you tick "Remember".

## Data storage

Notes, generated outputs and settings are saved in this browser's `localStorage`. **Settings → Clear saved data** removes them.
