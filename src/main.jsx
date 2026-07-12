import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getResearchDocument,
  getResearchEntry,
  normalizeResearchLanguage,
  researchCatalog,
  resolveResearchAssetUrl,
} from "./researchManifest";
import "./styles.css";

const loadArticlePage = () => import("./ArticlePage");
const ArticlePage = lazy(loadArticlePage);

const ROUTE_HOME = "home";
const ROUTE_RESEARCH = "research";
const ROUTE_ARTICLE = "article";
const RESEARCH_ENTRY_MS = 1250;
const RESEARCH_TIMELINE_RATE = 1.5;
const GLOBE_NODE_COUNT = 350;
const STAR_COUNT = 620;

const teamMembers = [
  ["0xp1ain", "p1ain.png", "NEVER EVER GIVE UP", ["Team Leader", "Web Security", "CTF Player", "Penetration Test"]],
  ["0xAlessandro", "https://avatars.githubusercontent.com/u/80576390?v=4", "__proto__", ["Web Security", "CTF"]],
  ["IcesFont", "icesfont.png", "lol", ["Web Security", "CTF Player"]],
  ["One", "one.png", "I am newbie Forever", ["Web Security", "Penetration Tester", "CTF Player"]],
  ["siunam", "https://avatars.githubusercontent.com/u/104430134?v=4", "<img/src/onerror=location=window.name>", ["Web Security", "Researcher", "CTF"]],
  ["sebsrt", "https://avatars.githubusercontent.com/u/58812164", "I like to break stuff", ["Web Security", "Researcher", "CTF"]],
  ["Dat2Phit", "dat2phit.png", "El Psy Kongroo", ["Web Security", "CTF Player", "Penetration Test", "Researcher"]],
  ["frevadiscor", "https://uploads-public.hackmd.io/upload_66f74a5fb7f3afd50d05040c622bc517.png", "Pharmacist by profession, web breaker by passion", ["Web Security", "CTF Player"]],
  ["Masamune", "https://avatars.githubusercontent.com/u/125840508?v=4", "Try Harder", ["Web Security", "CTF Player", "Penetration Test"]],
  ["ctfguy", "https://avatars.githubusercontent.com/u/138273779?v=4", "I am just a CTF player", ["Researcher", "CTF Player"]],
  ["ElleuchX1", "https://pbs.twimg.com/profile_images/1939625960329924608/aQ_SG4qu_400x400.jpg", "Caffeine abuser, sometimes finding bugs", ["Web Security", "Research", "Penetration Test", "CTF"]],
  ["SharpEdged", "https://avatars.githubusercontent.com/u/48861530?s=96&v=4", "sonome darenome?", ["Web Security", "Crypto", "CTF"]],
  ["22sh", "https://i.pinimg.com/736x/48/8b/52/488b52b3672d8bf1d20edf003cfa9bde.jpg", "lazy man with a busy life", ["Web Security", "Penetration test", "web3"]],
  ["downgrade", "https://avatars.githubusercontent.com/u/50407210?v=4", "idk, web enjoyer", ["Web Security", "CTF"]],
  ["irogir", "https://avatars.githubusercontent.com/u/103448522?s=40&v=4", "occasional ctf player", ["Web Security", "LLM Security", "CTF"]],
  ["abdoghazy", "https://avatars.githubusercontent.com/u/64314534?v=4", "yet another web security artist", ["Web Security", "Researcher", "CTF"]],
  ["Z4ki", "https://avatars.githubusercontent.com/u/68925917?v=4", "this user is doing the best he can", ["Web Security", "CTF", "Active Directory", "Android", "Networks"]],
  ["Predic", "https://avatars.githubusercontent.com/u/55022230?v=4", "Kawaii Shiro", ["Web Security", "Security Researcher", "CTF Player"]],
  ["m411k", "https://avatars.githubusercontent.com/u/73129654?v=4", "I profit from people's mistakes...", ["Web Security", "Browser Exploitation", "CTF"]],
  ["filime", "https://avatars.githubusercontent.com/u/36452369?v=4", "I hate chromium", ["Web Security", "CTF", "Pentesting"]],
  ["TCP/IP", "https://tistory1.daumcdn.net/tistory/6784335/attach/4387a073689d4abeb1e8ffe848296151", "hi", ["Web Security", "CTF Player"]],
  ["aestera", "https://avatars.githubusercontent.com/u/117811685?v=4", "Trying to do better", ["Web Security", "Penetration Test"]],
  ["goldleo1", "goldleo1.png", "NaN", ["Web Security", "Researcher", "CTF Player"]],
  ["secu23", "secu23.png", "NaN", ["Web Security", "CTF Player"]],
  ["oxqnd", "https://avatars.githubusercontent.com/u/122880412?v=4", "Crash first, understand later", ["Web Security", "Browser Security", "V8 Research"]],
  ["sink", "", "Tracing bugs back to their origin.", ["Web Security", "CTF Player"]],
  ["Waivey", "https://avatars.githubusercontent.com/u/90015315?v=4", "Amatda", ["Web Security", "Development", "Server", "Automation"]],
].map(([nickname, image, quote, tags]) => ({
  name: `@${nickname}`,
  role: nickname.toLowerCase() === "0xp1ain" ? "Captain" : nickname.toLowerCase() === "0xalessandro" ? "Co-Captain" : "Researcher",
  quote,
  tags,
  img: image && /^https?:\/\//i.test(image) ? image : image ? `/img/${image}` : "",
}));

const teamMemberById = new Map(
  teamMembers.map((member) => [member.name.replace(/^@/, "").toLowerCase(), member]),
);

const availableCatalogLanguages = ["EN", "KO"].filter((language) =>
  researchCatalog.some((entry) => entry.variants[language]),
);

const RESEARCH_LANG_KEY = "rw_research_lang";
const researchStrings = {
  EN: {
    heroKicker: "Rewrite Lab \u2014 Research",
    lead: "A global collective researching web hacking and LLM-fused security. We publish everything we learn \u2014 openly and transparently \u2014 so every researcher can begin where we left off.",
    meta: (count) => [`${count} Publication${count === 1 ? "" : "s"}`, "Open Source", "KO \u00b7 EN", "Est. 2016"],
    archiveKicker: "Publications",
    archiveTitle: "All Research",
    entries: "Entries",
    latest: "Latest",
    read: "Read research",
    footerTag: "Global high-tier hackers building a bidirectional growth community through deep, uncompromised web security research.",
    home: "Home",
    researchers: (n) => `${n} researcher${n > 1 ? "s" : ""}`,
  },
  KO: {
    heroKicker: "Rewrite Lab \u2014 Research",
    lead: "\uc6f9 \ud574\ud0b9\uacfc LLM \uc735\ud569 \ubcf4\uc548\uc744 \uc5f0\uad6c\ud558\ub294 \uae00\ub85c\ubc8c \ub9ac\uc11c\uce58 \ucf5c\ub809\ud2f0\ube0c. \uc6b0\ub9ac\uac00 \ubc30\uc6b4 \ubaa8\ub4e0 \uac83\uc744 \ud22c\uba85\ud558\uac8c \uacf5\uac1c\ud574, \ub2e4\uc74c \uc5f0\uad6c\uc790\uac00 \uc6b0\ub9ac\uac00 \uba48\ucd98 \uc9c0\uc810\uc5d0\uc11c \ub2e4\uc2dc \uc2dc\uc791\ud560 \uc218 \uc788\uac8c \ud569\ub2c8\ub2e4.",
    meta: (count) => [`\ub9ac\uc11c\uce58 ${count}\ud3b8`, "\uc624\ud508\uc18c\uc2a4", "KO \u00b7 EN", "2016 \uc124\ub9bd"],
    archiveKicker: "Publications",
    archiveTitle: "\uc804\uccb4 \ub9ac\uc11c\uce58",
    entries: "\uac1c",
    latest: "Latest",
    read: "\ub9ac\uc11c\uce58 \uc77d\uae30",
    footerTag: "\uae4a\uace0 \ud0c0\ud611 \uc5c6\ub294 \uc6f9 \ubcf4\uc548 \uc5f0\uad6c\ub85c \uc0c1\ud638 \uc131\uc7a5\ud558\ub294 \ucee4\ubba4\ub2c8\ud2f0\ub97c \ub9cc\ub4dc\ub294 \uc804 \uc138\uacc4 \ucd5c\uc0c1\uc704 \ud574\ucee4\ub4e4.",
    home: "\ud648",
    researchers: (n) => `\ub9ac\uc11c\ucc98 ${n}\uba85`,
  },
};

function readStoredResearchLanguage() {
  try {
    return normalizeResearchLanguage(localStorage.getItem(RESEARCH_LANG_KEY)) || "EN";
  } catch {
    return "EN";
  }
}

function storeResearchLanguage(language) {
  try {
    localStorage.setItem(RESEARCH_LANG_KEY, language);
  } catch {
    // localStorage can be unavailable in restricted contexts.
  }
}

function researchLanguageQuery(language) {
  return language === "KO" ? "?lang=ko" : "";
}

function researchListUrl(language) {
  return `/research${researchLanguageQuery(language)}`;
}

function researchArticleUrl(number, language) {
  return `/researchs/${number}${researchLanguageQuery(language)}`;
}

function currentLocationState() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const requestedLanguage =
    normalizeResearchLanguage(new URLSearchParams(window.location.search).get("lang")) || "EN";
  const articleMatch = path.match(/^\/researchs\/(\d+)$/);
  if (articleMatch) {
    const articleNumber = Number.parseInt(articleMatch[1], 10);
    const entry = getResearchEntry(articleNumber);
    if (entry) {
      const articleDocument = getResearchDocument(entry, requestedLanguage);
      return {
        route: ROUTE_ARTICLE,
        articleNumber,
        researchLanguage: articleDocument?.language || "EN",
      };
    }
  }
  if (path === "/research") {
    const language = availableCatalogLanguages.includes(requestedLanguage)
      ? requestedLanguage
      : availableCatalogLanguages[0] || "EN";
    return { route: ROUTE_RESEARCH, articleNumber: null, researchLanguage: language };
  }
  return { route: ROUTE_HOME, articleNumber: null, researchLanguage: readStoredResearchLanguage() };
}

function smooth(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function initialsForResearch(name) {
  const clean = String(name || "").replace(/^@/, "").trim();
  const words = clean.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function makeResearchCard(entry, lang) {
  const t = researchStrings[lang];
  const documentDescriptor = getResearchDocument(entry, lang, false);
  if (!documentDescriptor) return null;

  const contributorIds = documentDescriptor.authorIds.length
    ? documentDescriptor.authorIds
    : ["Rewrite Lab"];
  const avatars = contributorIds.slice(0, 3).map((id) => {
    const member = teamMemberById.get(id.replace(/^@/, "").toLowerCase());
    const name = member?.name || id;
    return {
      id,
      name,
      image: member?.img || "",
      initials: initialsForResearch(name),
    };
  });

  return {
    id: entry.number,
    title: documentDescriptor.title,
    subtitle: "",
    date: documentDescriptor.date,
    href: researchArticleUrl(entry.number, lang),
    isLocal: true,
    thumbSrc: resolveResearchAssetUrl(documentDescriptor.thumbnail),
    dateStr: documentDescriptor.date.replaceAll("-", "."),
    badge: lang,
    numStr: String(entry.number).padStart(2, "0"),
    avatars,
    moreCount: contributorIds.length > 3 ? contributorIds.length - 3 : 0,
    contributorText: t.researchers(contributorIds.length),
  };
}

function handleResearchCardEnter(event) {
  event.currentTarget.style.transition = "transform .12s ease-out";
}

function handleResearchCardMove(event) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  el.style.transition = "transform .1s ease-out";
  el.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
  el.style.setProperty("--rx", `${((0.5 - py) * 7).toFixed(2)}deg`);
  el.style.setProperty("--ty", "-7px");
  el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
  el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  el.style.setProperty("--gleam", "1");
  el.style.setProperty("--bd", "rgba(199,242,60,0.55)");
  el.style.setProperty("--tc", "#C7F23C");
  el.style.setProperty("--arr", "#C7F23C");
  el.style.setProperty("--arrx", "5px");
  el.style.setProperty("--imgs", "1.05");
  el.style.setProperty("--bri", "1.05");
  el.style.setProperty("--avr", "#C7F23C");
}

function handleResearchCardLeave(event) {
  const el = event.currentTarget;
  el.style.transition = "transform .55s cubic-bezier(.2,.7,.2,1)";
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.style.setProperty("--ty", "0px");
  el.style.setProperty("--bd", "rgba(255,255,255,0.12)");
  el.style.setProperty("--tc", "#fff");
  el.style.setProperty("--arr", "#565656");
  el.style.setProperty("--arrx", "0");
  el.style.setProperty("--imgs", "1");
  el.style.setProperty("--bri", "1");
  el.style.setProperty("--gleam", "0");
  el.style.setProperty("--avr", "rgba(255,255,255,0.18)");
}

function makeSphere(count) {
  return Array.from({ length: count }, (_, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return {
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(phi),
      delay: Math.random() * 300,
      scale: 0,
      opacity: 0,
    };
  });
}

function useReveal(activeKey) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeKey]);
}

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function CosmicCanvas({ route, phase, researchStart, enteredFromHome }) {
  const canvasRef = useRef(null);
  const stateRef = useLatest({ route, phase, researchStart, enteredFromHome });
  const rotRef = useRef(0);
  const frameRef = useRef(0);
  const dprRef = useRef(1);
  const nodesRef = useRef(makeSphere(GLOBE_NODE_COUNT));
  const linkOrderRef = useRef(Int32Array.from(
    { length: GLOBE_NODE_COUNT },
    (_, index) => index,
  ));
  const linkPairsRef = useRef(new Int32Array(
    (GLOBE_NODE_COUNT * (GLOBE_NODE_COUNT - 1)) / 2,
  ));
  const projectedRef = useRef(Array.from({ length: GLOBE_NODE_COUNT }, () => ({
    sx: 0,
    sy: 0,
    sz: 0,
    p: 0,
    bright: 0,
    opacity: 0,
    scale: 0,
  })));
  const starsRef = useRef([]);
  const spritesRef = useRef(null);
  const orbitsRef = useRef([
    { wr: 1.9, bwr: 0.13, pal: 4, ring: false, moon: false, bands: false, ang: Math.random() * 6.28 },
    { wr: 2.7, bwr: 0.2, pal: 0, ring: false, moon: true, bands: true, ang: Math.random() * 6.28 },
    { wr: 3.6, bwr: 0.16, pal: 2, ring: false, moon: false, bands: false, ang: Math.random() * 6.28 },
    { wr: 4.7, bwr: 0.3, pal: 1, ring: true, moon: true, bands: true, ang: Math.random() * 6.28 },
    { wr: 5.9, bwr: 0.24, pal: 5, ring: true, moon: false, bands: true, ang: Math.random() * 6.28 },
    { wr: 7.1, bwr: 0.15, pal: 3, ring: false, moon: true, bands: false, ang: Math.random() * 6.28 },
  ]);

  useEffect(() => {
    orbitsRef.current.forEach((orbit) => {
      orbit.spd = 0.011 / Math.pow(orbit.wr, 1.5);
      orbit.moonA = Math.random() * 6.28;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    const light = { x: -1, y: -1, z: 1 };
    const lightLen = Math.hypot(light.x, light.y, light.z);
    light.x /= lightLen;
    light.y /= lightLen;
    light.z /= lightLen;
    const palette = [
      { lit: "rgb(214,245,150)", mid: "rgb(120,150,55)", dark: "rgb(15,25,7)", atm: "199,242,60" },
      { lit: "rgb(182,236,216)", mid: "rgb(70,140,120)", dark: "rgb(9,28,24)", atm: "120,220,190" },
      { lit: "rgb(240,219,155)", mid: "rgb(165,120,55)", dark: "rgb(28,20,8)", atm: "240,200,120" },
      { lit: "rgb(224,238,232)", mid: "rgb(140,160,150)", dark: "rgb(20,28,25)", atm: "205,228,218" },
      { lit: "rgb(192,198,120)", mid: "rgb(95,100,55)", dark: "rgb(15,17,8)", atm: "175,190,110" },
      { lit: "rgb(198,224,245)", mid: "rgb(88,128,175)", dark: "rgb(9,19,32)", atm: "150,190,235" },
    ];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      dprRef.current = dpr;
      canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sprite(core, halo, rgb, spikes) {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const g = c.getContext("2d");
      const m = 32;
      g.globalCompositeOperation = "lighter";
      if (spikes) {
        let v = g.createLinearGradient(m, 0, m, 64);
        v.addColorStop(0, `rgba(${rgb},0)`);
        v.addColorStop(0.5, `rgba(${rgb},0.55)`);
        v.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = v;
        g.fillRect(m - 0.9, 0, 1.8, 64);
        let h = g.createLinearGradient(0, m, 64, m);
        h.addColorStop(0, `rgba(${rgb},0)`);
        h.addColorStop(0.5, `rgba(${rgb},0.55)`);
        h.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = h;
        g.fillRect(0, m - 0.9, 64, 1.8);
      }
      const rg = g.createRadialGradient(m, m, 0, m, m, m);
      rg.addColorStop(0, "rgba(255,255,255,0.98)");
      rg.addColorStop(0.16, core);
      rg.addColorStop(0.45, halo);
      rg.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(m, m, m, 0, Math.PI * 2);
      g.fill();
      return c;
    }

    spritesRef.current = {
      wd: sprite("rgba(220,255,220,0.95)", "rgba(204,255,0,0.40)", "204,255,0", false),
      ws: sprite("rgba(220,255,220,0.95)", "rgba(204,255,0,0.40)", "204,255,0", true),
      ld: sprite("rgba(204,255,0,0.98)", "rgba(204,255,0,0.34)", "204,255,0", false),
      ls: sprite("rgba(204,255,0,0.98)", "rgba(204,255,0,0.34)", "204,255,0", true),
      warm: sprite("rgba(255,242,205,0.95)", "rgba(255,205,120,0.30)", "255,205,120", false),
    };

    starsRef.current = Array.from({ length: STAR_COUNT }, () => {
      const spike = Math.random() > 0.9;
      const cr = Math.random();
      let key = spike ? "ws" : "wd";
      if (cr > 0.6 && cr < 0.9) key = spike ? "ls" : "ld";
      else if (cr >= 0.9) key = "warm";
      return {
        fx: Math.random() * 2 - 1,
        fy: Math.random() * 2 - 1,
        d: 0.3 + Math.random() * 0.7,
        roff: Math.random() * 0.55,
        base: (spike ? 16 : 6) + Math.random() * (spike ? 24 : 10),
        tw: Math.random() * Math.PI * 2,
        tws: 0.5 + Math.random(),
        key,
      };
    });

    function advanceRevealNodes() {
      for (const node of nodesRef.current) {
        if (frameRef.current <= node.delay) continue;
        node.scale += (1 - node.scale) * 0.08;
        node.opacity = Math.min(1, node.opacity + 0.02);
      }
    }

    function projectGlobe(cx, cy, radius, rotY, mode) {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(0.2);
      const sinX = Math.sin(0.2);
      const nodes = nodesRef.current;
      const projected = projectedRef.current;
      if (mode === "reveal") advanceRevealNodes();
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const opacity = mode === "force" ? Math.max(n.opacity, 0.95) : n.opacity;
        const scale = mode === "force" ? Math.max(n.scale, 0.95) : n.scale;
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.z * cosY + n.x * sinY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + n.y * sinX;
        const dot = x1 * light.x + y1 * light.y + z2 * light.z;
        const bright = Math.max(0.35, dot * 0.65 + 0.6);
        const p = 2.5 / (2.5 + z2);
        const out = projected[i];
        out.sx = cx + x1 * radius * p;
        out.sy = cy + y1 * radius * p;
        out.sz = z2;
        out.p = p;
        out.bright = bright;
        out.opacity = opacity;
        out.scale = scale;
      }
      return projected;
    }

    function drawLinks(proj, radius, requireVisible) {
      const maxDist = radius * 0.35;
      if (maxDist <= 0) return;
      const maxDistSq = maxDist * maxDist;
      const order = linkOrderRef.current;
      const pairs = linkPairsRef.current;

      // Projection changes gradually, so insertion sorting the previous frame's
      // x-order avoids testing node pairs that cannot be close enough to link.
      for (let i = 1; i < order.length; i += 1) {
        const value = order[i];
        const x = proj[value].sx;
        let j = i - 1;
        while (j >= 0 && proj[order[j]].sx > x) {
          order[j + 1] = order[j];
          j -= 1;
        }
        order[j + 1] = value;
      }

      let pairCount = 0;
      for (let oi = 0; oi < order.length; oi += 1) {
        const ai = order[oi];
        const a = proj[ai];
        if (requireVisible && a.opacity < 0.2) continue;

        for (let oj = oi + 1; oj < order.length; oj += 1) {
          const bi = order[oj];
          const b = proj[bi];
          const dx = b.sx - a.sx;
          if (dx >= maxDist) break;
          if (requireVisible && b.opacity < 0.2) continue;

          const dy = a.sy - b.sy;
          if (dx * dx + dy * dy >= maxDistSq) continue;

          const i = ai < bi ? ai : bi;
          const j = ai < bi ? bi : ai;
          pairs[pairCount] = i * proj.length + j;
          pairCount += 1;
        }
      }

      // Restore the original nested-loop order so alpha compositing is unchanged.
      pairs.subarray(0, pairCount).sort();
      ctx.lineWidth = 1;
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const key = pairs[pairIndex];
        const i = Math.floor(key / proj.length);
        const j = key - i * proj.length;
        const a = proj[i];
        const b = proj[j];
        const dx = a.sx - b.sx;
        const dy = a.sy - b.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const lineOpacity =
          (1 - dist / maxDist) *
          Math.min(a.opacity, b.opacity) *
          ((a.bright + b.bright) / 2) *
          (a.sz > 0 ? 0.3 : 1.0);

        if (lineOpacity > 0.05) {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = `rgba(204, 255, 0, ${lineOpacity})`;
          ctx.stroke();
        }
      }
    }

    function advanceOrbits() {
      for (const orbit of orbitsRef.current) {
        orbit.ang += orbit.spd;
        orbit.moonA += 0.014;
      }
    }

    function drawGlobe(cx, cy, radius, rotY, mode = "current") {
      const proj = projectGlobe(cx, cy, radius, rotY, mode);
      drawLinks(proj, radius, mode === "reveal");
      for (const n of proj) {
        if (n.opacity <= 0) continue;
        const alpha = n.opacity * n.bright * (n.sz > 0 ? 0.5 : 1);
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, Math.max(0.2, n.p * 1.5 * n.scale), 0, Math.PI * 2);
        ctx.fillStyle = n.bright > 0.8 ? `rgba(255,255,255,${alpha})` : `rgba(204,255,0,${alpha})`;
        ctx.shadowBlur = n.bright > 0.8 ? 10 : 0;
        ctx.shadowColor = "#ccff00";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    function ringHalf(x, y, r, atm, front, alpha) {
      const sysTilt = 0.42;
      const sysRot = -0.34;
      const rr = r * 1.95;
      const ry = rr * sysTilt;
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = `rgba(${atm},0.55)`;
      ctx.lineWidth = Math.max(0.5, r * 0.26);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sysRot);
      ctx.beginPath();
      if (front) ctx.ellipse(0, 0, rr, ry, 0, 0, Math.PI);
      else ctx.ellipse(0, 0, rr, ry, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = alpha;
    }

    function drawPlanet(x, y, r, orbit, alpha) {
      if (r < 0.7 || alpha <= 0.01) return;
      const pal = palette[orbit.pal];
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "lighter";
      const ag = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 1.8);
      ag.addColorStop(0, `rgba(${pal.atm},0.26)`);
      ag.addColorStop(1, `rgba(${pal.atm},0)`);
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      if (orbit.ring) ringHalf(x, y, r, pal.atm, false, alpha);
      const lx = x - r * 0.36;
      const ly = y - r * 0.36;
      const bg = ctx.createRadialGradient(lx, ly, r * 0.04, x, y, r * 1.02);
      bg.addColorStop(0, pal.lit);
      bg.addColorStop(0.5, pal.mid);
      bg.addColorStop(1, pal.dark);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (orbit.ring) ringHalf(x, y, r, pal.atm, true, alpha);
      if (orbit.moon && r > 4) {
        const mR = r * 2.1;
        ctx.fillStyle = "rgba(225,240,220,0.95)";
        ctx.beginPath();
        ctx.arc(x + Math.cos(orbit.moonA) * mR, y + Math.sin(orbit.moonA) * mR * 0.5, Math.max(0.8, r * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawResearchSpace(now, cx, cy, zoom, elapsed, bounds) {
      const localWidth = bounds ? bounds.width : window.innerWidth;
      const localHeight = bounds ? bounds.height : window.innerHeight;
      const diag = Math.hypot(localWidth, localHeight);
      const collapseStart = 2600 + 4200 + 4600;
      const revealProg = Math.max(0, Math.min(1, (elapsed - collapseStart) / (5000 + 3600)));
      const pull = smooth(Math.max(0, Math.min(1, (elapsed - collapseStart) / (5000 + 6000))));
      const starScale = 1.62 - 0.62 * pull;
      if (revealProg > 0.001) {
        ctx.save();
        if (bounds) {
          ctx.beginPath();
          ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
          ctx.clip();
        }
        ctx.globalCompositeOperation = "lighter";
        const starCx = cx;
        const starCy = cy;
        const sw = localWidth * 0.62;
        const sh = localHeight * 0.64;
        for (const s of starsRef.current) {
          let local = (revealProg - s.roff) / 0.34;
          if (local <= 0) continue;
          if (local > 1) local = 1;
          const fin = local * local * (3 - 2 * local);
          const sc = starScale * (0.62 + s.d * 0.6);
          const sx = starCx + s.fx * sw * sc;
          const sy = starCy + s.fy * sh * sc;
          const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * s.tws + s.tw);
          ctx.globalAlpha = fin * tw * (0.45 + s.d * 0.55);
          const size = s.base * (0.5 + s.d * 0.5) * (0.8 + 0.2 * starScale);
          ctx.drawImage(spritesRef.current[s.key], sx - size / 2, sy - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      const sysTilt = 0.42;
      const sysRot = -0.34;
      const orbReveal = Math.max(0, Math.min(1, (elapsed - 2600 - 300) / 2200));
      advanceOrbits();
      for (const orbit of orbitsRef.current) {
        const r = orbit.wr * zoom;
        const alpha = orbReveal * Math.max(0, Math.min(1, (diag * 0.62 - r) / (diag * 0.16))) * Math.max(0, Math.min(1, (r - 10) / 20));
        if (alpha <= 0.01) continue;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = "rgba(204,255,0,0.42)";
        ctx.lineWidth = 1.3;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sysRot);
        ctx.scale(1, sysTilt);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const lx = Math.cos(orbit.ang) * r;
        const ly = Math.sin(orbit.ang) * r * sysTilt;
        const bx = cx + lx * Math.cos(sysRot) - ly * Math.sin(sysRot);
        const by = cy + lx * Math.sin(sysRot) + ly * Math.cos(sysRot);
        drawPlanet(bx, by, orbit.bwr * zoom, orbit, alpha);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    let raf = 0;
    let lastFrame = 0;

    function draw(now) {
      const current = stateRef.current;
      if (now - lastFrame < 16) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastFrame = now;
      frameRef.current += 1;
      rotRef.current -= 0.0018;

      if (current.phase === "research") {
        const canvasRect = canvas.getBoundingClientRect();
        const canvasVisible = canvasRect.bottom > 0 && canvasRect.top < window.innerHeight;
        if (!canvasVisible) {
          const elapsed = Math.max(0, now - current.researchStart);
          const entryProgress = current.enteredFromHome ? smooth(elapsed / RESEARCH_ENTRY_MS) : 1;
          if (current.enteredFromHome) advanceRevealNodes();
          if (entryProgress >= 1) advanceOrbits();
          raf = requestAnimationFrame(draw);
          return;
        }
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const home = {
        x: window.innerWidth * 0.75,
        y: window.innerHeight * 0.45,
        r: Math.min(window.innerWidth, window.innerHeight) * 0.4,
      };
      const hero = document.querySelector("[data-hero]");
      const heroWidth = hero?.clientWidth;
      const heroHeight = hero?.clientHeight;
      const researchCanvas = heroWidth && heroHeight
        ? {
          left: hero.offsetLeft + heroWidth * 0.3,
          top: hero.offsetTop,
          width: heroWidth * 0.7,
          height: heroHeight,
        }
        : {
          left: window.innerWidth * 0.3,
          top: 70,
          width: window.innerWidth * 0.7,
          height: Math.min(window.innerHeight * 0.9, 840),
        };
      const research = {
        x: researchCanvas.left + researchCanvas.width * 0.71,
        y: researchCanvas.top + researchCanvas.height * 0.5,
        r: researchCanvas.height * 0.33,
      };

      if (current.phase === "home") {
        drawGlobe(home.x, home.y, home.r, rotRef.current, "reveal");
      } else {
        const researchVisible = researchCanvas.top < window.innerHeight && researchCanvas.top + researchCanvas.height > 0;
        if (!researchVisible) {
          raf = requestAnimationFrame(draw);
          return;
        }
        const elapsed = Math.max(0, now - current.researchStart);
        const entryProgress = current.enteredFromHome ? smooth(elapsed / RESEARCH_ENTRY_MS) : 1;
        const baseX = home.x + (research.x - home.x) * entryProgress;
        const baseY = home.y + (research.y - home.y) * entryProgress;
        const baseR = home.r + (research.r - home.r) * entryProgress;
        const globeMode = current.enteredFromHome ? "reveal" : "force";

        if (entryProgress < 1) {
          drawGlobe(baseX, baseY, baseR, rotRef.current, globeMode);
          raf = requestAnimationFrame(draw);
          return;
        }

        const researchElapsed = Math.max(
          0,
          current.enteredFromHome ? elapsed - RESEARCH_ENTRY_MS : elapsed,
        ) * RESEARCH_TIMELINE_RATE;
        const diag = Math.hypot(researchCanvas.width, researchCanvas.height);
        const zoom0 = baseR;
        const zoomMid = diag * 0.031;
        let zoom;
        if (researchElapsed < 2600) zoom = zoom0;
        else if (researchElapsed < 6800) zoom = zoom0 + (zoomMid - zoom0) * smooth((researchElapsed - 2600) / 4200);
        else if (researchElapsed < 11400) zoom = zoomMid;
        else if (researchElapsed < 16400) zoom = zoomMid + (1.6 - zoomMid) * smooth((researchElapsed - 11400) / 5000);
        else zoom = 1.6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(researchCanvas.left, researchCanvas.top, researchCanvas.width, researchCanvas.height);
        ctx.clip();
        drawResearchSpace(now, baseX, baseY, zoom, researchElapsed, researchCanvas);
        ctx.globalCompositeOperation = "lighter";
        drawGlobe(baseX, baseY, zoom, rotRef.current, globeMode);
        if (zoom < 16) {
          const k = Math.max(0, Math.min(1, (16 - zoom) / 14));
          const g = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, Math.max(zoom * 1.5, 4 + k * 3));
          g.addColorStop(0, `rgba(235,255,225,${0.45 + 0.45 * k})`);
          g.addColorStop(0.4, "rgba(204,255,0,0.5)");
          g.addColorStop(1, "rgba(204,255,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(baseX, baseY, Math.max(zoom * 1.5, 4 + k * 3), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [stateRef]);

  return <canvas ref={canvasRef} className={`cosmic-canvas cosmic-${phase}`} aria-hidden="true" />;
}

function Navigation({
  route,
  onNavigateHome,
  onNavigateResearch,
  showResearchLanguages = false,
  researchLanguage = "EN",
  availableResearchLanguages = [],
  onResearchLanguageChange,
}) {
  return (
    <nav>
      <a href="/" className="logo" aria-label="Rewrite Lab home" onClick={onNavigateHome}>
        <img src="/img/rewrite.png" alt="Rewrite Lab" />
      </a>
      <div className="nav-controls">
        <div className="nav-links">
          <a href="/#about" onClick={(event) => onNavigateHome(event, "about")}>About</a>
          <a href="/#platforms" onClick={(event) => onNavigateHome(event, "platforms")}>Platforms</a>
          <a href="/#team" onClick={(event) => onNavigateHome(event, "team")}>Team</a>
          <a href="/#sponsor" onClick={(event) => onNavigateHome(event, "sponsor")}>Sponsors</a>
          <a className={route === ROUTE_RESEARCH ? "active" : ""} href="/research" onClick={onNavigateResearch}>Researchs</a>
        </div>
        {showResearchLanguages && (
          <div className="research-language-nav" aria-label="Research language">
            {["EN", "KO"].map((language) => (
              <button
                className={researchLanguage === language ? "is-active" : ""}
                disabled={!availableResearchLanguages.includes(language)}
                key={language}
                onClick={() => onResearchLanguageChange?.(language)}
                type="button"
              >
                {language}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function HomePage({ pauseMini = false }) {
  useReveal("home");
  return (
    <main className="page home-page">
      <section id="hero" className="home-hero">
        <div className="hero-content">
          <h1 className="hero-title">REWRITE<br /><span>LAB</span></h1>
          <div className="hero-bottom-grid">
            <div className="hero-slogan">
              "We make what we learn through research understandable to everyone,<br />
              and by sharing it transparently, we build a deeper web hacking ecosystem."
            </div>
            <div className="hero-desc">
              Global high-tier hackers building a bidirectional growth community through
              deep, uncompromised web security research.
            </div>
          </div>
        </div>
      </section>
      <section id="about">
        <span className="section-tag">01. Identity</span>
        <h2 className="section-title">Beyond The Surface</h2>
        <div className="about-grid">
          <div className="huge-text reveal">We avoid shallow summaries<br />and abstract explanations.<br /><br />We dig into <span>even the smallest issue others overlook</span> to clearly analyze the full complexity of hacking.</div>
          <div className="about-details reveal">
            <p>Rewrite Lab is a pure research team made up of web security specialists proven through repeated results in globally recognized competitions. Our research aims to raise the baseline of shared knowledge and build an ecosystem where web hackers around the world can access high-quality information and grow together.</p>
            <div className="stat-grid">
              <div className="stat-item"><h4>HIGH-TIER</h4><p>Global Hackers</p></div>
              <div className="stat-item"><h4>100%</h4><p>Transparent Sharing</p></div>
            </div>
          </div>
        </div>
      </section>
      <section id="platforms">
        <span className="section-tag">02. Ecosystem</span>
        <h2 className="section-title">Our Platforms</h2>
        <div className="platform-cards">
          <PlatformCard title="RESEARCH" href="https://research.rewritelab.org" button="Explore Research" pauseMini={pauseMini}>
            We break down advanced web hacking techniques, vulnerability analysis, and deeper research in a way that stays accessible without losing rigor. By publishing clear reports on knowledge that used to stay within a small circle, we make learning transparent and available to anyone.
          </PlatformCard>
          <PlatformCard title="WARGAME" href="https://wargame.rewritelab.org" button="Enter Wargame" variant="wargame" pauseMini={pauseMini}>
            Our researchers, backed by extensive competitive and community experience, build validated web hacking challenges designed to sharpen problem-solving ability and technical insight, and we run an in-house platform open to everyone.
          </PlatformCard>
        </div>
      </section>
      <section id="team">
        <span className="section-tag">03. Architects</span>
        <h2 className="section-title">The Researchers</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div className="team-member reveal" style={{ transitionDelay: `${(index % 3) * 0.1}s` }} key={member.name}>
              {member.img ? <div className="t-profile"><img src={member.img} alt={member.name} /></div> : <div className="t-profile is-empty" aria-hidden="true" />}
              <div className="t-info">
                <div className="t-role">// {member.role}</div>
                <div className="t-name">{member.name}</div>
                <div className="t-quote">"{member.quote}"</div>
                <div className="t-tags">{member.tags.map((tag) => <span className="t-tag" key={tag}>{tag}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section id="sponsor">
        <span className="section-tag">04. Alliance</span>
        <h2 className="section-title">Support & FAQ</h2>
        <SponsorMarquee />
        <div className="qna-container">
          <Qna q="Is Rewrite Lab a for-profit security company?">No. We are not a profit-driven company. Rewrite Lab was founded by top web hackers from around the world who voluntarily came together to push the limits of security research and transparently share that knowledge with the community. We are a pure research lab.</Qna>
          <Qna q="How are sponsorship funds used?">Every contribution is used transparently to support high-quality research content, maintenance of our public wargame infrastructure, and seminars and conferences that help grow the global web hacking community, building a sustainable cycle of knowledge sharing.</Qna>
          <Qna q="Do you recruit team members on a rolling basis?">We do not recruit on a rolling basis. In general, we open recruiting twice a year, once in the first half and once later in the year. We are not currently recruiting additional researchers.</Qna>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function PlatformCard({ title, href, button, variant, pauseMini, children }) {
  return (
    <div className="card reveal">
      <div className="card-content">
        <h3 className="card-title">{title}</h3>
        <p className="card-desc">{children}</p>
        <a href={href} target="_blank" rel="noreferrer" className="btn">{button}</a>
      </div>
      <div className="card-visual">
        <MiniCanvas variant={variant} paused={pauseMini} />
      </div>
    </div>
  );
}

function MiniCanvas({ variant, paused = false }) {
  const ref = useRef(null);
  const pausedRef = useLatest(paused);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const visibleRef = { current: false };
    let raf = 0;
    let rTime = 0;
    let orbitRot = 0;
    let wgFrame = 0;
    let scanY = -0.2;
    let scanDir = 1;
    const wgNodes = Array.from({ length: 30 }, (_, i) => ({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      isTarget: i === 7 || i === 22,
      pulse: 0,
      delay: Math.random() * 200,
      opacity: 0,
    }));

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width);
      canvas.height = Math.max(1, rect.height);
    }

    function traceSmoothPath(points) {
      if (points.length < 2) return;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i += 1) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    function drawResearchOrbit() {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) * 0.68;

      rTime += 0.012;
      orbitRot += 0.003;

      const cosO = Math.cos(orbitRot);
      const sinO = Math.sin(orbitRot);
      const projectOrbitPoint = (time) => {
        const px = Math.sin(time) * r;
        const py = Math.sin(time) * Math.cos(time) * r;
        const pz = Math.cos(time) * (r * 0.4);
        const rx = px * cosO - pz * sinO;
        const rz = pz * cosO + px * sinO;
        const tilt = 0.6;
        const ry = py * Math.cos(tilt) - rz * Math.sin(tilt);
        const finalZ = rz * Math.cos(tilt) + py * Math.sin(tilt);
        const pointScale = 300 / (300 + finalZ);
        return {
          x: cx + rx * pointScale,
          y: cy + ry * pointScale,
          z: finalZ,
          scale: pointScale,
        };
      };

      const orbitPoints = [];
      for (let i = 0; i <= Math.PI * 2; i += 0.025) {
        orbitPoints.push(projectOrbitPoint(i));
      }

      const beamPoints = [];
      const beamSamples = 28;
      const beamStep = 0.024;
      for (let i = beamSamples; i >= 0; i -= 1) {
        beamPoints.push(projectOrbitPoint(rTime - i * beamStep));
      }
      const laserPoint = projectOrbitPoint(rTime);
      const scale = laserPoint.scale;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      traceSmoothPath(orbitPoints);
      ctx.strokeStyle = "rgba(176, 176, 176, 0.42)";
      ctx.lineWidth = 3.6;
      ctx.stroke();

      ctx.beginPath();
      traceSmoothPath(orbitPoints);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
      ctx.lineWidth = 1.45;
      ctx.stroke();

      const beamGradient = ctx.createLinearGradient(
        beamPoints[0].x,
        beamPoints[0].y,
        laserPoint.x,
        laserPoint.y,
      );
      beamGradient.addColorStop(0, "rgba(204, 255, 0, 0)");
      beamGradient.addColorStop(0.5, "rgba(210, 255, 20, 0.22)");
      beamGradient.addColorStop(1, "rgba(248, 255, 128, 0.95)");

      ctx.beginPath();
      traceSmoothPath(beamPoints);
      ctx.strokeStyle = beamGradient;
      ctx.lineWidth = 3.2 + scale * 3.8;
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#CCFF00";
      ctx.stroke();

      ctx.beginPath();
      traceSmoothPath(beamPoints);
      ctx.strokeStyle = "rgba(244, 255, 164, 0.82)";
      ctx.lineWidth = 1.2 + scale * 1.8;
      ctx.shadowBlur = 0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(laserPoint.x, laserPoint.y, 4.4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = "#F3FF93";
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#CCFF00";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawWargameScanner() {
      wgFrame += 1;
      scanY += scanDir * 0.003;
      if (scanY > 1.2) scanDir = -1;
      if (scanY < -0.2) scanDir = 1;

      const actualScanY = scanY * canvas.height;
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
      }
      ctx.stroke();

      wgNodes.forEach((n) => {
        if (wgFrame > n.delay && n.opacity < 1) {
          n.opacity += 0.02;
        }
        if (n.opacity <= 0) return;

        const nx = n.x * canvas.width;
        const ny = n.y * canvas.height;
        const distToScan = Math.abs(ny - actualScanY);
        if (distToScan < 40) {
          n.pulse = Math.min(1, n.pulse + 0.1);
        } else {
          n.pulse = Math.max(0, n.pulse - 0.03);
        }

        ctx.beginPath();
        ctx.arc(nx, ny, 6 + n.pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle =
          n.isTarget && n.pulse > 0
            ? `rgba(255, 0, 51, ${n.opacity * (0.4 + n.pulse)})`
            : `rgba(255, 255, 255, ${n.opacity * 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(nx, ny, 1.5 + n.pulse, 0, Math.PI * 2);
        ctx.fillStyle = n.isTarget
          ? `rgba(255, 0, 51, ${n.opacity})`
          : `rgba(204, 255, 0, ${n.opacity * 0.5})`;
        if (n.pulse > 0 && n.isTarget) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#FF0033";
        } else if (n.pulse > 0) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#CCFF00";
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (actualScanY > 0 && actualScanY < canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, actualScanY);
        ctx.lineTo(canvas.width, actualScanY);
        ctx.strokeStyle = "rgba(204, 255, 0, 0.6)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#CCFF00";
        ctx.stroke();
        ctx.shadowBlur = 0;

        const grad = ctx.createLinearGradient(0, actualScanY, 0, actualScanY - scanDir * 60);
        grad.addColorStop(0, "rgba(204, 255, 0, 0.15)");
        grad.addColorStop(1, "rgba(204, 255, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(
          0,
          scanDir > 0 ? actualScanY - 60 : actualScanY,
          canvas.width,
          60,
        );
      }
    }

    function draw() {
      if (!visibleRef.current || pausedRef.current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (variant === "wargame") {
        drawWargameScanner();
      } else {
        drawResearchOrbit();
      }
      raf = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener("resize", resize);
    const observer = new IntersectionObserver((entries) => {
      visibleRef.current = entries.some((entry) => entry.isIntersecting);
    }, { rootMargin: "120px" });
    observer.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [variant, pausedRef]);
  return <canvas ref={ref} />;
}

function SponsorMarquee() {
  const logos = [
    ["hspace-logo.svg", "HSPACE", "hspace"],
    ["Nexsyslab_logo.svg", "NexsysLab", ""],
    ["hspace-logo.svg", "HSPACE", "hspace"],
    ["Nexsyslab_logo.svg", "NexsysLab", ""],
  ];
  return (
    <div className="marquee-container reveal">
      <div className="marquee-track">
        {[0, 1].map((group) => (
          <div className="marquee-group" aria-hidden={group === 1} key={group}>
            {logos.map(([src, alt, cls], index) => (
              <div className={`sponsor-logo ${cls}`} key={`${src}-${group}-${index}`}><img src={`/img/${src}`} alt={alt} /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Qna({ q, children }) {
  return (
    <div className="qna-item reveal">
      <div className="qna-q">{q}</div>
      <div className="qna-a">{children}</div>
    </div>
  );
}

function ResearchHeader({ lang, setLang, onNavigateHome, onNavigateResearch }) {
  return (
    <header className="research-original-header">
      <div className="research-header-inner">
        <a href="/" className="research-brand" aria-label="Rewrite Lab home" onClick={onNavigateHome}>
          <span className="research-brand-mark" />
          <span className="research-brand-solid">Rewrite</span>
          <span className="research-brand-stroke">Lab</span>
        </a>
        <nav className="research-header-nav" aria-label="Research navigation">
          <a href="/#about" onClick={(event) => onNavigateHome(event, "about")}>About</a>
          <a href="/#platforms" onClick={(event) => onNavigateHome(event, "platforms")}>Platforms</a>
          <a href="/#team" onClick={(event) => onNavigateHome(event, "team")}>Team</a>
          <a href="/#sponsor" onClick={(event) => onNavigateHome(event, "sponsor")}>Sponsors</a>
          <a className="is-active" href="/research" onClick={onNavigateResearch}>Research<span /></a>
        </nav>
        <div className="research-header-actions">
          <div className="research-lang-toggle" aria-label="Language">
            <button className={lang === "EN" ? "is-active" : ""} type="button" onClick={() => setLang("EN")}>EN</button>
            <button className={lang === "KO" ? "is-active" : ""} type="button" onClick={() => setLang("KO")}>KO</button>
          </div>
          <a href="https://github.com/rewrite-lab" target="_blank" rel="noopener noreferrer" className="research-social" aria-label="Rewrite Lab GitHub">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="#b8b8b8" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          </a>
          <a href="https://x.com/rewritelab" target="_blank" rel="noopener noreferrer" className="research-social" aria-label="Rewrite Lab X">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#b8b8b8" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93zm-1.29 19.5h2.04L6.48 3.24H4.29L17.61 20.65z" /></svg>
          </a>
        </div>
      </div>
    </header>
  );
}

function ResearchPage({ lang, onNavigateHome, onOpenArticle }) {
  useReveal("research");
  const entries = researchCatalog
    .filter((entry) => entry.variants[lang])
    .sort((a, b) => b.number - a.number);
  const cards = entries.map((entry) => makeResearchCard(entry, lang)).filter(Boolean);

  useEffect(() => {
    const preload = () => {
      const featuredDocument = entries[0]
        ? getResearchDocument(entries[0], lang, false)
        : null;
      const tasks = [loadArticlePage()];
      if (featuredDocument) tasks.push(featuredDocument.load());
      Promise.allSettled(tasks);
    };
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(preload, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [lang]);

  const t = researchStrings[lang];
  const featured = cards[0];
  const metaStr = t.meta(cards.length).join("\u2003\u00b7\u2003");
  const countLabel = lang === "EN"
    ? `${cards.length} ${cards.length === 1 ? "Entry" : t.entries}`
    : `${cards.length}${t.entries}`;
  return (
    <main className="research-root">
      <section className="research-original-hero" data-hero>
        <div className="research-hero-glow" aria-hidden="true" />
        <div className="research-hero-inner">
          <div className="research-hero-copy">
            <div className="research-hero-kicker">
              <span />
              <span>{t.heroKicker}</span>
            </div>
            <h1>
              <span>Open</span>
              <span>Research<span className="research-cursor">_</span></span>
            </h1>
            <p>{t.lead}</p>
            <div className="research-hero-meta">{metaStr}</div>
          </div>
        </div>
      </section>
      <section className="research-original-archive">
        <div className="research-archive-head">
          <div>
            <div className="research-archive-kicker">
              <span />
              <span>{t.archiveKicker}</span>
            </div>
            <h2>{t.archiveTitle}</h2>
          </div>
          <div className="research-count">{countLabel}</div>
        </div>
        {featured && <FeaturedResearchCard card={featured} t={t} onOpenArticle={onOpenArticle} />}
        <div className="research-original-grid">
          {cards.slice(1).map((card, index) => (
            <ResearchGridCard
              card={card}
              imagePriority={index < 4 ? "high" : "low"}
              key={card.id}
              onOpenArticle={onOpenArticle}
            />
          ))}
        </div>
      </section>
      <ResearchFooter t={t} onNavigateHome={onNavigateHome} />
      <div className="research-grain" aria-hidden="true" />
    </main>
  );
}

function ResearchAvatar({ avatar }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatar.image) && !imageFailed;

  return (
    <div className="research-avatar" title={avatar.name}>
      {showImage
        ? <img src={avatar.image} alt={avatar.name} onError={() => setImageFailed(true)} />
        : avatar.initials}
    </div>
  );
}

function ResearchAvatars({ card, featured = false }) {
  return (
    <div className={featured ? "research-avatars is-featured" : "research-avatars"}>
      {card.avatars.map((avatar) => <ResearchAvatar avatar={avatar} key={avatar.id} />)}
      {card.moreCount > 0 && <div className="research-avatar research-avatar-more">+{card.moreCount}</div>}
    </div>
  );
}

function FeaturedResearchCard({ card, t, onOpenArticle }) {
  return (
    <a
      className="research-featured-card"
      href={card.href}
      target={card.isLocal ? undefined : "_blank"}
      rel={card.isLocal ? undefined : "noreferrer"}
      onClick={card.isLocal ? (event) => onOpenArticle(event, card.id, card.badge) : undefined}
      onMouseMove={handleResearchCardMove}
      onMouseEnter={handleResearchCardEnter}
      onMouseLeave={handleResearchCardLeave}
    >
      <div className="research-featured-thumb">
        <div className="research-featured-thumb-bg" style={{ backgroundImage: `url("${card.thumbSrc}")` }} />
        <div className="research-card-gleam" />
      </div>
      <div className="research-featured-body">
        <div><span className="research-latest">{t.latest}</span></div>
        <div className="research-featured-meta-row">
          <span className="research-featured-num">{card.numStr}</span>
          <div className="research-card-meta-line">
            <span>{card.dateStr}</span>
            <span className="research-dot" />
            <span className="research-badge">{card.badge}</span>
          </div>
        </div>
        <h3>{card.title}</h3>
        {card.subtitle && <p>{card.subtitle}</p>}
        <div className="research-contributor-line">
          <ResearchAvatars card={card} featured />
          <span>{card.contributorText}</span>
        </div>
        <div className="research-read-link">
          <span>{t.read}</span>
          <span className="research-arrow">{"\u2192"}</span>
        </div>
      </div>
    </a>
  );
}

function ResearchGridCard({ card, imagePriority, onOpenArticle }) {
  return (
    <a
      className="research-grid-card"
      href={card.href}
      target={card.isLocal ? undefined : "_blank"}
      rel={card.isLocal ? undefined : "noreferrer"}
      onClick={card.isLocal ? (event) => onOpenArticle(event, card.id, card.badge) : undefined}
      onMouseMove={handleResearchCardMove}
      onMouseEnter={handleResearchCardEnter}
      onMouseLeave={handleResearchCardLeave}
    >
      <div className="research-grid-thumb">
        <img
          src={card.thumbSrc}
          alt={card.title}
          decoding="async"
          fetchpriority={imagePriority}
          loading="eager"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
        <div className="research-card-gleam" />
        <div className="research-grid-num">{card.numStr}</div>
      </div>
      <div className="research-grid-body">
        <div className="research-card-meta-line">
          <span>{card.dateStr}</span>
          <span className="research-dot" />
          <span className="research-badge">{card.badge}</span>
        </div>
        <h3>{card.title}</h3>
        {card.subtitle && <p>{card.subtitle}</p>}
        <div className="research-grid-spacer" />
        <div className="research-grid-bottom">
          <ResearchAvatars card={card} />
          <span className="research-arrow">{"\u2192"}</span>
        </div>
      </div>
    </a>
  );
}

function ResearchFooter({ t, onNavigateHome }) {
  return (
    <footer className="research-original-footer">
      <div className="research-footer-inner">
        <div className="research-footer-logo">Rewrite<br />Lab<span>_</span></div>
        <div className="research-footer-main">
          <p>{t.footerTag}</p>
          <div className="research-footer-links">
            <a href="/" onClick={onNavigateHome}>{t.home}</a>
            <a href="https://github.com/rewrite-lab" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://x.com/rewritelab" target="_blank" rel="noopener noreferrer">Twitter</a>
          </div>
        </div>
        <div className="research-copyright">© 2016-2026 Rewrite Lab — All rights reserved</div>
      </div>
    </footer>
  );
}

function Footer({ research }) {
  return (
    <footer className={research ? "research-footer" : ""}>
      <div className="footer-logo">REWRITE LAB</div>
      <div className="footer-copy">© 2026 Rewrite Lab. Transparently sharing what we learn.</div>
    </footer>
  );
}

function App() {
  const [locationState, setLocationState] = useState(currentLocationState);
  const { route, articleNumber, researchLanguage } = locationState;
  const [phase, setPhase] = useState(() => route === ROUTE_HOME ? "home" : "research");
  const [researchStart, setResearchStart] = useState(() => performance.now());
  const [enteredFromHome, setEnteredFromHome] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  useReveal(pageKey);

  const articleEntry = articleNumber ? getResearchEntry(articleNumber) : null;
  const articleDescriptor = articleEntry
    ? getResearchDocument(articleEntry, researchLanguage, false)
    : null;
  const article = articleDescriptor
    ? {
        title: articleDescriptor.title,
        subtitle: "",
        date: articleDescriptor.date,
      }
    : null;
  const nextEntry = articleEntry
    ? researchCatalog
        .filter((entry) => entry.number < articleEntry.number && entry.variants[researchLanguage])
        .at(-1) || null
    : null;
  const nextDocument = nextEntry
    ? getResearchDocument(nextEntry, researchLanguage, false)
    : null;
  const nextArticle = nextDocument
    ? { title: nextDocument.title, subtitle: "", date: nextDocument.date }
    : null;
  const nextHref = nextEntry
    ? researchArticleUrl(nextEntry.number, researchLanguage)
    : "";
  const isArticleRoute = route === ROUTE_ARTICLE && Boolean(articleEntry && articleDescriptor);
  const availableResearchLanguages = isArticleRoute
    ? articleEntry.languages
    : availableCatalogLanguages;

  useEffect(() => {
    if (isArticleRoute) {
      document.title = `${article.title} - Rewrite Lab`;
      document.documentElement.lang = articleDescriptor.language === "KO" ? "ko" : "en";
    } else if (route === ROUTE_RESEARCH) {
      document.title = "Rewrite Lab Research | Web Security Publications";
      document.documentElement.lang = researchLanguage === "KO" ? "ko" : "en";
    } else {
      document.title = "Rewrite Lab | Web Security Research Team";
      document.documentElement.lang = "en";
    }
    document.body.classList.toggle("is-research-route", route === ROUTE_RESEARCH);
    document.body.classList.toggle("is-article-route", isArticleRoute);
    return () => {
      document.body.classList.remove("is-research-route");
      document.body.classList.remove("is-article-route");
    };
  }, [article, articleDescriptor, isArticleRoute, researchLanguage, route]);

  useEffect(() => {
    const onPop = () => {
      const next = currentLocationState();
      setLocationState(next);
      if (next.route !== ROUTE_HOME) storeResearchLanguage(next.researchLanguage);
      setPhase(next.route === ROUTE_HOME ? "home" : "research");
      setEnteredFromHome(false);
      setResearchStart(performance.now());
      setPageKey((k) => k + 1);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigateHome = useCallback((event, hash) => {
    event?.preventDefault();
    const url = hash ? `/#${hash}` : "/";
    window.history.pushState({ route: ROUTE_HOME }, "", url);
    setLocationState({ route: ROUTE_HOME, articleNumber: null, researchLanguage });
    setPhase("home");
    setEnteredFromHome(false);
    setPageKey((k) => k + 1);
    requestAnimationFrame(() => {
      if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [researchLanguage]);

  const navigateResearch = useCallback((event) => {
    event?.preventDefault();
    if (route === ROUTE_RESEARCH) return;
    const nextLanguage = availableCatalogLanguages.includes(researchLanguage)
      ? researchLanguage
      : availableCatalogLanguages[0] || "EN";
    window.history.pushState(
      { route: ROUTE_RESEARCH, researchLanguage: nextLanguage },
      "",
      researchListUrl(nextLanguage),
    );
    storeResearchLanguage(nextLanguage);
    setEnteredFromHome(route === ROUTE_HOME);
    setLocationState({ route: ROUTE_RESEARCH, articleNumber: null, researchLanguage: nextLanguage });
    setPhase("research");
    setResearchStart(performance.now());
    setPageKey((k) => k + 1);
    window.scrollTo(0, 0);
  }, [researchLanguage, route]);

  const openArticle = useCallback((event, nextArticleNumber, preferredLanguage = "EN") => {
    const nextEntryToOpen = getResearchEntry(nextArticleNumber);
    const nextLanguage = normalizeResearchLanguage(preferredLanguage) || "EN";
    const nextDocumentToOpen = getResearchDocument(nextEntryToOpen, nextLanguage, false);
    if (!nextDocumentToOpen) return;
    event?.preventDefault();
    window.history.pushState(
      { route: ROUTE_ARTICLE, articleNumber: nextArticleNumber, researchLanguage: nextLanguage },
      "",
      researchArticleUrl(nextArticleNumber, nextLanguage),
    );
    storeResearchLanguage(nextLanguage);
    setLocationState({
      route: ROUTE_ARTICLE,
      articleNumber: nextArticleNumber,
      researchLanguage: nextLanguage,
    });
    setPhase("research");
    setEnteredFromHome(false);
    setPageKey((k) => k + 1);
    window.scrollTo(0, 0);
  }, []);

  const changeResearchLanguage = useCallback((nextValue) => {
    const nextLanguage = normalizeResearchLanguage(nextValue);
    if (!nextLanguage || nextLanguage === researchLanguage) return;

    const entry = route === ROUTE_ARTICLE ? getResearchEntry(articleNumber) : null;
    const languages = entry ? entry.languages : availableCatalogLanguages;
    if (!languages.includes(nextLanguage)) return;

    const nextUrl = entry
      ? researchArticleUrl(entry.number, nextLanguage)
      : researchListUrl(nextLanguage);
    window.history.pushState(
      { route, articleNumber: entry?.number || null, researchLanguage: nextLanguage },
      "",
      nextUrl,
    );
    storeResearchLanguage(nextLanguage);
    setLocationState({
      route,
      articleNumber: entry?.number || null,
      researchLanguage: nextLanguage,
    });
    setEnteredFromHome(false);
    setPageKey((key) => key + 1);
  }, [articleNumber, researchLanguage, route]);

  return (
    <>
      {!isArticleRoute && (
        <CosmicCanvas route={route} phase={phase} researchStart={researchStart} enteredFromHome={enteredFromHome} />
      )}
      <Navigation
        route={isArticleRoute ? ROUTE_RESEARCH : route}
        onNavigateHome={navigateHome}
        onNavigateResearch={navigateResearch}
        showResearchLanguages={route === ROUTE_RESEARCH || isArticleRoute}
        researchLanguage={researchLanguage}
        availableResearchLanguages={availableResearchLanguages}
        onResearchLanguageChange={changeResearchLanguage}
      />
      {isArticleRoute ? (
        <Suspense fallback={<div className="article-loading-shell" aria-hidden="true" />}>
          <ArticlePage
            article={article}
            documentDescriptor={articleDescriptor}
            teamMembers={teamMembers}
            nextArticle={nextArticle}
            nextHref={nextHref}
            onNavigateResearch={navigateResearch}
            onOpenNext={nextEntry ? (event) => openArticle(event, nextEntry.number, researchLanguage) : undefined}
          />
        </Suspense>
      ) : (
        <div className={`route-shell route-${route} phase-${phase}`} key={route}>
          {route === ROUTE_RESEARCH
            ? <ResearchPage lang={researchLanguage} onNavigateHome={navigateHome} onOpenArticle={openArticle} />
            : <HomePage />}
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
