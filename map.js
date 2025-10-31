//Createing the map

var map = L.map('map').setView([51.505, -0.09], 17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 25 ,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

//Autofill location 
const myAPIKey = "a941066835354227943419eb425fff6a";
const locationInput = document.getElementById("location");
const destinationInput = document.getElementById("destination");
const suggestions = document.getElementById("suggestions");

let activeInput = null;
let startMarker = null;
let destMarker = null;
let routeLayer = null;

// helper to add or update a marker for start/destination inputs
function addOrUpdateMarker(lat, lon, inputId, label) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return null;

    // choose which marker to update
    if (inputId === 'location') {
        if (startMarker) {
            map.removeLayer(startMarker);
        }
        startMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Start').openPopup();
        map.setView([latNum, lonNum], Math.max(map.getZoom(), 13));
        return startMarker;
    } else if (inputId === 'destination') {
        if (destMarker) {
            map.removeLayer(destMarker);
        }
        destMarker = L.marker([latNum, lonNum]).addTo(map).bindPopup(label || 'Destination').openPopup();
        map.setView([latNum, lonNum], Math.max(map.getZoom(), 13));
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

//function to fetch location/destination suggestions
async function fetchLocationSuggestions(query, inputElement) {
    activeInput = inputElement;
    if (query) {
        suggestions.innerHTML = "";
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&apiKey=${myAPIKey}`;
        const response = await fetch(url);
        const data = await response.json();

        suggestions.innerHTML = data.features.map(feature => `
            <li class="suggestion-item" data-lat="${feature.properties.lat}" data-lon="${feature.properties.lon}" data-formatted="${feature.properties.formatted}">
                ${feature.properties.formatted}
            </li>
        `).join("");

        suggestions.querySelectorAll('.suggestion-item').forEach(li => {
            li.addEventListener('click', () => {
                const formatted = li.getAttribute('data-formatted');
                const lat = li.getAttribute('data-lat');
                const lon = li.getAttribute('data-lon');
                // fill the input and clear suggestions
                activeInput.value = formatted;


                // store coordinates on the input element for later use
                activeInput.dataset.lat = lat;
                activeInput.dataset.lon = lon;
                suggestions.innerHTML = "";
                // add/update marker on the map for the active input
                addOrUpdateMarker(lat, lon, activeInput.id, formatted);
                console.log("Selected:", formatted, "Latitude:", lat, "Longitude:", lon);
            });
        });
    } else {
        suggestions.innerHTML = "";
    }
}

//Add event listener with debounce for location
locationInput.addEventListener('input', debounce((e) => {
    fetchLocationSuggestions(e.target.value, locationInput);
}, 300));

//Add event listener with debounce for destination
destinationInput.addEventListener('input', debounce((e) => {
    fetchLocationSuggestions(e.target.value, destinationInput);
}, 300));


//Creat a marker
function onButtonClick(e) {
    // Read stored coordinates from inputs
    const sLat = locationInput.dataset.lat;
    const sLon = locationInput.dataset.lon;
    const dLat = destinationInput.dataset.lat;
    const dLon = destinationInput.dataset.lon;

    if (!sLat || !sLon) {
        console.error('Start coordinates not set. Please select a suggestion for Start Location.');
        return;
    }
    if (!dLat || !dLon) {
        console.error('Destination coordinates not set. Please select a suggestion for Destination.');
        return;
    }

    // update markers for both inputs
    addOrUpdateMarker(sLat, sLon, 'location', locationInput.value || 'Start');
    addOrUpdateMarker(dLat, dLon, 'destination', destinationInput.value || 'Destination');

    // build routing request (ask Geoapify for GeoJSON)
    const fromWaypoint = [sLat, sLon];
    const toWaypoint = [dLat, dLon];
    const url = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('Routing request failed: ' + res.status);
            return res.json();
        })
        .then(result => {
            console.log('Routing result', result);
            // remove previous route if any
            if (routeLayer) {
                map.removeLayer(routeLayer);
                routeLayer = null;
            }

            // Add new route layer (result should be GeoJSON FeatureCollection)
            routeLayer = L.geoJSON(result, {
                style: () => ({ color: 'rgba(255, 4, 8, 0.7)', weight: 5 })
            }).addTo(map);

            // fit map to route
            try {
                map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
            } catch (err) {
                console.warn('Could not fit bounds to route:', err);
            }
        })
        .catch(err => {
            console.error('Error fetching route:', err);
        });
}

