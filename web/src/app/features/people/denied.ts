import { ApiError } from '../../api/client';
import type { Resource } from '../../lib/data';

/**
 * A card is hidden when the profile does not open it, and also when Backend answers 403 in
 * between: the owner has just closed it. A lost session is not that: it shows the load error.
 */
export function isDenied(allowed: boolean, resource: Resource<unknown>): boolean {
  return !allowed || (resource.error instanceof ApiError && resource.error.isForbidden);
}
