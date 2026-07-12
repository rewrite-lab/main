import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { parse as parseYaml } from "yaml";

function researchFrontmatterPlugin() {
  return {
    name: "research-frontmatter",
    enforce: "pre",
    async load(id) {
      const [filePath, query = ""] = id.split("?", 2);
      if (!query.split("&").includes("frontmatter")) return null;

      this.addWatchFile(filePath);
      const source = (await readFile(filePath, "utf8")).replace(/\r\n?/g, "\n");
      const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

      if (!match) {
        this.error(`Missing YAML frontmatter in ${filePath}`);
      }

      let metadata;
      try {
        metadata = parseYaml(match[1]) || {};
      } catch (error) {
        this.error(`Invalid YAML frontmatter in ${filePath}: ${error.message}`);
      }

      return `export default ${JSON.stringify(metadata)};`;
    },
  };
}

function staticImagesPlugin() {
  let rootDirectory;
  let outputDirectory;

  return {
    name: "static-images",
    configResolved(config) {
      rootDirectory = config.root;
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      await cp(
        path.resolve(rootDirectory, "img"),
        path.resolve(outputDirectory, "img"),
        { recursive: true, force: true },
      );
    },
  };
}

export default defineConfig({
  plugins: [researchFrontmatterPlugin(), staticImagesPlugin(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/katex/") || id.includes("/rehype-katex/")) return "article-math";
          if (/\/(?:react-markdown|remark-|rehype-|unified|mdast-|hast-|micromark|github-slugger|yaml)\//.test(id)) {
            return "article-markdown";
          }
          return undefined;
        },
      },
    },
  },
});
