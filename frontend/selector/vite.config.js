import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    svgrPlugin(),
  ],

  build: {
    outDir: "../../www_static/assets/selector",

    emptyOutDir: true,

    assetsDir: "",
  },

  base: "/assets/selector/"
});
