import { Forbidden } from '../utils/errors.js';
import { policies } from './policies.js';

/**
 * Pure function: returns true/false.
 * Use in services or anywhere you need a check without throwing.
 */
export function can(actor, action, resource = null) {
  const policy = policies[action];
  if (!policy) {
    console.warn(`[authz] No policy for action: ${action} — denying by default`);
    return false;
  }
  return policy(actor, resource);
}

/**
 * Express middleware factory: throws Forbidden if `can` returns false.
 * Loader is an optional async fn that fetches the resource before checking.
 *
 *   router.post('/sessions/:id/start',
 *     authenticate,
 *     authorize('session.start', (req) => Session.findById(req.params.id)),
 *     controller.startSession
 *   );
 */
export function authorize(action, loader = null) {
  return async (req, _res, next) => {
    try {
      const resource = loader ? await loader(req) : null;
      if (loader && !resource) return next(Forbidden('Resource not found'));

      if (!can(req.actor, action, resource)) return next(Forbidden());

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}