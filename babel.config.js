module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Metro's web bundler wraps modules in CommonJS, so any `import.meta`
      // (used by some Supabase / OpenTelemetry / Stripe deps) crashes with
      // "Cannot use 'import.meta' outside a module". This plugin rewrites
      // those references to a CommonJS-safe stub.
      ['babel-plugin-transform-import-meta', { module: 'ES6' }],
    ],
  };
};
