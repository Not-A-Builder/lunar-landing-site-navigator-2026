#!/usr/bin/env bash
# Download the raw NASA layers used by the terrain pipeline and /api/terrain into data/raw/ (git-ignored).
# Sources and their use are listed in docs/data-sources.md. ~500 MB total; PDS serves at ~200 KB/s.
set -euo pipefail
cd "$(dirname "$0")/../data/raw" 2>/dev/null || { mkdir -p "$(dirname "$0")/../data/raw"; cd "$(dirname "$0")/../data/raw"; }
PDS=https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx
get() { [ -s "$2" ] && echo "have $2" || { echo "get $2"; curl -fsSL -o "$2" "$1"; }; }
get $PDS/data/lola_gdr/polar/img/ldem_75s_120m.img ldem_75s_120m.img &
get $PDS/data/lola_gdr/cylindrical/img/ldem_16.img ldem_16.img &
get $PDS/extras/illumination/img/avgvisib_75s_120m_201608.img avgvisib_75s_120m_sun.img &
get $PDS/extras/illumination/img/avgvisib_75s_120m_201608_earth.img avgvisib_75s_120m_earth.img &
get https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP psr_south.zip &
get https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip moon_nomenclature.zip &
get https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_summer_max-float.tif diviner_south80_summer_max.tif &
get https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_winter_min-float.tif diviner_south80_winter_min.tif &
wait
mkdir -p gaz psr
unzip -o -q moon_nomenclature.zip -d gaz
unzip -o -q psr_south.zip -d psr
echo "done"
