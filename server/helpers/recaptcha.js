export async function verify(answer) {
  if (!global.config.captcha_config.secret_key) return false;

  if (answer === null) return false;

  const params = new URLSearchParams();

  params.append('secret', global.config.captcha_config.secret_key);
  params.append('response', answer);

  const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = await response.json();

  return data.success;
}
