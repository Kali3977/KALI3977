import { isSafeExternalUrl } from './rich-text.ts';
import { sanitizeText } from './security.ts';

export const KALI3977_COPYRIGHT_NOTICE =
  '© 2026 KALI3977. All rights reserved for original platform software, KALI3977 branding, courses, and CTF challenges.';

export const KALI3977_BRAND_NOTICE =
  'KALI3977™ is an independent cybersecurity education and competition brand (unregistered common-law mark; not yet registered as a ® trademark pending formal legal clearance and filing). KALI3977 is not affiliated with or an official Kali Linux product.';

export const KALI3977_DEFAULT_COURSE_LICENSE =
  '© 2026 KALI3977 — All Rights Reserved (Personal Educational Use Only)';

export const KALI3977_DEFAULT_CTF_LICENSE =
  '© 2026 KALI3977 — Original Challenge Material (Non-Commercial Educational Use)';

export type QuotaTier = 'read' | 'bulk_content' | 'artifact' | 'verify_or_report';

export interface AbuseCheckResult {
  allowed: boolean;
  suspicious: boolean;
  tier: QuotaTier;
  remaining: number;
  retryAfterSeconds: number;
  reason?: string;
}

const KNOWN_AUTOMATED_HARVESTER_RE = /\b(scrapy|httrack|webcopier|teleport|offline\s*explorer|sqlmap|nikto|nuclei|masscan)\b/i;

export function isLegitimateAssistiveOrBrowserUa(userAgent: string): boolean {
  if (!userAgent) return false;
  return /\b(mozilla|chrome|safari|firefox|edg|nvda|jaws|voiceover|talkback|orca)\b/i.test(userAgent);
}

export class AntiScrapingMonitor {
  private windows = new Map<string, number[]>();

  checkRequest(params: {
    clientKey: string;
    path: string;
    userAgent?: string;
    nowMs?: number;
  }): AbuseCheckResult {
    const nowMs = params.nowMs ?? Date.now();
    const path = params.path || '/';
    const ua = params.userAgent || '';

    let tier: QuotaTier = 'read';
    let limit = 180;
    const windowMs = 60_000;

    const normalizedPath = path.replace(/^\/+/, '').replace(/^api\/+/, '');

    if (/^(ctf\/\d+\/artifact)\b/.test(normalizedPath)) {
      tier = 'artifact';
      limit = 25;
    } else if (/^(academy|ctf|books|leaderboards|community)\b/.test(normalizedPath)) {
      tier = 'bulk_content';
      limit = 45;
    } else if (/^(certificates\/verify|ip-reports)\b/.test(normalizedPath)) {
      tier = 'verify_or_report';
      limit = 20;
    }

    // Immediate flag & stricter quota for known bulk harvesting / offensive scanner signatures,
    // without penalizing normal web browsers or accessibility screen readers.
    const isHarvesterUa =
      KNOWN_AUTOMATED_HARVESTER_RE.test(ua) && !isLegitimateAssistiveOrBrowserUa(ua);
    if (isHarvesterUa && (tier === 'bulk_content' || tier === 'artifact')) {
      limit = 5;
    }

    const bucketKey = `${params.clientKey}:${tier}`;
    const entries = (this.windows.get(bucketKey) || []).filter((ts) => nowMs - ts < windowMs);

    if (entries.length >= limit) {
      const oldest = entries[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (nowMs - oldest)) / 1000));
      this.windows.set(bucketKey, entries);
      return {
        allowed: false,
        suspicious: true,
        tier,
        remaining: 0,
        retryAfterSeconds,
        reason: isHarvesterUa
          ? 'Automated bulk scraping user-agent throttled under KALI3977 Anti-Scraping Policy.'
          : `Request quota exceeded for ${tier} endpoint (${limit} req/min).`,
      };
    }

    entries.push(nowMs);
    this.windows.set(bucketKey, entries);

    // Flag suspicious high-rate scraping burst cleanly when reaching >85% of bulk quota in 10 seconds
    const recent10s = entries.filter((ts) => nowMs - ts < 10_000).length;
    const suspicious =
      isHarvesterUa ||
      ((tier === 'bulk_content' || tier === 'artifact') && recent10s >= Math.max(12, Math.floor(limit * 0.6)));

    return {
      allowed: true,
      suspicious,
      tier,
      remaining: Math.max(0, limit - entries.length),
      retryAfterSeconds: 0,
      reason: suspicious ? 'High-frequency sequential content access detected.' : undefined,
    };
  }
}

export function clampPaginationLimit(
  rawLimit: unknown,
  defaultLimit: number = 25,
  maxLimit: number = 100,
): number {
  const n = Number(rawLimit);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, Math.floor(n)));
}

export const ALLOWED_IP_REPORT_TYPES = [
  'copyright_takedown',
  'trademark_misuse',
  'cloning_scraping',
  'content_dispute',
] as const;

export const ALLOWED_IP_TARGET_TYPES = [
  'course',
  'ctf_challenge',
  'book',
  'brand',
  'platform_clone',
  'other',
] as const;

export function validateIpReportInput(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  data?: {
    reportType: string;
    targetType: string;
    targetRef: string;
    reporterName: string;
    reporterEmail: string;
    organization: string;
    description: string;
    evidenceUrl: string | null;
    counterNoticeText: string | null;
  };
} {
  const reportType = String(body.reportType || '').trim();
  if (!(ALLOWED_IP_REPORT_TYPES as readonly string[]).includes(reportType)) {
    return { valid: false, error: 'Invalid IP report type selected.' };
  }

  const targetType = String(body.targetType || '').trim();
  if (!(ALLOWED_IP_TARGET_TYPES as readonly string[]).includes(targetType)) {
    return { valid: false, error: 'Invalid target resource category.' };
  }

  const targetRef = sanitizeText(String(body.targetRef || ''), 200);
  if (!targetRef || targetRef.length < 2) {
    return { valid: false, error: 'Please specify the affected course, challenge, URL, or brand asset.' };
  }

  const reporterName = sanitizeText(String(body.reporterName || ''), 120);
  if (!reporterName || reporterName.length < 2) {
    return { valid: false, error: 'Reporter full name or legal representative name is required.' };
  }

  const reporterEmail = sanitizeText(String(body.reporterEmail || ''), 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
    return { valid: false, error: 'A valid contact email address is required for IP correspondence.' };
  }

  const organization = sanitizeText(String(body.organization || ''), 140);
  const description = sanitizeText(String(body.description || ''), 2500);
  if (description.length < 15) {
    return { valid: false, error: 'Please provide at least 15 characters describing the IP claim or dispute.' };
  }

  let evidenceUrl: string | null = null;
  if (typeof body.evidenceUrl === 'string' && body.evidenceUrl.trim()) {
    const rawUrl = body.evidenceUrl.trim();
    if (!isSafeExternalUrl(rawUrl) || !rawUrl.startsWith('https://')) {
      return { valid: false, error: 'Evidence URL must use a valid https:// address.' };
    }
    evidenceUrl = rawUrl.slice(0, 400);
  }

  const counterNoticeText =
    typeof body.counterNoticeText === 'string' && body.counterNoticeText.trim()
      ? sanitizeText(body.counterNoticeText, 2000)
      : null;

  return {
    valid: true,
    data: {
      reportType,
      targetType,
      targetRef,
      reporterName,
      reporterEmail,
      organization,
      description,
      evidenceUrl,
      counterNoticeText,
    },
  };
}
