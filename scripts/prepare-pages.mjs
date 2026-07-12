import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const researchDirectory = path.join(projectRoot, "src", "content", "research");
const outputDirectory = path.join(projectRoot, "dist");
const indexPath = path.join(outputDirectory, "index.html");
const languagePrefix = /^\[(?:ENG|EN|KOR|KR|KO)\]\s*/i;

function normalizeTitle(value) {
  return String(value || "").replace(languagePrefix, "").trim();
}

function titleKey(value) {
  return normalizeTitle(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

async function getResearchCount() {
  const files = (await readdir(researchDirectory)).filter((file) => file.endsWith(".md"));
  const titles = new Set();

  for (const file of files) {
    const source = (await readFile(path.join(researchDirectory, file), "utf8"))
      .replace(/\r\n?/g, "\n");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!frontmatter) throw new Error(`Missing YAML frontmatter in ${file}`);

    const metadata = parseYaml(frontmatter[1]) || {};
    const filenameTitle = file.replace(languagePrefix, "").replace(/\.md$/i, "");
    const title = normalizeTitle(metadata.title || filenameTitle);
    if (!title) throw new Error(`Missing research title in ${file}`);
    titles.add(titleKey(title));
  }

  if (titles.size === 0) throw new Error("No research Markdown files were found");
  return titles.size;
}

async function writeRoute(route, html) {
  const routeDirectory = path.join(outputDirectory, ...route.split("/"));
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, "index.html"), html);
}

const [indexHtml, researchCount] = await Promise.all([
  readFile(indexPath, "utf8"),
  getResearchCount(),
]);

await Promise.all([
  writeFile(path.join(outputDirectory, "404.html"), indexHtml),
  writeRoute("research", indexHtml),
  ...Array.from(
    { length: researchCount },
    (_, index) => writeRoute(`researchs/${index + 1}`, indexHtml),
  ),
]);

console.log(`Prepared GitHub Pages routes for ${researchCount} research entries.`);
