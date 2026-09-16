/**
 * Server-side admin authorization utility.
 * The Admin Portal endpoints are strictly restricted to the authorized administrator email.
 */

export function getAuthorizedAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || 'kwash904@gmail.com').toLowerCase().trim();
}

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const authorizedEmail = getAuthorizedAdminEmail();
  return normalized === authorizedEmail;
}
