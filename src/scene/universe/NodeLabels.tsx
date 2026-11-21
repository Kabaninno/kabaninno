'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/scene';
import type { SceneBusRef } from '../bus';
import { universeKeyForHighlight } from '../node-ids';
import {
  LABEL_INSET,
  formatOrdinal,
  insetBounds,
  layoutLabel,
  type LabelBounds,
  type LabelLayout,
  type LabelObstacle,
} from './label-layout';
import type { UniverseModel, UniverseNode } from './model';
import type { UniverseRuntimeRef } from './runtime';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Hover reactions: 150–200 ms (art direction). */
const FADE_MS = 190;
/** Letter-spacing of the name: normal / compact fallback for tight framings (V2-03). */
const NAME_SPACING = { normal: '0.2em', compact: '0.12em' } as const;
/** Palette tokens (globals.css), with fallbacks for documents without them (QA-M2-07). */
const INK = 'var(--color-ink, #e8ecf5)';
const MUTED = 'var(--color-muted, #9aa4bf)';
const VOID_SHADOW = 'rgb(5 7 13)';

interface NodeLabelsProps {
  model: UniverseModel;
  runtime: UniverseRuntimeRef;
  busRef: SceneBusRef;
  reducedMotion: boolean;
}

interface LabelDom {
  root: HTMLDivElement;
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
  hiddenAt: number;
  width: number;
  compactWidth: number;
  height: number;
  layout: LabelLayout | null;
  accent: string;
}

/**
 * Canvas labels (art direction: thin spaced typography, a leader line from
 * the node, a reticle around it). One DOM overlay inside the aria-hidden
 * scene layer — the accessible equivalents are the HTML links, whose hover
 * and focus drive the same store highlight. Text changes only when the
 * highlighted node changes; per frame only transforms and, when the layout
 * shifts, two SVG paths are written. Shown in the overview while the camera
 * is settled (`bus.interactive`) and the node is not faded out under an
 * overlay (presence). The text box stays inside the free area, clear of the
 * other cores (label-layout.ts).
 */
export function NodeLabels({ model, runtime, busRef, reducedMotion }: NodeLabelsProps) {
  const gl = useThree((state) => state.gl);
  const connected = useThree((state) => state.events.connected) as unknown;
  const domRef = useRef<LabelDom | null>(null);
  const labelRef = useRef<LabelState>({
    key: null,
    visible: false,
    hiddenAt: 0,
    width: 0,
    compactWidth: 0,
    height: 0,
    layout: null,
    accent: '',
  });
  const highlightRef = useRef<string | null>(null);
  const obstaclesRef = useRef<LabelObstacle[]>([]);

  useEffect(() => {
    highlightRef.current = universeKeyForHighlight(useSceneStore.getState().highlighted);
    return useSceneStore.subscribe((state) => {
      highlightRef.current = universeKeyForHighlight(state.highlighted);
    });
  }, []);

  useEffect(() => {
    const host =
      connected instanceof HTMLElement ? connected : (gl.domElement.parentElement ?? document.body);
    const dom = createLabelDom(reducedMotion);
    host.appendChild(dom.root);
    domRef.current = dom;
    const label = labelRef.current;
    label.key = null;
    label.visible = false;
    label.layout = null;
    return () => {
      dom.root.remove();
      domRef.current = null;
    };
  }, [gl, connected, reducedMotion]);

  useFrame((state) => {
    const dom = domRef.current;
    const rt = runtime.current;
    if (!dom || !rt) return;
    const label = labelRef.current;
    const wanted = busRef.current.interactive ? highlightRef.current : null;
    let node = wanted ? model.byKey.get(wanted) : undefined;
    if (node && ((rt.presence[node.index] ?? 1) < 0.5 || !rt.inFront[node.index])) {
      node = undefined;
    }
    const now = performance.now();

    if (node && node.key !== label.key) {
      setContent(dom, node, model.categories.length);
      label.key = node.key;
      measure(dom, label);
      label.layout = null;
      label.accent = '';
    }
    const show = node !== undefined;
    if (show !== label.visible) {
      label.visible = show;
      if (!show) label.hiddenAt = now;
      dom.root.dataset.visible = show ? 'true' : 'false';
    }
    if (!label.visible && now - label.hiddenAt > FADE_MS + 50) return;

    const current = label.key ? model.byKey.get(label.key) : undefined;
    if (!current) return;
    const i = current.index;
    const x = rt.screenX[i] ?? 0;
    const y = rt.screenY[i] ?? 0;
    dom.anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    // The beacon's colour cycles: its leader follows it (visual N2-04).
    const accent = rt.liveAccent[i] ?? current.color;
    if (accent !== label.accent) {
      label.accent = accent;
      dom.root.style.setProperty('--label-accent', accent);
    }

    const obstacles = obstaclesRef.current;
    obstacles.length = 0;
    for (const other of model.nodes) {
      const j = other.index;
      if (j === i || !rt.inFront[j] || (rt.presence[j] ?? 1) < 0.3) continue;
      obstacles.push({ x: rt.screenX[j] ?? 0, y: rt.screenY[j] ?? 0, r: (rt.corePx[j] ?? 0) / 2 });
    }
    const layout = layoutLabel({
      x,
      y,
      coreRadiusPx: (rt.corePx[i] ?? 16) / 2,
      textWidth: label.width,
      compactWidth: label.compactWidth,
      textHeight: label.height,
      bounds: freeBounds(state.size.width, state.size.height, state.size.left, state.size.top),
      obstacles,
    });
    if (!label.layout || layoutChanged(label.layout, layout)) {
      label.layout = layout;
      drawLayout(dom, layout, label);
    }
  });

  return null;
}

let finePointerQuery: MediaQueryList | null = null;

/** The free area for label text, in canvas px, inset by the platform margin. */
function freeBounds(width: number, height: number, left: number, top: number): LabelBounds {
  const rect = useSceneStore.getState().safeRect;
  const bounds = rect
    ? {
        left: rect.x - left,
        top: rect.y - top,
        right: rect.x - left + rect.width,
        bottom: rect.y - top + rect.height,
      }
    : { left: 0, top: 0, right: width, bottom: height };
  finePointerQuery ??= window.matchMedia('(hover: hover) and (pointer: fine)');
  return insetBounds(bounds, finePointerQuery.matches ? LABEL_INSET.desktop : LABEL_INSET.touch);
}

function layoutChanged(a: LabelLayout, b: LabelLayout): boolean {
  return (
    a.side !== b.side ||
    a.rise !== b.rise ||
    a.compact !== b.compact ||
    Math.abs(a.reticle - b.reticle) > 0.5 ||
    Math.abs(a.textX - b.textX) > 0.5 ||
    Math.abs(a.textY - b.textY) > 0.5
  );
}

function setContent(dom: LabelDom, node: UniverseNode, categoryCount: number) {
  dom.name.textContent = node.label;
  if (node.kind === 'category') {
    dom.index.textContent = formatOrdinal(node.ordinal, categoryCount);
    dom.index.style.display = '';
  } else {
    dom.index.textContent = '';
    dom.index.style.display = 'none';
  }
  const sub = node.kind === 'portfolio' && node.comingSoon ? node.comingSoonLabel : '';
  dom.sub.textContent = sub;
  dom.sub.style.display = sub ? '' : 'none';
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
  const y1 = -rise * (r + diagonal);
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

function createLabelDom(reducedMotion: boolean): LabelDom {
  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.dataset.sceneLabels = '';
  root.dataset.visible = 'false';
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
[data-scene-labels][data-visible='true'] .sl-anchor { opacity: 1; }
[data-scene-labels] .sl-text { transition: opacity ${fade}, filter ${fade}, translate ${fade};
  opacity: 0; ${reducedMotion ? '' : 'filter: blur(2px); translate: 0 6px;'} }
[data-scene-labels][data-visible='true'] .sl-text { opacity: 1; filter: none; translate: 0 0; }
`;
  root.appendChild(style);

  const anchor = document.createElement('div');
  anchor.className = 'sl-anchor';
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
    font: '500 10px/1 var(--font-jetbrains), ui-monospace, Menlo, Consolas, monospace',
    letterSpacing: '0.18em',
    color: MUTED,
  });
  const name = document.createElement('span');
  Object.assign(name.style, {
    font: '500 12.5px/1.15 var(--font-manrope), system-ui, "Segoe UI", sans-serif',
    letterSpacing: NAME_SPACING.normal,
    textTransform: 'uppercase',
  });
  const sub = document.createElement('span');
  Object.assign(sub.style, {
    font: '400 11px/1.2 var(--font-manrope), system-ui, "Segoe UI", sans-serif',
    letterSpacing: '0.06em',
    color: MUTED,
  });
  text.append(index, name, sub);
  anchor.append(svg, text);
  root.appendChild(anchor);
  return { root, anchor, reticle, leader, tick, text, index, name, sub };
}
