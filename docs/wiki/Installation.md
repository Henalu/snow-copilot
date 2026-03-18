# Installation

## Option A — Chrome Web Store

> Coming soon. Once published, click **Add to Chrome** on the store listing.

---

## Option B — Load Unpacked (Developer Mode)

Use this if the extension is not yet on the Chrome Web Store, or if you want to run a local copy.

### Requirements

- Google Chrome (version 120 or later recommended)
- A GitHub account (to download the repo)

### Steps

1. **Download the extension**

   Clone the repository or download it as a ZIP:

   ```bash
   git clone https://github.com/Henalu/snow-copilot.git
   ```

   If you downloaded a ZIP, extract it to a folder.

2. **Open Chrome Extensions**

   Navigate to `chrome://extensions` in your browser.

3. **Enable Developer Mode**

   Toggle **Developer mode** in the top-right corner of the Extensions page.

4. **Load the extension**

   Click **Load unpacked** → select the repo folder (the one that contains `manifest.json`).

5. **Pin it (optional but recommended)**

   Click the puzzle piece icon (🧩) in the Chrome toolbar → find **SN Assistant** → click the pin icon to keep it visible.

---

## After Installation

1. Click the **SN Assistant icon** in the Chrome toolbar
2. Click **Options** (or right-click → Options)
3. Configure at least one AI provider — see [Configuration](Configuration)
4. Click **Save settings**

The extension is now ready to use in ServiceNow.

---

## Updating

If you installed via **Load unpacked**, updates require manually pulling the latest code and reloading the extension:

```bash
git pull origin main
```

Then go to `chrome://extensions` → SN Assistant → click the **refresh icon** (↻).

---

## Uninstalling

Go to `chrome://extensions` → SN Assistant → **Remove**.

Your settings (API keys, routing preferences) are stored in `chrome.storage.sync` and will be deleted when the extension is removed.
