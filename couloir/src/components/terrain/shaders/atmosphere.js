/**
 * Atmosphere GPU Shaders — Pass 3 of the street-view-rendering pipeline.
 *
 * Implements Section 6 of street-view-rendering.tex (Listing 9.4):
 *   Beer-Lambert ray march through the (Sk, St, Se, n_ref) volume
 *   produced by Pass 0, with
 *     - density reconstructed from Sk (inverts the forward formula
 *       Sk = log(1 + ρ/ρ₀) / log(1 + ρ_max/ρ₀))
 *     - Rayleigh scattering coefficient β_R(λ) from the per-voxel
 *       refractive index n_ref (Eq. 25)
 *     - Mie scattering β_M from an Sk-weighted aerosol proxy (Eq. 26)
 *     - phase functions: Rayleigh + Henyey-Greenstein with g = 0.76
 *
 * No volume of light-source visibility is computed (single-scattering
 * with sun visibility assumed = 1).  Adding line-of-sight attenuation
 * to the sun is a per-step inner loop and is intentionally omitted in
 * this first cut.
 *
 * GLSL ES 3.0 (WebGL2).  Use with THREE.GLSL3 + THREE.Data3DTexture.
 */

// ─── vertex shader ─────────────────────────────────────────────────
//
// A fullscreen-quad vertex shader that hands the fragment shader a
// world-space ray direction per pixel.  Caller provides the camera
// basis (right/up/forward) + aspect + vertical fov as uniforms.

export const atmosphereVertexShader = /* glsl */ `
out vec3 vRayDir;
out vec2 vScreenUV;

uniform vec3  u_cam_right;
uniform vec3  u_cam_up;
uniform vec3  u_cam_forward;
uniform float u_aspect;
uniform float u_fov_y;

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);

  // NDC [-1,1] → world ray direction
  float tanFov = tan(u_fov_y * 0.5);
  vRayDir = u_cam_forward
          + position.x * u_cam_right * tanFov * u_aspect
          + position.y * u_cam_up    * tanFov;

  vScreenUV = position.xy * 0.5 + 0.5;
}
`

// ─── fragment shader ───────────────────────────────────────────────

export const atmosphereFragmentShader = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vRayDir;
in vec2 vScreenUV;
out vec4 fragColor;

// — volume —
uniform sampler3D u_atmos_volume;   // (Sk, St, Se, n_ref) RGBA32F
uniform vec3      u_volume_origin;  // world-space corner (x, y_min, z) of volume
uniform vec3      u_volume_size;    // world-space extent (Δx, z_max, Δz)

// — camera —
uniform vec3  u_camera_pos;
uniform vec3  u_sun_dir;            // *toward* the sun, unit
uniform vec3  u_sun_color;          // pre-multiplied by intensity
uniform vec3  u_ground_color;       // colour shown when a ray hits y < 0

// — march —
uniform float u_step_meters;
uniform int   u_max_steps;

// — physical constants (caller supplies values from DEFAULT_PARAMS) —
uniform float u_rho_0;              // 1.225 kg/m³
uniform float u_log_norm;           // log(1 + ρ_max/ρ_0); used to invert Sk
uniform float u_mu_air;             // 0.02897 kg/mol
uniform float u_mie_g;              // Henyey-Greenstein asymmetry, 0.76
uniform float u_aerosol_xs;         // aerosol cross-section, m²
uniform float u_aerosol_proxy;      // scale factor on rho·Sk for N_aer
uniform float u_abs_coeff;          // grey absorption per kg/m³
uniform vec3  u_lambda;             // wavelengths (R,G,B), metres

const float PI  = 3.14159265359;
const float N_A = 6.02214076e23;

// World pos → volume UVW.
//   World axes  : (east X, altitude Y, south-going Z)
//   Texture axes: (u = column = east, v = row = south, w = slice = altitude)
// The heightmap’s row 0 is north (world Z = -halfZ); Pass 0 inherits
// that convention, so znorm = (worldZ - origin.z) / size.z directly maps
// to the texture v axis with no flip.
vec3 worldToVolumeUVW(vec3 wp) {
  vec3 rel = wp - u_volume_origin;
  return vec3(
    rel.x / u_volume_size.x,
    rel.z / u_volume_size.z,
    rel.y / u_volume_size.y
  );
}

// Rayleigh phase: 3/(16π) · (1 + cos²θ)
float phaseRayleigh(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

// Henyey-Greenstein phase: (1 - g²) / (4π (1 + g² - 2g cosθ)^{3/2})
float phaseHG(float cosTheta, float g) {
  float gg = g * g;
  float denom = 1.0 + gg - 2.0 * g * cosTheta;
  return (1.0 - gg) / (4.0 * PI * pow(max(denom, 1e-4), 1.5));
}

void main() {
  vec3 dir = normalize(vRayDir);
  vec3 pos = u_camera_pos;
  float ds = u_step_meters;

  vec3  scatter = vec3(0.0);
  vec3  T       = vec3(1.0);   // transmittance (per-channel)
  bool  hitGround = false;

  for (int i = 0; i < 512; i++) {
    if (i >= u_max_steps) break;
    pos += dir * ds;

    // Hit ground (y < 0) → stop, accumulate ground colour through current T
    if (pos.y < u_volume_origin.y) {
      hitGround = true;
      break;
    }
    // Past the top of the atmosphere → stop, leave space behind
    if (pos.y > u_volume_origin.y + u_volume_size.y) break;

    // Sample atmospheric volume.  Horizontal axes are clamped so the
    // ray keeps producing a sensible value when it exits sideways
    // (the atmosphere far from the camera is well-approximated by the
    // edge column).  uvw.z (altitude / slice axis) is not clamped — the
    // world-Y bounds checks above already guard it.
    vec3 uvw = worldToVolumeUVW(pos);
    uvw.x = clamp(uvw.x, 0.001, 0.999);
    uvw.y = clamp(uvw.y, 0.001, 0.999);
    vec4 atm = texture(u_atmos_volume, uvw);

    float Sk    = atm.r;
    float n_ref = atm.a;

    // Density via Sk inversion.  The forward map is
    //   Sk = log(1 + ρ/ρ₀) / log(1 + ρ_max/ρ₀)
    // so ρ = ρ₀ · (exp(Sk · log_norm) − 1).
    float rho = u_rho_0 * (exp(Sk * u_log_norm) - 1.0);

    // Rayleigh coefficient: 8π³(n²−1)² / (3·N·λ⁴)
    float N_mol = rho / u_mu_air * N_A;
    float n_sq  = n_ref * n_ref;
    float r_num = 8.0 * PI * PI * PI * (n_sq - 1.0) * (n_sq - 1.0);
    vec3  beta_R = (r_num / (3.0 * max(N_mol, 1.0))) / pow(u_lambda, vec3(4.0));

    // Mie coefficient via aerosol-loading proxy
    float N_aer  = rho * Sk * u_aerosol_proxy;
    vec3  beta_M = vec3(u_aerosol_xs * N_aer);

    // Grey absorption proportional to density
    vec3 alpha_abs = vec3(u_abs_coeff * rho);

    // Beer-Lambert step
    vec3 extinction = alpha_abs + beta_R + beta_M;
    vec3 layer_T = exp(-extinction * ds);

    // Single-scattering toward the sun (no LOS attenuation)
    float cosTheta = dot(dir, u_sun_dir);
    float phR = phaseRayleigh(cosTheta);
    float phM = phaseHG(cosTheta, u_mie_g);

    vec3 inscatter = (beta_R * phR + beta_M * phM) * u_sun_color;
    scatter += T * inscatter * ds;
    T      *= layer_T;

    if (max(max(T.r, T.g), T.b) < 0.001) break;
  }

  vec3 col = scatter;
  if (hitGround) col += T * u_ground_color;

  fragColor = vec4(col, 1.0);
}
`
