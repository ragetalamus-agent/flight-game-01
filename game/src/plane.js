// Aircraft for Tradewind Courier, built from three.js primitives so it looks
// built rather than a box: fuselage, nose cone, tail cone, wings with ailerons,
// tail fin with rudder, horizontal stabiliser with elevator, spinning
// propeller, landing gear, red/green/white navigation lights and a cockpit
// canopy.
//
// Runs in Node (no DOM, no WebGL renderer) — it only builds geometry objects.
import * as THREE from 'three';

const BODY = 0xd94f3d;
const ACCENT = 0xf2c94c;
const WING = 0xea8a4c;
const GLASS = 0x8cc3e0;
const LIGHT_R = 0xff0000;
const LIGHT_G = 0x00ff00;
const LIGHT_W = 0xffffff;
const GEAR = 0x444444;

export function buildPlane() {
  const group = new THREE.Group();
  group.name = 'plane';

  const matBody = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.4, metalness: 0.2 });
  const matAccent = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.3, metalness: 0.1 });
  const matWing = new THREE.MeshStandardMaterial({ color: WING, roughness: 0.5, metalness: 0.1 });
  const matGlass = new THREE.MeshStandardMaterial({ color: GLASS, transparent: true, opacity: 0.35, metalness: 0 });
  const matLight = (c) => new THREE.MeshBasicMaterial({ color: c });
  const matGear = new THREE.MeshStandardMaterial({ color: GEAR, roughness: 0.6, metalness: 0.1 });

  // Fuselage (points along +x, the aircraft's forward direction).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 34, 12), matBody);
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);

  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(3.2, 10, 12), matBody);
  nose.rotation.z = Math.PI / 2;
  nose.position.x = 19;
  group.add(nose);

  // Tail cone.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 10, 12), matBody);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -17;
  group.add(tail);

  // Wings.
  const wings = new THREE.Mesh(new THREE.BoxGeometry(70, 1.6, 8), matWing);
  wings.position.y = -0.2;
  group.add(wings);
  const wingTop = new THREE.Mesh(new THREE.BoxGeometry(64, 0.6, 6), matAccent);
  wingTop.position.y = 1.0;
  group.add(wingTop);

  // Ailerons (control surfaces) at the wing tips. userData marks them for
  // input-driven deflection.
  const ailerons = [];
  for (const sx of [-1, 1]) {
    const ail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 8), matAccent);
    ail.position.set(sx * 28, -0.45, 0);
    ail.userData = { kind: 'aileron', side: sx, maxDeflection: 0.35, deflection: 0 };
    group.add(ail);
    ailerons.push(ail);
  }

  // Tail fin (vertical stabiliser) + rudder.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 12), matBody);
  fin.position.set(-13, 5.5, 0);
  group.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12), matAccent);
  rudder.position.set(-13, 5.5, 0.6);
  rudder.userData = { kind: 'rudder', maxDeflection: 0.4, deflection: 0 };
  group.add(rudder);

  // Horizontal stabiliser + elevator.
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 5), matBody);
  hstab.position.set(-15, 2.6, 0);
  group.add(hstab);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 5), matAccent);
  elevator.position.set(-15, 2.9, 0.55);
  elevator.userData = { kind: 'elevator', maxDeflection: 0.4, deflection: 0 };
  group.add(elevator);

  // Spinning propeller at the nose.
  const propHub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 12), matAccent);
  propHub.rotation.z = Math.PI / 2;
  propHub.position.x = 23.5;
  group.add(propHub);
  const propeller = new THREE.Mesh(new THREE.BoxGeometry(36, 0.5, 2.5), matAccent);
  propeller.position.x = 23.5;
  propeller.rotation.x = Math.PI / 2;
  propeller.userData = { kind: 'propeller', spin: 0 };
  group.add(propeller);

  // Landing gear: two main wheels plus a nose wheel.
  const gear = [];
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.5, 8), matGear);
    strut.position.set(sx * 9, -2.8, 0);
    strut.rotation.z = Math.PI / 2;
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 12), matGear);
    wheel.position.set(sx * 9, -5.0, 0);
    group.add(wheel);
    gear.push({ strut, wheel });
  }
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), matGear);
  noseStrut.position.set(16, -2.6, 0);
  noseStrut.rotation.z = Math.PI / 2;
  group.add(noseStrut);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 10), matGear);
  noseWheel.position.set(16, -5.0, 0);
  group.add(noseWheel);

  // Cockpit canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), matGlass);
  canopy.position.set(2, 1.6, 0);
  canopy.scale.set(1, 0.7, 1);
  group.add(canopy);

  // Navigation lights: red (right), green (left), white (top).
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), matLight(LIGHT_R));
  navR.position.set(35, 0.6, 2);
  group.add(navR);
  const navG = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), matLight(LIGHT_G));
  navG.position.set(-35, 0.6, 2);
  group.add(navG);
  const navW = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), matLight(LIGHT_W));
  navW.position.set(0, 6.2, 0);
  group.add(navW);

  return {
    group,
    fuselage,
    nose,
    propeller,
    ailerons,
    elevator,
    rudder,
    gear,
    wings,
  };
}
