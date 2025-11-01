//Createing the map

//Funciton to change the colour of the route based on crime data


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
async function onButtonClick(e) {
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
    let avgNumberofCrimes = null;

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('Routing request failed: ' + res.status);
            return res.json();
        })
        .then(async function(result) {
            console.log('Routing result', result);
            // remove previous route if any
            if (routeLayer) {
                map.removeLayer(routeLayer);
                routeLayer = null;
            }

            // Add new route layer (result should be GeoJSON FeatureCollection)
            routeLayer = L.geoJSON(result, {
                style: () => ({ color: 'rgba(128, 128, 128, 0.7)', weight: 5 })
            }).addTo(map);

             // fit map to route
            try {
                map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
            } catch (err) {
                console.warn('Could not fit bounds to route:', err);
            }
            
           const avgNumberofCrimes = await getAvgNumberOfCrimesForCoords(result.features[0].geometry.coordinates[0]);
        

            updateRouteColor(avgNumberofCrimes);

           
        })
        .catch(err => {
            console.error('Error fetching route:', err);
        });
//Update the route colour based on crime data
function updateRouteColor(avgNumberofCrimes) {
    if (!routeLayer) return; {

    const colour = getRouteColor(avgNumberofCrimes);

    routeLayer.eachLayer(layer => {
        if (layer.setStyle){
            layer.setStyle({ color: colour });
        }
    });
}
}


//Funciton to change the colour of the route based on crime data

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
    

}





