import { getResponse, type RequestHandler } from 'msw';
import type { IncomingMessage } from 'node:http';
import { createServer, type Connect, type Plugin } from 'vite';

const ENTRY = '/src/app/test/demo/index.ts';

type Load = () => Promise<Record<string, unknown>>;

/** Answers `/api/*` from the demo handlers; everything else goes on. */
function answerApi(load: Load): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (!request.url?.startsWith('/api/')) return next();
    void (async () => {
      const handlers = (await load()).handlers as RequestHandler[];
      const answer =
        (await getResponse(handlers, await fetchRequestOf(request))) ??
        Response.json(
          {
            success: false,
            data: null,
            error: {
              message: `No demo handler for ${request.method} ${request.url}`,
              code: 'not_found',
            },
          },
          { status: 404 },
        );
      response.statusCode = answer.status;
      answer.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await answer.arrayBuffer()));
    })().catch(next);
  };
}

/**
 * `npm run dev:demo` and `npm run preview:demo`: the server answers `/api/*` itself from the
 * handlers in this directory, so every section of the cabinet opens signed in, on invented data,
 * without a Backend and without the owner's phone. Under `dev:demo` the handlers are reloaded when
 * their files change. Never part of a build.
 */
export function demoBackend(): Plugin {
  return {
    name: 'demo-backend',
    configureServer(server) {
      server.middlewares.use(answerApi(() => server.ssrLoadModule(ENTRY)));
    },
    async configurePreviewServer(preview) {
      // The preview serves built files and cannot load a module: a bare Vite server reads the
      // handlers from the sources for it.
      const loader = await createServer({
        configFile: false,
        root: preview.config.root,
        appType: 'custom',
        logLevel: 'error',
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      preview.middlewares.use(answerApi(() => loader.ssrLoadModule(ENTRY)));
      preview.httpServer.once('close', () => void loader.close());
    },
  };
}

async function fetchRequestOf(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const method = request.method ?? 'GET';
  const chunks: Buffer[] = [];
  if (method !== 'GET' && method !== 'HEAD') {
    for await (const chunk of request) chunks.push(chunk as Buffer);
  }
  return new Request(`http://${request.headers.host ?? 'localhost'}${request.url}`, {
    method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
}
