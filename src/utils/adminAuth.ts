/**
 * Admin authorization utility for client-side view gating.
 * The Admin Portal is strictly restricted to designated email address(es).
 */

export const getAuthorizedAdminEmail = (): string => {
  return (import.meta.env.VITE_ADMIN_EMAIL || 'kwash904@gmail.com').toLowerCase().trim();
};

export const isUserAdmin = (user: { email?: string; role?: string } | null | undefined): boolean => {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase().trim();
  const authorizedEmail = getAuthorizedAdminEmail();
  return email === authorizedEmail;
};
