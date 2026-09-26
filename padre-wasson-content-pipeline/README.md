# Padre Wasson Foundation – Content Studio

A single-file web app (`index.html`) that turns notes, photos and documents into a complete content campaign:

- **WordPress blog post**: title, excerpt, H2 sections and a call to action, plus a featured image and a photo gallery
- **Social captions**: LinkedIn (professional, 3 hashtags), Facebook (warm, community), Google Business Profile (2 sentences), each with a suggested photo to download
- **Mailchimp newsletter**: subject line, preview text, body and button text, plus copy-ready HTML email in your brand colors with Mailchimp merge tags
- **German / English**: generate one language or both, switch with the DE/EN toggle, and add a missing language later with one click

Every output can be edited inline and copied.

This app is separate from the Clone Wars game in the rest of this repository.

## Running it

Open `index.html` in a browser, or serve the folder with any static web server. There is no build step. Tailwind CSS, fonts, the PDF and Word readers and the Anthropic SDK load from CDNs when needed.

## Photos & files

Drop anything into step 1: photos, PDFs, Word files (.docx), text files, videos, or whole folders. You can also pick many files at once or paste an image with Ctrl+V.

- **Selection:** every added file is selected automatically. Click a file to leave it out; the checkbox selects or clears all at once.
- **Featured image:** the first photo becomes the featured image. Click the star on another photo to change it.
- **Reading:** text is read from PDFs, Word and text files and used as source material.
- **Storage:** files are kept in the browser (IndexedDB), so they are still there after a reload.
- **Alt text:** each photo gets alt text, which you can edit under "Alt text & captions" in the blog tab. The Claude engine writes it from what is actually in the photo; the simulated engine derives it from the file name.

## Branding

In **Settings → Brand look**, upload the foundation's logo. The app shows it in the header and takes its main and accent colors from it automatically.

You can also pick a preset or enter exact hex codes. The colors are used throughout the app and in the exported newsletter HTML.

## Generation engines

Switch engines in **Settings** (the sliders icon in the header).

| Engine | What it does |
|---|---|
| **Simulated** (default) | Works offline. It analyzes the notes and documents (facts, figures, quotes, next steps, theme) and fills localized templates. It does not translate the facts themselves: German notes stay German inside English templates, and a notice says so. |
| **Claude API** | Real AI writing and translation through the official Anthropic TypeScript SDK with structured JSON output. Claude sees up to 20 photos and reads PDFs natively. Default model: Claude Opus 5, with server-side refusal fallback enabled. Claude Sonnet 5 is also available. |

**API key security:** in Claude API mode the browser calls the API directly, so the key is visible to anyone who can use the page on that device. It is kept in memory unless you tick "Remember". For shared or public deployments, set **API base URL** to your own server-side proxy that adds the key, and leave the key field empty.

## WordPress export

1. In WordPress, go to **Users → Profile → Application Passwords** (WordPress 5.6+) and create a password.
2. Enter the site URL, your username and that password in step 4, then click **Export**.

One click does everything:

- **Uploads:** all selected files go to the Media Library in parallel (up to 6 at a time), with a progress bar per file. Files already uploaded to that site are not uploaded again.
- **Drafts:** one draft per generated language, with the starred photo as the featured image and the other photos and videos as a gallery before the call to action.
- **Options:** status (draft, pending, private), format (Gutenberg blocks or classic HTML) and download links for documents.

The site must use HTTPS, and the user needs at least the Author role. If a security plugin or CORS policy blocks requests from the browser, **Copy as cURL** gives you equivalent terminal commands. The password is never stored.

## Data storage

Notes, files, generated outputs and settings are saved in this browser only (`localStorage` and IndexedDB). **Settings → Clear saved data** removes them.
