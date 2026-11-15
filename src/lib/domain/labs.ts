export interface LabPolicySubject {
  id: number;
  title: string;
  enabled: boolean;
  published: boolean;
  runnerRequired: boolean;
  verificationRequired: boolean;
  verificationMode: string;
  verificationTokenHash: string;
  xpReward: number;
  timeLimitMinutes: number;
  assessmentJson?: {
    prompt: string;
    artifactLabel: string;
    artifactContent: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  } | null;
}

export interface LabSessionSubject {
  id: number;
  userId: number;
  labId: number;
  status: string;
  xpAwarded: boolean;
  expiresAt: Date | string | null;
  terminatedAt: Date | string | null;
}

export interface LabLaunchDecision {
  allowed: boolean;
  httpStatus: number;
  sessionStatus: 'active' | 'provision_required' | 'denied';
  infrastructureRequired: boolean;
  runnerConnected: boolean;
  message: string;
}

export function evaluateLabLaunchDecision(
  lab: Pick<LabPolicySubject, 'enabled' | 'published' | 'runnerRequired' | 'title'>,
  runnerConnected: boolean,
): LabLaunchDecision {
  if (!lab.published || !lab.enabled) {
    return {
      allowed: false,
      httpStatus: 403,
      sessionStatus: 'denied',
      infrastructureRequired: false,
      runnerConnected,
      message: 'This cyber lab is currently disabled by administrators.',
    };
  }

  if (lab.runnerRequired && !runnerConnected) {
    return {
      allowed: true,
      httpStatus: 200,
      sessionStatus: 'provision_required',
      infrastructureRequired: true,
      runnerConnected: false,
      message:
        'External MicroVM runner not connected. Live container execution requires an external sandbox runner separated from the production backend; interactive walkthrough steps remain available below.',
    };
  }

  return {
    allowed: true,
    httpStatus: 200,
    sessionStatus: 'active',
    infrastructureRequired: false,
    runnerConnected: lab.runnerRequired ? true : false,
    message: lab.runnerRequired
      ? `Isolated MicroVM session provisioned for "${lab.title}".`
      : `Interactive walkthrough session started for "${lab.title}". All exercises run safely in guided mode without touching the backend host.`,
  };
}

export interface LabCompletionEvaluationInput {
  lab: LabPolicySubject;
  latestSession: LabSessionSubject | null;
  alreadyAwardedForLab: boolean;
  now?: Date;
  submittedToken?: string;
  selectedOption?: number | null;
  verifyTokenFn: (token: string, expectedHash: string) => boolean;
}

export interface LabCompletionDecision {
  allowed: boolean;
  httpStatus: number;
  error?: string;
  xpToAward: number;
  alreadyCompleted: boolean;
  explanation?: string | null;
}

export function evaluateLabCompletionRequest(
  input: LabCompletionEvaluationInput,
): LabCompletionDecision {
  const {
    lab,
    latestSession,
    alreadyAwardedForLab,
    now = new Date(),
    submittedToken = '',
    selectedOption = null,
    verifyTokenFn,
  } = input;

  if (!lab.published || !lab.enabled) {
    return {
      allowed: false,
      httpStatus: 403,
      error: 'This cyber lab is currently disabled by administrators.',
      xpToAward: 0,
      alreadyCompleted: alreadyAwardedForLab,
    };
  }

  if (!latestSession) {
    return {
      allowed: false,
      httpStatus: 400,
      error: 'Please launch or start a lab session before submitting completion.',
      xpToAward: 0,
      alreadyCompleted: alreadyAwardedForLab,
    };
  }

  if (latestSession.status === 'terminated' || latestSession.terminatedAt) {
    return {
      allowed: false,
      httpStatus: 403,
      error: 'Your lab session was terminated by an administrator. Reset or launch a fresh session.',
      xpToAward: 0,
      alreadyCompleted: alreadyAwardedForLab,
    };
  }

  if (latestSession.expiresAt) {
    const expiry = new Date(latestSession.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return {
        allowed: false,
        httpStatus: 400,
        error: 'Lab session time limit has expired. Reset the lab to start a new session.',
        xpToAward: 0,
        alreadyCompleted: alreadyAwardedForLab,
      };
    }
  }

  // If verification is NOT required for this lab (admin toggle NO or walkthrough mode)
  if (!lab.verificationRequired || lab.verificationMode === 'none') {
    if (lab.runnerRequired && latestSession.status === 'provision_required') {
      // Allow completion when admin explicitly disabled verification, while clearly preserving single-award XP
    }
    return {
      allowed: true,
      httpStatus: 200,
      xpToAward: alreadyAwardedForLab ? 0 : Math.max(0, lab.xpReward),
      alreadyCompleted: alreadyAwardedForLab,
      explanation: lab.assessmentJson?.explanation ?? null,
    };
  }

  // Verification IS required
  if (lab.verificationMode === 'task_assessment' && lab.assessmentJson) {
    if (typeof selectedOption !== 'number' || !Number.isInteger(selectedOption)) {
      return {
        allowed: false,
        httpStatus: 400,
        error: 'Please select an assessment answer before verifying lab completion.',
        xpToAward: 0,
        alreadyCompleted: alreadyAwardedForLab,
      };
    }

    if (selectedOption !== lab.assessmentJson.correctIndex) {
      return {
        allowed: false,
        httpStatus: 400,
        error: 'Assessment answer is incorrect. Review the captured artifact and try again.',
        xpToAward: 0,
        alreadyCompleted: alreadyAwardedForLab,
      };
    }

    return {
      allowed: true,
      httpStatus: 200,
      xpToAward: alreadyAwardedForLab ? 0 : Math.max(0, lab.xpReward),
      alreadyCompleted: alreadyAwardedForLab,
      explanation: lab.assessmentJson.explanation,
    };
  }

  // Proof-token / external runner verification
  const trimmedToken = submittedToken.trim();
  if (!trimmedToken) {
    return {
      allowed: false,
      httpStatus: 400,
      error:
        lab.runnerRequired && latestSession.status === 'provision_required'
          ? 'External MicroVM runner not connected and no verification token was supplied.'
          : 'Please enter a valid lab verification token.',
      xpToAward: 0,
      alreadyCompleted: alreadyAwardedForLab,
    };
  }

  if (!verifyTokenFn(trimmedToken, lab.verificationTokenHash)) {
    return {
      allowed: false,
      httpStatus: 400,
      error: 'Verification token is invalid for this lab.',
      xpToAward: 0,
      alreadyCompleted: alreadyAwardedForLab,
    };
  }

  return {
    allowed: true,
    httpStatus: 200,
    xpToAward: alreadyAwardedForLab ? 0 : Math.max(0, lab.xpReward),
    alreadyCompleted: alreadyAwardedForLab,
    explanation: null,
  };
}

export function sanitizeLabAssessmentForStudent(
  assessmentJson: LabPolicySubject['assessmentJson'],
) {
  if (!assessmentJson) return null;
  return {
    prompt: assessmentJson.prompt,
    artifactLabel: assessmentJson.artifactLabel,
    artifactContent: assessmentJson.artifactContent,
    options: assessmentJson.options,
  };
}
