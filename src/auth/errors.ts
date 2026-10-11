import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { t, type PlainStringId } from '../strings/index.ts';

const BY_CODE: Record<string, PlainStringId> = {
  otp_expired: 'logInd.fejl.forkertKode', // Supabase uses it for wrong and expired codes alike
  over_email_send_rate_limit: 'logInd.fejl.forHurtigt',
  over_request_rate_limit: 'logInd.fejl.forHurtigt',
  validation_failed: 'logInd.fejl.email',
  email_address_invalid: 'logInd.fejl.email',
};

/** The Danish message for an error from sending or checking a login code. */
export function authErrorText(error: unknown): string {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return t('offline.proevIgen');
  if (isAuthApiError(error) && error.code && error.code in BY_CODE) return t(BY_CODE[error.code]);
  return t('fejl.ukendt');
}
