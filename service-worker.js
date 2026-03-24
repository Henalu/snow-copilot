// SN Assistant — service-worker.js
// Initializes defaults on install/update, relays sidebar toggle messages,
// and streams AI provider responses to content scripts via ports.

import { migrateSettings } from './storage/schema.js';
import { prepareActionExecution } from './providers/manager.js';

const BACKGROUND_ONLY_ACTIONS = new Set(['documentUpdateSet']);
const BUFFERED_PROGRESS_INTERVAL_MS = 3000;
const BUFFERED_PROGRESS_CHAR_STEP = 600;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  const settings = migrateSettings(stored);

  await chrome.storage.sync.set({
    autoShow: settings.autoShow,
    preferredLanguage: settings.preferredLanguage,
    changeDocumentation: settings.changeDocumentation,
    providers: settings.providers,
    routing: settings.routing,
    rag: settings.rag
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' });
      }
    });
  }
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  let cancelled = false;
  port.onDisconnect.addListener(() => { cancelled = true; });

  port.onMessage.addListener(async ({ action, code, question, context }) => {
    const requestStartedAt = Date.now();
    let currentPhase = 'start';
    let outputChars = 0;
    let chunkCount = 0;
    let lastProgressAt = requestStartedAt;
    let lastProgressChars = 0;

    const postProgress = (payload = {}) => {
      if (cancelled) return;
      port.postMessage({
        type: 'progress',
        elapsedMs: Date.now() - requestStartedAt,
        ...payload
      });
    };

    try {
      currentPhase = 'prepare';
      postProgress({
        phase: 'prepare',
        label: 'Preparing model request',
        message: 'Preparing grounded prompt...'
      });

      const execution = await prepareActionExecution({ action, code, question, context });
      const shouldBufferResponse = BACKGROUND_ONLY_ACTIONS.has(action);
      const bufferedChunks = [];

      if (!cancelled) {
        port.postMessage({ type: 'label', label: execution.label });
        if (!shouldBufferResponse) {
          port.postMessage({ type: 'retrieval', retrieval: execution.rag });
        }
      }

      currentPhase = 'request';
      postProgress({
        phase: 'request',
        label: 'Prompt prepared',
        message: shouldBufferResponse ? 'Waiting for model response...' : 'Starting generation...',
        meta: execution.diagnostics || null
      });

      let firstChunkSeen = false;
      for await (const chunk of execution.stream) {
        if (cancelled) break;
        chunkCount += 1;
        outputChars += chunk.length;

        if (!firstChunkSeen) {
          firstChunkSeen = true;
          currentPhase = 'generation';
          lastProgressAt = Date.now();
          lastProgressChars = outputChars;
          postProgress({
            phase: 'generation',
            label: 'Model started responding',
            message: shouldBufferResponse ? 'Generating update set documentation...' : 'Streaming response...',
            meta: {
              firstChunkChars: chunk.length,
              chunkCount,
              outputChars
            }
          });
        }

        if (shouldBufferResponse) {
          bufferedChunks.push(chunk);
          const now = Date.now();
          if (
            now - lastProgressAt >= BUFFERED_PROGRESS_INTERVAL_MS ||
            outputChars - lastProgressChars >= BUFFERED_PROGRESS_CHAR_STEP
          ) {
            lastProgressAt = now;
            lastProgressChars = outputChars;
            postProgress({
              phase: 'generation',
              label: 'Generation in progress',
              message: 'Generating update set documentation...',
              meta: {
                chunkCount,
                outputChars
              }
            });
          }
        } else {
          port.postMessage({ type: 'chunk', chunk });
        }
      }

      if (!cancelled) {
        currentPhase = 'complete';
        postProgress({
          phase: 'complete',
          label: 'Generation complete',
          message: shouldBufferResponse ? 'Preparing final output...' : 'Finalizing response...',
          meta: {
            outputChars,
            chunkCount
          }
        });
        port.postMessage(
          shouldBufferResponse
            ? { type: 'done', fullText: bufferedChunks.join('') }
            : { type: 'done' }
        );
      }
    } catch (err) {
      if (!cancelled) {
        postProgress({
          phase: 'error',
          label: 'Action failed',
          message: 'The action failed before completion.',
          meta: {
            phase: currentPhase,
            outputChars,
            error: err.message
          }
        });
        port.postMessage({ type: 'error', message: err.message });
      }
    }
  });
});
