import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { IntakeAiService } from './intake-ai.service';
import { evalCatalog, intakeEvalCases } from './intake-ai.eval-cases';
import { buildSystemPrompt } from './build-prompts';
import {
  defaultNextStep,
  fallbackCategoryId,
  normalizeInterpretation,
} from './normalize-interpretation';
import { IntakeCatalog } from './intake-ai.types';

describe('AI intake eval cases', () => {
  it.each(intakeEvalCases.filter((item) => item.kind !== 'invalid-output'))(
    '$id ($kind) normalizes against trusted catalog values',
    (evalCase) => {
      const result = normalizeInterpretation(
        evalCase.draft,
        evalCase.modelOutput as object,
        evalCatalog,
      );
      if (evalCase.expect.categoryId) {
        expect(result.categoryId).toBe(evalCase.expect.categoryId);
      }
      if (evalCase.expect.requestType) {
        expect(result.requestType).toBe(evalCase.expect.requestType);
      }
      if (evalCase.expect.suggestedOwningTeamId !== undefined) {
        expect(result.suggestedOwningTeamId).toBe(
          evalCase.expect.suggestedOwningTeamId,
        );
      }
      if (evalCase.expect.needsClarification !== undefined) {
        expect(result.needsClarification).toBe(evalCase.expect.needsClarification);
      }
      if (evalCase.expect.confidence) {
        expect(result.confidence).toBe(evalCase.expect.confidence);
      }
      expect(evalCatalog.categories.some((item) => item.id === result.categoryId)).toBe(
        true,
      );
      expect(evalCatalog.priorities.some((item) => item.id === result.priorityId)).toBe(
        true,
      );
      if (result.suggestedOwningTeamId) {
        expect(
          evalCatalog.teams.some((item) => item.id === result.suggestedOwningTeamId),
        ).toBe(true);
      }
    },
  );

  it('invalid-output-not-json is rejected by interpret(), not saved as a request', async () => {
    const evalCase = intakeEvalCases.find((item) => item.id === 'invalid-output-not-json')!;
    const service = new IntakeAiService(
      { complete: async () => evalCase.modelOutput as string },
      { findAll: async () => evalCatalog.categories } as any,
      { findAll: async () => evalCatalog.teams } as any,
      { findAll: async () => evalCatalog.priorities } as any,
    );

    await expect(service.interpret(evalCase.draft)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('provider failure does not create a request', async () => {
    const service = new IntakeAiService(
      {
        complete: async () => {
          throw new Error('network down');
        },
      },
      { findAll: async () => evalCatalog.categories } as any,
      { findAll: async () => evalCatalog.teams } as any,
      { findAll: async () => evalCatalog.priorities } as any,
    );

    await expect(service.interpret('my laptop is shut down and wont open')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

const facilitiesCatalog: IntakeCatalog = {
  categories: [
    { id: 'badge-access', name: 'Badge Access', defaultTeamId: 'Facilities' },
    { id: 'misc', name: 'Misc', defaultTeamId: null },
  ],
  teams: [{ id: 'Facilities', name: 'Facilities' }],
  priorities: [{ id: 'Standard', name: 'Standard' }],
};

describe('intake catalog is not hardcoded to seed IT/HR', () => {
  it('builds the prompt from whatever catalog is passed in', () => {
    const prompt = buildSystemPrompt(facilitiesCatalog);
    expect(prompt).toContain('badge-access: Badge Access');
    expect(prompt).toContain('Facilities');
    expect(prompt).toContain('misc');
    expect(prompt).not.toMatch(/laptop-issue/);
    expect(prompt).not.toMatch(/\bIT or HR\b/);
    expect(prompt).not.toMatch(/hr-approval/);
  });

  it('maps invented category ids to the catch-all in that catalog', () => {
    const result = normalizeInterpretation(
      'Please open a payroll ticket for my missing bonus',
      {
        summary: 'Missing bonus',
        categoryId: 'payroll',
        priorityId: 'Critical',
        suggestedOwningTeamId: 'Finance',
        needsClarification: false,
        confidence: 'high',
      },
      facilitiesCatalog,
    );
    expect(result.categoryId).toBe('misc');
    expect(result.categoryId).toBe(fallbackCategoryId(facilitiesCatalog));
    expect(result.priorityId).toBe('Standard');
    expect(result.suggestedOwningTeamId).toBeNull();
    expect(result.needsClarification).toBe(true);
  });

  it('writes next-step copy from catalog names, not seed ids', () => {
    const step = defaultNextStep(facilitiesCatalog, 'badge-access', 'Facilities', false);
    expect(step).toContain('Badge Access');
    expect(step).toContain('Facilities');
    expect(step).not.toMatch(/\bIT\b/);
    expect(step).not.toMatch(/\bHR\b/);
  });
});
