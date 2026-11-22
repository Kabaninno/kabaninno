'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/scene';
import type { SceneBus, SceneBusRef } from '../bus';
import { isSceneDebugEnabled, type SceneLabelProbe } from '../debug/scene-stats';
import { universeKeyForHighlight } from '../node-ids';
import {
  LABEL_FONT,
  LABEL_INSET,
  LABEL_METRICS,
  labelReticle,
  TOUCH_LABEL_SCALE,
  formatOrdinal,
  layoutLabel,
  type LabelBounds,
  type LabelLayout,
  type LabelObstacle,
} from './label-layout';
import type { CategoryNodeModel, UniverseModel } from './model';
import type { UniverseRuntime, UniverseRuntimeRef } from './runtime';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Hover reactions: 150–200 ms (art direction). */
const FADE_MS = 190;
/** Letter-spacing of the name: normal / compact fallback for tight framings (V2-03). */
const NAME_SPACING = { normal: '0.2em', compact: '0.12em' } as const;
/** Palette tokens (globals.css), with fallbacks for documents without them (QA-M2-07). */
const INK = 'var(--color-ink, #e8ecf5)';
const MUTED = 'var(--color-muted, #9aa4bf)';
const VOID_SHADOW = 'rgb(5 7 13)';
/** A selected category shows its label once its selected state is past this. */
const SELECTED_LABEL_THRESHOLD = 0.5;
/** Selection labels are laid out again when a node moved more than this (CSS px). */
const RELAYOUT_PX = 0.25;

interface NodeLabelsProps {
  model: UniverseModel;
  runtime: UniverseRuntimeRef;
  busRef: SceneBusRef;
  reducedMotion: boolean;
}

interface LabelDom {
  anchor: HTMLDivElement;
  reticle: SVGPathElement;
  leader: SVGPathElement;
  tick: SVGCircleElement;
  text: HTMLDivElement;
  index: HTMLSpanElement;
  name: HTMLSpanElement;
  sub: HTMLSpanElement;
}

interface LabelState {
  key: string | null;
  visible: boolean;
  width: number;
  compactWidth: number;
  height: number;
  layout: LabelLayout | null;
  accent: string;
  /** Text box of the current layout, CSS px (canvas space). */
  box: LabelBounds;
}

/** A configurator selection label: one per category, content set once. */
interface SelectionLabel {
  node: CategoryNodeModel;
  dom: LabelDom;
  state: LabelState;
  /** Wanted this frame (selected, on screen) and shown (it also fits the free area). */
  wanted: boolean;
  x: number;
  y: number;
  /** Placement the framing reserved (0 = none). */
  preferSide: number;
  preferRise: number;
  /** Its core as an obstacle for the other labels (pooled), while wanted. */
  disc: LabelObstacle | null;
}

/**
 * Canvas labels (art direction: thin spaced typography, a leader line from
 * the node, a reticle around it). One DOM overlay inside the aria-hidden
 * scene layer — the accessible equivalents are the HTML links, whose hover
 * and focus drive the same store highlight.
 *
 * - The hover label: text changes only when the highlighted node changes;
 *   per frame only transforms and, when the layout shifts, two SVG paths
 *   are written. Shown in the overview while the camera is settled
 *   (`bus.interactive`) and the node is not faded out under an overlay
 *   (presence), in a settled system view for the planet of a
 *   `service:<cat>/<slug>` highlight, and in the settled portfolio archive
 *   for the card of a `project:<slug>` highlight (with no projects the
 *   cluster's "coming soon" label stays up there).
 * - Selection labels (owner round 5, part B): on the configurator every
 *   selected category shows its name, so it is clear what the crystal is
 *   connected to. The camera framing reserves room for each one on a given
 *   side (`bus.selectionLabels`), which is tried first; labels never overlap
 *   each other, and one that cannot fit the free area (a phone band of a
 *   few dozen px) stays hidden. Their sizes are measured once (and again
 *   when the web fonts arrive) and published for the framing
 *   (`bus.labelSizes`). Laid out again only when something moved.
 *
 * Every text box stays inside the free area, clear of the other cores,
 * planets and cards (label-layout.ts).
 */
export function NodeLabels({ model, runtime, busRef, reducedMotion }: NodeLabelsProps) {
  const gl = useThree((state) => state.gl);
  const connected = useThree((state) => state.events.connected) as unknown;
  const domRef = useRef<LabelDom | null>(null);
  const labelRef = useRef<LabelState>(createLabelState());
  const selectionRef = useRef<SelectionLabel[]>([]);
  const highlightRef = useRef<string | null>(null);
  const obstaclesRef = useRef<LabelObstacle[]>([]);
  const obstaclePoolRef = useRef<LabelObstacle[]>([]);
  const boxesRef = useRef<LabelBounds[]>([]);
  const targetRef = useRef<LabelTarget>(createTarget());
  const boundsRef = useRef({
    raw: { left: 0, top: 0, right: 0, bottom: 0 },
    inset: { left: 0, top: 0, right: 0, bottom: 0 },
    changed: true,
  });

  useEffect(() => {
    highlightRef.current = useSceneStore.getState().highlighted;
    return useSceneStore.subscribe((state) => {
      highlightRef.current = state.highlighted;
    });
  }, []);

  useEffect(() => {
    const host =
      connected instanceof HTMLElement ? connected : (gl.domElement.parentElement ?? document.body);
    const touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const root = createLabelRoot(reducedMotion);
    const dom = createLabelDom(touch);
    root.appendChild(dom.anchor);
    const selection = model.categories.map((node): SelectionLabel => {
      const unit = createLabelDom(touch);
      unit.name.textContent = node.label;
      unit.index.textContent = formatOrdinal(node.ordinal, model.categories.length);
      unit.sub.style.display = 'none';
      unit.anchor.style.setProperty('--label-accent', node.color);
      root.appendChild(unit.anchor);
      return {
        node,
        dom: unit,
        state: createLabelState(),
        wanted: false,
        x: Number.NaN,
        y: Number.NaN,
        preferSide: 0,
        preferRise: 0,
        disc: null,
      };
    });
    host.appendChild(root);
    domRef.current = dom;
    selectionRef.current = selection;
    const label = labelRef.current;
    const bus = busRef.current;
    label.key = null;
    label.visible = false;
    label.layout = null;
    // Selection labels: measured here (content never changes), published for the framing.
    const measureSelection = () => {
      for (const unit of selection) {
        measure(unit.dom, unit.state);
        unit.state.layout = null;
        bus.labelSizes.set(unit.node.key, { width: unit.state.width, height: unit.state.height });
      }
      bus.labelSizesVersion++;
      boundsRef.current.changed = true;
    };
    measureSelection();
    // Re-measure once the web fonts have loaded: the fallback face is wider and
    // left the leader running past the text (visual L-02).
    const remeasure = () => {
      label.key = null;
      measureSelection();
    };
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.addEventListener('loadingdone', remeasure);
    void fonts?.ready.then(remeasure);
    const debug = isSceneDebugEnabled(window.location.search);
    if (debug) window.__sceneLabels = () => labelProbes(labelRef.current, dom, selection);
    return () => {
      fonts?.removeEventListener('loadingdone', remeasure);
      root.remove();
      domRef.current = null;
      selectionRef.current = [];
      bus.labelRect = null;
      bus.labelSizes.clear();
      bus.labelSizesVersion++;
      if (debug) delete window.__sceneLabels;
    };
  }, [gl, connected, reducedMotion, busRef, model]);

  useFrame((state) => {
    const dom = domRef.current;
    const rt = runtime.current;
    if (!dom || !rt) return;
    const bus = busRef.current;
    const bounds = boundsRef.current;
    updateFreeBounds(bounds, state.size.width, state.size.height, state.size.left, state.size.top);
    stepHoverLabel(model, rt, bus, dom, labelRef.current, highlightRef.current, targetRef.current, {
      obstacles: obstaclesRef.current,
      bounds: bounds.inset,
      dpr: state.viewport.dpr,
      height: state.size.height,
    });
    stepSelectionLabels(
      model,
      rt,
      bus,
      selectionRef.current,
      bounds,
      obstaclesRef.current,
      obstaclePoolRef.current,
      boxesRef.current,
    );
    bounds.changed = false;
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Hover label                                                         */
/* ------------------------------------------------------------------ */

function stepHoverLabel(
  model: UniverseModel,
  rt: UniverseRuntime,
  bus: SceneBus,
  dom: LabelDom,
  label: LabelState,
  highlight: string | null,
  target: LabelTarget,
  frame: { obstacles: LabelObstacle[]; bounds: LabelBounds; dpr: number; height: number },
) {
  const obstacles = frame.obstacles;
  obstacles.length = 0;
  const found = resolveTarget(model, rt, bus, highlight, target, obstacles);

  if (found && target.key !== label.key) {
    setContent(dom, target);
    label.key = target.key;
    measure(dom, label);
    label.layout = null;
    label.accent = '';
  }
  if (found !== label.visible) {
    label.visible = found;
    dom.anchor.dataset.visible = found ? 'true' : 'false';
  }
  if (!label.visible) {
    // Fading out: keep the last position.
    bus.labelRect = null;
    return;
  }

  const { x, y } = target;
  dom.anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  // The beacon's colour cycles: its leader follows it (visual N2-04).
  if (target.color !== label.accent) {
    label.accent = target.color;
    dom.anchor.style.setProperty('--label-accent', target.color);
  }
  const layout = layoutLabel({
    x,
    y,
    coreRadiusPx: target.radiusPx,
    textWidth: label.width,
    compactWidth: label.compactWidth,
    textHeight: label.height,
    bounds: frame.bounds,
    obstacles,
  });
  if (!label.layout || layoutChanged(label.layout, layout)) {
    label.layout = layout;
    drawLayout(dom, layout, label);
  }
  // Links crossing the text dim under it (visual L-03): GL px, bottom-left origin.
  const dpr = frame.dpr;
  const width = layout.compact ? label.compactWidth : label.width;
  const left = x + layout.textX;
  const top = y + layout.textY;
  setBox(label.box, left, top, left + width, top + label.height);
  bus.labelRect = [
    left * dpr,
    (frame.height - top - label.height) * dpr,
    (left + width) * dpr,
    (frame.height - top) * dpr,
  ];
}

/* ------------------------------------------------------------------ */
/* Selection labels (configurator)                                     */
/* ------------------------------------------------------------------ */

function stepSelectionLabels(
  model: UniverseModel,
  rt: UniverseRuntime,
  bus: SceneBus,
  units: readonly SelectionLabel[],
  bounds: { raw: LabelBounds; inset: LabelBounds; changed: boolean },
  obstacles: LabelObstacle[],
  pool: LabelObstacle[],
  boxes: LabelBounds[],
) {
  if (units.length === 0) return;
  let dirty = bounds.changed;
  let any = false;
  for (const unit of units) {
    const i = unit.node.index;
    const wanted =
      !bus.flying &&
      (rt.selected[i] ?? 0) > SELECTED_LABEL_THRESHOLD &&
      rt.inFront[i] === true &&
      (rt.presence[i] ?? 1) >= 0.5;
    if (wanted !== unit.wanted) {
      unit.wanted = wanted;
      dirty = true;
    }
    if (!wanted) continue;
    any = true;
    const x = rt.screenX[i] ?? 0;
    const y = rt.screenY[i] ?? 0;
    if (!(Math.abs(x - unit.x) <= RELAYOUT_PX && Math.abs(y - unit.y) <= RELAYOUT_PX)) {
      unit.x = x;
      unit.y = y;
      unit.dom.anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      dirty = true;
    }
    const prefer = bus.selectionLabels.get(unit.node.key);
    const side = prefer?.side ?? 0;
    const rise = prefer?.rise ?? 0;
    if (side !== unit.preferSide || rise !== unit.preferRise || !unit.state.layout) {
      unit.preferSide = side;
      unit.preferRise = rise;
      dirty = true;
    }
  }

  if (dirty && any) {
    // Obstacles: the crystal's core and every selected node's reticle, as the camera
    // framing assumed (pooled discs, no per-frame garbage).
    obstacles.length = 0;
    let used = 0;
    const disc = (index: number, reticle: boolean) => {
      const obstacle = (pool[used] ??= { x: 0, y: 0, r: 0 });
      used++;
      const core = (rt.corePx[index] ?? 0) / 2;
      obstacle.x = rt.screenX[index] ?? 0;
      obstacle.y = rt.screenY[index] ?? 0;
      obstacle.r = reticle
        ? Math.max(core, labelReticle(core) + 2 - LABEL_METRICS.obstaclePadding)
        : core;
      return obstacle;
    };
    const beacon = model.configurator.index;
    if (rt.inFront[beacon]) obstacles.push(disc(beacon, false));
    for (const unit of units) {
      unit.disc = unit.wanted ? disc(unit.node.index, true) : null;
      if (unit.disc) obstacles.push(unit.disc);
    }
    // The cores of the other visible nodes (unselected categories, portfolio).
    for (const node of model.nodes) {
      const j = node.index;
      if (j === beacon || !rt.inFront[j] || (rt.presence[j] ?? 1) < 0.3) continue;
      if (node.kind === 'category' && units[node.ordinal - 1]?.wanted) continue;
      obstacles.push(disc(j, false));
    }
    boxes.length = 0;
    for (const unit of units) {
      if (!unit.wanted) continue;
      // Its own core is no obstacle to its label (a negative radius never collides).
      const ownDisc = unit.disc;
      const ownRadius = ownDisc?.r ?? 0;
      if (ownDisc) ownDisc.r = -1e9;
      const label = unit.state;
      const layout = layoutLabel({
        x: unit.x,
        y: unit.y,
        coreRadiusPx: (rt.corePx[unit.node.index] ?? 16) / 2,
        textWidth: label.width,
        compactWidth: label.compactWidth,
        textHeight: label.height,
        bounds: bounds.inset,
        obstacles,
        boxes,
        prefer:
          unit.preferSide !== 0
            ? { side: unit.preferSide as 1 | -1, rise: unit.preferRise as 1 | -1 }
            : null,
      });
      if (ownDisc) ownDisc.r = ownRadius;
      if (!label.layout || layoutChanged(label.layout, layout)) {
        label.layout = layout;
        drawLayout(unit.dom, layout, label);
      }
      const width = layout.compact ? label.compactWidth : label.width;
      const left = unit.x + layout.textX;
      const top = unit.y + layout.textY;
      setBox(label.box, left, top, left + width, top + label.height);
      // A label the free area cannot hold (a band of a few dozen px) stays hidden.
      const raw = bounds.raw;
      const fits =
        left >= raw.left - 0.5 &&
        left + width <= raw.right + 0.5 &&
        top >= raw.top - 0.5 &&
        top + label.height <= raw.bottom + 0.5;
      setVisible(unit, fits);
      if (fits) boxes.push(label.box);
    }
  }
  for (const unit of units) {
    if (!unit.wanted) setVisible(unit, false);
  }
}

function setVisible(unit: SelectionLabel, visible: boolean) {
  if (unit.state.visible === visible) return;
  unit.state.visible = visible;
  unit.dom.anchor.dataset.visible = visible ? 'true' : 'false';
}

/* ------------------------------------------------------------------ */
/* Hover label targets                                                 */
/* ------------------------------------------------------------------ */

/** What a label points at: a universe node (overview) or a planet (settled system view). */
interface LabelTarget {
  key: string;
  x: number;
  y: number;
  radiusPx: number;
  color: string;
  label: string;
  index: string | null;
  sub: string | null;
}

function createTarget(): LabelTarget {
  return { key: '', x: 0, y: 0, radiusPx: 0, color: '#e8ecf5', label: '', index: null, sub: null };
}

function createLabelState(): LabelState {
  return {
    key: null,
    visible: false,
    width: 0,
    compactWidth: 0,
    height: 0,
    layout: null,
    accent: '',
    box: { left: 0, top: 0, right: 0, bottom: 0 },
  };
}

/**
 * Fills `target` and `obstacles` for the current highlight; false when no
 * label should show. Overview: the highlighted universe node (also from a
 * service id). Settled system view: the planet of a `service:<cat>/<slug>`
 * highlight of that system, clear of the core and the other planets.
 */
function resolveTarget(
  model: UniverseModel,
  rt: UniverseRuntime,
  bus: SceneBus,
  highlight: string | null,
  target: LabelTarget,
  obstacles: LabelObstacle[],
): boolean {
  if (bus.archiveInteractive)
    return resolveArchiveTarget(model, rt, bus, highlight, target, obstacles);
  if (!highlight) return false;
  if (bus.interactive) {
    const key = universeKeyForHighlight(highlight);
    const node = key ? model.byKey.get(key) : undefined;
    if (!node) return false;
    const i = node.index;
    if ((rt.presence[i] ?? 1) < 0.5 || !rt.inFront[i]) return false;
    target.key = node.key;
    target.x = rt.screenX[i] ?? 0;
    target.y = rt.screenY[i] ?? 0;
    target.radiusPx = (rt.corePx[i] ?? 16) / 2;
    target.color = rt.liveAccent[i] ?? node.color;
    target.label = node.label;
    target.index =
      node.kind === 'category' ? formatOrdinal(node.ordinal, model.categories.length) : null;
    target.sub = node.kind === 'portfolio' && node.comingSoon ? node.comingSoonLabel : null;
    for (const other of model.nodes) {
      const j = other.index;
      if (j === i || !rt.inFront[j] || (rt.presence[j] ?? 1) < 0.3) continue;
      obstacles.push({ x: rt.screenX[j] ?? 0, y: rt.screenY[j] ?? 0, r: (rt.corePx[j] ?? 0) / 2 });
    }
    return true;
  }
  const category = bus.systemInteractive;
  const prefix = category ? `service:${category}/` : null;
  if (!prefix || !highlight.startsWith(prefix)) return false;
  const key = `${category}/${highlight.slice(prefix.length)}`;
  const planet = bus.planetTargets.get(key);
  if (!planet || !planet.visible || !planet.inFront) return false;
  target.key = highlight;
  target.x = planet.x;
  target.y = planet.y;
  target.radiusPx = Math.max(planet.radiusPx, 6);
  target.color = planet.color;
  target.label = planet.label;
  target.index = formatOrdinal(planet.ordinal, planet.total);
  target.sub = null;
  for (const [otherKey, other] of bus.planetTargets) {
    if (otherKey === key || !otherKey.startsWith(`${category}/`) || !other.visible) continue;
    if (other.inFront) obstacles.push({ x: other.x, y: other.y, r: other.radiusPx });
  }
  const node = model.categories.find((candidate) => candidate.categoryId === category);
  if (node && rt.inFront[node.index]) {
    const i = node.index;
    obstacles.push({ x: rt.screenX[i] ?? 0, y: rt.screenY[i] ?? 0, r: (rt.corePx[i] ?? 0) / 2 });
  }
  return true;
}

/**
 * Settled portfolio archive: the card of a `project:<slug>` highlight, clear
 * of the other cards; with no projects, a steady "coming soon" label on the
 * dormant cluster.
 */
function resolveArchiveTarget(
  model: UniverseModel,
  rt: UniverseRuntime,
  bus: SceneBus,
  highlight: string | null,
  target: LabelTarget,
  obstacles: LabelObstacle[],
): boolean {
  const portfolio = model.portfolio;
  if (portfolio.comingSoon) {
    const i = portfolio.index;
    if (!rt.inFront[i]) return false;
    target.key = portfolio.key;
    target.x = rt.screenX[i] ?? 0;
    target.y = rt.screenY[i] ?? 0;
    target.radiusPx = Math.max((rt.corePx[i] ?? 16) / 2, 18);
    target.color = portfolio.color;
    target.label = portfolio.label;
    target.index = null;
    target.sub = portfolio.comingSoonLabel;
    return true;
  }
  const prefix = 'project:';
  if (!highlight?.startsWith(prefix)) return false;
  const slug = highlight.slice(prefix.length);
  const card = bus.projectTargets.get(slug);
  if (!card || !card.visible || !card.inFront) return false;
  target.key = highlight;
  target.x = card.x;
  target.y = card.y;
  target.radiusPx = Math.max(card.radiusPx, 8);
  target.color = card.color;
  target.label = card.label;
  target.index = formatOrdinal(card.ordinal, card.total);
  target.sub = card.sub ?? null;
  for (const [otherSlug, other] of bus.projectTargets) {
    if (otherSlug === slug || !other.visible || !other.inFront) continue;
    // About the card's half width: the text may use the gaps between cards.
    obstacles.push({ x: other.x, y: other.y, r: other.radiusPx * 1.2 });
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let finePointerQuery: MediaQueryList | null = null;

/**
 * The free area for label text in canvas px (`raw`) and inset by the
 * platform margin (`inset`), written in place; `changed` when it moved.
 */
function updateFreeBounds(
  out: { raw: LabelBounds; inset: LabelBounds; changed: boolean },
  width: number,
  height: number,
  left: number,
  top: number,
) {
  const rect = useSceneStore.getState().safeRect;
  const l = rect ? rect.x - left : 0;
  const t = rect ? rect.y - top : 0;
  const r = rect ? rect.x - left + rect.width : width;
  const b = rect ? rect.y - top + rect.height : height;
  const raw = out.raw;
  if (raw.left !== l || raw.top !== t || raw.right !== r || raw.bottom !== b) {
    setBox(raw, l, t, r, b);
    out.changed = true;
  }
  finePointerQuery ??= window.matchMedia('(hover: hover) and (pointer: fine)');
  const inset = finePointerQuery.matches ? LABEL_INSET.desktop : LABEL_INSET.touch;
  setBox(out.inset, l + inset, t + inset, r - inset, b - inset);
}

function setBox(box: LabelBounds, left: number, top: number, right: number, bottom: number) {
  box.left = left;
  box.top = top;
  box.right = right;
  box.bottom = bottom;
}

function layoutChanged(a: LabelLayout, b: LabelLayout): boolean {
  return (
    a.side !== b.side ||
    a.rise !== b.rise ||
    a.compact !== b.compact ||
    Math.abs(a.leaderY - b.leaderY) > 0.5 ||
    Math.abs(a.reticle - b.reticle) > 0.5 ||
    Math.abs(a.textX - b.textX) > 0.5 ||
    Math.abs(a.textY - b.textY) > 0.5
  );
}

function setContent(dom: LabelDom, target: LabelTarget) {
  // Planet and card labels sit among orbit lines and glass: a subtle plate (visual mn1).
  const plate = target.key.startsWith('service:') || target.key.startsWith('project:');
  dom.anchor.dataset.plate = plate ? 'true' : 'false';
  dom.name.textContent = target.label;
  dom.index.textContent = target.index ?? '';
  dom.index.style.display = target.index ? '' : 'none';
  dom.sub.textContent = target.sub ?? '';
  dom.sub.style.display = target.sub ? '' : 'none';
}

/** Text block size at normal and compact spacing (only when the content changes). */
function measure(dom: LabelDom, label: LabelState) {
  dom.text.style.width = 'auto';
  dom.name.style.letterSpacing = NAME_SPACING.compact;
  label.compactWidth = dom.text.offsetWidth;
  dom.name.style.letterSpacing = NAME_SPACING.normal;
  label.width = dom.text.offsetWidth;
  label.height = dom.text.offsetHeight;
}

function drawLayout(dom: LabelDom, layout: LabelLayout, label: LabelState) {
  const { side, rise, reticle: r, diagonal, textX, textY, compact } = layout;
  const arm = Math.max(4, r * 0.42);
  // Four thin corner brackets around the node.
  dom.reticle.setAttribute(
    'd',
    [
      `M${-r} ${-r + arm}V${-r}H${-r + arm}`,
      `M${r - arm} ${-r}H${r}V${-r + arm}`,
      `M${r} ${r - arm}V${r}H${r - arm}`,
      `M${-r + arm} ${r}H${-r}V${r - arm}`,
    ].join(''),
  );
  // Leader: diagonal off the bracket corner, then a horizontal run along the text.
  const width = compact ? label.compactWidth : label.width;
  const x0 = side * r;
  const y0 = -rise * r;
  const x1 = side * (r + diagonal);
  const y1 = layout.leaderY;
  const x2 = side > 0 ? Math.max(x1, textX + width) : Math.min(x1, textX);
  dom.leader.setAttribute('d', `M${x0} ${y0}L${x1} ${y1}H${x2}`);
  dom.tick.setAttribute('cx', String(x2));
  dom.tick.setAttribute('cy', String(y1));
  dom.name.style.letterSpacing = compact ? NAME_SPACING.compact : NAME_SPACING.normal;
  dom.text.style.left = `${textX}px`;
  dom.text.style.top = `${textY}px`;
  dom.text.style.textAlign = side > 0 ? 'left' : 'right';
  dom.text.style.width = `${width}px`;
}

/** Debug-only: the visible labels' text boxes (CSS px, canvas space). */
function labelProbes(
  hover: LabelState,
  hoverDom: LabelDom,
  selection: readonly SelectionLabel[],
): SceneLabelProbe[] {
  const probes: SceneLabelProbe[] = [];
  if (hover.visible && hover.key) {
    probes.push({ key: hover.key, text: hoverDom.name.textContent ?? '', ...hover.box });
  }
  for (const unit of selection) {
    if (!unit.state.visible) continue;
    probes.push({ key: unit.node.key, text: unit.node.label, ...unit.state.box });
  }
  return probes;
}

function createLabelRoot(reducedMotion: boolean): HTMLDivElement {
  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.dataset.sceneLabels = '';
  const fade = `${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '1',
    contain: 'strict',
  });
  const style = document.createElement('style');
  style.textContent = `
[data-scene-labels] .sl-anchor { opacity: 0; transition: opacity ${fade}; }
[data-scene-labels] .sl-anchor[data-visible='true'] { opacity: 1; }
[data-scene-labels] .sl-text { transition: opacity ${fade}, filter ${fade}, translate ${fade};
  opacity: 0; ${reducedMotion ? '' : 'filter: blur(2px); translate: 0 6px;'} }
[data-scene-labels] .sl-anchor[data-visible='true'] .sl-text { opacity: 1; filter: none; translate: 0 0; }
[data-scene-labels] .sl-anchor[data-plate='true'] .sl-text { background: rgb(5 7 13 / 0.64);
  padding: 5px 9px 6px; border-radius: 6px; box-shadow: 0 0 0 1px rgb(232 236 245 / 0.07); }
`;
  root.appendChild(style);
  return root;
}

function createLabelDom(touch: boolean): LabelDom {
  const scale = touch ? TOUCH_LABEL_SCALE : 1;
  const anchor = document.createElement('div');
  anchor.className = 'sl-anchor';
  anchor.dataset.visible = 'false';
  Object.assign(anchor.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    willChange: 'transform',
  });

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '1');
  svg.setAttribute('height', '1');
  svg.setAttribute('overflow', 'visible');
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' });
  const stroke = (path: SVGPathElement, color: string, opacity: string) => {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1');
    path.setAttribute('stroke-opacity', opacity);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
  };
  // Reticle in ink (reads on any glow), leader in the node's accent.
  const reticle = document.createElementNS(SVG_NS, 'path');
  stroke(reticle, INK, '0.72');
  const leader = document.createElementNS(SVG_NS, 'path');
  stroke(leader, 'var(--label-accent, #e8ecf5)', '0.75');
  const tick = document.createElementNS(SVG_NS, 'circle');
  tick.setAttribute('r', '1.6');
  tick.setAttribute('fill', 'var(--label-accent, #e8ecf5)');
  svg.append(reticle, leader, tick);

  const text = document.createElement('div');
  text.className = 'sl-text';
  // A soft void halo keeps glyphs readable over glow edges and links (A-03, V2-04).
  Object.assign(text.style, {
    position: 'absolute',
    whiteSpace: 'nowrap',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: INK,
    textShadow: `0 0 14px ${VOID_SHADOW}, 0 0 6px ${VOID_SHADOW}, 0 0 2px ${VOID_SHADOW}`,
  });
  const index = document.createElement('span');
  Object.assign(index.style, {
    font: `500 ${LABEL_FONT.index * scale}px/1 var(--font-jetbrains), ui-monospace, Menlo, Consolas, monospace`,
    letterSpacing: '0.18em',
    color: MUTED,
  });
  const name = document.createElement('span');
  Object.assign(name.style, {
    font: `500 ${LABEL_FONT.name * scale}px/1.15 var(--font-manrope), system-ui, "Segoe UI", sans-serif`,
    letterSpacing: NAME_SPACING.normal,
    textTransform: 'uppercase',
  });
  const sub = document.createElement('span');
  Object.assign(sub.style, {
    font: `400 ${LABEL_FONT.sub * scale}px/1.2 var(--font-manrope), system-ui, "Segoe UI", sans-serif`,
    letterSpacing: '0.06em',
    color: MUTED,
  });
  text.append(index, name, sub);
  anchor.append(svg, text);
  return { anchor, reticle, leader, tick, text, index, name, sub };
}
