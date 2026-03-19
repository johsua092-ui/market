/* scene.js — Three.js 3D Background */
(function(){
  if(typeof THREE === 'undefined') return;

  const canvas = document.getElementById('bgCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;

  // Colors
  const C = {
    cyan:   0x00ffe7,
    purple: 0x7c3fff,
    red:    0xff003c,
    white:  0xd8e8f0,
  };

  // === PARTICLE FIELD ===
  const partCount = 1200;
  const positions = new Float32Array(partCount * 3);
  const colors    = new Float32Array(partCount * 3);
  const sizes     = new Float32Array(partCount);

  const colPalette = [
    new THREE.Color(0x00ffe7),
    new THREE.Color(0x7c3fff),
    new THREE.Color(0xff003c),
    new THREE.Color(0x0066ff),
  ];

  for (let i = 0; i < partCount; i++) {
    positions[i*3]   = (Math.random()-0.5) * 120;
    positions[i*3+1] = (Math.random()-0.5) * 120;
    positions[i*3+2] = (Math.random()-0.5) * 80;
    const c = colPalette[Math.floor(Math.random()*colPalette.length)];
    colors[i*3]   = c.r;
    colors[i*3+1] = c.g;
    colors[i*3+2] = c.b;
    sizes[i] = Math.random() * 1.5 + 0.3;
  }

  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  partGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  partGeo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const partMat = new THREE.PointsMaterial({
    size: 0.25,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  // === FLOATING WIREFRAME SHAPES ===
  const shapes = [];

  function createShape(geo, color, x, y, z, scl) {
    const mat = new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: true, opacity: 0.12
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scl);
    mesh.userData = {
      rotX: (Math.random()-0.5)*0.008,
      rotY: (Math.random()-0.5)*0.01,
      rotZ: (Math.random()-0.5)*0.006,
      floatY: Math.random()*Math.PI*2,
      floatSpeed: 0.003 + Math.random()*0.003,
      floatAmp: 0.5 + Math.random()*0.8,
      originY: y,
    };
    scene.add(mesh);
    shapes.push(mesh);
    return mesh;
  }

  // Icosahedrons
  createShape(new THREE.IcosahedronGeometry(1,0), C.cyan,   -22, 8, -10, 5);
  createShape(new THREE.IcosahedronGeometry(1,0), C.purple,  18,-6, -15, 4);
  createShape(new THREE.IcosahedronGeometry(1,0), C.red,     -12,-10,-8, 3);
  createShape(new THREE.IcosahedronGeometry(1,0), C.cyan,     20, 12,-20, 6);
  createShape(new THREE.IcosahedronGeometry(1,0), C.white,    0, -15,-12, 4.5);

  // Octahedrons
  createShape(new THREE.OctahedronGeometry(1,0), C.purple,  -18,-4,-18, 4);
  createShape(new THREE.OctahedronGeometry(1,0), C.cyan,      8, 15,-14, 3.5);
  createShape(new THREE.OctahedronGeometry(1,0), C.red,      -6,  6,-20, 5);

  // Tetrahedrons
  createShape(new THREE.TetrahedronGeometry(1,0), C.cyan,    14,-12,-10, 3);
  createShape(new THREE.TetrahedronGeometry(1,0), C.purple, -15, 14,-16, 4);

  // TorusKnot (center piece, subtle)
  const tkGeo = new THREE.TorusKnotGeometry(3, 0.8, 80, 8);
  const tkMat = new THREE.MeshBasicMaterial({
    color: 0x00ffe7, wireframe: true, transparent: true, opacity: 0.04
  });
  const torusKnot = new THREE.Mesh(tkGeo, tkMat);
  torusKnot.position.set(0, 0, -25);
  scene.add(torusKnot);

  // === CONNECTING LINES ===
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(300*3); // 100 lines × 2 points × 3 coords
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00ffe7, transparent: true, opacity: 0.04
  });
  const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lineSegments);

  // === MOUSE INTERACTION ===
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // === RESIZE ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // === ANIMATION LOOP ===
  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    frame++;

    // Smooth camera follow mouse
    targetX += (mouseX * 2 - targetX) * 0.04;
    targetY += (-mouseY * 1.5 - targetY) * 0.04;
    camera.position.x = targetX;
    camera.position.y = targetY;
    camera.lookAt(scene.position);

    // Rotate particles slowly
    particles.rotation.y += 0.0003;
    particles.rotation.x += 0.0001;

    // Torus knot
    torusKnot.rotation.x += 0.003;
    torusKnot.rotation.y += 0.004;

    // Animate shapes
    shapes.forEach(m => {
      m.rotation.x += m.userData.rotX;
      m.rotation.y += m.userData.rotY;
      m.rotation.z += m.userData.rotZ;
      m.userData.floatY += m.userData.floatSpeed;
      m.position.y = m.userData.originY + Math.sin(m.userData.floatY) * m.userData.floatAmp;
    });

    // Update connecting lines (every 3 frames for perf)
    if (frame % 3 === 0) {
      const ppos = partGeo.attributes.position.array;
      let li = 0;
      for (let i = 0; i < 50 && li < 298; i++) {
        const idx = (i * 24) % partCount;
        linePositions[li*3]   = ppos[idx*3];
        linePositions[li*3+1] = ppos[idx*3+1];
        linePositions[li*3+2] = ppos[idx*3+2];
        const idx2 = (idx + 1) % partCount;
        linePositions[li*3+3] = ppos[idx2*3];
        linePositions[li*3+4] = ppos[idx2*3+1];
        linePositions[li*3+5] = ppos[idx2*3+2];
        li += 2;
      }
      lineGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  animate();
})();
