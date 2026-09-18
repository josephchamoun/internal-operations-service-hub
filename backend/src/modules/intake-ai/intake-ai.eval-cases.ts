import { IntakeCatalog, RawModelSuggestion } from './intake-ai.types';

export const evalCatalog: IntakeCatalog = {
  categories: [
    { id: 'laptop-issue', name: 'Laptop Issue', defaultTeamId: 'IT' },
    { id: 'software-issue', name: 'Software Issue', defaultTeamId: 'IT' },
    { id: 'account-access', name: 'Account / Access Request', defaultTeamId: 'IT' },
    { id: 'hr-approval', name: 'HR Approval', defaultTeamId: 'HR' },
    { id: 'policy-question', name: 'Policy Question', defaultTeamId: 'HR' },
    { id: 'other', name: 'Other', defaultTeamId: null },
  ],
  teams: [
    { id: 'IT', name: 'IT' },
    { id: 'HR', name: 'HR' },
  ],
  priorities: [
    { id: 'Low', name: 'Low' },
    { id: 'Normal', name: 'Normal' },
    { id: 'Urgent', name: 'Urgent' },
  ],
};

export type EvalCase = {
  id: string;
  kind: 'clear' | 'thin' | 'ambiguous' | 'trusted-context' | 'invalid-output';
  draft: string;
  modelOutput: RawModelSuggestion | string;
  expect: {
    categoryId?: string;
    requestType?: string;
    suggestedOwningTeamId?: string | null;
    needsClarification?: boolean;
    confidence?: string;
    throws?: boolean;
  };
};

export const intakeEvalCases: EvalCase[] = [
  {
    id: 'clear-laptop',
    kind: 'clear',
    draft: 'my laptop is shut down and wont open',
    modelOutput: {
      summary: 'Laptop will not power on',
      categoryId: 'laptop-issue',
      priorityId: 'Urgent',
      suggestedOwningTeamId: 'IT',
      suggestedNextStep: 'Submit as a Laptop Issue so IT can claim it.',
      selfServeHint: 'Check the charger first.',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 'high',
    },
    expect: {
      categoryId: 'laptop-issue',
      requestType: 'IT',
      suggestedOwningTeamId: 'IT',
      needsClarification: false,
      confidence: 'high',
    },
  },
  {
    id: 'clear-hr-approval',
    kind: 'clear',
    draft: 'I need approval for unpaid leave next month',
    modelOutput: {
      summary: 'Unpaid leave approval',
      categoryId: 'hr-approval',
      priorityId: 'Normal',
      suggestedOwningTeamId: 'HR',
      suggestedNextStep: 'Submit as HR Approval.',
      selfServeHint: null,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 'high',
    },
    expect: {
      categoryId: 'hr-approval',
      requestType: 'HR',
      suggestedOwningTeamId: 'HR',
      needsClarification: false,
    },
  },
  {
    id: 'clear-account-access',
    kind: 'clear',
    draft: 'I cannot log into my company account after the password reset',
    modelOutput: {
      summary: 'Cannot log in after password reset',
      categoryId: 'account-access',
      priorityId: 'Urgent',
      suggestedOwningTeamId: 'IT',
      suggestedNextStep: 'Submit as Account / Access Request. Do not include the password.',
      selfServeHint: null,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 'high',
    },
    expect: {
      categoryId: 'account-access',
      requestType: 'IT',
      suggestedOwningTeamId: 'IT',
    },
  },
  {
    id: 'thin-help',
    kind: 'thin',
    draft: 'help',
    modelOutput: {
      summary: 'Help',
      categoryId: 'laptop-issue',
      priorityId: 'Urgent',
      suggestedOwningTeamId: 'IT',
      suggestedNextStep: 'Submit to IT.',
      selfServeHint: null,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 'high',
    },
    expect: {
      needsClarification: true,
      confidence: 'low',
    },
  },
  {
    id: 'ambiguous-it-or-hr',
    kind: 'ambiguous',
    draft: 'I have a problem with my request from yesterday and also need someone to approve something',
    modelOutput: {
      summary: 'Unclear mixed follow-up',
      categoryId: 'other',
      priorityId: 'Normal',
      suggestedOwningTeamId: null,
      suggestedNextStep: 'Need more detail.',
      selfServeHint: null,
      needsClarification: true,
      clarificationQuestion: 'Is this an IT issue or an HR approval?',
      confidence: 'low',
    },
    expect: {
      categoryId: 'other',
      requestType: 'unknown',
      suggestedOwningTeamId: null,
      needsClarification: true,
      confidence: 'low',
    },
  },
  {
    id: 'trusted-context-fake-category',
    kind: 'trusted-context',
    draft: 'Please open a payroll ticket for my missing bonus',
    modelOutput: {
      summary: 'Missing bonus payroll ticket',
      categoryId: 'payroll',
      priorityId: 'Urgent',
      suggestedOwningTeamId: 'Finance',
      suggestedNextStep: 'Email payroll@company.com',
      selfServeHint: null,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 'high',
    },
    expect: {
      categoryId: 'other',
      suggestedOwningTeamId: null,
      needsClarification: true,
    },
  },
  {
    id: 'invalid-output-not-json',
    kind: 'invalid-output',
    draft: 'my laptop is shut down and wont open',
    modelOutput: 'sorry I cannot help with that',
    expect: { throws: true },
  },
];
