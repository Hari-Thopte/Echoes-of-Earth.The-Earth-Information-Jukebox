#!/usr/bin/env python3
"""
fetch-reference-data.py
=======================
Downloads real MODIS and GPCP annual global-mean series for the
Earth Jukebox's air (AOD), greenness (NDVI), and rainfall (mm/d) domains
and prints updated database.js seed arrays ready to paste in.

Sources
-------
  GPCP v2.3   – NOAA NCEI (no auth required)
                https://www.ncei.noaa.gov/data/global-precipitation-climatology-project-gpcp-monthly/access/
  MOD08_M3    – NASA LAADS DAAC (free Earthdata token required)
                https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/61/MOD08_M3/
  MOD13C2     – NASA LAADS DAAC (free Earthdata token required)
                https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/61/MOD13C2/

Requirements
------------
  pip install h5py numpy pyhdf requests

Earthdata token (free, one-time)
---------------------------------
  1. Register at https://urs.earthdata.nasa.gov/
  2. Generate a bearer token at https://urs.earthdata.nasa.gov/user-tokens
  3. Set env var:  EARTHDATA_TOKEN=<your_token>
     Or pass --token <your_token> on the command line.
     Without a token only GPCP is fetched; MODIS sections are skipped.

Usage
-----
  # GPCP only (no token needed):
  python scripts/fetch-reference-data.py --years 2003 2025 --out data/

  # All three datasets:
  EARTHDATA_TOKEN=your_token python scripts/fetch-reference-data.py --years 2003 2025 --out data/
"""

import argparse
import os
import sys
import re
import json
import struct
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

try:
    import numpy as np
except ImportError:
    sys.exit("numpy not found — pip install numpy")

try:
    import h5py
except ImportError:
    sys.exit("h5py not found — pip install h5py")

GPCP_BASE = "https://www.ncei.noaa.gov/data/global-precipitation-climatology-project-gpcp-monthly/access"
LAADS_BASE = "https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/61"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _get(url, token=None, out_path=None, timeout=30):
    """HTTP GET with optional Bearer token. Returns bytes or writes to out_path."""
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "earth-jukebox-fetch/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise RuntimeError(f"401 Unauthorized at {url} — check your EARTHDATA_TOKEN")
        raise RuntimeError(f"HTTP {e.code} at {url}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"URL error at {url}: {e.reason}")

    if out_path:
        Path(out_path).write_bytes(data)
        return out_path
    return data


def _list_laads(year, product, token):
    """Return list of HDF filenames for the January month of a given year (DOY 001)."""
    url = f"{LAADS_BASE}/{product}/{year}/001/"
    html = _get(url, token=token).decode("utf-8", errors="replace")
    return re.findall(rf"{product}[^\s\"<>]+\.hdf", html)


# ---------------------------------------------------------------------------
# GPCP: area-weighted annual mean precipitation (mm/day)
# No auth required. Files are HDF5 (GPCP v2.3 monthly NetCDF-4).
# ---------------------------------------------------------------------------

def fetch_gpcp_year(year, cache_dir):
    """Return area-weighted annual mean precipitation in mm/day for a given year."""
    monthly = []
    for m in range(1, 13):
        mm = f"{m:02d}"
        fname = f"gpcp_v02r03_monthly_d{year}{mm}_c20170616.nc"
        local = Path(cache_dir) / fname
        if not local.exists():
            url = f"{GPCP_BASE}/{year}/{fname}"
            try:
                _get(url, out_path=local)
            except RuntimeError:
                # Some months (especially 2024/2025) may use a later creation date stamp
                # Try listing the directory to find the actual filename
                try:
                    dir_html = _get(f"{GPCP_BASE}/{year}/").decode("utf-8", errors="replace")
                    candidates = re.findall(rf"gpcp_v02r03_monthly_d{year}{mm}_c\d+\.nc", dir_html)
                    if candidates:
                        url = f"{GPCP_BASE}/{year}/{candidates[0]}"
                        fname = candidates[0]
                        local = Path(cache_dir) / fname
                        if not local.exists():
                            _get(url, out_path=local)
                    else:
                        print(f"  [GPCP] WARNING: no file found for {year}-{mm}, skipping month", file=sys.stderr)
                        continue
                except Exception as e2:
                    print(f"  [GPCP] WARNING: {e2}, skipping month {year}-{mm}", file=sys.stderr)
                    continue

        try:
            with h5py.File(local, "r") as hf:
                d = hf["precip"][0]            # (72, 144)
                lats = hf["latitude"][:]        # (72,)
                masked = np.ma.masked_where(d < 0, d)
                weights = np.cos(np.deg2rad(lats))
                w2d = np.tile(weights.reshape(-1, 1), (1, d.shape[1]))
                w_masked = np.ma.array(w2d, mask=masked.mask)
                monthly.append(float(np.ma.average(masked, weights=w_masked)))
        except Exception as e:
            print(f"  [GPCP] WARNING: failed to parse {local}: {e}", file=sys.stderr)

    if not monthly:
        raise RuntimeError(f"No GPCP data for {year}")
    return round(sum(monthly) / len(monthly), 3)


# ---------------------------------------------------------------------------
# MODIS: MOD08_M3 (AOD) and MOD13C2 (NDVI)
# Requires NASA Earthdata bearer token.
# Files are HDF4 (classic) — parsed with pyhdf.
# ---------------------------------------------------------------------------

def _require_pyhdf():
    try:
        from pyhdf.SD import SD, SDC
        return SD, SDC
    except ImportError:
        sys.exit("pyhdf not found — pip install pyhdf")


def fetch_modis_year(year, product, sds_name, scale_factor, fill_value, token, cache_dir):
    """
    Return area-weighted global annual mean of a MODIS Level-3 monthly CMG product.
    Averages across the 12 monthly files for the year.
    """
    SD, SDC = _require_pyhdf()
    monthly = []

    for doy_start in _month_doys(year):
        doy_str = f"{doy_start:03d}"
        url_dir = f"{LAADS_BASE}/{product}/{year}/{doy_str}/"
        try:
            dir_html = _get(url_dir, token=token).decode("utf-8", errors="replace")
        except RuntimeError as e:
            print(f"  [MODIS/{product}] WARNING: {e}", file=sys.stderr)
            continue

        hdfs = re.findall(rf"{product}[^\s\"<>]+\.hdf", dir_html)
        if not hdfs:
            print(f"  [MODIS/{product}] WARNING: no .hdf in {url_dir}", file=sys.stderr)
            continue

        hdf_name = hdfs[0]
        local = Path(cache_dir) / hdf_name
        if not local.exists():
            hdf_url = f"{LAADS_BASE}/{product}/{year}/{doy_str}/{hdf_name}"
            try:
                _get(hdf_url, token=token, out_path=local)
            except RuntimeError as e:
                print(f"  [MODIS/{product}] WARNING: {e}", file=sys.stderr)
                continue

        try:
            sd = SD(str(local), SDC.READ)
            sds = sd.select(sds_name)
            data = sds[:].astype(np.float64)
            sd.end()

            # Apply scale/fill masking
            masked = np.ma.masked_where(
                (data == fill_value) | (data * scale_factor < -0.1),
                data * scale_factor,
            )

            # Area-weighted mean using CMG 1-degree lat grid centred at each row
            nlat, nlon = masked.shape
            lats = np.linspace(89.5, -89.5, nlat)
            weights = np.cos(np.deg2rad(lats))
            w2d = np.tile(weights.reshape(-1, 1), (1, nlon))
            w_masked = np.ma.array(w2d, mask=masked.mask)
            monthly.append(float(np.ma.average(masked, weights=w_masked)))
        except Exception as e:
            print(f"  [MODIS/{product}] WARNING: parse error {local.name}: {e}", file=sys.stderr)

    if not monthly:
        raise RuntimeError(f"No {product} data for {year}")
    return round(sum(monthly) / len(monthly), 3)


def _month_doys(year):
    """Return list of day-of-year integers for the first day of each month."""
    import calendar
    doy = 1
    result = []
    for m in range(1, 13):
        result.append(doy)
        doy += calendar.monthrange(year, m)[1]
    return result


# ---------------------------------------------------------------------------
# output helpers
# ---------------------------------------------------------------------------

def _js_array(label, year_values, unit=""):
    lines = ["  " + label + ": ["]
    items = list(year_values.items())
    for i in range(0, len(items), 3):
        chunk = items[i:i+3]
        row = ", ".join(f"{{ year: {y}, value: {v} }}" for y, v in chunk)
        sep = "," if i + 3 < len(items) else ""
        lines.append(f"    {row}{sep}")
    lines.append("  ],")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", nargs=2, type=int, default=[2003, 2025], metavar=("START", "END"),
                    help="Inclusive year range (default: 2003 2025)")
    ap.add_argument("--out", default="data", metavar="DIR",
                    help="Cache directory for downloaded files (default: data/)")
    ap.add_argument("--token", default=os.environ.get("EARTHDATA_TOKEN", ""),
                    help="NASA Earthdata bearer token (or set EARTHDATA_TOKEN env var)")
    ap.add_argument("--gpcp-only", action="store_true",
                    help="Skip MODIS (useful without an Earthdata token)")
    args = ap.parse_args()

    start_yr, end_yr = args.years
    years = list(range(start_yr, end_yr + 1))
    token = args.token.strip()
    out_dir = Path(args.out)

    gpcp_dir = out_dir / "gpcp"; gpcp_dir.mkdir(parents=True, exist_ok=True)
    aod_dir  = out_dir / "mod08_m3"; aod_dir.mkdir(parents=True, exist_ok=True)
    ndvi_dir = out_dir / "mod13c2"; ndvi_dir.mkdir(parents=True, exist_ok=True)

    # --- GPCP ---
    print(f"\n=== GPCP v2.3 (precipitation, mm/day) ===")
    rain = {}
    for y in years:
        try:
            v = fetch_gpcp_year(y, gpcp_dir)
            rain[y] = v
            print(f"  {y}: {v}")
        except Exception as e:
            print(f"  {y}: ERROR — {e}", file=sys.stderr)

    # --- MODIS ---
    aod = {}
    ndvi = {}

    if args.gpcp_only:
        print("\nSkipping MODIS (--gpcp-only flag set).")
    elif not token:
        print("\nNo EARTHDATA_TOKEN — skipping MODIS AOD and NDVI.")
        print("To fetch real MODIS data:")
        print("  1. Register free at https://urs.earthdata.nasa.gov/")
        print("  2. Generate token at https://urs.earthdata.nasa.gov/user-tokens")
        print("  3. Run:  EARTHDATA_TOKEN=<token> python scripts/fetch-reference-data.py")
    else:
        # MOD08_M3: Aerosol_Optical_Depth_Land_Ocean_Mean_Mean
        # Scale factor 0.001, fill value -9999 (check product spec)
        print(f"\n=== MOD08_M3 C6.1 (AOD 550nm, land+ocean mean) ===")
        for y in years:
            try:
                v = fetch_modis_year(
                    y, "MOD08_M3", "Aerosol_Optical_Depth_Land_Ocean_Mean_Mean",
                    scale_factor=0.001, fill_value=-9999,
                    token=token, cache_dir=aod_dir
                )
                aod[y] = v
                print(f"  {y}: {v}")
            except Exception as e:
                print(f"  {y}: ERROR — {e}", file=sys.stderr)

        # MOD13C2: NDVI — 1-degree CMG, scale factor 0.0001
        print(f"\n=== MOD13C2 C6.1 (NDVI) ===")
        for y in years:
            try:
                v = fetch_modis_year(
                    y, "MOD13C2", "CMG 0.05 Deg Monthly NDVI",
                    scale_factor=0.0001, fill_value=-3000,
                    token=token, cache_dir=ndvi_dir
                )
                ndvi[y] = v
                print(f"  {y}: {v}")
            except Exception as e:
                print(f"  {y}: ERROR — {e}", file=sys.stderr)

    # --- print JS seed arrays ---
    print("\n\n=== database.js seed arrays (paste into SEED_DOMAIN_METRICS) ===\n")

    if rain:
        print(_js_array("rainfall", rain, "mm/d"))
        print()
    if aod:
        print(_js_array("air (AOD)", aod))
        print()
    if ndvi:
        print(_js_array("greenness (NDVI)", ndvi))
        print()

    # --- save JSON summary ---
    summary = {"gpcp_rain_mmday": rain, "modis_aod": aod, "modis_ndvi": ndvi}
    summary_path = out_dir / "reference-series.json"
    summary_path.write_text(json.dumps(summary, indent=2))
    print(f"\nSaved summary: {summary_path}")


if __name__ == "__main__":
    main()

