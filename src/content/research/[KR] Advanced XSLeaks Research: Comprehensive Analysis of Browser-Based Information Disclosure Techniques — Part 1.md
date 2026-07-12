---
title: "[KR] Advanced XSLeaks Research: Comprehensive Analysis of Browser-Based Information Disclosure Techniques — Part 1"
date: 2025-07-28 23:53:40
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
author: Predic
thumbnail: "/images/thumbnail/xsleaks_advance_research_part_1.png"
copyright: "© 2025 HSPACE (이 문서의 소재에 한하여), Author : Rewrite Lab (김민찬)"
---

## TL;DR

---

해당 파트에서는 Error Events, CSS Tricks, Navigations 총 세가지 기법을 다룬다.

먼저 Error Events는 말 그대로 여러 오류를 발생 시켜 각 오류가 발생하는지를 관찰해 데이터를 Leak 할 수 있는 기법이다. 해당 Error Events기법은 다른 XS-Leak기법과 엮어서 자주 사용되곤 한다. 추가적으로, 해당 포스트에선 Error Events의 Defense Mechanism에 관해 자세히 다룰 예정이다. 후에 설명하는 CSS Tricks과 Navigations에서도 Error Events기법을 활용하기 때문에 해당 기법을 먼저 읽는 것을 추천한다.

CSS Tricks는 말 그대로 CSS를 활용하여 XS-Leak을 할 수 있는 기법이다. CSS Injection이라는 유명한 Client-Side 기법이 있지만 XS-Leak에서의 CSS Tricks는 직접 CSS를 조작하는 것이 아닌 CSS 변화를 관찰하여 데이터를 Leak하는 기법이다. 특히, 이번 포스트에서는 CTFd에서 발생한 취약점을 중점으로 소개할 예정이다.

마지막으로, Navigations는 Cross Site에서 어떠한 동작(Navigation)을 했는지 알아낼 때 유용하게 사용할 수 있다. 이번 포스트에서는 다운로드, 리다이렉션, 캐싱 총 3가지의 동작을 중점으로 소개할 예정이다.

각 기법은 리얼월드에서 발생할 가능성이 적지 않은 유용한 기술들이다. 때문에 이번 포스트에서는 각 기법들에 대해 자세히 설명을 하고 리얼월드에서 발생했던 취약점을 분석할 것이다.

## Error Events

---

### Onerror attributes

웹페이지에서 요청을 보내면 서버는 해당 요청을 수신 후 처리하는 과정을 거친다. 이후 해당 요청 성공 여부에 따라 다른 응답 상태를 반환한다. (ex. 200 OK, 404 NOT Found)

이외에도 응답에 오류 상태가 있는 경우엔 브라우저에서 오류 이벤트를 발생시킨다.

```jsx
addEventListener("error", (event) => {});

onerror = (event) => {};
```

addEventListener혹은 onerror를 사용해서 onerror 이벤트를 파악할 수 있다.

아래 코드는 img태그를 사용하여 error events를 잡아내는 예시 코드이다.

```jsx
function getError(url) {
  const img = document.createElement("img");
  img.src = url;

  img.onload = () => console.log("success");
  img.onerror = () => console.log("error");
  document.body.appendChild(img);
}

getError("https://example.com/nonexists.png");
getError("https://example.com/");
```

img태그 이외에도 오류 이벤트는 다양한 HTML태그에서 발생할 수 있다. 예를 들어 `<script>`, `<img>`, `<link>` 등의 cross-origin리소르를 로딩하는 태그들의 onerror 속성으로 확인할 수 있다.

또한 일부 동작은 브라우저마다 다르다. 특정 헤더(ex. nosniff, Content-Type)의 존재 여부 또는 브라우저 보호 기능 적용 여부 등에 따라 달라질 수 있다.

해당 에러 이벤트 기능을 활용하면 뒤 목차에서 소개할 “CSS Trick을 활용하여 Response Status를 확인하는 방법”과 비슷하게 사용할 수 있다.

### Example of Error Events XS-Leak

가장 대표적인 예시로 로그인 여부를 확인할 수 있다.

```jsx
const url = "https://example.org/admin";
const script = document.createElement("script");

script.addEventListener("load", (e) => {
  console.log(`${url} exists`);
});

script.addEventListener("error", (e) => {
  console.log(`${url} does not exist`);
});

script.src = url;
document.head.appendChild(script);
```

위 코드는 admin페이지를 방문하게 하여 정상적으로 load되면은 상대방이 admin임을, error가 발생하면 admin으로 로그인 되어있지 않음을 확인할 수 있는 코드이다.

혹은 [`https://example.org/users/{my_username}`](https://example.org/users/my_username과) 과 같은 페이지가 있다고 하자.

만약 해당 /users/my_username 페이지를 my_username과 일치하는 계정의 유저만 접속할 수 있다고 하면은 해당 유저에겐 200Ok 응답이 올거고 해당 유저가 아닌 다른 유저들에게는 404 error 응답을 받을 것이다. 이를 사용하여 유저에게 전체 유저이름에 대해 반복적인 요청을 보내게 하여 오류가 발생하지 않는 my_username을 얻을 수 있을 것이다.

### Twitter API : Find Username

Twitter api엔드포인트에서 해당 error events xsleak 취약점이 제보된 적이 있다.

[X / xAI disclosed on HackerOne: Twitter ID exposure via error-based...](https://hackerone.com/reports/505424)

Twitter에는 사용자 관련 정보를 반환하는 API URL이 있다.

[`https://developer.twitter.com/api/users/{USER_ID}/client-applications.json`](https://developer.twitter.com/api/users/USER_ID/client-applications.json)

로그인하지 않았거나 로그인한 경우에 USER_ID가 로그인한 id와 일치하지 않는 경우 403 상태코드와 오류 메시지가 반환된다.

```jsx
{"error":{"message":"You are not logged in as a user that has access to this developer.twitter.com resource.","sent":"2019-03-06T01:20:56+00:00","transactionId":"00d08f800009d7be"}}.
```

따라서 해당 API의 오류 여부를 확인하여 상대방의 ID를 확인할 수 있다.

아래는 공개된 PoC이다.

```jsx
var id = "Your ID";
var script = document.createElement("script");
script.src = `https://developer.twitter.com/api/users/${id}/client-applications.json`;

script.onload = () => console.log("ID match");
script.onerror = (e) => console.log("ID mismatch");
document.head.appendChild(script);
```

### Defense Mechanism

가장 일반적인 방어 기법은 일관된 동작을 적용하는 것이다. 에러가 나는 페이지일 경우에도 화면에만 에러 여부를 표시하고 Status Code는 일관되게 200Ok를 사용하는 등의 작동을 하게 하면 에러 이벤트 트리거를 방지할 수 있다.

다른 간단한 방어 기법 중 하나는 쿠키 값을 `SameSite=Lax`로 설정하는 것이다. SameSite=Lax로 설정 시에 `<img>`, `<iframe>`, `<script>`등의 서브 리소스 요청에서는 쿠키가 전송되지 않는다. 때문에 해당 태그를 사용하여 로그인 여부를 판단하는 등의 공격을 방지할 수 있다. 그러나 최근 브라우저는 대부분 SameSite=Lax를 기본적으로 설정해놓고 있다.

쿠키 이외에도 헤더를 통해 방지하는 방법이 있다.

첫 번째는 `Cross-Origin-Resource-Policy` 헤더이다.

만약 응답 헤더를 `Cross-Origin-Resource-Policy: same origin` 으로 설정하면은 200Ok나 404 Not Found일 경우에 두 상태코드에서 동일하게 onerror 이벤트가 발생하게 된다. 따라서 공격자는 어떤 요청이 정상적인 요청인지 파악하지 못하게 된다. 좀 더 자세히 설명하자면 `<script>`나 `<img>`처럼 HTML태그로 로드하는 요청엔 내부적으로 no-cors모드로 동작한다. 이 모드때문에 네트워크 요청은 발생시키지만, Cross-Origin-Resource-Policy를 same origin으로 함으로 써 동일 출처가 아닌 요청의 응답 바디는 페이지에 노출되지 못하고 바로 에러 처리가 된다. 이는 명백히 onerror XS-Leak기법엔 효과적이지만 다른 Cross Origin도메인의 바디값을 리소스로 로드하지 못한다는 단점이 있다.

```jsx
GET http://localhost:5555/200 net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 200 (OK)
GET http://localhost:5555/400 net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 400 (Bad Request)
```

두번째 방법은 Fetch Metadata라고 하는 새로운 메커니즘이다.

웹페이지가 요청을 보낼때 브라우저는 자동적으로 아래와 같은 헤더를 추가하여 요청한다.

1. Sec-Fetch-Site : 타깃 사이트와 요청하는 사이트와의 관계
2. Sec-Fetch-Mode : 요청 모드
3. Sec-Fetch-Dest : 요청 목적지

예를 들어

`<script src="http://localhost:5555/200"></script>`

해당 코드와 같이 script tag를 통해 요청 시에 다음 헤더 값들이 자동으로 붙는다.

```jsx
Sec-Fetch-Site: cross-site
Sec-Fetch-Mode: no-cors
Sec-Fetch-Dest: script
```

따라서 서버에선 이 헤더값을 활용하여 정상적인 요청을 차단할 수 있다.

```jsx
app.use((res, res, next) => {
  if (res.headers["Sec-Fetch-Dest"] !== "empty") {
    res.end("Error");
    return;
  }
  next();
});
```

## CSS Tricks

---

### CSS Tricks via Response Status

웹페이지가 서버에 요청을 보내면 서버는 해당 요청을 처리하여 Response Status Code를 결정한다.

아래 링크에서 다양한 응답 헤더를 확인할 수 있다.

https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status

보통 서버에서는 정상적인 응답에 200번대 Status Code를, 비정상적인 응답에는 400번대 Status Code를 반환한다.

이때, Chromium기반 브라우저에서는 히스토리에 200번대 응답만 저장한다. 또한 응답이 저장이 되면 해당 URL의 CSS속성에 :visited 속성이 추가되게 된다.

![방문하고 200Ok인 URL에 대해선 :visited CSS가 추가되어 보라색으로 표시되는걸 확인할 수 있다. 해당 특성을 사용하여 공격자는 사용자가 정상적인 요청을 보냈는지의 여부를 확인할 수 있다.](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023095ea211f580ef9edfed462de3f900/image.png)

방문하고 200Ok인 URL에 대해선 :visited CSS가 추가되어 보라색으로 표시되는걸 확인할 수 있다. 해당 특성을 사용하여 공격자는 사용자가 정상적인 요청을 보냈는지의 여부를 확인할 수 있다.

### CTFd 1-day : Leaking Flags

CTFd는 유명한 CTF 플랫폼이다. 직접 문제를 올릴 수 있고 admin페이지에서 문제들을 관리할 수 있다. 해당 CTFd 3.7.2미만 버전에서 XS Leak기법을 통해 FLAG를 유출할 수 있는 취약점이 발견되었다.

CTFd의 admin페이지에서는 submission이라는 페이지가 있는데 각 유저가 제출한 flag를 확인할 수 있다. 특히, Correct Submission페이지에서는 옳은 flag만을 확인할 수 있는데 여기서, flag의 일부만 검색해서 일치하는 값을 찾을 수 있다.

![Correct Submissions페이지에서 flag일부를 검색 시 일치하는 flag들이 테이블에 표시된다.](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023095ea211f580ef9edfed462de3f900/image%201.png)

Correct Submissions페이지에서 flag일부를 검색 시 일치하는 flag들이 테이블에 표시된다.

![만약, flag와 일치하지 않은  값을 넣으면은 빈 테이블 페이지가 표시된다.](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023095ea211f580ef9edfed462de3f900/image%202.png)

만약, flag와 일치하지 않은 값을 넣으면은 빈 테이블 페이지가 표시된다.

여기서, URL 쿼리를 확인하면 q값에 검색한 값을 넣는걸 확인할 수 있는데, 만약 page가 2인 부분에서 검색을 하면 어떻게 될까?

![page가 2인 곳에서 일치하지 않는 flag 검색값에 대해 404error를 반환한다.](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2023095ea211f580ef9edfed462de3f900/image%203.png)

page가 2인 곳에서 일치하지 않는 flag 검색값에 대해 404error를 반환한다.

원래라면 page가 1일때처럼 빈 테이블을 반환해야하지만 page가 2이상일때는 404 error를 반환하는걸 확인할 수 있다. 이를 활용하여 공격자는 위에서 설명한 :visited 트릭을 활용하여 flag 값을 유출할 수 있다.

전체적인 공격과정은 다음과 같다.

1. Correct Submissions페이지가 2 이상이여야 한다.. (page가 2이상이여야 하는데 CTFd는 50씩 pagination을 진행함, 위의 경우는 한 문제에 대해서만 테스트를 했기에 솔버가 50이상인 문제가 존재해야됨)
2. `/admin/submissions/correct?page=2&field=provided&q={flag값}` path의 q쿼리의 flag값을 조작하여 admin이 해당 url을 방문하도록 한다.
3. 만약, admin이 해당 URL을 재방문 하려할 때 해당 url css에 :visited 속성이 있으면 200 OK이기 때문에 flag값의 일부와 일치함을 알 수 있다.

그러나 최신 브라우저에는 :visited 속성에 대해 직접적인 접근이 엄격하게 제한되어있다. 따라서 공격자는 :visited속성을 직접적으로 알아내는 대신에 `mix-blend-mode`같은 CSS 기법을 사용하여 사용자가 다른 색깔의 url을 클릭하도록 유도해 데이터를 유출할 수 있다.

CTFd플랫폼은 3.7.2버전 이후로 page가 2 이상일때도 404 error가 반환되지 않게 수정하였다.

https://github.com/CTFd/CTFd/commit/c8df40067ce6288b6b5e74c02dcf2fddd4265847

### Mitigation

X-Frame-Options헤더값을 DENY혹은 SAMEORIGIN으로 설정하면 iframe에 Cross-Origin사이트를 로드 할 수 없게 한다. 이를 통해 공격자가 피해사이트를 iframe으로 겹쳐놓고 CSS나 투명도 조작을 통해 UI를 위장하려 해도, 브라우저는 iframe렌더링을 거부하기 때문에 1차적인 공격을 막을 수 있다.

또, 가장 간단한 방법은 브라우저의 히스토리 기능을 끄는것이다. 혹은 FireFox에서는 layout.css.visited_links_enabled이라는 option을 false로 설정하면 :visited 스타일링 자체를 비활성화 할 수 있다.

## Navigations

---

### Background

cross-site가 어떤 요청을 했고 어떤 페이지를 로드하고 navigation을 트리거하는지 알아내는 것은 공격자의 입장에서 매우 유용하다. 사용자의 상태에 따라 웹페이지는 다른 응답을 반환하기 때문에 공격자는 해당 navigation을 통해 다양한 정보를 얻을 수 있다.

### Download Trigger

보통 다운로드 엔드포인트에선 `Content-Disposition: attachment` 헤더를 설정한다.

해당 헤더를 설정하게 되면 브라우저가 직접 탐색하는 대신 응답을 첨부파일로 다운로드하도록 지시한다.

다운로드가 발생했는지 확인하는 방법은 아래 코드를 통해 가능하다.

```jsx
const leak = (url) => {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    // iframe.sandbox = 'allow-scripts allow-same-origin allow-popups';

    iframe.onload = () => {
      try {
        // is it about:balnk?
        void iframe.contentWindow.location.href;
        // 같은 출처라면 접근 가능
        resolve(1);
      } catch {
        // 다른 출처라면 예외 발생
        resolve(0);
      } finally {
        iframe.remove();
      }
    };

    document.body.appendChild(iframe);
  });
};

export { leak };
```

다운로드가 발생하면, 즉 헤더가 `Content-Disposition: attachment` 로 설정되게 되면은 실제로 브라우저는 아무 페이지도 로드하지 않고 첨부파일만 리턴하게 된다. 따라서 `frame.contentWindow.location.href` 값은 `about:blank` 로 설정되게 된다. 즉, iframe내에서 download시도를 하게 되면은 iframe은 onload 이벤트를 트리거하지 않는다. 여기서 `about:blank` 값은 SOP정책에 위배되지 않으므로 try문을 안전하게 처리할 수 있다. 그러나, 그 외 첨부파일이 없는 페이지를 로드하게 되면은 SOP정책에 위배되기 때문에 catch문으로 들어가게 된다. 따라서 해당 코드를 통해 다운로드 navigation의 발생 여부를 확인할 수 있다.

혹은 위의 코드에서 다운로드 모달이 사용자에게 표시되지 않도록 하려면 `iframe.sandbox = 'allow-scripts allow-same-origin allow-popups';` 해당 줄을 추가하면 된다.

※`frame.contentWindow.location.href` 대신 `iframe.contentWindow.frames[0].origin` 등의 값으로도 확인이 가능하다.

### Server-Side Redirections : Max Redirection

3XX로 되어있는 응답코드를 받으면 브라우저는 리다이렉션을 시도한다. 이때, 크롬 브라우저는 최대 리다이렉션 횟수를 20회로 제한하고 있다. 따라서 이를 활용해 Cross Origin페이지의 리다이렉션 횟수를 파악할 수 있다.

과정은 다음과 같다.

1. 미리 공격자의 페이지에서 19번의 리다이렉션을 세팅해 놓는다.
2. 마지막 20번째 리다이렉션을 타겟 페이지로 설정한다.

3-1. 만약 오류 없이 정상 요청 된다면은 해당 타겟 페이지에선 리다이렉션이 발생하지 않는다.

3-2. 반대로 error events가 발생하게 된다면은 해당 타겟 페이지에선 리다이렉션이 발생한다.

### Server-Side Redirects : Inflation

Inflation 기법은 URL 크기를 늘려 Redirection이 발생했는지 확인하는 기법이다. 예를 들어, 대부분의 플랫폼에서 Redirection이 발생할 때 쿼리에 Redirection URL정보를 넣는데 이를 활용하여 URL 길이가 늘어날 때(Redirection이 발생할 때) 최대 URL 길이보다 커지게 하여 에러가 발생하게 해 Redirection여부를 판단할 수 있다.

해당 Inflation 기법은 Server-side와 Client-side로 나뉜다.

1. Server-Side Errors

   Server-Side측에서 알아내기 위해선 해당 서버의 최대 URL 길이를 파악해야 한다. 이는 서버마다 다르기 때문에 이분탐색을 통해 최대 URL 길이를 파악한다.

   ```jsx
   const maxLen = 99999999;
   const payload = "A".repeat(maxLen - 1 - "/login?token=".length);
   const url = `https://victim.com/login?token=${payload}`;

   const img = new Image();
   img.onerror = () => console.log("리다이렉트 → URL 팽창 → 서버 오류 감지");
   img.onload = () => console.log("리다이렉트 없음");
   img.src = url; // cross-origin 요청
   ```

   위의 코드와 같은 방법으로 error events가 발생할 때까지 탐색을 진행한다.

2. Client-Side Errors

   Server-Side와 다르게 Client-Side에서 Error를 유발한다.

   브라우저 중 Chrome은 최대 2MB의 URL길이 한도를 가진다. 이를 넘기면 탐색이 중단되고 오류 발생 후 `about:blank` 와 같은 안전한 페이지로 전환한다.

   여기서는 #fragment를 유용하게 사용할 수 있다.

   먼저 [https://victim.com에서](https://victim.com에서) [https://victim.com/next로](https://victim.com/next로) 리다이렉션 하는 url이 있다고 가정한다.

   만약 [https://victim.com#aaaa와](https://victim.com#aaaa와) 같은 url을 요청하면은 [https://victim.com/next#aaaa로](https://victim.com/next#aaaa로) 요청을 할 것이다. 즉, fragment는 url 리다이렉션 이후에도 유지되고 URL계산에도 포함되기 때문에 이를 활용하여 URL오류를 발생시킬 수 있다.

   위의 Server-Side와 같이 fragment를 오류가 발생하는 URL길이-1만큼 길게 한 후 리다이렉션을 하면은 에러가 발생하여 리다이렉션 유무를 판할 수 있게 된다.

   ```jsx
   const L = 2_097_152; // Chrome 한도
   const pad = "A".repeat(L - 1 - 24); // 24 = 도메인 등 고정부 길이
   const url = `https://victim.com#${pad}`;

   const img = new Image();
   img.onerror = () => console.log("redirect → 길이 초과 감지");
   img.onload = () => console.log("redirect 없음");
   img.src = url; // cross-origin
   ```

   이외에도 `about:blank` 로 이동한다는 점을 활용하여 공격자는 페이지가 동일 출처에 있는지 확인하여 리다이렉션 유무를 판단할 수 있다.

### Probing Cross-Site Redirection by using CSP

Content Security Policy(CSP)를 역이용하여 Cross-Site에 Redirection이 발생했는지 여부를 확인할 수 있다. CSP에는 connect-src를 지원하는데 해당 속성이 CSP로 적용되었을때 fetch시에 connect-src에 해당되지 않는 Cross-Site로 Redirection이 발생하면은 CSP가 위반되어 `SecurityPolicyViolationEvent` 를 트리거 한다.

```html
<meta
  http-equiv="Content-Security-Policy"
  content="connect-src https://example.com"
/>
<script>
  document.addEventListener("securitypolicyviolation", () => {
    console.log("Redirection 발생");
  });

  fetch("https://example.com/might_redirect", {
    mode: "no-cors",
    credentials: "include",
  });
</script>
```

connect-src이외에도 script-src등 다양한 속성을 사용해서도 확인할 수 있다.

```html
<meta
  http-equiv="Content-Security-Policy"
  content="connect-src https://jstest-cenqt.run.goorm.site"
/>
<script>
  document.addEventListener("securitypolicyviolation", (e) => {
    console.log("Redirection 발생");
  });
</script>
<script src="https://jstest-cenqt.run.goorm.site/redirect"></script>
```

만약 도메인의 리다이렉션이 쿠키값에 따라 달라지는 경우 form-action을 사용하여 감지할 수 있다. 이 경우엔 SameSite=Lax 쿠키가 붙는 경우에도 redirect추적이 가능하다.

```html
<meta
  http-equiv="Content-Security-Policy"
  content="form-action https://example.org"
/>
<form action="https://example.org/might_redirect"></form>
<script>
  document.addEventListener("securitypolicyviolation", () => {
    console.log("Redirection 발생");
  });
  document.forms[0].submit();
</script>
```

### Probing Cache

현재 페이지가 캐싱이된 페이지인지 확인할 수 있는 아주 간단한 방법이 있다.

바로 로드되는 Time을 측정하여 캐싱되었는지 확인하는 것이다. 캐싱이 된 페이지는 디스크에서 갖고오기 때문에 캐싱되지 않은 페이지보다 무조건 빠르게 로드될 수 밖에 없다.

그러나 이는 1차적인 방법으로 캐싱되지 않은 페이지와 캐싱된 페이지간의 시간 차가 크지 않다면 이 방법으로 확인하지 못할 수 있다.

```jsx
const probeCached = (url) =>
  new Promise((resolve) => {
    checker.location = url;
    setTimeout(() => checker.stop(), 20);
    setTimeout(() => {
      try {
        checker.origin;
        resolve(false);
      } catch {
        resolve(true);
      }
    }, 50);
  });
```

20ms를 기준으로 두고 20ms이내에 페이지가 로드되었으면 Caching되었다고 판단한다. 만약 20ms이내에 페이지 로드가 완료되었으면 checker.origin에 오류없이 정상적으로 접근할 수 있다. 만약 20ms이내에 로드되지 않았다면 Caching되지 않은 페이지이고 checker가 로드되지 못했기 때문에 checker.origin에 접근 시 에러가 발생하게 된다.

물론 위에서 언급했다시피 1차적인 방법으로 Caching된 페이지가 20ms이내에 들어와야 하고 Caching되지 못한 페이지가 20ms이후로 들어와야 한다. 이는 서버와 사용자 환경에 따라 매우 상이하기 때문에 판별하기 어렵다. 만약, DoS와 같은 추가적인 취약점이 있다면 이를 활용하여 더 효과적으로 판별할 수 있을 것이다.
