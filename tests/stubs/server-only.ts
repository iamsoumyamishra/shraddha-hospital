// Vitest resolves the "server-only" client stub, which throws outside the RSC
// bundler. Integration tests genuinely run on the server, so the guard is a no-op.
export {};
