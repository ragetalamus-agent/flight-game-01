// three.js scene for Tradewind Courier.
//
// Builds sky, sun directional light + hemisphere light, fog, ocean surface,
// terrain mesh from the world's height data, runway strip with markings,
// glowing torus rings, clouds and a camera rig (chase camera behind/above the
// plane plus a cockpit camera at the nose). Provides a renderer object that
// draws a frame from the current game state.
//
// Runtime test comes in session S4 (main.js does not exist yet); this session
// only parse-checks the module.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

const SKY = new THREE.Color(PALETTE.sky);
const OCEAN = new THREE.Color(PALETTE.ocean);
const SAND = new THREE.Color(PALETTE.sand);
const GRASS = new THREE.Color(PALETTE.grass);
const ROCK = new THREE.Color(PALETTE.rock);

function terrainColor(h) {
  if (h < 1) return SAND;
  if (h < 10) return GRASS;
  return ROCK;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 400, 2400);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x446688, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(800, 700, 500);
  sun.castShadow = true;
  scene.add(sun);

  // Ocean surface.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000, 60, 60),
    new THREE.MeshStandardMaterial({ color: OCEAN, roughness: 0.6, metalness: 0.1 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.receiveShadow = true;
  scene.add(ocean);

  const chaseCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 1, 6000);
  const cockpitCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.2, 6000);
  let activeCamera = chaseCamera;
  let time = 0;

  const cloudMeshes = [];
  const ringMeshes = [];

  function setSize(w, h) {
    renderer.setSize(w, h);
    chaseCamera.aspect = w / h;
    cockpitCamera.aspect = w / h;
    chaseCamera.updateProjectionMatrix();
    cockpitCamera.updateProjectionMatrix();
  }

  function buildClouds() {
    for (const m of cloudMeshes) scene.remove(m);
    cloudMeshes.length = 0;
    for (let i = 0; i < 14; i += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(22 + Math.random() * 30, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
      );
      puff.position.set(
        (Math.random() - 0.5) * 5000,
        300 + Math.random() * 400,
        (Math.random() - 0.5) * 5000
      );
      puff.scale.set(1, 0.5, 1);
      scene.add(puff);
      cloudMeshes.push(puff);
    }
  }

  function buildWorldMeshes(world) {
    // Remove previous rings.
    for (const m of ringMeshes) scene.remove(m);
    ringMeshes.length = 0;

    const res = 48;
    const size = WORLD.oceanSize;
    const geom = new THREE.PlaneGeometry(size, size, res, res);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = world.heightAt(x, z);
      pos.setY(i, h);
      color.copy(terrainColor(h));
      colors.push(color.r, color.g, color.b);
    }
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geom.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
    );
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);

    // Runway strip + centreline markings.
    const r = world.runway;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(r.length, r.width),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.9 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(r.position.x, 0.05, r.position.z);
    strip.rotation.y = r.heading;
    strip.receiveShadow = true;
    scene.add(strip);
    const dashGeo = new THREE.PlaneGeometry(10, 1.4);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -r.length / 2 + 10; i < r.length / 2; i += 20) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(i, 0.06, 0);
      strip.add(dash);
    }

    // Glowing torus rings with bobbing + glow animation state.
    for (const ring of world.rings) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(ring.radius, 2.5, 16, 32), material);
      torus.position.copy(ring.position);
      torus.rotation.x = Math.PI / 2;
      torus.userData = { baseY: ring.position.y, material, phase: Math.random() * Math.PI * 2 };
      scene.add(torus);
      ringMeshes.push(torus);
    }

    buildClouds();
    return { terrain, strip };
  }

  function animateRings(dt) {
    time += dt;
    for (const torus of ringMeshes) {
      const u = torus.userData;
      const bob = Math.sin(time * 2.5 + u.phase) * 1.5;
      torus.position.y = u.baseY + bob;
      torus.rotation.z = time * 1.5;
      // MeshBasicMaterial has no emissive channel, so pulse the base colour.
      const glow = 0.5 + 0.5 * Math.sin(time * 4 + u.phase);
      u.material.color.setRGB(1, 0.7 + 0.3 * glow, 0.1 * glow);
    }
  }

  function render({ planeGroup, cameraMode = 'chase', world, dt = 0 }) {
    animateRings(dt);
    if (planeGroup) {
      const offset = new THREE.Vector3(-120, 70, 0);
      const look = new THREE.Vector3(30, 0, 0);
      const worldOffset = offset.clone().applyQuaternion(planeGroup.quaternion);
      chaseCamera.position.copy(planeGroup.position).add(worldOffset);
      chaseCamera.lookAt(planeGroup.position.clone().add(look.clone().applyQuaternion(planeGroup.quaternion)));
      // Cockpit camera further forward so the nose cone fills the lower view,
      // hiding the ocean/terrain z-fighting at the horizon.
      const noseOffset = new THREE.Vector3(15, 4, 0).applyQuaternion(planeGroup.quaternion);
      cockpitCamera.position.copy(planeGroup.position).add(noseOffset);
      cockpitCamera.lookAt(planeGroup.position.clone().add(new THREE.Vector3(45, 0, 0).applyQuaternion(planeGroup.quaternion)));
    }
    activeCamera = cameraMode === 'cockpit' ? cockpitCamera : chaseCamera;
    renderer.render(scene, activeCamera);
  }

  function dispose() {
    renderer.dispose();
    for (const m of cloudMeshes) scene.remove(m);
    cloudMeshes.length = 0;
    for (const m of ringMeshes) scene.remove(m);
    ringMeshes.length = 0;
  }

  return { renderer, scene, chaseCamera, cockpitCamera, setSize, buildWorldMeshes, render, dispose };
}
