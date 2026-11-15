import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  DEFAULT_AI_MENTOR_CONFIG,
  estimateTokens,
  type MentorMode,
} from '../lib/ai/mentor-limits.ts';

export type { MentorMode };

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface MentorRequest {
  prompt: string;
  mode: MentorMode;
  language: 'en' | 'hi';
  level: 'beginner' | 'intermediate' | 'advanced';
  maxResponseTokens?: number;
}

export interface MentorUsageMetadata {
  promptTokens: number;
  responseTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  fromProviderMetadata: boolean;
}

export interface MentorResponse {
  reply: string;
  model: string;
  usage: MentorUsageMetadata;
}

export async function askAiCyberMentor(input: MentorRequest): Promise<MentorResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('AI Cyber Mentor requires GEMINI_API_KEY configured in server Secrets.');
  }

  const maxOutputTokens = Math.max(
    100,
    Math.min(8192, Math.floor(input.maxResponseTokens ?? DEFAULT_AI_MENTOR_CONFIG.maxResponseTokens)),
  );

  const langDirective =
    input.language === 'hi'
      ? 'Respond in clear, natural Hindi (Devanagari script) while keeping technical CLI commands and code keywords in English.'
      : 'Respond in clear, structured English.';

  const levelDirective =
    input.level === 'beginner'
      ? 'Explain gently from first principles with concrete analogies.'
      : input.level === 'intermediate'
        ? 'Focus on practical defensive and analytical mechanics.'
        : 'Provide deep architectural, protocol-level, and defensive/research engineering rigor.';

  const modeDirective =
    input.mode === 'teach_me'
      ? 'Teach interactively: present 1) Core mental model, 2) Defensive mechanism & example command/code, 3) Quick self-check question.'
      : input.mode === 'practice_questions'
        ? 'Generate 3 defensive cybersecurity practice questions matching the topic and level, followed by a clearly separated Answer Key & Explanations section at the bottom.'
        : input.mode === 'research_assistant'
          ? 'Act as a cybersecurity research advisor: break down threat models, academic security primitives, verifiable references, and open engineering problems.'
          : input.mode === 'career_guidance'
            ? 'Provide concrete skill-gap guidance, role responsibilities, portfolio lab ideas, and study roadmap for cybersecurity careers.'
            : `Mode selected: ${input.mode}.`;

  const systemInstruction = `You are the KALI3977 AI Cyber Mentor — a defensive and ethical cybersecurity educator.
Strict safety and educational rules:
1. Distinguish clearly between authorized educational lab simulations and real-world targets.
2. NEVER provide actionable exploit payloads, malware, phishing kits, or instructions to attack real-world systems, domains, or organizations. If asked to attack a real target, refuse politely and pivot to defensive/lab concepts.
3. For CTF hint mode, guide the learner's reasoning step-by-step without revealing an exact flag or immediate answer.
4. Keep responses concise, structured with headings/code blocks where helpful, accurate, and within approximately ${maxOutputTokens} output tokens.
5. ${langDirective}
6. ${levelDirective}
7. ${modeDirective}`;

  const model = 'gemini-4-hydrogen';
  const response = await ai.models.generateContent({
    model,
    contents: input.prompt,
    config: {
      systemInstruction,
      maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('AI Cyber Mentor returned an empty response.');
  }

  const meta = response.usageMetadata;
  const fromProviderMetadata = Boolean(
    meta &&
      (typeof meta.promptTokenCount === 'number' ||
        typeof meta.candidatesTokenCount === 'number' ||
        typeof meta.totalTokenCount === 'number'),
  );

  const promptTokens =
    typeof meta?.promptTokenCount === 'number'
      ? Math.max(0, meta.promptTokenCount)
      : estimateTokens(input.prompt);
  const responseTokens =
    typeof meta?.candidatesTokenCount === 'number'
      ? Math.max(0, meta.candidatesTokenCount)
      : estimateTokens(text);
  const thinkingTokens =
    typeof meta?.thoughtsTokenCount === 'number' ? Math.max(0, meta.thoughtsTokenCount) : 0;
  const totalTokens =
    typeof meta?.totalTokenCount === 'number'
      ? Math.max(promptTokens + responseTokens + thinkingTokens, meta.totalTokenCount)
      : promptTokens + responseTokens + thinkingTokens;

  return {
    reply: text,
    model,
    usage: {
      promptTokens,
      responseTokens,
      thinkingTokens,
      totalTokens,
      fromProviderMetadata,
    },
  };
}
