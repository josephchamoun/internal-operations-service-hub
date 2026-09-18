import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { IntakeAiService } from './intake-ai.service';
import { evalCatalog, intakeEvalCases } from './intake-ai.eval-cases';
import { normalizeInterpretation } from './normalize-interpretation';

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
