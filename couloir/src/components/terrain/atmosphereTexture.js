/**
 * atmosphereTexture.js — bridge between the JS-side Pass 0 volume and
 * the GPU-side Pass 3 ray-march shader.
 *
 *   buildAtmosphereTexture(vol)        → THREE.Data3DTexture (RGBA32F)
 *   buildAtmosphereUniforms(vol, ext)  → uniforms record matching
 *                                        atmosphereFragmentShader.
 *
 * The volume produced by terrainToAtmosphere() stores Sk, St, Se, n_ref
 * as four parallel Float32Arrays; the GPU expects them interleaved as
 * RGBA per voxel.  Layout is slice-major (depth = altitude), matching
 * THREE.Data3DTexture’s convention exactly.
 */

import * as THREE from 'three'

// ─── interleave Pass 0 volume into a single RGBA32F buffer ────────

function packAtmosphereVolume(vol) {
  const N = vol.width * vol.height * vol.layers
  const out = new Float32Array(N * 4)
  for (let i = 0; i < N; i++) {
    out[i * 4    ] = vol.Sk[i]
    out[i * 4 + 1] = vol.St[i]
    out[i * 4 + 2] = vol.Se[i]
    out[i * 4 + 3] = vol.n_ref[i]
  }
  return out
}

// ─── 3D texture builder ───────────────────────────────────────────

/**
 * Create a THREE.Data3DTexture from the Pass 0 volume.
 *
 * @param {Object} vol - output of terrainToAtmosphere()
 * @returns {THREE.Data3DTexture}  RGBA32F linear-filtered, clamped.
 */
export function buildAtmosphereTexture(vol) {
  const data = packAtmosphereVolume(vol)
  const tex = new THREE.Data3DTexture(
    data, vol.width, vol.height, vol.layers,
  )
  tex.format     = THREE.RGBAFormat
  tex.type       = THREE.FloatType
  tex.minFilter  = THREE.LinearFilter
  tex.magFilter  = THREE.LinearFilter
  tex.wrapS      = THREE.ClampToEdgeWrapping
  tex.wrapT      = THREE.ClampToEdgeWrapping
  tex.wrapR      = THREE.ClampToEdgeWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

// ─── shader-uniforms builder ──────────────────────────────────────

/**
 * Build the uniforms object consumed by atmosphereFragmentShader.
 *
 * The volume is mapped to a world-space box centred on the origin in
 * X and Z, extending from y=0 up to y=z_max.  Horizontal extent comes
 * from the source heightmap (vol.params.sizeMeters if present, falls
 * back to a sensible default).
 *
 * @param {Object} vol         output of terrainToAtmosphere()
 * @param {Object} [opts]
 * @param {number} [opts.sizeMeters]  override horizontal extent
 * @param {THREE.Vector3} [opts.cameraPos]
 * @param {THREE.Vector3} [opts.sunDir]
 * @param {THREE.Color}   [opts.sunColor]
 * @param {THREE.Color}   [opts.groundColor]
 * @param {number} [opts.stepMeters]
 * @param {number} [opts.maxSteps]
 * @returns {Object} uniforms record (Three.js style { name: { value } })
 */
export function buildAtmosphereUniforms(vol, opts = {}) {
  const p = vol.params
  const sizeMeters = opts.sizeMeters ?? vol.sizeMeters ?? 3000
  const halfX = sizeMeters * 0.5
  const halfZ = sizeMeters * 0.5

  // Sk inversion constant.  The forward formula
  //   Sk = log(1 + ρ/ρ₀) / log(1 + ρ_max/ρ₀)
  // implies ρ = ρ₀·(exp(Sk · log_norm) − 1).  log_norm must match the
  // value used in Pass 0 so density inversion is consistent.
  const rho_max = p.rho_0 * (1 + p.alpha_thermal)
                + p.rho_w0 + p.rho_g0 + p.rho_a0
  const log_norm = Math.log(1 + rho_max / p.rho_0)

  const tex = buildAtmosphereTexture(vol)

  return {
    // volume
    u_atmos_volume:  { value: tex },
    u_volume_origin: { value: new THREE.Vector3(-halfX, 0, -halfZ) },
    u_volume_size:   { value: new THREE.Vector3(sizeMeters, p.z_max, sizeMeters) },

    // camera basis (filled by the renderer each frame)
    u_camera_pos:  { value: opts.cameraPos  ?? new THREE.Vector3(0, 100, 0) },
    u_cam_right:   { value: new THREE.Vector3(1, 0, 0) },
    u_cam_up:      { value: new THREE.Vector3(0, 1, 0) },
    u_cam_forward: { value: new THREE.Vector3(0, 0, -1) },
    u_aspect:      { value: 1.0 },
    u_fov_y:       { value: Math.PI / 3 },

    // lighting
    u_sun_dir:    { value: (opts.sunDir   ?? new THREE.Vector3(0.4, 0.7, 0.6)).clone().normalize() },
    u_sun_color:  { value: opts.sunColor   ?? new THREE.Vector3(15.0, 14.0, 12.0) },
    u_ground_color:{ value: opts.groundColor?? new THREE.Vector3(0.06, 0.05, 0.04) },

    // march
    u_step_meters: { value: opts.stepMeters ?? 200.0 },
    u_max_steps:   { value: opts.maxSteps   ?? 256 },

    // physical constants (consistent with DEFAULT_PARAMS in sentropy.js)
    u_rho_0:        { value: p.rho_0 },
    u_log_norm:     { value: log_norm },
    u_mu_air:       { value: 0.02897 },        // kg / mol
    u_mie_g:        { value: 0.76 },
    u_aerosol_xs:   { value: 5.0e-12 },         // m²
    u_aerosol_proxy:{ value: 1.0e6 },           // matches Listing 9.4
    u_abs_coeff:    { value: 1.0e-6 },
    u_lambda:       { value: new THREE.Vector3(680e-9, 550e-9, 440e-9) },
  }
}

/**
 * Update the camera-related uniforms in place from a THREE.PerspectiveCamera.
 * Call this every frame.
 */
export function syncCameraUniforms(uniforms, camera, aspect) {
  camera.updateMatrixWorld()
  const m = camera.matrixWorld

  // Three.js camera looks down -Z in its local frame.
  uniforms.u_camera_pos.value.setFromMatrixPosition(m)
  uniforms.u_cam_right  .value.setFromMatrixColumn(m, 0).normalize()
  uniforms.u_cam_up     .value.setFromMatrixColumn(m, 1).normalize()
  uniforms.u_cam_forward.value.setFromMatrixColumn(m, 2).normalize().multiplyScalar(-1)

  uniforms.u_aspect.value = aspect
  uniforms.u_fov_y .value = (camera.fov * Math.PI) / 180
}
