const generateRichText = (type, title, location, latinName) => {
    if (type === 'modern') {
        return `<div class="style-modern"><span class="tag-label" style="display:inline-block;padding:4px 8px;background:var(--brand);color:white;border-radius:4px;font-size:0.7rem;font-weight:700;margin-bottom:10px;text-transform:uppercase;">Live Monitoring</span>
    <h1>${title} Digital Overview</h1>
    <p style="font-size:1.1rem;color:var(--text-secondary);">Deploying next-generation <strong>edge-computing nodes</strong> in ${location} to capture high-fidelity acoustic data.</p>
    <div class="data-grid">
        <div class="data-item"><span class="data-val">98.5%</span><span class="data-key">Uptime</span></div>
        <div class="data-item"><span class="data-val">24/7</span><span class="data-key">Streaming</span></div>
        <div class="data-item"><span class="data-val">AI</span><span class="data-key">Detection</span></div>
    </div>
    <h3>System Architecture</h3>
    <ul>
        <li><strong>Edge Nodes:</strong> Solar-powered Raspberry Pi units with AudioMoth sensors.</li>
        <li><strong>Connectivity:</strong> LoRaWAN mesh network for real-time metadata transmission.</li>
        <li><strong>Cloud Sync:</strong> Daily batch uploads via Starlink satellite link.</li>
    </ul>
</div>
`;
    } else if (type === 'academic') {
        return `<div class="style-modern">
    <div style="background:var(--bg-surface-secondary);padding:20px;border-left:4px solid var(--text-main);margin-bottom:24px;"><h4 style="margin:0 0 8px 0;font-size:0.9rem;text-transform:uppercase;color:var(--text-muted);">Abstract</h4>
        <p style="margin:0;font-style:italic;">This study investigates the acoustic signature of <em>${latinName}</em> within the ${location} ecosystem, focusing on temporal variations in vocalization intensity.</p></div>
    <h2>1. Introduction</h2>
    <p>Passive Acoustic Monitoring (PAM) has emerged as a non-invasive method for assessing biodiversity.</p>
    <h2>2. Methodology</h2>
    <p>We deployed <strong>50 autonomous recording units (ARUs)</strong> across a stratified random grid.</p>
    <ul>
        <li>Sampling Rate: 48 kHz</li>
        <li>Duty Cycle: 10 mins / hour</li>
        <li>Duration: 6 months</li>
    </ul>
    <blockquote>"The results suggest a significant correlation between rainfall patterns and biological acoustic activity."</blockquote>
</div>
`;
    } else {
        return `<div class="style-modern"><p style="font-family:serif;font-size:1.2rem;line-height:1.8;color:var(--text-main);"> The jungle was alive. Not with the roar of engines, but with the <strong>symphony of life</strong>. </p>
    <p>Our team trekked for three days into the heart of ${location}. The humidity was oppressive, but the soundscape was mesmerizing.</p>
    <div style="margin:24px 0;border-radius:12px;overflow:hidden;border:1px solid var(--border-color);"><img src="https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=800&q=80" style="width:100%;height:200px;object-fit:cover;display:block;">
        <div style="padding:12px;background:var(--bg-surface-secondary);font-size:0.8rem;color:var(--text-muted);">Figure 1: Field deployment site at sunrise.</div>
    </div>
    <h3>Field Notes: Day 3</h3>
    <p>We encountered a rare species of <em>${latinName}</em> near the riverbank. The recordings captured here are pristine.</p>
    <ul>
        <li>Equipment: Sony PCM-D10</li>
        <li>Conditions: Light rain</li>
        <li>Team: K. Mbeki, J. Doe</li>
    </ul>
</div>
  `;
    }
};
const colGenerators = [(n) => `<div class="col-rt-modern"><h3><i data-lucide="activity"></i> Spectral Analysis</h3><p>${n} exhibits high-frequency harmonics typical of neotropical avian species. The spectrogram reveals distinct banding patterns.</p><ul><li>Bandwidth: 2kHz - 8kHz</li><li>Duration: 1.5s pulses</li></ul></div>`, (n) => `<div class="col-rt-modern"><h3><i data-lucide="clock"></i> Temporal Patterns</h3><p>${n} activity peaks during the dawn chorus (05:00 - 06:30) with a secondary, lower intensity peak at dusk.</p></div>`, (n) => `<div class="col-rt-modern"><h3><i data-lucide="map-pin"></i> Spatial Distribution</h3><p>Recorded primarily in the riparian zones of the transect. ${n} density decreases significantly >500m from water sources.</p></div>`];
const projectImages = ['https://ecosound-web.de/ecosound_web/sounds/projects/108.jpeg', 'https://ecosound-web.de/ecosound_web/sounds/projects/117.jpeg', 'https://ecosound-web.de/ecosound_web/sounds/projects/121.jpeg', 'https://ecosound-web.de/ecosound_web/sounds/projects/105.jpeg', 'https://ecosound-web.de/ecosound_web/sounds/projects/114.jpeg', 'https://ecosound-web.de/ecosound_web/sounds/projects/123.jpeg'];
const getImg = (idx) => projectImages[idx % projectImages.length];
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const mockNames = ["Liudilong", "A. Schmidt", "B. Cohen", "C. Kim", "D. Mwangi", "E. Rossi", "F. Yamamoto", "G. Dubois", "H. Petrov", "I. Al-Fayed", "J. Smith", "K. Gupta", "L. Wei"];
const projRoles = ["Principal Investigator", "Lead Researcher", "Field Technician", "Data Analyst", "Project Manager", "Ecologist"];
const colRoles = ["Field Recorder", "Annotator", "Reviewer", "Data Curator", "Metadata Specialist", "Logistics"];
const getContributors = (count, type, leadName = null) => {
    const list = [];
    const rolePool = type === 'project' ? projRoles : colRoles;
    for (let i = 0; i < count; i++) {
        let name, role;
        if (i === 0 && leadName) {
            name = leadName;
            role = rolePool[0];
        } else {
            name = mockNames[Math.floor(Math.random() * mockNames.length)];
            role = rolePool[Math.floor(Math.random() * (rolePool.length - 1)) + 1];
        }
        // [修改] 生成纯数字 UID
        const numUid = Math.floor(100000000 + Math.random() * 900000000);
        list.push({
            name: name, role: role, email: name.toLowerCase().replace('. ', '.').replace(' ', '.') + "@lab.edu", uid: String(numUid)
        });
    }
    return list;
};

const createCollections = (baseName, count, startImgIdx, creatorName) => {
    return Array.from({length: count}, (_, i) => {
        const collectionCreator = `Researcher ${String.fromCharCode(65 + (i % 26))}`;
        // [修改] 生成纯数字 Collection ID
        const colId = 10000 + (startImgIdx * 100) + i;
        return {
            id: String(colId),
            name: `${baseName} - Phase ${String.fromCharCode(65 + i)}`,
            active: false,
            creator: collectionCreator,
            date: `2025-0${(i % 9) + 1}-15`,
            doi: `10.ECO/col.${colId}`,
            sphere: ["Atmosphere", "Biosphere", "Hydrosphere"][i % 3],
            url: "#",
            description: colGenerators[i % 3](`${baseName}`),
            image: getImg(startImgIdx + i + 1),
            stats: {users: rInt(2, 10), projects: 1, audio: rInt(100, 5000), photos: rInt(10, 200), videos: rInt(0, 50), metadata: rInt(1000, 10000), tags: rInt(50, 300), sites: rInt(1, 5)},
            contributors: getContributors(rInt(3, 5), 'collection', collectionCreator)
        };
    });
};
const initialProjects = [{
    id: 1,
    name: "Amazon Rainforest Survey",
    creator: "Liudilong",
    date: "2025-01-10",
    doi: "10.1234/amz.01",
    externalUrl: "https://www.worldwildlife.org/places/amazon",
    description: generateRichText('modern', "Amazon Basin", "Manaus", "Panthera onca"),
    styleClass: "style-modern",
    image: getImg(0),
    collections: createCollections("Canopy Audio", 8, 0, "Dr. Silva"),
    stats: {users: 45, collections: 8, audio: "120k", photos: 850, videos: 120, metadata: "1.2M", tags: 4500, sites: 12},
    contributors: getContributors(4, 'project', "Liudilong")
}, {
    id: 2,
    name: "Marine Ecosystems Study",
    creator: "Liudilong",
    date: "2024-11-05",
    doi: "10.5678/mar.02",
    externalUrl: "https://www.barrierreef.org/",
    description: generateRichText('academic', "Coral Reefs", "Great Barrier Reef", "Megaptera novaeangliae"),
    styleClass: "style-academic",
    image: getImg(1),
    collections: createCollections("Hydrophone Data", 6, 5, "Prof. Ocean"),
    stats: {users: 32, collections: 6, audio: "80k", photos: 200, videos: 500, metadata: "800k", tags: 2100, sites: 5},
    contributors: getContributors(3, 'project', "Prof. Ocean")
}, {
    id: 3,
    name: "African Savanna Project",
    creator: "K. Mbeki",
    date: "2025-02-15",
    doi: "10.9999/sav.03",
    externalUrl: "https://www.awf.org/wildlife-conservation/african-elephant",
    description: generateRichText('blog', "Serengeti", "Tanzania", "Loxodonta africana"),
    styleClass: "style-editorial",
    image: getImg(2),
    collections: createCollections("Seismic", 5, 2, "K. Mbeki"),
    stats: {users: 28, collections: 5, audio: "45k", photos: 1200, videos: 50, metadata: "500k", tags: 1200, sites: 8},
    contributors: getContributors(5, 'project', "K. Mbeki")
}];

const REALM_COLORS = {"Terrestrial": "#65a30d", "Marine": "#0284c7", "Freshwater": "#0891b2", "Subterranean": "#71717a", "Atmospheric": "#f59e0b", "Estuarine": "#14b8a6", "Cryogenic": "#a8a29e", "Artificial": "#db2777", "Introduced": "#9333ea", "Unknown": "#f97316"};
const TAXONOMY = {
    "Terrestrial": {"Tropical Forests": ["Lowland Rainforest", "Montane Rainforest"], "Savannas": ["Shrubland", "Grassland"]},
    "Marine": {"Coastal": ["Coral Reefs", "Seagrass"], "Pelagic": ["Epipelagic", "Mesopelagic"]},
    "Freshwater": {"Riverine": ["Permanent Rivers", "Seasonal Streams"], "Palustrine": ["Peatlands", "Marshes"]},
    "Subterranean": {"Cave Systems": ["Limestone Caves", "Lava Tubes"], "Aquifers": ["Shallow", "Deep"]},
    "Atmospheric": {"Aerial": ["Lower Troposphere", "Upper Canopy"], "Urban Air": ["City Center", "Industrial"]},
    "Estuarine": {"Brackish Water": ["Mangroves", "Salt Marshes"], "Deltas": ["Active Delta", "Inactive Delta"]},
    "Cryogenic": {"Ice Sheets": ["Polar", "Glacial"], "Tundra": ["Permafrost", "Alpine"]},
    "Artificial": {"Urban": ["Parks", "Gardens"], "Agricultural": ["Farms", "Plantations"]},
    "Introduced": {"Invasive Zones": ["Islands", "Mainland"], "Rehabilitation": ["Forest", "Wetland"]},
    "Unknown": {"Unclassified": ["Region A", "Region B"], "Pending": ["Survey 1", "Survey 2"]}
};

const taxonTags = ["Aves", "Insecta", "Chiroptera", "Anura", "Anthrophony", "Geophony"];
const getRandomTags = () => {
    const count = rInt(1, 3);
    const shuffled = taxonTags.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

const getRealmColor = (r) => {
    return REALM_COLORS[r] || "#0f172a";
}
const dbSchema = {
    project: {
        label: "Projects",
        itemLabel: "Project",
        icon: "folder-kanban",
        pk: "project_id",
        columns: [{key: "project_id", label: "ID", type: "text", readonly: true}, {key: "uuid", label: "UUID", type: "text", readonly: true}, {key: "name", label: "Name", type: "text"}, {key: "creator_name", label: "Creator", type: "select", options: mockNames}, {key: "url", label: "URL", type: "text"}, {key: "doi", label: "DOI", type: "text"}, {key: "public", label: "Public", type: "boolean"}, {key: "active", label: "Active", type: "boolean"}, {
            key: "creation_date", label: "Created", type: "text", readonly: true
        }, {key: "picture_url", label: "Picture", type: "file", hiddenInTable: true}, {key: "description_short", label: "Short Description", type: "richtext", hiddenInTable: true}, {key: "description", label: "Description", type: "richtext", hiddenInTable: true}]
    }, collection: {
        label: "Collections",
        icon: "library",
        pk: "collection_id",
        columns: [{key: "collection_id", label: "ID", type: "text", readonly: true}, {key: "uuid", label: "UUID", type: "text", readonly: true}, {key: "project_names", label: "Linked Projects", type: "text", readonly: true, hiddenInForm: true, hiddenInTable: true}, {key: "name", label: "Name", type: "text"}, {key: "creator_id", label: "Creator", type: "select", options: mockNames}, {key: "url", label: "URL", type: "text"}, {key: "doi", label: "DOI", type: "text"}, {
            key: "sphere", label: "Sphere", type: "select", options: ["Atmosphere", "Biosphere", "Hydrosphere", "Lithosphere"]
        }, {key: "public_access", label: "Public Access", type: "boolean"}, {key: "public_tags", label: "Public Tags", type: "boolean"}, {key: "creation_date", label: "Created", type: "text", readonly: true}, {key: "description", label: "Description", type: "richtext", hiddenInTable: true}]
    }, "user": {
        label: "Users",
        icon: "users",
        pk: "user_id",
        columns: [{key: "user_id", label: "ID", type: "text", readonly: true}, {key: "username", label: "Username", type: "text", readonlyOnUpdate: true}, {key: "password", label: "Password", type: "password", hiddenInTable: true, onlyOnCreate: true}, {key: "confirm_password", label: "Confirm Password", type: "password", hiddenInTable: true, onlyOnCreate: true}, {key: "name", label: "Name", type: "text"}, {key: "email", label: "Email", type: "text"}, {
            key: "role_name", label: "Role", type: "select", options: ["Admin", "Manage", "User"]
        }, {key: "project_role", label: "Proj. Contrib.", type: "select", options: projRoles, readonly: true}, {key: "collection_role", label: "Coll. Contrib.", type: "select", options: colRoles, readonly: true}, {key: "orcid", label: "ORCID", type: "text"}, {key: "active", label: "Active", type: "boolean"}]
    }, role: {
        label: "Roles", icon: "shield", pk: "role_id", columns: [{key: "role_id", label: "ID", type: "number", readonly: true}, {key: "name", label: "Role Name", type: "text"}, {key: "description", label: "Description", type: "text"}]
    }, site: {
        label: "Sites", icon: "map-pin", pk: "id", columns: [{key: "id", label: "Site ID", type: "text", readonly: true}, {key: "name", label: "Site Name", type: "text"}, {key: "realm", label: "Realm", type: "text"}, {key: "biome", label: "Biome", type: "text"}, {key: "group", label: "Group", type: "text"}, {key: "topography_m", label: "Elevation (m)", type: "number"}, {key: "mediaCount", label: "Media Count", type: "number", readonly: true}]
    }, media: {
        label: "Media Files", icon: "file-audio", pk: "id", columns: [{key: "id", label: "ID", type: "text", readonly: true}, {key: "name", label: "Filename", type: "text"}, {key: "site", label: "Site Name", type: "text"}, {key: "date", label: "Date", type: "text"}, {key: "duration", label: "Duration", type: "text"}, {key: "sensor", label: "Sensor", type: "text"}, {key: "size", label: "Size", type: "text"}]
    }, sensor: {
        label: "Sensors (Ref)", icon: "cpu", pk: "sensor_id", columns: [{key: "sensor_id", label: "ID", type: "number", readonly: true}, {key: "name", label: "Model Name", type: "text"}, {key: "sensor_type", label: "Type", type: "select", options: ["audio", "photo"]}]
    }, project_contributor: {
        label: "Proj. Contributors", itemLabel: "Contributor", icon: "user-cog", pk: "uid", columns: [{key: "uid", label: "ID", type: "text", readonly: true, hiddenInTable: true}, {key: "name", label: "User Name", type: "text", readonly: true}, {key: "role", label: "Project Role", type: "text"}, {key: "email", label: "Email", type: "text", readonly: true}, {key: "added_date", label: "Date Added", type: "text", readonly: true}]
    }, collection_contributor: {
        label: "Coll. Contributors", itemLabel: "Contributor", icon: "users-2", pk: "uid", columns: [{key: "uid", label: "ID", type: "text", readonly: true, hiddenInTable: true}, {key: "name", label: "User Name", type: "text", readonly: true}, {key: "role", label: "Collection Role", type: "text"}, {key: "email", label: "Email", type: "text", readonly: true}, {key: "added_date", label: "Date Added", type: "text", readonly: true}]
    }
};

const staticMockDB = {
    sensor: [{sensor_id: 1, name: "AudioMoth v1.2", sensor_type: "audio"}, {sensor_id: 2, name: "Song Meter Micro", sensor_type: "audio"}, {sensor_id: 3, name: "GoPro Hero 10", sensor_type: "photo"}]
};
const PERMISSIONS = [{id: 1, code: 'collection:read', label: 'Collection: Read'}, {id: 2, code: 'collection:write', label: 'Collection: Write'}, {id: 3, code: 'user:read', label: 'User: Read'}, {id: 4, code: 'user:write', label: 'User: Write'}];