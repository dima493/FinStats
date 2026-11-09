import { createSiteContext, createDatabaseClient, errorResponse } from './_qoder/backend.mjs';
import { createApplication } from './router.mjs';
import { PUBLIC_ORIGIN } from './http.mjs';

// forwardApplicationCredentials keeps this application's own session cookie;
// identity is fully self-held, with no platform identity fallback.
const handle = createApplication({ db: createDatabaseClient(), origin: PUBLIC_ORIGIN });

Deno.serve(async (request) => {
  let context;
  try {
    context = createSiteContext(request, { forwardApplicationCredentials: true });
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});