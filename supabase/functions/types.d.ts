declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  type Handler = (request: Request) => Response | Promise<Response>;

  export function serve(handler: Handler): void;
}