//Createing the map

//Funciton to change the colour of the route based on crime data

//Createing the map

//Function to change the colour of the route based on crime data

var map = L.map('map').setView([51.505, -0.09], 17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 25 ,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);



//Autofill location 
const myAPIKey = "a941066835354227943419eb425fff6a";
// support both sets of ids: overlay (startPoint/destPoint) and header (location/destination)
const inputSelectors = ['#startPoint', '#destPoint', '#location', '#destination'];
const inputs = Array.from(document.querySelectorAll(inputSelectors.join(',')));

let startMarker = null;
let destMarker = null;
let routeLayer = null;

// helper to add or update a marker for start/destination inputs
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
            startMarker.setLatLng([latNum, lonNum]);
            startMarker.setPopupContent(label || 'Start');
        } else {
            startMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Start').openPopup();
        }
        map.setView([latNum, lonNum], Math.max(map.getZoom(), 13));
        return startMarker;
    } else if (role === 'destination') {
        if (destMarker) {
            destMarker.setLatLng([latNum, lonNum]);
            destMarker.setPopupContent(label || 'Destination');
        } else {
            destMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Destination').openPopup();
        }
        return destMarker;
    }
    return null;
}

//de bounce functinon
function debounce(func, delay) {
    let timeout;
    return function(...args) { 
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    }
}

// create/return suggestions <ul> for an input element
function getOrCreateSuggestionsEl(inputEl) {
    const sugId = `${inputEl.id}-suggestions`;
    let el = document.getElementById(sugId);
    if (el) return el;

    el = document.createElement('ul');
    el.id = sugId;
    el.className = 'suggestions-list';
    const parent = inputEl.parentElement || inputEl.parentNode;
    if (parent && window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    if (inputEl.nextSibling) parent.insertBefore(el, inputEl.nextSibling);
    else parent.appendChild(el);

    return el;
}

// close all suggestion lists
function clearAllSuggestions() {
    inputs.forEach(i => {
        if (!i.id) return;
        const el = document.getElementById(`${i.id}-suggestions`);
        if (el) el.innerHTML = '';
    });
}

// small helper to escape displayed text
function escapeHtml(str) {
    return String(str).replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[s]));
}

// fetch suggestions and render into per-input suggestions UL
async function fetchLocationSuggestions(query, inputEl) {
    const suggestionsEl = getOrCreateSuggestionsEl(inputEl);
    if (!query || !query.trim()) {
        suggestionsEl.innerHTML = '';
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

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(li => {
            li.addEventListener('click', () => {
                const formatted = li.getAttribute('data-formatted');
                const lat = li.getAttribute('data-lat');
                const lon = li.getAttribute('data-lon');
                inputEl.value = formatted;
                inputEl.dataset.lat = lat;
                inputEl.dataset.lon = lon;
                suggestionsEl.innerHTML = '';
                addOrUpdateMarker(lat, lon, inputEl, formatted);
            });
        });
    } catch (err) {
        console.error('Suggestion fetch error:', err);
        suggestionsEl.innerHTML = '<li class="suggestion-item">Error fetching results</li>';
    }
}

// attach listeners to all found inputs
const debouncedFetch = debounce(fetchLocationSuggestions, 300);
inputs.forEach(inputEl => {
    if (!inputEl.id) return;
    inputEl.addEventListener('input', (e) => {
        debouncedFetch(e.target.value, inputEl);
    });
    inputEl.addEventListener('focus', (e) => {
        if (e.target.value) debouncedFetch(e.target.value, inputEl);
    });
});

// close when clicking outside any suggestions / inputs
document.addEventListener('click', (e) => {
    const clickedInside = inputs.some(i => {
        if (!i.id) return false;
        const sug = document.getElementById(`${i.id}-suggestions`);
        return i.contains(e.target) || (sug && sug.contains(e.target));
    });
    if (!clickedInside) clearAllSuggestions();
});

// helper to find preferred input value/dataset (prefer startPoint/destPoint over location/destination)
function findInputPair() {
    const startEl = document.getElementById('startPoint') || document.getElementById('location');
    const destEl = document.getElementById('destPoint') || document.getElementById('destination');
    return { startEl, destEl };
}

async function onButtonClick(e) {
    if (e && e.preventDefault) e.preventDefault();

    const { startEl, destEl } = findInputPair();
    if (!startEl || !destEl) {
        alert('Start or destination input not found.');
        return;
    }

    const sLat = startEl.dataset.lat;
    const sLon = startEl.dataset.lon;
    const dLat = destEl.dataset.lat;
    const dLon = destEl.dataset.lon;

    if (!sLat || !sLon) { alert('Please choose a start location from suggestions.'); return; }
    if (!dLat || !dLon) { alert('Please choose a destination from suggestions.'); return; }

    addOrUpdateMarker(sLat, sLon, startEl, startEl.value || 'Start');
    addOrUpdateMarker(dLat, dLon, destEl, destEl.value || 'Destination');

    const fromWaypoint = [sLat, sLon];
    const toWaypoint = [dLat, dLon];
    const url = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Routing request failed');
        const geojson = await res.json();
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(geojson, {
            style: { color: '#3388ff', weight: 6, opacity: 0.8 }
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [50,50] });
    } catch (err) {
        console.error('Routing error:', err);
        alert('Error fetching route.');
    }
}

// expose onButtonClick globally if index.html expects that name
window.onButtonClick = onButtonClick;

// helper: get color based on avg crime (kept from previous file if used elsewhere)
function getRouteColor(avgNumberofCrimes) {
    if (avgNumberofCrimes < 2) {
        return 'rgba(17, 255, 0, 0.7)'; // Green
    } else if (avgNumberofCrimes < 3) {
        return 'rgba(255, 255, 36, 0.94)'; // Yellow
    } else if (avgNumberofCrimes < 5) {
        return 'rgba(255, 172, 39, 1)'; // Orange
    } else if (avgNumberofCrimes < 7) {
        return 'rgba(222, 96, 33, 0.8)'; // Dark Orange
    } else {
        return 'rgba(255, 0, 0, 1)'; // Red
    }
}





