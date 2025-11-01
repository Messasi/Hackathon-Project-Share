// Initialize the map
const mapDiv = document.getElementById('map');
if (!mapDiv) {
    throw new Error("Map container with id 'map' not found. Please add <div id='map'></div> to your HTML.");
}
const map = L.map('map').setView([51.505, -0.09], 17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 25,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// API key and DOM elements
const myAPIKey = "ad3d896b9b544b6a99f430b985dd0406";
const inputSelectors = ['#startPoint', '#destPoint', '#location', '#destination'];
const inputs = Array.from(document.querySelectorAll(inputSelectors.join(',')));

// Global variables for markers and route layers
let startMarker = null;
let destMarker = null;
let carRouteLayer = null;
let walkRouteLayer = null;
let circlesLayer = null;
let safeCirclesLayer = null;

// --- UI and Autocomplete Functions (from Merged Version) ---

function roleFromId(id) {
    if (!id) return null;
    const lower = id.toLowerCase();
    if (lower.includes('start') || lower === 'location') return 'start';
    if (lower.includes('dest') || lower === 'destination') return 'destination';
    return null;
}

function addOrUpdateMarker(lat, lon, inputEl, label) {
    if (!lat || !lon) return null;
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return null;

    const role = roleFromId(inputEl.id);

    if (role === 'start') {
        if (startMarker) {
            startMarker.setLatLng([latNum, lonNum]).setPopupContent(label || 'Start');
        } else {
            startMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Start').openPopup();
        }
        map.setView([latNum, lonNum], Math.max(map.getZoom(), 13));
        return startMarker;
    } else if (role === 'destination') {
        if (destMarker) {
            destMarker.setLatLng([latNum, lonNum]).setPopupContent(label || 'Destination');
        } else {
            destMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Destination').openPopup();
        }
        return destMarker;
    }
    return null;
}

function debounce(func, delay) {
    let timeout;
    return function(...args) { 
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    }
}

function getOrCreateSuggestionsEl(inputEl) {
    const sugId = `${inputEl.id}-suggestions`;
    let el = document.getElementById(sugId);
    if (el) return el;

    el = document.createElement('ul');
    el.id = sugId;
    el.className = 'suggestions-list';
    el._suppressHide = false;
    el.addEventListener('mousedown', () => { el._suppressHide = true; });
    el.addEventListener('mouseup', () => { setTimeout(() => { el._suppressHide = false; }, 0); });
    const parent = inputEl.parentElement || inputEl.parentNode;
    if (parent && window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    if (inputEl.nextSibling) parent.insertBefore(el, inputEl.nextSibling);
    else parent.appendChild(el);

    return el;
}

function clearAllSuggestions() {
    inputs.forEach(i => {
        if (!i.id) return;
        const el = document.getElementById(`${i.id}-suggestions`);
        if (el) el.innerHTML = '';
    });
}

function escapeHtml(str) {
    return String(str).replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[s]));
}

async function fetchLocationSuggestions(query, inputEl) {
    const suggestionsEl = getOrCreateSuggestionsEl(inputEl);
    if (!query || !query.trim()) {
        suggestionsEl.innerHTML = '';
        suggestionsEl.classList.remove('visible');
        try { delete inputEl.dataset.lat; delete inputEl.dataset.lon; } catch (e) {}
        return;
    }

    suggestionsEl.innerHTML = '<li class="suggestion-item">Loading…</li>';
    try {
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=6&apiKey=${myAPIKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response not ok');
        const data = await res.json();
        const items = (data.features || []).map(f => {
            const formatted = f.properties.formatted || '';
            const lat = f.properties.lat;
            const lon = f.properties.lon;
            return `<li class="suggestion-item" data-lat="${lat}" data-lon="${lon}" data-formatted="${escapeHtml(formatted)}">${escapeHtml(formatted)}</li>`;
        });
        suggestionsEl.innerHTML = items.join('') || '<li class="suggestion-item">No results</li>';
        suggestionsEl.classList.toggle('visible', items.length > 0);

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(li => {
            li.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                const formatted = li.getAttribute('data-formatted');
                const lat = li.getAttribute('data-lat');
                const lon = li.getAttribute('data-lon');
                inputEl.value = formatted;
                inputEl.dataset.lat = lat;
                inputEl.dataset.lon = lon;
                suggestionsEl.innerHTML = '';
                suggestionsEl.classList.remove('visible');
                addOrUpdateMarker(lat, lon, inputEl, formatted);
            });
        });
    } catch (err) {
        console.error('Suggestion fetch error:', err);
        suggestionsEl.innerHTML = '<li class="suggestion-item">Error fetching results</li>';
    }
}

const debouncedFetch = debounce(fetchLocationSuggestions, 300);
inputs.forEach(inputEl => {
    if (!inputEl.id) return;
    const suggestionsEl = getOrCreateSuggestionsEl(inputEl);
    inputEl.addEventListener('input', (e) => debouncedFetch(e.target.value, inputEl));
    inputEl.addEventListener('focus', (e) => {
        if (e.target.value || suggestionsEl.innerHTML.trim()) {
            suggestionsEl.classList.add('visible');
        }
    });
    inputEl.addEventListener('blur', (e) => {
        setTimeout(() => {
            if (suggestionsEl && !suggestionsEl._suppressHide) {
                suggestionsEl.classList.remove('visible');
            }
            suggestionsEl._suppressHide = false;
        }, 150);
    });
});

document.addEventListener('click', (e) => {
    const clickedInside = inputs.some(i => {
        if (!i.id) return false;
        const sug = document.getElementById(`${i.id}-suggestions`);
        return i.contains(e.target) || (sug && sug.contains(e.target));
    });
    if (!clickedInside) clearAllSuggestions();
});

function findInputPair() {
    const startEl = document.getElementById('startPoint') || document.getElementById('location');
    const destEl = document.getElementById('destPoint') || document.getElementById('destination');
    return { startEl, destEl };
}

// --- Core Logic Functions (from Original Version) ---

function getRouteColor(avgNumberofCrimes) {
    if (avgNumberofCrimes < 1) return 'rgba(17, 255, 0, 0.7)'; // Green
    if (avgNumberofCrimes < 2.5) return 'rgba(255, 255, 36, 0.94)'; // Yellow
    if (avgNumberofCrimes < 5) return 'rgba(255, 172, 39, 1)'; // Orange
    if (avgNumberofCrimes < 7) return 'rgba(222, 96, 33, 0.8)'; // Dark Orange
    return 'rgba(255, 0, 0, 1)'; // Red
// ...existing code...


// Helper function to fetch and display both routes
async function fetchAndDisplayBothRoutes(fromWaypoint, toWaypoint) {
    const carUrl = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;
    const walkUrl = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=walk&format=geojson&apiKey=${myAPIKey}`;
    try {
        const [carResponse, walkResponse] = await Promise.all([fetch(carUrl), fetch(walkUrl)]);
        if (!carResponse.ok || !walkResponse.ok) {
            throw new Error('Routing request failed');
        }
        const carResult = await carResponse.json();
        const walkResult = await walkResponse.json();
        if (carRouteLayer) map.removeLayer(carRouteLayer);
        if (walkRouteLayer) map.removeLayer(walkRouteLayer);
        carRouteLayer = L.geoJSON(carResult, {
            style: () => ({ color: 'gray', weight: 7 })
        }).addTo(map);
        walkRouteLayer = L.geoJSON(walkResult, {
            style: () => ({ color: 'gray', weight: 7 })
        }).addTo(map);
        if (carRouteLayer) carRouteLayer.bindPopup('Car Route').openPopup();
        if (walkRouteLayer) walkRouteLayer.bindPopup('Walking Route').openPopup();
        const group = new L.FeatureGroup([carRouteLayer, walkRouteLayer]);
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
        const carCrimes = await getAvgNumberOfCrimesForCoords(carResult.features[0].geometry.coordinates[0]);
        const walkCrimes = await getAvgNumberOfCrimesForCoords(walkResult.features[0].geometry.coordinates[0]);
        updateRouteColor(carRouteLayer, carCrimes);
        updateRouteColor(walkRouteLayer, walkCrimes);
    } catch (err) {
        console.error('Error fetching routes:', err);
    }
}
}

// Update route color for a specific route layer
function updateRouteColor(layer, avgNumberofCrimes) {
    if (!layer) return;
    const colour = getRouteColor(avgNumberofCrimes);
    if (typeof layer.setStyle === 'function') {
        layer.setStyle({ color: colour });
    }
}

function drawCrimeLocations(crimeObjs, layer) {
    if (!layer) return;
    const allCrimes = crimeObjs.flat();
    for (const crime of allCrimes) {
        if (crime && crime.location && crime.location.latitude && crime.location.longitude) {
            L.circleMarker([crime.location.latitude, crime.location.longitude], {
                stroke: false,
                fillColor: '#f03',
                fillOpacity: 0.2,
                radius: 7
            }).addTo(layer).bindPopup(`<b>${crime.category}</b><br>${crime.month}`);
        }
    }
}

function avoidCrimeSection(crimeObjs, sLat, sLon, dLat, dLon) {
    const uniqueCoords = new Set();
    crimeObjs.forEach(crime => {
        if (crime && crime.location) {
            uniqueCoords.add(`${crime.location.latitude},${crime.location.longitude}`);
        }
    });

    const fromWaypoint = [sLat, sLon];
    const toWaypoint = [dLat, dLon];
    let url = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;

    if (uniqueCoords.size > 0) {
        const avoidLocations = Array.from(uniqueCoords).map(coord => `location:${coord}`).join('|');
        url += `&avoid=${avoidLocations}`;
    }

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('Safer routing request failed: ' + res.status);
            return res.json();
        })
        .then(async function(result) {
            safeRouteLayer = L.geoJSON(result, {
                style: () => ({ color: 'rgba(128, 128, 128, 0.7)', weight: 5 })
            }).addTo(map);

            const tmp = await getAvgNumberOfCrimesForCoords(result.features[0].geometry.coordinates[0]);
            const avgNumberofCrimes = tmp[0];
            const newCrimeObjs = tmp[1];
            
            drawCrimeLocations(newCrimeObjs, safeCirclesLayer);
            updateRouteColor(avgNumberofCrimes, safeRouteLayer);
        })
        .catch(err => console.error('Error fetching safer route:', err));
}

// --- Main Button Click Handlers ---

async function onButtonClick(e) {
    if (e) e.preventDefault();

    const { startEl, destEl } = findInputPair();
    if (!startEl || !destEl) {
        alert('Start or destination input not found.');
        return;
    }

    const sLat = startEl.dataset.lat;
    const sLon = startEl.dataset.lon;
    const dLat = destEl.dataset.lat;
    const dLon = destEl.dataset.lon;

    // Get the selected mode from radio buttons
    const isDriving = document.getElementById('modeDriving').checked;
    const isWalking = document.getElementById('modeWalking').checked;

    if (!sLat || !sLon) { alert('Please choose a start location from suggestions.'); return; }
    if (!dLat || !dLon) { alert('Please choose a destination from suggestions.'); return; }

    // --- UI Toggling ---
    document.getElementById('legend')?.removeAttribute('hidden');
    document.getElementById('startEnd')?.setAttribute('hidden', true);
    document.getElementById('backBtn')?.removeAttribute('hidden');

    // --- Layer Cleanup ---
    if (carRouteLayer) map.removeLayer(carRouteLayer);
    if (walkRouteLayer) map.removeLayer(walkRouteLayer);
    if (circlesLayer) map.removeLayer(circlesLayer);
    if (safeCirclesLayer) map.removeLayer(safeCirclesLayer);

    circlesLayer = L.layerGroup().addTo(map);
    safeCirclesLayer = L.layerGroup().addTo(map);

    // --- Main Logic ---
    addOrUpdateMarker(sLat, sLon, startEl, startEl.value || 'Start');
    addOrUpdateMarker(dLat, dLon, destEl, destEl.value || 'Destination');

    const fromWaypoint = [sLat, sLon];
    const toWaypoint = [dLat, dLon];

    try {
        // Fetch and display car route if driving is selected
        if (isDriving) {
            const carUrl = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;
            const carResponse = await fetch(carUrl);
            if (!carResponse.ok) throw new Error('Car routing request failed');
            const carResult = await carResponse.json();
            carRouteLayer = L.geoJSON(carResult, {
                style: { color: 'rgba(128, 128, 128, 0.7)', weight: 5 }
            }).addTo(map);
            const carCrimes = await getAvgNumberOfCrimesForCoords(carResult.features[0].geometry.coordinates[0]);
            updateRouteColor(carRouteLayer, carCrimes[0]);
            carRouteLayer.bindPopup('Car Route').openPopup();
        }
        // Fetch and display walking route if walking is selected
        if (isWalking) {
            const walkUrl = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=walk&format=geojson&apiKey=${myAPIKey}`;
            const walkResponse = await fetch(walkUrl);
            if (!walkResponse.ok) throw new Error('Walking routing request failed');
            const walkResult = await walkResponse.json();
            walkRouteLayer = L.geoJSON(walkResult, {
                style: { color: 'rgba(128, 128, 128, 0.7)', weight: 5 }
            }).addTo(map);
            const walkCrimes = await getAvgNumberOfCrimesForCoords(walkResult.features[0].geometry.coordinates[0]);
            updateRouteColor(walkRouteLayer, walkCrimes[0]);
            walkRouteLayer.bindPopup('Walking Route').openPopup();
        }
        // Fit map to show all visible routes
        const visibleLayers = [];
        if (carRouteLayer && isDriving) visibleLayers.push(carRouteLayer);
        if (walkRouteLayer && isWalking) visibleLayers.push(walkRouteLayer);
        if (visibleLayers.length > 0) {
            const group = new L.FeatureGroup(visibleLayers);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    } catch (err) {
        console.error('Routing error:', err);
        alert('Error fetching route(s).');
    }
}
window.onButtonClick = onButtonClick;

function onBackClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    document.getElementById('legend')?.setAttribute('hidden', true);
    document.getElementById('startEnd')?.removeAttribute('hidden');
    document.getElementById('backBtn')?.setAttribute('hidden', true);
}
window.onBackClick = onBackClick;

// Add event listeners for the radio buttons
document.addEventListener('DOMContentLoaded', () => {
    const modeDriving = document.getElementById('modeDriving');
    const modeWalking = document.getElementById('modeWalking');

    if (modeDriving && modeWalking) {
        modeDriving.addEventListener('change', () => {
            if (carRouteLayer) map.addLayer(carRouteLayer);
            if (walkRouteLayer) map.removeLayer(walkRouteLayer);
        });

        modeWalking.addEventListener('change', () => {
            if (walkRouteLayer) map.addLayer(walkRouteLayer);
            if (carRouteLayer) map.removeLayer(carRouteLayer);
        });
    }
});