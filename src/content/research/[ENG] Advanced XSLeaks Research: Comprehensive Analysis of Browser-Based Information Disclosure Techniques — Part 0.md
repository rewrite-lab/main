---
title: "[ENG] Advanced XSLeaks Research: Comprehensive Analysis of Browser-Based Information Disclosure Techniques — Part 0"
date: 2025-07-28 23:53:39
tags:
  - Research
  - XSLeaks
  - CTF
  - Case-Study
  - CVE
  - English
  - Security
  - Web
language: en
author: Rewrite Lab
thumbnail: "/images/thumbnail/xsleaks_advance_research.png"
copyright: |
  © 2025 HSPACE (References) Author: Rewrite Lab
  This copyright applies to this document only.
---

## What is XSLeaks

When it comes to the highest-risk vulnerabilities on the client-side, Cross-Site Scripting (XSS) would undoubtedly be at the top. If one can manipulate the JavaScript execution flow of a browser, it becomes possible to steal user cookies to hijack sessions or launch CSRF attacks that send requests to servers under other users' privileges.

However, in modern web environments, security policies such as CSP (Content Security Policy) and SOP (Same Origin Policy) have been implemented, making it increasingly difficult to freely inject arbitrary scripts or directly read information from cross-origins. In such restricted environments, XSLeaks vulnerabilities serve as a useful attack technique.

**XSLeaks (Cross-Site Leaks)** is an attack technique that exploits subtle behavioral differences in web browsers to infer sensitive information without directly accessing cross-origin resources.

Browser behavioral differences include **response presence**, **error occurrence**, **loading time**, and other factors, and information is inferred based on these differences. Detailed information about each technique will be covered in subsequent posts.

XSLeaks attacks are performed by having an attacker **induce a victim to access a website operated by the attacker**, and then causing the victim to **forcibly interact with resources from other origins** within that site. Through this method, attackers can **extract various information related to the victim from cross-sites**.

## XSLeaks History

XSLeaks attacks have been documented since around 2000.

One of the first papers on this topic was published by Purdue University, which dealt with **techniques for extracting cross-site information by exploiting web caches**.

Starting with this paper, XSLeaks has gradually **evolved to become more sophisticated and diverse**, and in response, major browsers such as **Chrome and Firefox** have continuously **blocked or mitigated** these techniques through security updates.

Before 2017, it was considered very difficult to defend against XSLeaks attacks due to structural limitations inherent in how websites operate. However, from 2017 onwards, various **HTTP extension features began to be introduced** to defend against such attacks. Most notably, through **SameSite cookie** policies, it became possible to **block access to sensitive cookies from cross-origin sites**.

Modern XSLeaks techniques are becoming increasingly diverse and sophisticated in their attack methods. For example, **since 2023, techniques that exploit operating system and browser environment limitations to leak information** have emerged, and methods that **precisely measure minute time differences in HTTP requests** to infer sensitive data are also being researched.

## Research Objectives

The best reference for learning XSLeaks techniques would be [https://xsleaks.dev/](https://xsleaks.dev/). This site is an archive that briefly summarizes and collects almost all XSLeaks attack techniques and related references that currently exist on the web.

Given the many techniques that are organized there, a significant number of people use this site to study and learn XSLeaks techniques.

All techniques and content appearing in this research also extensively cite techniques that exist on [https://xsleaks.dev/](https://xsleaks.dev/).

Despite the existence of a reference with many well-organized techniques and related materials, the reason for conducting this research is that I felt the site was organized more for archival purposes rather than for learning XSLeaks techniques.

As someone who read through the site, I found it difficult to understand and absorb the organized content at once. Since various techniques were organized together, explanations for each technique seemed to be partially omitted or heavily summarized.

For this reason, even after reading, the following questions always lingered in my mind:

- "So why exactly is this vulnerable?"
- "Is this really a vulnerable part? Isn't this just obvious content?"
- "How exactly are these techniques exploited in the real world that they're organized like this?"

Not all techniques organized on the site raised these questions, but while reading through the organization of a considerable number of techniques, these questions kept circling in my head.

I was fundamentally curious about how XSLeaks techniques are actually used and exploited in the real world or CTFs, or what actual cases there have been, but these questions were not clearly resolved.

For this reason, I decided to conduct this research to explain XSLeaks techniques in more detail conceptually, and primarily research why these techniques are actually dangerous and what real cases there have been.

Therefore, this research does not cover all XSLeaks techniques but delves deeply into only specific techniques.

Among XSLeaks, I conducted research to answer the questions: What exactly is this technique, and why is this technique dangerous through case studies based on actual occurrence cases? And how can these techniques be used/applied in areas such as CTFs?

This research explores the following XSLeaks techniques. If all 8 techniques were covered on one page, the content would become quite lengthy and complex. Therefore, research on this topic has been published as a series divided into a total of 3 parts. Since the content of techniques covered in each part is different, I recommend checking the research for the desired part by referring to the information below.

- PART 1
  - CSS Tricks
  - Error events
  - Navigations
- PART 2
  - Frame Counting
  - PostMessage broadcasts
  - Browser features
- PART 3
  - Timing Attacks
  - Experiments
