export default {
  '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,json5,md,css}': (filenames) => {
    const validFiles = filenames.filter((f) => !f.endsWith('package-lock.json'));
    if (validFiles.length === 0) return [];

    const files = validFiles.map((f) => `"${f}"`).join(' ');

    return [`npx @biomejs/biome check --write ${files}`];
  },
};
