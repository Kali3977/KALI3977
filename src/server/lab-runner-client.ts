import crypto from 'node:crypto';

export interface ExternalLabRunnerConfigStatus {
  configured: boolean;
  runnerUrlConfigured: boolean;
  authTokenConfigured: boolean;
  hmacSecretConfigured: boolean;
  executionMode: 'isolated_external_runner' | 'not_connected';
  cloudCostPolicy: string;
}

export interface LabRunnerProvisionPlan {
  architecture: string;
  estimatedMonthlyCostUsd: string;
  securityControls: string[];
  approvalRequired: boolean;
}

export function getExternalRunnerConfigStatus(): ExternalLabRunnerConfigStatus {
  const runnerUrlConfigured = Boolean(process.env.LAB_RUNNER_URL?.trim());
  const authTokenConfigured = Boolean(process.env.LAB_RUNNER_AUTH_TOKEN?.trim());
  const hmacSecretConfigured = Boolean(process.env.LAB_PROOF_HMAC_SECRET?.trim());
  const configured = runnerUrlConfigured && authTokenConfigured;

  return {
    configured,
    runnerUrlConfigured,
    authTokenConfigured,
    hmacSecretConfigured,
    executionMode: configured ? 'isolated_external_runner' : 'not_connected',
    cloudCostPolicy:
      'No paid GCE/Firecracker worker nodes provisioned automatically. Explicit Owner cost approval required.',
  };
}

export function getFutureRunnerArchitecturePlan(): LabRunnerProvisionPlan {
  return {
    architecture:
      'Dedicated GCE Nested-KVM / Firecracker MicroVM Runner Pool in isolated VPC subnet communicating with Cloud Run backend via short-lived mTLS/HMAC-signed runner API.',
    estimatedMonthlyCostUsd:
      '$35–$120/month depending on concurrent warm n2-standard-2/4 nested-KVM workers (0 USD while unprovisioned).',
    securityControls: [
      'Server-to-server Bearer token + HMAC-SHA256 proof attestation',
      'Per-session ephemeral MicroVM rootfs wiped immediately on timeout/reset',
      'Zero access from sandbox subnet to Cloud SQL or production credentials',
      'Hard CPU (500m-1000m), RAM (512MB-1024MB), storage, and egress-block enforcement',
      'Automatic idle teardown after lab timeLimitMinutes expires',
    ],
    approvalRequired: true,
  };
}

export function signRunnerProofPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyRunnerProofSignature(
  payload: string,
  signatureHex: string,
  secret: string,
): boolean {
  if (!payload || !signatureHex || !secret) return false;
  const expected = signRunnerProofPayload(payload, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHex.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function probeExternalRunnerHealth(): Promise<{
  connected: boolean;
  reason: string;
  status: ExternalLabRunnerConfigStatus;
}> {
  const status = getExternalRunnerConfigStatus();
  if (!status.configured) {
    return {
      connected: false,
      reason: 'External MicroVM runner not connected (LAB_RUNNER_URL / LAB_RUNNER_AUTH_TOKEN not configured).',
      status,
    };
  }

  try {
    const baseUrl = String(process.env.LAB_RUNNER_URL).replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${baseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${process.env.LAB_RUNNER_AUTH_TOKEN}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return {
        connected: false,
        reason: `External MicroVM runner health endpoint returned HTTP ${resp.status}.`,
        status,
      };
    }
    return {
      connected: true,
      reason: 'External MicroVM runner connected and healthy.',
      status,
    };
  } catch (err) {
    return {
      connected: false,
      reason: `External MicroVM runner unreachable: ${err instanceof Error ? err.message : 'network error'}`,
      status,
    };
  }
}
