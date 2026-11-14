#!/usr/bin/env python3
"""
build_provenance_md.py
Generates data/PROVENANCE.md listing every monthly file used with per-month values.
"""

import json
from pathlib import Path

def main():
    d = json.load(open('data/reference-series.json', encoding='utf-8'))
    aod_details = d.get('modis_aod_monthly_details', {})
    ndvi_details = d.get('modis_ndvi_monthly_details', {})
    aod_12m = d.get('modis_aod', {})
    ndvi_12m = d.get('modis_ndvi', {})
    rain = d.get('gpcp_rain_mmday', {})

    lines = [
        "# Earth Jukebox: Observational Data Provenance & Granule Archive",
        "",
        "> **NASA Space Apps Challenge:** The Earth Information Jukebox",
        "",
        "This document records the exact observational data provenance, spherical area-weighting methodology, and the complete archive of monthly satellite granules processed across 2003–2025 for **Air Quality (`air`)**, **Vegetation Greenness (`greenness`)**, and **Precipitation (`rainfall`)**.",
        "",
        "## 1. Methodology & Spherical Weighting",
        "",
        "- **Air Quality (NASA MODIS Terra Collection 6.1 `MOD08_M3`):** Level-3 monthly global 1° grid SDS `Aerosol_Optical_Depth_Land_Ocean_Mean_Mean`. Scale factor: `0.001`, Fill value: `-9999` (masked along with non-physical negative values). Annual mean computed as the area-weighted average using $\\cos(\\text{latitude})$ across all 12 calendar monthly grids.",
        "- **Vegetation Greenness (NASA MODIS Terra Collection 6.1 `MOD13C2`):** Level-3 monthly global 0.05° Climate Modeling Grid (CMG) SDS `CMG 0.05 Deg Monthly NDVI`. Scale factor: `0.0001`, Fill value: `-3000`. Masked for water and non-vegetated land ($NDVI < 0$). Annual mean computed as the area-weighted average using $\\cos(\\text{latitude})$ across all 12 calendar monthly grids.",
        "- **Precipitation (NOAA / NASA GPCP Version 2.3):** Monthly 2.5° global NetCDF-4 variable `precip`. Area-weighted annual average across all 12 calendar monthly grids.",
        "",
        "## 2. Annual 12-Month Summary Series (2003–2025)",
        "",
        "| Year | Air Quality (`air`)<br>12-Mo AOD 550nm | Vegetation Greenness (`greenness`)<br>12-Mo NDVI | Precipitation (`rainfall`)<br>GPCP mm/day |",
        "|:---:|:---:|:---:|:---:|",
    ]

    for y in range(2003, 2026):
        sy = str(y)
        lines.append(f"| **{y}** | {aod_12m.get(sy, '')} | {ndvi_12m.get(sy, '')} | {rain.get(sy, '')} |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Air Quality (`MOD08_M3`) Monthly Granules Archive (276 Files)",
        "",
        "| Year | Month | Monthly Value | HDF Granule Filename |",
        "|:---:|:---:|:---:|:---|",
    ])

    for y in range(2003, 2026):
        sy = str(y)
        mdict = aod_details.get(sy, {}).get('months', {})
        for m in range(1, 13):
            sm = str(m)
            mdata = mdict.get(sm, {})
            val = mdata.get('value', '')
            fn = mdata.get('granule', '')
            lines.append(f"| {y} | {m:02d} | {val} | `{fn}` |")

    lines.extend([
        "",
        "---",
        "",
        "## 4. Vegetation Greenness (`MOD13C2`) Monthly Granules Archive (276 Files)",
        "",
        "| Year | Month | Monthly Value | HDF Granule Filename |",
        "|:---:|:---:|:---:|:---|",
    ])

    for y in range(2003, 2026):
        sy = str(y)
        mdict = ndvi_details.get(sy, {}).get('months', {})
        for m in range(1, 13):
            sm = str(m)
            mdata = mdict.get(sm, {})
            val = mdata.get('value', '')
            fn = mdata.get('granule', '')
            lines.append(f"| {y} | {m:02d} | {val} | `{fn}` |")

    lines.append("")
    Path('data/PROVENANCE.md').write_text("\n".join(lines), encoding='utf-8')
    print(f"Generated data/PROVENANCE.md successfully ({len(lines)} lines).")

if __name__ == '__main__':
    main()

