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

function generateSitesForContext(projId, colId) {
    // [修改] 适配纯数字 ID 的随机种子生成
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
        // [修改] 纯数字 ID
        const siteId = `${projId}${cidNum}${String(i).padStart(3, '0')}`;
        return {
            id: siteId,
            name: `Site ${String.fromCharCode(65 + (i % 26))}-${100 + i}`,
            center: [lat, lng],
            polygon: poly,
            realm: r,
            biome: b,
            group: g,
            topography_m: Math.floor(Math.random() * 800),
            freshwater_depth_m: r === 'Freshwater' ? (Math.random() * 15).toFixed(1) : "N/A",
            mediaCount: Math.floor(Math.random() * 10) + 2,
            media: Array.from({length: Math.floor(Math.random() * 10) + 2}, (_, m) => ({name: `${r.slice(0, 3).toUpperCase()}_REC_${202500 + m}.wav`, date: "2025-01-15", duration: "01:00:00"}))
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
        if (filterState.group && site.group !== filterState.group) return;
        if (currentSelectedSiteId && site.id === currentSelectedSiteId) isCurrentSiteVisible = true;
        visibleCount++;
        const siteColor = getRealmColor(site.realm);
        const poly = L.polygon(site.polygon, {color: siteColor, weight: 2, opacity: 0.8, fillColor: siteColor, fillOpacity: 0.15}).addTo(polyLayer);
        poly.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openSidebar(site);
        });
        const marker = L.marker(site.center, {
            customData: {realm: site.realm, mediaCount: site.mediaCount}, icon: L.divIcon({html: `<div class="site-marker-pin" style="border-color:${siteColor}; color:${siteColor}">${site.mediaCount}</div>`, className: 'custom-cluster-icon', iconSize: [28, 28]})
        });
        marker.on('click', () => openSidebar(site));
        clusterGroup.addLayer(marker);
        visibleBounds.extend(site.center);
    });
    if (currentSelectedSiteId && !isCurrentSiteVisible) closeSidebar();
    if ((shouldZoom || visibleCount > 0) && visibleCount > 0) if (visibleCount === 1) map.flyTo(visibleBounds.getCenter(), 14, {duration: 0.8, easeLinearity: 0.5}); else map.fitBounds(visibleBounds, {padding: [50, 50], maxZoom: 15, duration: 0.8, easeLinearity: 0.5});
}

function openSidebar(site) {
    currentSelectedSiteId = site.id;
    const color = getRealmColor(site.realm);
    document.documentElement.style.setProperty('--site-color', color);
    document.documentElement.style.setProperty('--site-color-tint', color + '12');
    document.getElementById('sb-name').textContent = site.name;
    document.getElementById('val-realm').textContent = site.realm;
    document.getElementById('val-realm').style.color = color;
    document.getElementById('val-biome').textContent = site.biome;
    document.getElementById('val-group').textContent = site.group;
    const topoHtml = `<div class="sb-meta-item" title="Topography"><i data-lucide="mountain" size="14"></i> ${site.topography_m}m</div>`;
    const depthHtml = site.freshwater_depth_m !== "N/A" ? `<div class="sb-meta-divider"></div><div class="sb-meta-item" title="Water Depth"><i data-lucide="waves" size="14"></i> ${site.freshwater_depth_m}m</div>` : '';
    const metaContainer = document.getElementById('sb-meta-container');
    if (metaContainer) metaContainer.innerHTML = topoHtml + depthHtml;
    const mockSpectrogram = "https://ecosound-web.de/ecosound_web/sounds/images/51/27/6533-player_s.png";
    const mediaHtml = site.media.map((m) => {
        const mockAnnotationsHtml = `<span class="media-annotation">Bio</span><span class="media-annotation">Aves</span>`;
        const mockTime = "14:30:00";
        const mockSize = "2.4 MB";
        return `<div class="media-item-card" onclick="event.stopPropagation();">
<div class="spectrogram-cover"><img src="${mockSpectrogram}" class="spectrogram-img" alt="Spec">
    <div class="play-overlay">
        <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
    </div>
    <div class="duration-badge">${m.duration}</div>
</div>
<div class="media-card-info"><a href="#" class="media-name" title="${m.name}" onclick="return false;">${m.name}</a>
    <div class="annotations-row">${mockAnnotationsHtml}</div>
    <div class="media-meta-row">
        <div class="meta-icon-text"><i data-lucide="calendar" size="14"></i> ${m.date}</div>
        <div class="meta-icon-text"><i data-lucide="clock" size="14"></i> ${mockTime}</div>
        <div class="meta-icon-text"><i data-lucide="hard-drive" size="14"></i> ${mockSize}</div>
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

function closeSidebar() {
    currentSelectedSiteId = null;
    document.getElementById('sidebar').classList.remove('active');
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
    const options = getUniqueValues(filteredData, targetType);
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
        // ... (时间生成代码不变) ...
        const h = Math.floor(Math.random() * 24).toString().padStart(2, '0');
        const m = Math.floor(Math.random() * 60).toString().padStart(2, '0');
        const s = Math.floor(Math.random() * 60).toString().padStart(2, '0');
        const fullDate = `${2021 + Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        const timeStr = `${h}:${m}:${s}`;

        const recId = 20250000 + i;
        const numId = Number(basePrefix + recId);

        const typePool = ["audio", "audio", "audio", "photo"];
        const mediaType = typePool[rInt(0, 3)];
        const isAudio = mediaType === 'audio';

        const audioSourceType = isAudio ? (Math.random() > 0.3 ? "Audio File" : "Metadata") : null;
        const ext = isAudio ? "wav" : "jpg";
        const baseName = `REC_${basePrefix}_${recId}.${ext}`;

        let fileName = baseName;
        // [修改] 如果是 Metadata，Filename 为空
        if (isAudio && audioSourceType === 'Metadata') {
            fileName = "";
        }

        let sizeBytes = Math.floor(Math.random() * 1024 * 1024 * (isAudio ? 50 : 5));
        let dutyRec = null;
        let dutyPer = null;

        if (isAudio && audioSourceType === 'Metadata') {
            // [修改] Metadata 模式下，列表显示的 Size 为空
            sizeBytes = null;
            dutyRec = 60;
            dutyPer = 3600;
        }

        const uploader = mockNames[rInt(0, mockNames.length - 1)];

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
            date_time: `${fullDate} ${timeStr}`, // 确保包含秒
            // [修改] 列表显示用的 size 字符串
            size: sizeBytes ? `${(sizeBytes / 1024 / 1024).toFixed(2)} MB` : "",
            size_B: sizeBytes,
            recording_gain_dB: isAudio ? rInt(0, 60) : null,
            sampling_rate_Hz: isAudio ? [44100, 48000, 96000][rInt(0, 2)] : null,
            bit_depth: isAudio ? [16, 24][rInt(0, 1)] : null,
            channel_num: isAudio ? [1, 2][rInt(0, 1)] : null,
            duration_s: isAudio ? rInt(10, 3600) : null,
            doi: `10.ECO/${numId}`,
            creation_date: moment().format("YYYY-MM-DD HH:mm:ss"), // [修改] 格式化为标准日期时间
            annotations: getRandomAnnotations(),
            sr: "48kHz",
            spectrogram: "https://ecosound-web.de/ecosound_web/sounds/images/51/27/6533-player_s.png",
            fullDate: `${fullDate} ${h}:${m}`,
            duration: `00:${rInt(10, 59)}`
        };
    });
};

function updateMediaContext() {
    const proj = rawProjects[currProjIdx];
    const col = currColIdx > 0 ? proj.collections[currColIdx - 1] : null;
    mediaItems = generateMediaForContext(proj, col);
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
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:10px;"><i data-lucide="filter" size="32" style="opacity:0.3"></i><span>No media matches your filter</span></div>`;
        lucide.createIcons();
        return;
    }
    let html = '';
    filteredItems.forEach(item => {
        const annotationsHtml = item.annotations.map(t => `<span class="media-annotation">${t}</span>`).join('');
        if (isGallery) {
            html += `<div class="media-item-card">
<div class="spectrogram-cover"><img src="${item.spectrogram}" class="spectrogram-img" alt="Spec">
    <div class="play-overlay">
        <div class="play-circle"><i data-lucide="play" fill="currentColor"></i></div>
    </div>
    <div class="duration-badge">${item.duration}</div>
</div>
<div class="media-card-info"><a href="#" class="media-name" title="${item.name}" onclick="event.stopPropagation(); return false;">${item.name}</a>
    <div class="annotations-row">${annotationsHtml}</div>
    <div class="media-meta-row">
        <div class="meta-icon-text"><i data-lucide="calendar" size="14"></i> ${item.date}</div>
        <div class="meta-icon-text"><i data-lucide="clock" size="14"></i> ${item.time}</div>
        <div class="meta-icon-text"><i data-lucide="hard-drive" size="14"></i> ${item.size}</div>
    </div>
</div>
</div>`;
        } else {
            const realmColor = getRealmColor(item.realm);
            const depthHtml = item.freshwater_depth_m !== 'N/A' ? `<span title="Water Depth"><i data-lucide="waves" size="12"></i> ${item.freshwater_depth_m}m</span>` : '';
            html += `<div class="media-item-row">
<div class="list-spec-container"><img src="${item.spectrogram}" class="list-spec-img" alt="Spec">
    <div class="duration-badge">${item.duration}</div>
</div>
<div class="row-basic-info"><a href="#" class="row-name" title="${item.name}" onclick="event.stopPropagation(); return false;">${item.name}</a>
    <div class="annotations-row">${annotationsHtml}</div>
    <div class="row-meta-list">
        <div class="row-meta-item"><i data-lucide="calendar" size="14"></i> ${item.date}</div>
        <div class="row-meta-item"><i data-lucide="clock" size="14"></i> ${item.time}</div>
        <div class="row-meta-item"><i data-lucide="hard-drive" size="14"></i> ${item.size}</div>
    </div>
</div>
<div class="row-details-col">
    <div class="rd-header-row">
        <div class="rd-site-group">
            <div class="rd-site-name"><i data-lucide="map-pin" size="14" style="color:var(--brand);"></i>${item.site}</div>
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
            // 修改：直接使用 index 取模，避免因 item.id 为字符串导致计算出现 NaN
            const siteIndex = index % realSites.length;
            const linkedSite = realSites[siteIndex];

            if (linkedSite) {
                item.site = linkedSite.name;
                item.realm = linkedSite.realm;
                item.biome = linkedSite.biome;
                item.group = linkedSite.group;
                item.topography_m = linkedSite.topography_m;
                item.freshwater_depth_m = linkedSite.freshwater_depth_m;
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
        order = ['Users', 'Collections', 'Audios', 'Photos', 'Videos', 'Annotations', 'Sites'];
        contributorsArr = proj.contributors;
        contribBgIconName = 'folder-kanban';
    } else {
        const col = rawProjects[currProjIdx].collections[currColIdx - 1];
        type = "Collection";
        statsObj = col.stats;
        order = ['Users', 'Projects', 'Audios', 'Photos', 'Videos', 'Annotations', 'Sites'];
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
            contribHTML += `<div class="contrib-item"><div class="contrib-info-block"><span class="contrib-name">${p.name}</span><div class="contrib-sub"><a href="mailto:${p.email}" class="contrib-email"><i data-lucide="mail"></i>${p.email}</a><span class="contrib-divider">•</span><a href="https://orcid.org/${p.uid}" target="_blank" class="orcid-link" title="ORCID: ${p.uid}"><i data-lucide="id-card"></i><span class="cid">${p.uid}</span></a></div></div><span class="contrib-role-text ${isCreator ? 'creator-role' : ''}">${p.role}</span></div>`;
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

            // [修改] 如果不是管理者，强制 scope 为 'all'，否则默认为 'current'
            // 移除了 switchCrudTable('collection') 的跳转逻辑
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

function selectCollection(idx) {
    const dropdown = document.getElementById('dropdown-collection');
    dropdown.style.display = 'none';
    if (currColIdx !== idx) {
        currColIdx = idx;
        colSearchQuery = "";
        document.querySelector('#dropdown-collection input').value = "";
        const container = document.getElementById('desc-layout-container');
        const project = rawProjects[currProjIdx];
        if (currColIdx === 0) {
            container.classList.remove('mode-collection');
            animateTextSwap('label-collection', "All Collections");
        } else {
            const colData = project.collections[currColIdx - 1];
            const colContainer = document.getElementById('panel-col-desc');
            const colDoiShort = colData.doi.split('/')[1];
            const updateCollectionHTML = () => {
                // [修改] 构建合并的链接 HTML
                let externalLinksHtml = '';
                // 检查是否有链接
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

                colContainer.innerHTML = `<div class="collection-card block-anim">
<div class="col-header-group">
    <div class="col-badge"><i data-lucide="globe-2" size="14"></i> ${colData.sphere}</div>
    <div class="title-row">
        <h2 class="col-title smooth-text">${colData.name}</h2> 
        <div style="display:flex; gap:8px;">
            ${externalLinksHtml}
        </div>
    </div>
    <div class="col-meta-row smooth-text">
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

// [新增] Media 筛选状态


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
            // 简单的权限模拟：如果不是管理员，只看自己的
            // 实际逻辑通常由后端处理，前端这里只是模拟视图过滤
            // source = source.filter(p => p.creator === currentUser);
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
                // [修改] 映射新的 URL 字段
                external_project_url: c.external_project_url,
                external_media_url: c.external_media_url,
                public_access: c.active !== undefined ? c.active : false,
                public_annotations: false,
                creation_date: c.date,
                _rawId: c.id,
                _isCurrent: isCurrent
            };
        });
    } else if (tableName === 'site') {
        return currentSites;
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
        // 去重
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
        return staticMockDB.annotation || [];
    } else if (tableName === 'annotation_review') {
        return staticMockDB.annotation_review || [];
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
        // [修改] 移除了之前检查 creator !== currentUser 然后 return 的逻辑
        // 确保 Project 始终显示在列表中

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

    // [Modified] Button Logic
    if (addBtn) {
        // 移除旧的 dropdown (防止切换 tab 时残留)
        const oldDrop = document.getElementById('toolbar-upload-dropdown');
        if (oldDrop) oldDrop.remove();

        if (isMediaTable) {
            addBtn.innerHTML = `<i data-lucide="upload" size="16"></i> Upload`;
            // 绑定到新的 Dropdown 逻辑
            addBtn.onclick = (e) => toggleToolbarUploadDropdown(e);

            // 注入 Dropdown HTML 结构到按钮内部或附近 (这里选择动态生成并定位)
            // 为了定位方便，给 btn-add 加个相对定位的父级或者直接用 absolute
            // 这里我们动态插入 dropdown 元素到 .media-controls 容器中
        } else {
            addBtn.innerHTML = `<i data-lucide="plus" size="16"></i> Add`;
            addBtn.onclick = () => openCrudModal('add');
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

    // 如果 min 和 max 都为空，清理该 key
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

        // 获取当前筛选值 (可能是字符串，也可能是对象 {min, max})
        const currentFilterVal = crudFilterState[col.key];

        if (col.filterType === 'range') {
            // [新增] 范围筛选渲染
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
            const valStr = currentFilterVal || "";
            filterInputHtml = `<select class="th-filter-input" onchange="handleColumnFilter('${col.key}', this.value)" onclick="event.stopPropagation()"><option value="all">All</option><option value="true" ${valStr === 'true' ? 'selected' : ''}>True</option><option value="false" ${valStr === 'false' ? 'selected' : ''}>False</option></select>`;
        } else if (col.type === 'select' && col.filterType !== 'text') {
            const valStr = currentFilterVal || "";
            let opts = `<option value="all">All</option>`;
            const uniqueVals = getUniqueValues(getDataForTable(currentTable), col.key);
            uniqueVals.forEach(o => {
                const isSelected = String(valStr) === String(o);
                opts += `<option value="${o}" ${isSelected ? 'selected' : ''}>${o}</option>`;
            });
            filterInputHtml = `<select class="th-filter-input" onchange="handleColumnFilter('${col.key}', this.value)" onclick="event.stopPropagation()">${opts}</select>`;
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

    // 检查当前用户权限
    const currentUser = document.querySelector('.user-name-text').textContent.trim();
    const currentProject = rawProjects[currProjIdx];
    const isManager = currentProject.creator === currentUser;

    if (!isManager && dataScope === 'current') {
        dataScope = 'all';
    }

    let titleHtml = `<i data-lucide="${schema.icon}"></i> ${schema.label}`;

    // [修改] 渲染标题栏右侧的切换器
    if (['project', 'collection', 'user'].includes(currentTable)) {
        const currentBtnAttr = isManager ? `onclick="switchDataScope('current', this)"` : `disabled style="font-size:0.75rem; padding:0 12px; opacity:0.5; cursor:not-allowed;"`;
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
        // 全局搜索逻辑保持不变
        const matchesGlobal = !crudSearchQuery || Object.values(row).some(v => String(v).toLowerCase().includes(crudSearchQuery));
        if (!matchesGlobal) return false;

        // 列筛选逻辑更新
        return Object.keys(crudFilterState).every(key => {
            const filterVal = crudFilterState[key];
            const rowVal = row[key];

            // [新增] 处理范围筛选 (对象类型 {min, max})
            if (typeof filterVal === 'object' && (filterVal.min !== undefined || filterVal.max !== undefined)) {
                if (rowVal === null || rowVal === undefined || rowVal === "") return false; // 空值不参与数值范围筛选
                const numVal = Number(rowVal);
                if (isNaN(numVal)) return false;

                if (filterVal.min !== "" && numVal < Number(filterVal.min)) return false;
                if (filterVal.max !== "" && numVal > Number(filterVal.max)) return false;
                return true;
            }

            // 处理常规字符串/布尔筛选
            const strFilterVal = String(filterVal).toLowerCase();
            const strRowVal = String(rowVal !== undefined ? rowVal : "").toLowerCase();

            if (strFilterVal === 'true' || strFilterVal === 'false') return strRowVal === strFilterVal;
            return strRowVal.includes(strFilterVal);
        });
    });

    // 排序逻辑 (保持不变)
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

    // 渲染表格内容
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
            bodyHtml += `<tr class="${rowClass}" ondblclick="openCrudModal('edit', '${row[pk]}')">`;
            bodyHtml += ` <td style="text-align:center; border-bottom:1px solid var(--border-color);"> <input type="checkbox" class="crud-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleRowSelection('${rowIdStr}', this)" ondblclick="event.stopPropagation()"> </td>`;
            visibleCols.forEach(col => {
                // 排除特定条件下的列
                if (currentTable === 'user') {
                    if (currColIdx === 0 && col.key === 'collection_role') return;
                    if (currColIdx > 0 && col.key === 'project_role') return;
                }
                let val = row[col.key];
                if (val === undefined || val === null) val = "";

                // Current 标记逻辑
                if (currentTable === 'project' && col.key === 'project_id') {
                    const currentProjId = rawProjects[currProjIdx] ? rawProjects[currProjIdx].id : null;
                    if (dataScope === 'all' && String(row.project_id) === String(currentProjId)) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(131,205,32,0.3);">Current</span> </div>`;
                }
                if (currentTable === 'collection' && col.key === 'collection_id' && dataScope === 'all' && row._isCurrent) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(131,205,32,0.3);">Current</span> </div>`;
                if (currentTable === 'user' && col.key === 'user_id' && dataScope === 'all' && row._isCurrent) val = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"> <span>${val}</span> <span style="background:var(--brand); color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; box-shadow:0 2px 5px rgba(131,205,32,0.3);">Current</span> </div>`;

                // 类型渲染
                if (col.type === 'image' || col.type === 'file') val = `<img src="${val}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);" alt="img" onerror="this.style.display='none'">`;
                if (col.type === 'boolean') val = val ? `<span class="status-badge status-true">True</span>` : `<span class="status-badge status-false">False</span>`;
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
    if (selectedCrudIds.length !== 1) return;
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

// 全局 Map：记录当前弹窗中显示了哪些 Collection (Key: ID, Value: Collection Object)
let currentModalSelectableColMap = new Map();

function openLinkModal() {
    const modal = document.getElementById('crud-modal-overlay');

    // [Fix] 显式重置宽度，防止继承 Upload 或 Edit 的宽度
    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (currentTable === 'project') {
        const isMulti = selectedCrudIds.length > 1;
        title.textContent = isMulti ? `Link Collections to ${selectedCrudIds.length} Projects` : "Link Collections to Project";

        const currentUser = document.querySelector('.user-name-text').textContent.trim();

        // 1. 获取当前目标项目已关联的 Collection ID (用于单选时的初始勾选状态)
        const currentLinkedColIds = new Set();
        if (!isMulti) {
            const targetProj = rawProjects.find(p => String(p.id) === selectedCrudIds[0]);
            if (targetProj) {
                targetProj.collections.forEach(c => currentLinkedColIds.add(String(c.id)));
            }
        }

        // 2. 清空并重新构建 Map
        currentModalSelectableColMap.clear();
        let html = `<div class="form-group"><div style="padding-right: 4px;">`;
        let hasFoundAny = false;

        const sortedProjects = [...rawProjects].sort((a, b) => {
            const aSelected = selectedCrudIds.includes(String(a.id));
            const bSelected = selectedCrudIds.includes(String(b.id));
            return (bSelected ? 1 : 0) - (aSelected ? 1 : 0);
        });

        // 3. 遍历项目，收集所有可用的 Collection，并按 ID 去重
        sortedProjects.forEach(proj => {
            const isProjCreator = proj.creator === currentUser;

            const validCols = proj.collections.filter(c => {
                if (isProjCreator) return true;
                if (c.creator === currentUser) return true;
                const contrib = c.contributors.find(u => u.name === currentUser);
                if (contrib && ['Admin', 'Manage'].includes(contrib.role)) return true;
                return false;
            });

            // 仅显示那些 ID 尚未出现的 Collection
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
                    // 核心：用数据中的 ID 作为 Key
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

        if (!hasFoundAny) {
            html += `<div style="padding:20px; color:var(--text-muted); text-align:center;">No writable collections found.</div>`;
        }

        html += `</div></div>`;
        container.innerHTML = html;
        lucide.createIcons();

        if (submitBtn) {
            submitBtn.textContent = "Save";
            submitBtn.style.backgroundColor = "";
            submitBtn.onclick = saveLinkData;
            submitBtn.disabled = false;
        }
        modal.classList.add('active');
    }
}

function saveLinkData() {
    const checkboxes = document.querySelectorAll('.link-target-cb:checked');
    const selectedIds = new Set(Array.from(checkboxes).map(cb => cb.value));

    if (currentTable === 'project') {
        selectedCrudIds.forEach(projIdStr => {
            const proj = rawProjects.find(p => String(p.id) === projIdStr);
            if (proj) {
                const newCollections = [];
                // 记录当前项目已有的 Collection ID，用于快速判断
                const existingIds = new Set(proj.collections.map(c => String(c.id)));

                // 1. 处理项目中【已存在】的 Collection
                proj.collections.forEach(c => {
                    const cId = String(c.id);

                    // Case A: 如果这个 Collection 根本没在弹窗里出现（比如没权限看），必须保留，不能误删
                    if (!currentModalSelectableColMap.has(cId)) {
                        newCollections.push(c);
                        return;
                    }

                    // Case B: 如果在弹窗里出现了，只有当用户【勾选】了它，才保留
                    // 关键：这里直接 push 原对象 c，而不使用 Map 里的对象，从而保留原始引用
                    if (selectedIds.has(cId)) {
                        newCollections.push(c);
                    }
                });

                // 2. 处理【新增】的 Collection (用户勾选了，但项目里原来没有)
                selectedIds.forEach(id => {
                    if (!existingIds.has(id)) {
                        // 只有这种情况下，才从 Map 中获取对象引用
                        if (currentModalSelectableColMap.has(id)) {
                            newCollections.push(currentModalSelectableColMap.get(id));
                        }
                    }
                });

                proj.collections = newCollections;
            }
        });
    }

    renderCrudTable();
    closeCrudModal();
    updateToolbarState();

    renderTableNav();
    if (currColIdx > 0 || document.getElementById('dropdown-collection').style.display !== 'none') {
        renderCollectionList();
    }
}

function handleToolbarEdit() {
    if (selectedCrudIds.length === 1) openCrudModal('edit', selectedCrudIds[0]);
}

function handleToolbarResetPassword() {
    if (selectedCrudIds.length !== 1) return;
    const modal = document.getElementById('crud-modal-overlay');

    // [Fix] 显式重置宽度为空，使用 CSS 默认值 (480px)
    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '';

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');
    title.textContent = "Reset Password";
    container.innerHTML = ` <div class="form-group"> <label class="form-label">Current Admin Password</label> <input type="password" class="form-input" id="reset-admin-pwd"> </div> <div class="form-group"> <label class="form-label">New Password</label> <input type="password" class="form-input" id="reset-new-pwd"> </div> <div class="form-group"> <label class="form-label">Confirm Password</label> <input type="password" class="form-input" id="reset-confirm-pwd"> </div> `;
    if (submitBtn) {
        submitBtn.textContent = "Submit";
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

/* ==========================================================================
   New Three-Level Permission System (Global -> Project -> Collection -> Atomic)
   ========================================================================== */

// Mock Backend Permission Database (Key: UserID, Value: Permission Object)
const USER_PERMISSIONS_DB = {};

// Current permission draft being edited
let currentPermDraft = null;
let currentPermUserIds = [];

// Resource Definitions
const PERM_RESOURCES = [{key: 'recording', label: 'Recording', icon: 'mic'}, {key: 'site', label: 'Site', icon: 'map-pin'}, {key: 'annotation', label: 'Annotation', icon: 'scan-line'}, {key: 'review', label: 'Review', icon: 'check-circle'}];

// Initialize permissions for a user (create default if not exists)
function initUserPermission(userId) {
    if (!USER_PERMISSIONS_DB[userId]) {
        USER_PERMISSIONS_DB[userId] = {
            role: 'user', projects: {}
        };
    }
    // Deep copy for editing
    return JSON.parse(JSON.stringify(USER_PERMISSIONS_DB[userId]));
}

// Update Toolbar State
// Update Toolbar State
function updateToolbarState() {
    const editBtn = document.getElementById('btn-edit');
    const delBtn = document.getElementById('btn-delete');
    const linkBtn = document.getElementById('btn-link');
    const resetBtn = document.getElementById('btn-reset-pwd');
    const permBtn = document.getElementById('btn-permission');
    const setContribBtn = document.getElementById('btn-set-contrib'); // [修复] 找回丢失的按钮引用
    const count = selectedCrudIds.length;

    if (editBtn) {
        editBtn.disabled = (count !== 1);
        editBtn.style.display = '';
    }
    if (delBtn) {
        delBtn.disabled = (count === 0);
        delBtn.style.display = '';
    }

    if (linkBtn) {
        if (currentTable === 'project') {
            linkBtn.style.display = 'inline-flex';
            linkBtn.disabled = (count !== 1);
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

    // [修复] 补回 Set Contributor 按钮的逻辑
    if (setContribBtn) {
        if (currentTable === 'user') {
            setContribBtn.style.display = 'inline-flex';
            setContribBtn.disabled = (count === 0);
        } else {
            setContribBtn.style.display = 'none';
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

// Open Permission Drawer
function handleToolbarPermission() {
    if (selectedCrudIds.length === 0) return;

    currentPermUserIds = [...selectedCrudIds];

    // 初始化数据逻辑不变...
    if (currentPermUserIds.length === 1) {
        const userId = currentPermUserIds[0];
        initUserPermission(userId); // 确保初始化
        currentPermDraft = JSON.parse(JSON.stringify(USER_PERMISSIONS_DB[userId]));
    } else {
        currentPermDraft = {role: 'user', projects: {}};
    }

    renderPermissionDrawer();

    // 修改：只需要激活 Overlay，CSS 中的 .crud-modal-overlay.active .crud-modal 会处理滑动动画
    document.getElementById('perm-drawer-overlay').classList.add('active');
    lucide.createIcons();
}

function closePermissionDrawer() {
    document.getElementById('perm-drawer-overlay').classList.remove('active');
    // 不需要单独移除 drawer 的 active 类，因为使用了组合 CSS 选择器
    currentPermDraft = null;
    currentPermUserIds = [];
}

// Save Permissions
function savePermissionDrawer() {
    if (currentPermUserIds.length > 0 && currentPermDraft) {
        currentPermUserIds.forEach(uid => {
            USER_PERMISSIONS_DB[uid] = JSON.parse(JSON.stringify(currentPermDraft));
        });

        const btn = document.querySelector('.perm-drawer-footer .btn-primary');
        const originText = btn.textContent;
        btn.textContent = "Saved!";
        btn.style.background = "#22c55e";
        setTimeout(() => {
            btn.textContent = originText;
            btn.style.background = "";
            closePermissionDrawer();
        }, 800);
    }
}

/* ==========================================================================
   Updated Rendering Logic (Fix: Handle Collection 'Manage' Role in Bulk State)
   ========================================================================== */
function renderPermissionDrawer() {
    const isGlobalAdmin = currentPermDraft.role === 'super_admin';
    const headerContainer = document.getElementById('perm-drawer-header');
    const contentContainer = document.getElementById('perm-content-container');

    // 1. 渲染 Header
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

    // 2. 渲染内容
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

        // 计算批量图标状态 (bulkStates)
        let bulkStates = {};

        PERM_RESOURCES.forEach(res => {
            let allRead = true;
            let allWrite = true;

            // 如果项目下没有集合，或者项目本身没权限，则状态为 none
            if (!hasAccess || proj.collections.length === 0) {
                allRead = false;
                allWrite = false;
            } else {
                // 遍历该项目下所有的 Collection
                for (const c of proj.collections) {
                    const cid = String(c.id);
                    const userCol = userProj?.collections?.[cid];

                    // [修复] 检查集合级管理员权限
                    // 如果集合是 Manage (admin) 权限，则默认拥有所有资源的读写权限
                    if (userCol && userCol.role === 'admin') {
                        continue; // 此集合满足条件，继续检查下一个
                    }

                    // 否则检查具体的细分权限
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

            // 确定最终状态
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
        const state = currentStates[res.key]; // 'none', 'read', 'write'
        let btnClass = '';
        let stateText = 'None';

        if (state === 'write') {
            btnClass = 'active-write';
            stateText = 'Write';
        } else if (state === 'read') {
            btnClass = 'active';
            stateText = 'Read';
        }

        // 计算下一个点击状态
        let nextState = 'read';
        if (state === 'read') nextState = 'write';
        if (state === 'write') nextState = 'none';

        // [重要] 这里去掉了 title属性，改用内部的 .perm-res-tooltip div
        html += `
        <div class="perm-res-btn ${btnClass}" 
             onclick="permToggleProjectBulk('${pid}', '${res.key}', '${nextState}')">
            <i data-lucide="${res.icon}" size="14"></i>
            <div class="perm-res-tooltip">${res.label}: ${stateText}</div>
        </div>`;
    });
    return html;
}

// [新增] 项目级批量切换权限函数
function permToggleProjectBulk(pid, resKey, targetState) {
    const projDraft = currentPermDraft.projects[pid];
    if (!projDraft) return;

    // 获取该项目的所有实际 Collection
    const rawProj = rawProjects.find(p => String(p.id) === pid);
    if (!rawProj) return;

    rawProj.collections.forEach(c => {
        const cid = String(c.id);

        // 确保 draft 中存在该 collection 对象
        if (!projDraft.collections[cid]) {
            projDraft.collections[cid] = {role: 'member', permissions: {}, _expanded: false};
        }
        const colDraft = projDraft.collections[cid];
        if (!colDraft.permissions) colDraft.permissions = {};
        if (!colDraft.permissions[resKey]) colDraft.permissions[resKey] = {read: false, write: false};

        const p = colDraft.permissions[resKey];

        // 应用状态
        if (targetState === 'write') {
            p.read = true;
            p.write = true;
        } else if (targetState === 'read') {
            p.read = true;
            p.write = false;
        } else { // none
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

        // 状态循环逻辑：None -> Read -> Write -> None
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
    // 批量设置该项目下的所有集合
    const proj = currentPermDraft.projects[pid];
    if (!proj) return;

    // 获取该项目的所有实际 Collection ID (从原始数据 rawProjects 中查找)
    const rawProj = rawProjects.find(p => String(p.id) === pid);
    if (!rawProj) return;

    rawProj.collections.forEach(c => {
        const cid = String(c.id);
        if (!proj.collections[cid]) {
            // 如果还没权限，先初始化
            proj.collections[cid] = {role: role, permissions: {}, _expanded: false};
        } else {
            // 如果已有权限，更新角色
            proj.collections[cid].role = role;
        }
    });

    renderPermissionDrawer();
}

// -----------------------------------------------------------------------------
// Interaction Logic
// -----------------------------------------------------------------------------

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

    // [Fix] 显式重置宽度
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
        submitBtn.style.backgroundColor = "#ef4444";
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

// [修改] 处理 Audio 类型切换
function handleAudioTypeChange(type) {
    const inputIds = {
        sr: 'input-sampling_rate_Hz',
        bit: 'input-bit_depth',
        ch: 'input-channel_num',
        dur: 'input-duration_s',
        dutyRec: 'input-duty_cycle_recording',
        dutyPer: 'input-duty_cycle_period',
        size: 'input-size_B',
        filename: 'input-filename'
    };

    const els = {};
    Object.keys(inputIds).forEach(k => els[k] = document.getElementById(inputIds[k]));

    // 辅助函数：设置只读/样式
    const setReadOnly = (el, isReadOnly) => {
        if (!el) return;
        el.readOnly = isReadOnly;
        if (isReadOnly) {
            el.style.opacity = '0.7';
            el.style.backgroundColor = 'var(--bg-capsule)';
            el.style.cursor = 'not-allowed';
        } else {
            el.style.opacity = '1';
            el.style.backgroundColor = '';
            el.style.cursor = 'text';
        }
    };

    // 辅助函数：显示/隐藏整行
    const setVisible = (el, isVisible) => {
        if (!el) return;
        const group = el.closest('.form-group');
        if (group) {
            group.style.display = isVisible ? 'flex' : 'none';
        }
    };

    if (type === 'Audio File') {
        // --- Audio File 模式 ---
        // 1. 参数不可改
        [els.sr, els.bit, els.ch, els.dur].forEach(el => setReadOnly(el, true));

        // 2. Duty Cycle: 隐藏
        [els.dutyRec, els.dutyPer].forEach(el => setVisible(el, false));

        // 3. Size: 显示 但不可改
        setVisible(els.size, true);
        setReadOnly(els.size, true);

        // 4. Filename: 显示 但不可改
        setVisible(els.filename, true);
        setReadOnly(els.filename, true);

    } else if (type === 'Metadata') {
        // --- Metadata 模式 ---
        // 1. 参数可改
        [els.sr, els.bit, els.ch, els.dur].forEach(el => setReadOnly(el, false));

        // 2. Duty Cycle: 显示 且可改
        [els.dutyRec, els.dutyPer].forEach(el => {
            setVisible(el, true);
            setReadOnly(el, false);
        });

        // 3. Size: 不显示 (隐藏)
        setVisible(els.size, false);
        // 为了防止提交脏数据，可以清空值
        if (els.size) els.size.value = "";

        // 4. Filename: 不显示 (隐藏)
        setVisible(els.filename, false);
        if (els.filename) els.filename.value = "";
    }
}

function openCrudModal(mode, id = null) {
    const schema = dbSchema[currentTable];
    const modal = document.getElementById('crud-modal-overlay');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) {
        // [修改] Create 模式 480px，Edit 模式 960px
        modalEl.style.width = (mode === 'add') ? '480px' : '960px';
    }

    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (submitBtn) {
        submitBtn.textContent = "Save";
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
        if (col.readonly && mode === 'add') return; // 新建时不显示只读字段
        if (col.onlyOnCreate && mode === 'edit') return;

        // [保留] Audio 编辑时的字段隐藏逻辑
        if (currentTable === 'audio' && mode === 'edit') {
            const type = currentRow.audio_type;
            if (type === 'Audio File') {
                if (['duty_cycle_recording', 'duty_cycle_period'].includes(col.key)) return;
            } else if (type === 'Metadata') {
                if (['filename', 'size_B'].includes(col.key)) return;
            }
        }

        let val = mode === 'edit' ? (currentRow[col.key] !== undefined ? currentRow[col.key] : "") : "";

        // [保留] 时间格式化 (YYYY-MM-DD HH:mm:ss)
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
            // 编辑 Audio File 时，技术参数变为只读（归入右侧）
            if (mode === 'edit' && currentRow.audio_type === 'Audio File') {
                const audioFileReadOnlyFields = ['sampling_rate_Hz', 'bit_depth', 'channel_num', 'duration_s', 'size_B', 'filename'];
                if (audioFileReadOnlyFields.includes(col.key)) {
                    isReadOnly = true;
                }
            }
        }

        // [保留] 不可编辑字段的样式 (灰色背景)
        let attrStr = "";
        if (isReadOnly) {
            const styleStr = "opacity:0.7; cursor:not-allowed; background:var(--bg-capsule);";
            if (effectiveType === 'select' || effectiveType === 'boolean') {
                attrStr = `disabled style="${styleStr}"`;
            } else {
                attrStr = `readonly style="${styleStr}"`;
            }
        }

        let fieldHtml = `<div class="form-group"><label class="form-label">${col.label}</label>`;

        // --- 生成输入控件 HTML ---
        if (effectiveType === 'select') {
            const onChangeAttr = col.key === 'audio_type' ? `onchange="handleAudioTypeChange(this.value)"` : '';
            fieldHtml += `<select class="form-input" id="input-${col.key}" ${attrStr} ${onChangeAttr}>`;
            fieldHtml += `<option value="">Select...</option>`;

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
            }

            options.forEach(opt => {
                const selected = String(val) === String(opt) ? 'selected' : '';
                fieldHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
            });
            fieldHtml += `</select>`;

        } else if (effectiveType === 'datetime-local') {
            let dtVal = val;
            if (val && val.includes(' ')) {
                dtVal = val.replace(' ', 'T');
            }
            fieldHtml += `<input type="datetime-local" class="form-input" id="input-${col.key}" value="${dtVal}" step="1" ${attrStr}>`;

        } else if (effectiveType === 'boolean') {
            fieldHtml += `<select class="form-input" id="input-${col.key}" ${attrStr}> 
                <option value="true" ${val === true ? 'selected' : ''}>True</option> 
                <option value="false" ${val === false ? 'selected' : ''}>False</option> 
            </select>`;
        } else if (effectiveType === 'file') {
            fieldHtml += `<div style="display:flex; gap:10px; align-items:center;"> 
                <input type="file" id="input-${col.key}" onchange="handleFileChange(this)" style="display:none;"> 
                <button class="btn-secondary" onclick="document.getElementById('input-${col.key}').click()" style="height:32px; font-size:0.8rem;">Upload File</button> 
                <span id="input-${col.key}-preview"> ${val ? `<img src="${val}" style="height:32px; border-radius:4px; border:1px solid var(--border-color); vertical-align:middle;">` : '<span style="font-size:0.8rem; color:var(--text-muted);">No file selected</span>'} </span> 
            </div>`;
        } else if (effectiveType === 'richtext') {
            const safeVal = String(val).replace(/'/g, "&apos;");
            const textPreview = String(val).replace(/<[^>]*>?/gm, '');
            fieldHtml += ` <div style="display:flex; gap:10px; align-items:center;"> 
                <input type="hidden" id="input-${col.key}" value='${safeVal}'> 
                <button class="btn-secondary" onclick="openEditorForInput('input-${col.key}')" style="height:32px; font-size:0.8rem;">Edit Content</button> 
                <span id="input-${col.key}-preview" style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;"> ${textPreview.substring(0, 30)}... </span> 
            </div> `;
        } else {
            fieldHtml += `<input type="text" class="form-input" id="input-${col.key}" value="${val}" ${attrStr}>`;
        }
        fieldHtml += `</div>`;

        // 分配到左右栏
        if (isReadOnly) {
            rightHtml += fieldHtml;
        } else {
            leftHtml += fieldHtml;
        }
    });

    // [修改] 根据模式决定布局结构
    if (mode === 'add') {
        // Create 模式 (480px)：单栏垂直排列
        // 注意：新建时通常没有只读字段(rightHtml为空)，直接渲染leftHtml即可
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${leftHtml}
                ${rightHtml} 
            </div>
        `;
    } else {
        // Edit 模式 (960px)：双栏布局
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

    modal.classList.add('active');
    lucide.createIcons();

    // 如果是 Audio 新建模式，初始化字段状态
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

    // [Updated] Get current user for auto-filling creator
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

        // [修改] 处理 datetime-local，确保秒不丢失
        if (col.type === 'datetime-local' && val) {
            val = val.replace('T', ' ');
            // 如果只有 分 没有 秒，补 :00
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
        // [修改] 格式化为标准日期时间
        if (!newRow.creation_date) newRow.creation_date = moment().format("YYYY-MM-DD HH:mm:ss");
    }
    // [Updated] Auto-fill creator if missing (e.g. on Create)
    if (isProject && !newRow.creator_name) newRow.creator_name = currentUser;
    if (isCollection && !newRow.creator_id) newRow.creator_id = currentUser;

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
            // [修改] 时间格式包含时分秒
            if (!mappedProject.date) mappedProject.date = moment().format("YYYY-MM-DD HH:mm:ss");
            rawProjects.push(mappedProject);
        }
        renderProjectList();
    } else if (isCollection) {
        const proj = rawProjects[currProjIdx];
        // [修改] 保存新的 URL 字段
        const mappedCol = {
            name: newRow.name,
            creator: newRow.creator_id,
            doi: newRow.doi,
            sphere: newRow.sphere,
            external_project_url: newRow.external_project_url,
            external_media_url: newRow.external_media_url,
            description: newRow.description,
            active: newRow.public_access,
            date: newRow.creation_date || moment().format("YYYY-MM-DD HH:mm:ss")
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

    // [修改] 获取当前表的主键，并设置为升序排序
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

    // [Fix] 显式重置宽度
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

let uploadFilesQueue = [];
let uploadTimer = null;

// [Replacement] 初始化上传环境（增加 Metadata input）
/* ==========================================================================
   New Upload Workflow Logic
   ========================================================================== */

// 1. Toolbar Dropdown Logic
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
                <i data-lucide="file-audio" size="16"></i> Recordings
            </div>
            <div class="toolbar-drop-item" onclick="triggerMetadataUpload()">
                <i data-lucide="file-spreadsheet" size="16"></i> Metadata
            </div>
            <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
            <div class="toolbar-drop-item" onclick="showMetadataInstructions()">
                <i data-lucide="info" size="16"></i> Meta-data Instructions
            </div>
        `;
        // 将 dropdown 插入到 button 的父容器中，以利用相对定位 (需确保父容器 style position relative)
        // 或者简单地，插入 body 并绝对定位
        document.body.appendChild(drop);
        lucide.createIcons();

        // 点击外部关闭
        document.addEventListener('click', (event) => {
            if (!drop.contains(event.target) && event.target !== btn && !btn.contains(event.target)) {
                drop.classList.remove('active');
            }
        });
    }

    // 定位
    const rect = btn.getBoundingClientRect();
    drop.style.top = (rect.bottom + 4) + 'px';
    drop.style.left = (rect.right - 200) + 'px'; // 右对齐，宽度200

    // Toggle
    if (drop.classList.contains('active')) {
        drop.classList.remove('active');
    } else {
        // 关闭其他可能的菜单
        closeAllMenus();
        drop.classList.add('active');
    }
}

// 2. File Triggers
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
        input.addEventListener('change', (e) => handleFilesSelect(e.target.files, 'csv'));
    }
    input.value = '';
    input.click();
}

function closeToolbarDropdown() {
    const drop = document.getElementById('toolbar-upload-dropdown');
    if (drop) drop.classList.remove('active');
}

// 3. File Handling & Modal Opening
let uploadFilesQueue = [];
let uploadTimer = null;

function handleFilesSelect(files, type) {
    if (files.length > 0) {
        // 如果是新的一次上传操作（模态框未打开），建议清空之前的队列？
        // 根据需求，通常是追加。但如果模态框关了，就重置。
        if (!document.getElementById('crud-modal-overlay').classList.contains('active')) {
            uploadFilesQueue = [];
        }

        Array.from(files).forEach(f => {
            f.uid = Math.random().toString(36).substr(2, 9);
            f.progress = 0;
            f.chunkIndex = 0;
            f.totalChunks = Math.floor(Math.random() * 5) + 3;
            f.type = type; // 'audio' or 'csv'
            uploadFilesQueue.push(f);
        });

        showUploadModalUI();
    }
}

// 4. Show Upload Modal (Updated Layout)
function showUploadModalUI() {
    const modal = document.getElementById('crud-modal-overlay');
    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '1000px';

    title.textContent = "Upload Media";

    // 生成右侧表单选项
    const siteOptions = currentSites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const licenseOptions = mockLicenses.map(l => `<option value="${l}">${l}</option>`).join('');
    const sensorOptions = ["AudioMoth v1.2", "Song Meter Micro", "Zoom F3", "Sony PCM-D10"].map(s => `<option value="${s}">${s}</option>`).join('');

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
            
            <button class="btn-secondary" style="width:100%; justify-content:center;" onclick="triggerAudioUpload()">
                <i data-lucide="plus" size="16"></i> Add More Recordings
            </button>
        </div>
        
        <div class="upload-right">
             <div class="form-group">
                <label class="form-label">Date Time</label>
                <input type="datetime-local" class="form-input" id="up-datetime" disabled style="opacity:0.6; cursor:not-allowed; background:var(--bg-capsule);">
                <div class="up-checkbox-row">
                    <input type="checkbox" class="crud-checkbox" id="chk-dt-filename" onchange="toggleDtInput(this.checked)" checked>
                    <label for="chk-dt-filename" class="up-checkbox-label">Date and time from filename</label>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Site</label>
                <select class="form-input" id="up-site">${siteOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Sensor</label>
                <select class="form-input" id="up-sensor">${sensorOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Medium</label>
                <select class="form-input" id="up-medium">
                    <option value="Air">Air</option>
                    <option value="Water">Water</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">License</label>
                <select class="form-input" id="up-license">${licenseOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Recording Gain (dB)</label>
                <input type="number" class="form-input" id="up-gain">
            </div>
            
            <div class="form-group">
                <label class="form-label">DOI</label>
                <input type="text" class="form-input" id="up-doi">
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

    // 初始化列表
    const list = document.getElementById('upload-file-list');
    if (list) list.innerHTML = ''; // 清空以重绘

    renderUploadFileList();
    modal.classList.add('active');
    lucide.createIcons();

    if (uploadTimer) clearInterval(uploadTimer);
    uploadTimer = setInterval(simulateUploadProgress, 200);
}

// 5. Render List & Stats
function renderUploadFileList() {
    const list = document.getElementById('upload-file-list');
    if (!list) return;

    // Update Stats
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

        const iconName = f.type === 'csv' ? 'file-spreadsheet' : 'file-audio';

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

// 6. Instructions Modal
function showMetadataInstructions() {
    closeToolbarDropdown();

    // 复用或创建新的 modal overlay
    let instrModal = document.getElementById('instr-modal-overlay');
    if (!instrModal) {
        instrModal = document.createElement('div');
        instrModal.id = 'instr-modal-overlay';
        instrModal.className = 'crud-modal-overlay';
        instrModal.style.zIndex = '10050'; // Higher than others

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

        // 点击遮罩关闭
        instrModal.addEventListener('click', (e) => {
            if (e.target === instrModal) instrModal.classList.remove('active');
        });
    }

    // 显示
    requestAnimationFrame(() => {
        instrModal.classList.add('active');
        lucide.createIcons();
    });
}

// Helper: toggle datetime input (keep existing logic)
function toggleDtInput(checked) {
    const el = document.getElementById('up-datetime');
    if (el) {
        el.disabled = checked;
        el.style.opacity = checked ? '0.6' : '1';
        el.style.cursor = checked ? 'not-allowed' : 'text';
        el.style.background = checked ? 'var(--bg-capsule)' : '';
    }
}

function handleFilesSelect(files, type) {
    if (files.length > 0) {
        Array.from(files).forEach(f => {
            f.uid = Math.random().toString(36).substr(2, 9);
            f.progress = 0;
            f.chunkIndex = 0;
            f.totalChunks = Math.floor(Math.random() * 5) + 3;
            f.type = type; // 标记类型
            uploadFilesQueue.push(f);
        });
        // 如果 UI 没开（虽然通常是开着的），则显示 UI
        if (!document.getElementById('crud-modal-overlay').classList.contains('active')) {
            showUploadModalUI();
        } else {
            renderUploadFileList();
        }
    }
}

// [New] 触发添加文件
function triggerAddFiles() {
    const input = document.getElementById('hidden-upload-input');
    if (input) input.click();
}

// [New] 构建并显示上传弹窗 UI
// [Replacement] 构建并显示上传弹窗 UI
function showUploadModalUI() {
    const modal = document.getElementById('crud-modal-overlay');
    const container = document.getElementById('modal-form-container');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    const modalEl = modal.querySelector('.crud-modal');
    if (modalEl) modalEl.style.width = '1000px';

    title.textContent = "Upload Audio";

    const siteOptions = currentSites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const licenseOptions = mockLicenses.map(l => `<option value="${l}">${l}</option>`).join('');
    const sensorOptions = ["AudioMoth v1.2", "Song Meter Micro", "Zoom F3", "Sony PCM-D10"].map(s => `<option value="${s}">${s}</option>`).join('');

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
                <div class="upload-dropdown" id="upload-dropdown">
                    <div class="up-drop-item" onclick="triggerRecordingsUpload()">
                        <i data-lucide="file-audio" size="14" style="margin-right:8px; vertical-align:middle;"></i>Recordings
                    </div>
                    <div class="up-drop-item" onclick="triggerMetadataUpload()">
                        <i data-lucide="file-spreadsheet" size="14" style="margin-right:8px; vertical-align:middle;"></i>Metadata
                    </div>
                    <div class="up-drop-item" onclick="showMetadataInstructions()">
                        <i data-lucide="info" size="14" style="margin-right:8px; vertical-align:middle;"></i>Meta-data Instructions
                    </div>
                </div>
                <button class="btn-secondary" style="width:100%; justify-content:center;" onclick="toggleUploadDropdown(event)">
                    <i data-lucide="plus" size="16"></i> Upload
                </button>
            </div>
        </div>
        
        <div class="upload-right">
            <div class="form-group">
                <label class="form-label">Date Time</label>
                <input type="datetime-local" class="form-input" id="up-datetime" disabled style="opacity:0.6; cursor:not-allowed; background:var(--bg-capsule);">
                <div class="up-checkbox-row">
                    <input type="checkbox" class="crud-checkbox" id="chk-dt-filename" onchange="toggleDtInput(this.checked)" checked>
                    <label for="chk-dt-filename" class="up-checkbox-label">Date and time from filename</label>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Site</label>
                <select class="form-input" id="up-site">${siteOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Sensor</label>
                <select class="form-input" id="up-sensor">${sensorOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Medium</label>
                <select class="form-input" id="up-medium">
                    <option value="Air">Air</option>
                    <option value="Water">Water</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">License</label>
                <select class="form-input" id="up-license">${licenseOptions}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Recording Gain (dB)</label>
                <input type="number" class="form-input" id="up-gain">
            </div>
            
            <div class="form-group">
                <label class="form-label">DOI</label>
                <input type="text" class="form-input" id="up-doi">
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

    // 初始化列表和统计
    const list = document.getElementById('upload-file-list');
    if (list) list.innerHTML = '';
    renderUploadFileList();

    modal.classList.add('active');
    lucide.createIcons();

    if (uploadTimer) clearInterval(uploadTimer);
    uploadTimer = setInterval(simulateUploadProgress, 200);

    // 点击其他地方关闭下拉
    document.addEventListener('click', closeDropdownOnClickOutside);
}

function renderUploadFileList() {
    const list = document.getElementById('upload-file-list');
    if (!list) return;

    // 更新统计数据
    const total = uploadFilesQueue.length;
    const completed = uploadFilesQueue.filter(f => f.progress >= 100).length;

    const totalEl = document.getElementById('up-total');
    const compEl = document.getElementById('up-completed');
    if (totalEl) totalEl.textContent = total;
    if (compEl) compEl.textContent = completed;

    uploadFilesQueue.forEach(f => {
        const percent = Math.round(f.progress);
        const isDone = percent >= 100;
        const statusText = isDone ? 'Completed' : `Chunk ${f.chunkIndex}/${f.totalChunks} uploading...`;

        // 区分图标：CSV 用 file-spreadsheet, 音频用 file-audio
        const iconName = f.type === 'csv' ? 'file-spreadsheet' : 'file-audio';

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

function triggerRecordingsUpload() {
    const drop = document.getElementById('upload-dropdown');
    if (drop) drop.classList.remove('active');
    const input = document.getElementById('hidden-upload-input');
    if (input) input.click();
}

function triggerMetadataUpload() {
    const drop = document.getElementById('upload-dropdown');
    if (drop) drop.classList.remove('active');
    const input = document.getElementById('hidden-metadata-input');
    if (input) input.click();
}

function showMetadataInstructions() {
    // 关闭下拉
    const drop = document.getElementById('upload-dropdown');
    if (drop) drop.classList.remove('active');

    // 创建一个新的 Modal overlay 用于说明，或者复用 editor-modal-overlay
    // 这里我们动态创建一个简单的 modal 结构
    let instrModal = document.getElementById('instr-modal-overlay');
    if (!instrModal) {
        instrModal = document.createElement('div');
        instrModal.id = 'instr-modal-overlay';
        instrModal.className = 'crud-modal-overlay';
        instrModal.style.zIndex = '10010'; // 比 upload modal 高

        instrModal.innerHTML = `
        <div class="crud-modal" style="width: 600px; max-width: 90vw; height: auto; transform: translate(0,0);">
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
                <a href="#" class="template-download-link" onclick="event.preventDefault(); alert('Template downloading...')">
                    <i data-lucide="download" size="16"></i> Download template CSV file
                </a>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="document.getElementById('instr-modal-overlay').classList.remove('active')">Close</button>
            </div>
        </div>
        `;
        document.body.appendChild(instrModal);

        // 绑定点击遮罩关闭
        instrModal.addEventListener('click', (e) => {
            if (e.target === instrModal) instrModal.classList.remove('active');
        });
    }

    // 显示 Modal
    // 强制重绘以触发 transition
    setTimeout(() => {
        instrModal.classList.add('active');
        lucide.createIcons();
    }, 10);
}

// [New] 模拟上传进度
function simulateUploadProgress() {
    let allDone = true;
    let changed = false;

    uploadFilesQueue.forEach(f => {
        if (f.progress < 100) {
            allDone = false;
            // 模拟进度增长
            f.progress += Math.random() * 5;
            if (f.progress > 100) f.progress = 100;

            // 模拟 chunk 索引变化
            const chunkStep = 100 / f.totalChunks;
            f.chunkIndex = Math.min(f.totalChunks, Math.ceil(f.progress / chunkStep));

            changed = true;
        }
    });

    if (changed) renderUploadFileList();
    if (allDone) clearInterval(uploadTimer);
}

// [New] 切换日期输入框状态
function toggleDtInput(checked) {
    const el = document.getElementById('up-datetime');
    if (el) {
        el.disabled = checked;
        el.style.opacity = checked ? '0.6' : '1';
        el.style.cursor = checked ? 'not-allowed' : 'text';
        el.style.background = checked ? 'var(--bg-capsule)' : '';
    }
}

init();