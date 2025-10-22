import esbuild from "esbuild";
import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

// We need to mock the browser-specific objects if we allow plugins to reference them.

if (typeof globalThis.window === "undefined") {
  globalThis.window = {};
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement: () => ({ style: {} }),
    body: { style: {} },
  };
}
if (typeof globalThis.navigator === "undefined") {
  globalThis.navigator = {};
}

const PLUGINS_DIR = "src/plugins";
const OUTPUT_DIR = "../www_static/assets/oldplunger";

const METADATA_FILE = path.join(OUTPUT_DIR, "plugins.json");
const PLUGIN_EXPORT_FILE = "src/plugins/plugins.export.js";

async function generatePluginData() {
  console.log("Generating plugin data...");

  const pluginDirs = (await fs.readdir(PLUGINS_DIR, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const allMetadata = {};
  const exportContent = [];
  const keysToExcludeFromMetadata = ["patches", "doNotDebug"];
  const onlyAllowedTypes = ["string", "number", "boolean", "object", "bigint"];

  for (const dirName of pluginDirs) {
    const pluginPath = path.resolve(PLUGINS_DIR, dirName, "index.js");
    try {
      const module = await import(
        `${pathToFileURL(pluginPath).href}?t=${Date.now()}`
      );
      const plugin = module.default;

      if (!plugin || !plugin.name) {
        console.warn(
          `WARN: Plugin in '${dirName}' is missing a default export or a name.`
        );
        continue;
      }

      const metadata = { ...plugin };
      keysToExcludeFromMetadata.forEach((key) => delete metadata[key]);

      Object.keys(metadata).forEach((key) => {
        if (!onlyAllowedTypes.includes(typeof metadata[key])) {
          delete metadata[key];
        }
      });

      allMetadata[dirName] = metadata;

      exportContent.push(
        `export { default as ${dirName} } from './${dirName}/index.js';`
      );
    } catch (e) {
      console.error(`ERROR! Failed to process plugin in '${dirName}':`, e);
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(METADATA_FILE, JSON.stringify(allMetadata, null, 2));
  console.log(`Wrote plugin metadata to ${METADATA_FILE}`);

  await fs.writeFile(PLUGIN_EXPORT_FILE, exportContent.join("\n"));
  console.log(`Generated plugin exports at ${PLUGIN_EXPORT_FILE}`);
}

const pluginDataGenerator = {
  name: "pluginDataGenerator",
  setup(build) {
    build.onStart(async () => {
      try {
        await generatePluginData();
      } catch (error) {
        console.error("Error generating plugin data:", error);
      }
    });
  },
};

const config = {
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: path.join(OUTPUT_DIR, "index.js"),
  format: "esm",
  platform: "browser",
  sourcemap: true,
  minify: true,
  plugins: [pluginDataGenerator],
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
