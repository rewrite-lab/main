import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Highlight, Prism, themes } from "prism-react-renderer";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  parseMarkdownDocument,
  remarkArticleStructure,
  resolveDocumentAuthors,
  resolveResearchAsset,
} from "./researchContent";
import "./article.css";

const articleSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [...new Set([...(defaultSchema.tagNames || []), "video", "source"])],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "className"],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ["className", /^language-[\w.+#-]+$/],
      ["className", "math-inline", "math-display"],
    ],
    div: [...(defaultSchema.attributes?.div || []), ["className", "math", "math-display"]],
    img: [...(defaultSchema.attributes?.img || []), "src", "loading", "decoding"],
    source: [...(defaultSchema.attributes?.source || []), "src", "srcSet", "type", "media"],
    span: [...(defaultSchema.attributes?.span || []), ["className", "math", "math-inline"]],
    video: [
      "autoPlay",
      "controls",
      "height",
      "loop",
      "muted",
      "playsInline",
      "poster",
      "preload",
      "src",
      "width",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    poster: ["http", "https"],
    src: ["http", "https"],
  },
};

const PRISM_LANGUAGE_ALIASES = {
  "c++": "cpp",
  "c#": "csharp",
  bash: "bash",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  css: "css",
  diff: "diff",
  go: "go",
  html: "markup",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  kotlin: "kotlin",
  markdown: "markdown",
  md: "markdown",
  objectivec: "objectivec",
  objc: "objectivec",
  plaintext: "plain",
  py: "python",
  python: "python",
  rust: "rust",
  shell: "bash",
  sh: "bash",
  sql: "sql",
  swift: "swift",
  text: "plain",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  xml: "markup",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

if (!Prism.languages.diff) {
  Prism.languages.diff = {
    coord: [
      /^(?:\*{3}|-{3}|\+{3}).*$/m,
      /^@@.*@@.*$/m,
    ],
    deleted: {
      pattern: /^-.+$/m,
      alias: "deleted",
    },
    inserted: {
      pattern: /^\+.+$/m,
      alias: "inserted",
    },
  };
}

function resolvePrismLanguage(language) {
  const normalized = language.toLowerCase();
  const prismLanguage = PRISM_LANGUAGE_ALIASES[normalized] || normalized;
  return Prism.languages[prismLanguage] ? prismLanguage : "plain";
}

function ArticleBodyImage({ src = "", alt = "", ...props }) {
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => setLoadFailed(false), [src]);
  if (!src || loadFailed) return null;

  return (
    <img
      {...props}
      className="article-body-image"
      src={resolveResearchAsset(src)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setLoadFailed(true)}
    />
  );
}

const markdownComponents = {
  a({ node: _node, href = "", children, ...props }) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        {...props}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  img({ node: _node, src = "", alt = "", ...props }) {
    return <ArticleBodyImage {...props} src={src} alt={alt} />;
  },
  video({ node: _node, poster, src, children, ...props }) {
    const resolvedPoster = poster ? resolveResearchAsset(poster) : undefined;
    const resolvedSource = src ? resolveResearchAsset(src) : undefined;
    return (
      <video
        {...props}
        className="article-body-video"
        poster={resolvedPoster}
        src={resolvedSource}
      >
        {children}
      </video>
    );
  },
  source({ node: _node, src, ...props }) {
    return <source {...props} src={resolveResearchAsset(src)} />;
  },
  pre({ node: _node, children }) {
    const codeElement = React.Children.toArray(children)[0];
    const className = React.isValidElement(codeElement) ? codeElement.props.className || "" : "";
    const language = className.match(/language-([\w.+#-]+)/)?.[1] || "code";
    const code = React.isValidElement(codeElement)
      ? String(codeElement.props.children ?? "").replace(/\n$/, "")
      : String(children ?? "").replace(/\n$/, "");

    return (
      <div className="article-code-card" data-label={language}>
        <Highlight theme={themes.vsDark} code={code} language={resolvePrismLanguage(language)}>
          {({ className: prismClassName, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={prismClassName} style={{ color: style.color }}>
              <code>{tokens.map((line, lineIndex) => {
                const lineProps = getLineProps({ line });
                return (
                  <React.Fragment key={lineIndex}>
                    <span {...lineProps}>
                      {line.map((token, tokenIndex) => {
                        const tokenProps = getTokenProps({ token });
                        return (
                          <span {...tokenProps} key={tokenIndex}>
                            {token.empty ? "" : tokenProps.children}
                          </span>
                        );
                      })}
                    </span>
                    {lineIndex < tokens.length - 1 ? "\n" : null}
                  </React.Fragment>
                );
              })}</code>
            </pre>
          )}
        </Highlight>
      </div>
    );
  },
  table({ node: _node, children, ...props }) {
    return (
      <div className="article-table-wrap">
        <table {...props}>{children}</table>
      </div>
    );
  },
  input({ node: _node, ...props }) {
    return <input {...props} disabled />;
  },
};

function articleUrlTransform(url, key) {
  if ((key === "src" || key === "poster") && String(url).startsWith("/")) {
    return resolveResearchAsset(url);
  }
  return defaultUrlTransform(url);
}

function formatArticleDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function initialsFor(name) {
  const clean = name.replace(/^@/, "").trim();
  const words = clean.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ArticleHeader({ language, languages, onLanguageChange, onNavigateHome, onNavigateResearch }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateHome = (event, hash) => {
    setMenuOpen(false);
    onNavigateHome(event, hash);
  };

  const navigateResearch = (event) => {
    setMenuOpen(false);
    onNavigateResearch(event);
  };

  return (
    <header className="article-site-header">
      <div className="article-container article-header-inner">
        <a className="article-brand" href="/" aria-label="Rewrite Lab" onClick={navigateHome}>
          <i className="article-brand-mark" aria-hidden="true" />
          <span>Rewrite</span><span className="article-brand-outline">Lab</span>
        </a>
        <nav className={menuOpen ? "article-primary-nav is-open" : "article-primary-nav"} aria-label="Primary navigation">
          <a href="/#about" onClick={(event) => navigateHome(event, "about")}>About</a>
          <a href="/#platforms" onClick={(event) => navigateHome(event, "platforms")}>Platforms</a>
          <a href="/#team" onClick={(event) => navigateHome(event, "team")}>Team</a>
          <a href="/#sponsor" onClick={(event) => navigateHome(event, "sponsor")}>Sponsors</a>
          <a className="is-active" href="/research" onClick={navigateResearch}>Research</a>
        </nav>
        <div className="article-header-actions">
          <div className="article-lang-switch" aria-label="Language switcher">
            {["EN", "KO"].map((lang) => (
              <button
                className={language === lang ? "is-active" : ""}
                disabled={!languages.includes(lang)}
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
          <a className="article-header-icon" href="https://github.com/rewrite-lab" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <GitHubIcon />
          </a>
          <a className="article-header-icon" href="https://x.com/rewritelab" target="_blank" rel="noopener noreferrer" aria-label="X">
            <XIcon />
          </a>
          <button
            className="article-mobile-menu-button"
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

function ResearchCrew({ authors, date }) {
  const single = authors.length === 1;
  return (
    <section className={`article-author-profile${single ? " is-single" : ""}`} aria-label={single ? "Author profile" : "Multiple author profile"}>
      <div className="article-author-top">
        <span className="article-author-eyebrow">Research Crew</span>
        <time className="article-author-date" dateTime={date}>{formatArticleDate(date)}</time>
      </div>
      <div className="article-author-body">
        <div className="article-author-avatar-stack" aria-hidden="true">
          {authors.map((author) => (
            <div className="article-author-avatar" key={author.id}>
              {author.image
                ? <img src={author.image} alt="" />
                : <span>{initialsFor(author.name)}</span>}
            </div>
          ))}
        </div>
        <div className="article-author-copy">
          <div className="article-author-name">{authors.map((author) => author.name).join(", ")}</div>
        </div>
      </div>
      <div className={`article-author-list${single ? " is-single" : ""}`}>
        {authors.map((author) => (
          <a
            className="article-author-pill"
            href="https://x.com/rewritelab"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${author.name} on X`}
            key={author.id}
          >
            <XIcon />
            {author.name}
          </a>
        ))}
      </div>
    </section>
  );
}

function nestToc(items) {
  const roots = [];
  let currentRoot = null;

  for (const item of items) {
    if (item.depth === 1 || !currentRoot) {
      currentRoot = { ...item, children: [] };
      roots.push(currentRoot);
    } else {
      currentRoot.children.push(item);
    }
  }

  return roots;
}

function ArticleToc({ items, activeId, onSelect }) {
  const nestedItems = useMemo(() => nestToc(items), [items]);
  if (!items.length) return null;

  const renderLink = (item) => (
    <a
      className={activeId === item.id ? "is-active" : ""}
      href={`#${item.id}`}
      onClick={(event) => onSelect(event, item.id)}
    >
      {item.label}
    </a>
  );

  return (
    <aside className="article-toc" aria-label="Table of contents">
      <div className="article-toc-label">Sections ▾</div>
      <ol>
        {nestedItems.map((item) => (
          <li key={item.id}>
            {renderLink(item)}
            {item.children.length > 0 && (
              <ol>
                {item.children.map((child) => <li key={child.id}>{renderLink(child)}</li>)}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ArticleFooter({ onNavigateResearch }) {
  return (
    <footer className="article-site-footer">
      <div className="article-container article-footer-inner">
        <div>© 2016-2026 Rewrite Lab</div>
        <div className="article-footer-links">
          <a href="/research" onClick={onNavigateResearch}>Research</a>
          <a href="https://github.com/rewrite-lab" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://x.com/rewritelab" target="_blank" rel="noopener noreferrer">Twitter</a>
        </div>
      </div>
    </footer>
  );
}

function ArticleThumbnail({ title, src }) {
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => setLoadFailed(false), [src]);
  if (!src || loadFailed) return null;

  return (
    <figure className="article-thumbnail" aria-label={`${title} thumbnail`}>
      <img
        src={resolveResearchAsset(src)}
        alt={`${title} research thumbnail`}
        onError={() => setLoadFailed(true)}
      />
    </figure>
  );
}

function ArticleDocumentPage({
  article,
  document,
  teamMembers,
  nextArticle,
  nextHref,
  onNavigateResearch,
  onOpenNext,
}) {
  const [activeId, setActiveId] = useState(document.toc[0]?.id || "");
  const authors = useMemo(
    () => resolveDocumentAuthors(document, teamMembers),
    [document, teamMembers],
  );
  useEffect(() => {
    window.document.title = `${document.title || article.title} - Rewrite Lab`;
    window.document.documentElement.lang = document.language === "KO" ? "ko" : "en";
  }, [article.title, document]);

  useEffect(() => {
    setActiveId(document.toc[0]?.id || "");
    const targets = document.toc
      .map((item) => window.document.getElementById(item.id))
      .filter(Boolean);
    if (!targets.length || !("IntersectionObserver" in window)) return undefined;

    const hashId = decodeURIComponent(window.location.hash.slice(1));
    const hashTarget = hashId ? targets.find((target) => target.id === hashId) : null;
    const hashFrame = hashTarget
      ? window.requestAnimationFrame(() => {
          setActiveId(hashTarget.id);
          hashTarget.scrollIntoView({ block: "start" });
        })
      : 0;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveId(visible.target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.35, 0.7] });

    targets.forEach((target) => observer.observe(target));
    return () => {
      if (hashFrame) window.cancelAnimationFrame(hashFrame);
      observer.disconnect();
    };
  }, [document]);

  const selectTocItem = (event, id) => {
    event.preventDefault();
    const target = window.document.getElementById(id);
    if (!target) return;
    window.history.replaceState(window.history.state, "", `#${id}`);
    setActiveId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="article-page">
      <main>
        <div className="article-container article-page-grid">
          <ArticleToc items={document.toc} activeId={activeId} onSelect={selectTocItem} />
          <article className="article-post-content">
            <header className="article-inline-header">
              <a className="article-back-link" href="/research" onClick={onNavigateResearch}>← Research</a>
              <h1 className="article-post-title">{article.title}</h1>
              {article.subtitle && <p className="article-post-subtitle">{article.subtitle}</p>}
              <ArticleThumbnail title={article.title} src={document.thumbnail} />
              <ResearchCrew authors={authors} date={document.date || article.date} />
            </header>

            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm, remarkMath, remarkArticleStructure]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, articleSanitizeSchema], rehypeKatex]}
              urlTransform={articleUrlTransform}
            >
              {document.body}
            </ReactMarkdown>

            <nav className="article-end-nav" aria-label="Article navigation">
              <a href="/research" onClick={onNavigateResearch}>
                <small>Back</small>
                <span>Back to all research</span>
              </a>
              {nextArticle && (
                <a href={nextHref} onClick={onOpenNext}>
                  <small>Next</small>
                  <span>{nextArticle.title}</span>
                </a>
              )}
            </nav>
          </article>
        </div>
      </main>
      <ArticleFooter onNavigateResearch={onNavigateResearch} />
    </div>
  );
}

export default function ArticlePage({ documentDescriptor, ...props }) {
  const [document, setDocument] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);

    documentDescriptor.load()
      .then((rawSource) => parseMarkdownDocument(documentDescriptor.sourcePath, rawSource))
      .then((parsedDocument) => {
        if (active) setDocument(parsedDocument);
      })
      .catch((error) => {
        if (active) setLoadError(error);
      });

    return () => {
      active = false;
    };
  }, [documentDescriptor]);

  if (loadError) {
    return (
      <div className="article-page article-load-error" role="alert">
        <p>Unable to render this research document.</p>
      </div>
    );
  }
  if (!document) return <div className="article-loading-shell" aria-hidden="true" />;

  return <ArticleDocumentPage {...props} document={document} />;
}
