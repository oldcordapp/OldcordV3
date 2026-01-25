export default {
  '*.{ts,tsx,mts,cts,json,jsonc,json5,md}': (filenames) => {
    const validFiles = filenames.filter((f) => !f.endsWith('package-lock.json'));
    if (validFiles.length === 0) return [];

    const files = validFiles.map((f) => `"${f}"`).join(' ');

    return [
      `npx --node-options='--experimental-strip-types' eslint --flag unstable_native_nodejs_ts_config --fix ${files}`,
      `prettier --write ${files}`,
    ];
  },
  '*.css': (filenames) => {
    const files = filenames.map((f) => `"${f}"`).join(' ');

    return [
      `npx --node-options='--experimental-strip-types' eslint --flag unstable_native_nodejs_ts_config --fix ${files}`,
      `stylelint -o "stylelint.log" --fix ${files}`,
      `prettier --write ${files}`,
    ];
  },
  '*.{html,yml,yaml}': (filenames) => {
    const files = filenames.map((f) => `"${f}"`).join(' ');
    return `prettier --write ${files}`;
  },
};
