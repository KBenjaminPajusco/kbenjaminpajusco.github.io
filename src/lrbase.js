import * as THREE from 'three';

// La base La Roche-Posay Racing Team, reprise telle quelle de mon monde Pajusco World (Bagnoli) : le Shed, la Sim room,
// l'hospitality vitrée, les grues, l'AC75 sur son ber, le quai et tout son mobilier. Cuite d'avance en un petit
// binaire (assets/lrprt/base.json + base.bin, une quarantaine de maillages déjà fusionnés), chargée sans rien
// reconstruire. Repère d'origine : x le long du quai, z vers la mer, quai en z = 0, dessus du quai à 1,4 m.

const TYPES = { Float32Array, Int8Array, Uint8Array, Uint16Array, Uint32Array };
const QUAY_TOP = 1.4;

// Rampe 3 tons du portfolio (toon.js), pour que la base ait le même cel shading que le reste de l'île.
const gradient = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

// at : où poser l'origine du quai (x, z) ; top : hauteur du quai du portfolio ; scale : la base réelle fait 170 m.
export async function loadLRBase(root, { at, top, scale = 0.75, url = 'assets/lrprt/base' }) {
  const man = await fetch(url + '.json').then((r) => r.json());
  const buf = await fetch(url + '.bin?v=' + encodeURIComponent(man.packedAt || man.bakedAt)).then((r) => r.arrayBuffer());
  const view = (i) => { const v = man.views[i]; return new TYPES[v.type](buf, v.offset, v.length); };
  const loader = new THREE.TextureLoader();
  const textures = man.textures.map((t) => {
    const tex = loader.load(t.url);
    Object.assign(tex, { wrapS: t.wrapS, wrapT: t.wrapT, rotation: t.rotation, magFilter: t.magFilter, minFilter: t.minFilter,
      colorSpace: t.colorSpace, flipY: t.flipY, generateMipmaps: t.generateMipmaps });
    tex.repeat.fromArray(t.repeat); tex.offset.fromArray(t.offset);
    return tex;
  });
  const materials = man.materials.map((d) => {
    const common = { color: d.color, opacity: d.opacity, transparent: d.transparent, alphaTest: d.alphaTest, side: d.side,
      vertexColors: d.vertexColors, depthWrite: d.depthWrite, polygonOffset: d.polygonOffset,
      polygonOffsetFactor: d.polygonOffsetFactor, polygonOffsetUnits: d.polygonOffsetUnits };
    const m = d.type === 'LineBasicMaterial' ? new THREE.LineBasicMaterial(common)
      : d.type === 'MeshBasicMaterial' ? new THREE.MeshBasicMaterial(common)
      : new THREE.MeshToonMaterial({ ...common, gradientMap: gradient });
    if (d.emissive && m.emissive) { m.emissive.setHex(d.emissive); m.emissiveIntensity = d.emissiveIntensity; }
    if (d.map >= 0) m.map = textures[d.map];
    if (d.alphaMap >= 0) m.alphaMap = textures[d.alphaMap];
    return m;
  });

  const g = new THREE.Group();
  g.name = 'base-lrprt';
  g.position.set(at.x, top - QUAY_TOP * scale, at.z);
  g.scale.setScalar(scale);
  for (const e of man.meshes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(view(e.pos), 3));
    if (e.nor !== undefined) geo.setAttribute('normal', new THREE.BufferAttribute(view(e.nor), 3, true));
    if (e.col !== undefined) geo.setAttribute('color', new THREE.BufferAttribute(view(e.col), 3, true));
    if (e.uv !== undefined) geo.setAttribute('uv', new THREE.BufferAttribute(view(e.uv), 2));
    geo.setIndex(new THREE.BufferAttribute(view(e.idx), 1));
    let mesh;
    if (e.line) mesh = new THREE.LineSegments(geo, materials[e.mat]);
    else if (e.inst !== undefined) {
      mesh = new THREE.InstancedMesh(geo, materials[e.mat], e.count);
      mesh.instanceMatrix = new THREE.InstancedBufferAttribute(view(e.inst), 16);
      if (e.ic !== undefined) { const c = view(e.ic); mesh.instanceColor = new THREE.InstancedBufferAttribute(Float32Array.from(c, (x) => x / 255), 3); }
      mesh.computeBoundingSphere();
    } else mesh = new THREE.Mesh(geo, materials[e.mat]);
    [mesh.castShadow, mesh.receiveShadow] = e.shadow || [false, false];
    mesh.matrixAutoUpdate = false;
    g.add(mesh);
  }
  // Le sol de la base : la grande dalle de World est retirée à la cuisson ; on la redessine à la forme de l'emprise
  // (man.pad : bord de quai droit, le reste arrondi), en dalle de béton un peu épaisse posée sur le sable.
  if (man.pad) {
    const shape = new THREE.Shape(man.pad.map(([x, z]) => new THREE.Vector2(x, -z)));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.6, bevelSegments: 2, curveSegments: 4 })
      .rotateX(-Math.PI / 2).translate(0, QUAY_TOP - 0.63, 0);
    const pad = new THREE.Mesh(slab, new THREE.MeshToonMaterial({ color: '#c9c6bd', gradientMap: gradient }));
    pad.receiveShadow = true;
    g.add(pad);
  }
  g.updateMatrixWorld(true);
  root.add(g);
  return g;
}
