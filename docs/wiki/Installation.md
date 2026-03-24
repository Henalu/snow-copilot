# Installation

## Option A: Chrome Web Store

Publishing is planned, but local installation is currently the main workflow.

## Option B: Load unpacked

1. Clone the repository:

```bash
git clone https://github.com/Henalu/snow-copilot.git
```

2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root

## After installation

1. Open the extension **Options**
2. Configure at least one provider
3. Optionally configure:
   - preferred response language
   - RAG
   - Update Set documentation mode
4. Save settings

## Reloading after local changes

After changing extension files:

1. Go to `chrome://extensions`
2. Reload SN Assistant
3. Refresh the open ServiceNow tab

That final page refresh matters, especially after changes to `content.js` or `service-worker.js`.

## Updating a local copy

Pull the latest changes:

```bash
git pull origin main
```

Then reload the extension and refresh your ServiceNow tabs.
