import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '../src/config/env';
import { sendOtpEmail, getActiveEmailProvider } from '../src/utils/mailer';
import { ServiceUnavailableError } from '../src/utils/errors';
import { authService } from '../src/modules/auth/auth.service';
import { cleanupTestUsers } from './test.helper';

describe('Mailer Module Integration & Unit Tests', () => {
  const originalResendApiKey = env.RESEND_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanupTestUsers();
  });

  afterEach(() => {
    env.RESEND_API_KEY = originalResendApiKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Provider selection prefers Resend when RESEND_API_KEY is configured', () => {
    env.RESEND_API_KEY = 're_test_key_abc';
    expect(getActiveEmailProvider()).toBe('resend');

    env.RESEND_API_KEY = '';
    // With no SMTP or Resend, falls back to log_only (or smtp if SMTP_* is set in local .env)
    const fallback = getActiveEmailProvider();
    expect(['smtp', 'log_only']).toContain(fallback);
  });

  it('2. Successfully dispatches email via Resend HTTP API when fetch succeeds', async () => {
    env.RESEND_API_KEY = 're_valid_api_key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'email_msg_123' }),
      text: async () => JSON.stringify({ id: 'email_msg_123' }),
    });
    global.fetch = mockFetch;

    await sendOtpEmail('resend-test@example.com', '889900', 'account registration');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer re_valid_api_key');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['resend-test@example.com']);
    expect(body.subject).toBe('Your Gupshup code: 889900');
    expect(body.html).toContain('889900');
    expect(body.text).toContain('889900');
  });

  it('3. Throws 503 ServiceUnavailableError when Resend returns non-2xx status', async () => {
    env.RESEND_API_KEY = 're_invalid_api_key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ statusCode: 403, message: 'Domain not verified' }),
    });
    global.fetch = mockFetch;

    await expect(
      sendOtpEmail('resend-fail@example.com', '112233', 'account registration')
    ).rejects.toThrow(ServiceUnavailableError);

    try {
      await sendOtpEmail('resend-fail@example.com', '112233', 'account registration');
    } catch (err: any) {
      expect(err.statusCode).toBe(503);
      expect(err.message).toBe("We couldn't send the email right now. Please try again.");
    }
  });

  it('4. Does not lock user into cooldown when Resend email send fails', async () => {
    env.RESEND_API_KEY = 're_broken_key';

    // Mock failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Resend Error',
    });

    const testEmail = 'resend_cooldown_test@example.com';

    // First attempt fails to send email
    await expect(authService.requestSignupCode(testEmail)).rejects.toThrow(ServiceUnavailableError);

    // Second attempt right after: should NOT trigger 429 OTP_COOLDOWN because cooldown was rolled back!
    // It should try sending again (which fails with 503 again, not 429)
    await expect(authService.requestSignupCode(testEmail)).rejects.toThrow(ServiceUnavailableError);
  });
});
