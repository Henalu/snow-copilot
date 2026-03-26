# Installation

## Public release channels

SN Assistant is being prepared for public distribution through:

- Chrome Web Store
- Microsoft Edge Add-ons

Those listings are the intended install path for general users.

## Local development or pre-release install

1. Clone the repository:

```bash
git clone https://github.com/Henalu/snow-copilot.git
```

2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root

## After installation

1. Open SN Assistant from the browser toolbar
2. If you are not on a ServiceNow page, the toolbar action opens **Options**
3. Configure at least one provider
4. Optionally configure:
   - preferred response language
   - RAG
   - Update Set documentation mode
5. Save settings

## Using the toolbar action

- On a supported ServiceNow page, the toolbar action toggles the assistant sidebar
- Outside ServiceNow, the toolbar action opens the options page

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
