import esbuild from "esbuild";

const config = {
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "../www_static/assets/oldplunger/index.js",
  format: "esm",
  platform: "browser",
  sourcemap: true,
  minify: true,
};

const isWatchMode = process.argv.includes("--watch");

async function run() {
  if (isWatchMode) {
    console.log("Starting esbuild in watch mode...");
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("Watching for file changes...");
  } else {
    console.log("Running a single esbuild build...");
    await esbuild.build(config);
    console.log("Build complete.");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
