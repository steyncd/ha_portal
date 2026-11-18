// The house model's three.js scene.
//
// Plain TypeScript on purpose: no runes in here (check-integrity rule 1), and no
// Svelte either. Model.svelte turns live state into a `Frame` of resolved
// colours and strings, and this file only draws frames. That split keeps the
// reactive store away from the render loop, and it means the day this needs a
// different renderer, one file changes.
//
// THREE RULES THIS FILE KEEPS
//
// 1 · Draw on demand. There is no animation loop. A frame is rendered when a
//     Frame arrives, when the camera moves, or when the canvas resizes — and at
//     no other time. Home Assistant's own power-flow card is the cautionary
//     tale: dots that never stop moving cost sustained CPU for nothing.
// 2 · WebGL2, not WebGPU. WebGPU inside an installed iOS web app is unconfirmed
//     and there are memory-kill reports on iOS 26. Nothing here needs it.
// 3 · Colour never arrives alone. Every tint the model shows has a text label
//     beside it (the DOM labels below) and a shape where one helps — a ring for
//     occupied, a taller post for an open zone, a stub for a bypassed one.
//
// Coordinates: metres, the plan's own axes (+x plan-right, +z plan-down), y up.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoomRect, SiteKind } from "../spatial";

export type Palette = {
  ground: string;
  floor: string;
  tx: string;
  mut: string;
  acc: string;
  ok: string;
  warn: string;
  water: string;
  glow: string;
};

export type RoomFrame = {
  id: string;
  /** Colour to wash the floor with, and how strongly (0–1). null = plain floor. */
  tint: string | null;
  strength: number;
  /** Share of this room's lights that are on, 0–1. */
  glow: number;
  occupied: boolean;
  /** Second line of the room's label — the value the tint stands for. */
  sub: string;
  alert: boolean;
};

export type MarkerFrame = {
  key: string;
  x: number;
  z: number;
  state: "clear" | "open" | "bypassed";
  /** Label text; empty hides the label (a clear zone does not need one). */
  text: string;
};

export type SiteFrame = { id: string; sub: string; level: number | null; alert: boolean };

export type Frame = {
  palette: Palette;
  /** Unit vector pointing at the sun. y ≤ 0 means it is down. */
  sun: { x: number; y: number; z: number };
  selected: string | null;
  rooms: RoomFrame[];
  markers: MarkerFrame[];
  site: SiteFrame[];
};

/** `turn` is a rotation about the vertical axis, in radians: which way a
 *  feature built against a boundary (the gate, the carport) faces. */
export type SiteItem = { id: string; kind: SiteKind; label: string; x: number; z: number; turn: number };

export type ModelInput = {
  rooms: RoomRect[];
  site: SiteItem[];
  /** The yard's outline, in order. Fewer than three points draws a plain
   *  rectangle round everything instead. */
  yard: { x: number; z: number }[];
  /** Where to write "Street", if the frontage is known. */
  street?: { x: number; z: number };
  /** Room ids the garage sits under — drawn as a dashed outline on those floors. */
  garage: string[];
};

/** What the view is fitted to: the rooms, or everything that is drawn. */
export type Framing = "house" | "yard";

export type HouseModel = {
  set(f: Frame): void;
  /** Fit the house, or the whole yard, into the stage from the current angle. */
  frame(mode: Framing): void;
  /** Move the camera in (factor < 1) or out (factor > 1). */
  zoom(factor: number): void;
  dispose(): void;
};

const FLOOR_T = 0.12;
const WALL_H = 0.75; // walls are cut low so every room can be seen into
const WALL_T = 0.07;
const MARK_H = 0.5;
const TANK_R = 1.1;
const TANK_H = 2.2;
/** How tall the tallest yard feature stands, in metres — for fitting the view. */
const SITE_TOP = 2.6;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createHouseModel(
  canvas: HTMLCanvasElement,
  labelLayer: HTMLElement,
  input: ModelInput,
  onpick: (roomId: string) => void,
  /** Told which framing the view holds, or null once the camera is moved by hand. */
  onframing?: (mode: Framing | null) => void,
): HouseModel {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.5, 400);
  const viewDir = new Vector3(-0.38, 0.66, 0.65).normalize(); // from the south-west, the entrance side

  const hemi = new HemisphereLight(0xffffff, 0x2a2d33, 2);
  const sun = new DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };
  const tmp = new Color();

  // ── Ground ────────────────────────────────────────────────────────────────
  // The ground IS the yard: its real outline, with a low wall round it. A plain
  // rectangle drawn round the house looked tidy and was wrong — it put the gate
  // halfway along a side when it stands at a corner. Without an outline, fall
  // back to that rectangle rather than draw nothing.
  const unitBox = own(new BoxGeometry(1, 1, 1));
  let outline = input.yard;
  if (outline.length < 3) {
    const xs = [...input.rooms.flatMap((r) => [r.x, r.x + r.w]), ...input.site.map((s) => s.x)];
    const zs = [...input.rooms.flatMap((r) => [r.z, r.z + r.d]), ...input.site.map((s) => s.z)];
    const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, z0 = Math.min(...zs) - 5, z1 = Math.max(...zs) + 5;
    outline = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  }
  const groundMat = own(new MeshLambertMaterial());
  // A Shape is drawn in x/y and then laid flat, which sends y to −z.
  const ground = new Mesh(own(new ShapeGeometry(new Shape(outline.map((p) => new Vector2(p.x, -p.z))))), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const kerbMat = own(new MeshLambertMaterial());
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const wall = new Mesh(unitBox, kerbMat);
    wall.scale.set(0.2, 0.5, Math.hypot(b.x - a.x, b.z - a.z));
    wall.position.set((a.x + b.x) / 2, 0.25, (a.z + b.z) / 2);
    wall.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    wall.castShadow = true;
    scene.add(wall);
  });

  // ── Labels (DOM, so they use the app's own type and tokens) ───────────────
  type Label = { el: HTMLElement; x: number; y: number; z: number; show: boolean };
  const labels: Label[] = [];
  function label(kind: string, x: number, y: number, z: number): Label {
    const el = document.createElement("div");
    el.className = "hm-l";
    el.dataset.kind = kind;
    labelLayer.appendChild(el);
    const l = { el, x, y, z, show: true };
    labels.push(l);
    return l;
  }
  function twoLine(l: Label, name: string): HTMLElement {
    const b = document.createElement("b");
    b.textContent = name;
    const i = document.createElement("i");
    l.el.append(b, i);
    return i;
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const g2 = glowCanvas.getContext("2d");
  if (g2) {
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.42)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 128, 128);
  }
  const glowTex = own(new CanvasTexture(glowCanvas));
  glowTex.colorSpace = SRGBColorSpace;

  const ringGeo = own(new RingGeometry(0.3, 0.44, 40));
  const ringMat = own(new MeshBasicMaterial({ side: DoubleSide }));

  type RoomObj = {
    rect: RoomRect;
    mat: MeshLambertMaterial;
    glow: Mesh;
    glowMat: MeshBasicMaterial;
    ring: Mesh;
    sub: HTMLElement;
    lab: Label;
  };
  const rooms = new Map<string, RoomObj>();
  const floors: Mesh[] = [];
  const wallParts: BufferGeometry[] = [];

  for (const r of input.rooms) {
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    const mat = own(new MeshLambertMaterial());
    const floor = new Mesh(own(new BoxGeometry(r.w, FLOOR_T, r.d)), mat);
    floor.position.set(cx, FLOOR_T / 2, cz);
    floor.receiveShadow = true;
    floor.userData.room = r.id;
    scene.add(floor);
    floors.push(floor);

    const glowMat = own(new MeshBasicMaterial({ map: glowTex, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }));
    const glow = new Mesh(own(new PlaneGeometry(r.w * 1.15, r.d * 1.15)), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(cx, FLOOR_T + 0.012, cz);
    glow.visible = false;
    scene.add(glow);

    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, FLOOR_T + 0.02, cz + Math.min(0.9, r.d * 0.22));
    ring.visible = false;
    scene.add(ring);

    if (!r.open) {
      // Walls sit INSIDE the room's rectangle, so two neighbours' walls stand
      // side by side instead of sharing one plane and flickering against it.
      const y = FLOOR_T + WALL_H / 2;
      const ew = new BoxGeometry(r.w, WALL_H, WALL_T);
      const ns = new BoxGeometry(WALL_T, WALL_H, r.d);
      wallParts.push(
        ew.clone().translate(cx, y, r.z + WALL_T / 2),
        ew.translate(cx, y, r.z + r.d - WALL_T / 2),
        ns.clone().translate(r.x + WALL_T / 2, y, cz),
        ns.translate(r.x + r.w - WALL_T / 2, y, cz),
      );
    }

    const lab = label("room", cx, FLOOR_T + 0.05, cz - r.d * 0.12);
    const sub = twoLine(lab, r.label);
    rooms.set(r.id, { rect: r, mat, glow, glowMat, ring, sub, lab });
  }

  const wallMat = own(new MeshLambertMaterial());
  if (wallParts.length) {
    const merged = own(mergeGeometries(wallParts));
    wallParts.forEach((g) => g.dispose());
    const walls = new Mesh(merged, wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    scene.add(walls);
  }

  // ── Garage outline ────────────────────────────────────────────────────────
  // The garage is under these rooms, on a level this model does not draw. A
  // dashed outline on the floor says "something is beneath here" without
  // pretending to show it.
  const under = input.garage.map((id) => rooms.get(id)?.rect).filter((r): r is RoomRect => !!r);
  const garageMat = own(new LineDashedMaterial({ dashSize: 0.35, gapSize: 0.25 }));
  if (under.length) {
    const inset = 0.32;
    const x0 = Math.min(...under.map((r) => r.x)) + inset, x1 = Math.max(...under.map((r) => r.x + r.w)) - inset;
    const z0 = Math.min(...under.map((r) => r.z)) + inset, z1 = Math.max(...under.map((r) => r.z + r.d)) - inset;
    const y = FLOOR_T + 0.016;
    const geo = own(new BufferGeometry());
    geo.setAttribute("position", new Float32BufferAttribute([
      x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0,
    ], 3));
    const line = new LineSegments(geo, garageMat);
    line.computeLineDistances();
    scene.add(line);
    label("note", (x0 + x1) / 2, y, z1 - 0.45).el.textContent = "Garage below";
  }

  // ── Yard ──────────────────────────────────────────────────────────────────
  const waterMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.5 }));
  const padMat = own(new MeshLambertMaterial());
  const postMat = own(new MeshLambertMaterial());
  const gateMat = own(new MeshLambertMaterial());
  const tankShellMat = own(new MeshLambertMaterial());
  const tankWaterMat = own(new MeshLambertMaterial());
  type SiteObj = { item: SiteItem; sub: HTMLElement; water?: Mesh; shell?: Mesh };
  const site = new Map<string, SiteObj>();

  for (const s of input.site) {
    const grp = new Group();
    grp.position.set(s.x, 0, s.z);
    grp.rotation.y = s.turn;
    scene.add(grp);
    let top = 0.4;
    const obj: SiteObj = { item: s, sub: document.createElement("i") };
    if (s.kind === "pool") {
      const disc = new Mesh(own(new CircleGeometry(2.6, 48)), waterMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      grp.add(disc);
    } else if (s.kind === "carport") {
      const slab = new Mesh(unitBox, padMat);
      slab.scale.set(6, 0.05, 6);
      slab.position.y = 0.025;
      slab.receiveShadow = true;
      grp.add(slab);
      for (const [px, pz] of [[-2.8, -2.8], [2.8, -2.8], [2.8, 2.8], [-2.8, 2.8]]) {
        const post = new Mesh(unitBox, postMat);
        post.scale.set(0.14, 2.3, 0.14);
        post.position.set(px, 1.15, pz);
        post.castShadow = true;
        grp.add(post);
      }
      // An open frame, not a roof slab: seen from the entrance side the carport
      // is in the foreground, and a solid roof would hide what is behind it.
      for (const [bx, bz, sx, sz] of [[0, -2.8, 5.74, 0.1], [0, 2.8, 5.74, 0.1], [-2.8, 0, 0.1, 5.74], [2.8, 0, 0.1, 5.74]]) {
        const beam = new Mesh(unitBox, postMat);
        beam.scale.set(sx, 0.1, sz);
        beam.position.set(bx, 2.3, bz);
        beam.castShadow = true;
        grp.add(beam);
      }
      top = 2.6;
    } else if (s.kind === "gate") {
      for (const pz of [-2.1, 2.1]) {
        const post = new Mesh(unitBox, postMat);
        post.scale.set(0.3, 1.9, 0.3);
        post.position.set(0, 0.95, pz);
        post.castShadow = true;
        grp.add(post);
      }
      const leaf = new Mesh(unitBox, gateMat);
      leaf.scale.set(0.08, 1.4, 3.9);
      leaf.position.y = 0.8;
      leaf.castShadow = true;
      grp.add(leaf);
      top = 2.1;
    } else {
      // The tank shows its level as itself: a water-coloured lower part and a
      // plain upper part, resized each frame.
      const cyl = own(new CylinderGeometry(TANK_R, TANK_R, 1, 36));
      obj.water = new Mesh(cyl, tankWaterMat);
      obj.shell = new Mesh(cyl, tankShellMat);
      obj.water.castShadow = obj.shell.castShadow = true;
      grp.add(obj.water, obj.shell);
      top = TANK_H + 0.3;
    }
    const lab = label("site", s.x, top, s.z);
    const b = document.createElement("b");
    b.textContent = s.label;
    lab.el.append(b, obj.sub);
    site.set(s.id, obj);
  }
  if (input.street) {
    const b = document.createElement("b");
    b.textContent = "Street";
    label("site", input.street.x, 0.1, input.street.z).el.append(b);
  }

  // ── Selection frame and zone markers ──────────────────────────────────────
  const frameMat = own(new MeshBasicMaterial());
  const bars = [0, 1, 2, 3].map(() => new Mesh(unitBox, frameMat));
  const selFrame = new Group();
  selFrame.add(...bars);
  selFrame.visible = false;
  scene.add(selFrame);

  const markGeo = own(new CylinderGeometry(0.13, 0.13, MARK_H, 18));
  const markMat = {
    clear: own(new MeshLambertMaterial()),
    open: own(new MeshLambertMaterial()),
    bypassed: own(new MeshLambertMaterial({ transparent: true, opacity: 0.55 })),
  };
  type Mark = { mesh: Mesh; lab: Label };
  const marks = new Map<string, Mark>();

  // ── Camera ────────────────────────────────────────────────────────────────
  // Wheel zooms only with Ctrl/⌘ held (a trackpad pinch arrives that way), so
  // scrolling the page over the model still scrolls the page. Registered before
  // OrbitControls so it runs first on browsers that order by registration.
  const gateWheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); };
  canvas.addEventListener("wheel", gateWheel, { capture: true });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false; // damping needs a running loop; rule 1
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.3;
  controls.target.set(0, 0, 0);

  let W = 1, H = 1, raf = 0, dead = false;
  // Which framing the view holds, or null once the camera has been moved by
  // hand. It decides what a resize does: fit again, or leave the view alone.
  let framing: Framing | null = "house";
  const invalidate = () => { if (!raf && !dead) raf = requestAnimationFrame(render); };
  const setFraming = (m: Framing | null) => { if (m !== framing) { framing = m; onframing?.(m); } };
  controls.addEventListener("change", invalidate);
  controls.addEventListener("start", () => setFraming(null));

  // Two things to fit. HOUSE is the rooms. YARD is everything drawn: every
  // corner of the outline at ground level, plus the top of each thing on it.
  const hx0 = Math.min(...input.rooms.map((r) => r.x)), hx1 = Math.max(...input.rooms.map((r) => r.x + r.w));
  const hz0 = Math.min(...input.rooms.map((r) => r.z)), hz1 = Math.max(...input.rooms.map((r) => r.z + r.d));
  const cornersAt = (x0: number, x1: number, z0: number, z1: number, y: number) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  // `mx` / `my` are how much of the half-width and half-height the box may fill.
  const BOX: Record<Framing, { c: Vector3; pts: number[][]; mx: () => number; my: () => number }> = {
    house: {
      c: new Vector3((hx0 + hx1) / 2, 0, (hz0 + hz1) / 2),
      pts: [...cornersAt(hx0, hx1, hz0, hz1, 0), ...cornersAt(hx0, hx1, hz0, hz1, FLOOR_T + WALL_H)],
      // Room for the room labels, and for the pool beside the patio.
      mx: () => 0.8,
      my: () => 0.8,
    },
    yard: {
      c: new Vector3(
        (Math.min(...outline.map((p) => p.x)) + Math.max(...outline.map((p) => p.x))) / 2,
        0,
        (Math.min(...outline.map((p) => p.z)) + Math.max(...outline.map((p) => p.z))) / 2,
      ),
      pts: [
        ...outline.map((p) => [p.x, 0, p.z]),
        ...input.site.map((s) => [s.x, SITE_TOP, s.z]),
        ...(input.street ? [[input.street.x, 0, input.street.z]] : []),
      ],
      // Padding in PIXELS, not a fraction: what has to fit beside the outermost
      // point is a text label ("Main gate", "Street"), and a label is the same
      // width on a phone as on a desktop. A fraction that suits one clips the other.
      mx: () => Math.max(0.6, 1 - 88 / W),
      my: () => Math.max(0.6, 1 - 56 / H),
    },
  };

  // The fit is measured, not estimated: a second camera is walked back along the
  // viewing direction until every corner of the box lands inside the frame. A
  // bounding-sphere formula is simpler and always too generous for something as
  // flat as a house — it left the model small in a sea of ground — and it cannot
  // account for a portrait phone. Thirty halvings of a distance is nothing.
  const probe = camera.clone();
  const dirV = new Vector3(), cornerV = new Vector3();
  function fitDistance(mode: Framing, dir: Vector3): number {
    const b = BOX[mode];
    const mx = b.mx(), my = b.my();
    probe.aspect = camera.aspect;
    probe.updateProjectionMatrix();
    let lo = 1, hi = 900;
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2;
      probe.position.copy(dir).multiplyScalar(d).add(b.c);
      probe.lookAt(b.c);
      probe.updateMatrixWorld();
      let inside = true;
      for (const p of b.pts) {
        cornerV.set(p[0], p[1], p[2]).applyMatrix4(probe.matrixWorldInverse);
        // Behind the lens: the divide below would flip it back into the frame.
        if (cornerV.z > -probe.near) { inside = false; break; }
        cornerV.applyMatrix4(probe.projectionMatrix);
        if (Math.abs(cornerV.x) > mx || Math.abs(cornerV.y) > my) { inside = false; break; }
      }
      if (inside) hi = d; else lo = d;
    }
    return hi;
  }
  /** Direction from the look-at point to the camera; the entrance side before anything has moved. */
  function currentDir(): Vector3 {
    dirV.copy(camera.position).sub(controls.target);
    return dirV.lengthSq() < 1e-6 ? dirV.copy(viewDir) : dirV.normalize();
  }
  /** Zoom range: from well inside the house to a little past the whole yard. */
  function limits(dir: Vector3) {
    controls.minDistance = fitDistance("house", dir) * 0.35;
    controls.maxDistance = fitDistance("yard", dir) * 1.35;
  }
  function applyFraming(mode: Framing) {
    const dir = currentDir();
    const d = fitDistance(mode, dir);
    limits(dir);
    controls.target.copy(BOX[mode].c);
    camera.position.copy(dir).multiplyScalar(d).add(BOX[mode].c);
    controls.update();
  }
  function frame(mode: Framing) {
    applyFraming(mode);
    setFraming(mode);
    invalidate();
  }
  function zoom(factor: number) {
    dirV.copy(camera.position).sub(controls.target);
    const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, dirV.length() * factor));
    camera.position.copy(dirV.normalize().multiplyScalar(d)).add(controls.target);
    controls.update();
    setFraming(null);
    invalidate();
  }

  const proj = new Vector3();
  function render() {
    raf = 0;
    if (dead) return;
    renderer.render(scene, camera);
    // Label detail by how many pixels a metre gets. Room readings drop out
    // first, then room names, so a zoomed-out yard is not a pile of overlapping
    // text. Zone and yard labels always stay: those are the ones you zoom out for.
    const ppm = H / (2 * camera.position.distanceTo(controls.target) * Math.tan((camera.fov * Math.PI) / 360));
    const far = ppm < 9 ? "2" : ppm < 16 ? "1" : "";
    if (labelLayer.dataset.far !== far) labelLayer.dataset.far = far;
    for (const l of labels) {
      proj.set(l.x, l.y, l.z).project(camera);
      const on = l.show && proj.z > -1 && proj.z < 1;
      l.el.style.display = on ? "" : "none";
      if (on) l.el.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-proj.y * 0.5 + 0.5) * H).toFixed(1)}px,0) translate(-50%,-50%)`;
    }
  }

  function resize() {
    const box = canvas.parentElement ?? canvas;
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (framing) applyFraming(framing);
    else { limits(currentDir()); controls.update(); }
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement ?? canvas);

  // ── Picking ───────────────────────────────────────────────────────────────
  const ray = new Raycaster();
  const ndc = new Vector2();
  function roomAt(e: PointerEvent): string | null {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(floors, false)[0];
    return hit ? (hit.object.userData.room as string) : null;
  }
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent) => {
    // A tap, not the end of a drag: the pointer barely moved.
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const id = roomAt(e);
      if (id) onpick(id);
    }
    down = null;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    canvas.style.cursor = roomAt(e) ? "pointer" : "grab";
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);

  // iOS drops the context of a backgrounded page. Let it, and redraw on return.
  const onLost = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", invalidate);

  // ── Frames ────────────────────────────────────────────────────────────────
  function set(f: Frame) {
    if (dead) return;
    const p = f.palette;

    // Light. `day` runs 0 → 1 from about 4° below the horizon to 10° above it,
    // so dusk is a slide rather than a switch.
    const day = clamp01((f.sun.y + 0.07) / 0.25);
    const night = 1 - day;
    hemi.intensity = lerp(0.6, 2.0, day);
    sun.intensity = lerp(0, 2.6, clamp01(f.sun.y / 0.3));
    if (f.sun.y > 0.02) sun.position.set(f.sun.x * 60, f.sun.y * 60, f.sun.z * 60);

    groundMat.color.set(p.ground);
    wallMat.color.set(p.floor).lerp(tmp.set(p.tx), 0.42);
    padMat.color.set(p.floor).lerp(tmp.set(p.ground), 0.4);
    kerbMat.color.set(p.floor).lerp(tmp.set(p.tx), 0.12);
    postMat.color.set(p.floor).lerp(tmp.set(p.tx), 0.2);
    waterMat.color.set(p.water);
    tankWaterMat.color.set(p.water);
    tankShellMat.color.set(p.floor).lerp(tmp.set(p.tx), 0.25);
    ringMat.color.set(p.ok);
    frameMat.color.set(p.acc);
    garageMat.color.set(p.mut);
    markMat.clear.color.set(p.mut);
    markMat.open.color.set(p.warn);
    markMat.bypassed.color.set(p.mut);

    for (const rf of f.rooms) {
      const r = rooms.get(rf.id);
      if (!r) continue;
      // A room with no reading must still read as a FLOOR, not a hole: lift the
      // plain surface a little off the card colour it would otherwise match.
      r.mat.color.set(p.floor).lerp(tmp.set(p.tx), r.rect.open ? 0.04 : 0.16);
      if (rf.tint) r.mat.color.lerp(tmp.set(rf.tint), clamp01(rf.strength));
      const g = clamp01(rf.glow);
      r.mat.emissive.set(p.glow);
      r.mat.emissiveIntensity = g * lerp(0.1, 0.4, night);
      r.glow.visible = g > 0;
      r.glowMat.color.set(p.glow);
      r.glowMat.opacity = g * lerp(0.3, 0.85, night);
      r.ring.visible = rf.occupied;
      r.sub.textContent = rf.sub;
      r.lab.el.dataset.alert = rf.alert ? "1" : "";
    }

    for (const sf of f.site) {
      const s = site.get(sf.id);
      if (!s) continue;
      s.sub.textContent = sf.sub;
      if (s.item.kind === "gate") gateMat.color.set(sf.alert ? p.warn : p.mut);
      if (s.water && s.shell) {
        // No reading draws an all-plain tank. It never draws an empty one: a
        // missing value is not zero.
        const lvl = sf.level == null ? 0 : clamp01(sf.level);
        const wh = Math.max(0.001, TANK_H * lvl), sh = Math.max(0.001, TANK_H * (1 - lvl));
        s.water.visible = sf.level != null && lvl > 0;
        s.water.scale.y = wh;
        s.water.position.y = wh / 2;
        s.shell.scale.y = sh;
        s.shell.position.y = wh + sh / 2;
      }
    }

    // Selection frame: four bars round the room, on top of its walls.
    const sel = f.selected ? rooms.get(f.selected) : undefined;
    selFrame.visible = !!sel;
    if (sel) {
      const { x, z, w, d, open } = sel.rect;
      const y = FLOOR_T + (open ? 0 : WALL_H) + 0.03, t = 0.1, h = 0.06;
      bars[0].position.set(x + w / 2, y, z + t / 2); bars[0].scale.set(w, h, t);
      bars[1].position.set(x + w / 2, y, z + d - t / 2); bars[1].scale.set(w, h, t);
      bars[2].position.set(x + t / 2, y, z + d / 2); bars[2].scale.set(t, h, d);
      bars[3].position.set(x + w - t / 2, y, z + d / 2); bars[3].scale.set(t, h, d);
    }

    // Zone markers: clear is a plain post, open a taller amber one, bypassed a stub.
    const seen = new Set<string>();
    for (const m of f.markers) {
      seen.add(m.key);
      let k = marks.get(m.key);
      if (!k) {
        const mesh = new Mesh(markGeo, markMat.clear);
        mesh.castShadow = true;
        scene.add(mesh);
        k = { mesh, lab: label("zone", m.x, 0, m.z) };
        marks.set(m.key, k);
      }
      const sy = m.state === "open" ? 1.7 : m.state === "bypassed" ? 0.4 : 1;
      const sxz = m.state === "open" ? 1.5 : 1;
      k.mesh.material = markMat[m.state];
      k.mesh.scale.set(sxz, sy, sxz);
      k.mesh.position.set(m.x, FLOOR_T + (MARK_H * sy) / 2, m.z);
      k.lab.x = m.x; k.lab.z = m.z; k.lab.y = FLOOR_T + MARK_H * sy + 0.35;
      k.lab.el.textContent = m.text;
      k.lab.el.dataset.state = m.state;
      k.lab.show = !!m.text;
    }
    for (const [key, k] of marks) {
      if (seen.has(key)) continue;
      scene.remove(k.mesh);
      k.lab.el.remove();
      labels.splice(labels.indexOf(k.lab), 1);
      marks.delete(key);
    }

    invalidate();
  }

  function dispose() {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    canvas.removeEventListener("wheel", gateWheel, { capture: true });
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", invalidate);
    for (const d of disposables) d.dispose();
    labelLayer.replaceChildren();
    renderer.dispose();
  }

  resize();
  return { set, frame, zoom, dispose };
}
