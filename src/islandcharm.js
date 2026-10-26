import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solid, rng } from './toon.js?v=20261026105735';
import { person } from './characters.js?v=20261026105735';

// Le charme de l'île : terrasses et étals sur la place, fanions au-dessus des rues, scooters,
// parc fleuri (parterres, aire de jeux, canards, cerf-volant), plage animée, arbustes et cyprès.
// Tout le statique est fusionné par couleur (Kit) : quelques dizaines de maillages seulement.

const V = THREE.Vector3;
const FL = ['#e8404a', '#ffc845', '#ffffff', '#ff8fb3', '#a25dd9', '#ff8a3d'];
const AWN = [['#e8404a', '#ffffff'], ['#2f6fe0', '#ffffff'], ['#2f9e55', '#ffffff'], ['#ffc845', '#ffffff']];
const WOOD = '#a8754b', METAL = '#3c4a5c';

function T(geo, x, y, z, ry = 0) {
  if (geo.index) geo = geo.toNonIndexed();
  if (ry) geo.rotateY(ry);
  return geo.translate(x, y, z);
}

class Kit {
  constructor() { this.m = new Map(); }
  add(geo, color, ow = 0.04, wind = false) {
    const k = `${color}|${ow}|${wind ? 1 : 0}`;
    if (!this.m.has(k)) this.m.set(k, []);
    this.m.get(k).push(geo);
  }
  build(parent) {
    for (const [k, list] of this.m) {
      const [c, ow, w] = k.split('|');
      parent.add(solid(mergeGeometries(list), c, { outlineWidth: +ow, wind: w === '1' }));
    }
    this.m.clear();
  }
}

export function buildIslandCharm({ root, anim, blocks, poly, top, S, life }) {
  const R = rng(5150);
  const Y = top;
  const group = new THREE.Group();
  root.add(group);
  const kit = new Kit();
  const circ = (x, z, r) => { blocks.circles.push({ x, z, r }); };

  // Primitives posées au sol (y0 = base de la pièce), dans un repère local tournable.
  const frame = (ox, oz, ry = 0) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const W = (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c];
    return {
      box: (w, h, d, col, lx, y0, lz, ow = 0.03, wind = false) => { const [x, z] = W(lx, lz); kit.add(T(new THREE.BoxGeometry(w, h, d), x, Y + y0 + h / 2, z, ry), col, ow, wind); },
      slab: (w, h, d, col, lx, y0, lz, rx, ow = 0.02) => { const [x, z] = W(lx, lz); kit.add(T(new THREE.BoxGeometry(w, h, d).rotateX(rx), x, Y + y0 + h / 2, z, ry), col, ow); },
      cyl: (rt, rb, h, col, lx, y0, lz, seg = 6, ow = 0.03, wind = false) => { const [x, z] = W(lx, lz); kit.add(T(new THREE.CylinderGeometry(rt, rb, h, seg), x, Y + y0 + h / 2, z, ry), col, ow, wind); },
      cone: (r, h, col, lx, y0, lz, seg = 8, ow = 0.04, wind = false) => { const [x, z] = W(lx, lz); kit.add(T(new THREE.ConeGeometry(r, h, seg), x, Y + y0 + h / 2, z, ry), col, ow, wind); },
      ball: (r, col, lx, y, lz, ow = 0.03, sy = 1, wind = false) => { const [x, z] = W(lx, lz); kit.add(T(new THREE.IcosahedronGeometry(r, 0).scale(1, sy, 1), x, Y + y, z, ry), col, ow, wind); },
    };
  };
  const bar = (a, b, t, col) => {
    const d = new V().subVectors(b, a), len = d.length();
    const g = new THREE.BoxGeometry(t, t, len).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), d.normalize()));
    kit.add(g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2).toNonIndexed(), col, 0);
  };
  // Guirlande de fanions entre deux points (coordonnées monde, y absolu).
  const bunting = (a, b, sag = 0.9, cols = FL) => {
    const n = Math.max(5, Math.round(a.distanceTo(b) / 1.6));
    const dir = new V(b.x - a.x, 0, b.z - a.z).normalize();
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const p = new V().lerpVectors(a, b, u); p.y -= sag * 4 * u * (1 - u);
      bar(prev, p, 0.07, '#1d2533');
      if (i < n) {
        const hw = 0.34, hd = 0.75;
        const A = [p.x - dir.x * hw, p.y, p.z - dir.z * hw], B = [p.x + dir.x * hw, p.y, p.z + dir.z * hw], C = [p.x, p.y - hd, p.z];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...B, ...A, ...C], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
        g.computeVertexNormals();
        kit.add(g, cols[i % cols.length], 0);
      }
      prev = p;
    }
  };
  const pole = (x, z, h) => frame(x, z).cyl(0.12, 0.16, h, METAL, 0, 0, 0, 5, 0.02);
  const pot = (x, z, col = '#c8553d', k = 1) => {
    const f = frame(x, z);
    f.cyl(0.42 * k, 0.3 * k, 0.7 * k, col, 0, 0, 0, 7, 0.03);
    f.ball(0.55 * k, '#4f8f4a', 0, 1.0 * k, 0, 0.03, 1, true);
    for (let j = 0; j < 3; j++) f.ball(0.16 * k, FL[Math.floor(R() * FL.length)], (R() - 0.5) * 0.7 * k, (1.2 + R() * 0.2) * k, (R() - 0.5) * 0.7 * k, 0);
  };
  const stand = (shirt, x, z, fx, fz, pants = '#2d3a4f', scale = S) => {
    const p = person({ shirt, pants });
    p.scale.setScalar(scale);
    p.position.set(x, Y, z);
    p.rotation.y = Math.atan2(fx - x, fz - z);
    p.userData.arms.forEach((a, i) => { a.rotation.x = i ? -0.5 : 0.1; });
    group.add(p);
    return p;
  };
  const walk = (p, t, i) => {
    p.userData.legs.forEach((l, j) => { l.rotation.x = Math.sin(t * 7 + i + j * Math.PI) * 0.6; });
    p.userData.arms.forEach((a, j) => { a.rotation.x = -Math.sin(t * 7 + i + j * Math.PI) * 0.4; });
  };

  // ===== La place de la vieille ville : terrasses, étals, jardinières, guirlandes, serveur =====
  const SQ = { x: 249, z: -360 };
  {
    [[0, -9.5, 0], [0, 9.5, Math.PI], [9.5, 0, -Math.PI / 2], [-9.5, 0, Math.PI / 2]].forEach(([dx, dz, ry], i) => {
      const x = SQ.x + dx, z = SQ.z + dz, f = frame(x, z, ry);
      f.cyl(0.9, 0.9, 0.1, '#ffffff', 0, 1.05, 0, 10, 0.03);
      f.cyl(0.08, 0.08, 1.05, METAL, 0, 0, 0, 4, 0);
      f.cyl(0.4, 0.5, 0.1, METAL, 0, 0, 0, 6, 0);
      f.cyl(0.06, 0.06, 4.2, '#ffffff', 0, 0, 0, 4, 0);
      f.cone(2.7, 1.1, AWN[i % AWN.length][0], 0, 3.9, 0, 10, 0.05);
      f.ball(0.25, '#ffc845', 0, 5.1, 0, 0.02);
      for (const a of [-0.9, 0.9, 2.3]) {
        const cx = Math.sin(a) * 1.7, cz = Math.cos(a) * 1.7;
        f.box(0.7, 0.12, 0.7, WOOD, cx, 0.75, cz, 0.02);
        f.box(0.7, 0.7, 0.12, WOOD, cx - Math.sin(a) * 0.3, 0.8, cz - Math.cos(a) * 0.3, 0.02);
        f.cyl(0.07, 0.07, 0.75, METAL, cx, 0, cz, 4, 0);
      }
      circ(x, z, 2.4);
    });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; pot(SQ.x + Math.cos(a) * 5.8, SQ.z + Math.sin(a) * 5.8, k % 2 ? '#c8553d' : '#e0a458', 0.85); }
    // Étals de marché tournés vers la fontaine.
    [55, 125, 235, 305].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, x = SQ.x + Math.cos(a) * 11.6, z = SQ.z + Math.sin(a) * 11.6;
      const ry = Math.atan2(-Math.cos(a), -Math.sin(a)), f = frame(x, z, ry), [c1, c2] = AWN[(i + 1) % AWN.length];
      for (const px of [-1.7, 1.7]) { f.cyl(0.07, 0.07, 3, '#ffffff', px, 0, -1, 4, 0); f.cyl(0.07, 0.07, 2.4, '#ffffff', px, 0, 1.1, 4, 0); }
      for (let s = 0; s < 6; s++) f.slab(0.58, 0.1, 2.6, s % 2 ? c2 : c1, -1.45 + s * 0.58, 2.6, 0.1, 0.22, 0.02);
      f.box(3.4, 0.9, 1.1, '#f1e6cf', 0, 0, 1.0, 0.04);
      f.box(3.5, 0.12, 1.2, WOOD, 0, 0.9, 1.0, 0.02);
      for (let k = 0; k < 6; k++) f.ball(0.26, ['#e8404a', '#ffc845', '#7bc043', '#ff8a3d'][(k + i) % 4], -1.3 + k * 0.52, 1.2, 1.0 + (k % 2) * 0.2, 0.02);
      f.box(0.9, 0.5, 0.7, '#b98a56', -1.2, 0, 2.0, 0.03);
      f.box(0.9, 0.5, 0.7, '#b98a56', 1.2, 0, 2.0, 0.03);
      const seller = person({ shirt: FL[(i * 2) % FL.length], pants: '#55607a' });
      seller.scale.setScalar(S);
      seller.position.set(x - Math.sin(ry) * 0.6, Y, z - Math.cos(ry) * 0.6);
      seller.rotation.y = ry;
      group.add(seller);
      circ(x + Math.sin(ry), z + Math.cos(ry), 2.4);
    });
    stand('#ff6a4d', SQ.x - 4, SQ.z + 4.5, SQ.x - 3, SQ.z + 5.4);
    stand('#4d7cff', SQ.x - 3, SQ.z + 5.4, SQ.x - 4, SQ.z + 4.5, '#26324a');
    stand('#2f9e55', SQ.x + 5, SQ.z - 4.5, SQ.x + 6, SQ.z - 5.2, '#55607a');
    stand('#ffc845', SQ.x + 6, SQ.z - 5.2, SQ.x + 5, SQ.z - 4.5);
    const waiter = person({ shirt: '#ffffff', pants: '#1d2533' });
    waiter.scale.setScalar(S);
    group.add(waiter);
    anim.push((dt, t) => {
      const a = t * 0.35;
      waiter.position.set(SQ.x + Math.cos(a) * 7.6, Y, SQ.z + Math.sin(a) * 7.6);
      waiter.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      walk(waiter, t, 3);
      waiter.userData.arms[0].rotation.x = -1.3;
    });
    const tr = [[-9, -6], [9, -6], [9, 6], [-9, 6]].map(([dx, dz]) => new V(SQ.x + dx, Y + 5.2, SQ.z + dz));
    for (let i = 0; i < 4; i++) bunting(tr[i], tr[(i + 1) % 4], 1.1);
    bunting(tr[0], tr[2], 1.4, ['#ffc845', '#ffffff', '#e8404a']);
    bunting(tr[1], tr[3], 1.4, ['#4d7cff', '#ffffff', '#ffc845']);
  }

  // ===== Rues : guirlandes, pots, scooters, promeneurs =====
  {
    const pts = [[216, -298], [246, -289], [276, -298], [287, -332], [272, -366], [286, -404], [258, -428], [226, -420], [210, -388], [224, -350]];
    const street = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new V(x, Y, z)), true, 'catmullrom', 0.5);
    const tan = new V();
    const side = (u, off) => { const p = street.getPointAt(u); street.getTangentAt(u, tan); return { x: p.x - tan.z * off, z: p.z + tan.x * off, tx: tan.x, tz: tan.z }; };
    for (const u of [0.04, 0.18, 0.33, 0.5, 0.64, 0.79, 0.92]) {
      const a = side(u, 4.6), b = side(u, -4.6);
      pole(a.x, a.z, 7); pole(b.x, b.z, 7);
      bunting(new V(a.x, Y + 6.8, a.z), new V(b.x, Y + 6.8, b.z), 0.8);
    }
    for (let k = 0; k < 24; k++) { const p = side(k / 24 + 0.012, k % 2 ? 4.9 : -4.9); pot(p.x, p.z, k % 3 ? '#c8553d' : '#e0a458', 0.9); }
    const SC = ['#e8404a', '#4d7cff', '#ffc845', '#2f9e55', '#f6f1e7'];
    for (let k = 0; k < 9; k++) {
      const p = side(0.05 + k * 0.105 + R() * 0.03, k % 2 ? 5.3 : -5.3), f = frame(p.x, p.z, Math.atan2(p.tx, p.tz) + Math.PI / 2);
      f.box(0.7, 0.45, 2.3, SC[k % 5], 0, 0.7, 0, 0.04);
      f.box(0.6, 0.12, 0.9, '#2d3a4f', 0, 1.1, -0.2, 0.02);
      f.box(0.1, 1.1, 0.12, METAL, 0, 0.7, 0.85, 0.02);
      f.box(1.0, 0.1, 0.1, METAL, 0, 1.75, 0.85, 0.02);
      for (const z of [-0.85, 0.85]) f.cyl(0.38, 0.38, 0.22, '#1d2533', 0, 0, z, 8, 0.02);
    }
    ['#ff6a4d', '#4d7cff', '#2f9e55', '#a25dd9'].forEach((shirt, i) => {
      const p = person({ shirt, pants: i % 2 ? '#26324a' : '#55607a' });
      p.scale.setScalar(S);
      group.add(p);
      const off = i % 2 ? 4.3 : -4.3, dirn = i % 2 ? -1 : 1, ph = i / 4;
      anim.push((dt, t) => {
        const u = (((ph + dirn * t * 0.0085) % 1) + 1) % 1, q = side(u, off);
        p.position.set(q.x, Y, q.z);
        p.rotation.y = Math.atan2(q.tx * dirn, q.tz * dirn);
        walk(p, t, i);
      });
    });
  }

  // ===== Parc : parterres, haies, bancs, aire de jeux, pique-nique, cerf-volant, canards =====
  const park = life.park;
  {
    const bed = (x, z, r = 3.2) => {
      const f = frame(x, z);
      f.cyl(r, r + 0.15, 0.4, '#cfc3a6', 0, 0, 0, 14, 0.04);
      f.cyl(r - 0.35, r - 0.35, 0.1, '#5f8f4a', 0, 0.4, 0, 14, 0);
      for (let k = 0; k < 15; k++) { const a = R() * 6.28, d = R() * (r - 0.8); f.ball(0.3 + R() * 0.15, FL[k % FL.length], Math.cos(a) * d, 0.7, Math.sin(a) * d, 0.02, 1.2); }
      f.ball(0.8, '#4f8f4a', 0, 1.0, 0, 0.04, 1.1, true);
      circ(x, z, r);
    };
    for (const [dx, dz] of [[-12, -8], [-12, 8], [12, 12], [30, 4], [-30, -10], [-44, 4]]) bed(park.x + dx, park.z + dz);
    const hedge = (x, z, len) => { frame(x, z).box(len, 1.5, 1.3, '#4f8f4a', 0, 0, 0, 0.05, true); circ(x, z, 1.4); };
    for (const s of [-1, 1]) { hedge(park.x + 9 * s, park.z - 3.8, 7); hedge(park.x + 9 * s, park.z + 3.8, 7); }
    const bench = (x, z, ry) => { const f = frame(x, z, ry); f.box(3.2, 0.24, 1, WOOD, 0, 0.95, 0, 0.04); f.box(3.2, 0.8, 0.2, WOOD, 0, 1.2, -0.45, 0.04); for (const dx of [-1.3, 1.3]) f.box(0.16, 0.95, 0.9, METAL, dx, 0, 0, 0.02); circ(x, z, 1.8); };
    bench(park.x - 15, park.z - 2.8, 0); bench(park.x + 15, park.z + 2.8, Math.PI); bench(park.x + 2.8, park.z + 12, -Math.PI / 2); bench(park.x - 2.8, park.z - 12, Math.PI / 2);
    bench(park.x + 40, park.z - 2.8, 0); bench(park.x - 40, park.z + 2.8, Math.PI);
    // Aire de jeux : portique à balançoires et toboggan.
    {
      const PG = { x: park.x - 38, z: park.z + 22 };
      const f = frame(PG.x, PG.z);
      for (const sx of [-3.4, 3.4]) for (const sz of [-1, 1]) f.cyl(0.12, 0.12, 4.2, '#e8404a', sx, 0, sz, 5, 0.02);
      f.box(7.2, 0.2, 0.2, '#e8404a', 0, 4.1, 0, 0.02);
      for (const sx of [-1.2, 1.2]) {
        const sw = new THREE.Group();
        sw.position.set(PG.x + sx, Y + 4.1, PG.z);
        for (const rx of [-0.45, 0.45]) sw.add(solid(new THREE.BoxGeometry(0.05, 3.3, 0.05).translate(rx, -1.65, 0), METAL, { outlineWidth: 0 }));
        sw.add(solid(new THREE.BoxGeometry(1.1, 0.14, 0.5).translate(0, -3.3, 0), '#ffc845', { outlineWidth: 0.02 }));
        group.add(sw);
        anim.push((dt, t) => { sw.rotation.x = Math.sin(t * 1.7 + sx) * 0.45; });
      }
      const g = frame(PG.x + 11, PG.z + 2, 0.6);
      g.box(1.6, 0.2, 1.6, '#4d7cff', 0, 2.4, 0, 0.02);
      for (const dx of [-0.7, 0.7]) g.cyl(0.07, 0.07, 2.4, METAL, dx, 0, -0.7, 4, 0);
      g.slab(1.2, 0.12, 3.6, '#ffc845', 0, 1.1, 2.4, 0.62, 0.02);
      for (const dx of [-0.6, 0.6]) g.slab(0.08, 0.35, 3.6, '#e8404a', dx, 1.2, 2.4, 0.62, 0.02);
      g.box(1.4, 0.3, 1.4, '#cfc3a6', 0, 0, 4, 0.02);
      circ(PG.x, PG.z, 4.5); circ(PG.x + 11, PG.z + 3, 3.5);
      const kid = stand('#ff8fb3', PG.x + 3, PG.z + 3.5, PG.x, PG.z, '#26324a', S * 0.62);
      const kid2 = stand('#4d7cff', PG.x + 8.4, PG.z + 6.8, PG.x + 11, PG.z + 2, '#55607a', S * 0.62);
      anim.push((dt, t) => { kid.position.y = Y + Math.abs(Math.sin(t * 3)) * 0.5; kid2.position.x = PG.x + 8.4 + Math.sin(t * 0.8) * 0.8; });
    }
    // Pique-nique : plaid, panier, deux personnes.
    {
      const PN = { x: park.x - 12, z: park.z + 20 };
      const f = frame(PN.x, PN.z, 0.3);
      f.box(5, 0.08, 4, '#e8404a', 0, 0, 0, 0);
      for (let k = 0; k < 5; k++) f.box(0.5, 0.1, 4, '#ffffff', -2 + k, 0, 0, 0);
      f.box(1.1, 0.7, 0.8, '#b98a56', 0.4, 0.08, 0.2, 0.03);
      f.cyl(0.25, 0.25, 0.7, '#4f9a48', -0.8, 0.08, -0.6, 6, 0.02);
      stand('#ffc845', PN.x - 3.2, PN.z + 0.4, PN.x, PN.z);
      stand('#a25dd9', PN.x + 3.1, PN.z - 1.0, PN.x, PN.z, '#26324a');
      circ(PN.x, PN.z, 3.2);
    }
    // Cerf-volant au bout d'un fil.
    {
      const KX = park.x + 8, KZ = park.z + 22;
      const p = stand('#2f9e55', KX, KZ, KX + 8, KZ - 6, '#26324a');
      p.userData.arms[1].rotation.x = -2.5;
      const kite = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshToonMaterial({ color: '#e8404a', side: THREE.DoubleSide }));
      kite.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1.4, 0, -0.9, 0, 0, 0, -1.2, 0, 0.9, 0, 0]), 3));
      kite.geometry.setIndex([0, 1, 2, 0, 2, 3]);
      kite.geometry.computeVertexNormals();
      group.add(kite);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new V(), new V()]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f6f1e7' }));
      line.frustumCulled = false;
      group.add(line);
      anim.push((dt, t) => {
        const kx = KX + 11 + Math.sin(t * 0.9) * 3, ky = Y + 15 + Math.sin(t * 1.3) * 1.5, kz = KZ - 8 + Math.cos(t * 0.7) * 2;
        kite.position.set(kx, ky, kz);
        kite.rotation.set(0.3, t * 0.3, Math.sin(t * 1.5) * 0.3);
        const a = lineGeo.attributes.position;
        a.setXYZ(0, KX, Y + 3.2, KZ); a.setXYZ(1, kx, ky, kz); a.needsUpdate = true;
      });
    }
    // Étang : roseaux, nénuphars, rochers, canards qui nagent.
    {
      const PX = park.x + 20, PZ = park.z - 9;
      const f = frame(PX, PZ);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * 6.28 + R() * 0.3, d = 6.2 + R() * 1.3;
        f.cyl(0.04, 0.05, 1.8 + R(), '#7a9a45', Math.cos(a) * d, 0, Math.sin(a) * d, 4, 0);
        if (k % 2) f.cyl(0.1, 0.1, 0.5, '#6b4a2f', Math.cos(a) * d, 1.6, Math.sin(a) * d, 5, 0.01);
      }
      for (let k = 0; k < 7; k++) { const a = R() * 6.28, d = 1 + R() * 4.5; kit.add(T(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 8), PX + Math.cos(a) * d, Y + 0.14, PZ + Math.sin(a) * d), '#3f9a52', 0); }
      for (const [dx, dz, r] of [[7.2, 2, 0.9], [-6.5, 3, 0.7], [-3, 7.2, 1.0]]) f.ball(r, '#9aa3ad', dx, r * 0.5, dz, 0.05, 0.7);
      for (let k = 0; k < 3; k++) {
        const d = new THREE.Group();
        d.add(solid(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.7, 1.4).translate(0, 0.35, 0), '#f6f1e7', { outlineWidth: 0.03 }));
        d.add(solid(new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.9, 0.6), k ? '#f6f1e7' : '#4f7a3a', { outlineWidth: 0.03 }));
        d.add(solid(new THREE.BoxGeometry(0.18, 0.08, 0.3).translate(0, 0.86, 0.95), '#ffb02e', { outlineWidth: 0 }));
        d.scale.setScalar(1.3);
        group.add(d);
        const rr = 2 + k * 1.3, sp = 0.35 + k * 0.1, ph = k * 2;
        anim.push((dt, t) => {
          const a = t * sp + ph;
          d.position.set(PX + Math.cos(a) * rr, Y + 0.1 + Math.sin(t * 3 + k) * 0.03, PZ + Math.sin(a) * rr);
          d.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
        });
      }
    }
  }

  // ===== Plage : tour de sauveteur, volley, barques, château de sable, buvette, mouettes =====
  {
    const n = poly.pts.length;
    const idxs = [];
    for (let i = 0; i < n; i++) { const p = poly.pts[i]; if (p.y < -462 && p.x > 300 && p.x < 480) idxs.push(i); }
    idxs.sort((a, b) => poly.pts[a].x - poly.pts[b].x);
    const cx = poly.pts.reduce((s, p) => s + p.x, 0) / n, cz = poly.pts.reduce((s, p) => s + p.y, 0) / n;
    const beach = idxs.map((i) => { const p = poly.pts[i]; const ox = p.x - cx, oz = p.y - cz, l = Math.hypot(ox, oz); return { x: p.x, z: p.y, ox: ox / l, oz: oz / l }; });
    // Hauteur du sable (relative à Y) à la distance d du bord : même pente que le maillage de la plage.
    const sandY = (d) => 0.08 - (Y - 0.17) * Math.min(1, Math.max(0, (d + 2) / 16));
    const at = (b, d, ry) => { const x = b.x + b.ox * d, z = b.z + b.oz * d; return { f: frame(x, z, ry), x, z, y: sandY(d) }; };
    beach.map((b, i) => ({ b, i })).filter((o) => o.i % 2 === 1).forEach(({ b }, k) => {
      const role = k % 5, ry = Math.atan2(b.ox, b.oz);
      if (role === 0) { // tour de sauveteur
        const { f, x, z, y } = at(b, 9, ry);
        for (const [px, pz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) f.cyl(0.12, 0.14, 3.2, '#ffffff', px, y, pz, 5, 0.02);
        f.box(3.4, 0.2, 3.4, WOOD, 0, y + 3.1, 0, 0.03);
        f.box(2.6, 1.8, 2.6, '#ffffff', 0, y + 3.3, 0, 0.05);
        f.box(1.4, 0.9, 0.1, '#4aa4de', 0, y + 3.9, 1.35, 0);
        f.cone(2.3, 1.1, '#e8404a', 0, y + 5.1, 0, 4, 0.05);
        f.cyl(0.05, 0.05, 2, '#ffffff', 1.2, y + 5, 1.2, 4, 0);
        f.box(0.9, 0.55, 0.05, '#e8404a', 1.6, y + 6.4, 1.2, 0);
        f.box(1.2, 0.2, 3.2, WOOD, 0, y, 3.4, 0.02);
        circ(x, z, 3.2);
      } else if (role === 1) { // filet de volley et deux joueurs
        const { f, x, z, y } = at(b, 8, ry);
        for (const px of [-4.2, 4.2]) f.cyl(0.1, 0.1, 3.6, '#ffffff', px, y, 0, 5, 0.02);
        f.box(8.4, 1.1, 0.06, '#f6f1e7', 0, y + 2.4, 0, 0);
        f.box(8.4, 0.12, 0.1, '#e8404a', 0, y + 3.5, 0, 0);
        f.ball(0.32, '#ffc845', 1, y + 3.4, 1.5, 0.02);
        circ(x, z, 5);
        for (const s of [-1, 1]) {
          const p = person({ shirt: s > 0 ? '#e8404a' : '#4d7cff', pants: '#f6f1e7' });
          p.scale.setScalar(S * 0.9);
          p.rotation.y = s > 0 ? ry + Math.PI : ry;
          group.add(p);
          const px = x + b.ox * s * 3.2, pz = z + b.oz * s * 3.2;
          anim.push((dt, t) => {
            const j = Math.max(0, Math.sin(t * 2.2 + (s > 0 ? 0 : Math.PI)));
            p.position.set(px, Y + y + j * 1.1, pz);
            p.userData.arms.forEach((a) => { a.rotation.x = Math.PI - 0.5 - j; });
          });
        }
      } else if (role === 2) { // barques tirées sur le sable
        for (const [d, off, col] of [[7, -2, '#2f6fe0'], [9.5, 3, '#e8404a']]) {
          const { x, z, y } = at(b, d, 0);
          const sh = new THREE.Shape();
          sh.moveTo(0, 3.2); sh.quadraticCurveTo(1.4, 1.5, 1.2, -2.2); sh.lineTo(-1.2, -2.2); sh.quadraticCurveTo(-1.4, 1.5, 0, 3.2);
          const rot = Math.atan2(b.ox, b.oz) + Math.PI / 2 + off * 0.12, bx = x - b.oz * off, bz = z + b.ox * off;
          kit.add(T(new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, 0.9, 0), bx, Y + y + 0.15, bz, rot), col, 0.05);
          kit.add(T(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).scale(0.8, 1, 0.82).translate(0, 0.95, 0), bx, Y + y + 0.2, bz, rot), '#f6f1e7', 0);
          circ(bx, bz, 2.4);
        }
      } else if (role === 3) { // château de sable et enfant
        const { f, x, z, y } = at(b, 7, ry);
        f.cyl(1.3, 1.6, 1.3, '#e8c88e', 0, y, 0, 8, 0.04);
        for (const [px, pz] of [[-1.6, 0], [1.6, 0], [0, 1.5], [0, -1.5]]) f.cyl(0.4, 0.55, 1.1, '#e8c88e', px, y, pz, 6, 0.03);
        f.cone(0.5, 0.9, '#e8c88e', 0, y + 1.3, 0, 6, 0.03);
        f.cyl(0.03, 0.03, 1.1, WOOD, 0, y + 2.1, 0, 4, 0);
        f.box(0.5, 0.3, 0.03, '#e8404a', 0.3, y + 2.9, 0, 0);
        f.cyl(0.35, 0.28, 0.4, '#e8404a', 2.4, y, 1.5, 7, 0.02);
        const kid = stand('#ffc845', x + 1.3, z + 3, x, z, '#2f6fe0', S * 0.62);
        kid.position.y = Y + y;
        circ(x, z, 2.6);
      } else { // buvette de plage rayée avec tabourets
        const { f, x, z, y } = at(b, 10, ry);
        f.box(4.6, 2.8, 3, '#f6f1e7', 0, y, 0, 0.05);
        f.box(5, 0.3, 3.4, '#4aa3df', 0, y + 2.8, 0, 0.04);
        for (let s = 0; s < 6; s++) f.slab(0.82, 0.12, 2, s % 2 ? '#ffffff' : '#ff6a4d', -2.05 + s * 0.82, y + 2.6, 2.3, 0.4);
        f.box(4.6, 0.12, 1, WOOD, 0, y + 1.2, 1.9, 0.03);
        for (const dx of [-1.5, 0, 1.5]) { f.cyl(0.3, 0.3, 0.12, '#e8404a', dx, y + 0.9, 3, 7, 0.02); f.cyl(0.05, 0.05, 0.9, METAL, dx, y, 3, 4, 0); }
        f.box(1.2, 0.8, 0.05, '#2f9e55', -1.1, y + 1.6, -1.52, 0);
        circ(x, z, 4);
      }
    });
    if (beach.length > 2) { // mouettes qui tournent au-dessus de la plage
      const mid = beach[Math.floor(beach.length / 2)];
      for (let k = 0; k < 6; k++) {
        const g = new THREE.Group();
        const wings = [-1, 1].map((s) => { const piv = new THREE.Group(); piv.add(solid(new THREE.BoxGeometry(1.5, 0.08, 0.5).translate(s * 0.75, 0, 0), '#ffffff', { outlineWidth: 0.02 })); g.add(piv); return piv; });
        g.add(solid(new THREE.IcosahedronGeometry(0.28, 0).scale(1, 0.8, 2), '#ffffff', { outlineWidth: 0.02 }));
        group.add(g);
        const rr = 14 + k * 5, sp = 0.25 + (k % 3) * 0.05, ph = k * 1.1, h = 14 + (k % 3) * 4;
        anim.push((dt, t) => {
          const a = t * sp + ph;
          g.position.set(mid.x + mid.ox * 14 + Math.cos(a) * rr, Y + h + Math.sin(t * 0.7 + k) * 1.2, mid.z + mid.oz * 14 + Math.sin(a) * rr * 0.6);
          g.rotation.y = Math.atan2(-Math.sin(a) * 0.6, Math.cos(a)) ;
          g.rotation.z = -0.25;
          const fl = Math.sin(t * 6 + k) * 0.5;
          wings[0].rotation.z = fl; wings[1].rotation.z = -fl;
        });
      }
    }
  }

  // ===== Supermarché : auvent rayé, cageots de fruits, pots, drapeaux =====
  {
    const sx = 500, sz = -352, f = frame(sx, sz);
    for (let s = 0; s < 14; s++) f.slab(1, 0.14, 3.4, s % 2 ? '#ffffff' : '#2f9e55', -6.5 + s, 4.6, 10.8, 0.35);
    for (const px of [-7, 7]) f.cyl(0.1, 0.1, 4.6, '#ffffff', px, 0, 12.3, 4, 0);
    for (let k = 0; k < 6; k++) {
      const x = -6 + k * 2.4;
      f.box(1.8, 0.9, 1.1, '#b98a56', x, 0, 12.6, 0.03);
      for (let j = 0; j < 4; j++) f.ball(0.25, ['#e8404a', '#ffc845', '#7bc043', '#ff8a3d', '#a25dd9'][(k + j) % 5], x - 0.6 + j * 0.4, 1.1, 12.5 + (j % 2) * 0.3, 0.02);
    }
    for (const sgn of [-1, 1]) pot(sx + sgn * 10, sz + 11.5, '#c8553d', 1.1);
    circ(sx, sz + 12.6, 8);
    for (const sgn of [-1, 1]) { f.cyl(0.12, 0.15, 11, '#9aa3ad', sgn * 19.5, 0, 9, 5, 0.02); f.box(0.1, 1.5, 2.6, sgn > 0 ? '#2f9e55' : '#ffc845', sgn * 19.5, 9.4, 10.4, 0); }
  }

  // ===== Végétation variée : massifs fleuris, cyprès, oliviers =====
  {
    const free = life.free;
    let placed = 0;
    for (let k = 0; k < 900 && placed < 110; k++) {
      const x = 170 + R() * 420, z = -485 + R() * 200;
      if (!free(x, z, 2)) continue;
      const kind = R(), f = frame(x, z, R() * 6);
      if (kind < 0.4) { // massif fleuri
        for (let j = 0; j < 3; j++) f.ball(0.8 + R() * 0.4, R() > 0.5 ? '#4f8f4a' : '#5f9e4f', (R() - 0.5) * 2, 0.8, (R() - 0.5) * 2, 0.04, 0.9, true);
        for (let j = 0; j < 6; j++) f.ball(0.22, FL[Math.floor(R() * FL.length)], (R() - 0.5) * 2.4, 1.3 + R() * 0.4, (R() - 0.5) * 2.4, 0);
        circ(x, z, 1.8);
      } else if (kind < 0.7) { // cyprès
        f.cyl(0.18, 0.25, 1, WOOD, 0, 0, 0, 5, 0.04);
        f.cone(0.95, 6 + R() * 3, '#3f7d45', 0, 0.8, 0, 6, 0.08, true);
        circ(x, z, 1.1);
      } else { // olivier tordu
        f.cyl(0.35, 0.5, 2.2, '#8a7358', 0, 0, 0, 5, 0.06);
        f.cyl(0.2, 0.3, 1.6, '#8a7358', 0.5, 1.8, 0.2, 5, 0.04);
        f.ball(1.7, '#8fa77a', 0.2, 3.5, 0, 0.08, 0.7, true);
        f.ball(1.2, '#7f9a6c', 1.5, 3.1, 0.7, 0.07, 0.7, true);
        f.ball(1.1, '#9ab487', -1.1, 3.0, -0.4, 0.07, 0.7, true);
        circ(x, z, 1.4);
      }
      placed++;
    }
  }

  kit.build(group);
}
