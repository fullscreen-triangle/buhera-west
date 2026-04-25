/**
 * Terrain GPU Shaders
 *
 * Vertex shader:  fBm displacement, circular clip mask, world normals.
 * Fragment shader: Partition-based material classification, PBR lighting,
 *                  water, atmospheric scattering, circular clip + edge glow,
 *                  directional laser beams (N/S/E/W encoding).
 */

// ─── shared noise (Ashima simplex 3D, MIT) ──────────────────────────

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float fbm(vec3 p, int octaves, float lacunarity, float gain){
  float sum = 0.0, amp = 1.0, freq = 1.0, norm = 0.0;
  for(int i = 0; i < 12; i++){
    if(i >= octaves) break;
    sum += amp * snoise(p * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
`;

// ─── vertex shader ──────────────────────────────────────────────────

export const terrainVertexShader = /* glsl */ `
${NOISE_GLSL}

uniform float u_amplitude;
uniform float u_frequency;
uniform int   u_octaves;
uniform float u_lacunarity;
uniform float u_gain;
uniform float u_time;
uniform vec2  u_offset;
uniform float u_waterLevel;
uniform float u_radius;           // clipping radius
uniform float u_useHeightmap;     // 0 = procedural, 1 = real
uniform sampler2D u_heightmap;    // Float32 heightmap texture

varying vec3  vWorldPosition;
varying vec3  vWorldNormal;
varying float vElevation;
varying float vSlope;
varying vec2  vUv;
varying float vRadialDist;       // 0 at center, 1 at edge

// sample normalised heightmap at plane (x, y).
// plane [-radius, +radius] maps to uv [0, 1].
float sampleHM(vec2 planeXY){
  vec2 uv = vec2(
    (planeXY.x + u_radius) / (2.0 * u_radius),
    1.0 - (planeXY.y + u_radius) / (2.0 * u_radius)
  );
  return texture2D(u_heightmap, uv).r;
}

void main(){
  vUv = uv;

  float r = length(position.xy);
  vRadialDist = r / u_radius;
  float edgeFade = smoothstep(1.0, 0.92, vRadialDist);

  float h;
  float hR;
  float hU;
  float eps;

  if (u_useHeightmap > 0.5) {
    // ── real-world heightmap branch ──
    eps = 0.05;
    h  = sampleHM(position.xy)                       * edgeFade;
    hR = sampleHM(position.xy + vec2(eps, 0.0))      * edgeFade;
    hU = sampleHM(position.xy + vec2(0.0, eps))      * edgeFade;
  } else {
    // ── procedural fBm branch ──
    vec3 sp = vec3(
      position.x * u_frequency + u_offset.x,
      position.y * u_frequency + u_offset.y,
      u_time * 0.008
    );

    h = fbm(sp, u_octaves, u_lacunarity, u_gain);
    h = h * 0.5 + 0.5;
    float ridge = 1.0 - abs(snoise(sp * 2.0));
    ridge *= ridge;
    h = mix(h, ridge, 0.35);
    float plateau = snoise(sp * 0.3) * 0.5 + 0.5;
    h = mix(h, floor(h * 6.0) / 6.0, plateau * 0.15);
    h *= edgeFade;

    eps = 0.005;
    vec3 spR = sp + vec3(eps, 0, 0);
    vec3 spU = sp + vec3(0, eps, 0);
    hR = (fbm(spR, u_octaves, u_lacunarity, u_gain) * 0.5 + 0.5);
    hU = (fbm(spU, u_octaves, u_lacunarity, u_gain) * 0.5 + 0.5);
    hR = mix(hR, pow(1.0 - abs(snoise(spR * 2.0)), 2.0), 0.35) * edgeFade;
    hU = mix(hU, pow(1.0 - abs(snoise(spU * 2.0)), 2.0), 0.35) * edgeFade;
  }

  vElevation = h;

  vec3 displaced = position;
  displaced.y += h * u_amplitude;

  // normal via finite differences
  vec3 tangent  = normalize(vec3(eps, (hR - h) * u_amplitude, 0.0));
  vec3 binormal = normalize(vec3(0.0, (hU - h) * u_amplitude, eps));
  vec3 n = normalize(cross(tangent, binormal));

  vWorldNormal = normalize(normalMatrix * n);
  vSlope = 1.0 - abs(dot(n, vec3(0.0, 1.0, 0.0)));

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// ─── fragment shader ────────────────────────────────────────────────

export const terrainFragmentShader = /* glsl */ `
${NOISE_GLSL}

uniform float u_amplitude;
uniform float u_waterLevel;
uniform float u_time;
uniform vec3  u_sunDirection;
uniform vec3  u_sunColor;
uniform float u_sunIntensity;
uniform vec3  u_cameraPosition;
uniform float u_wireframe;
uniform float u_radius;

varying vec3  vWorldPosition;
varying vec3  vWorldNormal;
varying float vElevation;
varying float vSlope;
varying vec2  vUv;
varying float vRadialDist;

// ── material classification ──────────────────────────────────────

struct Mat {
  vec3  albedo;
  float roughness;
};

Mat classifyMaterial(float elev, float slope, float moisture){
  // deep water
  if(elev < u_waterLevel - 0.02){
    float depth = (u_waterLevel - elev) / max(u_waterLevel, 0.001);
    return Mat(mix(vec3(0.15,0.55,0.60), vec3(0.02,0.08,0.18), depth), 0.05);
  }
  // shoreline
  if(elev < u_waterLevel + 0.01)
    return Mat(vec3(0.62,0.56,0.42), 0.7);
  // lowland grass
  if(elev < 0.35 && slope < 0.3){
    float gn = snoise(vWorldPosition*8.0)*0.5+0.5;
    vec3 g = mix(vec3(0.22,0.42,0.12), vec3(0.30,0.50,0.15), gn);
    float sm = smoothstep(0.45,0.55, snoise(vWorldPosition*3.0)*0.5+0.5);
    return Mat(mix(g, vec3(0.35,0.25,0.15), sm*0.3), 0.85);
  }
  // forest
  if(elev < 0.55 && slope < 0.5){
    float tn = snoise(vWorldPosition*12.0)*0.5+0.5;
    return Mat(mix(vec3(0.10,0.28,0.08), vec3(0.15,0.35,0.10), tn), 0.9);
  }
  // highland scrub
  if(elev < 0.70)
    return Mat(mix(vec3(0.35,0.38,0.22), vec3(0.45,0.42,0.38), slope), 0.8);
  // rock
  if(elev < 0.88 || slope > 0.6){
    float rn = snoise(vWorldPosition*15.0)*0.5+0.5;
    vec3 rc = mix(vec3(0.50,0.48,0.45), vec3(0.30,0.28,0.27), rn);
    float lichen = smoothstep(0.6,0.7, snoise(vWorldPosition*20.0)*0.5+0.5);
    return Mat(mix(rc, vec3(0.55,0.58,0.30), lichen*0.2), 0.65);
  }
  // snow
  float snowLine = 0.88 - slope*0.15;
  float sc = smoothstep(snowLine, snowLine+0.05, elev);
  float sn = snoise(vWorldPosition*10.0)*0.5+0.5;
  vec3 snow = mix(vec3(0.92,0.93,0.96), vec3(0.80,0.82,0.88), sn);
  return Mat(mix(vec3(0.45,0.42,0.38), snow, sc), 0.3);
}

// ── atmospheric scattering ───────────────────────────────────────

vec3 atmosphericScattering(vec3 viewDir, vec3 sunDir, float dist){
  float alt = max(vWorldPosition.y, 0.0) / max(u_amplitude, 0.1);
  float density = exp(-alt * 4.0);
  vec3 betaR = vec3(5.8e-3, 1.35e-2, 3.31e-2) * density;
  float moisture = smoothstep(0.0, 0.3, u_waterLevel - vElevation + 0.1);
  float betaM = 2.1e-2 * density * (0.5 + (1.0-moisture)*0.5);
  vec3 trans = exp(-(betaR * dist*0.001 + vec3(betaM * dist*0.001)));
  float cosT = dot(viewDir, sunDir);
  float phaseR = 0.0596831 * (1.0 + cosT*cosT);
  float g = 0.76;
  float phaseM = 0.0795775*(1.0-g*g)/pow(1.0+g*g-2.0*g*cosT, 1.5);
  vec3 scatter = (betaR*phaseR + vec3(betaM)*phaseM) * u_sunColor * u_sunIntensity
    * (1.0 - exp(-dist*0.0005)) / (dot(betaR,vec3(1.0)) + betaM + 0.0001);
  return scatter;
}

// ── lighting ─────────────────────────────────────────────────────

vec3 terrainLighting(Mat mat, vec3 N, vec3 V){
  vec3 L = normalize(u_sunDirection);
  vec3 H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0);
  float shin = mix(256.0, 4.0, mat.roughness);
  float spec = pow(max(dot(N, H), 0.0), shin) * (1.0-mat.roughness) * 0.5;
  vec3 sky = vec3(0.40,0.55,0.80) * u_sunIntensity * 0.3;
  vec3 gnd = vec3(0.15,0.12,0.10) * u_sunIntensity * 0.1;
  float hemi = dot(N, vec3(0,1,0))*0.5+0.5;
  vec3 ambient = mix(gnd, sky, hemi);
  float shadow = smoothstep(-0.05, 0.15, NdL);
  return mat.albedo * (ambient + u_sunColor*u_sunIntensity*NdL*shadow) + u_sunColor*spec*shadow;
}

// ── water ────────────────────────────────────────────────────────

vec3 waterSurface(vec3 V){
  float w1 = snoise(vec3(vWorldPosition.xz*2.0, u_time*0.5))*0.3;
  float w2 = snoise(vec3(vWorldPosition.xz*5.0+10.0, u_time*0.8))*0.15;
  vec3 wN = normalize(vec3(w1, 1.0, w2));
  vec3 L = normalize(u_sunDirection);
  vec3 R = reflect(-L, wN);
  float ss = pow(max(dot(V, R), 0.0), 128.0);
  float fr = pow(1.0-max(dot(V, wN), 0.0), 4.0);
  vec3 refl = vec3(0.5,0.65,0.85)*u_sunIntensity*0.4;
  return mix(vec3(0.05,0.20,0.35), refl, fr*0.6) + u_sunColor*ss*2.0;
}

// ── main ─────────────────────────────────────────────────────────

void main(){
  // circular clip
  if(vRadialDist > 1.0) discard;

  vec3 V = normalize(u_cameraPosition - vWorldPosition);
  float moisture = clamp(smoothstep(-0.05,0.05, u_waterLevel-vElevation) + snoise(vWorldPosition*2.0)*0.1, 0.0, 1.0);

  vec3 color;
  if(vElevation < u_waterLevel - 0.005){
    color = waterSurface(V);
  } else {
    Mat mat = classifyMaterial(vElevation, vSlope, moisture);
    color = terrainLighting(mat, vWorldNormal, V);
  }

  // atmospheric scattering
  float dist = length(u_cameraPosition - vWorldPosition);
  vec3 scatter = atmosphericScattering(V, normalize(u_sunDirection), dist);
  vec3 trans = exp(-vec3(0.0015) * dist);
  color = color * trans + scatter;

  // circular edge glow
  float edgeGlow = smoothstep(0.88, 1.0, vRadialDist);
  color += vec3(0.2, 0.6, 0.8) * edgeGlow * 0.3;

  // ACES tonemap
  color *= 0.6;
  vec3 x = color;
  color = (x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);
  color = clamp(color, 0.0, 1.0);

  // gamma
  color = pow(color, vec3(1.0/2.2));

  gl_FragColor = vec4(color, 1.0);
}
`;
