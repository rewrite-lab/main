import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { parse as parseYaml } from "yaml";

function researchMarkdownPlugin() {
  let researchDirectory;

  return {
    name: "research-markdown",
    enforce: "pre",
    configResolved(config) {
      researchDirectory = path.resolve(config.root, "src/content/research");
    },
    async load(id) {
      const [filePath, query = ""] = id.split("?", 2);
      const queryParts = new Set(query.split("&"));
      const loadsFrontmatter = queryParts.has("frontmatter");
      const loadsRawMarkdown = queryParts.has("research-document");
      const relativePath = path.relative(researchDirectory, filePath);
      const isResearchMarkdown =
        filePath.endsWith(".md") &&
        relativePath !== "" &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath);

      if ((!loadsFrontmatter && !loadsRawMarkdown) || !isResearchMarkdown) {
        return null;
      }

      this.addWatchFile(filePath);
      const source = (await readFile(filePath, "utf8")).replace(/\r\n?/g, "\n");
      if (loadsRawMarkdown) {
        return `export default ${JSON.stringify(source)};`;
      }

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
  plugins: [researchMarkdownPlugin(), staticImagesPlugin(), react()],
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
