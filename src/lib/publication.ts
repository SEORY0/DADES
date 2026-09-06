import { z } from 'astro:content';

const httpsUrlSchema = z.string().trim().url().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'must be a valid HTTPS URL');

const emailSchema = z.string().trim().email();
const defaultContactEmail = 'dades.mag@gmail.com';

const optionalEnv = (name: string): string | null => {
  const value = import.meta.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseOptionalEnv = (name: string, schema: z.ZodType<string>): string | null => {
  const value = optionalEnv(name);
  if (value === null) return null;

  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new Error(`Invalid ${name}: ${result.error.issues.map((issue) => issue.message).join(', ')}`);
};

export const publicationConfig = {
  newsletterUrl: parseOptionalEnv('PUBLIC_NEWSLETTER_URL', httpsUrlSchema),
  contactEmail: parseOptionalEnv('PUBLIC_CONTACT_EMAIL', emailSchema) ?? defaultContactEmail,
  publicationCadence: 'weekly',
} as const;

export const consultationMailto = (subject: string, body: string): string => {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${publicationConfig.contactEmail}?${params.toString()}`;
};
