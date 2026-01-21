import { execSync } from 'child_process';

export default {
  '*.{js,ts,jsx,tsx,mjs,mts,cjs,cts,json,jsonc,json5,md,css}': (filenames) => {
    const validFiles = filenames.filter((f) => !f.endsWith('package-lock.json'));
    if (validFiles.length === 0) return [];

    const files = validFiles.map((f) => `"${f}"`).join(' ');

    // We do not want to enforce people to fix their linter errors before committing yet during the transition period
    // When we finally convert the whole project to TS, please replace the following with
    // return [`eslint --fix ${files}`, `prettier --write ${files}`]
    // to enforce fixing linting before committing
    try {
      execSync(`npx eslint --fix ${files}`, { stdio: 'inherit' });
    } catch {
      // If we don't use a try block, execSync will error for some reason.
    }

    try {
      execSync(`npx prettier --write ${files}`, { stdio: 'inherit' });
    } catch {
      // Silently swallow errors
    }

    return [];
  },
  '*.{html,yml,yaml}': (filenames) => {
    return `prettier --write ${filenames}`;
  },
};
