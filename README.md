# SN Assistant

AI assistant for ServiceNow developers. Explain, comment, refactor and query scripts directly from your browser.

## Project Structure

```
sn-assistant/
├── extension/          ← Chrome Extension (MV3)
│   ├── manifest.json
│   ├── content.js      ← Detects CodeMirror, injects sidebar
│   ├── sidebar.css     ← Panel styles
│   ├── service-worker.js
│   ├── options.html    ← Settings page
│   └── options.js
├── api/
│   └── chat.js         ← Vercel Edge Function
├── prompts/
│   └── prompts.js      ← Prompt templates (reference)
├── package.json
└── README.md
```

## Setup

### 1. Deploy backend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From project root
vercel deploy

# Set environment variable in Vercel dashboard:
# ANTHROPIC_API_KEY = sk-ant-...
```

### 2. Load extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 3. Configure the extension

1. Click the extension icon → **Options**
2. Set your **Vercel Function URL** (e.g. `https://your-project.vercel.app`)
3. Toggle **Auto-show panel** as preferred
4. Save

## Usage

1. Navigate to any ServiceNow script editor (Business Rule, Script Include, Fix Script, Background Script)
2. The panel appears automatically on the right side
3. Choose an action:
   - **Explain** — understand what the script does
   - **Comment** — add JSDoc and inline comments
   - **Refactor** — improve code following best practices
   - **Ask** — ask a specific question about the script

## Supported Contexts

- Business Rules (`sys_script`)
- Script Includes (`sys_script_include`)
- UI Actions (`sys_ui_action`)
- UI Scripts (`sys_ui_script`)
- Fix Scripts (`sys_script_fix`)
- Background Scripts

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (Vercel only, never in extension) |
