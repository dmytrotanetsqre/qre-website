/* ==========================================================================
   Blob: a calm voice-assistant style orb, drawn with Three.js.

   It is the source of assets/contact-blob.mp4 (tools/render-blob.mjs renders
   it frame by frame through blob-lab.html), and blob-lab.html tunes it live.
   The site itself does not import this file: the Contact art plays the mp4.

   One sphere whose vertices are pushed along their normals by three layers of
   smooth 4D simplex noise, a gentle breathing scale, a soft rim (fresnel) and
   a bright inner glow towards the upper left. Greys on black: the ASCII
   renderer (asciiArt in script.js) colours it.

   Seamless loop: every moving part is periodic over `loop` seconds. The noise
   time is a point on a circle (cos, sin of the loop phase) in two of the
   noise's four dimensions, each layer turning a whole number of times, and
   the breath is one sine per loop, so renderAt(loop) draws renderAt(0).

   createBlob(canvas, params) returns:
     renderAt(seconds)  draw the frame at that time (deterministic)
     start() / stop()   the normal animated mode (requestAnimationFrame)
     set(params)        change parameters (see DEFAULTS); redraws when still
     params             the current parameters (a copy)
     resize(w, h)       drawing buffer size in px (CSS size is left alone)
     onFrame            optional callback after every drawn frame
     dispose()
   ========================================================================== */

import * as THREE from './vendor/three.module.js';

export const DEFAULTS = Object.freeze({
  amount: 0.055, // noise displacement, as a share of the radius
  scale: 0.8,    // noise frequency over the unit sphere (lower = broader swells)
  speed: 0.55,   // how far the noise travels per loop (the circle's radius in noise space)
  rim: 0.9,      // fresnel rim strength
  glow: 1.4,     // inner glow strength (the bright side)
  size: 0.62,    // sphere diameter as a share of the frame height, before displacement and breath
  breath: 0.04,  // breathing scale, +/- this share, once per loop
  loop: 8,       // seconds; every motion repeats exactly after this
});

/* --------------------------------------------------------------------------
   Noise. 4D simplex noise from webgl-noise, unchanged apart from layout.
   -------------------------------------------------------------------------- */
const NOISE_GLSL = /* glsl */ `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0; }

float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0; }

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+10.0)*x);
}

float permute(float x) {
     return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float taylorInvSqrt(float r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec4 grad4(float j, vec4 ip)
  {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
  }

// (sqrt(5) - 1)/4 = F4, used once below
#define F4 0.309016994374947451

float snoise(vec4 v)
  {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

// First corner
  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

// Other corners

// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
//  i0.x = dot( isX, vec3( 1.0 ) );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  // i0 now contains the unique values 0,1,2,3 in each channel
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  //  x0 = x0 - 0.0 + 0.0 * C.xxxx
  //  x1 = x0 - i1  + 1.0 * C.xxxx
  //  x2 = x0 - i2  + 2.0 * C.xxxx
  //  x3 = x0 - i3  + 3.0 * C.xxxx
  //  x4 = x0 - 1.0 + 4.0 * C.xxxx
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

// Permutations
  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

// Gradients: 7x7x6 points over a cube, mapped onto a 4-cross polytope
// 7*7*6 = 294, which is close to the ring size 17*17 = 289.
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

// Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

// Mix contributions from the five corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

  }
`;

/* --------------------------------------------------------------------------
   Shaders (ours). uPhase is the loop phase, 0 to 2 pi.
   -------------------------------------------------------------------------- */
const SHARED_GLSL = /* glsl */ `
uniform float uPhase;
uniform float uAmount;
uniform float uScale;
uniform float uSpeed;

// One layer: the sphere point scaled into noise space, plus a circle of
// radius uSpeed in (one spatial axis, w), turned k times per loop. A whole
// number of turns brings every layer back to where it started.
float layer(vec3 p, float freq, vec3 offset, float k, float phase0, vec3 axis) {
  float a = uPhase * k + phase0;
  vec3 q = p * uScale * freq + offset + axis * (sin(a) * uSpeed);
  return snoise(vec4(q, cos(a) * uSpeed));
}

// Three slow layers: broad swells, then two finer, weaker ones.
float field(vec3 n) {
  float f = layer(n, 1.0, vec3(0.0), 1.0, 0.0, vec3(0.0, 0.0, 1.0));
  f += 0.38 * layer(n, 1.7, vec3(17.3, -4.1, 9.7), 1.0, 2.1, vec3(1.0, 0.0, 0.0));
  f += 0.12 * layer(n, 2.6, vec3(-31.7, 12.9, 5.3), 2.0, 4.4, vec3(0.0, 1.0, 0.0));
  return f / 1.5;
}
`;

const VERTEX = /* glsl */ `
${NOISE_GLSL}
${SHARED_GLSL}
uniform float uRadius;
uniform float uBreath;

varying vec3 vNormal;
varying vec3 vView;
varying vec3 vSphere;
varying vec3 vRound;

vec3 displaced(vec3 n) {
  return n * (1.0 + uAmount * field(n));
}

void main() {
  vec3 n = normalize(position);
  vec3 up = abs(n.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(up, n));
  vec3 b = cross(n, t);
  const float e = 0.012;

  vec3 p = displaced(n);
  vec3 pt = displaced(normalize(n + t * e));
  vec3 pb = displaced(normalize(n + b * e));
  vec3 nrm = normalize(cross(pt - p, pb - p));
  if (dot(nrm, n) < 0.0) nrm = -nrm;

  float scale = uRadius * (1.0 + uBreath * sin(uPhase));
  vec4 world = modelMatrix * vec4(p * scale, 1.0);
  vec4 view = viewMatrix * world;
  vNormal = normalize(normalMatrix * nrm);
  vView = -view.xyz;
  vSphere = n;
  vRound = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * view;
}
`;

const FRAGMENT = /* glsl */ `
${NOISE_GLSL}
${SHARED_GLSL}
uniform float uRim;
uniform float uGlow;

varying vec3 vNormal;
varying vec3 vView;
varying vec3 vSphere;
varying vec3 vRound;

void main() {
  vec3 N = normalize(vNormal);
  // The undisplaced sphere's normal: the glow lives inside, so it follows the
  // round body more than the undulating skin.
  vec3 R = normalize(mix(normalize(vRound), N, 0.3));
  vec3 V = normalize(vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);

  // Key light from the upper left, wrapped so the dark side never goes flat.
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  float body = 0.015 + 0.16 * wrap * wrap * wrap;

  // Inner glow: a soft core towards the upper left, seen through the surface,
  // stirred a little by the same slow, periodic noise.
  vec3 G = normalize(vec3(-0.42, 0.36, 0.83));
  float toward = clamp(dot(R, G), 0.0, 1.0);
  float stir = 0.82 + 0.18 * layer(vSphere, 1.4, vec3(4.2, 8.8, -2.6), 1.0, 1.3, vec3(0.0, 1.0, 0.0));
  float core = uGlow * pow(toward, 5.0) * stir * (0.5 + 0.5 * ndv);

  // A soft sheen where the key light reflects.
  vec3 H = normalize(L + V);
  float sheen = 0.22 * pow(clamp(dot(N, H), 0.0, 1.0), 36.0);

  // Fresnel rim, strongest just inside the outline, on the side away from the light.
  float fres = pow(1.0 - ndv, 2.2);
  float away = 0.55 + 0.45 * clamp(-dot(N.xy, L.xy) * 1.4, 0.0, 1.0);
  float rim = uRim * fres * away * smoothstep(0.0, 0.22, ndv);

  // The outline itself sinks to black, so the orb sits in the background.
  float edge = smoothstep(0.0, 0.16, ndv);
  float v = (body + core + sheen) * edge + rim;

  // Soft shoulder: highlights approach white without clipping flat.
  v = 1.0 - exp(-1.9 * v);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`;

export function createBlob(canvas, params = {}) {
  const current = Object.assign({}, DEFAULTS, params);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    // asciiArt and the frame export read the canvas after the frame is drawn.
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  // Frustum half-height 1 at the origin: a sphere of radius r covers r of the frame height.
  const FOV = 20;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  camera.lookAt(0, 0, 0);

  const uniforms = {
    uPhase: { value: 0 },
    uAmount: { value: 0 },
    uScale: { value: 1 },
    uSpeed: { value: 0 },
    uRadius: { value: 0.5 },
    uBreath: { value: 0 },
    uRim: { value: 0 },
    uGlow: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const geometry = new THREE.IcosahedronGeometry(1, 72);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let frame = 0;
  let startedAt = 0;
  let lastTime = 0;
  const api = {
    onFrame: null,
    get params() {
      return Object.assign({}, current);
    },
    get running() {
      return frame !== 0;
    },
    set,
    renderAt,
    start,
    stop,
    resize,
    dispose,
  };

  function applyUniforms() {
    uniforms.uAmount.value = current.amount;
    uniforms.uScale.value = current.scale;
    uniforms.uSpeed.value = current.speed;
    uniforms.uRadius.value = current.size;
    uniforms.uBreath.value = current.breath;
    uniforms.uRim.value = current.rim;
    uniforms.uGlow.value = current.glow;
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!frame) renderAt(lastTime);
  }

  /** Draw the frame at `seconds` into the loop. Same input, same picture. */
  function renderAt(seconds) {
    lastTime = seconds;
    const loop = current.loop > 0 ? current.loop : DEFAULTS.loop;
    const t = ((seconds % loop) + loop) % loop;
    uniforms.uPhase.value = (t / loop) * Math.PI * 2;
    renderer.render(scene, camera);
    if (typeof api.onFrame === 'function') api.onFrame(seconds);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    renderAt((now - startedAt) / 1000);
  }

  function start() {
    if (frame) return;
    startedAt = performance.now() - lastTime * 1000;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function set(next) {
    Object.assign(current, next);
    applyUniforms();
    if (!frame) renderAt(lastTime);
  }

  function dispose() {
    stop();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }

  applyUniforms();
  resize(canvas.width || 640, canvas.height || 484);
  return api;
}
