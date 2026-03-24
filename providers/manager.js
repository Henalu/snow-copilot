// providers/manager.js — Provider resolver and action router

import { anthropicProvider }      from './anthropic.js';
import { openaiProvider }         from './openai.js';
import { geminiProvider }         from './gemini.js';
import { openrouterProvider }     from './openrouter.js';
import { customEndpointProvider } from './customEndpoint.js';
import { localLlmProvider }       from './localLlm.js';
import { PROVIDER_META }          from './catalog.js';
import { buildPrompt }            from './prompts.js';
import { buildRagContext }        from '../rag/engine.js';
import { loadSettings }           from '../storage/schema.js';
import { buildChangeDocumentationBrief, serializeChangeDocumentationBrief } from '../change-documentation/planner.js';

const PROVIDERS = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  customEndpoint: customEndpointProvider,
  localLlm: localLlmProvider
};

const ACTION_PROVIDER_ALIASES = {
  documentUpdateSet: 'document'
};

function buildSkippedRagContext(reason) {
  return {
    enabled: false,
    strategy: 'skipped',
    activeSourceIds: [],
    selectedChunks: [],
    trace: {
      strategy: 'skipped',
      reason,
      totalCandidates: 0
    }
  };
}

export function getProvider(id) {
  return PROVIDERS[id] ?? null;
}

export async function resolveProvider(action, settings = null) {
  const currentSettings = settings || await loadSettings();
  const { providers, routing } = currentSettings;
  const providerAction = ACTION_PROVIDER_ALIASES[action] || action;

  let providerId = null;
  let modelId = null;

  if (routing.actionRouting?.enabled) {
    const actionConfig = routing.actionRouting.actions?.[providerAction];
    if (actionConfig?.providerId) {
      providerId = actionConfig.providerId;
      modelId = actionConfig.modelId || null;
    }
  }

  if (!providerId && routing.defaultProvider) {
    providerId = routing.defaultProvider;
  }

  if (!providerId) {
    for (const id of Object.keys(PROVIDERS)) {
      const config = providers[id];
      if (config && PROVIDERS[id]?.isConfigured(config)) {
        providerId = id;
        break;
      }
    }
  }

  if (!providerId) {
    throw new Error('No AI provider configured. Open extension settings to add a provider.');
  }

  const provider = PROVIDERS[providerId];
  const providerConfig = providers[providerId];

  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  if (!provider.isConfigured(providerConfig)) {
    throw new Error(
      `Provider "${providerId}" is enabled but not properly configured. Check extension settings.`
    );
  }

  return { provider, providerConfig, modelId, providerId };
}

function formatProviderLabel({ providerId, modelId, providerConfig }) {
  const name = PROVIDER_META[providerId]?.name ?? providerId;
  const model = modelId || providerConfig?.model || '';
  return model ? `${name} — ${model}` : name;
}

export async function prepareActionExecution({ action, code, question, context }) {
  const settings = await loadSettings();
  const { provider, providerConfig, modelId, providerId } = await resolveProvider(action, settings);
  const packageBrief = action === 'documentUpdateSet' && context?.packageData
    ? buildChangeDocumentationBrief({
        mode: 'documentUpdateSet',
        packageMeta: context.packageData.meta,
        updates: context.packageData.customerUpdates,
        userContext: context.packageData.userContext,
        questionnaire: context.packageData.questionnaire
      })
    : null;
  const effectiveCode = packageBrief ? serializeChangeDocumentationBrief(packageBrief) : code;
  const effectiveContext = packageBrief
    ? { ...context, packageStats: packageBrief.stats, inferredPurpose: packageBrief.inferredPurpose }
    : context;
  const rag = action === 'documentUpdateSet'
    ? buildSkippedRagContext('RAG skipped for update-set documentation to keep the flow responsive.')
    : await buildRagContext({
        action,
        code: effectiveCode,
        question,
        context: effectiveContext,
        settings
      });
  const prompt = buildPrompt(action, effectiveCode, effectiveContext, question, {
    rag,
    packageBrief,
    responseLanguage: settings.preferredLanguage
  });

  if (settings.rag?.debug) {
    console.debug('[SN Assistant][RAG]', {
      action,
      providerId,
      selectedChunks: rag.selectedChunks?.map((chunk) => ({
        title: chunk.title,
        heading: chunk.heading,
        score: chunk.score
      })),
      trace: rag.trace
    });
  }

  return {
    stream: provider.sendPrompt({
      action,
      code: effectiveCode,
      question,
      context: effectiveContext,
      config: providerConfig,
      model: modelId,
      prompt,
      rag
    }),
    rag,
    diagnostics: {
      action,
      providerId,
      modelId: modelId || providerConfig?.model || '',
      ragEnabled: !!rag?.enabled,
      ragReason: rag?.trace?.reason || '',
      effectiveCodeChars: effectiveCode?.length || 0,
      promptSystemChars: prompt?.system?.length || 0,
      promptUserChars: prompt?.user?.length || 0,
      promptTotalChars: (prompt?.system?.length || 0) + (prompt?.user?.length || 0),
      responseLanguage: settings.preferredLanguage || 'en',
      updateCount: packageBrief?.stats?.updateCount ?? null,
      groupCount: packageBrief?.stats?.groupCount ?? null,
      userContextChars: context?.packageData?.userContext?.length ?? 0
    },
    label: formatProviderLabel({ providerId, modelId, providerConfig }),
    providerId,
    modelId
  };
}

export async function resolveProviderLabel(action) {
  try {
    const settings = await loadSettings();
    return formatProviderLabel(await resolveProvider(action, settings));
  } catch {
    return 'Not configured';
  }
}
