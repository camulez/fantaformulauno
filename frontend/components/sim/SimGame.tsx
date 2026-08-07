"use client";

// Prototipo simulatore (S1): scena Three.js low-poly premium, una pista, guida con
// due zone touch. La geometria della pista e la mappa in alto vengono dalla STESSA
// linea centrale (lib/sim/track.ts), quindi corrispondono per costruzione.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildGeometry, getTrack, worldAt, rightNormal } from "@/lib/sim/track";
import { createCar, step, TICK, formatTime, isOffTrack, CarState } from "@/lib/sim/physics";

type Phase = "ready" | "warmup" | "timed" | "done";

const SKY_TOP = 0x2f6f9e;
const SKY_BOT = 0xcfe3ea;
const FOG_COLOR = 0xb9d3dd;

export default function SimGame({ roundNo = 8 }: { roundNo?: number }) {
  const def = useMemo(() => getTrack(roundNo), [roundNo]);
  const geom = useMemo(() => buildGeometry(def), [def]);

  const mountRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ steer: 0, brake: false });
  const carRef = useRef<CarState>(createCar());
  const phaseRef = useRef<Phase>("ready");
  const lapStartRef = useRef(0);
  const timeRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ speed: 0, time: 0, u: 0, fps: 0, off: false });
  const [result, setResult] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const start = useCallback(() => {
    const car = createCar();
    // Parametri di sviluppo (utili per ispezionare un punto preciso del circuito):
    // ?s=1200 parte a 1200 m dal via, &v=40 con 40 m/s di velocità iniziale.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const s0 = Number(q.get("s"));
      const v0 = Number(q.get("v"));
      if (Number.isFinite(s0) && s0 > 0) car.s = s0;
      if (Number.isFinite(v0) && v0 > 0) car.speed = v0;
    }
    carRef.current = car;
    timeRef.current = 0;
    lapStartRef.current = car.s;
    setResult(null);
    setPhaseBoth("warmup");
  }, [setPhaseBoth]);

  // ─────────────────────────── scena 3D ───────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    // Sui telefoni il rapporto pixel è spesso 3: renderizzare a 3× costa 9 volte più di
    // 1× e su una pista non serve. 1.5 è il compromesso che tiene la fluidità.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(FOG_COLOR, 70, 850);

    const camera = new THREE.PerspectiveCamera(74, mount.clientWidth / mount.clientHeight, 0.4, 2000);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // ── cielo a gradiente ──
    const skyGeo = track(new THREE.SphereGeometry(1400, 24, 16));
    const skyMat = track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(SKY_TOP) },
          bottom: { value: new THREE.Color(SKY_BOT) },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = clamp(vP.y/900.0*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.9)), 1.0); }`,
      })
    );
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // ── luci ──
    scene.add(new THREE.HemisphereLight(0xdff0f7, 0x4a5340, 0.85));
    const sun = new THREE.DirectionalLight(0xfff4e2, 1.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.bias = -0.0007;
    scene.add(sun);
    scene.add(sun.target);

    // ── terreno ──
    const groundGeo = track(new THREE.PlaneGeometry(6000, 6000));
    const groundMat = track(new THREE.MeshLambertMaterial({ color: 0x59683f }));
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);

    const n = geom.points.length;
    const hw = geom.roadWidth / 2;
    // Stessa normale usata dalla fisica (lib/sim/track.ts): scostamento positivo = destra.
    const normalAt = (i: number) => rightNormal(geom.headings[i]);

    // Distanza dal punto più vicino della linea centrale. Un circuito cittadino si ripiega
    // su sé stesso: un oggetto messo "di fianco" a un tratto può finire in mezzo a un ALTRO
    // tratto, quindi va sempre verificato contro tutta la pista.
    const clearOf = (px: number, pz: number) => {
      let best = Infinity;
      for (let j = 0; j < n; j++) {
        const q = geom.points[j];
        const dx = q.x - px;
        const dz = q.z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      return Math.sqrt(best);
    };

    // rumore deterministico: la scena è identica a ogni caricamento
    const rnd = (i: number, salt: number) => {
      const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    // ── asfalto ──
    {
      const pos = new Float32Array(n * 2 * 3);
      const idx: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = geom.points[i];
        const { nx, nz } = normalAt(i);
        pos[i * 6 + 0] = p.x - nx * hw;
        pos[i * 6 + 1] = 0;
        pos[i * 6 + 2] = p.z - nz * hw;
        pos[i * 6 + 3] = p.x + nx * hw;
        pos[i * 6 + 4] = 0;
        pos[i * 6 + 5] = p.z + nz * hw;
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = i * 2,
          b = i * 2 + 1,
          c = j * 2,
          d = j * 2 + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = track(new THREE.MeshLambertMaterial({ color: 0x4a4d55, side: THREE.DoubleSide }));
      const road = new THREE.Mesh(g, m);
      road.receiveShadow = true;
      scene.add(road);
    }

    // ── cordoli a blocchi alternati ──
    {
      const KERB_W = 1.5;
      const GROUP = 3; // campioni per blocco di colore
      const mk = (color: number, parity: number) => {
        const pos: number[] = [];
        const idx: number[] = [];
        let v = 0;
        for (let i = 0; i < n; i++) {
          if (Math.floor(i / GROUP) % 2 !== parity) continue;
          const j = (i + 1) % n;
          for (const side of [-1, 1]) {
            const p0 = geom.points[i],
              p1 = geom.points[j];
            const a0 = normalAt(i),
              a1 = normalAt(j);
            const inner0x = p0.x + a0.nx * hw * side,
              inner0z = p0.z + a0.nz * hw * side;
            const outer0x = p0.x + a0.nx * (hw + KERB_W) * side,
              outer0z = p0.z + a0.nz * (hw + KERB_W) * side;
            const inner1x = p1.x + a1.nx * hw * side,
              inner1z = p1.z + a1.nz * hw * side;
            const outer1x = p1.x + a1.nx * (hw + KERB_W) * side,
              outer1z = p1.z + a1.nz * (hw + KERB_W) * side;
            pos.push(inner0x, 0.05, inner0z, outer0x, 0.09, outer0z, inner1x, 0.05, inner1z, outer1x, 0.09, outer1z);
            idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
            v += 4;
          }
        }
        const g = track(new THREE.BufferGeometry());
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = track(new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
        scene.add(new THREE.Mesh(g, m));
      };
      mk(0xc9352c, 0);
      mk(0xeceae2, 1);
    }

    // ── linea del traguardo ──
    // Costruita con vertici espliciti nel piano della pista: ruotare un PlaneGeometry
    // con gli angoli di Eulero lo faceva ribaltare (la seconda rotazione agisce sugli
    // assi del mondo, non su quelli del piano già coricato).
    {
      const i0 = 0;
      const i1 = Math.min(n - 1, 1);
      const a = geom.points[i0];
      const b = geom.points[i1];
      const na = normalAt(i0);
      const nb = normalAt(i1);
      const pos = [
        a.x - na.nx * hw, 0.045, a.z - na.nz * hw,
        a.x + na.nx * hw, 0.045, a.z + na.nz * hw,
        b.x - nb.nx * hw, 0.045, b.z - nb.nz * hw,
        b.x + nb.nx * hw, 0.045, b.z + nb.nz * hw,
      ];
      const g = track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex([0, 2, 1, 1, 2, 3]);
      g.computeVertexNormals();
      const m = track(new THREE.MeshLambertMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide }));
      scene.add(new THREE.Mesh(g, m));
    }

    // ── barriere ──
    {
      const g = track(new THREE.BoxGeometry(0.45, 1.05, 4.3));
      const m = track(new THREE.MeshLambertMaterial({ color: 0xdfe3e6 }));
      const count = n * 2;
      const inst = new THREE.InstancedMesh(g, m, count);
      // Le barriere NON proiettano ombre: sono più di mille istanze e il passaggio
      // ombre le ridisegnerebbe tutte a ogni frame, per un guadagno visivo nullo.
      inst.castShadow = false;
      inst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      let k = 0;
      for (let i = 0; i < n; i++) {
        const p = geom.points[i];
        const h = geom.headings[i];
        const { nx, nz } = normalAt(i);
        for (const side of [-1, 1]) {
          const off = hw + 2.1;
          dummy.position.set(p.x + nx * off * side, 0.52, p.z + nz * off * side);
          dummy.rotation.set(0, h, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(k++, dummy.matrix);
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
      disposables.push({ dispose: () => inst.dispose() });
    }

    // ── palazzi (Monaco è cittadino): volumi semplici ma illuminati ──
    {
      const g = track(new THREE.BoxGeometry(1, 1, 1));
      const m = track(new THREE.MeshLambertMaterial({ color: 0xffffff }));
      const step = 6;
      const count = Math.floor(n / step) * 2;
      const inst = new THREE.InstancedMesh(g, m, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      // Palette da Riviera: crema, ocra, terracotta, rosa antico, azzurro sbiadito.
      const palette = [
        0xf0e6d2, 0xe3cfa8, 0xd8a878, 0xc98a6b, 0xefdcc4, 0xdcc9b0, 0xc9b7a2, 0xe8d5c0,
        0xbfc9cc, 0xd4b48c,
      ];
      const col = new THREE.Color();
      let k = 0;
      for (let i = 0; i < n; i += step) {
        const p = geom.points[i];
        const h = geom.headings[i];
        const { nx, nz } = normalAt(i);
        for (const side of [-1, 1]) {
          const r1 = rnd(i, side + 1);
          const r2 = rnd(i, side + 7);
          const r3 = rnd(i, side + 13);
          const dist = hw + 18 + r1 * 30;
          const w = 10 + r2 * 16;
          const hgt = 7 + r3 * 24;
          const d = 10 + r1 * 14;
          const px = p.x + nx * dist * side;
          const pz = p.z + nz * dist * side;
          // il palazzo deve stare lontano da OGNI punto della pista, non solo da questo
          const halfDiag = Math.hypot(w, d) / 2;
          if (clearOf(px, pz) < hw + 7 + halfDiag) continue;
          dummy.position.set(px, hgt / 2, pz);
          dummy.rotation.set(0, h + (r2 - 0.5) * 0.5, 0);
          dummy.scale.set(w, hgt, d);
          dummy.updateMatrix();
          if (k < count) {
            inst.setMatrixAt(k, dummy.matrix);
            col.setHex(palette[Math.floor(r3 * palette.length) % palette.length]);
            inst.setColorAt(k, col);
            k++;
          }
        }
      }
      inst.count = k;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
      disposables.push({ dispose: () => inst.dispose() });
    }

    // ── verde a bordo pista (un solo draw call) ──
    {
      const g = track(new THREE.ConeGeometry(2.3, 7.5, 6));
      const m = track(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
      const step = 9;
      const inst = new THREE.InstancedMesh(g, m, Math.floor(n / step) * 2);
      inst.castShadow = true;
      const dummy = new THREE.Object3D();
      const greens = [0x4f7a3a, 0x5d8c45, 0x436b32, 0x6b9a52];
      const col = new THREE.Color();
      let k = 0;
      for (let i = 0; i < n; i += step) {
        const p = geom.points[i];
        const { nx, nz } = normalAt(i);
        for (const side of [-1, 1]) {
          const r1 = rnd(i, side + 31);
          const r2 = rnd(i, side + 47);
          if (r1 < 0.45) continue; // non ovunque: alberi sparsi
          const dist = hw + 5.5 + r2 * 7;
          const px = p.x + nx * dist * side;
          const pz = p.z + nz * dist * side;
          if (clearOf(px, pz) < hw + 4) continue;
          const sc = 0.7 + r2 * 0.7;
          dummy.position.set(px, (7.5 * sc) / 2, pz);
          dummy.rotation.set(0, r1 * 6.28, 0);
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          if (k < inst.count) {
            inst.setMatrixAt(k, dummy.matrix);
            col.setHex(greens[Math.floor(r1 * greens.length) % greens.length]);
            inst.setColorAt(k, col);
            k++;
          }
        }
      }
      inst.count = k;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
      disposables.push({ dispose: () => inst.dispose() });
    }

    // ─────────────────────── ciclo di gioco ───────────────────────
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let frames = 0;
    let fpsAcc = 0;
    let fps = 0;
    let running = true;
    let quality = 2; // 2 = ombre + 1.5×, 1 = senza ombre, 0 = anche risoluzione ridotta
    let lowCount = 0;
    const camDir = new THREE.Vector3();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth,
        h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // In pausa quando la scheda è nascosta (batteria + il cronometro non deve correre
    // mentre non stai guidando). ?nopause=1 la disattiva per le verifiche in strumenti
    // headless, dove la pagina risulta sempre "hidden".
    const noPause =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nopause") === "1";
    const onVisibility = () => {
      running = noPause || !document.hidden;
      last = performance.now();
    };
    if (!noPause) document.addEventListener("visibilitychange", onVisibility);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtReal = Math.min((now - last) / 1000, 0.25);
      last = now;
      if (!running) return;

      frames++;
      fpsAcc += dtReal;
      if (fpsAcc >= 0.5) {
        fps = Math.round(frames / fpsAcc);
        frames = 0;
        fpsAcc = 0;
        // Calo di qualità automatico: meglio rinunciare alle ombre che andare a scatti.
        // Prima si spengono le ombre, poi si abbassa la risoluzione.
        if (fps > 0 && fps < 38) {
          lowCount++;
          if (lowCount >= 2 && quality === 2) {
            quality = 1;
            renderer.shadowMap.enabled = false;
            scene.traverse((o) => {
              const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
              if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
              else if (mat) mat.needsUpdate = true;
            });
          } else if (lowCount >= 5 && quality === 1) {
            quality = 0;
            renderer.setPixelRatio(1);
            onResize();
          }
        } else if (fps >= 46) {
          lowCount = 0;
        }
      }

      const car = carRef.current;
      const ph = phaseRef.current;

      // fisica a tick fisso (deterministica)
      if (ph === "warmup" || ph === "timed") {
        acc += dtReal;
        let guard = 0;
        while (acc >= TICK && guard < 12) {
          step(car, inputRef.current, geom);
          acc -= TICK;
          guard++;
          if (ph === "timed") timeRef.current += TICK * 1000;

          if (car.s - lapStartRef.current >= geom.length) {
            lapStartRef.current += geom.length;
            if (phaseRef.current === "warmup") {
              timeRef.current = 0;
              phaseRef.current = "timed";
              setPhase("timed");
            } else {
              const t = timeRef.current;
              phaseRef.current = "done";
              setPhase("done");
              setResult(t);
              setBest((b) => (b === null || t < b ? t : b));
              inputRef.current.steer = 0;
              inputRef.current.brake = false;
              break;
            }
          }
        }
        if (acc > TICK * 12) acc = 0;
      }

      // camera in abitacolo
      const w = worldAt(geom, car.s, car.lateral);
      // yaw positivo = muso verso la DESTRA del pilota; nel mondo l'angolo di rotta cala.
      const heading = w.heading - car.yaw;
      const shake = Math.min(car.speed / 82, 1) * 0.016;
      // Camera più alta e leggermente inclinata verso il basso: in verticale serve vedere
      // la pista che arriva, non il cofano.
      camera.position.set(w.x, 1.5 + Math.sin(now / 70) * shake * 0.5, w.z);
      camDir.set(Math.sin(heading), 0, Math.cos(heading));
      camera.lookAt(
        w.x + camDir.x * 34,
        0.9 + Math.cos(now / 90) * shake * 0.4,
        w.z + camDir.z * 34
      );
      camera.rotation.z += -car.steer * 0.035;

      // il sole segue l'auto: ombre nitide con una shadow map piccola
      sun.position.set(w.x + 70, 110, w.z - 50);
      sun.target.position.set(w.x, 0, w.z);
      sun.target.updateMatrixWorld();

      renderer.render(scene, camera);

      hudAcc += dtReal;
      if (hudAcc > 0.09) {
        hudAcc = 0;
        setHud({
          speed: car.speed,
          time: timeRef.current,
          u: ((car.s % geom.length) + geom.length) % geom.length / geom.length,
          fps,
          off: isOffTrack(car, geom),
        });
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [geom]);

  // ─────────────────────── comandi ───────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.steer = -1;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.steer = 1;
      if (e.key === "ArrowDown" || e.key === " ") inputRef.current.brake = true;
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "ArrowRight", "d"].includes(e.key)) inputRef.current.steer = 0;
      if (e.key === "ArrowDown" || e.key === " ") inputRef.current.brake = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const hold = (steer: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      inputRef.current.steer = steer;
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current.steer = 0;
    },
    onPointerCancel: () => {
      inputRef.current.steer = 0;
    },
    onPointerLeave: () => {
      inputRef.current.steer = 0;
    },
  });

  // ─────────────────────── mappa (stessa geometria) ───────────────────────
  const map = useMemo(() => {
    const xs = geom.points.map((p) => p.x);
    const zs = geom.points.map((p) => p.z);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minZ = Math.min(...zs),
      maxZ = Math.max(...zs);
    const W = 150,
      H = 66;
    const sc = Math.min(W / (maxX - minX || 1), H / (maxZ - minZ || 1));
    const cx = (minX + maxX) / 2,
      cz = (minZ + maxZ) / 2;
    const pts = geom.points.map((p) => [(p.x - cx) * sc, (p.z - cz) * sc] as const);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";
    return { pts, d };
  }, [geom]);

  const marker = map.pts[Math.min(map.pts.length - 1, Math.floor(hud.u * map.pts.length))];

  const mono = "font-[family-name:var(--font-mono)]";

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-carbon-950 select-none">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Abitacolo essenziale: plancia curva + penombra ai lati. Fatto con CSS, così non
          si deforma su nessun rapporto di schermo (l'SVG stirato creava archi assurdi).
          Niente muso, specchietti o halo. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: "linear-gradient(to top, rgba(4,6,10,.92) 34%, rgba(4,6,10,0) 100%)" }}
        />
        <div className="absolute -inset-x-[22%] bottom-0 h-[19%] rounded-t-[50%] border-t border-acid/25 bg-[#070a0f]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 75% at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,.42) 100%)",
          }}
        />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="rounded-xl border border-line/60 bg-carbon-950/70 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-end justify-between">
            <div>
              <p className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>
                {phase === "warmup" ? "Giro di riscaldamento" : phase === "timed" ? "Giro cronometrato" : `R${def.roundNo} · ${def.name}`}
              </p>
              <p className={`${mono} text-2xl font-bold leading-tight text-bone`}>
                {phase === "warmup" ? "--:--.---" : formatTime(hud.time)}
              </p>
            </div>
            <div className="text-right">
              <p className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>km/h</p>
              <p className={`${mono} text-2xl font-bold leading-tight text-acid`}>{Math.round(hud.speed * 3.6)}</p>
            </div>
          </div>
        </div>

        {/* mappa: vista dall'alto della stessa curva che si sta guidando */}
        <div className="mt-2 rounded-xl border border-line/60 bg-carbon-950/70 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className={`${mono} text-[9px] uppercase tracking-widest text-acid`}>
              {def.code} · {(geom.length / 1000).toFixed(2)} km
            </span>
            <span className={`${mono} text-[9px] uppercase tracking-widest text-bone-dim`}>
              {hud.fps} fps{hud.off ? " · fuori pista" : ""}
            </span>
          </div>
          <svg viewBox="-85 -40 170 80" className="mt-1 h-16 w-full">
            <path d={map.d} fill="none" stroke="currentColor" className="text-bone-dim/45" strokeWidth="2.4" strokeLinejoin="round" />
            {/* Il tratto percorso si rivela con la tratteggiatura su pathLength=1: un solo
                attributo che cambia, invece di ricostruire un tracciato da 500+ punti a ogni
                aggiornamento (era una causa di scatti). */}
            <path
              d={map.d}
              fill="none"
              stroke="#c6ff3a"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${Math.max(0.001, hud.u)} 1`}
            />
            {marker && <circle cx={marker[0]} cy={marker[1]} r="3.4" fill="#fff" />}
          </svg>
        </div>
      </div>

      {/* comandi */}
      {(phase === "warmup" || phase === "timed") && (
        <div className="absolute inset-x-0 bottom-0 flex h-40 items-end gap-2 p-3">
          <button
            {...hold(-1)}
            aria-label="Sterza a sinistra"
            className="h-28 flex-1 rounded-2xl border border-acid/30 bg-acid/10 active:bg-acid/25"
          >
            <span className={`${mono} text-2xl text-acid`}>◀</span>
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              inputRef.current.brake = true;
            }}
            onPointerUp={() => (inputRef.current.brake = false)}
            onPointerLeave={() => (inputRef.current.brake = false)}
            aria-label="Freno"
            className="h-20 w-20 shrink-0 rounded-2xl border border-red/40 bg-red/15 active:bg-red/30"
          >
            <span className={`${mono} text-[10px] font-bold uppercase tracking-widest text-red`}>Freno</span>
          </button>
          <button
            {...hold(1)}
            aria-label="Sterza a destra"
            className="h-28 flex-1 rounded-2xl border border-acid/30 bg-acid/10 active:bg-acid/25"
          >
            <span className={`${mono} text-2xl text-acid`}>▶</span>
          </button>
        </div>
      )}

      {/* schermate */}
      {phase === "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-carbon-950/75 px-8 text-center backdrop-blur-sm">
          <p className={`${mono} text-[10px] uppercase tracking-[0.3em] text-acid`}>Simulatore</p>
          <h2 className="text-3xl font-semibold uppercase tracking-wide text-bone">{def.name}</h2>
          <p className={`${mono} text-[11px] leading-relaxed tracking-wider text-bone-dim`}>
            Un giro di riscaldamento per prendere le misure,
            <br />
            poi il giro cronometrato.
            <br />
            Tieni premuto a sinistra o a destra per sterzare.
          </p>
          <button
            onClick={start}
            className={`${mono} mt-2 rounded-xl bg-acid px-8 py-3 text-sm font-bold uppercase tracking-widest text-carbon-950`}
          >
            Via
          </button>
        </div>
      )}

      {phase === "done" && result !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-carbon-950/80 px-8 text-center backdrop-blur-sm">
          <p className={`${mono} text-[10px] uppercase tracking-[0.3em] text-acid`}>Giro completato</p>
          <p className={`${mono} text-4xl font-bold text-bone`}>{formatTime(result)}</p>
          {best !== null && (
            <p className={`${mono} text-[11px] uppercase tracking-widest text-bone-dim`}>
              Tuo miglior tempo: <span className="text-acid">{formatTime(best)}</span>
            </p>
          )}
          <button
            onClick={start}
            className={`${mono} mt-3 rounded-xl bg-acid px-8 py-3 text-sm font-bold uppercase tracking-widest text-carbon-950`}
          >
            Riprova
          </button>
        </div>
      )}
    </div>
  );
}
