export const CHANGE_DOCUMENTATION_ACTIONS = {
  updateSet: 'documentUpdateSet',
  solution: 'documentSolution'
};

export const CHANGE_DOCUMENTATION_SOURCES = {
  updateSetForm: 'update_set_form',
  customerUpdateList: 'customer_update_list',
  customerUpdateSelection: 'customer_update_selection',
  xmlExport: 'xml_export'
};

export const CHANGE_DOCUMENTATION_QUESTIONNAIRE = [
  {
    id: 'functionalSummary',
    label: 'Functional summary',
    type: 'textarea',
    placeholder: 'What business problem or process does this package solve?'
  },
  {
    id: 'targetAudience',
    label: 'Target audience',
    type: 'select',
    options: ['technical', 'mixed', 'functional']
  },
  {
    id: 'technicalDepth',
    label: 'Technical depth',
    type: 'select',
    options: ['summary', 'balanced', 'deep']
  },
  {
    id: 'tone',
    label: 'Tone',
    type: 'select',
    options: ['internal-delivery', 'handover', 'executive-friendly']
  },
  {
    id: 'knownConstraints',
    label: 'Known constraints',
    type: 'textarea',
    placeholder: 'Known tradeoffs, decisions, limitations, or rollout notes'
  }
];

export const CHANGE_GROUP_DEFINITIONS = [
  {
    id: 'data_model',
    label: 'Data model',
    hints: ['sys_db_object', 'sys_dictionary', 'sys_choice', 'dictionary', 'table']
  },
  {
    id: 'server_logic',
    label: 'Server logic',
    hints: ['sys_script', 'sys_script_include', 'business rule', 'script include', 'fix script', 'sys_script_fix']
  },
  {
    id: 'client_experience',
    label: 'Client and workspace UX',
    hints: ['sys_script_client', 'sys_ui_action', 'sys_ui_script', 'workspace', 'ui builder', 'declarative action']
  },
  {
    id: 'integration',
    label: 'Integrations and APIs',
    hints: ['sys_ws_operation', 'rest', 'soap', 'integration', 'import', 'transform']
  },
  {
    id: 'automation',
    label: 'Automation and orchestration',
    hints: ['flow', 'subflow', 'action', 'schedule', 'sysauto_script']
  },
  {
    id: 'security',
    label: 'Security and access',
    hints: ['acl', 'role', 'sys_security_acl', 'group']
  },
  {
    id: 'configuration',
    label: 'Configuration and platform setup',
    hints: ['property', 'module', 'menu', 'application', 'config']
  }
];

export function normalizeQuestionnaireAnswers(input = {}) {
  const result = {};

  for (const item of CHANGE_DOCUMENTATION_QUESTIONNAIRE) {
    const rawValue = input[item.id];
    result[item.id] = typeof rawValue === 'string' ? rawValue.trim() : (rawValue ?? '');
  }

  return result;
}

export function normalizeCustomerUpdateRecord(raw = {}) {
  const fieldSummary = Array.isArray(raw.fieldSummary)
    ? raw.fieldSummary.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  return {
    sysId: raw.sysId || raw.sys_id || '',
    name: raw.name || raw.displayValue || raw.targetName || '',
    type: raw.type || raw.documentKey || raw.targetTable || '',
    targetTable: raw.targetTable || raw.table || '',
    targetName: raw.targetName || raw.name || '',
    action: raw.action || raw.operation || '',
    application: raw.application || raw.scope || '',
    updatedBy: raw.updatedBy || raw.updated_by || '',
    createdOn: raw.createdOn || raw.created || '',
    updatedOn: raw.updatedOn || raw.updated || '',
    updateSetSysId: raw.updateSetSysId || raw.update_set || '',
    updateSetName: raw.updateSetName || raw.updateSet || '',
    payloadXml: raw.payloadXml || raw.payload || '',
    payloadPreview: raw.payloadPreview || raw.payloadXml || raw.payload || '',
    deepPayloadFetched: !!raw.deepPayloadFetched,
    deepTable: raw.deepTable || raw.targetTable || raw.table || '',
    deepName: raw.deepName || raw.targetName || raw.name || '',
    scriptField: raw.scriptField || '',
    scriptPreview: raw.scriptPreview || '',
    fieldSummary,
    source: raw.source || CHANGE_DOCUMENTATION_SOURCES.customerUpdateList
  };
}
