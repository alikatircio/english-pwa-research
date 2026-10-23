// The diagnostic questions of the bundle ('@extras' alias). The ambient declaration types as any, so re-type here.
import bundle from '@extras';
import type { DiagnosticQuestion, ExtrasBundle } from '../domain/extrasSchema.ts';

const extras: ExtrasBundle = bundle;
export const diagnosticQuestions: readonly DiagnosticQuestion[] = extras.diagnostic;
