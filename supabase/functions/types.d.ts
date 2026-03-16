declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  type Handler = (request: Request) => Response | Promise<Response>;

  export function serve(handler: Handler): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  type QueryBuilder = {
    select: (columns: string) => QueryBuilder;
    eq: (column: string, value: string) => QueryBuilder;
    single: <T>() => Promise<{ data: T | null; error: { message: string } | null }>;
    upsert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };

  export function createClient(url: string, key: string): {
    auth: {
      getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
    };
    from: (table: string) => QueryBuilder;
  };
}