/*
  What the rain is made of.

  The glyph set is hex and code punctuation rather than katakana. Katakana
  would be a direct quote of a film; this alphabet comes from the subject's own
  world, so the noise reads as "systems" instead of as costume.
*/

export const GLYPHS =
  '0123456789ABCDEF<>{}[]()/\\|=+-*&^%$#@!?;:._~';

/** Phrases that the falling columns converge to spell. All from the resume. */
export const PHRASES = [
  '100M+ REQUESTS / DAY',
  'ZERO-DOWNTIME CUTOVER',
  '$2.76M REDUCED',
  '200+ CLIENT TEAMS',
  'EVENT-DRIVEN ARCHITECTURE',
  'MULTI-REGION EXPANSION',
  'PROCEDURAL GENERATION',
  'DETERMINISTIC REPLAY',
  '~95% FASTER RESPONSE',
  'THE NINTH CIRCLE',
  'EPIC FHIR INTEGRATION',
  '1ST PLACE - UCI',
  'AWS BEDROCK / LLM',
  'FAULT-TOLERANT BY DESIGN',
];

/** Short terms the decoder beam resolves under the cursor. */
export const TERMS = [
  'DYNAMODB',
  'BEDROCK',
  'KUBERNETES',
  'TYPESCRIPT',
  'CLOUDWATCH',
  'BEHAVIOR TREES',
  'SNS / SQS',
  'AWS CDK',
  'UNREAL 5',
  'PYTORCH',
  'DOCKER',
  'LAMBDA',
  'EPIC FHIR',
  'BLUEPRINTS',
  'MICROSERVICES',
  'OBSERVABILITY',
  'REST APIS',
  'NAV MESH',
  'IAC',
  'EC2',
];

export const pick = <T>(arr: readonly T[]): T =>
  arr[(Math.random() * arr.length) | 0];

export const randomGlyph = (): string =>
  GLYPHS[(Math.random() * GLYPHS.length) | 0];
