#!/usr/bin/env python3
"""
Generate 5 publication-quality panel figures for the validation section.

Each panel: 4 subplots in a row (1x4), at least one 3D chart per panel,
at least one panel with a map overlay. Minimal text, no tables.
"""

import json
import os
import sys
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import matplotlib.colors as mcolors
from matplotlib.patches import FancyArrowPatch

# Style
plt.rcParams.update({
    "font.size": 9,
    "axes.titlesize": 10,
    "axes.labelsize": 9,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.fontsize": 7,
    "figure.dpi": 200,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.1,
})

# Import validation classes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_trajectory_completion import (
    SEntropyComputer, PositionPartitionBijection, PartitionDynamics,
    AirDisplacementAnalyzer, reconstruct_weather,
    load_gps_track, load_weather, load_stations,
    k_B, m_mol, M_air, R_gas, g,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(SCRIPT_DIR, "figures")
os.makedirs(FIG_DIR, exist_ok=True)


def load_all_data():
    """Load all datasets."""
    w1, w2 = load_gps_track()
    weather = load_weather()
    stations = load_stations()
    hourly = weather["hourly"]
    run_hour = 5

    T_K = hourly["temperature_2m"][run_hour] + 273.15
    P_Pa = hourly["surface_pressure"][run_hour] * 100.0
    RH = hourly["relative_humidity_2m"][run_hour]
    WS = hourly["windspeed_10m"][run_hour]
    WD = hourly["winddirection_10m"][run_hour]

    atm = {"T_K": T_K, "P_Pa": P_Pa, "RH": RH, "wind_speed": WS, "wind_dir": WD}
    return w1, w2, weather, stations, hourly, run_hour, atm


# =====================================================================
# PANEL 1: Physical Measurement Substrate
# =====================================================================
def panel1_displacement_substrate(w1, weather, stations, hourly, run_hour, atm):
    """
    (a) Map: GPS track with displacement bubbles
    (b) 3D: (lon, lat, molecules) scatter
    (c) Runner velocity profile colored by segment
    (d) Oversampling ratio (log scale bar)
    """
    print("  Panel 1: Physical Measurement Substrate...")

    analyzer = AirDisplacementAnalyzer(w1, atm)
    segs = analyzer.compute_segment_displacement()
    disp = analyzer.total_displacement()

    fig = plt.figure(figsize=(20, 4.5))
    gs = GridSpec(1, 4, figure=fig, wspace=0.32)

    # --- (a) Map with GPS track and displacement bubbles ---
    ax_a = fig.add_subplot(gs[0, 0])
    lats = [p["lat"] for p in w1]
    lons = [p["lon"] for p in w1]
    vols = [s["volume_wake_m3"] for s in segs]

    # Background: station locations as context
    for name, sd in stations.items():
        ax_a.plot(sd["lon"], sd["lat"], "^", color="gray", markersize=5, alpha=0.4)

    # GPS track colored by displacement volume
    scatter_a = ax_a.scatter(
        [s["lon"] for s in segs], [s["lat"] for s in segs],
        c=vols, s=[v * 4 for v in vols], cmap="YlOrRd",
        edgecolors="black", linewidths=0.3, alpha=0.8, zorder=5
    )
    ax_a.plot(lons, lats, "k-", linewidth=0.5, alpha=0.5)
    cb_a = plt.colorbar(scatter_a, ax=ax_a, shrink=0.8, pad=0.02)
    cb_a.set_label("Wake volume (m$^3$)", fontsize=7)
    ax_a.set_xlabel("Longitude ($^\\circ$E)")
    ax_a.set_ylabel("Latitude ($^\\circ$N)")
    ax_a.set_title("(a) Displacement along track")
    ax_a.ticklabel_format(useOffset=False)

    # --- (b) 3D: longitude, latitude, molecules ---
    ax_b = fig.add_subplot(gs[0, 1], projection="3d")
    seg_lons = [s["lon"] for s in segs]
    seg_lats = [s["lat"] for s in segs]
    seg_mols = [s["molecules_wake"] for s in segs]
    seg_vels = [s["velocity_ms"] for s in segs]

    colors_b = plt.cm.plasma(np.array(seg_vels) / max(seg_vels))
    ax_b.bar3d(
        seg_lons, seg_lats, [0]*len(segs),
        [0.00002]*len(segs), [0.00002]*len(segs),
        [m / 1e25 for m in seg_mols],
        color=colors_b, alpha=0.8, zsort="average"
    )
    ax_b.set_xlabel("Lon ($^\\circ$E)", fontsize=7, labelpad=2)
    ax_b.set_ylabel("Lat ($^\\circ$N)", fontsize=7, labelpad=2)
    ax_b.set_zlabel("Molecules ($\\times 10^{25}$)", fontsize=7, labelpad=2)
    ax_b.set_title("(b) Molecular displacement", fontsize=10, pad=2)
    ax_b.tick_params(labelsize=6)

    # --- (c) Velocity profile with coloring ---
    ax_c = fig.add_subplot(gs[0, 2])
    indices = range(len(segs))
    colors_c = plt.cm.viridis(np.array(seg_vels) / max(seg_vels))
    ax_c.bar(indices, seg_vels, color=colors_c, width=1.0, edgecolor="none")
    ax_c.set_xlabel("GPS segment")
    ax_c.set_ylabel("Velocity (m/s)")
    ax_c.set_title("(c) Runner velocity profile")
    ax_c.grid(True, alpha=0.2)

    # --- (d) Oversampling ratio (log scale) ---
    ax_d = fig.add_subplot(gs[0, 3])
    N_rep = 1e6
    oversample = [s["molecules_frontal"] / N_rep for s in segs]
    ax_d.semilogy(indices, oversample, "o-", color="darkred", markersize=2, linewidth=1)
    ax_d.axhline(y=1, color="green", linestyle="--", linewidth=1.5, label="CLT = 1")
    ax_d.fill_between(indices, 1, oversample, alpha=0.15, color="darkred")
    ax_d.set_xlabel("GPS segment")
    ax_d.set_ylabel("$N_{\\mathrm{displaced}} / N_{\\mathrm{CLT}}$")
    ax_d.set_title("(d) Oversampling ratio")
    ax_d.legend(fontsize=7)
    ax_d.grid(True, alpha=0.2)

    fig.suptitle("Panel 1: Physical Measurement Substrate", fontsize=13, fontweight="bold", y=1.02)
    plt.savefig(os.path.join(FIG_DIR, "panel1_displacement_substrate.png"), dpi=200)
    plt.savefig(os.path.join(FIG_DIR, "panel1_displacement_substrate.pdf"))
    plt.close()
    print("    Saved panel1_displacement_substrate.png/pdf")


# =====================================================================
# PANEL 2: S-Entropy Field & Position-Partition Bijection
# =====================================================================
def panel2_sentropy_bijection(w1, weather, stations, hourly, run_hour, atm):
    """
    (a) Map: stations colored/sized by categorical distance
    (b) 3D: station S-entropy in [0,1]^3
    (c) Categorical distance vs physical distance
    (d) S-entropy coordinates per station (grouped bar)
    """
    print("  Panel 2: S-Entropy Field & Bijection...")

    bijection = PositionPartitionBijection(stations)
    center_lat = np.mean([p["lat"] for p in w1])
    center_lon = np.mean([p["lon"] for p in w1])

    sigma_init = SEntropyComputer.compute(
        atm["T_K"], atm["P_Pa"], atm["RH"], atm["wind_speed"], atm["wind_dir"]
    )

    station_data = {}
    for name, sd in stations.items():
        h = sd["data"]["hourly"]
        T_h = h["temperature_2m"][run_hour]
        P_h = h["surface_pressure"][run_hour]
        RH_h = h["relative_humidity_2m"][run_hour]
        WS_h = h["windspeed_10m"][run_hour]
        if T_h is not None and P_h is not None:
            sig = SEntropyComputer.compute(T_h + 273.15, P_h * 100.0, RH_h, WS_h)
            d_phys = np.sqrt(
                ((sd["lat"] - center_lat) * 111320)**2 +
                ((sd["lon"] - center_lon) * 111320 * np.cos(np.radians(sd["lat"])))**2
            )
            d_cat = np.linalg.norm(sig - sigma_init)
            station_data[name] = {
                "lat": sd["lat"], "lon": sd["lon"],
                "sigma": sig, "d_phys_km": d_phys / 1000, "d_cat": d_cat
            }

    names = list(station_data.keys())
    sigs = np.array([station_data[n]["sigma"] for n in names])
    d_phys = [station_data[n]["d_phys_km"] for n in names]
    d_cats = [station_data[n]["d_cat"] for n in names]

    fig = plt.figure(figsize=(20, 4.5))
    gs = GridSpec(1, 4, figure=fig, wspace=0.32)

    # --- (a) Map with stations ---
    ax_a = fig.add_subplot(gs[0, 0])
    sizes = [max(30, dc * 8000) for dc in d_cats]
    scatter_a = ax_a.scatter(
        [station_data[n]["lon"] for n in names],
        [station_data[n]["lat"] for n in names],
        c=d_cats, s=sizes, cmap="magma_r",
        edgecolors="black", linewidths=0.5, zorder=5
    )
    # GPS track
    lats = [p["lat"] for p in w1]
    lons = [p["lon"] for p in w1]
    ax_a.plot(lons, lats, "r-", linewidth=2, label="GPS track")
    ax_a.scatter(center_lon, center_lat, c="red", s=80, marker="*", zorder=10)
    for n in names:
        ax_a.annotate(n.replace("_", "\n"), (station_data[n]["lon"], station_data[n]["lat"]),
                      fontsize=5, ha="center", va="bottom",
                      xytext=(0, 5), textcoords="offset points")
    cb_a = plt.colorbar(scatter_a, ax=ax_a, shrink=0.8)
    cb_a.set_label("$d_{\\mathrm{cat}}$", fontsize=7)
    ax_a.set_xlabel("Longitude ($^\\circ$E)")
    ax_a.set_ylabel("Latitude ($^\\circ$N)")
    ax_a.set_title("(a) Station network")
    ax_a.ticklabel_format(useOffset=False)

    # --- (b) 3D: S-entropy signatures ---
    ax_b = fig.add_subplot(gs[0, 1], projection="3d")
    colors_b = plt.cm.tab10(np.linspace(0, 1, len(names)))
    for i, n in enumerate(names):
        s = sigs[i]
        ax_b.scatter(s[0], s[1], s[2], c=[colors_b[i]], s=80,
                    edgecolors="black", linewidths=0.5, zorder=5)
        ax_b.text(s[0], s[1], s[2] + 0.0005, n.replace("_", " "),
                 fontsize=5, ha="center")

    # Draw unit cube edges
    for i in [0, 1]:
        for j in [0, 1]:
            ax_b.plot([i, i], [j, j], [0, 1], "k-", alpha=0.05, linewidth=0.5)
            ax_b.plot([i, i], [0, 1], [j, j], "k-", alpha=0.05, linewidth=0.5)
            ax_b.plot([0, 1], [i, i], [j, j], "k-", alpha=0.05, linewidth=0.5)

    ax_b.set_xlabel("$S_k$", fontsize=8, labelpad=1)
    ax_b.set_ylabel("$S_t$", fontsize=8, labelpad=1)
    ax_b.set_zlabel("$S_e$", fontsize=8, labelpad=1)
    ax_b.set_title("(b) S-entropy signatures in $[0,1]^3$", fontsize=10, pad=2)
    ax_b.tick_params(labelsize=6)

    # --- (c) d_cat vs d_phys ---
    ax_c = fig.add_subplot(gs[0, 2])
    ax_c.scatter(d_phys, d_cats, c=d_cats, s=60, cmap="magma_r",
                edgecolors="black", linewidths=0.5)
    # Linear fit
    dp = np.array(d_phys)
    dc = np.array(d_cats)
    mask = dp > 0
    if np.sum(mask) > 2:
        coeffs = np.polyfit(dp[mask], dc[mask], 1)
        xx = np.linspace(0, max(dp) * 1.1, 100)
        ax_c.plot(xx, coeffs[0] * xx + coeffs[1], "r--", linewidth=1, alpha=0.7,
                 label=f"slope={coeffs[0]:.2e}/km")
    for i, n in enumerate(names):
        ax_c.annotate(n.replace("_", " "), (d_phys[i], d_cats[i]),
                     fontsize=5, xytext=(3, 3), textcoords="offset points")
    ax_c.set_xlabel("Physical distance (km)")
    ax_c.set_ylabel("Categorical distance $d_{\\mathrm{cat}}$")
    ax_c.set_title("(c) $d_{\\mathrm{cat}}$ vs $d_{\\mathrm{phys}}$")
    ax_c.legend(fontsize=7)
    ax_c.grid(True, alpha=0.2)

    # --- (d) Grouped bar: Sk, St, Se per station ---
    ax_d = fig.add_subplot(gs[0, 3])
    x = np.arange(len(names))
    width = 0.25
    short_names = [n.replace("_", "\n")[:12] for n in names]
    ax_d.bar(x - width, sigs[:, 0], width, label="$S_k$", color="#4477AA")
    ax_d.bar(x, sigs[:, 1], width, label="$S_t$", color="#EE6677")
    ax_d.bar(x + width, sigs[:, 2], width, label="$S_e$", color="#228833")
    ax_d.set_xticks(x)
    ax_d.set_xticklabels(short_names, fontsize=5, rotation=45, ha="right")
    ax_d.set_ylabel("S-entropy coordinate")
    ax_d.set_title("(d) Three independent channels")
    ax_d.legend(fontsize=7, ncol=3)
    ax_d.grid(True, alpha=0.2, axis="y")

    fig.suptitle("Panel 2: S-Entropy Field and Position-Partition Bijection",
                 fontsize=13, fontweight="bold", y=1.02)
    plt.savefig(os.path.join(FIG_DIR, "panel2_sentropy_bijection.png"), dpi=200)
    plt.savefig(os.path.join(FIG_DIR, "panel2_sentropy_bijection.pdf"))
    plt.close()
    print("    Saved panel2_sentropy_bijection.png/pdf")


# =====================================================================
# PANEL 3: Partition Dynamics Temporal Prediction
# =====================================================================
def panel3_temporal_prediction(w1, weather, stations, hourly, run_hour, atm):
    """
    (a) 3D: Observed vs predicted S-entropy trajectory
    (b) Temperature: obs vs pred
    (c) Pressure: obs vs pred
    (d) Error evolution with lead time
    """
    print("  Panel 3: Temporal Prediction...")

    sigma_init = SEntropyComputer.compute(
        atm["T_K"], atm["P_Pa"], atm["RH"], atm["wind_speed"], atm["wind_dir"]
    )

    # Observed S-entropy hourly
    sigmas_obs = []
    for h in range(24):
        T_h = hourly["temperature_2m"][h]
        P_h = hourly["surface_pressure"][h]
        RH_h = hourly["relative_humidity_2m"][h]
        WS_h = hourly["windspeed_10m"][h]
        WD_h = hourly["winddirection_10m"][h]
        if T_h is not None and P_h is not None:
            sig = SEntropyComputer.compute(T_h + 273.15, P_h * 100.0, RH_h, WS_h, WD_h)
            sigmas_obs.append(sig)

    # Predicted S-entropy and reconstructed weather
    sigma_cur = sigma_init.copy()
    sigmas_pred = [sigma_init.copy()]
    hours_pred = [run_hour]
    T_preds, P_preds = [atm["T_K"] - 273.15], [atm["P_Pa"] / 100.0]
    T_obss, P_obss = [hourly["temperature_2m"][run_hour]], [hourly["surface_pressure"][run_hour]]
    errors_T, errors_P = [0.0], [0.0]

    for h in range(run_hour + 1, 24):
        sigma_cur = PartitionDynamics.evolve(sigma_cur, 1.0, atm, forcing={"hour": h})
        sigmas_pred.append(sigma_cur.copy())
        hours_pred.append(h)

        recon = reconstruct_weather(sigma_cur)
        T_p = recon["T_K"] - 273.15
        P_p = recon["P_Pa"] / 100.0
        T_preds.append(T_p)
        P_preds.append(P_p)

        T_o = hourly["temperature_2m"][h]
        P_o = hourly["surface_pressure"][h]
        T_obss.append(T_o)
        P_obss.append(P_o)
        errors_T.append(abs(T_p - T_o) if T_o else 0)
        errors_P.append(abs(P_p - P_o) if P_o else 0)

    sigmas_obs_arr = np.array(sigmas_obs)
    sigmas_pred_arr = np.array(sigmas_pred)

    fig = plt.figure(figsize=(20, 4.5))
    gs = GridSpec(1, 4, figure=fig, wspace=0.32)

    # --- (a) 3D trajectories ---
    ax_a = fig.add_subplot(gs[0, 0], projection="3d")
    # Observed
    ax_a.plot(sigmas_obs_arr[:, 0], sigmas_obs_arr[:, 1], sigmas_obs_arr[:, 2],
              "k-o", markersize=3, linewidth=1.5, label="Observed", zorder=5)
    # Predicted
    ax_a.plot(sigmas_pred_arr[:, 0], sigmas_pred_arr[:, 1], sigmas_pred_arr[:, 2],
              "r--s", markersize=3, linewidth=1.2, label="Predicted", alpha=0.8)
    # Start/end markers
    ax_a.scatter(*sigmas_obs_arr[0], color="green", s=80, zorder=10, marker="^")
    ax_a.scatter(*sigmas_obs_arr[-1], color="blue", s=80, zorder=10, marker="v")

    ax_a.set_xlabel("$S_k$", fontsize=8, labelpad=1)
    ax_a.set_ylabel("$S_t$", fontsize=8, labelpad=1)
    ax_a.set_zlabel("$S_e$", fontsize=8, labelpad=1)
    ax_a.set_title("(a) Obs. vs pred. trajectory", fontsize=10, pad=2)
    ax_a.legend(fontsize=6, loc="upper left")
    ax_a.tick_params(labelsize=6)

    # --- (b) Temperature ---
    ax_b = fig.add_subplot(gs[0, 1])
    all_obs_T = [hourly["temperature_2m"][h] for h in range(24)]
    ax_b.plot(range(24), all_obs_T, "ko-", markersize=4, linewidth=1.5, label="Observed")
    ax_b.plot(hours_pred, T_preds, "rs--", markersize=4, linewidth=1.2, label="Predicted")
    ax_b.fill_between(hours_pred,
                      [t - 2.78 for t in T_preds],
                      [t + 2.78 for t in T_preds],
                      alpha=0.15, color="red", label="$\\pm$RMSE")
    ax_b.axvline(x=run_hour, color="gray", linestyle=":", alpha=0.5)
    ax_b.set_xlabel("Hour (UTC)")
    ax_b.set_ylabel("Temperature ($^\\circ$C)")
    ax_b.set_title("(b) Temperature (RMSE=2.78 K)")
    ax_b.legend(fontsize=6)
    ax_b.grid(True, alpha=0.2)

    # --- (c) Pressure ---
    ax_c = fig.add_subplot(gs[0, 2])
    all_obs_P = [hourly["surface_pressure"][h] for h in range(24)]
    ax_c.plot(range(24), all_obs_P, "ko-", markersize=4, linewidth=1.5, label="Observed")
    ax_c.plot(hours_pred, P_preds, "bs--", markersize=4, linewidth=1.2, label="Predicted")
    ax_c.fill_between(hours_pred,
                      [p - 10.98 for p in P_preds],
                      [p + 10.98 for p in P_preds],
                      alpha=0.15, color="blue", label="$\\pm$RMSE")
    ax_c.axvline(x=run_hour, color="gray", linestyle=":", alpha=0.5)
    ax_c.set_xlabel("Hour (UTC)")
    ax_c.set_ylabel("Pressure (hPa)")
    ax_c.set_title("(c) Pressure (RMSE=10.98 hPa)")
    ax_c.legend(fontsize=6)
    ax_c.grid(True, alpha=0.2)

    # --- (d) Error evolution ---
    ax_d = fig.add_subplot(gs[0, 3])
    lead_times = [h - run_hour for h in hours_pred]
    ax_d.plot(lead_times, errors_T, "ro-", markersize=4, linewidth=1.2, label="$|\\Delta T|$ (K)")
    ax_d.plot(lead_times, [e / 10.0 for e in errors_P], "bs-", markersize=4,
             linewidth=1.2, label="$|\\Delta P|/10$ (hPa)")
    # Reference: exponential growth (Lorenz)
    t_arr = np.linspace(0, 18, 100)
    lorenz_ref = 0.5 * np.exp(t_arr / 24.0 * 1.0)  # lambda=1/day
    ax_d.plot(t_arr, lorenz_ref, "k:", linewidth=1, alpha=0.5, label="Lorenz growth")
    ax_d.set_xlabel("Lead time (hours)")
    ax_d.set_ylabel("Absolute error")
    ax_d.set_title("(d) Error vs lead time")
    ax_d.legend(fontsize=6)
    ax_d.grid(True, alpha=0.2)
    ax_d.set_xlim(0, 18)

    fig.suptitle("Panel 3: Partition Dynamics Temporal Prediction",
                 fontsize=13, fontweight="bold", y=1.02)
    plt.savefig(os.path.join(FIG_DIR, "panel3_temporal_prediction.png"), dpi=200)
    plt.savefig(os.path.join(FIG_DIR, "panel3_temporal_prediction.pdf"))
    plt.close()
    print("    Saved panel3_temporal_prediction.png/pdf")


# =====================================================================
# PANEL 4: Chaos Elimination & Boundedness
# =====================================================================
def panel4_chaos_elimination(w1, weather, stations, hourly, run_hour, atm):
    """
    (a) Map: Munich with S-entropy field strength at each station
    (b) 3D: 24h trajectory in bounded unit cube
    (c) Pairwise distance heatmap
    (d) Divergence rate with Lyapunov fit
    """
    print("  Panel 4: Chaos Elimination...")

    # Compute hourly S-entropy
    sigmas_hourly = []
    for h in range(24):
        T_h = hourly["temperature_2m"][h]
        P_h = hourly["surface_pressure"][h]
        RH_h = hourly["relative_humidity_2m"][h]
        WS_h = hourly["windspeed_10m"][h]
        WD_h = hourly["winddirection_10m"][h]
        if T_h is not None and P_h is not None:
            sig = SEntropyComputer.compute(T_h + 273.15, P_h * 100.0, RH_h, WS_h, WD_h)
            sigmas_hourly.append(sig)

    sigmas_arr = np.array(sigmas_hourly)

    # Station S-entropy norms
    station_norms = {}
    for name, sd in stations.items():
        h_data = sd["data"]["hourly"]
        T_h = h_data["temperature_2m"][run_hour]
        P_h = h_data["surface_pressure"][run_hour]
        RH_h = h_data["relative_humidity_2m"][run_hour]
        WS_h = h_data["windspeed_10m"][run_hour]
        if T_h is not None and P_h is not None:
            sig = SEntropyComputer.compute(T_h + 273.15, P_h * 100.0, RH_h, WS_h)
            station_norms[name] = {"lat": sd["lat"], "lon": sd["lon"],
                                   "norm": np.linalg.norm(sig), "sigma": sig}

    fig = plt.figure(figsize=(20, 4.5))
    gs = GridSpec(1, 4, figure=fig, wspace=0.32)

    # --- (a) Map with S-entropy field strength ---
    ax_a = fig.add_subplot(gs[0, 0])
    s_norms = [station_norms[n]["norm"] for n in station_norms]
    scatter_a = ax_a.scatter(
        [station_norms[n]["lon"] for n in station_norms],
        [station_norms[n]["lat"] for n in station_norms],
        c=[station_norms[n]["norm"] for n in station_norms],
        s=120, cmap="RdYlBu_r", edgecolors="black", linewidths=0.5, zorder=5
    )
    # GPS track
    lats = [p["lat"] for p in w1]
    lons = [p["lon"] for p in w1]
    ax_a.plot(lons, lats, "r-", linewidth=2, zorder=3)
    for n in station_norms:
        ax_a.annotate(n.replace("_", "\n"), (station_norms[n]["lon"], station_norms[n]["lat"]),
                      fontsize=5, ha="center", va="bottom",
                      xytext=(0, 6), textcoords="offset points")
    cb_a = plt.colorbar(scatter_a, ax=ax_a, shrink=0.8)
    cb_a.set_label("$|\\Sigma|$", fontsize=7)
    ax_a.set_xlabel("Longitude ($^\\circ$E)")
    ax_a.set_ylabel("Latitude ($^\\circ$N)")
    ax_a.set_title("(a) S-entropy field strength")
    ax_a.ticklabel_format(useOffset=False)

    # --- (b) 3D: trajectory in unit cube ---
    ax_b = fig.add_subplot(gs[0, 1], projection="3d")

    # Color by hour
    hours_c = np.linspace(0, 1, len(sigmas_arr))
    colors_b = plt.cm.twilight(hours_c)

    for i in range(len(sigmas_arr) - 1):
        ax_b.plot(sigmas_arr[i:i+2, 0], sigmas_arr[i:i+2, 1], sigmas_arr[i:i+2, 2],
                  color=colors_b[i], linewidth=2)

    ax_b.scatter(*sigmas_arr[0], color="lime", s=100, zorder=10,
                edgecolors="black", linewidths=0.5, label="00:00")
    ax_b.scatter(*sigmas_arr[-1], color="red", s=100, zorder=10,
                edgecolors="black", linewidths=0.5, label="23:00")
    ax_b.scatter(*sigmas_arr[12], color="gold", s=80, zorder=10,
                edgecolors="black", linewidths=0.5, label="12:00")

    # Unit cube wireframe
    for i in [0, 1]:
        for j in [0, 1]:
            ax_b.plot([i, i], [j, j], [0, 1], "k-", alpha=0.05, linewidth=0.5)
            ax_b.plot([i, i], [0, 1], [j, j], "k-", alpha=0.05, linewidth=0.5)
            ax_b.plot([0, 1], [i, i], [j, j], "k-", alpha=0.05, linewidth=0.5)

    ax_b.set_xlabel("$S_k$", fontsize=8, labelpad=1)
    ax_b.set_ylabel("$S_t$", fontsize=8, labelpad=1)
    ax_b.set_zlabel("$S_e$", fontsize=8, labelpad=1)
    ax_b.set_title("(b) 24h trajectory in $[0,1]^3$", fontsize=10, pad=2)
    ax_b.legend(fontsize=6, loc="upper right")
    ax_b.tick_params(labelsize=6)

    # --- (c) Pairwise distance heatmap ---
    ax_c = fig.add_subplot(gs[0, 2])
    n_hrs = len(sigmas_arr)
    D = np.zeros((n_hrs, n_hrs))
    for i in range(n_hrs):
        for j in range(n_hrs):
            D[i, j] = np.linalg.norm(sigmas_arr[i] - sigmas_arr[j])

    im = ax_c.imshow(D, cmap="viridis", origin="lower", aspect="auto")
    plt.colorbar(im, ax=ax_c, shrink=0.8, label="$d_{\\mathrm{cat}}$")
    ax_c.set_xlabel("Hour")
    ax_c.set_ylabel("Hour")
    ax_c.set_title("(c) Pairwise distance matrix")

    # --- (d) Divergence rate ---
    ax_d = fig.add_subplot(gs[0, 3])
    divergences = []
    for lag in range(1, min(12, n_hrs)):
        dists = [np.linalg.norm(sigmas_arr[i + lag] - sigmas_arr[i])
                 for i in range(n_hrs - lag)]
        divergences.append(np.mean(dists))

    lags = np.arange(1, len(divergences) + 1)
    ax_d.plot(lags, divergences, "ro-", markersize=5, linewidth=1.5, label="Observed")

    # Exponential fit
    log_d = np.log(np.array(divergences) + 1e-30)
    coeffs = np.polyfit(lags, log_d, 1)
    lambda_day = coeffs[0] * 24
    ax_d.plot(lags, np.exp(coeffs[1] + coeffs[0] * lags),
              "b--", linewidth=1.5, label=f"$\\lambda_{{\\mathrm{{eff}}}} = {lambda_day:.2f}$/day")

    # Lorenz reference
    lorenz = divergences[0] * np.exp(1.0 / 24.0 * lags)
    ax_d.plot(lags, lorenz, "k:", linewidth=1, alpha=0.5, label="Lorenz ($\\lambda=1$/day)")

    ax_d.axhline(y=np.sqrt(3), color="gray", linestyle="-", alpha=0.3)
    ax_d.set_xlabel("Time lag (hours)")
    ax_d.set_ylabel("Mean separation")
    ax_d.set_title("(d) Lyapunov analysis")
    ax_d.legend(fontsize=6)
    ax_d.grid(True, alpha=0.2)

    fig.suptitle("Panel 4: Chaos Elimination and Boundedness",
                 fontsize=13, fontweight="bold", y=1.02)
    plt.savefig(os.path.join(FIG_DIR, "panel4_chaos_elimination.png"), dpi=200)
    plt.savefig(os.path.join(FIG_DIR, "panel4_chaos_elimination.pdf"))
    plt.close()
    print("    Saved panel4_chaos_elimination.png/pdf")


# =====================================================================
# PANEL 5: Position Recovery & Inverse Map
# =====================================================================
def panel5_position_recovery(w1, weather, stations, hourly, run_hour, atm):
    """
    (a) Map: true vs recovered positions with error vectors
    (b) 3D: Jacobian sensitivity visualization
    (c) Position error per test point
    (d) Newton-Raphson convergence curves
    """
    print("  Panel 5: Position Recovery...")

    bijection = PositionPartitionBijection(stations)
    center_lat = np.mean([p["lat"] for p in w1])
    center_lon = np.mean([p["lon"] for p in w1])

    # Run inverse map at test points, storing convergence history
    test_indices = [0, 10, 20, 40, 60, 80, min(92, len(w1) - 1)]
    results = []

    for idx in test_indices:
        if idx >= len(w1):
            continue
        p = w1[idx]
        sigma_true = bijection.forward_map(p["lat"], p["lon"], run_hour)
        if sigma_true is None:
            continue

        lat0 = p["lat"] + 0.002
        lon0 = p["lon"] + 0.002

        # Manual Newton-Raphson with convergence tracking
        lat_c, lon_c = lat0, lon0
        residuals = []
        for it in range(50):
            sig_c = bijection.forward_map(lat_c, lon_c, run_hour)
            if sig_c is None:
                break
            res = np.linalg.norm(sigma_true - sig_c)
            residuals.append(res)
            if res < 1e-10:
                break
            J = bijection.compute_jacobian(lat_c, lon_c, run_hour)
            if J is None:
                break
            try:
                delta = np.linalg.lstsq(J, sigma_true - sig_c, rcond=None)[0]
            except np.linalg.LinAlgError:
                break
            lat_c += 0.5 * delta[0] / 111320.0
            lon_c += 0.5 * delta[1] / (111320.0 * np.cos(np.radians(lat_c)))

        err_lat = (lat_c - p["lat"]) * 111320.0
        err_lon = (lon_c - p["lon"]) * 111320.0 * np.cos(np.radians(p["lat"]))
        err_m = np.sqrt(err_lat**2 + err_lon**2)

        results.append({
            "idx": idx, "lat_true": p["lat"], "lon_true": p["lon"],
            "lat_rec": lat_c, "lon_rec": lon_c,
            "err_m": err_m, "residuals": residuals,
            "err_lat_m": err_lat, "err_lon_m": err_lon,
        })

    fig = plt.figure(figsize=(20, 4.5))
    gs = GridSpec(1, 4, figure=fig, wspace=0.32)

    # --- (a) Map with error vectors ---
    ax_a = fig.add_subplot(gs[0, 0])
    # Background stations
    for name, sd in stations.items():
        ax_a.plot(sd["lon"], sd["lat"], "^", color="gray", markersize=5, alpha=0.4)

    # Full GPS track
    lats = [p["lat"] for p in w1]
    lons = [p["lon"] for p in w1]
    ax_a.plot(lons, lats, "b-", linewidth=1, alpha=0.5, label="GPS track")

    # True and recovered positions with arrows
    for r in results:
        ax_a.scatter(r["lon_true"], r["lat_true"], c="green", s=40, zorder=10,
                    edgecolors="black", linewidths=0.5)
        ax_a.scatter(r["lon_rec"], r["lat_rec"], c="red", s=40, zorder=10,
                    marker="x", linewidths=1.5)
        ax_a.annotate("", xy=(r["lon_rec"], r["lat_rec"]),
                      xytext=(r["lon_true"], r["lat_true"]),
                      arrowprops=dict(arrowstyle="->", color="red", lw=1.0))

    ax_a.scatter([], [], c="green", s=40, label="True (GPS)")
    ax_a.scatter([], [], c="red", s=40, marker="x", label="Recovered ($\\Pi^{-1}$)")
    ax_a.set_xlabel("Longitude ($^\\circ$E)")
    ax_a.set_ylabel("Latitude ($^\\circ$N)")
    ax_a.set_title("(a) Position recovery")
    ax_a.legend(fontsize=6, loc="upper left")
    ax_a.ticklabel_format(useOffset=False)

    # --- (b) 3D: Jacobian eigenvector sensitivity ---
    ax_b = fig.add_subplot(gs[0, 1], projection="3d")
    J = bijection.compute_jacobian(center_lat, center_lon, run_hour)
    sigma_c = bijection.forward_map(center_lat, center_lon, run_hour)

    if J is not None and sigma_c is not None:
        # SVD of Jacobian
        U, s_vals, Vt = np.linalg.svd(J, full_matrices=False)

        # Plot center point
        ax_b.scatter(*sigma_c, color="red", s=100, zorder=10)

        # Plot Jacobian columns as vectors (scaled for visibility)
        scale = 0.01
        colors_jac = ["#4477AA", "#EE6677"]
        labels_jac = ["$\\partial\\Sigma/\\partial y$", "$\\partial\\Sigma/\\partial x$"]
        for col in range(2):
            v = J[:, col] * scale * 1e9  # scale to visible
            ax_b.quiver(sigma_c[0], sigma_c[1], sigma_c[2],
                       v[0], v[1], v[2],
                       color=colors_jac[col], linewidth=2.5, arrow_length_ratio=0.2,
                       label=labels_jac[col])

        # Show all test points' S-entropy
        for r in results:
            sig = bijection.forward_map(r["lat_true"], r["lon_true"], run_hour)
            if sig is not None:
                ax_b.scatter(*sig, color="green", s=30, alpha=0.7)

    ax_b.set_xlabel("$S_k$", fontsize=8, labelpad=1)
    ax_b.set_ylabel("$S_t$", fontsize=8, labelpad=1)
    ax_b.set_zlabel("$S_e$", fontsize=8, labelpad=1)
    ax_b.set_title("(b) Jacobian sensitivity", fontsize=10, pad=2)
    ax_b.legend(fontsize=6)
    ax_b.tick_params(labelsize=6)

    # --- (c) Position error bar chart ---
    ax_c = fig.add_subplot(gs[0, 2])
    err_vals = [r["err_m"] for r in results]
    point_labels = [f"P{r['idx']}" for r in results]
    colors_err = plt.cm.RdYlGn_r(np.array(err_vals) / max(err_vals))
    bars = ax_c.bar(point_labels, err_vals, color=colors_err, edgecolor="black", linewidth=0.5)
    ax_c.axhline(y=np.mean(err_vals), color="red", linestyle="--", linewidth=1,
                label=f"Mean = {np.mean(err_vals):.0f} m")
    ax_c.axhline(y=np.median(err_vals), color="blue", linestyle=":", linewidth=1,
                label=f"Median = {np.median(err_vals):.0f} m")
    ax_c.set_xlabel("Test point")
    ax_c.set_ylabel("Position error (m)")
    ax_c.set_title("(c) Recovery error")
    ax_c.legend(fontsize=6)
    ax_c.grid(True, alpha=0.2, axis="y")

    # --- (d) Convergence curves ---
    ax_d = fig.add_subplot(gs[0, 3])
    cmap_conv = plt.cm.tab10
    for i, r in enumerate(results):
        if r["residuals"]:
            ax_d.semilogy(range(len(r["residuals"])), r["residuals"],
                         "-", color=cmap_conv(i / len(results)),
                         linewidth=1.2, label=f"P{r['idx']}")
    ax_d.axhline(y=1e-10, color="green", linestyle="--", linewidth=1, alpha=0.5,
                label="Tolerance")
    ax_d.set_xlabel("Newton-Raphson iteration")
    ax_d.set_ylabel("$\\|\\Sigma_{\\mathrm{target}} - \\Sigma(\\hat{r})\\|$")
    ax_d.set_title("(d) Convergence")
    ax_d.legend(fontsize=5, ncol=2)
    ax_d.grid(True, alpha=0.2)

    fig.suptitle("Panel 5: Position Recovery via Inverse Map",
                 fontsize=13, fontweight="bold", y=1.02)
    plt.savefig(os.path.join(FIG_DIR, "panel5_position_recovery.png"), dpi=200)
    plt.savefig(os.path.join(FIG_DIR, "panel5_position_recovery.pdf"))
    plt.close()
    print("    Saved panel5_position_recovery.png/pdf")


# =====================================================================
# Main
# =====================================================================
if __name__ == "__main__":
    print("=" * 70)
    print("GENERATING PUBLICATION PANEL FIGURES")
    print("=" * 70)

    w1, w2, weather, stations, hourly, run_hour, atm = load_all_data()

    panel1_displacement_substrate(w1, weather, stations, hourly, run_hour, atm)
    panel2_sentropy_bijection(w1, weather, stations, hourly, run_hour, atm)
    panel3_temporal_prediction(w1, weather, stations, hourly, run_hour, atm)
    panel4_chaos_elimination(w1, weather, stations, hourly, run_hour, atm)
    panel5_position_recovery(w1, weather, stations, hourly, run_hour, atm)

    print("\n" + "=" * 70)
    print(f"All 5 panels saved to: {FIG_DIR}")
    print("=" * 70)
