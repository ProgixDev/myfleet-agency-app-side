module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Babel skips node_modules by default, but several deps (zustand
    // devtools, some Supabase helpers) ship ESM with `import.meta.env`
    // which crashes Metro's CommonJS-wrapped web bundle. We force the
    // transform for those specific paths instead of widening to every
    // node_module (which would slow the build).
    overrides: [
      {
        test: /node_modules[\\/](zustand|@supabase|@opentelemetry)[\\/]/,
        plugins: [['babel-plugin-transform-import-meta', { module: 'ES6' }]],
      },
    ],
  };
};
