lucide.createIcons();

const rawProjects = [...initialProjects];
let currProjIdx = 0;
let currColIdx = 0;
let projSearchQuery = "";
let colSearchQuery = "";
let map = null;
let clusterGroup = null;
let polyLayer = null;
let currentSites = [];
let currentSelectedSiteId = null;
let filterState = {realm: "", biome: "", group: ""};

// Fix: 添加缺失的全局变量，修复上传动画和表格筛选错误
let uploadFilesQueue = [];
let uploadTimer = null;
let crudFilterState = {};
let generatedAnnotations = []; // 新增：用于存储动态生成的注释
let generatedReviews = []; // 新增：用于存储动态生成的评审

const SPHERE_COLORS = {
    "Hydrosphere": "#0ea5e9", "Cryosphere": "#06b6d4", "Lithosphere": "#57534e", "Pedosphere": "#b45309", "Atmosphere": "#64748b", "Biosphere": "#65a30d", "Anthroposphere": "#db2777"
};
const getSphereColor = (s) => SPHERE_COLORS[s] || SPHERE_COLORS["Biosphere"];
const DEFAULT_BRAND_COLOR = "#83CD20";


function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)
    } : null;
}


function adjustBrightness(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');

    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);


    const amount = Math.floor(2.55 * percent);

    r += amount;
    g += amount;
    b += amount;


    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));


    const rr = (r.toString(16).length < 2 ? '0' : '') + r.toString(16);
    const gg = (g.toString(16).length < 2 ? '0' : '') + g.toString(16);
    const bb = (b.toString(16).length < 2 ? '0' : '') + b.toString(16);

    return `#${rr}${gg}${bb}`;
}


function updateThemeColors(hexColor) {
    if (!hexColor) return;
    const rgb = hexToRgb(hexColor);
    if (!rgb) return;


    document.documentElement.style.setProperty('--brand', hexColor);

    document.documentElement.style.setProperty('--brand-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

    document.documentElement.style.setProperty('--brand-tint', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);

    const hoverColor = adjustBrightness(hexColor, -10);
    document.documentElement.style.setProperty('--brand-hover', hoverColor);
}

function generateSitesForContext(projId, colId) {
    let cidNum = colId ? Number(colId) : 0;
    let seed = projId + (cidNum * 7);
    const count = 50 + (seed % 20);
    let baseLat = -3.4, baseLng = -62.2;
    if (projId === 2) {
        baseLat = -18.2;
        baseLng = 147.7;
    }
    if (projId === 3) {
        baseLat = -2.3;
        baseLng = 34.8;
    }
    const realmKeys = Object.keys(TAXONOMY);
    return Array.from({length: count}, (_, i) => {
        let rIndex = Math.floor(Math.random() * realmKeys.length);
        if (projId === 1 && Math.random() > 0.3) rIndex = 0;
        if (projId === 2 && Math.random() > 0.3) rIndex = 1;
        const r = realmKeys[rIndex];
        const bKeys = Object.keys(TAXONOMY[r]);
        const b = bKeys[Math.floor(Math.random() * bKeys.length)];
        const gKeys = TAXONOMY[r][b];
        const g = gKeys[Math.floor(Math.random() * gKeys.length)];
        const lat = baseLat + (Math.random() - 0.5) * 8;
        const lng = baseLng + (Math.random() - 0.5) * 8;
        const vertices = 3 + Math.floor(Math.random() * 5);
        const baseRadius = 0.03;
        const poly = [];
        const rotation = Math.random() * Math.PI;
        for (let k = 0; k < vertices; k++) {
            const angle = (k / vertices) * Math.PI * 2 + rotation;
            const r = baseRadius * (0.8 + Math.random() * 0.4);
            poly.push([lat + Math.sin(angle) * r, lng + Math.cos(angle) * r]);
        }

        const siteId = `${projId}${cidNum}${String(i).padStart(3, '0')}`;
        const uuid = `550e8400-e29b-41d4-a716-SITE${siteId}`;
        const creator = mockNames[Math.floor(Math.random() * mockNames.length)];
        const created = "2025-01-10 12:00:00";

        const topo = Math.random() > 0.1 ? Math.floor(Math.random() * 800) : null;
        const depth = (r === 'Freshwater' || r === 'Marine') && Math.random() > 0.1 ? parseFloat((Math.random() * 15).toFixed(1)) : null;

        // --- 初始 Link 数据 ---
        // 默认关联当前项目
        let linkedProjs = [String(projId)];
        // 20% 概率额外关联另一个项目(假设项目ID为1,2,3)
        if (Math.random() > 0.8) {
            const otherId = (projId % 3) + 1;
            linkedProjs.push(String(otherId));
        }

        // 默认关联当前 Collection (如果有)
        let linkedCols = colId ? [String(colId)] : [];

        return {
            id: siteId, uuid: uuid, name: `Site ${String.fromCharCode(65 + (i % 26))}-${100 + i}`, center: [lat, lng], polygon: poly, realm: r, biome: b, functional_type: g, topography_m: topo, freshwater_depth_m: depth, creator_id: creator, creation_date: created,
            linkedProjects: linkedProjs,
            linkedCollections: linkedCols,
            mediaCount: Math.floor(Math.random() * 10) + 2, media: Array.from({length: Math.floor(Math.random() * 10) + 2}, (_, m) => {
                const isMeta = Math.random() > 0.7;
                return {
                    type: isMeta ? 'Metadata' : 'Audio', name: `${r.slice(0, 3).toUpperCase()}_REC_${202500 + m}.${isMeta ? 'csv' : 'wav'}`, date: "2025-01-15", duration: "01:00:00"
                };
            })
        };
    });
}

function loadMapData() {
    const projId = rawProjects[currProjIdx].id;
    const colId = currColIdx > 0 ? rawProjects[currProjIdx].collections[currColIdx - 1].id : null;
    if (!colId) {
        currentSites = [];
        rawProjects[currProjIdx].collections.forEach(c => {
            currentSites = [...currentSites, ...generateSitesForContext(projId, c.id)];
        });
    } else {
        currentSites = generateSitesForContext(projId, colId);
    }
    resetFilters();
}

function initMap() {
    if (map) return;
    map = L.map('full-map', {zoomControl: false}).setView([-3.465, -62.215], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
    L.control.zoom({position: 'bottomright'}).addTo(map);
    polyLayer = L.layerGroup().addTo(map);
    clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false, zoomToBoundsOnClick: true, spiderfyOnMaxZoom: true, maxClusterRadius: 60, iconCreateFunction: function (cluster) {
            const markers = cluster.getAllChildMarkers();
            const n = markers.length;
            const realmCounts = {};
            let totalMedia = 0;
            markers.forEach(m => {
                const r = m.options.customData.realm;
                realmCounts[r] = (realmCounts[r] || 0) + 1;
                totalMedia += m.options.customData.mediaCount;
            });
            let gradientParts = [];
            let currentPercenannotatione = 0;
            Object.keys(realmCounts).sort((a, b) => realmCounts[b] - realmCounts[a]).forEach(r => {
                const pct = (realmCounts[r] / n) * 100;
                gradientParts.push(`${getRealmColor(r)} ${currentPercenannotatione}% ${currentPercenannotatione + pct}%`);
                currentPercenannotatione += pct;
            });
            return L.divIcon({
                html: `<div class="donut-cluster" style="background: conic-gradient(${gradientParts.join(', ')});"><div class="donut-center"><span class="dc-num">${totalMedia}</span><span class="dc-label">MEDIA</span></div></div>`, className: 'custom-cluster-icon', iconSize: L.point(50, 50), iconAnchor: [25, 25]
            });
        }
    });
    map.addLayer(clusterGroup);
    loadMapData();
}

function renderMap(shouldZoom = false) {
    if (!map) return;
    polyLayer.clearLayers();
    clusterGroup.clearLayers();
    let visibleBounds = L.latLngBounds([]);
    let visibleCount = 0;
    let isCurrentSiteVisible = false;
    currentSites.forEach(site => {
        if (filterState.realm && site.realm !== filterState.realm) return;
        if (filterState.biome && site.biome !== filterState.biome) return;

        if (filterState.group && site.functional_type !== filterState.group) return;

        if (currentSelectedSiteId && site.id === currentSelectedSiteId) isCurrentSiteVisible = true;
        visibleCount++;
        const siteColor = getRealmColor(site.realm);
        const poly = L.polygon(site.polygon, {color: siteColor, weight: 2, opacity: 0.8, fillColor: siteColor, fillOpacity: 0.15}).addTo(polyLayer);
        poly.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openSidebar(site);
        });
        const marker = L.marker(site.center, {
            customData: {realm: site.realm, mediaCount: site.mediaCount}, icon: L.divIcon({
                html: `<div class="site-marker-pin"
                            style="border-color:${siteColor}; color:${siteColor}; box-shadow: 0 4px 10px ${siteColor}66; transition: all 0.2s ease;"
                            onmouseover="this.style.transform='scale(1.2)'; this.style.boxShadow='0 8px 20px ${siteColor}99';"
                            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 10px ${siteColor}66';"
                       >${site.mediaCount}</div>`, className: 'custom-cluster-icon', iconSize: [28, 28]
            })
        });
        marker.on('click', () => openSidebar(site));
        clusterGroup.addLayer(marker);
        visibleBounds.extend(site.center);
    });
    if (currentSelectedSiteId && !isCurrentSiteVisible) closeSidebar();
    if ((shouldZoom || visibleCount > 0) && visibleCount > 0) if (visibleCount === 1) map.flyTo(visibleBounds.getCenter(), 14, {duration: 0.8, easeLinearity: 0.5}); else map.fitBounds(visibleBounds, {padding: [50, 50], maxZoom: 15, duration: 0.8, easeLinearity: 0.5});
}

function openSidebar(site) {
    const sb = document.getElementById('sidebar');
    if (currentSelectedSiteId && currentSelectedSiteId !== site.id && sb.classList.contains('expanded')) {
        sb.classList.remove('expanded');
        const btn = sb.querySelector('.sb-expand');
        if (btn) {
            btn.innerHTML = '<i data-lucide="maximize-2" size="18"></i>';
            lucide.createIcons();
        }
    }

    currentSelectedSiteId = site.id;
    const color = getRealmColor(site.realm);
    document.documentElement.style.setProperty('--site-color', color);
    document.documentElement.style.setProperty('--site-color-tint', color + '12');
    document.getElementById('sb-name').textContent = site.name;
    document.getElementById('val-realm').textContent = site.realm;
    document.getElementById('val-realm').style.color = color;
    document.getElementById('val-biome').textContent = site.biome;

    const grpVal = document.getElementById('val-group');
    if (grpVal) grpVal.textContent = site.functional_type;

    const topoHtml = `<div class="sb-meta-item" title="Topography"><i data-lucide="mountain" size="14"></i> ${site.topography_m}m</div>`;

    const depthHtml = site.freshwater_depth_m !== null ? `<div class="sb-meta-divider"></div><div class="sb-meta-item" title="Water Depth"><i data-lucide="waves" size="14"></i> ${site.freshwater_depth_m}m</div>` : '';
    const metaContainer = document.getElementById('sb-meta-container');
    if (metaContainer) metaContainer.innerHTML = topoHtml + depthHtml;
    const mockSpectrogram = "https://ecosound-web.de/ecosound_web/sounds/images/51/27/6533-player_s.png";

    const mediaHtml = site.media.map((m) => {

        const mockAnnotationsHtml = `<span class="media-annotation" style="background:${color}; box-shadow: 0 2px 5px ${color}40;">Bio</span><span class="media-annotation" style="background:${color}; box-shadow: 0 2px 5px ${color}40;">Aves</span>`;
        const mockTime = "14:30:00";

        const isMetadata = m.type === 'Metadata';
        const borderStyle = isMetadata ? 'style="border:none"' : '';


        const mockSize = "2.4 MB";
        const metaIcon = isMetadata ? 'timer' : 'hard-drive';
        const metaText = isMetadata ? "60/3600" : mockSize;


        const visualContent = isMetadata ? `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${color}1f;"><i data-lucide="file-spreadsheet" size="32" style="color:${color}; margin-bottom:6px;"></i><span style="font-size:0.7rem; font-weight:700; color:${color}; letter-spacing:1px;">METADATA</span></div><div class="sr-badge">48kHz</div><div class="duration-badge">${m.duration}</div>` : `<img src="${mockSpectrogram}" class="spectrogram-img" alt="Spec"><div class="play-overlay"><div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div></div><div class="sr-badge">48kHz</div><div class="duration-badge">${m.duration}</div>`;


        const nameHtml = isMetadata ? `<span class="media-name" title="${m.name}" style="cursor:default; color:var(--text-main); text-decoration:none;">${m.name}</span>` : `<a href="#" class="media-name" title="${m.name}" style="text-decoration:none;" onclick="return false;" onmouseover="this.style.color='${color}'" onmouseout="this.style.color=''">${m.name}</a>`;


        return `<div class="media-item-card" onclick="event.stopPropagation();"
                     onmouseover="this.style.borderColor='${color}66'; this.style.boxShadow='0 15px 30px -5px ${color}33';"
                     onmouseout="this.style.borderColor=''; this.style.boxShadow='';">
            <div class="spectrogram-cover" ${borderStyle}>
                ${visualContent}
            </div>
            <div class="media-card-info">
                ${nameHtml}
                <div class="annotations-row">${mockAnnotationsHtml}</div>
                <div class="media-meta-row">
                    <div class="meta-icon-text"><i data-lucide="calendar" size="14"></i> ${m.date}</div>
                    <div class="meta-icon-text"><i data-lucide="clock" size="14"></i> ${mockTime}</div>
                    <div class="meta-icon-text"><i data-lucide="${metaIcon}" size="14"></i> ${metaText}</div>
                </div>
            </div>
            </div>`;
    }).join('');

    const mediaListContainer = document.getElementById('media-container');
    mediaListContainer.innerHTML = mediaHtml;
    mediaListContainer.scrollTop = 0;
    lucide.createIcons();
    document.getElementById('sidebar').classList.add('active');
    map.flyTo(site.center, 14, {duration: 0.8, easeLinearity: 0.5});
}


function toggleSidebarExpand() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('expanded');

    const btn = sb.querySelector('.sb-expand');
    const isExpanded = sb.classList.contains('expanded');


    if (btn) {
        btn.innerHTML = isExpanded ? '<i data-lucide="minimize-2" size="18"></i>' : '<i data-lucide="maximize-2" size="18"></i>';
        lucide.createIcons();
    }
}


function closeSidebar() {
    currentSelectedSiteId = null;
    const sb = document.getElementById('sidebar');
    sb.classList.remove('active');


    if (sb.classList.contains('expanded')) {
        sb.classList.remove('expanded');

        const btn = sb.querySelector('.sb-expand');
        if (btn) {
            btn.innerHTML = '<i data-lucide="maximize-2" size="18"></i>';
            lucide.createIcons();
        }
    }
}

function openFilterDrawer() {
    document.getElementById('filter-drawer').classList.add('active');
    document.getElementById('filter-btn-main').classList.add('active');
}

function closeFilterDrawer() {
    document.getElementById('filter-drawer').classList.remove('active');
    document.getElementById('filter-btn-main').classList.remove('active');
}

function toggleSelect(id) {
    const el = document.getElementById(id);
    if (el.querySelector('.select-trigger').classList.contains('disabled')) return;
    const isOpen = el.classList.contains('open');
    closeSelects();
    if (!isOpen) el.classList.add('open');
}

function closeSelects() {
    document.querySelectorAll('.custom-select-wrapper').forEach(d => d.classList.remove('open'));
}

function getUniqueValues(data, key) {
    const set = new Set();
    data.forEach(s => {
        if (s[key]) set.add(s[key]);
    });
    return Array.from(set).sort();
}

function initFilters() {
    renderSelectOptions('realm');
    updateSelectOptions('biome');
    updateSelectOptions('group');
}

function renderSelectOptions(targetType) {
    const list = document.getElementById('opt-' + targetType);
    const options = getUniqueValues(currentSites, 'realm');
    let html = `<div class="select-option" onclick="applyFilter('${targetType}', '')"><div class="opt-dot" style="background:#ccc"></div>All Realms</div>`;
    options.forEach(opt => html += `<div class="select-option" onclick="applyFilter('${targetType}', '${opt}')"><div class="opt-dot" style="background:${getRealmColor(opt)}"></div>${opt}</div>`);
    list.innerHTML = html;
}

function applyFilter(type, value) {
    closeSidebar();
    if (type === 'realm') {
        filterState.realm = value;
        filterState.biome = "";
        filterState.group = "";
        updateSelectUI('realm', value);
        updateSelectOptions('biome');
        updateSelectUI('biome', '');
        updateSelectOptions('group');
        updateSelectUI('group', '');
    } else if (type === 'biome') {
        filterState.biome = value;
        filterState.group = "";
        updateSelectUI('biome', value);
        updateSelectOptions('group');
        updateSelectUI('group', '');
    } else if (type === 'group') {
        filterState.group = value;
        updateSelectUI('group', value);
    }
    closeSelects();
    renderMap(true);
}

function updateSelectUI(type, value) {
    const textEl = document.getElementById('text-' + type);
    const trigger = type === 'realm' ? document.getElementById('sel-realm').querySelector('.select-trigger') : document.getElementById('trig-' + type);
    const labelMap = {realm: "All Realms", biome: "All Biomes", group: "All Groups"};
    if (!value) {
        textEl.innerHTML = labelMap[type];
        trigger.classList.remove('active');
    } else {
        if (type === 'realm') {
            const color = getRealmColor(value);
            textEl.innerHTML = `<span class="opt-dot" style="background:${color}; display:inline-block; margin-right:8px;"></span>${value}`;
        } else textEl.innerText = value;
        trigger.classList.add('active');
    }
}

function updateSelectOptions(targetType) {
    const list = document.getElementById('opt-' + targetType);
    const trigger = document.getElementById('trig-' + targetType);
    let filteredData = currentSites;
    if (targetType === 'biome') {
        if (!filterState.realm) {
            trigger.classList.add('disabled');
            return;
        }
        filteredData = currentSites.filter(s => s.realm === filterState.realm);
    } else if (targetType === 'group') {
        if (!filterState.biome) {
            trigger.classList.add('disabled');
            return;
        }
        filteredData = currentSites.filter(s => s.realm === filterState.realm && s.biome === filterState.biome);
    }
    trigger.classList.remove('disabled');


    const dataKey = targetType === 'group' ? 'functional_type' : targetType;
    const options = getUniqueValues(filteredData, dataKey);

    const labelMap = {biome: "All Biomes", group: "All Groups"};
    let html = `<div class="select-option" onclick="applyFilter('${targetType}', '')">${labelMap[targetType]}</div>`;
    if (options.length === 0) html = `<div style="padding:10px;color:#999;font-size:0.85rem">No options</div>`; else options.forEach(opt => html += `<div class="select-option" onclick="applyFilter('${targetType}', '${opt}')">${opt}</div>`);
    list.innerHTML = html;
}

function resetFilters() {
    closeSidebar();
    filterState = {realm: "", biome: "", group: ""};
    updateSelectUI('realm', '');
    initFilters();
    renderMap(true);
}

let mediaItems = [];
let mediaSearchQuery = "";

const generateMediaForContext = (proj, col) => {
    const pId = Number(proj.id);
    const cId = col ? Number(col.id) : 0;
    const basePrefix = `${pId}${cId}`;
    const count = col ? rInt(8, 15) : rInt(24, 40);

    return Array.from({length: count}, (_, i) => {
        const h = Math.floor(Math.random() * 24).toString().padStart(2, '0');
        const m = Math.floor(Math.random() * 60).toString().padStart(2, '0');
        const s = Math.floor(Math.random() * 60).toString().padStart(2, '0');
        const fullDate = `${2021 + Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        const timeStr = `${h}:${m}:${s}`;

        const recId = 20250000 + i;
        const numId = Number(basePrefix + recId);

        const typePool = ["audio", "audio", "audio", "audio"];
        const mediaType = typePool[rInt(0, 3)];
        const isAudio = mediaType === 'audio';

        const audioSourceType = isAudio ? (Math.random() > 0.3 ? "Audio File" : "Metadata") : null;
        const ext = isAudio ? "wav" : "jpg";
        const baseName = `REC_${basePrefix}_${recId}`;

        let fileName = baseName + '.' + ext;
        if (isAudio && audioSourceType === 'Metadata') {
            fileName = "";
        }

        let sizeBytes = Math.floor(Math.random() * 1024 * 1024 * (isAudio ? 50 : 5));
        let dutyRec = null;
        let dutyPer = null;

        if (isAudio && audioSourceType === 'Metadata') {
            sizeBytes = null;
            dutyRec = 60;
            dutyPer = 3600;
        }

        const uploader = mockNames[rInt(0, mockNames.length - 1)];

        // --- 初始 Link 数据 ---
        // 默认关联当前 Collection (如果有)
        let linkedCols = col ? [String(col.id)] : [];
        // 20% 概率额外关联同项目下的另一个随机 Collection (作为演示)
        if (proj.collections.length > 1) {
            const randomCol = proj.collections[Math.floor(Math.random() * proj.collections.length)];
            const rCId = String(randomCol.id);
            if (!linkedCols.includes(rCId)) {
                linkedCols.push(rCId);
            }
        }

        return {
            id: String(numId),
            media_id: numId,
            uuid: `550e8400-e29b-41d4-a716-${String(numId).padStart(12, '0')}`,
            media_type: mediaType,
            audio_type: audioSourceType,
            filename: fileName,
            name: baseName,
            uploader_id: uploader,
            creator_id: uploader,
            site: `Site-${rInt(1, 12).toString().padStart(2, '0')}`,
            sensor: ["AudioMoth v1.2", "Song Meter Micro", "Zoom F3 + Clippy", "Sony PCM-D10"][rInt(0, 3)],
            license: mockLicenses[rInt(0, mockLicenses.length - 1)],
            photo_setting_id: !isAudio ? mockPhotoSettings[rInt(0, 2)] : null,
            medium: ['Marine', 'Freshwater'].includes(proj.sphere || 'Terrestrial') ? 'Water' : 'Air',
            duty_cycle_recording: dutyRec,
            duty_cycle_period: dutyPer,
            note: "Auto-generated record",
            date: fullDate,
            time: timeStr,
            date_time: `${fullDate} ${timeStr}`,
            size: sizeBytes ? `${(sizeBytes / 1024 / 1024).toFixed(2)} MB` : "",
            size_B: sizeBytes,
            recording_gain_dB: isAudio ? rInt(0, 60) : null,
            sampling_rate_Hz: isAudio ? [44100, 48000, 96000][rInt(0, 2)] : null,
            bit_depth: isAudio ? [16, 24][rInt(0, 1)] : null,
            channel_num: isAudio ? [1, 2][rInt(0, 1)] : null,
            duration_s: isAudio ? rInt(10, 3600) : null,
            doi: `10.ECO/${numId}`,
            creation_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            annotations: getRandomAnnotations(),
            sr: "48kHz",
            spectrogram: "https://ecosound-web.de/ecosound_web/sounds/images/51/27/6533-player_s.png",
            fullDate: `${fullDate} ${h}:${m}`,
            duration: `00:${rInt(10, 59)}`,
            linkedCollections: linkedCols
        };
    });
};

function updateMediaContext() {
    const proj = rawProjects[currProjIdx];
    const col = currColIdx > 0 ? proj.collections[currColIdx - 1] : null;
    mediaItems = generateMediaForContext(proj, col);
    generatedAnnotations = []; // 重置注释数据，以便基于新的 mediaItems 重新生成
    mediaSearchQuery = "";
    const searchInput = document.querySelector('.media-search-input');
    if (searchInput) searchInput.value = "";
    const scrollArea = document.querySelector('.media-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
    const container = document.getElementById('media-grid-container');
    animateBlockSwap(container, () => {
        renderMedia();
    });
}

function handleSearchMedia(val) {
    mediaSearchQuery = val.toLowerCase();
    renderMedia();
}

function renderMedia() {
    enrichMediaData();
    const container = document.getElementById('media-grid-container');
    const badge = document.getElementById('media-count-badge');
    const isGallery = container.classList.contains('view-gallery');
    const filteredItems = mediaItems.filter(item => item.name.toLowerCase().includes(mediaSearchQuery) || item.annotations.some(t => t.toLowerCase().includes(mediaSearchQuery)) || item.site.toLowerCase().includes(mediaSearchQuery) || item.sensor.toLowerCase().includes(mediaSearchQuery));
    badge.textContent = `${filteredItems.length} Items`;
    if (filteredItems.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:10px;"><i data-lucide="filter" size="32" style="opacity:0.3"></i><span>No results found</span></div>`;
        lucide.createIcons();
        return;
    }
    let html = '';

    filteredItems.forEach(item => {
        const itemRealmColor = getRealmColor(item.realm);

        const annotationsHtml = item.annotations.map(t => `<span class="media-annotation" style="background:${itemRealmColor}; box-shadow: 0 2px 5px ${itemRealmColor}40;">${t}</span>`).join('');

        const isMetadata = item.audio_type === 'Metadata';
        const borderStyle = isMetadata ? 'style="border:none"' : '';


        const metaIcon = isMetadata ? 'timer' : 'hard-drive';
        const metaText = isMetadata ? `${item.duty_cycle_recording}/${item.duty_cycle_period}` : item.size;


        const metadataHtml = `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${itemRealmColor}1f;"><i data-lucide="file-spreadsheet" size="32" style="color:${itemRealmColor}; margin-bottom:6px;"></i><span style="font-size:0.7rem; font-weight:700; color:${itemRealmColor}; letter-spacing:1px;">METADATA</span></div>`;

        const srText = item.sampling_rate_Hz ? (item.sampling_rate_Hz / 1000) + 'kHz' : '48kHz';


        const visualContent = isMetadata ? `${metadataHtml}<div class="sr-badge">${srText}</div><div class="duration-badge">${item.duration}</div>` : `<img src="${item.spectrogram}" class="spectrogram-img" alt="Spec"><div class="play-overlay"><div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div></div><div class="sr-badge">${srText}</div><div class="duration-badge">${item.duration}</div>`;

        const listVisualContent = isMetadata ? `${metadataHtml}<div class="sr-badge">${srText}</div><div class="duration-badge">${item.duration}</div>` : `<img src="${item.spectrogram}" class="list-spec-img" alt="Spec"><div class="sr-badge">${srText}</div><div class="duration-badge">${item.duration}</div>`;


        const nameHtmlGallery = isMetadata ? `<span class="media-name" title="${item.name}" style="cursor:default; color:var(--text-main); text-decoration:none;">${item.name}</span>` : `<a href="#" class="media-name" title="${item.name}" style="text-decoration:none;" onclick="event.stopPropagation(); return false;" onmouseover="this.style.color='${itemRealmColor}'" onmouseout="this.style.color=''">${item.name}</a>`;


        const nameHtmlList = isMetadata ? `<span class="row-name" title="${item.name}" style="cursor:default; color:var(--text-main); text-decoration:none;">${item.name}</span>` : `<a href="#" class="row-name" title="${item.name}" style="text-decoration:none;" onclick="event.stopPropagation(); return false;" onmouseover="this.style.color='${itemRealmColor}'" onmouseout="this.style.color=''">${item.name}</a>`;

        if (isGallery) {
            html += `<div class="media-item-card"
                          onmouseover="this.style.borderColor='${itemRealmColor}66'; this.style.boxShadow='0 15px 30px -5px ${itemRealmColor}33';"
                          onmouseout="this.style.borderColor=''; this.style.boxShadow='';">
            <div class="spectrogram-cover" ${borderStyle}>
                ${visualContent}
            </div>
            <div class="media-card-info">
                ${nameHtmlGallery}
                <div class="annotations-row">${annotationsHtml}</div>
                <div class="media-meta-row">
                    <div class="meta-icon-text"><i data-lucide="calendar" size="14"></i> ${item.date}</div>
                    <div class="meta-icon-text"><i data-lucide="clock" size="14"></i> ${item.time}</div>
                    <div class="meta-icon-text"><i data-lucide="${metaIcon}" size="14"></i> ${metaText}</div>
                </div>
            </div>
            </div>`;
        } else {
            const realmColor = getRealmColor(item.realm);
            const depthHtml = item.freshwater_depth_m !== 'N/A' && item.freshwater_depth_m !== null ? `<span title="Water Depth"><i data-lucide="waves" size="12"></i> ${item.freshwater_depth_m}m</span>` : '';
            html += `<div class="media-item-row"
                          onmouseover="this.style.borderColor='${realmColor}4d'; this.style.boxShadow='0 8px 20px -5px ${realmColor}33';"
                          onmouseout="this.style.borderColor=''; this.style.boxShadow='';">
            <div class="list-spec-container" ${borderStyle}>
                ${listVisualContent}
            </div>
            <div class="row-basic-info">
                ${nameHtmlList}
                <div class="annotations-row">${annotationsHtml}</div>
                <div class="row-meta-list">
                    <div class="row-meta-item"><i data-lucide="calendar" size="14"></i> ${item.date}</div>
                    <div class="row-meta-item"><i data-lucide="clock" size="14"></i> ${item.time}</div>
                    <div class="row-meta-item"><i data-lucide="${metaIcon}" size="14"></i> ${metaText}</div>
                </div>
            </div>
            <div class="row-details-col">
                <div class="rd-header-row">
                    <div class="rd-site-group">
                        <div class="rd-site-name"><i data-lucide="map-pin" size="14" style="color:${realmColor};"></i>${item.site}</div>
                        <div class="rd-site-metrics"><span title="Topography"><i data-lucide="mountain" size="12"></i> ${item.topography_m}m</span> ${depthHtml}</div>
                    </div>
                    <div class="rd-hierarchy"><span style="color:${realmColor}">${item.realm}</span> <span class="rd-bread-sep"><i data-lucide="chevron-right" size="12"></i></span> <span>${item.biome}</span> <span class="rd-bread-sep"><i data-lucide="chevron-right" size="12"></i></span> <span>${item.group}</span></div>
                </div>
                <div class="rd-grid">
                    <div class="rd-item"><span class="rd-label">Medium</span><span class="rd-val">${item.medium}</span></div>
                    <div class="rd-item"><span class="rd-label">Sensor</span><span class="rd-val" title="${item.sensor}">${item.sensor}</span></div>
                    <div class="rd-item"><span class="rd-label">License</span><span class="rd-val" title="${item.license}">${item.license}</span></div>
                    <div class="rd-item span-v"><span class="rd-label">Note</span><span class="rd-val" title="${item.note}">${item.note}</span></div>
                    <div class="rd-item"><span class="rd-label">Uploader</span><span class="rd-val" title="${item.uploader}">${item.uploader}</span></div>
                    <div class="rd-item"><span class="rd-label">Creator</span><span class="rd-val" title="${item.creator}">${item.creator}</span></div>
                    <div class="rd-item"><span class="rd-label">DOI</span><span class="rd-val" title="${item.doi}">${item.doi}</span></div>
                </div>
            </div>
            </div>`;
        }
    });
    container.innerHTML = html;
    lucide.createIcons();
}

function switchMediaView(mode, btn) {
    const container = document.getElementById('media-grid-container');
    const btns = document.querySelectorAll('.view-btn');
    const pill = document.getElementById('view-pill');
    if (mode === 'gallery') {
        container.classList.remove('view-list');
        container.classList.add('view-gallery');
    } else {
        container.classList.remove('view-gallery');
        container.classList.add('view-list');
    }
    const scrollArea = document.querySelector('.media-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.left = btn.offsetLeft + 'px';
    renderMedia();
}

function enrichMediaData() {
    if (currentSites.length === 0) return;
    const realSites = currentSites;
    mediaItems.forEach((item, index) => {
        if (!item.enriched || !item.realSiteLinked) {
            const siteIndex = index % realSites.length;
            const linkedSite = realSites[siteIndex];

            if (linkedSite) {
                item.site = linkedSite.name;
                item.realm = linkedSite.realm;
                item.biome = linkedSite.biome;
                item.group = linkedSite.functional_type;
                item.topography_m = linkedSite.topography_m;
                item.freshwater_depth_m = linkedSite.freshwater_depth_m !== null ? linkedSite.freshwater_depth_m : 'N/A';
            }

            item.start = moment(`${item.date} ${item.time}`, "YYYY-MM-DD HH:mm:ss").toDate();
            item.end = moment(item.start).add(rInt(1, 10), 'minutes').toDate();
            if (!item.uploader) item.uploader = ["UserA", "LabAdmin", "J.Doe"][rInt(0, 2)];
            if (!item.medium) item.medium = ['Marine', 'Freshwater'].includes(item.realm) ? 'Water' : 'Air';
            if (!item.sensor) item.sensor = ["AudioMoth", "Song Meter", "Audiomoth Dev"][rInt(0, 2)];
            item.realSiteLinked = true;
            item.enriched = true;
        }
    });
}

function getIconForStat(key) {
    const map = {'Users': 'users', 'Collections': 'library', 'Audios': 'mic', 'Photos': 'image', 'Videos': 'video', 'Annotations': 'scan-line', 'Sites': 'map-pin', 'Projects': 'folder-kanban'};
    return map[key] || 'activity';
}

function renderSummary() {
    const statsContainer = document.getElementById('summary-stats-grid');
    const contribCard = document.querySelector('.summary-contributors-card');
    const contribList = document.getElementById('summary-contributors-list');
    const contribTitle = document.getElementById('contrib-title');
    let statsObj = {};
    let contributorsArr = [];
    let type = "Project";
    let contribBgIconName = 'users';
    if (currColIdx === 0) {
        const proj = rawProjects[currProjIdx];
        type = "Project";
        statsObj = proj.stats;
        order = ['Users', 'Collections', 'Audios', 'Annotations', 'Sites'];
        contributorsArr = proj.contributors;
        contribBgIconName = 'folder-kanban';
    } else {
        const col = rawProjects[currProjIdx].collections[currColIdx - 1];
        type = "Collection";
        statsObj = col.stats;
        order = ['Users', 'Projects', 'Audios', 'Annotations', 'Sites'];
        contributorsArr = col.contributors;
        contribBgIconName = 'library';
    }
    let statsHTML = '';

    order.forEach((key) => {
        let val = statsObj[key.toLowerCase()] || 0;
        const icon = getIconForStat(key);
        statsHTML += `<div class="summary-stat-card"><div class="stat-content-left"><div class="summary-stat-val ${key === 'Users' ? 'highlight' : ''}">${val}</div><div class="summary-stat-label">${key}</div></div><i data-lucide="${icon}" class="bg-icon"></i></div>`;
    });

    animateBlockSwap(statsContainer, () => {
        statsContainer.innerHTML = statsHTML;
        lucide.createIcons();
    });
    animateBlockSwap(contribCard, () => {
        contribTitle.innerHTML = `<i data-lucide="${type === 'Project' ? 'folder-kanban' : 'library'}"></i> ${type} Contributors`;
        let contribHTML = '';
        contributorsArr.forEach((p, index) => {
            const isCreator = index === 0;
            let displayRole = p.role;

            if (isCreator) {
                displayRole = `${type} Creator`;
            }
            contribHTML += `<div class="contrib-item"><div class="contrib-info-block"><span class="contrib-name">${p.name}</span><div class="contrib-sub"><a href="mailto:${p.email}" class="contrib-email"><i data-lucide="mail"></i>${p.email}</a><span class="contrib-divider">•</span><a href="https://orcid.org/${p.uid}" target="_blank" class="orcid-link" title="ORCID: ${p.uid}"><i data-lucide="id-card"></i><span class="cid">${p.uid}</span></a></div></div><span class="contrib-role-text ${isCreator ? 'creator-role' : ''}">${displayRole}</span></div>`;
        });
        contribList.innerHTML = contribHTML;
        const existingIcon = contribCard.querySelector('.bg-icon-contrib');
        if (existingIcon) existingIcon.remove();
        const bgIcon = document.createElement('i');
        bgIcon.setAttribute('data-lucide', contribBgIconName);
        bgIcon.className = 'bg-icon-contrib';
        contribCard.appendChild(bgIcon);
        lucide.createIcons();
    });
}

function renderProjectList() {
    const container = document.getElementById('project-list-container');
    const filteredProjs = rawProjects.map((p, i) => ({...p, originalIndex: i})).filter(p => p.name.toLowerCase().includes(projSearchQuery.toLowerCase()));

    const currentUser = document.querySelector('.user-name-text').textContent.trim();

    if (filteredProjs.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="search-x" size="20"></i>No projects found</div>`;
        lucide.createIcons();
        return;
    }
    let html = '';
    filteredProjs.forEach(proj => {
        const isSel = proj.originalIndex === currProjIdx;
        const isCreator = proj.creator === currentUser;
        const manageBadge = isCreator ? `<span style="background:var(--brand);color:white;padding:2px 6px;border-radius:4px;font-size:0.6rem;margin-left:8px;text-transform:uppercase;font-weight:700;">Manage</span>` : '';

        html += `<div class="crumb-item ${isSel ? 'selected' : ''}" onclick="selectProject(${proj.originalIndex})"><span style="display:flex;align-items:center;">${proj.name}${manageBadge}</span><i data-lucide="check" class="check-icon"></i></div>`;
    });
    container.innerHTML = html;
    lucide.createIcons();
}

function renderCollectionList() {
    const container = document.getElementById('collection-list-container');
    const rawCols = rawProjects[currProjIdx].collections;
    const displayList = [{name: "All Collections"}, ...rawCols];
    const filteredCols = displayList.map((c, i) => ({...c, originalIndex: i})).filter(c => c.name.toLowerCase().includes(colSearchQuery.toLowerCase()));
    if (filteredCols.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="search-x" size="20"></i>No collections found</div>`;
        lucide.createIcons();
        return;
    }
    let html = '';
    filteredCols.forEach(col => {
        const isSel = col.originalIndex === currColIdx;
        html += `<div class="crumb-item ${isSel ? 'selected' : ''}" onclick="selectCollection(${col.originalIndex})"><span>${col.name}</span><i data-lucide="check" class="check-icon"></i></div>`;
    });
    container.innerHTML = html;
    lucide.createIcons();
}

const animateBlockSwap = async (containerOrId, updateCallback) => {
    const el = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!el) {
        if (updateCallback) updateCallback();
        return;
    }
    el.classList.add('fading-out');
    await new Promise(r => setTimeout(r, 300));
    if (updateCallback) updateCallback();
    el.classList.remove('fading-out');
};
const animateImageSwap = async (img, newSrc) => {
    if (img.getAttribute('data-current-src') === newSrc) return;
    img.style.opacity = 0;
    await new Promise(r => setTimeout(r, 300));
    img.src = newSrc;
    img.setAttribute('data-current-src', newSrc);
    const handleLoad = () => {
        img.style.opacity = 1;
        img.removeEventListener('load', handleLoad);
    };
    img.addEventListener('load', handleLoad);
    if (img.complete && img.naturalWidth > 0) handleLoad();
};
const animateTextSwap = async (elementOrId, newContent) => {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) return;
    if (el.textContent === newContent) return;
    el.classList.add('fading-out');
    await new Promise(r => setTimeout(r, 300));
    el.textContent = newContent;
    el.classList.remove('fading-out');
};

function updateContent(project, immediate = false) {
    const updateLogic = () => {
        document.getElementById('desc-project-title').textContent = project.name;
        document.getElementById('meta-creator-name').textContent = project.creator;
        document.getElementById('meta-date').textContent = project.date;
        const doiDisplay = project.doi.includes('/') ? project.doi.split('/')[1] : project.doi;
        document.getElementById('meta-doi-text').textContent = doiDisplay;
        document.getElementById('meta-link').href = project.externalUrl || "#";
        const projContainer = document.getElementById('rich-text-container');
        projContainer.innerHTML = project.description;
        projContainer.className = "";
        if (project.styleClass) projContainer.classList.add(project.styleClass);
    };
    if (immediate) {
        updateLogic();
        const img = document.getElementById('main-project-image');
        img.src = project.image;
        img.setAttribute('data-current-src', project.image);
        img.onload = () => {
            img.style.opacity = 1;
        };
    } else {
        const headerSection = document.querySelector('.desc-header-section');
        const contentArea = document.querySelector('.desc-content-area');
        animateBlockSwap(headerSection, null);
        animateBlockSwap(contentArea, updateLogic);
        const img = document.getElementById('main-project-image');
        animateImageSwap(img, project.image);
    }
    const projLabel = document.getElementById('label-project');
    if (immediate) projLabel.textContent = project.name; else animateTextSwap(projLabel, project.name);
    const fullList = [{name: "All Collections"}, ...project.collections];
    const colName = fullList[0] ? fullList[0].name : "Select...";
    if (immediate) document.getElementById('label-collection').textContent = colName; else animateTextSwap('label-collection', colName);
    const refreshAllViews = () => {
        renderSummary();
        updateMediaContext();
        loadMapData();
        if (document.getElementById('tab-map').classList.contains('active')) renderMap(true);
    };
    if (immediate) setTimeout(refreshAllViews, 50); else refreshAllViews();
    lucide.createIcons();
}

function selectProject(idx) {
    const dropdown = document.getElementById('dropdown-project');
    dropdown.style.display = 'none';
    const container = document.getElementById('desc-layout-container');
    const isCollectionMode = container.classList.contains('mode-collection');
    if (currProjIdx !== idx) {
        currProjIdx = idx;


        updateThemeColors(DEFAULT_BRAND_COLOR);
        currColIdx = 0;
        projSearchQuery = "";
        document.querySelector('#dropdown-project input').value = "";
        colSearchQuery = "";
        document.querySelector('#dropdown-collection input').value = "";
        if (isCollectionMode) {
            const colPanel = document.getElementById('panel-col-desc');
            colPanel.style.opacity = 0;
            updateContent(rawProjects[currProjIdx], false);
            setTimeout(() => {
                container.classList.remove('mode-collection');
                setTimeout(() => {
                    colPanel.style.opacity = 1;
                }, 800);
            }, 300);
        } else {
            updateContent(rawProjects[currProjIdx], false);
        }
        renderCollectionList();
        renderProjectList();
        if (document.getElementById('tab-data').classList.contains('active')) {
            const currentUser = document.querySelector('.user-name-text').textContent.trim();
            const currentProject = rawProjects[currProjIdx];

            if (currentProject.creator !== currentUser) {
                dataScope = 'all';
            } else {
                dataScope = 'current';
            }

            renderTableNav();
            renderCrudHeader();
            renderCrudTable();
        }
    }
    setTimeout(() => {
        dropdown.style.display = '';
        closeAllMenus();
    }, 50);
}

// ====== 替换整个 selectCollection 函数 ======
function selectCollection(idx, force = false) {
    const dropdown = document.getElementById('dropdown-collection');
    dropdown.style.display = 'none';

    // 增加 force 判断，允许强制刷新当前视图
    if (currColIdx !== idx || force) {
        const prevIdx = currColIdx; // 记录之前的索引
        currColIdx = idx;
        colSearchQuery = "";
        document.querySelector('#dropdown-collection input').value = "";
        const container = document.getElementById('desc-layout-container');
        const project = rawProjects[currProjIdx];

        if (currColIdx === 0) {
            // Project View (保持不变)
            updateThemeColors(DEFAULT_BRAND_COLOR);
            container.classList.remove('mode-collection');
            animateTextSwap('label-collection', "All Collections");
        } else {
            // Collection View
            const colData = project.collections[currColIdx - 1];
            const sphereColor = getSphereColor(colData.sphere);
            updateThemeColors(sphereColor);

            const colContainer = document.getElementById('panel-col-desc');
            const colDoiShort = colData.doi.split('/')[1];

            const updateCollectionHTML = () => {
                let externalLinksHtml = '';
                const hasProjUrl = colData.external_project_url && colData.external_project_url !== '#';
                const hasMediaUrl = colData.external_media_url && colData.external_media_url !== '#';

                if (hasProjUrl || hasMediaUrl) {
                    externalLinksHtml = `
                    <div class="ext-link-wrapper">
                        <div class="title-link-icon" style="cursor: pointer;">
                            <i data-lucide="link" size="20"></i>
                        </div>
                        <div class="ext-link-dropdown">
                            ${hasProjUrl ? `<a href="${colData.external_project_url}" target="_blank" class="ext-link-item">Ext. Project</a>` : ''}
                            ${hasMediaUrl ? `<a href="${colData.external_media_url}" target="_blank" class="ext-link-item">Ext. Media</a>` : ''}
                        </div>
                    </div>`;
                }

                // --- 生成 Taxon 标签 HTML ---
                let taxonHtml = '';
                if (colData._taxons && colData._taxons.length > 0) {
                    // 调整了 margin，适配标题下方和胶囊上方的间距
                    taxonHtml = `<div style="margin-top:12px; margin-bottom:4px; display:flex; flex-wrap:wrap; gap:8px;">` +
                        colData._taxons.map(t => `<span style="background:var(--brand); color:white; padding:4px 12px; border-radius:14px; font-size:0.75rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3); white-space:nowrap;">${t.cached_name}</span>`).join('') +
                        `</div>`;
                }

                colContainer.innerHTML = `<div class="collection-card block-anim">
<div class="col-header-group">
    <div class="col-badge"><i data-lucide="globe-2" size="14"></i> ${colData.sphere}</div>
    <div class="title-row">
        <h2 class="col-title smooth-text">${colData.name}</h2> 
        <div style="display:flex; gap:8px;">
            ${externalLinksHtml}
        </div>
    </div>
    
    ${taxonHtml} <div class="col-meta-row smooth-text">
        <div class="meta-capsule-box">
            <div class="meta-item-btn">
                <div class="meta-item-icon"><i data-lucide="user" size="14"></i></div>
                ${colData.creator}
            </div>
            <div class="meta-divider"></div>
            <div class="meta-item-btn">
                <div class="meta-item-icon"><i data-lucide="calendar" size="14"></i></div>
                ${colData.date}
            </div>
            <div class="meta-divider"></div>
            <div class="meta-item-btn">
                <div class="meta-item-icon"><i data-lucide="bookmark" size="14"></i></div>
                ${colDoiShort}</span></div>
        </div>
    </div>
</div>
<div class="col-rich-text smooth-text">${colData.description}</div>
</div>`;
                lucide.createIcons();
            };

            if (!container.classList.contains('mode-collection')) {
                updateCollectionHTML();
                requestAnimationFrame(() => container.classList.add('mode-collection'));
            } else {
                const card = colContainer.querySelector('.collection-card');
                if (card) animateBlockSwap(card, updateCollectionHTML); else updateCollectionHTML();
            }
            const newLabel = project.collections[currColIdx - 1].name;
            animateTextSwap('label-collection', newLabel);
        }

        // 只有当真正切换了 Collection 时才重载数据；如果是 force 刷新 UI，则跳过这些重型操作
        if (prevIdx !== idx) {
            renderSummary();
            updateMediaContext();
            loadMapData();
            if (document.getElementById('tab-map').classList.contains('active')) renderMap(true);
            renderCollectionList();
            if (document.getElementById('tab-data').classList.contains('active')) {
                renderTableNav();
                renderCrudHeader();
                renderCrudTable();
            }
        }
    }
    setTimeout(() => {
        dropdown.style.display = '';
        closeAllMenus();
    }, 50);
}

function handleSearchProject(val) {
    projSearchQuery = val;
    renderProjectList();
}

function handleSearchCollection(val) {
    colSearchQuery = val;
    renderCollectionList();
}

function toggleMenu(id) {
    const el = document.getElementById(id);
    const isActive = el.classList.contains('active');
    closeAllMenus();
    if (!isActive) {
        el.classList.add('active');
        const input = el.querySelector('input');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 50);
        }
        if (id === 'project-wrap') {
            projSearchQuery = "";
            renderProjectList();
        } else if (id === 'collection-wrap') {
            colSearchQuery = "";
            renderCollectionList();
        }
    }
}

function closeAllMenus() {
    document.querySelectorAll('.crumb-wrapper, .user-wrapper').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.custom-select-wrapper').forEach(d => d.classList.remove('open'));
}

function toggleUserMenu() {
    const el = document.getElementById('user-menu');
    const isActive = el.classList.contains('active');
    closeAllMenus();
    if (!isActive) el.classList.add('active');
}

document.addEventListener('click', e => {
    if (e.target.closest('.dropdown-search-box')) return;
    if (!e.target.closest('.crumb-wrapper') && !e.target.closest('.user-wrapper')) document.querySelectorAll('.crumb-wrapper, .user-wrapper').forEach(el => el.classList.remove('active'));
    if (!e.target.closest('.custom-select-wrapper')) closeSelects();

    // New: Close form selects
    if (!e.target.closest('.form-select-wrapper')) {
        document.querySelectorAll('.form-select-dropdown').forEach(d => d.classList.remove('active'));
    }

    // New: Close table filters
    if (!e.target.closest('.table-filter-wrapper')) {
        document.querySelectorAll('.table-filter-dropdown').forEach(d => d.classList.remove('active'));
    }

    // Close taxon search dropdown
    if (!e.target.closest('#taxon-search-input') && !e.target.closest('#taxon-search-dropdown')) {
        const drop = document.getElementById('taxon-search-dropdown');
        if (drop) drop.classList.remove('active');
    }
});

function movePill(el) {
    const pill = document.getElementById('nav-sliding-pill');
    if (pill && el) {
        pill.style.width = el.offsetWidth + 'px';
        pill.style.left = el.offsetLeft + 'px';
    }
}

function switchTab(btn, tabName) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    movePill(btn);
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    if (tabName === 'media') {
        requestAnimationFrame(() => {
            const activeView = document.querySelector('.view-btn.active');
            const pill = document.getElementById('view-pill');
            if (activeView && pill) {
                pill.style.width = activeView.offsetWidth + 'px';
                pill.style.left = activeView.offsetLeft + 'px';
            }
        });
    }
    if (tabName === 'map') {
        if (!map) initMap();
        setTimeout(() => {
            map.invalidateSize();
            renderMap(false);
        }, 100);
    }
    if (tabName === 'data') initDataTab();
}

window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-item.active');
    if (active) movePill(active);
});

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    setTheme(target);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const iconEl = document.getElementById('theme-icon-el');
    if (iconEl) {
        iconEl.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();
    }
    if (currentSelectedSiteId) {
        const site = currentSites.find(s => s.id === currentSelectedSiteId);
        if (site) {
            const color = getRealmColor(site.realm);
            document.documentElement.style.setProperty('--site-color', color);
            document.documentElement.style.setProperty('--site-color-tint', color + '12');
        }
    }
}

function init() {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = saved || (systemDark ? 'dark' : 'light');
    setTheme(defaultTheme);
    renderProjectList();
    renderCollectionList();
    updateContent(rawProjects[0], true);
    const activeView = document.querySelector('.view-btn.active');
    if (activeView) {
        const p = document.getElementById('view-pill');
        p.style.width = activeView.offsetWidth + 'px';
        p.style.left = activeView.offsetLeft + 'px';
    }
    const active = document.querySelector('.nav-item.active');
    if (active) movePill(active);
}

let currentTable = "project";
let dataScope = "current";
let crudSearchQuery = "";
let editingId = null;
let selectedCrudIds = [];
let sortState = {key: null, direction: 'asc'};

function switchDataScope(scope, btn) {
    if (dataScope === scope) return;
    dataScope = scope;
    const pill = document.getElementById('scope-pill');
    if (pill && btn) {
        pill.style.width = btn.offsetWidth + 'px';
        pill.style.left = btn.offsetLeft + 'px';
    }
    const container = document.getElementById('scope-pill-container');
    if (container) {
        container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    crudFilterState = {};
    selectedCrudIds = [];
    updateToolbarState();
    renderTableNav();
    renderCrudHeader();
    renderCrudTable();
}

let currentEditorTargetId = null;

function handleFileChange(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            input.setAttribute('data-base64', e.target.result);
            const previewId = input.id + '-preview';
            const previewEl = document.getElementById(previewId);
            if (previewEl) previewEl.innerHTML = `<img src="${e.target.result}" style="height:32px; border-radius:4px; border:1px solid var(--border-color); vertical-align:middle;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function openEditorForInput(inputId) {
    currentEditorTargetId = inputId;
    const currentVal = document.getElementById(inputId).value;
    const textarea = document.getElementById('editor-textarea');
    textarea.value = currentVal;
    document.getElementById('editor-modal-overlay').classList.add('active');
}

function closeEditorModal() {
    document.getElementById('editor-modal-overlay').classList.remove('active');
    currentEditorTargetId = null;
}

function saveEditorContent() {
    if (currentEditorTargetId) {
        const val = document.getElementById('editor-textarea').value;
        document.getElementById(currentEditorTargetId).value = val;
        const preview = document.getElementById(currentEditorTargetId + '-preview');
        const textContent = val.replace(/<[^>]*>?/gm, '');
        if (preview) preview.textContent = textContent.substring(0, 40) + (textContent.length > 40 ? '...' : '');
    }
    closeEditorModal();
}

function getDataForTable(tableName) {
    const currentProject = rawProjects[currProjIdx];

    if (tableName === 'project') {
        let source = (dataScope === 'current') ? [currentProject] : rawProjects;
        if (dataScope === 'all') {
            const currentUser = document.querySelector('.user-name-text').textContent.trim();
        }
        return source.map(p => {
            return {
                project_id: String(p.id), uuid: `5508400${String(p.id).padStart(6, '0')}`, name: p.name, creator_name: p.creator, url: p.externalUrl || "https://example.com", picture_url: p.image, description: p.description, description_short: p.description, doi: p.doi, public: true, active: true, creation_date: p.date
            };
        });
    } else if (tableName === 'collection') {
        let source = [];
        if (dataScope === 'all') {
            const seenIds = new Set();
            rawProjects.forEach(p => {
                p.collections.forEach(c => {
                    if (!seenIds.has(c.id)) {
                        seenIds.add(c.id);
                        source.push(c);
                    }
                });
            });
        } else {
            if (currColIdx > 0) {
                source = [currentProject.collections[currColIdx - 1]];
            } else {
                source = currentProject.collections;
            }
        }
        return source.map((c, i) => {
            const linkedProjs = rawProjects
                .filter(p => p.collections.some(col => col.id === c.id))
                .map(p => p.name);
            let isCurrent = false;
            if (currColIdx > 0) {
                const activeCollection = currentProject.collections[currColIdx - 1];
                isCurrent = (c === activeCollection);
            } else {
                isCurrent = currentProject.collections.includes(c);
            }
            return {
                collection_id: c.id,
                uuid: `${c.id}9999`,
                project_names: linkedProjs.join(", "),
                name: c.name,
                creator_id: c.creator,
                doi: c.doi,
                description: c.description,
                sphere: c.sphere || "Biosphere",
                external_project_url: c.external_project_url,
                external_media_url: c.external_media_url,
                public_access: c.active !== undefined ? c.active : false,
                public_annotations: false,
                creation_date: c.date,
                taxons_display: (c._taxons && c._taxons.length > 0) ? c._taxons.map(t => t.cached_name).join(', ') : "-",
                _rawId: c.id,
                _isCurrent: isCurrent
            };
        });
    } else if (tableName === 'site') {
        // 修改：拆分坐标字段，保留4位小数供筛选使用
        return currentSites.map(s => {
            return {
                ...s,
                latitude: Number(s.center[0].toFixed(4)),
                longitude: Number(s.center[1].toFixed(4))
            };
        });
    } else if (['audio', 'photo', 'video'].includes(tableName)) {
        if (mediaItems.length > 0 && !mediaItems[0].enriched) enrichMediaData();
        const allMedia = mediaItems.map(m => ({
            media_id: m.media_id,
            uuid: m.uuid,
            media_type: m.media_type,
            audio_type: m.audio_type,
            name: m.name,
            filename: m.filename,
            directory: m.directory,
            uploader_id: m.uploader_id,
            creator_id: m.creator_id,
            site_id: m.site,
            sensor_id: m.sensor,
            license_id: m.license,
            audio_setting_id: m.audio_setting_id,
            photo_setting_id: m.photo_setting_id,
            medium: m.medium,
            duty_cycle_recording: m.duty_cycle_recording,
            duty_cycle_period: m.duty_cycle_period,
            recording_gain_dB: m.recording_gain_dB,
            sampling_rate_Hz: m.sampling_rate_Hz,
            bit_depth: m.bit_depth,
            channel_num: m.channel_num,
            duration_s: m.duration_s,
            note: m.note,
            date_time: m.date_time,
            size_B: m.size_B,
            md5_hash: m.md5_hash,
            doi: m.doi,
            creation_date: m.creation_date
        }));
        return allMedia.filter(m => m.media_type === tableName);
    } else if (tableName === 'user') {
        const directProjContributors = currentProject.contributors;
        const activeCollection = (currColIdx > 0) ? currentProject.collections[currColIdx - 1] : null;
        let displayUsers = [];
        if (dataScope === 'current') {
            if (currColIdx > 0) {
                displayUsers = [...directProjContributors, ...activeCollection.contributors];
            } else {
                let allProjectUsers = [...directProjContributors];
                currentProject.collections.forEach(c => {
                    allProjectUsers.push(...c.contributors);
                });
                displayUsers = allProjectUsers;
            }
        } else {
            rawProjects.forEach(p => {
                displayUsers.push(...p.contributors);
                p.collections.forEach(c => displayUsers.push(...c.contributors));
            });
        }
        displayUsers = Array.from(new Map(displayUsers.map(u => [u.name, u])).values());

        return displayUsers.map((u, i) => {
            const pEntry = directProjContributors.find(c => c.name === u.name);
            let pRole = pEntry ? (pEntry.role || "-") : "-";
            let cRole = "-";
            if (activeCollection) {
                const cEntry = activeCollection.contributors.find(c => c.name === u.name);
                cRole = cEntry ? (cEntry.role || "-") : "-";
            }

            const isInAnyCollectionOfProject = currentProject.collections.some(col => col.contributors.some(c => c.name === u.name));
            let isCurrent = false;
            if (currColIdx > 0) {
                isCurrent = activeCollection.contributors.some(c => c.name === u.name);
            } else isCurrent = (!!pEntry) || isInAnyCollectionOfProject;

            return {
                user_id: u.uid, username: u.name.split(' ').join('.').toLowerCase() + (i + 1), password: "hashed_pwd_placeholder", name: u.name, orcid: u.uid, email: u.email, project_role: pRole, collection_role: cRole, active: true, _isCurrent: isCurrent
            };
        });
    } else if (tableName === 'annotation') {
        if (generatedAnnotations.length === 0 && mediaItems.length > 0) {
            // 动态生成 Annotation 数据
            const count = 25;
            for (let i = 0; i < count; i++) {
                const media = mediaItems[Math.floor(Math.random() * mediaItems.length)];
                const soundClass = mockSoundClasses[Math.floor(Math.random() * mockSoundClasses.length)];
                const creatorType = ["user", "model", "automated"][Math.floor(Math.random() * 3)];
                const isBiophony = soundClass === 'Biophony';
                const isUser = creatorType === 'user';

                let taxon = "";
                let confidence = "";
                // 修改：默认为空字符串，以便非 Biophony 时表格显示空白
                let uncertain = "";
                let distance = "";
                // 修改：默认为空字符串
                let distUnknown = "";
                let indiv = "";

                // Sound Type 对所有记录随机生成
                let soundType = ["Call", "Song", "Drumming"][Math.floor(Math.random() * 3)];

                // 规则：只有 Biophony 才会有生物相关字段
                if (isBiophony) {
                    taxon = mockTaxons[Math.floor(Math.random() * mockTaxons.length)];
                    uncertain = Math.random() > 0.8; // 生成布尔值
                    distance = Math.floor(Math.random() * 50);
                    distUnknown = Math.random() > 0.5; // 生成布尔值
                    if (distUnknown) distance = "";

                    indiv = Math.floor(Math.random() * 3) + 1;

                    // 规则：如果是 User 创建，Confidence 为空；否则生成随机置信度
                    if (!isUser) {
                        confidence = parseFloat((0.5 + Math.random() * 0.5).toFixed(2));
                    }
                }

                generatedAnnotations.push({
                    id: i + 1,
                    uuid: `550e8400-e29b-41d4-a716-ANNOT${String(i).padStart(4, '0')}`,
                    sound_id: soundClass,
                    media_name: media.name,
                    creator_id: mockNames[Math.floor(Math.random() * mockNames.length)],
                    creator_type: creatorType,
                    confidence: confidence,
                    min_x: parseFloat((Math.random() * 10).toFixed(1)),
                    max_x: parseFloat((10 + Math.random() * 10).toFixed(1)),
                    min_y: Math.floor(Math.random() * 2000),
                    max_y: Math.floor(3000 + Math.random() * 5000),
                    taxon_id: taxon,
                    uncertain: uncertain, // 使用变量
                    sound_distance_m: distance,
                    distance_not_estimable: distUnknown, // 使用变量
                    individual_num: indiv,
                    animal_sound_type: soundType,
                    reference: Math.random() > 0.9,
                    comments: ["Clear recording", "Background noise high", "Overlapping calls", "Interesting pattern", "Needs review"][Math.floor(Math.random() * 5)],
                    creation_date: moment().subtract(Math.floor(Math.random() * 10), 'days').format("YYYY-MM-DD HH:mm:ss")
                });
            }
        }
        return generatedAnnotations;
    } else if (tableName === 'annotation_review') {
        // 动态生成 Reviews 数据
        if (generatedReviews.length === 0) {
            // 确保先有 Annotation 数据
            const annotations = getDataForTable('annotation');
            if (annotations.length > 0) {
                const count = 20; // 生成 20 条评审记录
                for (let i = 0; i < count; i++) {
                    // 随机关联一个 Annotation
                    const annot = annotations[Math.floor(Math.random() * annotations.length)];

                    // 随机选择状态
                    const status = mockReviewStatuses[Math.floor(Math.random() * mockReviewStatuses.length)];
                    let taxon = "";

                    // 规则：只有 Revise 状态下，Taxon 才有值
                    if (status === 'Revise') {
                        taxon = mockTaxons[Math.floor(Math.random() * mockTaxons.length)];
                    }

                    generatedReviews.push({
                        id: `${1000 + i}`,
                        media_name: annot.media_name, // 获取 Media Name
                        annotation_id: annot.id,
                        reviewer_id: mockNames[Math.floor(Math.random() * mockNames.length)],
                        annotation_review_status_id: status,
                        taxon_id: taxon,
                        note: ["Agreed.", "Unsure about ID.", "Noise interference.", "Verified.", "Needs second opinion."][Math.floor(Math.random() * 5)],
                        creation_date: moment().subtract(Math.floor(Math.random() * 5), 'days').format("YYYY-MM-DD HH:mm:ss")
                    });
                }
            }
        }
        return generatedReviews;
    } else if (tableName === 'index_log') {
        return staticMockDB.index_log || [];
    } else {
        return staticMockDB[tableName] || [];
    }
}

function initDataTab() {
    switchCrudTable('project');
}

function renderTableNav() {
    const navList = document.getElementById('table-nav-list');
    let html = "";
    Object.keys(dbSchema).forEach(key => {
        const table = dbSchema[key];
        const isActive = currentTable === key ? 'active' : '';
        const data = getDataForTable(key);
        const count = data ? data.length : 0;
        html += `
            <div class="dt-item ${isActive}" onclick="switchCrudTable('${key}')">
                <span style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="${table.icon}" size="16"></i> ${table.label}
                </span>
                <span class="dt-count">${count}</span>
            </div>
        `;
    });
    navList.innerHTML = html;
    lucide.createIcons();
}

function switchCrudTable(tableName) {
    currentTable = tableName;
    crudSearchQuery = "";
    selectedCrudIds = [];
    const isMediaTable = ['audio', 'photo', 'video'].includes(tableName);
    const addBtn = document.getElementById('btn-add');

    if (addBtn) {
        const oldDrop = document.getElementById('toolbar-upload-dropdown');
        if (oldDrop) oldDrop.remove();

        // 隐藏 Annotation, Review 和 Index Log 表的 Add 按钮
        if (tableName === 'annotation' || tableName === 'annotation_review' || tableName === 'index_log') {
            addBtn.style.display = 'none'; //
        } else {
            addBtn.style.display = ''; // 恢复显示
            if (isMediaTable) {
                addBtn.innerHTML = `<i data-lucide="upload" size="16"></i> Upload`;
                addBtn.onclick = (e) => toggleToolbarUploadDropdown(e);
            } else {
                addBtn.innerHTML = `<i data-lucide="plus" size="16"></i> Add`;
                addBtn.onclick = () => openCrudModal('add');
            }
        }
        lucide.createIcons();
    }

    updateToolbarState();
    const searchInput = document.getElementById('data-search-input');
    if (searchInput) {
        searchInput.value = "";
        searchInput.placeholder = "Search";
    }
    const schema = dbSchema[tableName];
    const firstColKey = schema.columns[0].key;
    sortState = {key: firstColKey, direction: 'asc'};
    crudFilterState = {};
    renderTableNav();
    renderCrudHeader();
    renderCrudTable();
}

function handleDataSearch(val) {
    crudSearchQuery = val.toLowerCase();
    renderCrudTable();
}

function handleSort(key) {
    if (sortState.key === key) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.key = key;
        sortState.direction = 'asc';
    }
    renderCrudHeader();
    renderCrudTable();
}

function handleColumnFilter(key, value) {
    if (value === "" || value === "all") {
        delete crudFilterState[key];
    } else crudFilterState[key] = value;
    renderCrudTable();
}

function handleRangeFilter(key, type, val) {
    if (!crudFilterState[key] || typeof crudFilterState[key] !== 'object') {
        crudFilterState[key] = {min: "", max: ""};
    }
    crudFilterState[key][type] = val;

    if (crudFilterState[key].min === "" && crudFilterState[key].max === "") {
        delete crudFilterState[key];
    }

    renderCrudTable();
}

function renderCrudHeader() {
    const schema = dbSchema[currentTable];
    const thead = document.getElementById('crud-thead');
    let headHtml = "<tr>";
    headHtml += `<th style="width: 40px; text-align:center; vertical-align:top; padding-top:14px;"><input type="checkbox" class="crud-checkbox" id="header-select-all" onclick="handleSelectAll(this.checked)"></th>`;

    schema.columns.forEach(col => {
        if (col.hiddenInTable) return;
        if (currentTable === 'user') {
            if (currColIdx === 0 && col.key === 'collection_role') return;
            if (currColIdx > 0 && col.key === 'project_role') return;
        }
        const isSorted = sortState.key === col.key;
        const sortIcon = isSorted ? (sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
        const activeClass = isSorted ? 'active-sort' : '';
        const iconOpacity = isSorted ? '1' : '0.3';

        let filterInputHtml = '';

        const currentFilterVal = crudFilterState[col.key];

        if (col.filterType === 'range') {
            const minVal = (currentFilterVal && currentFilterVal.min) ? currentFilterVal.min : "";
            const maxVal = (currentFilterVal && currentFilterVal.max) ? currentFilterVal.max : "";

            filterInputHtml = `
            <div style="display:flex; gap:4px; align-items:center;">
                <input type="number" class="th-filter-input" placeholder="Min" style="padding:0 4px; font-size:0.75rem;" 
                    value="${minVal}" 
                    oninput="handleRangeFilter('${col.key}', 'min', this.value)" 
                    onclick="event.stopPropagation()">
                <span style="color:var(--text-muted);">-</span>
                <input type="number" class="th-filter-input" placeholder="Max" style="padding:0 4px; font-size:0.75rem;" 
                    value="${maxVal}" 
                    oninput="handleRangeFilter('${col.key}', 'max', this.value)" 
                    onclick="event.stopPropagation()">
            </div>`;
        } else if (col.type === 'boolean') {
            // Boolean 类型：改为自定义下拉框
            const valStr = currentFilterVal || "all";
            let displayLabel = "All";
            if (valStr === 'true') displayLabel = "True";
            if (valStr === 'false') displayLabel = "False";

            filterInputHtml = `
            <div class="table-filter-wrapper" style="position:relative; width:100%;">
                <div class="table-filter-trigger th-filter-input" onclick="event.stopPropagation(); toggleTableFilterSelect('filter-dropdown-${col.key}')" style="display:flex; align-items:center; justify-content:space-between; padding-right:24px;">
                    <span id="filter-trigger-span-${col.key}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayLabel}</span>
                    <i data-lucide="chevron-down" size="12" style="position:absolute; right:8px; opacity:0.5;"></i>
                </div>
                
                <div class="table-filter-dropdown" id="filter-dropdown-${col.key}" onclick="event.stopPropagation()">
                    <div class="table-filter-options-list">
                        <div class="table-filter-option ${valStr === 'all' ? 'selected' : ''}" onclick="selectTableFilterOption('${col.key}', 'all', 'All')">All</div>
                        <div class="table-filter-option ${valStr === 'true' ? 'selected' : ''}" onclick="selectTableFilterOption('${col.key}', 'true', 'True')">True</div>
                        <div class="table-filter-option ${valStr === 'false' ? 'selected' : ''}" onclick="selectTableFilterOption('${col.key}', 'false', 'False')">False</div>
                    </div>
                </div>
            </div>`;
        } else if ((col.type === 'select' || col.filterType === 'select') && col.filterType !== 'text') {
            // Select 类型：使用自定义下拉框
            const valStr = currentFilterVal || "";
            const displayLabel = (valStr && valStr !== 'all') ? valStr : 'All';
            const uniqueVals = getUniqueValues(getDataForTable(currentTable), col.key);

            filterInputHtml = `
            <div class="table-filter-wrapper" style="position:relative; width:100%;">
                <div class="table-filter-trigger th-filter-input" onclick="event.stopPropagation(); toggleTableFilterSelect('filter-dropdown-${col.key}')" style="display:flex; align-items:center; justify-content:space-between; padding-right:24px;">
                    <span id="filter-trigger-span-${col.key}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayLabel}</span>
                    <i data-lucide="chevron-down" size="12" style="position:absolute; right:8px; opacity:0.5;"></i>
                </div>
                
                <div class="table-filter-dropdown" id="filter-dropdown-${col.key}" onclick="event.stopPropagation()">
                    <input type="text" class="table-filter-search" placeholder="Search..." oninput="filterTableFilterSelect('filter-dropdown-${col.key}', this.value)">
                    <div class="table-filter-options-list">
                        <div class="table-filter-option ${!valStr || valStr === 'all' ? 'selected' : ''}" onclick="selectTableFilterOption('${col.key}', 'all', 'All')">All</div>
                        ${uniqueVals.map(o => {
                const isSelected = String(valStr) === String(o);
                const safeO = String(o).replace(/'/g, "\\'");
                return `<div class="table-filter-option ${isSelected ? 'selected' : ''}" onclick="selectTableFilterOption('${col.key}', '${safeO}', '${safeO}')">${o}</div>`;
            }).join('')}
                    </div>
                </div>
            </div>`;
        } else if (col.type === 'file' || col.type === 'image' || col.type === 'richtext') {
            filterInputHtml = '';
        } else {
            const valStr = currentFilterVal || "";
            filterInputHtml = `<input type="text" class="th-filter-input" placeholder="Filter..." value="${valStr}" oninput="handleColumnFilter('${col.key}', this.value)" onclick="event.stopPropagation()">`;
        }

        headHtml += ` <th style="min-width: 140px;"> <div class="th-header-content ${activeClass}" onclick="handleSort('${col.key}')"> <span>${col.label}</span> <i data-lucide="${sortIcon}" size="14" style="opacity:${iconOpacity}"></i> </div> ${filterInputHtml ? `<div class="th-filter-box">${filterInputHtml}</div>` : ''} </th>`;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;
    lucide.createIcons();
}

function renderCrudTable() {
    const schema = dbSchema[currentTable];
    const rawData = getDataForTable(currentTable);
    const tbody = document.getElementById('crud-tbody');
    const titleEl = document.getElementById('current-table-title');

    const currentUser = document.querySelector('.user-name-text').textContent.trim();
    const currentProject = rawProjects[currProjIdx];
    const isManager = currentProject.creator === currentUser;

    if (!isManager && dataScope === 'current') {
        dataScope = 'all';
    }

    let titleHtml = `<i data-lucide="${schema.icon}"></i> ${schema.label}`;

    if (['project', 'collection', 'user'].includes(currentTable)) {
        const currentBtnAttr = isManager ? `onclick="switchDataScope('current', this)"` : `disabled style="font-size:0.75rem; padding:0 12px; opacity:0.5;"`;
        const currentBtnStyle = isManager ? `style="font-size:0.75rem; padding:0 12px;"` : ``;
        titleHtml += ` <div class="view-switcher-container" id="scope-pill-container" style="margin-left: 16px; height: 32px; display:inline-flex; vertical-align:middle;"> <div class="view-pill" id="scope-pill"></div> <button class="view-btn ${dataScope === 'current' ? 'active' : ''}" ${currentBtnAttr} ${currentBtnStyle}>Current</button> <button class="view-btn ${dataScope === 'all' ? 'active' : ''}" onclick="switchDataScope('all', this)" style="font-size:0.75rem; padding:0 12px;">All</button> </div>`;
    }
    titleEl.innerHTML = titleHtml;

    setTimeout(() => {
        let activeBtn, pill;
        if (['project', 'collection', 'user'].includes(currentTable)) {
            activeBtn = document.querySelector('#scope-pill-container .view-btn.active');
            pill = document.getElementById('scope-pill');
        }
        if (activeBtn && pill) {
            pill.style.transition = 'none';
            pill.style.width = activeBtn.offsetWidth + 'px';
            pill.style.left = activeBtn.offsetLeft + 'px';
            void pill.offsetWidth;
            pill.style.transition = '';
        }
    }, 0);

    let processedData = rawData.filter(row => {
        const matchesGlobal = !crudSearchQuery || Object.values(row).some(v => String(v).toLowerCase().includes(crudSearchQuery));
        if (!matchesGlobal) return false;

        return Object.keys(crudFilterState).every(key => {
            const filterVal = crudFilterState[key];
            const rowVal = row[key];

            if (typeof filterVal === 'object' && (filterVal.min !== undefined || filterVal.max !== undefined)) {
                if (rowVal === null || rowVal === undefined || rowVal === "") return false;
                const numVal = Number(rowVal);
                if (isNaN(numVal)) return false;

                if (filterVal.min !== "" && numVal < Number(filterVal.min)) return false;
                if (filterVal.max !== "" && numVal > Number(filterVal.max)) return false;
                return true;
            }

            const strFilterVal = String(filterVal).toLowerCase();
            const strRowVal = String(rowVal !== undefined ? rowVal : "").toLowerCase();

            if (strFilterVal === 'true' || strFilterVal === 'false') return strRowVal === strFilterVal;
            return strRowVal.includes(strFilterVal);
        });
    });

    if (sortState.key) {
        processedData.sort((a, b) => {
            let valA = a[sortState.key], valB = b[sortState.key];
            if (valA === null || valA === undefined) valA = "";
            if (valB === null || valB === undefined) valB = "";
            if (typeof valA === 'number' && typeof valB === 'number') return sortState.direction === 'asc' ? valA - valB : valB - valA;
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let bodyHtml = "";
    const visibleCols = schema.columns.filter(c => !c.hiddenInTable);
    if (processedData.length === 0) {
        bodyHtml = `<tr><td colspan="${visibleCols.length + 1}" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic;">No results found</td></tr>`;
    } else {
        processedData.forEach(row => {
            const pk = schema.pk;
            const rowIdStr = String(row[pk]);
            const isSelected = selectedCrudIds.includes(rowIdStr);
            const rowClass = isSelected ? 'selected' : '';
            const dblClickAction = currentTable === 'index_log' ? '' : `ondblclick="openCrudModal('edit', '${row[pk]}')"`;
            bodyHtml += `<tr class="${rowClass}" ${dblClickAction}>`;
            bodyHtml += ` <td style="text-align:center; border-bottom:1px solid var(--border-color);"> <input type="checkbox" class="crud-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleRowSelection('${rowIdStr}', this)" ondblclick="event.stopPropagation()"> </td>`;
            visibleCols.forEach(col => {
                if (currentTable === 'user') {
                    if (currColIdx === 0 && col.key === 'collection_role') return;
                    if (currColIdx > 0 && col.key === 'project_role') return;
                }
                let val = row[col.key];
                if (val === undefined || val === null) val = "";

                if (currentTable === 'project' && col.key === 'project_id') {
                    const currentProjId = rawProjects[currProjIdx] ? rawProjects[currProjIdx].id : null;
                    if (dataScope === 'all' && String(row.project_id) === String(currentProjId)) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3);">Current</span> </div>`;
                }
                if (currentTable === 'collection' && col.key === 'collection_id' && dataScope === 'all' && row._isCurrent) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3);">Current</span> </div>`;
                if (currentTable === 'user' && col.key === 'user_id' && dataScope === 'all' && row._isCurrent) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3);">Current</span> </div>`;

                if (col.type === 'image' || col.type === 'file') val = `<img src="${val}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);" alt="img" onerror="this.style.display='none'">`;

                // 统一 true / false 为胶囊样式 (与 Current 保持相同的 padding/radius/shadow)
                if (col.type === 'boolean') {
                    if (val === true) val = `<span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3);">True</span>`;
                    else if (val === false) val = `<span style="background:#ef4444; color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(239,68,68,0.3);">False</span>`;
                    else val = "";
                }

                // 统一 Collection 中的 Taxons 呈现为胶囊组（一字排开，不换行）
                if (col.key === 'taxons_display' && val && val !== "-") {
                    const taxons = val.split(', ');
                    val = `<div style="display:inline-flex; gap:4px; overflow:hidden; vertical-align:middle; width:100%;">` +
                        taxons.map(t => `<span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(var(--brand-rgb),0.3); white-space:nowrap; flex-shrink:0;">${t}</span>`).join('') +
                        `</div>`;
                }

                if (col.type === 'richtext') {
                    const text = String(val).replace(/<[^>]*>?/gm, '');
                    val = `<span style="opacity:0.8; font-size:0.85rem;" title="${text}">${text.substring(0, 30)}${text.length > 30 ? '...' : ''}</span>`;
                }
                bodyHtml += `<td>${val}</td>`;
            });
            bodyHtml += `</tr>`;
        });
    }

    tbody.innerHTML = bodyHtml;
    lucide.createIcons();
    updateHeaderCheckbox(processedData);
    window.currentVisibleData = processedData;
}

function updateHeaderCheckbox(visibleData) {
    const checkbox = document.getElementById('header-select-all');
    if (!checkbox) return;
    if (visibleData.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        return;
    }
    const visibleIds = visibleData.map(d => String(d[dbSchema[currentTable].pk]));
    const selectedCount = visibleIds.filter(id => selectedCrudIds.includes(id)).length;
    if (selectedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedCount === visibleIds.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
}

function toggleRowSelection(id, el) {
    const idx = selectedCrudIds.indexOf(id);
    if (idx > -1) {
        selectedCrudIds.splice(idx, 1);
        if (el) el.closest('tr').classList.remove('selected');
    } else {
        selectedCrudIds.push(id);
        if (el) el.closest('tr').classList.add('selected');
    }
    updateHeaderCheckbox(window.currentVisibleData);
    updateToolbarState();
}

window.handleSelectAll = function (checked) {
    const schema = dbSchema[currentTable];
    const data = window.currentVisibleData || [];
    if (checked) {
        data.forEach(row => {
            const id = String(row[schema.pk]);
            if (!selectedCrudIds.includes(id)) selectedCrudIds.push(id);
        });
    } else {
        const visibleIds = new Set(data.map(r => String(r[schema.pk])));
        selectedCrudIds = selectedCrudIds.filter(id => !visibleIds.has(id));
    }
    renderCrudTable();
    updateToolbarState();
};

function handleToolbarLink() {
    if (currentTable === 'project') {
        if (selectedCrudIds.length !== 1) return;
    } else {
        // Site 和 Media 允许批量，但必须至少选中一个
        if (selectedCrudIds.length === 0) return;
    }
    openLinkModal();
}

function toggleLinkGroup(id, header) {
    const el = document.getElementById(id);
    const icon = header.querySelector('.group-chevron');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        el.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}

function syncCollectionCheckboxes(el) {
    const val = el.value;
    const checked = el.checked;
    document.querySelectorAll(`.link-target-cb[value="${val}"]`).forEach(cb => {
        cb.checked = checked;
    });
}

let currentModalSelectableColMap = new Map();

function openLinkModal() {
    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    // 清空之前可能存在的 Map
    currentModalSelectableColMap.clear();

    if (currentTable === 'project') {
        const isMulti = selectedCrudIds.length > 1;
        title.textContent = isMulti ? `Link Collections to ${selectedCrudIds.length} Projects` : "Link Collections to Project";
        const currentUser = document.querySelector('.user-name-text').textContent.trim();
        const currentLinkedColIds = new Set();
        if (!isMulti) {
            const targetProj = rawProjects.find(p => String(p.id) === selectedCrudIds[0]);
            if (targetProj) {
                targetProj.collections.forEach(c => currentLinkedColIds.add(String(c.id)));
            }
        }

        let html = `<div class="form-group"><div style="padding-right: 4px;">`;
        let hasFoundAny = false;

        const sortedProjects = [...rawProjects].sort((a, b) => {
            const aSelected = selectedCrudIds.includes(String(a.id));
            const bSelected = selectedCrudIds.includes(String(b.id));
            return (bSelected ? 1 : 0) - (aSelected ? 1 : 0);
        });

        sortedProjects.forEach(proj => {
            const isProjCreator = proj.creator === currentUser;
            const validCols = proj.collections.filter(c => {
                if (isProjCreator) return true;
                if (c.creator === currentUser) return true;
                const contrib = c.contributors.find(u => u.name === currentUser);
                if (contrib && ['Admin', 'Manage'].includes(contrib.role)) return true;
                return false;
            });

            const uniqueCols = validCols.filter(c => !currentModalSelectableColMap.has(String(c.id)));

            if (uniqueCols.length > 0) {
                hasFoundAny = true;
                const groupId = `link-group-${proj.id}`;

                html += `
                <div onclick="toggleLinkGroup('${groupId}', this)" style="padding: 10px 0; font-weight:700; color:var(--text-main); border-bottom: 1px solid var(--border-light); margin-bottom:4px; margin-top:8px; font-size:0.95rem; display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
                    <i data-lucide="chevron-down" class="group-chevron" style="width:16px; height:16px; transition:transform 0.2s;"></i>
                    <i data-lucide="folder-kanban" style="width:16px; height:16px; color:var(--brand);"></i> 
                    ${proj.name}
                </div>
                <div id="${groupId}" style="display:block; padding-left:12px; margin-bottom:12px;">`;

                uniqueCols.forEach(c => {
                    const cIdStr = String(c.id);
                    currentModalSelectableColMap.set(cIdStr, c);
                    const isChecked = !isMulti && currentLinkedColIds.has(cIdStr);
                    html += `
                        <label style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer; border-bottom:1px dashed var(--border-color);">
                            <input type="checkbox" class="link-target-cb" value="${cIdStr}" ${isChecked ? 'checked' : ''} onchange="syncCollectionCheckboxes(this)" style="width:16px; height:16px; accent-color:var(--brand);">
                            <span style="font-size:0.9rem; color:var(--text-main); font-weight:500;">${c.name}</span>
                        </label>
                    `;
                });
                html += `</div>`;
            }
        });

        if (!hasFoundAny) html += `<div style="padding:20px; color:var(--text-muted); text-align:center;">No writable collections found.</div>`;
        html += `</div></div>`;
        container.innerHTML = html;

    } else if (currentTable === 'site') {
        const isMulti = selectedCrudIds.length > 1;
        title.textContent = isMulti ? `Link ${selectedCrudIds.length} Sites` : "Link Site to Projects & Collections";

        let initialProjIds = new Set();
        let initialColIds = new Set();

        if (!isMulti) {
            const site = currentSites.find(s => String(s.id) === selectedCrudIds[0]);
            if (site) {
                if (site.linkedProjects) site.linkedProjects.forEach(id => initialProjIds.add(String(id)));
                if (site.linkedCollections) site.linkedCollections.forEach(id => initialColIds.add(String(id)));
            }
        }

        let html = `<div class="form-group"><div style="padding-right: 4px;">`;

        rawProjects.forEach(proj => {
            const pId = String(proj.id);
            const isProjLinked = initialProjIds.has(pId);
            const groupId = `link-group-s-${pId}`;

            html += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border-light); margin-bottom:4px; margin-top:8px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; color:var(--text-main); font-size:0.95rem; user-select:none; flex:1;">
                    <input type="checkbox" class="link-site-proj-cb" value="${pId}" ${isProjLinked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--brand);">
                    <i data-lucide="folder-kanban" style="width:16px; height:16px; color:var(--brand);"></i> 
                    ${proj.name}
                </label>
                <div onclick="toggleLinkGroup('${groupId}', this)" style="cursor:pointer; padding:4px; display:flex; align-items:center;">
                    <i data-lucide="chevron-down" class="group-chevron" style="width:16px; height:16px; transition:transform 0.2s;"></i>
                </div>
            </div>
            <div id="${groupId}" style="display:block; padding-left:12px; margin-bottom:12px;">`;

            proj.collections.forEach(c => {
                const cId = String(c.id);
                const isColLinked = initialColIds.has(cId);

                // 修改：添加了 link-multi-col-cb 和 handleMultiParentCollectionChange
                html += `
                    <label style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer; border-bottom:1px dashed var(--border-color);">
                        <input type="checkbox" class="link-site-col-cb link-multi-col-cb" value="${cId}" ${isColLinked ? 'checked' : ''} onchange="handleMultiParentCollectionChange(this)" style="width:16px; height:16px; accent-color:var(--brand);">
                        <span style="font-size:0.9rem; color:var(--text-main); font-weight:500;">${c.name}</span>
                    </label>
                `;
            });
            html += `</div>`;
        });
        html += `</div></div>`;
        container.innerHTML = html;

    } else if (['audio', 'photo', 'video'].includes(currentTable)) {
        const isMulti = selectedCrudIds.length > 1;
        title.textContent = isMulti ? `Link ${selectedCrudIds.length} Items` : "Link Item to Collections";

        let initialColIds = new Set();

        if (!isMulti) {
            const media = mediaItems.find(m => String(m.id) === selectedCrudIds[0]);
            if (media) {
                if (media.linkedCollections) {
                    media.linkedCollections.forEach(id => initialColIds.add(String(id)));
                }
            }
        }

        let html = `<div class="form-group"><div style="padding-right: 4px;">`;

        rawProjects.forEach(proj => {
            const groupId = `link-group-m-${proj.id}`;
            html += `
            <div onclick="toggleLinkGroup('${groupId}', this)" style="padding: 10px 0; font-weight:700; color:var(--text-main); border-bottom: 1px solid var(--border-light); margin-bottom:4px; margin-top:8px; font-size:0.95rem; display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
                <i data-lucide="chevron-down" class="group-chevron" style="width:16px; height:16px; transition:transform 0.2s;"></i>
                <i data-lucide="folder-kanban" style="width:16px; height:16px; color:var(--brand);"></i> 
                ${proj.name}
            </div>
            <div id="${groupId}" style="display:block; padding-left:12px; margin-bottom:12px;">`;

            proj.collections.forEach(c => {
                const cId = String(c.id);
                const isColLinked = initialColIds.has(cId);

                // 修改：添加了 link-multi-col-cb 和 handleMultiParentCollectionChange
                html += `
                    <label style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer; border-bottom:1px dashed var(--border-color);">
                        <input type="checkbox" class="link-media-col-cb link-multi-col-cb" value="${cId}" ${isColLinked ? 'checked' : ''} onchange="handleMultiParentCollectionChange(this)" style="width:16px; height:16px; accent-color:var(--brand);">
                        <span style="font-size:0.9rem; color:var(--text-main); font-weight:500;">${c.name}</span>
                    </label>
                `;
            });
            html += `</div>`;
        });
        html += `</div></div>`;
        container.innerHTML = html;
    }

    lucide.createIcons();

    if (submitBtn) {
        submitBtn.textContent = "Save";
        submitBtn.className = "btn-primary";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = saveLinkData;
        submitBtn.disabled = false;
    }

    modal.classList.add('active');

    // 打开弹窗后，立刻刷新状态，将重复的 Collection 设为 disabled
    setTimeout(refreshMultiParentStates, 0);
}

function saveLinkData() {
    if (currentTable === 'project') {
        const checkboxes = document.querySelectorAll('.link-target-cb:checked');
        const selectedIds = new Set(Array.from(checkboxes).map(cb => cb.value));
        selectedCrudIds.forEach(projIdStr => {
            const proj = rawProjects.find(p => String(p.id) === projIdStr);
            if (proj) {
                const newCollections = [];
                const existingIds = new Set(proj.collections.map(c => String(c.id)));

                // 保留不可选/未显示的 Collection
                proj.collections.forEach(c => {
                    const cId = String(c.id);
                    if (!currentModalSelectableColMap.has(cId)) {
                        newCollections.push(c);
                        return;
                    }
                    if (selectedIds.has(cId)) newCollections.push(c);
                });

                // 添加新选中的
                selectedIds.forEach(id => {
                    if (!existingIds.has(id) && currentModalSelectableColMap.has(id)) {
                        newCollections.push(currentModalSelectableColMap.get(id));
                    }
                });
                proj.collections = newCollections;
            }
        });

    } else if (currentTable === 'site') {
        const projCheckboxes = document.querySelectorAll('.link-site-proj-cb:checked');
        const colCheckboxes = document.querySelectorAll('.link-site-col-cb:checked');
        const newProjIds = Array.from(projCheckboxes).map(cb => cb.value);
        const newColIds = Array.from(colCheckboxes).map(cb => cb.value);

        selectedCrudIds.forEach(siteId => {
            const site = currentSites.find(s => String(s.id) === String(siteId));
            if (site) {
                site.linkedProjects = [...newProjIds];
                site.linkedCollections = [...newColIds];
            }
        });

    } else if (['audio', 'photo', 'video'].includes(currentTable)) {
        const colCheckboxes = document.querySelectorAll('.link-media-col-cb:checked');
        const newColIds = Array.from(colCheckboxes).map(cb => cb.value);

        selectedCrudIds.forEach(id => {
            const media = mediaItems.find(m => String(m.id) === String(id));
            if (media) {
                media.linkedCollections = [...newColIds];
            }
        });
    }

    renderCrudTable();
    closeCrudModal();
    updateToolbarState();

    renderTableNav();
    if (currColIdx > 0 || (document.getElementById('dropdown-collection') && document.getElementById('dropdown-collection').style.display !== 'none')) {
        renderCollectionList();
    }
}

function handleToolbarEdit() {
    if (selectedCrudIds.length === 1) openCrudModal('edit', selectedCrudIds[0]);
}

function handleToolbarResetPassword() {
    if (selectedCrudIds.length !== 1) return;
    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');
    title.textContent = "Reset Password";
    container.innerHTML = ` <div class="form-group"> <label class="form-label">Current Admin Password</label> <input type="password" class="form-input" id="reset-admin-pwd"> </div> <div class="form-group"> <label class="form-label">New Password</label> <input type="password" class="form-input" id="reset-new-pwd"> </div> <div class="form-group"> <label class="form-label">Confirm Password</label> <input type="password" class="form-input" id="reset-confirm-pwd"> </div> `;
    if (submitBtn) {
        submitBtn.textContent = "Submit";
        submitBtn.className = "btn-primary";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = saveResetPassword;
    }
    modal.classList.add('active');
}

function saveResetPassword() {
    const adminPwd = document.getElementById('reset-admin-pwd').value;
    const newPwd = document.getElementById('reset-new-pwd').value;
    const confirm = document.getElementById('reset-confirm-pwd').value;
    if (!adminPwd || !newPwd || !confirm) {
        alert("All fields are required");
        return;
    }
    if (newPwd !== confirm) {
        alert("New passwords do not match");
        return;
    }
    alert("Password has been reset successfully.");
    closeCrudModal();
}

const USER_PERMISSIONS_DB = {};

let currentPermDraft = null;
let currentPermUserIds = [];

const PERM_RESOURCES = [{key: 'recording', label: 'Recording', icon: 'mic'}, {key: 'site', label: 'Site', icon: 'map-pin'}, {key: 'annotation', label: 'Annotation', icon: 'scan-line'}, {key: 'review', label: 'Review', icon: 'check-circle'}];

function initUserPermission(userId) {
    if (!USER_PERMISSIONS_DB[userId]) {
        USER_PERMISSIONS_DB[userId] = {
            role: 'user', projects: {}
        };
    }
    return JSON.parse(JSON.stringify(USER_PERMISSIONS_DB[userId]));
}

function updateToolbarState() {
    const editBtn = document.getElementById('btn-edit');
    const delBtn = document.getElementById('btn-delete');
    const linkBtn = document.getElementById('btn-link');
    const resetBtn = document.getElementById('btn-reset-pwd');
    const permBtn = document.getElementById('btn-permission');
    const setContribBtn = document.getElementById('btn-set-contrib');
    const count = selectedCrudIds.length;

    if (editBtn) {
        editBtn.disabled = (count !== 1);
        editBtn.style.display = currentTable === 'index_log' ? 'none' : '';
    }
    if (delBtn) {
        delBtn.disabled = (count === 0);
        delBtn.style.display = '';
    }

    if (linkBtn) {
        if (currentTable === 'project') {
            linkBtn.style.display = 'inline-flex';
            linkBtn.disabled = (count !== 1);
        } else if (currentTable === 'site' || ['audio', 'photo', 'video'].includes(currentTable)) {
            // Site 和 Media 支持批量 Link，只要有选中项即可
            linkBtn.style.display = 'inline-flex';
            linkBtn.disabled = (count === 0);
        } else {
            linkBtn.style.display = 'none';
        }
    }

    if (resetBtn) {
        if (currentTable === 'user') {
            resetBtn.style.display = 'inline-flex';
            resetBtn.disabled = (count !== 1);
        } else {
            resetBtn.style.display = 'none';
        }
    }

    if (permBtn) {
        if (currentTable === 'user') {
            permBtn.style.display = 'inline-flex';
            permBtn.disabled = (count === 0);
        } else {
            permBtn.style.display = 'none';
        }
    }

    if (setContribBtn) {
        if (currentTable === 'user') {
            setContribBtn.style.display = 'inline-flex';
            setContribBtn.disabled = (count === 0);
        } else {
            setContribBtn.style.display = 'none';
        }
    }

    const taxonBtn = document.getElementById('btn-taxon');
    if (taxonBtn) {
        if (currentTable === 'collection') {
            taxonBtn.style.display = 'inline-flex';
            taxonBtn.disabled = (count !== 1);
        } else {
            taxonBtn.style.display = 'none';
        }
    }

    if (currentTable === 'project' && count === 1) {
        const currentUser = document.querySelector('.user-name-text').textContent.trim();
        const currentData = getDataForTable('project');
        const selectedItem = currentData.find(p => String(p.project_id) === String(selectedCrudIds[0]));

        if (selectedItem && selectedItem.creator_name !== currentUser) {
            if (editBtn) editBtn.style.display = 'none';
        }
    }
}

function handleToolbarPermission() {
    if (selectedCrudIds.length === 0) return;

    currentPermUserIds = [...selectedCrudIds];

    if (currentPermUserIds.length === 1) {
        const userId = currentPermUserIds[0];
        initUserPermission(userId);
        currentPermDraft = JSON.parse(JSON.stringify(USER_PERMISSIONS_DB[userId]));
    } else {
        currentPermDraft = {role: 'user', projects: {}};
    }

    renderPermissionDrawer();

    document.getElementById('perm-drawer-overlay').classList.add('active');
    lucide.createIcons();
}

function closePermissionDrawer() {
    document.getElementById('perm-drawer-overlay').classList.remove('active');
    currentPermDraft = null;
    currentPermUserIds = [];
}

function savePermissionDrawer() {
    if (currentPermUserIds.length > 0 && currentPermDraft) {
        currentPermUserIds.forEach(uid => {
            USER_PERMISSIONS_DB[uid] = JSON.parse(JSON.stringify(currentPermDraft));
        });

        // 修改：直接关闭弹窗，不显示Saved动画，保持与编辑页面一致
        closePermissionDrawer();
    }
}

function renderPermissionDrawer() {
    const isGlobalAdmin = currentPermDraft.role === 'super_admin';
    const headerContainer = document.getElementById('perm-drawer-header');
    const contentContainer = document.getElementById('perm-content-container');

    const leftHtml = `
        <div class="card-title" style="margin:0; padding:0;">
            Permission Configuration
        </div>`;

    const rightHtml = `
        <div style="display:flex; align-items:center;">
            <div class="perm-admin-switch ${isGlobalAdmin ? 'active' : ''}">
                <span class="perm-admin-label">Administrator</span>
                <label style="display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" style="display:none;" ${isGlobalAdmin ? 'checked' : ''} onchange="toggleGlobalAdmin()">
                    <div class="perm-switch-track"><div class="perm-switch-thumb"></div></div>
                </label>
            </div>
        </div>
    `;

    headerContainer.innerHTML = leftHtml + rightHtml;

    let html = '';

    html += `
    <div class="perm-hidden-overlay ${isGlobalAdmin ? 'visible' : ''}" style="position:absolute; inset:0; z-index:10; background:rgba(255,255,255,0.9); display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:0.3s;">
        <i data-lucide="shield-check" size="48" style="opacity:0.2; margin-bottom:16px; color:var(--brand);"></i>
        <div style="font-weight:700; font-size:1.1rem; color:var(--text-main);">Administrator Access Enabled</div>
        <div style="font-size:0.9rem; color:var(--text-secondary);">This user has full access to all system resources.</div>
    </div>`;

    html += `<div class="perm-tree-container" style="display:flex; flex-direction:column; gap:12px; ${isGlobalAdmin ? 'display:none;' : ''}">`;

    rawProjects.forEach(proj => {
        const pid = String(proj.id);
        const userProj = currentPermDraft.projects[pid];
        const hasAccess = !!userProj;
        const isProjAdmin = userProj?.role === 'admin';

        let bulkStates = {};

        PERM_RESOURCES.forEach(res => {
            let allRead = true;
            let allWrite = true;

            if (!hasAccess || proj.collections.length === 0) {
                allRead = false;
                allWrite = false;
            } else {
                for (const c of proj.collections) {
                    const cid = String(c.id);
                    const userCol = userProj?.collections?.[cid];

                    if (userCol && userCol.role === 'admin') {
                        continue;
                    }

                    const cPerms = userCol?.permissions?.[res.key];

                    if (!cPerms || !cPerms.read) {
                        allRead = false;
                    }
                    if (!cPerms || !cPerms.write) {
                        allWrite = false;
                    }

                    if (!allRead && !allWrite) break;
                }
            }

            if (allWrite) bulkStates[res.key] = 'write'; else if (allRead) bulkStates[res.key] = 'read'; else bulkStates[res.key] = 'none';
        });

        html += `<div class="perm-proj-group">
            <div class="perm-row is-project">
                <div class="perm-col-info">
                    <div class="perm-check-wrapper">
                        <input type="checkbox" class="perm-cb" ${hasAccess ? 'checked' : ''} onchange="permToggleProject('${pid}')">
                    </div>
                    <div style="flex:1; min-width:0; display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="permToggleProject('${pid}')">
                        <span class="perm-name-text">${proj.name}</span>
                    </div>
                </div>
                <div class="perm-controls" style="${hasAccess ? '' : 'opacity:0.3; pointer-events:none;'}">
                    <div class="perm-role-select ${isProjAdmin ? 'is-admin' : ''}" onclick="permToggleProjAdmin('${pid}', ${!isProjAdmin})">
                        ${isProjAdmin ? 'Manage' : 'User'}
                    </div>
                    
                    ${!isProjAdmin ? `
                    <div class="perm-matrix" style="margin-left:8px; border-left:1px solid var(--border-color); padding-left:12px;">
                        ${renderBulkAtomicIcons(pid, bulkStates)}
                    </div>
                    ` : '<span style="font-size:0.75rem; color:var(--text-muted);">Full Project Access</span>'}
                </div>
            </div>`;

        if (hasAccess && !isProjAdmin) {
            html += renderCollectionListHTML(proj, userProj);
        }
        html += `</div>`;
    });

    html += `</div>`;

    contentContainer.innerHTML = html;
    lucide.createIcons();
}

function renderBulkAtomicIcons(pid, currentStates) {
    let html = '';
    PERM_RESOURCES.forEach(res => {
        const state = currentStates[res.key];
        let btnClass = '';
        let stateText = 'None';

        if (state === 'write') {
            btnClass = 'active-write';
            stateText = 'Write';
        } else if (state === 'read') {
            btnClass = 'active';
            stateText = 'Read';
        }

        let nextState = 'read';
        if (state === 'read') nextState = 'write';
        if (state === 'write') nextState = 'none';

        html += `
        <div class="perm-res-btn ${btnClass}" 
             onclick="permToggleProjectBulk('${pid}', '${res.key}', '${nextState}')">
            <i data-lucide="${res.icon}" size="14"></i>
            <div class="perm-res-tooltip">${res.label}: ${stateText}</div>
        </div>`;
    });
    return html;
}

function permToggleProjectBulk(pid, resKey, targetState) {
    const projDraft = currentPermDraft.projects[pid];
    if (!projDraft) return;

    const rawProj = rawProjects.find(p => String(p.id) === pid);
    if (!rawProj) return;

    rawProj.collections.forEach(c => {
        const cid = String(c.id);

        if (!projDraft.collections[cid]) {
            projDraft.collections[cid] = {role: 'member', permissions: {}, _expanded: false};
        }
        const colDraft = projDraft.collections[cid];
        if (!colDraft.permissions) colDraft.permissions = {};
        if (!colDraft.permissions[resKey]) colDraft.permissions[resKey] = {read: false, write: false};

        const p = colDraft.permissions[resKey];

        if (targetState === 'write') {
            p.read = true;
            p.write = true;
        } else if (targetState === 'read') {
            p.read = true;
            p.write = false;
        } else {
            p.read = false;
            p.write = false;
        }
    });

    renderPermissionDrawer();
}

function renderCollectionListHTML(proj, userProj) {
    let html = '';
    const isProjAdmin = userProj.role === 'admin';

    proj.collections.forEach(col => {
        const cid = String(col.id);
        const userCol = userProj.collections && userProj.collections[cid];
        const hasColAccess = !!userCol || isProjAdmin;

        let colRole = 'none';
        if (isProjAdmin) colRole = 'admin'; else if (userCol) colRole = userCol.role;

        const isColAdmin = colRole === 'admin';
        const isDisabled = isProjAdmin;

        html += `
        <div class="perm-row">
            <div class="perm-col-info">
                <div class="perm-indent">
                    <div style="width:1px; height:100%; background:var(--border-color);"></div>
                    <div style="width:12px; height:1px; background:var(--border-color);"></div>
                </div>
                <div class="perm-check-wrapper">
                    <input type="checkbox" class="perm-cb" ${hasColAccess ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} onclick="event.stopPropagation()" onchange="permToggleCollection('${proj.id}', '${cid}')">
                </div>
                <div style="flex:1; min-width:0; cursor:pointer;" onclick="${isDisabled ? '' : `permToggleCollection('${proj.id}', '${cid}')`}">
                    <span class="perm-name-text" style="font-weight:500;" title="${col.name}">${col.name}</span>
                </div>
            </div>
            <div class="perm-controls" style="${hasColAccess ? '' : 'opacity:0.3; pointer-events:none;'}">
                 <div class="perm-role-select ${isColAdmin ? 'is-admin' : ''}" style="${isDisabled ? 'pointer-events:none;' : ''}" onclick="permToggleColAdmin('${proj.id}', '${cid}', ${!isColAdmin})">
                    ${isColAdmin ? 'Manage' : 'User'}
                </div>
                <div class="perm-matrix">
                    ${renderAtomicPermsHTML(proj.id, cid, userCol, isColAdmin || isProjAdmin)}
                </div>
            </div>
        </div>`;
    });
    return html;
}

function renderAtomicPermsHTML(pid, cid, userCol, forceFull) {
    let html = '';
    PERM_RESOURCES.forEach(res => {
        let read = false;
        let write = false;

        if (forceFull) {
            read = true;
            write = true;
        } else if (userCol && userCol.permissions && userCol.permissions[res.key]) {
            read = userCol.permissions[res.key].read;
            write = userCol.permissions[res.key].write;
        }

        let stateClass = '';
        if (write) stateClass = 'active-write'; else if (read) stateClass = 'active';

        const iconMap = {
            'recording': 'mic', 'site': 'map-pin', 'annotation': 'scan-line', 'review': 'check-circle'
        };

        const nextState = write ? 'none' : (read ? 'write' : 'read');

        html += `
        <div class="perm-res-btn ${stateClass}" 
             onclick="${forceFull ? '' : `permToggleAtomicState('${pid}', '${cid}', '${res.key}', '${nextState}')`}"
             style="${forceFull ? 'cursor:default;' : ''}">
            <i data-lucide="${iconMap[res.key] || 'circle'}" size="14"></i>
            <div class="perm-res-tooltip">${res.label}: ${write ? 'Write' : (read ? 'Read' : 'None')}</div>
        </div>`;
    });
    return html;
}

function permToggleAtomicState(pid, cid, resKey, targetState) {
    const col = currentPermDraft.projects[pid]?.collections[cid];
    if (!col) return;
    if (!col.permissions) col.permissions = {};
    if (!col.permissions[resKey]) col.permissions[resKey] = {read: false, write: false};

    const p = col.permissions[resKey];

    if (targetState === 'write') {
        p.read = true;
        p.write = true;
    } else if (targetState === 'read') {
        p.read = true;
        p.write = false;
    } else {
        p.read = false;
        p.write = false;
    }
    renderPermissionDrawer();
}

function permBulkSetCols(pid, role) {
    const proj = currentPermDraft.projects[pid];
    if (!proj) return;

    const rawProj = rawProjects.find(p => String(p.id) === pid);
    if (!rawProj) return;

    rawProj.collections.forEach(c => {
        const cid = String(c.id);
        if (!proj.collections[cid]) {
            proj.collections[cid] = {role: role, permissions: {}, _expanded: false};
        } else {
            proj.collections[cid].role = role;
        }
    });

    renderPermissionDrawer();
}

function toggleGlobalAdmin() {
    currentPermDraft.role = (currentPermDraft.role === 'super_admin') ? 'user' : 'super_admin';
    renderPermissionDrawer();
}

function permToggleProject(pid) {
    if (currentPermDraft.projects[pid]) {
        delete currentPermDraft.projects[pid];
    } else {
        currentPermDraft.projects[pid] = {role: 'member', collections: {}, _expanded: true};
    }
    renderPermissionDrawer();
}

function permToggleProjAdmin(pid, isAdmin) {
    if (currentPermDraft.projects[pid]) {
        currentPermDraft.projects[pid].role = isAdmin ? 'admin' : 'member';
        if (isAdmin) currentPermDraft.projects[pid]._expanded = false; else currentPermDraft.projects[pid]._expanded = true;
    }
    renderPermissionDrawer();
}

function permToggleExpand(pid) {
    if (currentPermDraft.projects[pid]) {
        currentPermDraft.projects[pid]._expanded = !currentPermDraft.projects[pid]._expanded;
    }
    renderPermissionDrawer();
}

function permToggleCollection(pid, cid) {
    const proj = currentPermDraft.projects[pid];
    if (!proj) return;

    if (proj.collections[cid]) {
        delete proj.collections[cid];
    } else {
        proj.collections[cid] = {role: 'member', permissions: {}, _expanded: true};
    }
    renderPermissionDrawer();
}

function permToggleColAdmin(pid, cid, isAdmin) {
    const col = currentPermDraft.projects[pid]?.collections[cid];
    if (col) {
        col.role = isAdmin ? 'admin' : 'member';
        col._expanded = !isAdmin;
    }
    renderPermissionDrawer();
}

function permToggleColExpand(pid, cid) {
    const col = currentPermDraft.projects[pid]?.collections[cid];
    if (col) col._expanded = !col._expanded;
    renderPermissionDrawer();
}

function permUpdateAtomic(pid, cid, resKey, type, val) {
    const col = currentPermDraft.projects[pid]?.collections[cid];
    if (!col) return;
    if (!col.permissions) col.permissions = {};
    if (!col.permissions[resKey]) col.permissions[resKey] = {read: false, write: false};

    const p = col.permissions[resKey];

    if (type === 'write') {
        p.write = val;
        if (val) p.read = true;
    } else {
        p.read = val;
        if (!val) p.write = false;
    }

    renderPermissionDrawer();
}

function handleToolbarDelete() {
    if (selectedCrudIds.length > 0) openDeleteModal();
}

function openDeleteModal() {
    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');
    const schema = dbSchema[currentTable];
    const itemName = schema.itemLabel || schema.label.slice(0, -1);
    title.textContent = `Delete ${itemName}`;
    const count = selectedCrudIds.length;
    container.innerHTML = ` <div style="padding: 10px 0; font-size: 1rem; color: var(--text-secondary); line-height: 1.5;"> <div style="margin-bottom:8px;">Are you sure you want to delete <strong style="color:var(--text-main)">${count}</strong> selected item(s)?</div> <div style="font-size:0.85rem; color:#ef4444; font-weight:600;"><i data-lucide="alert-triangle" size="14" style="vertical-align:text-bottom"></i> This action cannot be undone.</div> </div> `;
    lucide.createIcons();
    if (submitBtn) {
        submitBtn.textContent = "Delete";
        submitBtn.className = "btn-danger";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = confirmDeleteData;
    }
    modal.classList.add('active');
}

function confirmDeleteData() {
    const pk = dbSchema[currentTable].pk;
    const currentData = getDataForTable(currentTable);
    for (let i = currentData.length - 1; i >= 0; i--) if (selectedCrudIds.includes(String(currentData[i][pk]))) currentData.splice(i, 1);
    selectedCrudIds = [];
    renderTableNav();
    renderCrudTable();
    updateToolbarState();
    closeCrudModal();
    if (currentTable === 'site' && map) renderMap(false);
}

function handleAudioTypeChange(type) {
    const inputIds = {
        sr: 'input-sampling_rate_Hz', bit: 'input-bit_depth', ch: 'input-channel_num', dur: 'input-duration_s', dutyRec: 'input-duty_cycle_recording', dutyPer: 'input-duty_cycle_period', size: 'input-size_B', filename: 'input-filename'
    };

    const els = {};
    Object.keys(inputIds).forEach(k => els[k] = document.getElementById(inputIds[k]));

    const setReadOnly = (el, isReadOnly) => {
        if (!el) return;
        el.readOnly = isReadOnly;
        if (isReadOnly) {
            el.style.opacity = '0.7';
            el.style.backgroundColor = 'var(--bg-capsule)';
        } else {
            el.style.opacity = '1';
            el.style.backgroundColor = '';
        }
    };

    const setVisible = (el, isVisible) => {
        if (!el) return;
        const group = el.closest('.form-group');
        if (group) {
            group.style.display = isVisible ? 'flex' : 'none';
        }
    };

    if (type === 'Audio File') {
        [els.sr, els.bit, els.ch, els.dur].forEach(el => setReadOnly(el, true));
        [els.dutyRec, els.dutyPer].forEach(el => setVisible(el, false));
        setVisible(els.size, true);
        setReadOnly(els.size, true);
        setVisible(els.filename, true);
        setReadOnly(els.filename, true);

    } else if (type === 'Metadata') {
        [els.sr, els.bit, els.ch, els.dur].forEach(el => setReadOnly(el, false));
        [els.dutyRec, els.dutyPer].forEach(el => {
            setVisible(el, true);
            setReadOnly(el, false);
        });
        setVisible(els.size, false);
        if (els.size) els.size.value = "";
        setVisible(els.filename, false);
        if (els.filename) els.filename.value = "";
    }
}

// --- Custom Searchable Select Logic ---

window.toggleFormSelect = function (id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    const isActive = dropdown.classList.contains('active');

    // Close all other dropdowns
    document.querySelectorAll('.form-select-dropdown').forEach(d => d.classList.remove('active'));

    if (!isActive) {
        dropdown.classList.add('active');
        const search = dropdown.querySelector('.form-select-search');
        if (search) {
            search.value = '';
            search.focus();
            // Reset filtering
            const list = dropdown.querySelector('.form-select-options-list');
            if (list) {
                Array.from(list.children).forEach(child => child.classList.remove('hidden'));
            }
        }
    }
};

window.filterFormSelect = function (dropdownId, query) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    const options = dropdown.querySelectorAll('.form-select-option');
    const val = query.toLowerCase();
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(val)) opt.classList.remove('hidden'); else opt.classList.add('hidden');
    });
};

window.selectFormOption = function (key, value, label, element) {
    const input = document.getElementById(`input-${key}`);
    if (input) input.value = value;

    const trigger = document.getElementById(`trigger-${key}`);
    if (trigger) {
        trigger.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label || 'Select...'}</span> <i data-lucide="chevron-down" size="16"></i>`;
        lucide.createIcons();
    }

    if (element) {
        const dropdown = element.closest('.form-select-dropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.form-select-option').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
        }
    }

    document.querySelectorAll('.form-select-dropdown').forEach(d => d.classList.remove('active'));

    if (currentTable === 'site') {
        if (key === 'realm') {
            updateDependentSelect('biome', value && TAXONOMY[value] ? Object.keys(TAXONOMY[value]) : []);
            updateDependentSelect('functional_type', []);
            // 新增：修改 Realm 时更新坐标
            updateSiteCoordinates(value);
        } else if (key === 'biome') {
            const realmInput = document.getElementById('input-realm');
            const realmVal = realmInput ? realmInput.value : null;
            const groups = (realmVal && value && TAXONOMY[realmVal] && TAXONOMY[realmVal][value]) ? TAXONOMY[realmVal][value] : [];
            updateDependentSelect('functional_type', groups);
            // 新增：修改 Biome 时更新坐标
            updateSiteCoordinates(realmVal);
        } else if (key === 'functional_type') {
            // 新增：修改 Functional Type 时更新坐标
            updateSiteCoordinates();
        }
    }

    if (key === 'audio_type') {
        handleAudioTypeChange(value);
    }

    if (currentTable === 'annotation' && key === 'sound_id') {
        if (window.updateAnnotationVisibility) {
            window.updateAnnotationVisibility();
        }
    }

    // 新增：监听 Review 状态改变
    if (currentTable === 'annotation_review' && key === 'annotation_review_status_id') {
        handleReviewStatusChange(value);
    }
};

function updateDependentSelect(key, options) {
    const dropdown = document.getElementById(`dropdown-${key}`);
    if (!dropdown) return;
    const input = document.getElementById(`input-${key}`);
    if (input) input.value = "";
    const trigger = document.getElementById(`trigger-${key}`);
    if (trigger) {
        trigger.innerHTML = `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Select...</span> <i data-lucide="chevron-down" size="16"></i>`;
        lucide.createIcons();
    }
    const list = dropdown.querySelector('.form-select-options-list');
    if (list) {
        let html = `<div class="form-select-option" onclick="selectFormOption('${key}', '', 'Select...', this)"><span style="opacity:0.5; font-style:italic;">Clear Selection</span></div>`;
        options.forEach(opt => {
            html += `<div class="form-select-option" onclick="selectFormOption('${key}', '${opt}', '${opt}', this)">${opt}</div>`;
        });
        list.innerHTML = html;
    }
}

function setupAnnotationDynamicVisibility() {
    const creatorInput = document.getElementById('input-creator_type');
    const soundInput = document.getElementById('input-sound_id');

    const update = () => {
        const creatorType = creatorInput ? creatorInput.value.toLowerCase().trim() : '';
        const soundClass = soundInput ? soundInput.value : '';

        const isUser = creatorType === 'user';
        const isBiophony = soundClass === 'Biophony';
        const showBioFields = isBiophony;

        toggleFieldVisibility('taxon_id', showBioFields);
        toggleFieldVisibility('uncertain', showBioFields);
        toggleFieldVisibility('sound_distance_m', showBioFields);
        toggleFieldVisibility('individual_num', showBioFields);

        const showConfidence = !isUser && isBiophony;
        toggleFieldVisibility('confidence', showConfidence);
    };

    if (creatorInput) {
        creatorInput.addEventListener('input', update);
    }

    update();
    window.updateAnnotationVisibility = update;
}

function toggleFieldVisibility(key, show) {
    let el = document.getElementById('input-' + key);
    if (!el) {
        el = document.getElementById('btn-bool-' + key);
    }
    if (el) {
        const group = el.closest('.form-group');
        if (group) {
            group.style.display = show ? 'flex' : 'none';
        }
    }
}

function openCrudModal(mode, id = null) {
    const schema = dbSchema[currentTable];
    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) {
        modalEl.style.width = (mode === 'add') ? '480px' : '960px';
    }

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (submitBtn) {
        submitBtn.textContent = "Save";
        submitBtn.className = "btn-primary";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = saveCrudData;
    }

    editingId = id;
    const itemName = schema.itemLabel || schema.label.slice(0, -1);
    title.textContent = mode === 'edit' ? `Edit ${itemName}` : `New ${itemName}`;

    let currentRow = {};
    if (mode === 'edit') {
        const currentData = getDataForTable(currentTable);
        currentRow = currentData.find(r => r[schema.pk] == id) || {};
    }

    let leftHtml = "";
    let rightHtml = "";

    schema.columns.forEach(col => {
        if (col.hiddenInForm) return;
        if (col.readonly && mode === 'add') return;
        if (col.onlyOnCreate && mode === 'edit') return;

        if (col.key === 'distance_not_estimable') return;

        if (currentTable === 'audio' && mode === 'edit') {
            const type = currentRow.audio_type;
            if (type === 'Audio File') {
                if (['duty_cycle_recording', 'duty_cycle_period'].includes(col.key)) return;
            } else if (type === 'Metadata') {
                if (['filename', 'size_B'].includes(col.key)) return;
            }
        }

        let val = mode === 'edit' ? (currentRow[col.key] !== undefined ? currentRow[col.key] : "") : "";
        if (val === null) val = "";

        if (col.key === 'sound_distance_m') {
            const unknownKey = 'distance_not_estimable';
            const isUnknown = mode === 'edit' ? (currentRow[unknownKey] === true) : false;

            const distDisabled = isUnknown;
            const distStyle = distDisabled ? "opacity:0.5; background:var(--bg-capsule);" : "";
            const distAttr = distDisabled ? "disabled" : "";

            let groupHtml = `<div class="form-group" style="position:relative;">`;

            groupHtml += `<label class="form-label">${col.label}</label>`;

            groupHtml += `<div style="position:absolute; top:0; right:0; display:flex; align-items:center; gap:8px;">`;

            groupHtml += `<label class="form-label" style="margin-bottom:0; font-size:0.8rem; color:var(--text-muted); cursor:pointer; font-weight:normal;" onclick="document.getElementById('btn-bool-${unknownKey}').click()">Not Estimable</label>`;

            const toggleBg = isUnknown ? 'var(--brand)' : 'var(--border-color)';
            const toggleAlign = isUnknown ? 'flex-end' : 'flex-start';

            groupHtml += `<input type="hidden" id="input-${unknownKey}" value="${isUnknown}">`;
            groupHtml += `<button id="btn-bool-${unknownKey}" onclick="toggleBoolean('${unknownKey}')" type="button" 
                style="width:36px; height:20px; background:${toggleBg}; border-radius:10px; border:none; padding:2px; display:flex; justify-content:${toggleAlign}; cursor:pointer; transition:all 0.2s;">`;
            groupHtml += `<span style="width:16px; height:16px; background:white; border-radius:50%; display:block; box-shadow:0 1px 2px rgba(0,0,0,0.2);"></span>`;
            groupHtml += `</button>`;
            groupHtml += `</div>`;

            groupHtml += `<input type="number" class="form-input" id="input-${col.key}" value="${isUnknown ? '' : val}" ${distAttr} style="${distStyle} width:100%;">`;

            groupHtml += `</div>`;

            leftHtml += groupHtml;
            return;
        }

        if (col.key === 'creation_date' && val) {
            try {
                let dateObj = new Date(val);
                if (!isNaN(dateObj)) {
                    val = dateObj.toISOString().replace('T', ' ').substring(0, 19);
                }
            } catch (e) {
            }
        }

        let effectiveType = col.type;
        let isReadOnly = col.readonly || (mode === 'edit' && col.readonlyOnUpdate);

        if (currentTable === 'audio') {
            if (col.key === 'audio_type' && mode === 'edit') {
                effectiveType = 'text';
                isReadOnly = true;
            }
            if (mode === 'edit' && currentRow.audio_type === 'Audio File') {
                const audioFileReadOnlyFields = ['sampling_rate_Hz', 'bit_depth', 'channel_num', 'duration_s', 'size_B', 'filename'];
                if (audioFileReadOnlyFields.includes(col.key)) {
                    isReadOnly = true;
                }
            }
        }

        let attrStr = "";
        if (isReadOnly) {
            const disStyle = "opacity:0.6; background:var(--bg-capsule); color:var(--text-muted);";
            attrStr = `disabled style="${disStyle}"`;
        }

        let fieldHtml = `<div class="form-group"><label class="form-label">${col.label}</label>`;

        if (effectiveType === 'select') {
            let options = col.options || [];
            if (currentTable === 'project' && col.key === 'creator_name') {
                const currentUser = document.querySelector('.user-name-text').textContent.trim();
                if (!options.includes(currentUser)) options.push(currentUser);
            } else if (['audio', 'photo', 'video'].includes(currentTable)) {
                if (col.key === 'site_id') options = currentSites.map(s => s.name);
                if (col.key === 'sensor_id') options = ["AudioMoth v1.2", "Song Meter Micro", "Zoom F3 + Clippy", "Sony PCM-D10"];
            } else if (currentTable === 'annotation') {
                if (col.key === 'media_id') {
                    const audio = getDataForTable('audio');
                    const photo = getDataForTable('photo');
                    const video = getDataForTable('video');
                    const allMedia = [...audio, ...photo, ...video];
                    options = allMedia.map(m => m.media_id);
                }
            } else if (currentTable === 'annotation_review') {
                if (col.key === 'annotation_id') {
                    const allAnnots = getDataForTable('annotation');
                    options = allAnnots.map(a => a.id);
                }
            } else if (currentTable === 'index_log') {
                if (col.key === 'media_id') {
                    const audio = getDataForTable('audio');
                    const photo = getDataForTable('photo');
                    const video = getDataForTable('video');
                    const allMedia = [...audio, ...photo, ...video];
                    options = allMedia.map(m => m.media_id);
                }
            } else if (currentTable === 'site') {
                if (col.key === 'biome') {
                    const r = currentRow['realm'];
                    if (r && TAXONOMY[r]) options = Object.keys(TAXONOMY[r]);
                } else if (col.key === 'functional_type') {
                    const r = currentRow['realm'];
                    const b = currentRow['biome'];
                    if (r && b && TAXONOMY[r] && TAXONOMY[r][b]) options = TAXONOMY[r][b];
                }
            }

            let currentLabel = "Select...";
            if (val) currentLabel = val;
            const isDisabled = attrStr.includes('disabled');
            const disabledClass = isDisabled ? 'disabled' : '';
            const wrapperStyle = attrStr.includes('disabled') ? "pointer-events:none;" : "";

            fieldHtml += `<div class="form-select-wrapper" id="wrapper-${col.key}" style="${wrapperStyle}">`;
            fieldHtml += `<input type="hidden" id="input-${col.key}" value="${val}">`;
            fieldHtml += `<div class="form-select-trigger ${disabledClass}" id="trigger-${col.key}" onclick="toggleFormSelect('dropdown-${col.key}')" ${attrStr}>`;
            fieldHtml += `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentLabel}</span>`;
            fieldHtml += `<i data-lucide="chevron-down" size="16"></i>`;
            fieldHtml += `</div>`;
            fieldHtml += `<div class="form-select-dropdown" id="dropdown-${col.key}">`;
            fieldHtml += `<input type="text" class="form-select-search" placeholder="Search..." oninput="filterFormSelect('dropdown-${col.key}', this.value)" onclick="event.stopPropagation()">`;
            fieldHtml += `<div class="form-select-options-list">`;
            fieldHtml += `<div class="form-select-option" onclick="selectFormOption('${col.key}', '', 'Select...', this)"><span style="opacity:0.5; font-style:italic;">Clear Selection</span></div>`;
            options.forEach(opt => {
                const isSelected = String(val) === String(opt) ? 'selected' : '';
                fieldHtml += `<div class="form-select-option ${isSelected}" onclick="selectFormOption('${col.key}', '${opt}', '${opt}', this)">${opt}</div>`;
            });
            fieldHtml += `</div></div></div>`;

        } else if (effectiveType === 'datetime-local') {
            let dtVal = val;
            if (val && val.includes(' ')) dtVal = val.replace(' ', 'T');
            fieldHtml += `<input type="datetime-local" class="form-input" id="input-${col.key}" value="${dtVal}" step="1" ${attrStr}>`;
        } else if (effectiveType === 'boolean') {
            const isTrue = val === true;
            fieldHtml += `<input type="hidden" id="input-${col.key}" value="${isTrue}">`;
            fieldHtml += `<button class="form-bool-trigger ${isTrue ? 'is-true' : ''}" id="btn-bool-${col.key}" onclick="toggleBoolean('${col.key}')" ${attrStr} type="button">`;
            fieldHtml += `<span id="lbl-bool-${col.key}">${isTrue ? 'True' : 'False'}</span>`;
            fieldHtml += `<i id="icon-bool-${col.key}" data-lucide="${isTrue ? 'check' : 'x'}" size="16"></i>`;
            fieldHtml += `</button>`;
        } else if (effectiveType === 'file') {
            fieldHtml += `<input type="file" id="input-${col.key}" onchange="handleFileChange(this)" style="display:none;">`;
            fieldHtml += `<div class="form-select-trigger" onclick="document.getElementById('input-${col.key}').click()" style="cursor:pointer; ${attrStr.includes('disabled') ? 'pointer-events:none;' : ''}" ${attrStr}>`;
            fieldHtml += `<span id="input-${col.key}-preview" style="display:flex; align-items:center; gap:8px; overflow:hidden;">`;
            if (val) {
                fieldHtml += `<img src="${val}" style="height:24px; border-radius:4px; border:1px solid var(--border-color);">`;
            } else {
                fieldHtml += `<span style="color:var(--text-muted); font-size:0.9rem;">Click to upload...</span>`;
            }
            fieldHtml += `</span>`;
            fieldHtml += `<i data-lucide="upload" size="16"></i>`;
            fieldHtml += `</div>`;
        } else if (effectiveType === 'richtext') {
            const safeVal = String(val).replace(/'/g, "&apos;");
            const textPreview = String(val).replace(/<[^>]*>?/gm, '');
            fieldHtml += `<input type="hidden" id="input-${col.key}" value='${safeVal}'>`;
            fieldHtml += `<div class="form-select-trigger" onclick="openEditorForInput('input-${col.key}')" style="cursor:pointer; ${attrStr.includes('disabled') ? 'pointer-events:none;' : ''}" ${attrStr}>`;
            fieldHtml += `<span id="input-${col.key}-preview" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${textPreview ? 'var(--text-main)' : 'var(--text-muted)'}; font-size:0.9rem;">`;
            fieldHtml += textPreview ? (textPreview.substring(0, 40) + (textPreview.length > 40 ? '...' : '')) : 'Edit content...';
            fieldHtml += `</span>`;
            fieldHtml += `<i data-lucide="file-edit" size="16"></i>`;
            fieldHtml += `</div>`;
        } else {
            fieldHtml += `<input type="text" class="form-input" id="input-${col.key}" value="${val}" ${attrStr}>`;
        }
        fieldHtml += `</div>`;

        if (isReadOnly) {
            rightHtml += fieldHtml;
        } else {
            leftHtml += fieldHtml;
        }
    });

    if (mode === 'add') {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${leftHtml}
                ${rightHtml} 
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start;">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${leftHtml || '<div style="color:var(--text-muted); font-style:italic;">No editable fields</div>'}
                </div>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${rightHtml}
                </div>
            </div>
        `;
    }

    if (currentTable === 'annotation') {
        setTimeout(setupAnnotationDynamicVisibility, 0);
    }

    // 新增：初始化 Review 表单的状态联动
    if (currentTable === 'annotation_review') {
        const statusInput = document.getElementById('input-annotation_review_status_id');
        if (statusInput) {
            handleReviewStatusChange(statusInput.value);
        }
    }

    modal.classList.add('active');
    lucide.createIcons();

    if (currentTable === 'audio' && mode !== 'edit') {
        const typeInput = document.getElementById('input-audio_type');
        if (typeInput) {
            handleAudioTypeChange(typeInput.value);
        }
    }
}

function closeCrudModal() {
    document.getElementById('crud-modal-overlay').classList.remove('active');
}

function saveCrudData() {
    if (currentTable === 'user' && editingId === null) {
        const pwd = document.getElementById('input-password').value;
        const confirm = document.getElementById('input-confirm_password').value;
        if (!pwd) {
            alert("Password is required");
            return;
        }
        if (pwd !== confirm) {
            alert("Passwords do not match");
            return;
        }
    }
    const schema = dbSchema[currentTable];
    let newRow = {};
    const isProject = currentTable === 'project';
    const isCollection = currentTable === 'collection';
    const currentData = getDataForTable(currentTable);

    const currentUser = document.querySelector('.user-name-text').textContent.trim();

    let existingRow = null;
    if (editingId !== null) existingRow = currentData.find(r => r[schema.pk] == editingId);
    schema.columns.forEach(col => {
        const input = document.getElementById(`input-${col.key}`);
        if (!input && col.type !== 'file' && col.type !== 'richtext') {
            if (existingRow && existingRow[col.key] !== undefined) newRow[col.key] = existingRow[col.key];
            return;
        }
        let val = input ? input.value : "";

        if (col.type === 'datetime-local' && val) {
            val = val.replace('T', ' ');
            if (val.split(':').length === 2) val += ':00';
        }

        if (col.type === 'number') val = Number(val);
        if (col.type === 'boolean') val = (val === 'true');
        if (col.type === 'file') {
            const fileInput = document.getElementById(`input-${col.key}`);
            const base64 = fileInput ? fileInput.getAttribute('data-base64') : null;
            if (base64) {
                val = base64;
            } else if (existingRow) {
                val = existingRow[col.key];
            } else val = "";
        }
        if (col.type === 'richtext') {
            const hiddenInput = document.getElementById(`input-${col.key}`);
            if (hiddenInput) val = hiddenInput.value;
        }
        newRow[col.key] = val;
    });
    if (currentTable === 'audio') {
        const currentUser = document.querySelector('.user-name-text').textContent.trim();
        if (!newRow.uploader_id) newRow.uploader_id = currentUser;
        if (!newRow.creator_id) newRow.creator_id = currentUser;
        if (!newRow.creation_date) newRow.creation_date = moment().format("YYYY-MM-DD HH:mm:ss");
    }
    if (isProject && !newRow.creator_name) newRow.creator_name = currentUser;
    if (isCollection && !newRow.creator_id) newRow.creator_id = currentUser;
    if (currentTable === 'site') {
        if (!newRow.creator_id) newRow.creator_id = currentUser;
        if (!newRow.creation_date) newRow.creation_date = moment().format("YYYY-MM-DD HH:mm:ss");
    }

    if (isProject) {
        const mappedProject = {id: newRow.project_id, name: newRow.name, creator: newRow.creator_name, externalUrl: newRow.url, image: newRow.picture_url, description: newRow.description, doi: newRow.doi, date: newRow.creation_date};
        if (editingId !== null) {
            const target = rawProjects.find(p => p.id == editingId);
            if (target) {
                Object.assign(target, mappedProject);
                if (editingId == rawProjects[currProjIdx].id) updateContent(target, true);
            }
        } else {
            if (rawProjects.length > 0) {
                mappedProject.id = Math.max(...rawProjects.map(p => p.id)) + 1;
            } else mappedProject.id = 1;
            mappedProject.collections = [];
            mappedProject.stats = {users: 0, collections: 0, audios: "0", photos: 0, videos: 0, annotations: 0, sites: 0};
            mappedProject.contributors = [];
            if (!mappedProject.date) mappedProject.date = moment().format("YYYY-MM-DD HH:mm:ss");
            rawProjects.push(mappedProject);
        }
        renderProjectList();
    } else if (isCollection) {
        const proj = rawProjects[currProjIdx];
        const mappedCol = {
            name: newRow.name, creator: newRow.creator_id, doi: newRow.doi, sphere: newRow.sphere, external_project_url: newRow.external_project_url, external_media_url: newRow.external_media_url, description: newRow.description, active: newRow.public_access, date: newRow.creation_date || moment().format("YYYY-MM-DD HH:mm:ss")
        };
        if (editingId !== null) {
            const colIndex = editingId - 1;
            if (proj.collections[colIndex]) Object.assign(proj.collections[colIndex], mappedCol);
        } else {
            mappedCol.id = `c${proj.collections.length + Date.now()}`;
            mappedCol.stats = {users: 0, projects: 1, audios: 0, photos: 0, videos: 0, annotations: 0, sites: 0};
            mappedCol.contributors = [];
            proj.collections.push(mappedCol);
        }
        renderCollectionList();
    } else if (editingId !== null) {
        const idx = currentData.findIndex(r => r[schema.pk] == editingId);
        if (idx !== -1) Object.assign(currentData[idx], newRow);
    } else {
        if (currentData.length > 0 && typeof currentData[0][schema.pk] === 'number') {
            const maxId = currentData.reduce((max, r) => Math.max(max, r[schema.pk] || 0), 0);
            newRow[schema.pk] = maxId + 1;
        } else newRow[schema.pk] = `new-${Date.now()}`;
        currentData.push(newRow);
    }
    if (currentTable === 'site' && map) renderMap(false);
    renderTableNav();
    renderCrudTable();
    closeCrudModal();
}

function resetDataTable() {
    crudSearchQuery = "";
    crudFilterState = {};

    const schema = dbSchema[currentTable];
    sortState = {key: schema.pk, direction: 'asc'};

    selectedCrudIds = [];
    updateToolbarState();
    const searchInput = document.getElementById('data-search-input');
    if (searchInput) searchInput.value = "";
    renderCrudHeader();
    renderCrudTable();
}

function handleSetContributor() {
    if (selectedCrudIds.length === 0) return;

    const isProject = currColIdx === 0;
    const roles = isProject ? projRoles : colRoles;
    const roleLabel = isProject ? "Project Contributor" : "Collection Contributor";

    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    title.textContent = `Set ${roleLabel}`;

    let html = `
        <div class="form-group">
            <label class="form-label">Contributor</label>
            <select class="form-input" id="input-set-role">
    `;

    roles.forEach(r => {
        html += `<option value="${r}">${r}</option>`;
    });

    html += `</select></div>`;

    container.innerHTML = html;

    if (submitBtn) {
        submitBtn.textContent = "Save";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = saveSetContributor;
    }

    modal.classList.add('active');
}

function saveSetContributor() {
    const newRole = document.getElementById('input-set-role').value;
    const isProject = currColIdx === 0;
    const context = isProject ? rawProjects[currProjIdx] : rawProjects[currProjIdx].collections[currColIdx - 1];

    const findUser = (uid) => {
        for (const p of rawProjects) {
            for (const u of p.contributors) if (String(u.uid) === String(uid)) return u;
            for (const c of p.collections) {
                for (const u of c.contributors) if (String(u.uid) === String(uid)) return u;
            }
        }
        return null;
    };

    selectedCrudIds.forEach(uid => {
        const existingContrib = context.contributors.find(c => String(c.uid) === String(uid));

        if (existingContrib) {
            existingContrib.role = newRole;
        } else {
            const userDetails = findUser(uid);
            if (userDetails) {
                context.contributors.push({
                    name: userDetails.name, email: userDetails.email, uid: userDetails.uid, role: newRole
                });
            }
        }
    });

    renderCrudTable();
    closeCrudModal();

    if (document.getElementById('tab-summary').classList.contains('active')) {
        renderSummary();
    }
}


function toggleToolbarUploadDropdown(e) {
    e.stopPropagation();
    const btn = document.getElementById('btn-add');
    let drop = document.getElementById('toolbar-upload-dropdown');

    if (!drop) {
        drop = document.createElement('div');
        drop.id = 'toolbar-upload-dropdown';
        drop.className = 'toolbar-dropdown';
        drop.innerHTML = `
            <div class="toolbar-drop-item" onclick="triggerAudioUpload()">
                <i data-lucide="mic" size="16"></i> Audios
            </div>
            <div class="toolbar-drop-item" onclick="triggerMetadataUpload()">
                <i data-lucide="file-text" size="16"></i> Metadata
            </div>
            <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
            <div class="toolbar-drop-item" onclick="showMetadataInstructions()">
                <i data-lucide="info" size="16"></i> Metadata Instructions
            </div>
        `;
        document.body.appendChild(drop);
        lucide.createIcons();

        document.addEventListener('click', (event) => {
            if (!drop.contains(event.target) && event.target !== btn && !btn.contains(event.target)) {
                drop.classList.remove('active');
            }
        });
    }

    const rect = btn.getBoundingClientRect();
    drop.style.top = (rect.bottom + 4) + 'px';
    drop.style.left = (rect.right - 200) + 'px';

    if (drop.classList.contains('active')) {
        drop.classList.remove('active');
    } else {
        closeAllMenus();
        drop.classList.add('active');
    }
}

function triggerAudioUpload() {
    closeToolbarDropdown();
    let input = document.getElementById('hidden-upload-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'hidden-upload-input';
        input.multiple = true;
        input.accept = 'audio/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', (e) => handleFilesSelect(e.target.files, 'audio'));
    }
    input.value = '';
    input.click();
}

function triggerMetadataUpload() {
    closeToolbarDropdown();
    let input = document.getElementById('hidden-metadata-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'hidden-metadata-input';
        input.accept = '.csv';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', (e) => handleMetadataSelect(e.target.files));
    }
    input.value = '';
    input.click();
}

function closeToolbarDropdown() {
    const drop = document.getElementById('toolbar-upload-dropdown');
    if (drop) drop.classList.remove('active');
}

function handleMetadataSelect(files) {
    if (files && files.length > 0) {
        setTimeout(() => {
            const success = true;
            if (success) {
                alert('Metadata uploaded successfully!');
                location.reload();
            } else {
                alert('Metadata upload failed.');
            }
        }, 500);
    }
}

function handleFilesSelect(files, type) {
    if (files.length > 0) {
        if (!document.getElementById('crud-modal-overlay').classList.contains('active')) {
            uploadFilesQueue = [];
        }

        Array.from(files).forEach(f => {
            f.uid = Math.random().toString(36).substr(2, 9);
            f.progress = 0;
            f.chunkIndex = 0;
            f.totalChunks = Math.floor(Math.random() * 5) + 3;
            f.type = type;
            uploadFilesQueue.push(f);
        });

        showUploadModalUI();
    }
}

function showUploadModalUI() {
    const modal = document.getElementById('crud-modal-overlay');
    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '1000px';

    title.textContent = "Upload Audio";

    const renderUploadSelect = (key, label, options) => {
        let html = `<div class="form-group"><label class="form-label">${label}</label>`;
        html += `<div class="form-select-wrapper">`;
        html += `<input type="hidden" id="input-${key}" value="">`;
        html += `<div class="form-select-trigger" id="trigger-${key}" onclick="toggleFormSelect('dropdown-${key}')">`;
        html += `<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Select...</span> <i data-lucide="chevron-down" size="16"></i></div>`;
        html += `<div class="form-select-dropdown" id="dropdown-${key}">`;
        html += `<input type="text" class="form-select-search" placeholder="Search..." oninput="filterFormSelect('dropdown-${key}', this.value)" onclick="event.stopPropagation()">`;
        html += `<div class="form-select-options-list">`;

        options.forEach(opt => {
            const val = opt.val || opt;
            const txt = opt.txt || opt;
            const safeVal = String(val).replace(/'/g, "\\'");
            const safeTxt = String(txt).replace(/'/g, "\\'");
            html += `<div class="form-select-option" onclick="selectFormOption('${key}', '${safeVal}', '${safeTxt}', this)">${txt}</div>`;
        });

        html += `</div></div></div></div>`;
        return html;
    };

    const siteOpts = currentSites.map(s => ({val: s.id, txt: s.name}));
    const sensorOpts = ["AudioMoth v1.2", "Song Meter Micro", "Zoom F3", "Sony PCM-D10"];
    const mediumOpts = ["Air", "Water"];
    const licenseOpts = mockLicenses;

    const html = `
    <div class="upload-layout">
        <div class="upload-left">
            <div class="upload-queue-header">
                <div class="card-title" style="font-size:1rem; margin:0;">Queue</div>
                <div class="upload-stats">
                    Total: <span id="up-total">0</span> | Completed: <span id="up-completed">0</span>
                </div>
            </div>
            
            <div class="upload-file-list" id="upload-file-list"></div>
            
            <div class="upload-btn-wrapper">
                <button class="btn-secondary" style="width:100%; justify-content:center;" onclick="triggerAudioUpload()">
                    <i data-lucide="plus" size="16"></i> Upload
                </button>
            </div>
        </div>
        
        <div class="upload-right">
            <div class="form-group" style="position:relative;">
                <label class="form-label">Date Time</label>
                <div style="position:absolute; top:0; right:0; display:flex; align-items:center; gap:8px;">
                    <label class="form-label" style="margin-bottom:0; font-size:0.8rem; color:var(--text-muted); cursor:pointer; font-weight:normal;" onclick="document.getElementById('btn-dt-filename').click()">From filename</label>
                    <button id="btn-dt-filename" onclick="toggleDtInput()" type="button" style="width:36px; height:20px; background:var(--border-color); border-radius:10px; border:none; padding:2px; display:flex; justify-content:flex-start; cursor:pointer; transition:all 0.2s;">
                        <span style="width:16px; height:16px; background:white; border-radius:50%; display:block; box-shadow:0 1px 2px rgba(0,0,0,0.2);"></span>
                    </button>
                </div>
                <input type="datetime-local" class="form-input" id="up-datetime" style="width:100%;">
            </div>

            ${renderUploadSelect('up-site', 'Site', siteOpts)}
            ${renderUploadSelect('up-sensor', 'Sensor', sensorOpts)}
            ${renderUploadSelect('up-medium', 'Medium', mediumOpts)}
            ${renderUploadSelect('up-license', 'License', licenseOpts)}
            
            <div class="form-group">
                <label class="form-label">Recording Gain (dB)</label>
                <input type="number" class="form-input" id="up-gain">
            </div>
            
            <div class="form-group">
                <label class="form-label">DOI</label>
                <input type="text" class="form-input" id="up-doi">
            </div>
            
             <div class="form-group">
                <label class="form-label">Note</label>
                <input type="text" class="form-input" id="up-note">
            </div>
            
            <div class="form-group">
                <label class="form-label">Sound Name Prefix</label>
                <input type="text" class="form-input" id="up-prefix">
            </div>
        </div>
    </div>
    `;

    container.innerHTML = html;

    if (submitBtn) {
        submitBtn.textContent = "Finish";
        submitBtn.style.backgroundColor = "";
        submitBtn.onclick = () => {
            clearInterval(uploadTimer);
            closeCrudModal();
        };
    }

    const list = document.getElementById('upload-file-list');
    if (list) list.innerHTML = '';

    renderUploadFileList();
    modal.classList.add('active');
    lucide.createIcons();

    if (uploadTimer) clearInterval(uploadTimer);
    uploadTimer = setInterval(simulateUploadProgress, 200);

    document.addEventListener('click', closeDropdownOnClickOutside);
}

function renderUploadFileList() {
    const list = document.getElementById('upload-file-list');
    if (!list) return;

    const total = uploadFilesQueue.length;
    const completed = uploadFilesQueue.filter(f => f.progress >= 100).length;

    const totalEl = document.getElementById('up-total');
    const compEl = document.getElementById('up-completed');
    if (totalEl) totalEl.textContent = total;
    if (compEl) compEl.textContent = completed;

    uploadFilesQueue.forEach(f => {
        const percent = Math.round(f.progress);
        const isDone = percent >= 100;
        const statusText = isDone ? 'Completed' : `Uploading...`;

        const iconName = f.type === 'csv' ? 'file-text' : 'mic';

        let itemEl = document.getElementById(`up-item-${f.uid}`);

        if (!itemEl) {
            itemEl = document.createElement('div');
            itemEl.className = 'up-file-item';
            itemEl.id = `up-item-${f.uid}`;

            itemEl.innerHTML = `
                <div class="up-file-name">
                    <span id="icon-wrap-${f.uid}"><i data-lucide="${iconName}" size="14" style="color:var(--text-muted)"></i></span>
                    ${f.name}
                </div>
                <div class="up-progress-bg">
                    <div class="up-progress-fill" id="prog-${f.uid}" style="width: 0%"></div>
                </div>
                <div class="up-file-status" id="status-${f.uid}">
                    <span>${statusText}</span>
                    <span>0%</span>
                </div>
            `;
            list.appendChild(itemEl);
            lucide.createIcons();
        } else {
            const progEl = document.getElementById(`prog-${f.uid}`);
            const statusEl = document.getElementById(`status-${f.uid}`);
            const iconWrap = document.getElementById(`icon-wrap-${f.uid}`);

            if (progEl) progEl.style.width = `${percent}%`;

            if (statusEl) {
                statusEl.innerHTML = `<span>${statusText}</span><span>${percent}%</span>`;
            }

            if (isDone && iconWrap && !iconWrap.classList.contains('done')) {
                iconWrap.classList.add('done');
                iconWrap.innerHTML = `<i data-lucide="check-circle" size="14" style="color:var(--brand)"></i>`;
                lucide.createIcons();
            }
        }
    });
}

function toggleUploadDropdown(e) {
    if (e) e.stopPropagation();
    const drop = document.getElementById('upload-dropdown');
    if (drop) drop.classList.toggle('active');
}

function closeDropdownOnClickOutside(e) {
    const drop = document.getElementById('upload-dropdown');
    const btn = document.querySelector('.upload-btn-wrapper');
    if (drop && drop.classList.contains('active')) {
        if (!btn.contains(e.target)) {
            drop.classList.remove('active');
        }
    }
}

function showMetadataInstructions() {
    closeToolbarDropdown();

    let instrModal = document.getElementById('instr-modal-overlay');
    if (!instrModal) {
        instrModal = document.createElement('div');
        instrModal.id = 'instr-modal-overlay';
        instrModal.className = 'crud-modal-overlay';
        instrModal.style.zIndex = '10050';

        instrModal.innerHTML = `
        <div class="crud-modal" style="width: 600px; max-width: 90vw; height: auto;">
            <div class="card-title">View Instructions</div>
            <div class="instr-content">
                <p>Recording meta-data can be uploaded with a CSV containing the following columns:</p>
                <ul class="instr-list">
                    <li><code>recording_start</code> (format: YYYY-MM-DD HH:MM:SS, local time)</li>
                    <li><code>duration_s</code> (duration of recording in seconds)</li>
                    <li><code>sampling_rate</code> (numeric value in Hz)</li>
                    <li><code>name</code> (optional, limited to 40 characters)</li>
                    <li><code>bit_depth</code> (optional, integer)</li>
                    <li><code>channel_number</code> (optional, integer)</li>
                    <li><code>duty_cycle_recording</code> (duration of duty-cycled recordings in minutes)</li>
                    <li><code>duty_cycle_period</code> (duration of cycle - recording + pause - in minutes)</li>
                </ul>
                <a href="#" class="template-download-link" onclick="event.preventDefault(); alert('Template CSV downloaded.')">
                    <i data-lucide="download" size="16"></i> Download template CSV file
                </a>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="document.getElementById('instr-modal-overlay').classList.remove('active')">Close</button>
            </div>
        </div>
        `;
        document.body.appendChild(instrModal);

        instrModal.addEventListener('click', (e) => {
            if (e.target === instrModal) instrModal.classList.remove('active');
        });
    }

    requestAnimationFrame(() => {
        instrModal.classList.add('active');
        lucide.createIcons();
    });
}

function simulateUploadProgress() {
    let allDone = true;
    let changed = false;

    uploadFilesQueue.forEach(f => {
        if (f.progress < 100) {
            allDone = false;
            f.progress += Math.random() * 5;
            if (f.progress > 100) f.progress = 100;

            const chunkStep = 100 / f.totalChunks;
            f.chunkIndex = Math.min(f.totalChunks, Math.ceil(f.progress / chunkStep));

            changed = true;
        }
    });

    if (changed) renderUploadFileList();
    if (allDone) clearInterval(uploadTimer);
}

function toggleDtInput() {
    const btn = document.getElementById('btn-dt-filename');
    const el = document.getElementById('up-datetime');
    if (!btn || !el) return;

    const isChecked = btn.style.justifyContent === 'flex-end';
    const newVal = !isChecked;

    if (newVal) {
        btn.style.backgroundColor = 'var(--brand)';
        btn.style.justifyContent = 'flex-end';
    } else {
        btn.style.backgroundColor = 'var(--border-color)';
        btn.style.justifyContent = 'flex-start';
    }

    el.disabled = newVal;
    el.style.opacity = newVal ? '0.6' : '1';
    el.style.background = newVal ? 'var(--bg-capsule)' : '';
}

window.toggleBoolean = function (key) {
    const input = document.getElementById(`input-${key}`);
    const btn = document.getElementById(`btn-bool-${key}`);
    const lbl = document.getElementById(`lbl-bool-${key}`);
    const icon = document.getElementById(`icon-bool-${key}`);

    if (!input || !btn || btn.disabled) return;

    const currentVal = input.value === 'true';
    const newVal = !currentVal;

    input.value = newVal;

    // --- 特殊处理：distance_not_estimable (带记忆功能的开关) ---
    if (key === 'distance_not_estimable') {
        // 1. 更新开关样式
        if (newVal) {
            // 开 (True / Not Estimable)
            btn.style.backgroundColor = 'var(--brand)';
            btn.style.justifyContent = 'flex-end';
        } else {
            // 关 (False / Estimable)
            btn.style.backgroundColor = 'var(--border-color)';
            btn.style.justifyContent = 'flex-start';
        }

        // 2. 联动 Input 状态
        const distInput = document.getElementById('input-sound_distance_m');
        if (distInput) {
            if (newVal === true) {
                // 状态变更为：不可估测
                // 【核心修改】：在清空前，先保存当前输入的值
                distInput.dataset.savedValue = distInput.value;

                distInput.value = ''; // 清空显示
                distInput.disabled = true;
                distInput.style.opacity = '0.5';
                distInput.style.backgroundColor = 'var(--bg-capsule)';
            } else {
                // 状态变更为：可估测
                // 【核心修改】：如果有保存的值，则恢复
                if (distInput.dataset.savedValue !== undefined) {
                    distInput.value = distInput.dataset.savedValue;
                }

                distInput.disabled = false;
                distInput.style.opacity = '1';
                distInput.style.backgroundColor = '';
                distInput.style.cursor = '';
                distInput.focus();
            }
        }
        return; // 特殊处理完毕，直接返回
    }

    // --- 常规 Boolean 字段逻辑 ---
    lbl.textContent = newVal ? 'True' : 'False';

    if (newVal) {
        btn.classList.add('is-true');
        icon.setAttribute('data-lucide', 'check');
    } else {
        btn.classList.remove('is-true');
        icon.setAttribute('data-lucide', 'x');
    }
    lucide.createIcons();
};

window.toggleTableFilterSelect = function (id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    // Close other table filters
    document.querySelectorAll('.table-filter-dropdown').forEach(d => {
        if (d.id !== id) d.classList.remove('active');
    });
    // Close form selects (modal)
    document.querySelectorAll('.form-select-dropdown').forEach(d => d.classList.remove('active'));

    const isActive = dropdown.classList.contains('active');
    if (!isActive) {
        dropdown.classList.add('active');
        const search = dropdown.querySelector('.table-filter-search');
        if (search) {
            search.value = '';
            search.focus();
            const list = dropdown.querySelector('.table-filter-options-list');
            if (list) {
                Array.from(list.children).forEach(child => child.classList.remove('hidden'));
            }
        }
    } else {
        dropdown.classList.remove('active');
    }
};

window.filterTableFilterSelect = function (dropdownId, query) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    const options = dropdown.querySelectorAll('.table-filter-option');
    const val = query.toLowerCase();
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(val)) opt.classList.remove('hidden');
        else opt.classList.add('hidden');
    });
};

window.selectTableFilterOption = function (key, value, label) {
    // Apply filter
    handleColumnFilter(key, value);

    // Update Header UI manually
    const triggerSpan = document.getElementById(`filter-trigger-span-${key}`);
    if (triggerSpan) triggerSpan.textContent = label;

    const dropdown = document.getElementById(`filter-dropdown-${key}`);
    if (dropdown) dropdown.classList.remove('active');
};

window.handleMultiParentCollectionChange = function (input) {
    const colId = input.value;
    const isChecked = input.checked;

    // 找到所有代表同一个 Collection 的 checkbox
    const allInputs = document.querySelectorAll(`.link-multi-col-cb[value="${colId}"]`);

    allInputs.forEach(el => {
        if (el === input) {
            // 当前点击的元素：保持启用
            el.disabled = false;
        } else {
            // 其他同名元素：
            // 如果当前是勾选，其他变为勾选且禁用（视觉上表示已关联，但在当前上下文不可更改）
            // 如果当前是取消，其他变为未勾选且启用
            el.checked = isChecked;
            el.disabled = isChecked;
        }
    });
};

// 初始化时的刷新函数（打开弹窗时调用）
function refreshMultiParentStates() {
    // 获取所有复选框
    const allInputs = document.querySelectorAll('.link-multi-col-cb');
    const processedIds = new Set();

    allInputs.forEach(input => {
        const colId = input.value;
        if (processedIds.has(colId)) return; // 已经处理过该 ID 组

        // 获取该 ID 的所有实例
        const sameIdInputs = document.querySelectorAll(`.link-multi-col-cb[value="${colId}"]`);

        // 检查是否有任何一个是 checked
        let hasChecked = false;
        let activeInput = null;

        // 优先保留第一个被选中的作为“主控”，或者如果没有选中的，保持全部开启
        for (let el of sameIdInputs) {
            if (el.checked) {
                hasChecked = true;
                activeInput = el;
                break;
            }
        }

        if (hasChecked && activeInput) {
            sameIdInputs.forEach(el => {
                if (el !== activeInput) {
                    el.checked = true;
                    el.disabled = true;
                } else {
                    el.disabled = false;
                }
            });
        } else {
            sameIdInputs.forEach(el => {
                el.disabled = false;
            });
        }

        processedIds.add(colId);
    });
}

// --- 新增：更新 Site 坐标的辅助函数 ---
function updateSiteCoordinates(realm) {
    const latInput = document.getElementById('input-latitude');
    const lngInput = document.getElementById('input-longitude');

    // 如果页面上没有这两个输入框（例如非 Site 页面），直接返回
    if (!latInput || !lngInput) return;

    // 如果未传入 realm（例如修改 Biome 时），尝试从界面获取
    if (!realm) {
        const rEl = document.getElementById('input-realm');
        realm = rEl ? rEl.value : 'Terrestrial';
    }

    // 模拟坐标生成逻辑：根据 Realm 生成不同的随机坐标范围
    let lat, lng;
    if (realm === 'Marine') {
        // 海洋：大堡礁附近
        lat = -18.2871 + (Math.random() - 0.5);
        lng = 147.6992 + (Math.random() - 0.5);
    } else if (realm === 'Freshwater') {
        // 淡水：亚马逊河附近
        lat = -3.1190 + (Math.random() - 0.5);
        lng = -60.0217 + (Math.random() - 0.5);
    } else if (realm === 'Atmospheric') {
        // 大气：赤道附近
        lat = 0.0 + (Math.random() * 10 - 5);
        lng = 0.0 + (Math.random() * 10 - 5);
    } else {
        // 默认 / 陆地：亚马逊雨林深处
        lat = -3.4653 + (Math.random() - 0.5);
        lng = -62.2159 + (Math.random() - 0.5);
    }

    // 更新输入框的值
    latInput.value = lat.toFixed(4);
    lngInput.value = lng.toFixed(4);

    // 视觉反馈：稍微闪烁一下背景色提示用户数值已变
    const highlight = (el) => {
        el.style.transition = 'background 0.3s';
        el.style.backgroundColor = 'var(--brand-tint)';
        setTimeout(() => el.style.backgroundColor = '', 500);
    };
    highlight(latInput);
    highlight(lngInput);
}

// --- 新增：处理 Review 状态变更的联动逻辑 ---
function handleReviewStatusChange(status) {
    const taxonInput = document.getElementById('input-taxon_id');
    const taxonTrigger = document.getElementById('trigger-taxon_id');
    const wrapper = document.getElementById('wrapper-taxon_id');

    if (!taxonInput || !taxonTrigger) return;

    if (status === 'Revise') {
        // 启用
        if (wrapper) wrapper.style.pointerEvents = 'auto';
        taxonTrigger.classList.remove('disabled');
        taxonTrigger.style.opacity = '1';
        taxonTrigger.style.backgroundColor = '';

        // 恢复之前保存的值（如果有）
        if (taxonInput.dataset.savedValue) {
            const savedVal = taxonInput.dataset.savedValue;
            taxonInput.value = savedVal;
            const span = taxonTrigger.querySelector('span');
            // 显示恢复的值
            if (span) span.textContent = savedVal;
            // 也要同步选中下拉列表中的样式（可选，视觉优化）
            const dropdown = document.getElementById('dropdown-taxon_id');
            if (dropdown) {
                dropdown.querySelectorAll('.form-select-option').forEach(opt => {
                    if (opt.innerText === savedVal) opt.classList.add('selected');
                    else opt.classList.remove('selected');
                });
            }
        }
    } else {
        // 禁用
        // 如果当前有值，先保存起来以便恢复
        if (taxonInput.value) {
            taxonInput.dataset.savedValue = taxonInput.value;
        }

        // 清空当前值
        taxonInput.value = "";

        // 设置禁用样式
        if (wrapper) wrapper.style.pointerEvents = 'none';
        taxonTrigger.classList.add('disabled');
        taxonTrigger.style.opacity = '0.5';
        taxonTrigger.style.backgroundColor = 'var(--bg-capsule)';

        // 重置显示文本
        const span = taxonTrigger.querySelector('span');
        if (span) span.textContent = "Select...";

        // 清除下拉选中状态
        const dropdown = document.getElementById('dropdown-taxon_id');
        if (dropdown) {
            dropdown.querySelectorAll('.form-select-option').forEach(opt => opt.classList.remove('selected'));
        }
    }
}

let currentTaxonCollectionId = null;
let currentSelectedTaxonForAdd = null;

function handleToolbarTaxon() {
    if (selectedCrudIds.length !== 1) return;
    currentTaxonCollectionId = selectedCrudIds[0];
    let collection = null;
    for (let p of rawProjects) {
        collection = p.collections.find(c => String(c.id) === String(currentTaxonCollectionId));
        if (collection) break;
    }
    if (!collection) return;
    if (!collection._taxons) collection._taxons = [];

    clearSelectedTaxon();
    document.getElementById('taxon-notes-input').value = '';

    renderTaxonList();
    document.getElementById('taxon-drawer-overlay').classList.add('active');
    lucide.createIcons();
}

function closeTaxonDrawer() {
    document.getElementById('taxon-drawer-overlay').classList.remove('active');
    currentTaxonCollectionId = null;
    clearSelectedTaxon();
}

function handleTaxonSearchInput(query) {
    const dropdown = document.getElementById('taxon-search-dropdown');
    clearSelectedTaxon(false);
    query = query.toLowerCase().trim();
    if (!query) {
        dropdown.classList.remove('active');
        return;
    }
    const results = mockTaxonDB.filter(t => t.name.toLowerCase().includes(query));
    if (results.length > 0) {
        dropdown.innerHTML = `<div class="form-select-options-list">` + results.map(r => `
            <div class="form-select-option" style="display: flex; justify-content: space-between; align-items: center;" onclick="selectTaxonForAdd('${r.id}', '${r.name}', '${r.rank}')">
                <span>${r.name}</span>
                <span style="opacity: 0.6; font-size: 0.85em;">${r.rank}</span>
            </div>
        `).join('') + `</div>`;
        dropdown.classList.add('active');
    } else {
        dropdown.innerHTML = `<div class="form-select-options-list">
            <div style="padding: 10px 14px; color: var(--text-muted); font-size: 0.9rem; text-align: left;">No matches found</div>
        </div>`;
        dropdown.classList.add('active');
    }
}

function selectTaxonForAdd(id, name, rank) {
    currentSelectedTaxonForAdd = {id, name, rank};
    document.getElementById('taxon-search-input').value = name;
    document.getElementById('taxon-search-dropdown').classList.remove('active');
    const badge = document.getElementById('taxon-selected-badge');
    badge.textContent = `(${rank})`;
    badge.style.display = 'inline-block';
    document.getElementById('btn-add-taxon').disabled = false;
}

function clearSelectedTaxon(clearSearchInput = true) {
    currentSelectedTaxonForAdd = null;
    if (clearSearchInput) document.getElementById('taxon-search-input').value = '';
    const badge = document.getElementById('taxon-selected-badge');
    if (badge) badge.style.display = 'none';
    const btn = document.getElementById('btn-add-taxon');
    if (btn) btn.disabled = true;
    const dropdown = document.getElementById('taxon-search-dropdown');
    if (dropdown) dropdown.classList.remove('active');
    const errorMsg = document.getElementById('taxon-error-msg');
    if (errorMsg) errorMsg.style.display = 'none';
}

function addTaxonToCollection() {
    if (!currentSelectedTaxonForAdd) return;
    let collection = null;
    for (let p of rawProjects) {
        collection = p.collections.find(c => String(c.id) === String(currentTaxonCollectionId));
        if (collection) break;
    }
    if (!collection) return;
    if (!collection._taxons) collection._taxons = [];

    const errorMsg = document.getElementById('taxon-error-msg');
    if (errorMsg) errorMsg.style.display = 'none';

    const isDuplicate = collection._taxons.some(t => String(t.col_taxon_id) === String(currentSelectedTaxonForAdd.id));
    if (isDuplicate) {
        if (errorMsg) {
            errorMsg.textContent = "Already added";
            errorMsg.style.display = 'inline-block';
        }
        return;
    }

    const notes = document.getElementById('taxon-notes-input').value;
    const currentUser = document.querySelector('.user-name-text').textContent.trim();

    const newTaxon = {
        collection_id: currentTaxonCollectionId,
        col_taxon_id: currentSelectedTaxonForAdd.id,
        col_rank: currentSelectedTaxonForAdd.rank,
        cached_name: currentSelectedTaxonForAdd.name,
        asserted_by: currentUser,
        asserted_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        notes: notes
    };

    collection._taxons.push(newTaxon);

    clearSelectedTaxon();
    document.getElementById('taxon-notes-input').value = '';
    renderTaxonList();

    if (currentTable === 'collection') {
        renderCrudTable();
    }

    // 如果当前正在查看该 Collection，强制刷新描述页面以显示新的 Taxon
    const viewedCol = (currColIdx > 0) ? rawProjects[currProjIdx].collections[currColIdx - 1] : null;
    if (viewedCol && String(viewedCol.id) === String(currentTaxonCollectionId)) {
        selectCollection(currColIdx, true);
    }
}

function removeTaxonFromCollection(index) {
    let collection = null;
    for (let p of rawProjects) {
        collection = p.collections.find(c => String(c.id) === String(currentTaxonCollectionId));
        if (collection) break;
    }
    if (!collection || !collection._taxons) return;
    collection._taxons.splice(index, 1);
    renderTaxonList();

    if (currentTable === 'collection') {
        renderCrudTable();
    }

    // 如果当前正在查看该 Collection，强制刷新描述页面以更新 Taxon
    const viewedCol = (currColIdx > 0) ? rawProjects[currProjIdx].collections[currColIdx - 1] : null;
    if (viewedCol && String(viewedCol.id) === String(currentTaxonCollectionId)) {
        selectCollection(currColIdx, true);
    }
}

// 替换 project.js 中的 renderTaxonList 函数
function renderTaxonList() {
    const container = document.getElementById('taxon-list-container');
    let collection = null;
    for (let p of rawProjects) {
        collection = p.collections.find(c => String(c.id) === String(currentTaxonCollectionId));
        if (collection) break;
    }
    if (!collection || !collection._taxons || collection._taxons.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">
                <div style="font-size: 0.85rem;">No Taxons Linked</div>
            </div>`;
        return;
    }

    let html = `<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">`;
    html += collection._taxons.map((t, index) => `
        <div class="taxon-capsule-item">
            <span>${t.cached_name}</span>
            <i data-lucide="x" size="12" style="margin-left: 6px; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" onclick="removeTaxonFromCollection(${index})"></i>
            
            <div class="taxon-tooltip" style="text-align: left;">
                <div style="font-weight: 700; margin-bottom: 6px; color: var(--brand); font-size: 0.85rem; text-align: left; text-transform: capitalize;">${t.col_rank}</div>
                <div style="margin-bottom: 4px; text-align: left;"><span style="color: var(--text-muted); display:inline-block; width: 28px;">BY:</span> ${t.asserted_by}</div>
                <div style="margin-bottom: 4px; text-align: left;"><span style="color: var(--text-muted); display:inline-block; width: 28px;">AT:</span> ${t.asserted_at}</div>
                ${t.notes ? `<div style="text-align: left; width: 100%; white-space: normal; line-height: 1.4;"><span style="color: var(--text-muted);">Notes:</span> ${t.notes}</div>` : ''}
            </div>
        </div>
    `).join('');
    html += `</div>`;

    container.innerHTML = html;
    lucide.createIcons();

    // 🌟 核心改进：在 DOM 渲染后，浏览器重绘前，立刻计算所有悬浮窗的防溢出位置
    // 这样在用户肉眼看到之前，靠边元素的悬浮窗就已经向内靠拢了，彻底杜绝滚动条闪烁出现
    requestAnimationFrame(() => {
        const items = container.querySelectorAll('.taxon-capsule-item');
        items.forEach(el => {
            if (window.adjustTaxonTooltip) window.adjustTaxonTooltip(el);
        });
    });
}

// 放在 project.js 最末尾即可
window.adjustTaxonTooltip = function (el) {
    const tooltip = el.querySelector('.taxon-tooltip');
    if (!tooltip) return;
    const container = el.closest('#taxon-list-container') || document.body;

    // 重置居中
    tooltip.style.left = '50%';
    tooltip.style.right = 'auto';
    tooltip.style.transform = 'translateX(-50%)';

    const rect = el.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const tooltipWidth = 220;

    // 靠右溢出时，向左对齐
    if (rect.left + (rect.width / 2) + (tooltipWidth / 2) > contRect.right) {
        tooltip.style.left = 'auto';
        tooltip.style.right = '0';
        tooltip.style.transform = 'none';
    }
    // 靠左溢出时，向右对齐
    else if (rect.left + (rect.width / 2) - (tooltipWidth / 2) < contRect.left) {
        tooltip.style.left = '0';
        tooltip.style.right = 'auto';
        tooltip.style.transform = 'none';
    }
};
init();