const { execSync } = require('child_process');

try {
    const gitHash = execSync('git rev-parse --short HEAD').toString().trim();

    process.env.VITE_APP_GIT_COMMIT_HASH = gitHash;

    const args = process.argv.slice(2);
    if (args.length > 0) {
        execSync(args.join(' '), { stdio: 'inherit' });
    }

} catch (error) {
    console.error('Error getting git hash or running command:', error);
    process.exit(1);
}