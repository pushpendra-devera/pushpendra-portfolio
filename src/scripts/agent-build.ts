/**
 * Agent build: the homepage intro where a handful of cursor "agents" rebuild
 * the page in front of the visitor.
 *
 * How it works:
 *   1. An inline script in <head> (src/components/AgentBuild.astro) decides
 *      before first paint whether to play, and if so adds `ab-pending` to
 *      <html>, which hides the page roots.
 *   2. This module walks those roots and picks "targets": text blocks, boxes
 *      (anything with a background, border or shadow) and media. Each one is
 *      hidden individually with `data-ab="hidden"`, then `ab-pending` is
 *      removed in the same task, so nothing flashes.
 *   3. Agents fly to a ready target (its parent target is already revealed),
 *      drag a wireframe over it with a live "W × H" label, then reveal it:
 *      single-line text types in, paragraphs reveal line by line, boxes and
 *      media fade in.
 *   4. Content below the fold builds as it scrolls into view.
 *
 * Safety rails, because a portfolio must never show a blank page:
 *   - every activated target has a deadline; past it, it is revealed anyway;
 *   - Skip button and Esc reveal everything at once;
 *   - focusing hidden content (keyboard) reveals it immediately;
 *   - reaching the page bottom, a 90 s cap, or any runtime error reveals all;
 *   - the head script's own timer un-hides the page if this module never
 *     starts (slow network, script blocked);
 *   - runs once per browser session, never under prefers-reduced-motion.
 *
 * Written from scratch for this site. The idea (multiplayer design-tool
 * cursors building a page) is a common motif; no third-party code is used.
 */

declare global {
  interface Window {
    __abStarted?: boolean;
  }
}

type Kind = "type" | "lines" | "box" | "media";
type State = "hidden" | "claimed" | "revealing" | "done";
type Mode = "intro" | "replay";
type Phase = "travel" | "draw" | "reveal";
type TargetEl = HTMLElement | SVGElement;

interface Target {
  el: TargetEl;
  kind: Kind;
  steps: number;
  parent: Target | null;
  state: State;
  active: boolean;
  deadline: number;
  key: number;
  revealEnd: number;
}

interface Frame {
  node: HTMLElement;
  label: HTMLElement;
  el: TargetEl;
  w: number;
  h: number;
  live: boolean;
  fadeAt: number;
  labelText: string;
}

interface Task {
  target: Target;
  phase: Phase;
  t0: number;
  dur: number;
  fromX: number;
  fromY: number;
  frame: Frame | null;
  speed: number;
}

interface Agent {
  index: number;
  node: HTMLElement;
  x: number;
  y: number;
  task: Task | null;
  parked: boolean;
}

interface Ui {
  root: HTMLElement;
  stage: HTMLElement;
  frames: HTMLElement;
  rulerX: HTMLCanvasElement;
  rulerY: HTMLCanvasElement;
  bar: HTMLElement;
  done: HTMLElement;
  progress: HTMLElement;
  status: HTMLElement;
  skip: HTMLButtonElement;
  avatars: HTMLElement[];
}

const ROOT_SELECTOR = "#header, main > *, body > footer";
const SESSION_KEY = "ab-played";

const ROSTER = [
  { name: "Layout", color: "#1d4ed8" },
  { name: "Copy", color: "#be185d" },
  { name: "Style", color: "#6d28d9" },
  { name: "A11y", color: "#047857" },
  { name: "Motion", color: "#b45309" },
  { name: "QA", color: "#b91c1c" },
] as const;

/** Time budget for everything visible on load (header + hero). */
const FIRST_WAVE_MS = 5600;
/** Time budget for content that scrolls into view later. */
const SCROLL_WAVE_MS = 1600;
/** Time budget for a manual "Rebuild" of the current viewport. */
const REPLAY_MS = 4200;
/** Rough cost of one target at speed 1 (travel + draw + reveal). */
const BASE_TASK_MS = 950;
const MAX_SPEED = 5;
/** How many queued targets an idle agent considers before picking. */
const LOOKAHEAD = 8;
/** Absolute cap on an intro, however long the visitor lingers. */
const HARD_CAP_MS = 90_000;

const MEDIA_TAGS = new Set(["svg", "img", "picture", "video", "canvas"]);
const SKIP_TAGS = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "link",
  "meta",
]);

let current: Build | null = null;
let rebuildButton: HTMLButtonElement | null = null;

export function initAgentBuild(): void {
  const html = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) rebuildButton = mountRebuildButton();

  if (!html.classList.contains("ab-pending")) {
    showRebuild();
    return;
  }

  window.__abStarted = true;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage blocked: the intro may simply replay on the next load.
  }
  run("intro");
}

function run(mode: Mode): void {
  if (current) return;
  hideRebuild();
  const build = new Build(mode);
  current = build;
  try {
    build.start();
  } catch (err) {
    console.error("[agent-build]", err);
    build.abort();
  }
}

/* ------------------------------------------------------------------ */
/* Target collection                                                   */
/* ------------------------------------------------------------------ */

function isTransparent(color: string): boolean {
  return (
    color === "transparent" ||
    /rgba\([^)]*,\s*0\)$/.test(color) ||
    /\/\s*0\)$/.test(color)
  );
}

function isBox(cs: CSSStyleDeclaration): boolean {
  if (!isTransparent(cs.backgroundColor)) return true;
  if (cs.boxShadow && cs.boxShadow !== "none") return true;
  const sides = ["Top", "Right", "Bottom", "Left"] as const;
  return sides.some((side) => {
    const width = parseFloat(cs.getPropertyValue(`border-${side}-width`));
    const style = cs.getPropertyValue(`border-${side}-style`);
    const color = cs.getPropertyValue(`border-${side}-color`);
    return width > 0 && style !== "none" && !isTransparent(color);
  });
}

function ownTextLength(el: Element): number {
  let length = 0;
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      length += (node.textContent ?? "").trim().length;
    }
  }
  return length;
}

function makeTarget(
  el: TargetEl,
  kind: Kind,
  steps: number,
  parent: Target | null,
): Target {
  return {
    el,
    kind,
    steps,
    parent,
    state: "hidden",
    active: false,
    deadline: Infinity,
    key: 0,
    revealEnd: 0,
  };
}

function textTarget(
  el: TargetEl,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  parent: Target | null,
): Target {
  const chars = (el.textContent ?? "").replace(/\s+/g, " ").trim().length;
  let lineHeight = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    lineHeight = parseFloat(cs.fontSize) * 1.25;
  }
  const lines = Math.max(1, Math.round(rect.height / lineHeight));
  return lines > 1
    ? makeTarget(el, "lines", Math.min(lines, 24), parent)
    : makeTarget(el, "type", clamp(chars, 1, 80), parent);
}

function visitChildren(el: Element, parent: Target | null, out: Target[]) {
  for (const child of Array.from(el.children)) visit(child, parent, out);
}

function visit(el: Element, parent: Target | null, out: Target[]): void {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
  const tag = el.localName;
  if (SKIP_TAGS.has(tag) || el.hasAttribute("data-ab-skip")) return;

  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  if (cs.display === "contents") {
    visitChildren(el, parent, out);
    return;
  }

  const rect = el.getBoundingClientRect();
  const sized = rect.width >= 2 && rect.height >= 2;

  if (MEDIA_TAGS.has(tag)) {
    if (sized) out.push(makeTarget(el, "media", 1, parent));
    return;
  }

  const ownText = ownTextLength(el);
  if (rect.width > 0 && rect.height > 0 && isBox(cs)) {
    const target = makeTarget(el, "box", 1, parent);
    out.push(target);
    if (!ownText) visitChildren(el, target, out);
    return;
  }

  if (ownText && sized) {
    out.push(textTarget(el, cs, rect, parent));
    return;
  }

  visitChildren(el, parent, out);
}

/* ------------------------------------------------------------------ */
/* The build                                                           */
/* ------------------------------------------------------------------ */

class Build {
  private readonly mode: Mode;
  private targets: Target[] = [];
  private readonly byEl = new Map<Element, Target>();
  private queue: Target[] = [];
  private queueDirty = false;
  private revealing: Target[] = [];
  private agents: Agent[] = [];
  private frames: Frame[] = [];
  private ui: Ui | null = null;
  private io: IntersectionObserver | null = null;
  private seenFirstBatch = false;
  private raf = 0;
  private lastNow = 0;
  private startedAt = 0;
  private doneCount = 0;
  private shownDone = -1;
  private busy = false;
  private idleSince = 0;
  private ended = false;
  private waiting = false;

  constructor(mode: Mode) {
    this.mode = mode;
  }

  start(): void {
    const html = document.documentElement;
    for (const root of Array.from(document.querySelectorAll(ROOT_SELECTOR))) {
      visit(root, null, this.targets);
    }
    if (this.mode === "replay") this.keepViewportTargets();

    if (this.targets.length === 0) {
      html.classList.remove("ab-pending");
      this.ended = true;
      current = null;
      showRebuild();
      return;
    }

    for (const target of this.targets) {
      target.el.setAttribute("data-ab", "hidden");
      this.byEl.set(target.el, target);
    }
    // The hero's own CSS fade-in would fight the build (and shift the
    // measured rects while it slides), so it is retired for this page view.
    for (const el of Array.from(
      document.querySelectorAll(".animate-fade-in"),
    )) {
      el.classList.remove("animate-fade-in", "animation-delay-200");
    }
    html.classList.remove("ab-pending");
    html.classList.add("ab-active");

    const count = window.innerWidth < 640 ? 4 : ROSTER.length;
    this.ui = createUi(count, this.targets.length, () => this.skip());
    this.agents = this.createAgents(count, this.ui);

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("focusin", this.onFocusIn);
    window.addEventListener("scroll", this.onScroll, { passive: true });

    this.startedAt = performance.now();
    if (this.mode === "replay") {
      const deadline = this.startedAt + REPLAY_MS;
      for (const target of this.targets) this.activate(target, deadline);
      this.kick();
    } else {
      this.io = new IntersectionObserver(this.onIntersect, {
        rootMargin: "0px 0px -6% 0px",
      });
      for (const target of this.targets) this.io.observe(target.el);
    }
  }

  /** Skip: show everything now. */
  skip(): void {
    if (this.ended) return;
    this.revealAllNow();
    this.teardown(0);
  }

  /** Error path: same as skip, and make sure the page roots are visible. */
  abort(): void {
    document.documentElement.classList.remove("ab-pending");
    this.revealAllNow();
    this.teardown(0);
  }

  private keepViewportTargets(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const keep = new Set<Target>();
    for (const target of this.targets) {
      const r = target.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
        keep.add(target);
      }
    }
    this.targets = this.targets.filter((target) => keep.has(target));
    for (const target of this.targets) {
      let parent = target.parent;
      while (parent && !keep.has(parent)) parent = parent.parent;
      target.parent = parent;
    }
  }

  private createAgents(count: number, ui: Ui): Agent[] {
    const agents: Agent[] = [];
    for (let i = 0; i < count; i++) {
      const spec = ROSTER[i];
      const node = document.createElement("div");
      node.className = "ab-agent is-parked";
      node.style.setProperty("--ab-c", spec.color);
      node.innerHTML =
        '<svg class="ab-pointer" width="18" height="20" viewBox="0 0 18 20">' +
        '<path d="M2 1.5v15.2l4.1-3.9 2.6 5.7 2.7-1.2-2.6-5.6h5.8z"/></svg>' +
        `<span class="ab-tag">${spec.name}</span>`;
      ui.stage.append(node);
      const home = this.parkPoint(i, count);
      const agent: Agent = {
        index: i,
        node,
        x: home.x,
        y: home.y,
        task: null,
        parked: true,
      };
      placeAgent(agent);
      agents.push(agent);
    }
    return agents;
  }

  private parkPoint(index: number, count: number): { x: number; y: number } {
    const dot = this.ui?.avatars[index];
    if (dot) {
      const r = dot.getBoundingClientRect();
      if (r.width > 0) return { x: r.left + r.width / 2, y: r.top };
    }
    const bar = this.ui?.bar.getBoundingClientRect();
    const cx = bar ? bar.left + bar.width / 2 : window.innerWidth / 2;
    const cy = bar ? bar.top : window.innerHeight - 40;
    return { x: cx + (index - (count - 1) / 2) * 14, y: cy };
  }

  /* ---- activation ------------------------------------------------ */

  private onIntersect = (entries: IntersectionObserverEntry[]): void => {
    const now = performance.now();
    const firstBatch = !this.seenFirstBatch;
    this.seenFirstBatch = true;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = this.byEl.get(entry.target);
      if (!target) continue;
      this.io?.unobserve(entry.target);
      if (target.active) continue;
      this.activate(
        target,
        now + (firstBatch ? FIRST_WAVE_MS : SCROLL_WAVE_MS),
      );
    }
    this.kick();
  };

  private activate(target: Target, deadline: number): void {
    let node: Target | null = target;
    while (node && !node.active) {
      node.active = true;
      node.deadline = deadline;
      const r = node.el.getBoundingClientRect();
      node.key = r.top + window.scrollY + r.left * 0.05;
      this.queue.push(node);
      this.queueDirty = true;
      node = node.parent;
    }
  }

  private activateRemaining(): void {
    const deadline = performance.now() + SCROLL_WAVE_MS;
    for (const target of this.targets) {
      if (!target.active) this.activate(target, deadline);
    }
    this.io?.disconnect();
    this.kick();
  }

  /* ---- events ---------------------------------------------------- */

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.skip();
  };

  private onFocusIn = (event: FocusEvent): void => {
    const now = performance.now();
    let node = event.target instanceof Element ? event.target : null;
    while (node && node !== document.body) {
      const target = this.byEl.get(node);
      if (target) this.forceReveal(target, now);
      node = node.parentElement;
    }
    this.kick();
  };

  private onScroll = (): void => {
    if (atPageBottom()) this.activateRemaining();
  };

  /* ---- loop ------------------------------------------------------ */

  private kick(): void {
    if (this.raf || this.ended) return;
    this.lastNow = performance.now();
    this.raf = requestAnimationFrame(this.step);
  }

  private step = (now: number): void => {
    this.raf = 0;
    if (this.ended) return;
    try {
      this.tick(now);
    } catch (err) {
      console.error("[agent-build]", err);
      this.abort();
      return;
    }
    if (this.ended) return;
    if (this.needsLoop()) {
      this.raf = requestAnimationFrame(this.step);
    } else if (atPageBottom()) {
      // Nothing left in view and nowhere left to scroll: whatever never
      // intersected (clipped, off-canvas) gets built now.
      this.activateRemaining();
    } else {
      this.setWaiting(true);
    }
  };

  private tick(now: number): void {
    // A background tab pauses rAF; push every clock forward by the gap so a
    // visitor who returns later still sees the build instead of a flash.
    const gap = now - this.lastNow;
    if (gap > 400) {
      const shift = gap - 16;
      for (const target of this.queue) target.deadline += shift;
      for (const target of this.revealing) target.revealEnd += shift;
      for (const agent of this.agents) {
        if (agent.task) agent.task.t0 += shift;
      }
      this.startedAt += shift;
    }
    const dt = Math.min(64, Math.max(0, now - this.lastNow));
    this.lastNow = now;

    if (now - this.startedAt > HARD_CAP_MS) {
      this.skip();
      return;
    }

    this.revealing = this.revealing.filter((target) => {
      if (now < target.revealEnd) return true;
      this.finalize(target);
      return false;
    });

    for (const target of this.queue) {
      if (
        (target.state === "hidden" || target.state === "claimed") &&
        now > target.deadline
      ) {
        this.forceReveal(target, now);
      }
    }

    let anyBusy = false;
    for (const agent of this.agents) {
      this.advance(agent, now, dt);
      if (agent.task) anyBusy = true;
    }
    if (anyBusy) this.setWaiting(false);

    this.updateFrames(now);
    this.updateBusy(anyBusy, now);
    if (this.busy) this.drawRulers();
    this.updateBar();

    if (this.doneCount >= this.targets.length) this.complete();
  }

  private needsLoop(): boolean {
    if (this.revealing.length || this.frames.length) return true;
    if (this.busy) return true;
    if (this.agents.some((agent) => agent.task || !agent.parked)) return true;
    return this.queue.some(
      (target) => target.state === "hidden" || target.state === "claimed",
    );
  }

  /* ---- agents ---------------------------------------------------- */

  private advance(agent: Agent, now: number, dt: number): void {
    if (!agent.task) {
      const target = this.pick(agent);
      if (target) {
        target.state = "claimed";
        const speed = this.speed(now);
        const r = target.el.getBoundingClientRect();
        const distance = Math.hypot(r.left - agent.x, r.top - agent.y);
        agent.task = {
          target,
          phase: "travel",
          t0: now,
          dur: clamp(160 + distance * 0.45, 180, 650) / speed,
          fromX: agent.x,
          fromY: agent.y,
          frame: null,
          speed,
        };
        if (agent.parked) {
          agent.parked = false;
          agent.node.classList.remove("is-parked");
        }
      } else {
        this.drift(agent, dt);
        return;
      }
    }

    const task = agent.task;
    const target = task.target;
    const r = target.el.getBoundingClientRect();
    const p = Math.min(1, (now - task.t0) / task.dur);

    if (task.phase === "travel") {
      const e = easeInOut(p);
      agent.x = lerp(task.fromX, r.left, e);
      agent.y = lerp(task.fromY, r.top, e);
      if (p >= 1) {
        task.phase = "draw";
        task.t0 = now;
        task.dur = 280 / task.speed;
        task.frame = this.openFrame(target.el);
      }
    } else if (task.phase === "draw") {
      const e = easeOut(p);
      if (task.frame) {
        task.frame.w = r.width * e;
        task.frame.h = r.height * e;
      }
      agent.x = r.left + r.width * e;
      agent.y = r.top + r.height * e;
      if (p >= 1) {
        if (task.frame) task.frame.live = true;
        const dur = revealDuration(target) / task.speed;
        if (target.state === "claimed") this.beginReveal(target, now, dur);
        task.phase = "reveal";
        task.t0 = now;
        task.dur = target.state === "revealing" ? dur : 120;
      }
    } else {
      if (target.kind === "type") {
        agent.x = r.left + r.width * p;
        agent.y = r.top + r.height * 0.6;
      } else if (target.kind === "lines") {
        agent.x = r.right - 6;
        agent.y = r.top + r.height * p;
      } else {
        const wiggle = Math.sin(p * Math.PI) * 4;
        agent.x = r.right + wiggle;
        agent.y = r.bottom + wiggle;
      }
      if (p >= 1) {
        if (task.frame) task.frame.fadeAt = now + 160;
        agent.task = null;
      }
    }
    placeAgent(agent);
  }

  private drift(agent: Agent, dt: number): void {
    if (agent.parked) return;
    const home = this.parkPoint(agent.index, this.agents.length);
    const k = Math.min(1, dt / 140);
    agent.x += (home.x - agent.x) * k;
    agent.y += (home.y - agent.y) * k;
    if (Math.hypot(home.x - agent.x, home.y - agent.y) < 3) {
      agent.parked = true;
      agent.node.classList.add("is-parked");
    }
    placeAgent(agent);
  }

  private pick(agent: Agent): Target | null {
    if (this.queueDirty) {
      this.queue = this.queue.filter(
        (target) => target.state === "hidden" || target.state === "claimed",
      );
      this.queue.sort((a, b) => a.key - b.key);
      this.queueDirty = false;
    }
    const vh = window.innerHeight;
    let best: Target | null = null;
    let bestScore = Infinity;
    let seen = 0;
    for (const target of this.queue) {
      if (target.state !== "hidden") continue;
      const parent = target.parent;
      if (parent && (parent.state === "hidden" || parent.state === "claimed")) {
        continue;
      }
      const r = target.el.getBoundingClientRect();
      // Mostly top-down (queue order), with distance as a tie-breaker so
      // agents stay local instead of criss-crossing the page.
      const distance = Math.hypot(r.left - agent.x, r.top - agent.y);
      let score = distance * 0.3 + seen * 140;
      if (r.bottom < 0 || r.top > vh) score += 4000;
      if (score < bestScore) {
        best = target;
        bestScore = score;
      }
      if (++seen >= LOOKAHEAD) break;
    }
    return best;
  }

  /** Speed multiplier so the active work finishes before its deadline. */
  private speed(now: number): number {
    let remaining = 0;
    let soonest = Infinity;
    for (const target of this.queue) {
      if (target.state !== "hidden") continue;
      remaining++;
      if (target.deadline < soonest) soonest = target.deadline;
    }
    const left = Math.max(300, soonest - now);
    return clamp(
      ((remaining + 1) * BASE_TASK_MS) / (this.agents.length * left),
      1,
      MAX_SPEED,
    );
  }

  /* ---- reveal ---------------------------------------------------- */

  private beginReveal(
    target: Target,
    now: number,
    dur: number,
    kind: Kind = target.kind,
  ): void {
    target.state = "revealing";
    target.el.style.setProperty("--ab-dur", `${Math.round(dur)}ms`);
    target.el.style.setProperty("--ab-steps", String(target.steps));
    target.el.setAttribute("data-ab", kind);
    target.revealEnd = now + dur + 40;
    this.revealing.push(target);
    this.queueDirty = true;
  }

  private forceReveal(target: Target, now: number): void {
    if (target.state === "revealing" || target.state === "done") return;
    if (target.parent) this.forceReveal(target.parent, now);
    this.beginReveal(target, now, 220, "box");
  }

  private finalize(target: Target): void {
    if (target.state === "done") return;
    const el = target.el;
    el.removeAttribute("data-ab");
    el.style.removeProperty("--ab-dur");
    el.style.removeProperty("--ab-steps");
    if (el.getAttribute("style") === "") el.removeAttribute("style");
    target.state = "done";
    this.doneCount++;
  }

  private revealAllNow(): void {
    for (const target of this.targets) this.finalize(target);
    this.revealing = [];
  }

  /* ---- frames, rulers, bar --------------------------------------- */

  private openFrame(el: TargetEl): Frame | null {
    if (!this.ui) return null;
    const node = document.createElement("div");
    node.className = "ab-frame";
    node.innerHTML = "<i></i><i></i><i></i><i></i>";
    const label = document.createElement("span");
    label.className = "ab-size";
    node.append(label);
    this.ui.frames.append(node);
    const frame: Frame = {
      node,
      label,
      el,
      w: 0,
      h: 0,
      live: false,
      fadeAt: 0,
      labelText: "",
    };
    this.frames.push(frame);
    return frame;
  }

  private updateFrames(now: number): void {
    this.frames = this.frames.filter((frame) => {
      if (frame.fadeAt && now >= frame.fadeAt + 260) {
        frame.node.remove();
        return false;
      }
      const r = frame.el.getBoundingClientRect();
      if (frame.live) {
        frame.w = r.width;
        frame.h = r.height;
      }
      frame.node.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      frame.node.style.width = `${frame.w}px`;
      frame.node.style.height = `${frame.h}px`;
      const text = `${Math.round(frame.w)} × ${Math.round(frame.h)}`;
      if (text !== frame.labelText) {
        frame.labelText = text;
        frame.label.textContent = text;
      }
      if (frame.fadeAt && now >= frame.fadeAt) {
        frame.node.classList.add("is-fading");
      }
      return true;
    });
  }

  private updateBusy(anyBusy: boolean, now: number): void {
    if (anyBusy) this.idleSince = 0;
    else if (!this.idleSince) this.idleSince = now;
    const busy = anyBusy || (this.idleSince > 0 && now - this.idleSince < 600);
    if (busy !== this.busy) {
      this.busy = busy;
      this.ui?.root.classList.toggle("is-busy", busy);
    }
  }

  private drawRulers(): void {
    if (!this.ui) return;
    const styles = getComputedStyle(this.ui.root);
    const colors = {
      bg: styles.getPropertyValue("--ab-ruler-bg").trim() || "#f7f5f1",
      tick: styles.getPropertyValue("--ab-ruler-tick").trim() || "#b5ad9a",
      text: styles.getPropertyValue("--ab-ruler-text").trim() || "#55503f",
      band: styles.getPropertyValue("--ab-band").trim() || "rgba(0,0,0,.1)",
    };
    const size = this.ui.rulerX.getBoundingClientRect().height || 18;
    const bands = this.frames
      .filter((frame) => !frame.fadeAt)
      .map((frame) => {
        const r = frame.node.getBoundingClientRect();
        return { x: r.left, y: r.top, w: frame.w, h: frame.h };
      });

    drawRuler(this.ui.rulerX, "x", size, window.scrollX, colors, bands);
    drawRuler(this.ui.rulerY, "y", size, window.scrollY, colors, bands);
  }

  private updateBar(): void {
    if (!this.ui || this.doneCount === this.shownDone) return;
    this.shownDone = this.doneCount;
    this.ui.done.textContent = String(this.doneCount);
    const ratio = this.targets.length
      ? this.doneCount / this.targets.length
      : 1;
    this.ui.progress.style.transform = `scaleX(${ratio})`;
  }

  private setWaiting(waiting: boolean): void {
    if (waiting === this.waiting || !this.ui) return;
    this.waiting = waiting;
    this.ui.bar.classList.toggle("is-waiting", waiting);
    this.ui.status.textContent = waiting ? "Scroll to keep building" : "";
  }

  /* ---- end ------------------------------------------------------- */

  private complete(): void {
    if (this.ended || !this.ui) return;
    this.ui.status.textContent = `${this.targets.length} layers built`;
    this.ui.bar.classList.remove("is-waiting");
    this.ui.bar.classList.add("is-done");
    this.ui.skip.hidden = true;
    this.teardown(1400);
  }

  private teardown(delay: number): void {
    if (this.ended && !this.ui) return;
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.io?.disconnect();
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("focusin", this.onFocusIn);
    window.removeEventListener("scroll", this.onScroll);

    const ui = this.ui;
    this.ui = null;
    const finish = () => {
      document.documentElement.classList.remove("ab-active");
      if (ui) {
        ui.root.classList.add("is-leaving");
        window.setTimeout(() => ui.root.remove(), 320);
      }
      if (current === this) current = null;
      showRebuild();
    };
    if (delay > 0) window.setTimeout(finish, delay);
    else finish();
  }
}

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

function createUi(count: number, total: number, onSkip: () => void): Ui {
  const root = document.createElement("div");
  root.className = "ab-root";

  const stage = document.createElement("div");
  stage.className = "ab-stage";
  stage.setAttribute("aria-hidden", "true");

  const rulerX = document.createElement("canvas");
  rulerX.className = "ab-ruler ab-ruler-x";
  const rulerY = document.createElement("canvas");
  rulerY.className = "ab-ruler ab-ruler-y";
  const frames = document.createElement("div");
  frames.className = "ab-frames";
  stage.append(rulerX, rulerY, frames);

  const bar = document.createElement("div");
  bar.className = "ab-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Page build animation");

  const avatarWrap = document.createElement("span");
  avatarWrap.className = "ab-avatars";
  avatarWrap.setAttribute("aria-hidden", "true");
  const avatars: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("i");
    dot.style.setProperty("--ab-c", ROSTER[i].color);
    dot.textContent = ROSTER[i].name.charAt(0);
    avatarWrap.append(dot);
    avatars.push(dot);
  }

  const agentsLabel = document.createElement("span");
  agentsLabel.className = "ab-count";
  agentsLabel.innerHTML = `<b>${count}</b> agents`;

  const layers = document.createElement("span");
  layers.className = "ab-layers";
  const done = document.createElement("b");
  done.textContent = "0";
  layers.append(done, ` / ${total} layers`);

  const track = document.createElement("span");
  track.className = "ab-progress";
  track.setAttribute("aria-hidden", "true");
  const progress = document.createElement("i");
  track.append(progress);

  const status = document.createElement("span");
  status.className = "ab-status";

  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "ab-skip";
  skip.setAttribute("aria-label", "Skip the build animation");
  skip.innerHTML = 'Skip <span class="ab-kbd" aria-hidden="true">Esc</span>';
  skip.addEventListener("click", onSkip);

  bar.append(avatarWrap, agentsLabel, layers, track, status, skip);
  root.append(stage, bar);
  // First in <body> so keyboard users reach Skip before anything else.
  document.body.prepend(root);

  return {
    root,
    stage,
    frames,
    rulerX,
    rulerY,
    bar,
    done,
    progress,
    status,
    skip,
    avatars,
  };
}

function mountRebuildButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ab-rebuild";
  button.hidden = true;
  button.setAttribute("aria-label", "Rebuild this view with agents");
  button.innerHTML =
    '<svg aria-hidden="true" width="12" height="13" viewBox="0 0 18 20">' +
    '<path d="M2 1.5v15.2l4.1-3.9 2.6 5.7 2.7-1.2-2.6-5.6h5.8z"/></svg>' +
    "<span>Rebuild</span>";
  button.addEventListener("click", () => run("replay"));
  document.body.append(button);
  return button;
}

function showRebuild(): void {
  const button = rebuildButton;
  if (!button) return;
  button.hidden = false;
  requestAnimationFrame(() => button.classList.add("is-shown"));
}

function hideRebuild(): void {
  if (!rebuildButton) return;
  rebuildButton.classList.remove("is-shown");
  rebuildButton.hidden = true;
}

function atPageBottom(): boolean {
  const doc = document.documentElement;
  return window.scrollY + window.innerHeight >= doc.scrollHeight - 4;
}

function placeAgent(agent: Agent): void {
  agent.node.style.transform = `translate3d(${agent.x}px, ${agent.y}px, 0)`;
}

function revealDuration(target: Target): number {
  switch (target.kind) {
    case "type":
      return clamp(target.steps * 26, 180, 850);
    case "lines":
      return clamp(target.steps * 150, 260, 900);
    case "media":
      return 320;
    default:
      return 260;
  }
}

interface RulerColors {
  bg: string;
  tick: string;
  text: string;
  band: string;
}

interface Band {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawRuler(
  canvas: HTMLCanvasElement,
  axis: "x" | "y",
  size: number,
  scroll: number,
  colors: RulerColors,
  bands: Band[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  const length = axis === "x" ? w : h;
  const offset = axis === "x" ? 0 : rect.top;

  ctx.fillStyle = colors.band;
  for (const band of bands) {
    if (axis === "x") ctx.fillRect(band.x, 0, band.w, h);
    else ctx.fillRect(0, band.y - offset, w, band.h);
  }

  ctx.strokeStyle = colors.tick;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const first = Math.floor((scroll + offset) / 10) * 10;
  for (let page = first; page < scroll + offset + length; page += 10) {
    const pos = Math.round(page - scroll - offset) + 0.5;
    const tick =
      page % 100 === 0 ? size : page % 50 === 0 ? size * 0.5 : size * 0.28;
    if (axis === "x") {
      ctx.moveTo(pos, h);
      ctx.lineTo(pos, h - tick);
    } else {
      ctx.moveTo(w, pos);
      ctx.lineTo(w - tick, pos);
    }
  }
  if (axis === "x") {
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
  } else {
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
  }
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = "top";
  const firstLabel = Math.floor((scroll + offset) / 100) * 100;
  for (let page = firstLabel; page < scroll + offset + length; page += 100) {
    const pos = page - scroll - offset;
    if (axis === "x") {
      ctx.fillText(String(page), pos + 3, 2);
    } else {
      ctx.save();
      ctx.translate(2, pos + 3);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(String(page), 0, -9);
      ctx.restore();
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
