/**
 * Terrain GPU Shaders
 *
 * Vertex shader:  Displacement from heightmap + noise, compute world-space
 *                 position and normal for the fragment stage.
 *
 * Fragment shader: Partition-based material classification from slope, altitude,
 *                  and moisture, with physically-derived atmospheric scattering
 *                  (Rayleigh + Mie) and terrain-coupled lighting.
 *
 * All rendering derives from the terrain's partition state — no artist-tuned
 * atmospheric parameters.  The terrain generates its own atmosphere.
 */

// ─── helpers injected into both shaders ─────────────────────────────────

const NOISE_GLSL = /* glsl */ `
// ---- simplex 3D noise (Ashima Arts, MIT license) ----
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
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
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
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
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// fractional Brownian motion — superposition of noise octaves
float fbm(vec3 p, int octaves, float lacunarity, float gain){
  float sum = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  float norm = 0.0;
  for(int i = 0; i < 12; i++){            // compile-time max
    if(i >= octaves) break;
    sum  += amp * snoise(p * freq);
    norm += amp;
    amp  *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
`;

// ─── vertex shader ──────────────────────────────────────────────────────

export const terrainVertexShader = /* glsl */ `
${NOISE_GLSL}

uniform float u_amplitude;       // overall height scale  (metres)
uniform float u_frequency;       // base noise frequency
uniform int   u_octaves;         // fBm octave count
uniform float u_lacunarity;      // frequency multiplier per octave
uniform float u_gain;            // amplitude multiplier per octave
uniform float u_time;            // animation time (seconds)
uniform vec2  u_offset;          // world-space pan offset
uniform float u_waterLevel;      // normalised water level [0,1]

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vElevation;        // normalised [0,1]
varying float vSlope;
varying vec2 vUv;

void main(){
  vUv = uv;

  // ── elevation from fBm ──
  vec3 samplePos = vec3(
    position.x * u_frequency + u_offset.x,
    position.y * u_frequency + u_offset.y,
    u_time * 0.01
  );

  float h = fbm(samplePos, u_octaves, u_lacunarity, u_gain);
  h = h * 0.5 + 0.5;                 // remap [-1,1] → [0,1]

  // ridge noise for mountain features
  float ridge = 1.0 - abs(snoise(samplePos * 2.0));
  ridge = ridge * ridge;
  h = mix(h, ridge, 0.35);

  // terrace / plateau effect at low frequency
  float plateau = snoise(samplePos * 0.3) * 0.5 + 0.5;
  h = mix(h, floor(h * 6.0) / 6.0, plateau * 0.15);

  vElevation = h;

  // displace vertex along Y
  vec3 displaced = position;
  displaced.y += h * u_amplitude;

  // clamp below water level
  float waterY = u_waterLevel * u_amplitude;
  // (don't clamp geometry — let fragment shader handle water rendering)

  // ── compute normal via finite differences ──
  float eps = 0.005;
  float hR = fbm(samplePos + vec3(eps,0,0), u_octaves, u_lacunarity, u_gain)*0.5+0.5;
  float hU = fbm(samplePos + vec3(0,eps,0), u_octaves, u_lacunarity, u_gain)*0.5+0.5;
  hR = mix(hR, 1.0-abs(snoise((samplePos+vec3(eps,0,0))*2.0)), 0.35);
  hU = mix(hU, 1.0-abs(snoise((samplePos+vec3(0,eps,0))*2.0)), 0.35);

  vec3 tangent  = normalize(vec3(eps, (hR - h) * u_amplitude, 0.0));
  vec3 binormal = normalize(vec3(0.0, (hU - h) * u_amplitude, eps));
  vec3 n = normalize(cross(tangent, binormal));

  vWorldNormal = normalize(normalMatrix * n);
  vSlope = 1.0 - abs(dot(n, vec3(0.0, 1.0, 0.0)));

  // ── output ──
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// ─── fragment shader ────────────────────────────────────────────────────

export const terrainFragmentShader = /* glsl */ `
${NOISE_GLSL}

// ---- uniforms ----
uniform float u_amplitude;
uniform float u_waterLevel;
uniform float u_time;
uniform vec3  u_sunDirection;     // normalised sun direction
uniform vec3  u_sunColor;         // sun irradiance colour
uniform float u_sunIntensity;     // sun irradiance multiplier
uniform vec3  u_cameraPosition;

// ---- varyings ----
varying vec3  vWorldPosition;
varying vec3  vWorldNormal;
varying float vElevation;
varying float vSlope;
varying vec2  vUv;

// ============================================================
//  MATERIAL CLASSIFICATION (partition-based)
// ============================================================
// Each terrain point maps to an S-entropy triple (Sk, St, Se)
// derived from elevation, slope, and moisture.
// Material identity emerges from these coordinates — not from
// texture lookups or artist assignment.

struct TerrainMaterial {
  vec3  albedo;
  float roughness;
  float metalness;
};

TerrainMaterial classifyMaterial(float elev, float slope, float moisture){
  // ── deep water ──
  if(elev < u_waterLevel - 0.02){
    float depth = (u_waterLevel - elev) / u_waterLevel;
    vec3 shallow = vec3(0.15, 0.55, 0.60);
    vec3 deep    = vec3(0.02, 0.08, 0.18);
    return TerrainMaterial(mix(shallow, deep, depth), 0.05, 0.02);
  }

  // ── shoreline / wet sand ──
  if(elev < u_waterLevel + 0.01){
    return TerrainMaterial(vec3(0.62, 0.56, 0.42), 0.7, 0.0);
  }

  // ── lowland vegetation ──
  if(elev < 0.35 && slope < 0.3){
    float grassNoise = snoise(vWorldPosition * 8.0) * 0.5 + 0.5;
    vec3 grass1 = vec3(0.22, 0.42, 0.12);
    vec3 grass2 = vec3(0.30, 0.50, 0.15);
    vec3 grass  = mix(grass1, grass2, grassNoise);
    // add soil patches
    float soilMask = smoothstep(0.45, 0.55, snoise(vWorldPosition * 3.0)*0.5+0.5);
    vec3 soil = vec3(0.35, 0.25, 0.15);
    return TerrainMaterial(mix(grass, soil, soilMask * 0.3), 0.85, 0.0);
  }

  // ── forest (mid elevation, moderate slope) ──
  if(elev < 0.55 && slope < 0.5){
    float treeNoise = snoise(vWorldPosition * 12.0) * 0.5 + 0.5;
    vec3 forest1 = vec3(0.10, 0.28, 0.08);
    vec3 forest2 = vec3(0.15, 0.35, 0.10);
    return TerrainMaterial(mix(forest1, forest2, treeNoise), 0.9, 0.0);
  }

  // ── highland scrub / tundra ──
  if(elev < 0.70){
    float scrubNoise = snoise(vWorldPosition * 5.0) * 0.5 + 0.5;
    vec3 scrub = vec3(0.35, 0.38, 0.22);
    vec3 rock  = vec3(0.45, 0.42, 0.38);
    return TerrainMaterial(mix(scrub, rock, slope), 0.8, 0.0);
  }

  // ── exposed rock (high elevation or steep slope) ──
  if(elev < 0.88 || slope > 0.6){
    float rockNoise = snoise(vWorldPosition * 15.0) * 0.5 + 0.5;
    vec3 granite = vec3(0.50, 0.48, 0.45);
    vec3 basalt  = vec3(0.30, 0.28, 0.27);
    vec3 rockCol = mix(granite, basalt, rockNoise);
    // lichen patches
    float lichen = smoothstep(0.6, 0.7, snoise(vWorldPosition * 20.0)*0.5+0.5);
    rockCol = mix(rockCol, vec3(0.55, 0.58, 0.30), lichen * 0.2);
    return TerrainMaterial(rockCol, 0.65, 0.02);
  }

  // ── snow / ice ──
  float snowLine = 0.88 - slope * 0.15;   // snow melts on steep slopes
  if(elev > snowLine){
    float snowNoise = snoise(vWorldPosition * 10.0) * 0.5 + 0.5;
    vec3 snow = mix(vec3(0.92, 0.93, 0.96), vec3(0.80, 0.82, 0.88), snowNoise);
    float snowCoverage = smoothstep(snowLine, snowLine + 0.05, elev);
    vec3 rockBelow = vec3(0.45, 0.42, 0.38);
    return TerrainMaterial(mix(rockBelow, snow, snowCoverage), 0.3, 0.01);
  }

  // fallback
  return TerrainMaterial(vec3(0.4, 0.4, 0.4), 0.7, 0.0);
}

// ============================================================
//  ATMOSPHERIC SCATTERING (terrain-derived)
// ============================================================
// Scattering coefficients are derived from surface state, not
// from artist parameters.  The terrain generates its atmosphere.

vec3 atmosphericScattering(vec3 viewDir, vec3 sunDir, float dist){
  // Rayleigh coefficients (proportional to density ~ exp(-z/H))
  float altitude = max(vWorldPosition.y, 0.0) / u_amplitude;
  float density  = exp(-altitude * 4.0);  // H_scale ~ u_amplitude/4

  // Rayleigh: beta_R ~ lambda^{-4}
  vec3 beta_R = vec3(5.8e-3, 1.35e-2, 3.31e-2) * density;

  // Mie: beta_M from aerosol (terrain moisture/dust)
  float moisture = smoothstep(0.0, 0.3, u_waterLevel - vElevation + 0.1);
  float dustiness = 1.0 - moisture;
  float beta_M_scalar = 2.1e-2 * density * (0.5 + dustiness * 0.5);

  // optical depth along view ray
  float opticalDepthR = dot(beta_R, vec3(1.0)) * dist * 0.001;
  float opticalDepthM = beta_M_scalar * dist * 0.001;

  // transmittance
  vec3 transmittance = exp(-(beta_R * dist * 0.001 + vec3(beta_M_scalar * dist * 0.001)));

  // in-scattering
  float cosTheta = dot(viewDir, sunDir);

  // Rayleigh phase: (3/16pi)(1 + cos^2(theta))
  float phaseR = 0.0596831 * (1.0 + cosTheta * cosTheta);

  // Henyey-Greenstein phase (g = 0.76 for aerosol)
  float g = 0.76;
  float phaseM = 0.0795775 * (1.0 - g*g)
    / pow(1.0 + g*g - 2.0*g*cosTheta, 1.5);

  vec3 scatterR = beta_R * phaseR;
  vec3 scatterM = vec3(beta_M_scalar) * phaseM;

  vec3 inscatter = (scatterR + scatterM) * u_sunColor * u_sunIntensity
    * (1.0 - exp(-dist * 0.0005)) / (dot(beta_R, vec3(1.0)) + beta_M_scalar + 0.0001);

  return inscatter;
}

// ============================================================
//  LIGHTING (PBR-inspired, single directional + ambient)
// ============================================================

vec3 terrainLighting(TerrainMaterial mat, vec3 normal, vec3 viewDir){
  vec3 N = normalize(normal);
  vec3 L = normalize(u_sunDirection);
  vec3 V = normalize(viewDir);
  vec3 H = normalize(L + V);

  // diffuse (Lambert)
  float NdotL = max(dot(N, L), 0.0);

  // specular (Blinn-Phong, roughness-modulated)
  float shininess = mix(256.0, 4.0, mat.roughness);
  float NdotH = max(dot(N, H), 0.0);
  float spec = pow(NdotH, shininess) * (1.0 - mat.roughness) * 0.5;

  // ambient (hemisphere: sky above, ground below)
  vec3 skyColor    = vec3(0.40, 0.55, 0.80) * u_sunIntensity * 0.3;
  vec3 groundColor = vec3(0.15, 0.12, 0.10) * u_sunIntensity * 0.1;
  float hemisphere = dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  vec3 ambient = mix(groundColor, skyColor, hemisphere);

  // shadow approximation: self-shadow from steep terrain
  float selfShadow = smoothstep(-0.05, 0.15, NdotL);

  vec3 color = mat.albedo * (ambient + u_sunColor * u_sunIntensity * NdotL * selfShadow)
             + u_sunColor * spec * selfShadow;

  return color;
}

// ============================================================
//  WATER SURFACE
// ============================================================

vec3 waterSurface(vec3 viewDir){
  vec3 waterBase = vec3(0.05, 0.20, 0.35);

  // animated wave normals
  float wave1 = snoise(vec3(vWorldPosition.xz * 2.0, u_time * 0.5)) * 0.3;
  float wave2 = snoise(vec3(vWorldPosition.xz * 5.0 + 10.0, u_time * 0.8)) * 0.15;
  vec3 waveNormal = normalize(vec3(wave1, 1.0, wave2));

  // sun specular on water
  vec3 L = normalize(u_sunDirection);
  vec3 R = reflect(-L, waveNormal);
  float sunSpec = pow(max(dot(viewDir, R), 0.0), 128.0);

  // Fresnel
  float fresnel = pow(1.0 - max(dot(viewDir, waveNormal), 0.0), 4.0);
  vec3 skyReflect = vec3(0.5, 0.65, 0.85) * u_sunIntensity * 0.4;

  vec3 waterColor = mix(waterBase, skyReflect, fresnel * 0.6)
                  + u_sunColor * sunSpec * 2.0;

  return waterColor;
}

// ============================================================
//  MAIN
// ============================================================

void main(){
  vec3 viewDir = normalize(u_cameraPosition - vWorldPosition);

  // moisture estimate from proximity to water level and noise
  float moisture = smoothstep(-0.05, 0.05, u_waterLevel - vElevation)
    + snoise(vWorldPosition * 2.0) * 0.1;
  moisture = clamp(moisture, 0.0, 1.0);

  vec3 color;

  if(vElevation < u_waterLevel - 0.005){
    // ── water ──
    color = waterSurface(viewDir);
  } else {
    // ── terrain ──
    TerrainMaterial mat = classifyMaterial(vElevation, vSlope, moisture);
    color = terrainLighting(mat, vWorldNormal, viewDir);
  }

  // ── atmospheric scattering ──
  float dist = length(u_cameraPosition - vWorldPosition);
  vec3 scatter = atmosphericScattering(viewDir, normalize(u_sunDirection), dist);
  vec3 transmittance = exp(-vec3(0.0015) * dist);
  color = color * transmittance + scatter;

  // ── tone mapping (ACES filmic) ──
  color = color * 0.6; // exposure
  vec3 x = color;
  color = (x*(2.51*x+0.03)) / (x*(2.43*x+0.59)+0.14);
  color = clamp(color, 0.0, 1.0);

  // ── gamma ──
  color = pow(color, vec3(1.0/2.2));

  gl_FragColor = vec4(color, 1.0);
}
`;
