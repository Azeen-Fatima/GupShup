import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../src/config/env';
import { sendOtpEmail, getActiveEmailProvider, buildRawMimeMessage } from '../src/utils/mailer';
import { ServiceUnavailableError } from '../src/utils/errors';
import { authService } from '../src/modules/auth/auth.service';
import { cleanupTestUsers } from './test.helper';

describe('Mailer Module Integration & Unit Tests', () => {
  const originalResendApiKey = env.RESEND_API_KEY;
  const originalGmailClientId = env.GMAIL_CLIENT_ID;
  const originalGmailClientSecret = env.GMAIL_CLIENT_SECRET;
  const originalGmailRefreshToken = env.GMAIL_REFRESH_TOKEN;
  const originalGmailSender = env.GMAIL_SENDER;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await cleanupTestUsers();
  });

  afterEach(() => {
    env.RESEND_API_KEY = originalResendApiKey;
    env.GMAIL_CLIENT_ID = originalGmailClientId;
    env.GMAIL_CLIENT_SECRET = originalGmailClientSecret;
    env.GMAIL_REFRESH_TOKEN = originalGmailRefreshToken;
    env.GMAIL_SENDER = originalGmailSender;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Provider priority prefers Gmail API over Resend and SMTP when GMAIL_ vars are set', () => {
    env.GMAIL_CLIENT_ID = 'gmail_client_id_123';
    env.GMAIL_CLIENT_SECRET = 'gmail_client_secret_456';
    env.GMAIL_REFRESH_TOKEN = 'gmail_refresh_token_789';
    env.RESEND_API_KEY = 're_test_key_abc';

    // When all 3 Gmail credentials are set, provider is gmail
    expect(getActiveEmailProvider()).toBe('gmail');

    // If one Gmail credential is missing, falls back to Resend
    env.GMAIL_REFRESH_TOKEN = '';
    expect(getActiveEmailProvider()).toBe('resend');

    // If Resend is also missing, falls back to SMTP or log_only
    env.RESEND_API_KEY = '';
    const fallback = getActiveEmailProvider();
    expect(['smtp', 'log_only']).toContain(fallback);
  });

  it('2. Successfully dispatches email via Gmail API users.messages.send with base64url MIME payload', async () => {
    env.GMAIL_CLIENT_ID = 'mock_client_id';
    env.GMAIL_CLIENT_SECRET = 'mock_client_secret';
    env.GMAIL_REFRESH_TOKEN = 'mock_refresh_token';
    env.GMAIL_SENDER = 'Gupshup <notifications@gupshup.test>';

    const mockAccessToken = 'ya29.mock_google_oauth2_access_token_xyz';
    vi.spyOn(OAuth2Client.prototype, 'getAccessToken').mockResolvedValue({
      token: mockAccessToken,
      res: null,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail_msg_98765' }),
      text: async () => JSON.stringify({ id: 'gmail_msg_98765' }),
    });
    global.fetch = mockFetch;

    await sendOtpEmail('azeen_test@example.com', '456789', 'login confirmation');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe(`Bearer ${mockAccessToken}`);
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.raw).toBeDefined();

    // Decode base64url message and verify contents
    const decodedMime = Buffer.from(body.raw, 'base64url').toString('utf-8');
    expect(decodedMime).toContain('From: Gupshup <notifications@gupshup.test>');
    expect(decodedMime).toContain('To: azeen_test@example.com');
    expect(decodedMime).toContain('MIME-Version: 1.0');
    expect(decodedMime).toContain('456789');
  });

  it('3. Throws 503 ServiceUnavailableError when Gmail API returns non-2xx status', async () => {
    env.GMAIL_CLIENT_ID = 'mock_client_id';
    env.GMAIL_CLIENT_SECRET = 'mock_client_secret';
    env.GMAIL_REFRESH_TOKEN = 'mock_refresh_token';

    vi.spyOn(OAuth2Client.prototype, 'getAccessToken').mockResolvedValue({
      token: 'mock_token',
      res: null,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: 'Invalid recipient address' } }),
    });

    await expect(
      sendOtpEmail('bad_recipient@example.com', '123456', 'signup')
    ).rejects.toThrow(ServiceUnavailableError);
  });

  it('4. Throws 503 ServiceUnavailableError when Google OAuth2 token retrieval fails', async () => {
    env.GMAIL_CLIENT_ID = 'mock_client_id';
    env.GMAIL_CLIENT_SECRET = 'mock_client_secret';
    env.GMAIL_REFRESH_TOKEN = 'mock_refresh_token';

    vi.spyOn(OAuth2Client.prototype, 'getAccessToken').mockRejectedValue(
      new Error('invalid_grant: Bad Request')
    );

    await expect(
      sendOtpEmail('test_token_fail@example.com', '123456', 'signup')
    ).rejects.toThrow(ServiceUnavailableError);
  });

  it('5. Successfully dispatches email via Resend HTTP API when fetch succeeds', async () => {
    env.GMAIL_CLIENT_ID = '';
    env.GMAIL_CLIENT_SECRET = '';
    env.GMAIL_REFRESH_TOKEN = '';
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

  it('6. Throws 503 ServiceUnavailableError when Resend returns non-2xx status', async () => {
    env.GMAIL_CLIENT_ID = '';
    env.GMAIL_CLIENT_SECRET = '';
    env.GMAIL_REFRESH_TOKEN = '';
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
  });

  it('7. Does not lock user into cooldown when Resend email send fails', async () => {
    env.GMAIL_CLIENT_ID = '';
    env.GMAIL_CLIENT_SECRET = '';
    env.GMAIL_REFRESH_TOKEN = '';
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

    // Second attempt right after: should NOT trigger 429 OTP_COOLDOWN because cooldown was rolled back
    await expect(authService.requestSignupCode(testEmail)).rejects.toThrow(ServiceUnavailableError);
  });
});
