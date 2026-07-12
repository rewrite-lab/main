import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { parse as parseYaml } from "yaml";
import { resolveResearchAssetPath } from "./researchAssets";

const LANGUAGE_PREFIX = /^\[(?:ENG|EN|KOR|KR|KO)\]\s*/i;

function parseFrontMatter(rawSource) {
  const source = rawSource.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { metadata: {}, body: source };

  let metadata = {};
  try {
    metadata = parseYaml(match[1]) || {};
  } catch (error) {
    throw new Error(`Invalid article front matter: ${error.message}`);
  }

  return {
    metadata,
    body: source.slice(match[0].length),
  };
}

function normalizeLanguage(value, sourcePath) {
  const explicit = String(value || "").toLowerCase();
  if (explicit === "kr" || explicit === "ko" || explicit === "korean") return "KO";
  if (explicit === "en" || explicit === "eng" || explicit === "english") return "EN";
  return /\[(?:KOR|KR|KO)\]/i.test(sourcePath) ? "KO" : "EN";
}

function normalizeTitle(value) {
  return String(value || "").replace(LANGUAGE_PREFIX, "").trim();
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function splitAuthorList(value) {
  if (Array.isArray(value)) return value.flatMap(splitAuthorList);
  return String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractAuthorIds(metadata) {
  return splitAuthorList(metadata.author);
}

function extractToc(body) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body);
  const slugger = new GithubSlugger();
  const toc = [];

  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    const label = toString(node).trim();
    if (!label) continue;
    const id = slugger.slug(label);
    if (node.depth <= 2) toc.push({ id, label, depth: node.depth });
  }

  return toc;
}

export function parseMarkdownDocument(sourcePath, rawSource) {
  const { metadata, body } = parseFrontMatter(rawSource);
  return {
    sourcePath,
    metadata,
    body,
    title: normalizeTitle(metadata.title),
    language: normalizeLanguage(metadata.language, sourcePath),
    date: normalizeDate(metadata.date),
    thumbnail: String(metadata.thumbnail || ""),
    tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
    authorIds: extractAuthorIds(metadata),
    toc: extractToc(body),
  };
}

export function resolveDocumentAuthors(document, teamMembers) {
  const memberIndex = new Map(
    teamMembers.map((member) => [member.name.replace(/^@/, "").toLowerCase(), member]),
  );
  const ids = document.authorIds.length ? document.authorIds : ["Rewrite Lab"];

  return ids.map((id) => {
    const member = memberIndex.get(id.replace(/^@/, "").toLowerCase());
    if (member) {
      return {
        id,
        name: member.name,
        image: member.img,
      };
    }
    return {
      id,
      name: id,
      image: "",
    };
  });
}

export function remarkArticleStructure() {
  return (tree) => {
    const slugger = new GithubSlugger();
    const output = [];
    let currentSection = null;

    for (const originalNode of tree.children) {
      if (originalNode.type !== "heading") {
        if (currentSection) currentSection.children.push(originalNode);
        else output.push(originalNode);
        continue;
      }

      const label = toString(originalNode).trim();
      const id = slugger.slug(label || "section");
      const originalDepth = originalNode.depth;
      const heading = {
        ...originalNode,
        depth: Math.min(6, originalDepth + 1),
      };

      if (originalDepth === 1) {
        currentSection = {
          type: "articleSection",
          data: {
            hName: "section",
            hProperties: { id },
          },
          children: [heading],
        };
        output.push(currentSection);
      } else {
        heading.data = {
          ...(heading.data || {}),
          hProperties: {
            ...(heading.data?.hProperties || {}),
            id,
          },
        };
        if (currentSection) currentSection.children.push(heading);
        else output.push(heading);
      }
    }

    tree.children = output;
  };
}

export function resolveResearchAsset(value) {
  return resolveResearchAssetPath(value);
}
