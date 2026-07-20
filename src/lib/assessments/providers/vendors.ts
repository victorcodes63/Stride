import type { AssessmentProviderKey } from '@prisma/client';
import { BaseRestProvider } from './base';
import type { AssessmentProviderAdapter } from './types';

const OAUTH_FIELDS: AssessmentProviderAdapter['credentialFields'] = [
  { key: 'clientId', label: 'Client ID', secret: true },
  { key: 'clientSecret', label: 'Client secret', secret: true },
];

const API_KEY_FIELDS: AssessmentProviderAdapter['credentialFields'] = [
  { key: 'apiKey', label: 'API key', secret: true },
];

/** Criteria Corp — skills, aptitude and personality pre-hire testing. */
export class CriteriaProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'criteria';
  readonly label = 'Criteria Corp';
  readonly credentialFields = OAUTH_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.criteriacorp.com/v1';
  }
  protected knownDimensions() {
    return ['Cognitive', 'Personality', 'EmotionalIntelligence', 'RiskTolerance'];
  }
}

/** SHL — cognitive ability + behavioural (OPQ) assessments. */
export class ShlProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'shl';
  readonly label = 'SHL';
  readonly credentialFields = OAUTH_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.shl.com/v2';
  }
  protected knownDimensions() {
    return ['VerbalReasoning', 'NumericalReasoning', 'InductiveReasoning', 'Behavioural'];
  }
}

/** Hogan — personality (HPI), derailers (HDS), values (MVPI). */
export class HoganProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'hogan';
  readonly label = 'Hogan Assessments';
  readonly credentialFields = OAUTH_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.hoganassessments.com/v1';
  }
  protected knownDimensions() {
    return ['Adjustment', 'Ambition', 'Sociability', 'Prudence', 'Inquisitive', 'Learning'];
  }
}

/** Predictive Index — behavioural + cognitive. */
export class PredictiveIndexProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'predictive_index';
  readonly label = 'Predictive Index';
  readonly credentialFields = OAUTH_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.predictiveindex.com/v1';
  }
  protected knownDimensions() {
    return ['Dominance', 'Extraversion', 'Patience', 'Formality'];
  }
}

/** DISC — Dominance, Influence, Steadiness, Conscientiousness. */
export class DiscProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'disc';
  readonly label = 'DISC';
  readonly credentialFields = API_KEY_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.discprofile.com/v1';
  }
  protected knownDimensions() {
    return ['Dominance', 'Influence', 'Steadiness', 'Conscientiousness'];
  }
}

/** Big Five / OCEAN. */
export class BigFiveProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'big_five';
  readonly label = 'Big Five (OCEAN)';
  readonly credentialFields = API_KEY_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.bigfive-assessments.com/v1';
  }
  protected knownDimensions() {
    return ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
  }
}

/** HireVue — video interview + game-based assessments. */
export class HireVueProvider extends BaseRestProvider {
  readonly key: AssessmentProviderKey = 'hirevue';
  readonly label = 'HireVue';
  readonly credentialFields = OAUTH_FIELDS;
  protected defaultBaseUrl() {
    return 'https://api.hirevue.com/v1';
  }
  constructor() {
    super();
    this.paths.catalog = '/jobs';
    this.paths.invite = '/candidates';
    this.paths.result = (inviteId: string) => `/candidates/${inviteId}/evaluation`;
  }
  protected knownDimensions() {
    return ['Communication', 'Competency', 'Engagement'];
  }
}
