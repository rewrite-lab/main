import { resolveResearchAssetPath } from "./researchAssets";

const frontmatterModules = import.meta.glob("./content/research/*.md", {
  eager: true,
  import: "default",
  query: "?frontmatter",
});

const markdownLoaders = import.meta.glob("./content/research/*.md", {
  import: "default",
  query: "?raw",
});

const LANGUAGE_PREFIX = /^\[(?:ENG|EN|KOR|KR|KO)\]\s*/i;

export function normalizeResearchLanguage(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "KO" || normalized === "KR" || normalized === "KOR") return "KO";
  if (normalized === "EN" || normalized === "ENG") return "EN";
  return "";
}

function filenameDetails(sourcePath) {
  const filename = sourcePath.split("/").at(-1) || "";
  const language = normalizeResearchLanguage(filename.match(/^\[([^\]]+)\]/)?.[1]);
  return {
    language,
    title: filename.replace(LANGUAGE_PREFIX, "").replace(/\.md$/i, "").trim(),
  };
}

function normalizeTitle(value) {
  return String(value || "").replace(LANGUAGE_PREFIX, "").trim();
}

function titleKey(value) {
  return normalizeTitle(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

function normalizeDate(value) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || "";
}

function splitAuthorIds(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,|]/);
  return values
    .map((author) => String(author).trim().replace(/^@/, ""))
    .filter(Boolean);
}

function extractAuthorIds(metadata) {
  return splitAuthorIds(metadata.author);
}

function createDescriptor(sourcePath, load, metadata) {
  const filename = filenameDetails(sourcePath);
  const title = normalizeTitle(metadata.title || filename.title);
  const language = normalizeResearchLanguage(metadata.language || filename.language);
  const date = normalizeDate(metadata.date);

  if (!title || !language || !date) {
    throw new Error(
      `Research frontmatter requires title, date, and language: ${sourcePath}`,
    );
  }

  return {
    sourcePath,
    load,
    title,
    date,
    language,
    thumbnail: String(metadata.thumbnail || "").trim(),
    authorIds: extractAuthorIds(metadata),
  };
}

function buildResearchCatalog() {
  const grouped = new Map();

  for (const [sourcePath, load] of Object.entries(markdownLoaders)) {
    const metadata = frontmatterModules[sourcePath];
    if (!metadata) {
      throw new Error(`Frontmatter metadata was not loaded for ${sourcePath}`);
    }

    const descriptor = createDescriptor(sourcePath, load, metadata);
    const key = titleKey(descriptor.title);
    const entry = grouped.get(key) || {
      title: descriptor.title,
      dates: [],
      variants: {},
    };

    if (entry.variants[descriptor.language]) {
      throw new Error(
        `Duplicate ${descriptor.language} research variant for "${descriptor.title}"`,
      );
    }

    entry.variants[descriptor.language] = descriptor;
    entry.dates.push(descriptor.date);
    if (descriptor.language === "EN") entry.title = descriptor.title;
    grouped.set(key, entry);
  }

  return [...grouped.values()]
    .map((entry) => ({
      title: entry.title,
      date: [...entry.dates].sort()[0],
      variants: entry.variants,
      languages: ["EN", "KO"].filter((language) => entry.variants[language]),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .map((entry, index) => ({
      ...entry,
      number: index + 1,
    }));
}

export const researchCatalog = buildResearchCatalog();

const researchByNumber = new Map(
  researchCatalog.map((entry) => [entry.number, entry]),
);

export function getResearchEntry(number) {
  const parsedNumber = Number.parseInt(String(number), 10);
  return Number.isFinite(parsedNumber) ? researchByNumber.get(parsedNumber) || null : null;
}

export function getResearchDocument(entryOrNumber, preferredLanguage = "EN", allowFallback = true) {
  const entry =
    typeof entryOrNumber === "object" && entryOrNumber
      ? entryOrNumber
      : getResearchEntry(entryOrNumber);
  if (!entry) return null;

  const language = normalizeResearchLanguage(preferredLanguage) || "EN";
  if (entry.variants[language]) return entry.variants[language];
  if (!allowFallback) return null;
  return entry.variants.EN || entry.variants.KO || Object.values(entry.variants)[0] || null;
}

export function resolveResearchAssetUrl(value) {
  return resolveResearchAssetPath(value);
}
