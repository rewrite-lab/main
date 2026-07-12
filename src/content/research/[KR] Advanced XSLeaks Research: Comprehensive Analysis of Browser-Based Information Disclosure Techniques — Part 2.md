---
title: "[KR] Advanced XSLeaks Research: Comprehensive Analysis of Browser-Based Information Disclosure Techniques — Part 2"
date: 2025-07-28 23:53:41
tags:
  - Research
  - XSLeaks
  - CTF
  - Case-Study
  - CVE
  - Korean
  - Security
  - Web
language: kr
author: goldleo1
thumbnail: "/images/thumbnail/xsleaks_advance_research_part_2.png"
copyright: "© 2025 HSPACE (이 문서의 소재에 한하여), Author : Rewrite Lab (박진완)"
---

## TL;DR;

---

본 리서치는 XS-Leaks 취약점 중에서 Frame Counting, postMessage broadcasts, browser features에 대한 분석을 담고 있다. Frame Counting은 동일 출처 제약을 우회하지 않고도 민감한 정보를 유추할 수 있는 대표적인 부채널 공격 기법으로, CTF뿐만 아니라 실제 운영 환경에서도 큰 파급력과 위험도를 지닌 공격이다.

Facebook에서 실제로 발생한 사례를 통해 Frame Counting이 어떻게 개인정보 유출로 이어질 수 있는지를 확인할 수 있으며, 이는 단순한 이론적 취약점이 아닌 현실적인 보안 위협임을 보여준다.

postMessage broadcasts의 경우 `targetOrigin` 설정 오류로 인해 발생하는 취약점들을 간략히 소개하며, 향후 더 심화된 분석에서 자세히 다룰 예정이다.

Browser features 섹션에서는 취약점 완화를 위해 도입된 CORB(Cross-Origin Read Blocking)와 CORP(Cross-Origin Resource Policy)가 역설적으로 새로운 XS-Leaks 취약점을 야기하는 현상에 대해 기술한다. 보안을 강화하기 위해 설계된 메커니즘이 오히려 다른 공격 벡터를 생성하는 "보안 기능의 역설"이라는 흥미로운 현상을 보여준다.

# Frame Counting

---

### Concept

Frame Counting은 Content Security Policy가 설정된 상황에서 이를 우회하지 않고 `window.length`를 통하여 민감한 정보를 획득하는 기법이다. 새로운 창을 불러오는 방법으로는 `window.open()`과 `<iframe>`을 활용한 두 가지 방법이 있다.

교차 출처 환경에서 `window.open()`이나 `<iframe>`을 통해 열린 다른 페이지에 접근할 때는 HTML 명세에 따라 제한된 속성에만 접근할 수 있다.

(참고) [HTML Spec](<https://html.spec.whatwg.org/multipage/nav-history-apis.html#crossoriginproperties-(-o-)>)

```jsx
7.2.1.3.1 CrossOriginProperties ( O )
Assert: O is a Location or Window object.

If O is a Location object, then return « { [[Property]]: "href", [[NeedsGet]]: false, [[NeedsSet]]: true }, { [[Property]]: "replace" } ».

Return « { [[Property]]: "window", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "self", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "location", [[NeedsGet]]: true, [[NeedsSet]]: true }, { [[Property]]: "close" }, { [[Property]]: "closed", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "focus" }, { [[Property]]: "blur" }, { [[Property]]: "frames", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "length", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "top", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "opener", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "parent", [[NeedsGet]]: true, [[NeedsSet]]: false }, { [[Property]]: "postMessage" } ».
```

이 중 `win.length` 속성은 window 객체에 직접 로드된 iframe의 수를 알려주는 정보를 제공한다.

```html
<iframe src="https://example.com" width="400" height="200"></iframe>
<!-- 1 -->

<iframe
  srcdoc="
<iframe src='https://example.com'></iframe> <!-- no -->
"
  width="400"
  height="200"
></iframe>
<!-- 2 -->

<script>
  console.log(window.length); // 2
</script>
```

iframe의 개수가 특정 조건에 따라 변화하는 웹 페이지의 경우, 해당 속성을 이용해 역으로 사용자의 상태를 유추할 수 있다. 이는 공격자에게 유의미한 정보 유출 경로를 제공한다.

## Difference between window.open() and iframe

Frame Counting을 활용한 공격을 성공적으로 수행하기 위해서는 `window.open()`과 `<iframe>` 사이의 세부적인 차이점을 이해해야 한다. 만약 취약점은 확인되었지만 exploit이 잘 되지 않는 상황이라면 아래 내용이 유용할 수 있다.

**SameSite Cookie (Lax) 정책의 영향**

`SameSite` 속성이 `Lax`인 경우에는 Top Level Navigation(GET 요청에서 창 전체가 다른 URL로 이동하는 것)에만 Third-party Cookie를 전송한다. 따라서 `<iframe>`을 이용할 경우에는 정상적으로 동작하지 않을 수 있다.

**사용자 클릭 필요**

[MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)에 따르면 “최신 브라우저는 엄격한 팝업 차단 정책을 가지고 있어, 팝업 창은 직접적인 사용자 입력 후에만 열려야 하며 각 `window.open()` 호출마다 별도의 사용자 상호작용이 필요하다.

이는 puppeteer 등으로 제작된 CTF 문제를 풀이할 때 중요한 제약사항이 될 수 있다.

**Framing Protection의 우회**

Framing Protection은 웹 페이지가 `<iframe>`, `<frame>`, `<embed>`, `<object>` 등에 포함되는 것을 막는 보안 기법이다. 많은 XS-Leak 공격이 이러한 프레이밍 기능을 활용하므로, 이를 차단하면 공격을 방지할 수 있다. `X-Frame-Options`와 `Content-Security-Policy`의 `frame-ancestors`를 통해 이를 적용할 수 있다.

```
X-Frame-Options: deny
X-Frame-Options: sameorigin
X-Frame-Options: allow-from https://example.com/
```

**iframe의 sandbox 속성**

| **속성값**                              | **설명**                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| (비어 놓음)                             | 모든 제한 사항(restrictions)을 적용함.                                                                                             |
| allow-forms                             | 리소스(resource)가 폼 데이터를 제출할 수 있도록 허용함.                                                                            |
| allow-modals                            | 리소스가 모달 윈도우(modal window)를 열 수 있도록 허용함.                                                                          |
| allow-orientation-lock                  | 리소스가 화면 방향 전환을 잠글 수 있도록 허용함.                                                                                   |
| allow-pointer-lock                      | 리소스가 Pointer Lock API를 사용할 수 있도록 허용함.                                                                               |
| allow-popups                            | window.open()이나 target=“\_blank” 등의 팝업(popup)을 허용함.                                                                      |
| allow-popups-to-escape-sandbox          | 모든 제한 사항이 적용된 문서(sandboxed document)에서 새로운 창(window)을 열 때 제한 사항을 상속받지 않은 창을 열 수 있도록 허용함. |
| allow-presentation                      | 리소스가 프레젠테이션 세션(presentation section)을 시작할 수 있도록 허용함.                                                        |
| allow-same-origin                       | 리소스가 same-origin policy를 통과된 것처럼 취급될 수 있도록 허용함.                                                               |
| allow-scripts                           | 리소스가 스크립트를 실행할 수 있도록 허용하지만, 팝업창은 생성하지 못함.                                                           |
| allow-storage-access-by-user-activation | 리소스가 Storage Access API를 사용하여 상위 스토리지 기능에 접근 요청을 할 수 있도록 허용함.                                       |
| allow-top-navigation                    | 리소스가 최상위 브라우징 컨텍스트(\_top)를 탐색할 수 있도록 허용함.                                                                |
| allow-top-navigation-by-user-activation | 리소스가 사용자의 요청이 있을 때만 최상위 브라우징 컨텍스트(\_top)를 탐색할 수 있도록 허용함.                                      |

## Case Study - Exposed Private Information (Facebook)

Reference : [https://www.imperva.com/blog/archive/facebook-privacy-bug/](https://www.imperva.com/blog/archive/facebook-privacy-bug/)

2018년 5월 Facebook에서 Frame Counting 기법을 활용한 사용자 프라이빗 정보 유출 취약점이 보고되었다. 이는 단순한 개념 증명에 그치지 않고 실제 대규모 서비스에서 발생한 중대한 보안 사고였다.

Facebook 검색 기능에서는 검색 결과를 iframe으로 응답해준다. 이때 Facebook 검색 결과에 포함된 iframe의 개수를 통해 특정 정보가 존재하는지를 유추할 수 있었다. 공격자는 이를 이용해 다음과 같은 정보들을 유출할 수 있었다.

- 특정 사용자와의 친구 관계 여부
- 특정 페이지 가입 여부
- 개인 프로필의 공개/비공개 상태
- 기타 개인화된 정보의 존재 여부

[PoC Video by Ron Masas](https://youtu.be/DebehDrXs_M)

PoC Video by Ron Masas

이 취약점의 심각성은 공격자가 피해자의 명시적인 동의나 인지 없이도 민감한 개인정보를 유출할 수 있다는 점에 있다. 또한 Same-Origin Policy를 우회하지 않고도 Cross-Origin 정보에 접근할 수 있다는 점에서 기존 보안 모델의 한계를 드러낸 사례로 평가된다.

## In CTFs

CTF에 출제된 Frame Counting 관련 문제입니다.

### Facebook CTF 2019 - [web] secret note keeper

Archive : [https://github.com/fbsamples/fbctf-2019-challenges/tree/main/web/secret_note_keeper](https://github.com/fbsamples/fbctf-2019-challenges/tree/main/web/secret_note_keeper)

흥미롭게도 2018년 Facebook에서 Frame Counting 공격 사례가 보고된 후, 이듬해인 2019년 Facebook CTF에 관련 문제가 출제되었다.

```python
@app.route('/search')
def search_notes():
    notes = []
    if current_user.is_authenticated:
        query = request.args.get('query', None)
        if query is not None:
            query = '%%%s%%' % str(query)
            notes = Note.query.filter(Note.body.like(query), Note.owner_id == current_user.id).limit(100).all()
    return render_template("search.html", notes = notes, current_user = current_user)
```

`/search?query=` 엔드포인트에서 검색된 notes 개수에 맞게 iframe을 로드하므로 Frame Counting 기법을 사용할 수 있다.

```python
...
{% for note in notes %}
<div style="float: left; padding: 5px; border: 1px black solid">
  <iframe style="border: none" src="/note/{{ note.id }}"></iframe>
</div>
{% endfor %}
...
```

### ASIS CTF Finals 2024 - [web] fire-leak

Archive : [https://github.com/arkark/my-ctf-challenges/tree/main/challenges/202412_ASIS_CTF_Finals_2024/web/fire-leak](https://github.com/arkark/my-ctf-challenges/tree/main/challenges/202412_ASIS_CTF_Finals_2024/web/fire-leak)

Frame Counting과 다른 기법을 응용한 심화 문제로, ReDoS(Regular Expression Denial of Service)와 Frame Counting을 결합한 고급 공격 기법을 요구한다.

```python
app.get("/", (req, res) => {
  const html = String(req.query.html ?? defaultHtml);

  if (html.length > 1024) return res.send("?");
  if (/[^\x20-\x7e\r\n]/i.test(html)) return res.send("??");
  if (/meta|link|src|data|href|svg|:|%|&|\\|\/\//i.test(html)) return res.send("???");

  res
    .type("html")
    .setHeader(
      "Content-Security-Policy",
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    )
    .send(html.replace("{{TOKEN}}", req.cookies.TOKEN));
});
```

공격자는 HTML을 삽입할 수 있고, 특정 문자열이 필터링된다. CSP(Content Security Policy)는 `'none'`으로 강력하게 설정되어 있어, 스크립트 실행을 포함한 전통적인 XSS 공격은 원천적으로 차단된다.
삽입된 HTML 내에 포함된 `{{TOKEN}}` 구문은 서버 측에서 자동으로 `req.cookies.TOKEN` 값으로 치환되며, 이는 admin의 인증 토큰을 의미한다.

```python
// Issue a new token
const page1 = await context.newPage();
await page1.goto(APP_URL + "/save-flag", { timeout: 3_000 });
await sleep(2_000);
await page1.close();

// Visit a given URL
const page2 = await context.newPage();
await page2.goto(url, { timeout: 5_000 });
await sleep(60_000);
await page2.close();
```

admin token은 bot에게 report할 때마다 설정된다.

`req.cookies.TOKEN` 을 유출하기 위해서는 XSS가 아닌 Side Channel을 활용하여 풀이해야 한다.

출제자 (Ark)는 **`<input pattern="..." value="...">`** 를 활용하였다.

```html
<input
  type="text"
  pattern=".*(.?){12}[abcd]beaf"
  value="xxxxx...snip...xxxxx{{TOKEN}}"
/>
<iframe></iframe>
```

`<input pattern="..." value="...">` 구조를 활용하여 ReDoS를 통한 시간 지연을 발생시키고, 이로 인한 `iframe.length` 변화 시간의 차이를 이용해 토큰을 유출하는 정교한 공격 기법을 보여준다.

# postMessage Broadcasts

[Ref : mdn docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns)

## Concept

---

`postMessage`는 서로 다른 출처(origin) 간에 메시지를 안전하게 전달할 수 있도록 설계된 웹 API이다. 해당 API는 `Cross-Origin` 환경에서 안전한 통신을 위해 고안되었으며, `targetOrigin` 매개변수를 통해 허용된 Origin에게만 선택적으로 메시지를 전송할 수 있는 기능을 제공한다.

![Safe postMessage.png](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023395ea211f580bcab27f539adf4f8c3/Safe_postMessage.png)

정상적인 사용 환경에서는 개발자가 `targetOrigin`을 명시적으로 설정하여 신뢰할 수 있는 도메인으로만 메시지 전송을 제한한다. 하지만 개발 과정에서의 실수나 보안에 대한 인식 부족으로 인해 `targetOrigin`을 와일드카드(`*`)로 설정하거나 아예 설정하지 않는 경우가 빈번히 발생한다.

![Safe postMessage (1).png](</[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023395ea211f580bcab27f539adf4f8c3/Safe_postMessage_(1).png>)

이와 같은 취약한 구현이 존재할 경우 공격자는 허용되지 않은 Origin에서 피해자의 브라우저로 악의적인 메시지를 전송하거나 민감한 정보가 포함된 메시지를 가로챌 수 있다. 특히 메시지에 사용자의 인증 토큰, 개인정보, 또는 애플리케이션의 내부 상태 정보가 포함되어 있을 경우 직접적인 보안 침해로 이어질 수 있다.

postMessage 관련 취약점은 단순한 `targetOrigin` 설정 오류 외에도 메시지 검증 로직의 부재, 신뢰하지 않는 출처로부터의 메시지 처리, 그리고 다른 웹 취약점과의 연계를 통해 더욱 복잡하고 위험한 형태로 발전할 수 있다. 이러한 고급 공격 기법과 취약한 구현 패턴에 대해서는 별도의 심화 분석에서 상세히 다룰 예정이다.

# Browser Features (CORB, CORP)

CORB(Cross-Origin Read Blocking)와 CORP(Cross-Origin Resource Policy)는 모두 기존 웹 보안 취약점을 완화하기 위해 브라우저 벤더들이 도입한 보안 메커니즘이다. 두 정책 모두 `Cross-Origin` 환경에서 발생할 수 있는 정보 유출과 사이드 채널 공격을 방지하는 것을 목표로 하며, 현재까지도 지속적인 논의와 개선이 이루어지고 있는 발전 중인 보안 기능에 속한다.
하지만 이러한 보안 정책들이 도입되면서 예상치 못한 부작용이 발생하였다. 기존 취약점을 해결하기 위해 설계된 보안 메커니즘 자체가 새로운 형태의 취약점을 만들어내는 아이러니한 상황이 발생한 것이다. 이는 보안 분야에서 "보안 기능의 역설"이라고도 불리는 현상으로, 보안을 강화하려는 시도가 오히려 다른 공격 벡터를 생성하는 사례이다.

CORB와 CORP에서 발생하는 취약점들은 직접적으로 시스템을 침해하거나 크리티컬한 데이터를 유출시키는 고위험 취약점은 아니다. 하지만 이들 취약점은 공격자에게 간접적인 정보 유출 경로를 제공하며, 특히 핑거프린팅(Fingerprinting)이나 사용자의 브라우징 패턴 추론 등에 활용될 수 있는 중요한 사이드 채널을 형성한다.
보안 정책 자체가 공격 도구로 활용될 수 있다는 점에서 이들 취약점은 단순한 기술적 문제를 넘어서 보안 설계 철학에 대한 근본적인 질문을 제기한다. 보안 강화를 위해 도입된 메커니즘이 다른 취약점의 원인이 된다는 사실은 보안 연구자들에게 매우 흥미로운 연구 주제를 제공하며, 이는 현대 웹 보안의 복잡성과 예측 불가능성을 보여주는 대표적인 사례라 할 수 있다.

### CORB

[chromium](https://www.chromium.org/Home/chromium-security/corb-for-developers/)에 따르면 CORB는 아래와 같은 의미를 지닙니다.

```html
Cross-Origin Read Blocking (CORB) is a new web platform security feature that helps mitigate the threat of side-channel attacks (including Spectre). It is designed to prevent the browser from delivering certain Cross-Origin network responses to a web page, when they might contain sensitive information and are not needed for existing web features. For example, it will block a Cross-Origin text/html response requested from a <script> or <img> tag, replacing it with an empty response instead. This is an important part of the protections included with Site Isolation.

This document aims to help web developers know what actions they should take in response to CORB. For more information about CORB in general, please see the CORB explainer, the specification, the "Site Isolation for web developers" article, or the following talk from Google I/O 2018. (The CORB discussion starts at around 23:20 mark.)

---

Cross-Origin Read Blocking (CORB)는 사이드 채널 공격(스펙터 포함)의 위협을 완화하는 데 도움이 되는 새로운 웹 플랫폼 보안 기능입니다. 이 기능은 브라우저가 특정 교차 출처 네트워크 응답을 웹 페이지에 전달하는 것을 방지하도록 설계되었습니다. 이러한 응답은 민감한 정보를 포함할 수 있고 기존 웹 기능에는 필요하지 않을 수 있기 때문입니다. 예를 들어, <script> 또는 <img> 태그에서 요청된 교차 출처 text/html 응답을 차단하고 대신 빈 응답으로 대체합니다. 이는 사이트 격리에 포함된 보호 기능의 중요한 부분입니다.

이 문서는 웹 개발자가 CORB에 대응하여 어떤 조치를 취해야 하는지 알려주는 것을 목표로 합니다. CORB에 대한 더 자세한 정보는 CORB 설명 자료, 사양, "웹 개발자를 위한 사이트 격리" 문서, 또는 Google I/O 2018의 다음 강연을 참조하십시오. (CORB 논의는 23분 20초 경부터 시작됩니다.)
```

정리하면 `nosniff`헤더가 존재하는 Cross-Origin 요청에 대해 적절한 Content-Type이 반환되지 않을 경우에 응답을 차단하고 빈 응답으로 대체합니다. 예를 들어 `<script src="/path">`와 같은 요청에서 응답하는 `/path` 의 Content-Type이 `text/html`인 경우에는 이를 차단하고 응답 본문이 빈 값으로 표시됩니다.

그러나 이 때문에 새로운 XS-Leaks 취약점이 발생합니다.

다음 2가지가 발생하는데 하나씩 알아보겠습니다.

- **`CORB` 여부 감지 :** 한 상태는 요청이 CORB에 의해 보호, 두 번째 상태는 4xx/5xx 에러
- **`nosniff` 헤더 감지 :** 한 상태는 CORB에 의해 보호, 두 번째 상태는 보호 x

**`CORB` 여부 감지**

1. 공격자는 `Content-Type`이 `text/html`이고 `nosniff` 헤더가 있는 200 OK를 반환하는 Cross-Origin 리소스를 **스크립트 태그**에 포함할 수 있습니다.
2. **CORB**는 원래 응답을 빈 응답으로 대체합니다.
3. 빈 응답은 유효한 JavaScript이므로 `onerror` 이벤트는 발생하지 않고, 대신 `onload`가 발생합니다.
4. 공격자는 1.과 같이 두 번째 요청(두 번째 상태에 해당)을 트리거하는데, 이 요청은 4xx/5xx에러를 반환합니다. 이때 `onerror` 이벤트가 발생합니다.

- 200 + CORB —> onload
- 4xx/5xx + no CORB —> onerror

두가지 상태를 구별할 수 있게 되면서 **XS-Leak**가 발생합니다.

**`nosniff` 헤더 감지**

CORB는 공격자가 `nosniff` 헤더가 요청에 존재하는지 감지할 수도 있습니다.

이 문제는 CORB가 이 헤더의 존재 여부와 일부 스니핑 알고리즘에 따라서만 적용된다는 사실 때문에 발생했습니다.

아래 예시는 두 가지 구별 가능한 상태를 보여줍니다.

- 리소스를 `Content-Type`이 `text/html`인 상태에서 `nosniff` 헤더와 함께 제공하는 경우, CORB는 리소스를 스크립트로 임베드하는 공격자 페이지를 방지합니다.
- 리소스를 `nosniff` 없이 제공하고 CORB가 페이지의 `Content-Type`을 추론하지 못하는 경우(여전히 `text/html`로 유지), 내용이 유효한 JavaScript로 파싱될 수 없기 때문에 **SyntaxError**가 발생합니다. **스크립트 태그는 특정 조건에서만 에러 이벤트를 트리거**하므로, 이 에러는 `window.onerror`를 수신하여 잡을 수 있습니다.

따라서 `nosniff` 헤더의 존재 여부를 유출할 수 있습니다.

### CORP

**CORP**는 Cross-Origin Resource Policy의 약자로 다른 출처에서 자원이 로드되는 것을 차단하는 역할을 합니다.

예를 들어 `https://example.com/image.png` 에 `Cross-Origin-Resource-Policy: same-origin`가 설정되어 있다면:

- `https://example.com` 내에서 `<img src="/image.png">` ✅
- `https://attacker.com`에서 `<img src="https://example.com/image.png">` ❌

`CORP`로 인한 XS-Leaks 취약점은 `CORB`의 경우와 유사한 메커니즘을 가집니다. 특정 자원이 `CORP` 정책에 의해 차단될 때와 그렇지 않을 때의 브라우저 동작(예: 에러 발생 여부, 로딩 시간의 차이 등)을 감지함으로써 공격자가 정보를 유출할 수 있습니다. 예를 들어, 특정 URL에 접근 가능 여부를 `CORP` 차단 여부로 판단하여 로그인 상태나 개인화된 데이터의 존재를 추론하는 것이 가능해집니다.

# Review

연구를 통해 XS-Leaks 기법이 단순한 이론적 개념에 머무르지 않고, 실제 상용 서비스 환경에서도 충분히 악용될 수 있는 현실적인 위협임을 확인하였다. 또한 추가로 버그 바운티 진행 중 실제 서비스에서 XS-Leaks 취약점을 발견함으로써, 이러한 기법이 실질적인 보안 문제로 작용할 수 있음 또한 입증하였다.

XS-Leaks는 Side-Channel 특성상 탐지가 어렵고, 전통적인 보안 모델만으로는 효과적인 대응이 어렵다. 특히 동일 출처 정책(SOP)을 우회하지 않고도 민감한 정보를 추론할 수 있다는 점에서, 기존 보안 체계의 한계를 드러낸다. 이에 따라 프레임 차단 정책(X-Frame-Options, frame-ancestors)과 콘텐츠 보안 정책(CSP)의 강화를 포함한 정교한 대응 전략이 요구된다.

또한 CORB와 CORP와 같은 브라우저 보안 기능은 특정 공격 벡터를 차단하는 데 효과적이지만, 잘못 구성하거나 특정 조건 하에서는 새로운 부채널 공격의 단서가 될 수 있다. 보안 기능의 설계 및 적용에 있어서도 세밀한 검토와 테스트가 병행되어야 한다.

결과적으로 XS-Leaks는 여전히 발전 중인 영역이며, 그 복잡성과 유연성으로 인해 공격자에게는 유용한 도구가, 방어자에게는 해결해야 할 보안 과제로 다가오고 있다. 실무적인 대응책 마련과 더불어 최신 기술 동향에 대한 지속적인 학습과 실습을 통해, 관련 이해도를 높이는 것이 무엇보다 중요하다.
