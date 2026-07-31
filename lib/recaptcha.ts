export async function verifyRecaptchaToken(token: string): Promise<void> {
  const response = await fetch("/api/recaptcha/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  let payload: { success?: boolean; error?: string } = {};
  try {
    payload = (await response.json()) as { success?: boolean; error?: string };
  } catch {
    // ignore parse errors — fall through to generic message
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "reCAPTCHA verification failed. Please try again.");
  }
}
