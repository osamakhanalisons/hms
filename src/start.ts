// Initialize globalThis.app mock for Vinxi environment in dev runner
if (!globalThis.app) {
  globalThis.app = {
    config: {
      server: {
        experimental: {
          asyncContext: true,
        },
      },
    },
  } as any;
}

import {
  createStart,
  createMiddleware,
  createCsrfMiddleware,
} from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// CSRF protection for TanStack server functions
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Global error handling
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (
      error != null &&
      typeof error === "object" &&
      "statusCode" in error
    ) {
      throw error;
    }

    console.error(error);

    return new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    errorMiddleware,
  ],
}));