export function resolveResearchAssetPath(value) {
  const asset = String(value || "").trim();
  if (!asset || asset.startsWith("#") || /^(?:https?:|data:|blob:|mailto:|tel:)/i.test(asset)) {
    return asset;
  }

  const [, pathname = "", suffix = ""] = asset.match(/^([^?#]*)(.*)$/) || [];
  if (pathname.startsWith("/img/")) return `${pathname}${suffix}`;
  if (pathname.startsWith("/images/")) {
    return `/img/${pathname.slice("/images/".length)}${suffix}`;
  }
  return `/img/${pathname.replace(/^\/+/, "")}${suffix}`;
}
