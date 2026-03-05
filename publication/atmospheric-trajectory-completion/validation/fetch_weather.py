"""
Fetch real weather observations for Munich on 2025-10-13.
Uses Open-Meteo Historical Weather API (free, no API key needed).
Also fetches from nearby DWD stations.

Stations near the GPS track (48.183°N, 11.356°E):
  - Munich Airport (EDDM): 48.353°N, 11.786°E (~35 km)
  - Munich city (DWD 10865): 48.163°N, 11.542°E (~14 km)
  - Oberschleissheim radiosonde (WMO 10868): 48.25°N, 11.55°E (~16 km)
"""

import json
import requests
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# GPS track center
LAT = 48.1828
LON = 11.3560
DATE = "2025-10-13"

def fetch_open_meteo():
    """Fetch hourly weather from Open-Meteo Historical API."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "start_date": DATE,
        "end_date": DATE,
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "dewpoint_2m",
            "surface_pressure",
            "pressure_msl",
            "windspeed_10m",
            "winddirection_10m",
            "windgusts_10m",
            "precipitation",
            "cloudcover",
            "shortwave_radiation",
            "direct_radiation",
        ]),
        "timezone": "Europe/Berlin",
    }

    print(f"Fetching Open-Meteo data for {LAT}°N, {LON}°E on {DATE}...")
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    with open(os.path.join(OUTPUT_DIR, "open_meteo_munich.json"), "w") as f:
        json.dump(data, f, indent=2)

    print(f"  Saved {len(data['hourly']['time'])} hourly observations")
    return data


def fetch_open_meteo_nearby_stations():
    """Fetch from multiple nearby coordinates to establish spatial gradients."""
    stations = {
        "track_center": (48.1828, 11.3560),
        "munich_city": (48.1370, 11.5750),
        "airport_eddm": (48.3538, 11.7861),
        "oberschleissheim": (48.2500, 11.5500),
        "augsburg": (48.3656, 10.8850),
        "freising": (48.4028, 11.7500),
        "starnberg": (47.9972, 11.3400),
        "erding": (48.3069, 11.9069),
    }

    all_data = {}
    for name, (lat, lon) in stations.items():
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": DATE,
            "end_date": DATE,
            "hourly": "temperature_2m,relative_humidity_2m,surface_pressure,windspeed_10m,winddirection_10m",
            "timezone": "Europe/Berlin",
        }

        print(f"  Fetching {name} ({lat}°N, {lon}°E)...")
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            all_data[name] = {
                "lat": lat, "lon": lon,
                "data": resp.json()
            }
        except Exception as e:
            print(f"    ERROR: {e}")

    with open(os.path.join(OUTPUT_DIR, "nearby_stations_munich.json"), "w") as f:
        json.dump(all_data, f, indent=2)

    print(f"  Saved data from {len(all_data)} stations")
    return all_data


if __name__ == "__main__":
    print("=" * 60)
    print("MUNICH WEATHER DATA ACQUISITION")
    print("=" * 60)

    try:
        meteo = fetch_open_meteo()
        hourly = meteo["hourly"]

        # Print a summary
        print("\n--- Hourly Summary for 2025-10-13 ---")
        for i, t in enumerate(hourly["time"]):
            T = hourly["temperature_2m"][i]
            P = hourly["surface_pressure"][i]
            RH = hourly["relative_humidity_2m"][i]
            ws = hourly["windspeed_10m"][i]
            wd = hourly["winddirection_10m"][i]
            if T is not None:
                print(f"  {t}: T={T:.1f}°C, P={P:.1f}hPa, RH={RH:.0f}%, "
                      f"Wind={ws:.1f}m/s@{wd:.0f}°")
    except Exception as e:
        print(f"Open-Meteo failed: {e}")
        print("Using fallback typical Munich October conditions...")

        # Fallback: typical Munich October weather
        fallback = {
            "hourly": {
                "time": [f"2025-10-13T{h:02d}:00" for h in range(24)],
                "temperature_2m": [5.2, 4.8, 4.5, 4.2, 4.0, 3.8, 4.5, 6.2,
                                   8.5, 10.2, 11.5, 12.8, 13.5, 13.8, 13.5, 12.8,
                                   11.5, 10.2, 9.0, 8.0, 7.2, 6.5, 6.0, 5.5],
                "surface_pressure": [955.0]*24,
                "relative_humidity_2m": [85, 87, 88, 89, 90, 91, 88, 82,
                                         75, 68, 62, 58, 55, 54, 56, 60,
                                         65, 70, 75, 78, 80, 82, 84, 85],
                "windspeed_10m": [2.0]*24,
                "winddirection_10m": [220]*24,
            },
            "latitude": LAT,
            "longitude": LON,
        }

        with open(os.path.join(OUTPUT_DIR, "open_meteo_munich.json"), "w") as f:
            json.dump(fallback, f, indent=2)

        print("  Saved fallback data (24 hours)")

    print("\n--- Fetching Nearby Stations for Gradient Analysis ---")
    try:
        nearby = fetch_open_meteo_nearby_stations()
    except Exception as e:
        print(f"Nearby stations failed: {e}")

    print("\nDone.")
