import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLabCompletionRequest,
  evaluateLabLaunchDecision,
  sanitizeLabAssessmentForStudent,
  type LabPolicySubject,
  type LabSessionSubject,
} from './labs';

const baseLab: LabPolicySubject = {
  id: 1,
  title: 'Test Lab',
  enabled: true,
  published: true,
  runnerRequired: false,
  verificationRequired: true,
  verificationMode: 'task_assessment',
  verificationTokenHash: 'hash:LAB-PROOF-1234',
  xpReward: 150,
  timeLimitMinutes: 45,
  assessmentJson: {
    prompt: 'Which header prevents clickjacking?',
    artifactLabel: 'HTTP Headers',
    artifactContent: 'HTTP/1.1 200 OK',
    options: ['X-Powered-By', 'Content-Security-Policy: frame-ancestors none', 'Server: Apache'],
    correctIndex: 1,
    explanation: 'frame-ancestors restricts framing.',
  },
};

const activeSession: LabSessionSubject = {
  id: 10,
  userId: 99,
  labId: 1,
  status: 'active',
  xpAwarded: false,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  terminatedAt: null,
};

const mockVerify = (token: string, expectedHash: string) =>
  expectedHash === `hash:${token}`;

test('evaluateLabLaunchDecision blocks disabled labs and distinguishes interactive vs disconnected MicroVM', () => {
  const disabled = evaluateLabLaunchDecision({ ...baseLab, enabled: false }, false);
  assert.equal(disabled.allowed, false);
  assert.equal(disabled.httpStatus, 403);

  const interactive = evaluateLabLaunchDecision(baseLab, false);
  assert.equal(interactive.allowed, true);
  assert.equal(interactive.sessionStatus, 'active');
  assert.equal(interactive.infrastructureRequired, false);

  const microvm = evaluateLabLaunchDecision({ ...baseLab, runnerRequired: true }, false);
  assert.equal(microvm.allowed, true);
  assert.equal(microvm.sessionStatus, 'provision_required');
  assert.equal(microvm.infrastructureRequired, true);
  assert.match(microvm.message, /External MicroVM runner not connected/i);
});

test('evaluateLabCompletionRequest enforces single-XP-award against replay and concurrent double submission', () => {
  const firstAttempt = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: activeSession,
    alreadyAwardedForLab: false,
    selectedOption: 1,
    verifyTokenFn: mockVerify,
  });
  assert.equal(firstAttempt.allowed, true);
  assert.equal(firstAttempt.xpToAward, 150);
  assert.equal(firstAttempt.alreadyCompleted, false);

  const replayAttempt = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: activeSession,
    alreadyAwardedForLab: true,
    selectedOption: 1,
    verifyTokenFn: mockVerify,
  });
  assert.equal(replayAttempt.allowed, true);
  assert.equal(replayAttempt.xpToAward, 0);
  assert.equal(replayAttempt.alreadyCompleted, true);
});

test('evaluateLabCompletionRequest rejects wrong assessment answer, missing session, terminated session, and expired session', () => {
  const noSession = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: null,
    alreadyAwardedForLab: false,
    selectedOption: 1,
    verifyTokenFn: mockVerify,
  });
  assert.equal(noSession.allowed, false);
  assert.equal(noSession.httpStatus, 400);

  const wrongAnswer = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: activeSession,
    alreadyAwardedForLab: false,
    selectedOption: 0,
    verifyTokenFn: mockVerify,
  });
  assert.equal(wrongAnswer.allowed, false);
  assert.equal(wrongAnswer.httpStatus, 400);

  const terminated = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: { ...activeSession, status: 'terminated', terminatedAt: new Date() },
    alreadyAwardedForLab: false,
    selectedOption: 1,
    verifyTokenFn: mockVerify,
  });
  assert.equal(terminated.allowed, false);
  assert.equal(terminated.httpStatus, 403);

  const expired = evaluateLabCompletionRequest({
    lab: baseLab,
    latestSession: { ...activeSession, expiresAt: new Date(Date.now() - 10_000) },
    alreadyAwardedForLab: false,
    selectedOption: 1,
    verifyTokenFn: mockVerify,
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.httpStatus, 400);
});

test('evaluateLabCompletionRequest supports verificationRequired=false walkthrough completion and token proof verification', () => {
  const noVerify = evaluateLabCompletionRequest({
    lab: { ...baseLab, verificationRequired: false, verificationMode: 'none' },
    latestSession: activeSession,
    alreadyAwardedForLab: false,
    verifyTokenFn: mockVerify,
  });
  assert.equal(noVerify.allowed, true);
  assert.equal(noVerify.xpToAward, 150);

  const proofLab: LabPolicySubject = {
    ...baseLab,
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
  };
  const badProof = evaluateLabCompletionRequest({
    lab: proofLab,
    latestSession: { ...activeSession, status: 'provision_required' },
    alreadyAwardedForLab: false,
    submittedToken: 'WRONG',
    verifyTokenFn: mockVerify,
  });
  assert.equal(badProof.allowed, false);

  const validProof = evaluateLabCompletionRequest({
    lab: proofLab,
    latestSession: { ...activeSession, status: 'provision_required' },
    alreadyAwardedForLab: false,
    submittedToken: 'LAB-PROOF-1234',
    verifyTokenFn: mockVerify,
  });
  assert.equal(validProof.allowed, true);
  assert.equal(validProof.xpToAward, 150);
});

test('sanitizeLabAssessmentForStudent strips correctIndex and explanation before client delivery', () => {
  const sanitized = sanitizeLabAssessmentForStudent(baseLab.assessmentJson) as Record<string, unknown>;
  assert.ok(sanitized);
  assert.equal('correctIndex' in sanitized, false);
  assert.equal('explanation' in sanitized, false);
  assert.equal(sanitized.prompt, baseLab.assessmentJson?.prompt);
});
