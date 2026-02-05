export interface RecaptchaSiteVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verify(answer: string): Promise<boolean> {
  const secret = (global as any).config?.captcha_config?.secret_key;

  if (!secret || !answer) {
    return false;
  }

  try {
    const params = new URLSearchParams();
    
    params.append('secret', secret);
    params.append('response', answer);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as RecaptchaSiteVerifyResponse;

    return !!data.success;
  } catch (error) {
    return false;
  }
}
