# Configuration

Open the extension settings by clicking the SN Assistant icon → **Options**.

---

## AI Providers

You can enable one or more providers. If multiple are enabled, you can configure routing rules to assign different providers to different actions.

### Anthropic Claude

Best overall for code tasks. Recommended model: **Claude Sonnet 4.6**.

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. In Options → AI Providers → enable **Anthropic Claude**
3. Paste your API key
4. Select a model:
   - **Claude Opus 4.6** — highest quality, higher cost
   - **Claude Sonnet 4.6** — recommended balance of quality and cost
   - **Claude Haiku 4.5** — fastest and cheapest

---

### OpenAI

1. Get an API key at [platform.openai.com](https://platform.openai.com)
2. Enable **OpenAI** in Options
3. Paste your API key
4. Select a model:
   - **GPT-4.1** — premium quality
   - **GPT-4o** — high quality, good balance
   - **GPT-4o Mini** — recommended for most tasks
   - **GPT-4.1 Mini** — fastest and cheapest

**Custom Base URL (optional):** If you use Azure OpenAI or a compatible API, set the base URL here.

---

### Google Gemini

1. Get an API key at [aistudio.google.com](https://aistudio.google.com)
2. Enable **Google Gemini** in Options
3. Paste your API key
4. Select a model:
   - **Gemini 2.5 Pro** — premium
   - **Gemini 2.5 Flash** — balanced
   - **Gemini 2.0 Flash** — recommended, fast and cost-effective

---

### OpenRouter

Gives you access to Claude, GPT, Gemini, Llama, Mistral, and 100+ other models through a single API key. Good option if you want to try many models without signing up for multiple services.

1. Create an account at [openrouter.ai](https://openrouter.ai) and get an API key
2. Enable **OpenRouter** in Options
3. Paste your API key
4. Enter a model ID (find them at [openrouter.ai/models](https://openrouter.ai/models))
   - Example: `anthropic/claude-sonnet-4-6`
   - Example: `openai/gpt-4o-mini`
   - Example: `meta-llama/llama-3.3-70b-instruct`

---

### Custom Endpoint

Point the extension to your own backend proxy instead of calling AI providers directly. Useful if you want to:
- Keep API keys server-side
- Add your own rate limiting or logging
- Use the included Vercel backend (`api/chat.js`)

1. Enable **Custom Endpoint** in Options
2. Enter your endpoint URL (e.g. `https://your-project.vercel.app`)
3. Optionally set a bearer token and model override
4. Your endpoint must accept `POST /api/chat` with the request body in the SN Assistant format

---

### Local LLM (Ollama / LM Studio)

Run AI models locally on your machine — no API key, no data sent externally.

**Using Ollama:**

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2` or `ollama pull codellama`
3. Enable **Local LLM** in Options
4. Set Base URL to `http://localhost:11434` (default)
5. Enter the model name (e.g. `llama3.2`, `codellama`, `mistral`)

**Using LM Studio:**

1. Download [LM Studio](https://lmstudio.ai) and start its local server
2. Set Base URL to `http://localhost:1234`
3. Enter the model name as shown in LM Studio

> **Note:** Local models are slower than cloud APIs and may produce lower-quality results for complex code tasks. They are marked as "Experimental".

---

## Routing

By default, all actions use the **default provider** you select.

**Action-based routing** lets you assign a different provider and model to each action. For example:
- Use Anthropic Claude Opus for **Document** (high quality, complex task)
- Use Claude Haiku for **Explain** (fast and cheap)

### Smart Defaults

The recommendation engine analyzes your enabled providers and suggests the best provider + model per action based on cost, quality, and latency tiers.

- Click **Apply recommended setup** to apply suggestions for all actions marked as **Auto**
- Actions marked as **Custom** keep your manual selection even after recalculating
- Click **Reset to recommended** on any individual action to revert it

---

## Data & Privacy

- API keys are stored in `chrome.storage.sync` — they sync across your Chrome profile but never leave your browser except when making API calls to your chosen provider
- Export your settings as JSON for backup: Options → Data → **Export settings**
- Import a backup: Options → Data → **Import settings**
