#!/usr/bin/env python3
"""
compute_12m_means.py
====================
Computes true 12-month annual area-weighted means for:
  - Air Quality: NASA MODIS Terra Collection 6.1 (MOD08_M3) AOD at 550nm
  - Vegetation Greenness: NASA MODIS Terra Collection 6.1 (MOD13C2) 0.05° CMG NDVI
across 2003–2025.

Outputs:
  - Saves all finished numbers, monthly values, and exact file lists to data/reference-series.json
  - Warns about any missing or failed month
  - DOES NOT modify database.js or any other source files
"""

import os
import sys
import json
import time
import socket
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from pyhdf.SD import SD, SDC
import earthaccess

# Set global TCP socket timeout so hung reads never block indefinitely
socket.setdefaulttimeout(60.0)

TOKEN = os.environ.get(
    "EARTHDATA_TOKEN",
    "eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6ImhhcmlfMDIwNiIsInN1YiI6ImhhcmlfMDIwNiIsImV4cCI6MTc5OTc1NTU1OSwiaWF0IjoxNzk0NTcxNTU5LCJpc3MiOiJodHRwczovL3Vycy5lYXJ0aGRhdGEubmFzYS5nb3YiLCJpZGVudGl0eV9wcm92aWRlciI6ImVkbF9vcHMiLCJhY3IiOiJlZGwiLCJhc3N1cmFuY2VfbGV2ZWwiOjN9.V-m1rvZj0AbJB0W-ejVVe32RcXZf-vaQRGqRk0W9eWoXhRSMBOM4Hl4PM5cR3tUY2ZSC7A9n3WdRB9rWddPYpbVVUmV5MZcetsnJJ4Uu7qkhviqN4CyaRyMGhVmSNAfdllBqqjHnaFBtmTzU2guAUKdvmL4bISseW9X9u-COV7xODVUw3ddrJeNxguD93-_T3p3eO7AxOyBCCfOdu89HSUYPNcyyT6gYmyjF08c1XsJwEtNilSOprpeVM0VK_YEBxeOrKPDScbHCkmPcAs-0oubjFnJR-th_V7o8j1n054TWMdxL1eLyr9S3k7BkZPikDLseIKB-LNPtHF0j3ywssA"
)

PROGRESS_FILE = Path("data/modis_12m_progress.json")
REF_SERIES_FILE = Path("data/reference-series.json")


def get_session():
    os.environ["EARTHDATA_TOKEN"] = TOKEN
    earthaccess.login(strategy="environment")
    return earthaccess.get_requests_https_session()


def calc_aod_from_file(hdf_path):
    sd = SD(str(hdf_path), SDC.READ)
    arr = sd.select("Aerosol_Optical_Depth_Land_Ocean_Mean_Mean")[:].astype(np.float64)
    sd.end()
    # Mask fill (-9999) and negative AOD values; scale factor 0.001
    masked = np.ma.masked_where((arr == -9999) | (arr * 0.001 < 0), arr * 0.001)
    lats = np.linspace(89.5, -89.5, arr.shape[0])
    weights = np.tile(np.cos(np.deg2rad(lats)).reshape(-1, 1), (1, arr.shape[1]))
    w_masked = np.ma.array(weights, mask=masked.mask)
    return float(np.ma.average(masked, weights=w_masked))


def calc_ndvi_from_file(hdf_path):
    sd = SD(str(hdf_path), SDC.READ)
    arr = sd.select("CMG 0.05 Deg Monthly NDVI")[:].astype(np.float64)
    sd.end()
    # Mask fill (-3000) and water/non-vegetated land (NDVI < 0); scale factor 0.0001
    masked = np.ma.masked_where((arr == -3000) | (arr * 0.0001 < 0), arr * 0.0001)
    lats = np.linspace(89.975, -89.975, arr.shape[0])
    weights = np.tile(np.cos(np.deg2rad(lats)).reshape(-1, 1), (1, arr.shape[1]))
    w_masked = np.ma.array(weights, mask=masked.mask)
    return float(np.ma.average(masked, weights=w_masked))


def process_monthly_granule(session, url, product, year, month, retries=3):
    raw_fname = url.split("/")[-1]
    tmp_path = Path(f"tmp_{product}_{year}_{month:02d}_{raw_fname}")
    last_err = None
    
    for attempt in range(1, retries + 1):
        try:
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
            with session.get(url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(tmp_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=4 * 1024 * 1024):
                        if chunk:
                            f.write(chunk)
            if product == "MOD08_M3":
                val = calc_aod_from_file(tmp_path)
            else:
                val = calc_ndvi_from_file(tmp_path)
            return round(val, 4), raw_fname
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(attempt * 2)
        finally:
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
    raise RuntimeError(f"Failed after {retries} attempts: {last_err}")


def find_granule_for_month(product, year, month):
    start_day = f"{year}-{month:02d}-01"
    if month == 12:
        end_day = f"{year+1}-01-01"
    else:
        end_day = f"{year}-{month+1:02d}-01"
    
    results = earthaccess.search_data(short_name=product, temporal=(start_day, end_day), count=5)
    for g in results:
        b_dt = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]
        if b_dt.startswith(f"{year}-{month:02d}") or (month == 1 and b_dt.startswith(f"{year}-01")):
            return g.data_links()[0]
    if results:
        return results[0].data_links()[0]
    return None


def run_year(session, year, product, progress, max_workers=2):
    prod_key = "aod" if product == "MOD08_M3" else "ndvi"
    year_str = str(year)
    if year_str not in progress[prod_key]:
        progress[prod_key][year_str] = {"monthly": {}, "granules": {}, "annual_mean": None}
    
    ydata = progress[prod_key][year_str]
    missing_months = [m for m in range(1, 13) if str(m) not in ydata["monthly"]]
    
    if not missing_months and ydata.get("annual_mean") is not None:
        print(f"[{product}] Year {year} already completed: mean = {ydata['annual_mean']}", flush=True)
        return ydata["annual_mean"]

    print(f"\n[{product}] Processing year {year} ({len(missing_months)} months remaining)...", flush=True)
    
    month_urls = {}
    for m in missing_months:
        url = find_granule_for_month(product, year, m)
        if url:
            month_urls[m] = url
        else:
            warn = f"WARNING: No granule found for {product} {year}-{m:02d}"
            print(f"  {warn}", flush=True)
            if "warnings" not in progress:
                progress["warnings"] = []
            if warn not in progress["warnings"]:
                progress["warnings"].append(warn)

    def _worker(m_url):
        m, u = m_url
        val, fn = process_monthly_granule(session, u, product, year, m)
        return m, val, fn

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_worker, (m, u)): m for m, u in month_urls.items()}
        for fut in as_completed(futures):
            m = futures[fut]
            try:
                m_ret, val, fn = fut.result()
                ydata["monthly"][str(m_ret)] = val
                ydata["granules"][str(m_ret)] = fn
                save_progress(progress)
                print(f"  [{product}] {year}-{m_ret:02d}: {val} ({fn})", flush=True)
            except Exception as e:
                err_msg = f"ERROR: Failed to download or process {product} {year}-{m:02d}: {e}"
                print(f"  {err_msg}", flush=True)
                if "warnings" not in progress:
                    progress["warnings"] = []
                if err_msg not in progress["warnings"]:
                    progress["warnings"].append(err_msg)

    if len(ydata["monthly"]) == 12:
        vals = [ydata["monthly"][str(m)] for m in range(1, 13)]
        annual = round(float(np.mean(vals)), 3)
        ydata["annual_mean"] = annual
        print(f"[{product}] Completed year {year} 12-month mean: {annual}", flush=True)
    elif len(ydata["monthly"]) > 0:
        vals = list(ydata["monthly"].values())
        ydata["annual_mean"] = round(float(np.mean(vals)), 3)
        warn = f"WARNING: Partial year {year} ({len(vals)}/12 months) for {product}, mean: {ydata['annual_mean']}"
        print(f"[{product}] {warn}", flush=True)
        if "warnings" not in progress:
            progress["warnings"] = []
        if warn not in progress["warnings"]:
            progress["warnings"].append(warn)

    save_progress(progress)
    sync_to_reference_series(progress)
    return ydata.get("annual_mean")


def load_progress():
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"aod": {}, "ndvi": {}, "warnings": []}


def save_progress(data):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def sync_to_reference_series(progress):
    try:
        ref_data = {}
        if REF_SERIES_FILE.exists():
            ref_data = json.loads(REF_SERIES_FILE.read_text(encoding="utf-8"))

        ref_data["modis_aod_12m"] = {}
        ref_data["modis_ndvi_12m"] = {}
        ref_data["modis_aod_monthly_details"] = {}
        ref_data["modis_ndvi_monthly_details"] = {}

        for yr in sorted(progress.get("aod", {}).keys(), key=int):
            d = progress["aod"][yr]
            if d.get("annual_mean") is not None:
                ref_data["modis_aod_12m"][yr] = d["annual_mean"]
            
            ref_data["modis_aod_monthly_details"][yr] = {
                "annual_mean": d.get("annual_mean"),
                "months": {
                    str(m): {
                        "value": d.get("monthly", {}).get(str(m)),
                        "granule": d.get("granules", {}).get(str(m))
                    }
                    for m in range(1, 13)
                }
            }

        for yr in sorted(progress.get("ndvi", {}).keys(), key=int):
            d = progress["ndvi"][yr]
            if d.get("annual_mean") is not None:
                ref_data["modis_ndvi_12m"][yr] = d["annual_mean"]
            
            ref_data["modis_ndvi_monthly_details"][yr] = {
                "annual_mean": d.get("annual_mean"),
                "months": {
                    str(m): {
                        "value": d.get("monthly", {}).get(str(m)),
                        "granule": d.get("granules", {}).get(str(m))
                    }
                    for m in range(1, 13)
                }
            }

        ref_data["warnings"] = progress.get("warnings", [])
        REF_SERIES_FILE.write_text(json.dumps(ref_data, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"Error syncing to reference-series.json: {e}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Compute true 12-month means for MODIS AOD & NDVI")
    parser.add_argument("--years", nargs="+", type=int, default=list(range(2003, 2026)))
    parser.add_argument("--products", nargs="+", default=["MOD08_M3", "MOD13C2"])
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    session = get_session()
    progress = load_progress()

    for prod in args.products:
        print(f"\n==========================================", flush=True)
        print(f"Starting {prod} for years: {args.years}", flush=True)
        print(f"==========================================", flush=True)
        for y in args.years:
            run_year(session, y, prod, progress, max_workers=args.workers)

    sync_to_reference_series(progress)
    print("\nAll requested 12-month processing complete. Saved to data/reference-series.json.", flush=True)


if __name__ == "__main__":
    main()
