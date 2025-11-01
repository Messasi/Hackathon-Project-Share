//Createing the map

//Funciton to change the colour of the route based on crime data


var map = L.map('map').setView([51.505, -0.09], 17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 25 ,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);



//Autofill location 
// const myAPIKey = "a941066835354227943419eb425fff6a";
const myAPIKey = "ad3d896b9b544b6a99f430b985dd0406"
const locationInput = document.getElementById("location");
const destinationInput = document.getElementById("destination");
const suggestions = document.getElementById("suggestions");

const avoidCrimes = false;

let activeInput = null;
let startMarker = null;
let destMarker = null;
let routeLayer = null;
let safeRouteLayer = null;
let circlesLayer = L.layerGroup().addTo(map);
let safeCirclesLayer = L.layerGroup().addTo(map);

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
    const url = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&type=short&format=geojson&apiKey=${myAPIKey}`;
    // const url = "https://api.geoapify.com/v1/routing?waypoints=49.41461,8.681495|49.41943,8.686507|49.420318,8.687872&mode=drive&apiKey=ad3d896b9b544b6a99f430b985dd0406&avoid=location:49.41739930948526,8.682558231927288|location:49.41842045758105,8.682297206434981"


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
                map.removeLayer(routeLayer);

                routeLayer = null;
            }

            if (safeRouteLayer){
                map.removeLayer(safeRouteLayer)
                safeRouteLayer = null
            }

            if (circlesLayer) {
                map.removeLayer(circlesLayer)
            }
            circlesLayer = L.layerGroup().addTo(map);

            if (safeCirclesLayer) {
                map.removeLayer(safeCirclesLayer)
            }
            safeCirclesLayer = L.layerGroup().addTo(map);

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

            
            const tmp = await getAvgNumberOfCrimesForCoords(result.features[0].geometry.coordinates[0]);
            const avgNumberofCrimes = tmp[0]
            const crimeObjs = tmp[1]
            console.log("length of crimeObjs = " + crimeObjs.length)

            drawCrimeLocations(crimeObjs, circlesLayer)
            updateRouteColor(avgNumberofCrimes, routeLayer);
            
            if (avoidCrimes == true && avgNumberofCrimes != 0){
                avoidCrimeSection(crimeObjs)
            } 

           
        })
        .catch(err => {
            console.error('Error fetching route:', err);
        });
//Update the route colour based on crime data
function updateRouteColor(avgNumberofCrimes, layer) {
    if (!layer) return; {

    const colour = getRouteColor(avgNumberofCrimes);

    layer.eachLayer(l => {
        if (l.setStyle){
            l.setStyle({ color: colour });
        }
    });
}
}

function avoidCrimeSection(crimeObjs){
    let coords = new Set() //lat, lng

    for (let i = 1; i < crimeObjs.length; i++){
        coords.add(`${crimeObjs[i].location.latitude},${crimeObjs[i].location.longitude}`)
    }

    // build routing request (ask Geoapify for GeoJSON)
    const fromWaypoint = [sLat, sLon];
    const toWaypoint = [dLat, dLon];
    let url = `https://api.geoapify.com/v1/routing?waypoints=${fromWaypoint.join(',')}|${toWaypoint.join(',')}&mode=drive&format=geojson&apiKey=${myAPIKey}`;
    // const url = "https://api.geoapify.com/v1/routing?waypoints=49.41461,8.681495|49.41943,8.686507|49.420318,8.687872&mode=drive&apiKey=ad3d896b9b544b6a99f430b985dd0406&avoid=location:49.41739930948526,8.682558231927288|location:49.41739930948526,8.682558231927288"

    if (coords.size != 0){
        let urlappend = ""
        for (const coord of coords){
            urlappend += `|location:${coord}`
        }
        urlappend = urlappend.slice(1)
        console.log("urlappend: ", urlappend)
        url += "&avoid="+urlappend
        console.log("url: "+url)

    }

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('Routing request failed: ' + res.status);
            return res.json();
        })
        .then(async function(result) {
            console.log('Routing result', result);
            // remove previous route if any
            // if (routeLayer) {
            //     map.removeLayer(routeLayer);
            //     routeLayer = null;
            // }

            // if (circlesLayer) {
            //     map.removeLayer(circlesLayer)
            // }
            // circlesLayer = L.layerGroup().addTo(map);

            // Add new route layer (result should be GeoJSON FeatureCollection)
            safeRouteLayer = L.geoJSON(result, {
                style: () => ({ color: 'rgba(128, 128, 128, 0.7)', weight: 5 })
            }).addTo(map);

             // fit map to route
            try {
                map.fitBounds(safeRouteLayer.getBounds(), { padding: [20, 20] });
            } catch (err) {
                console.warn('Could not fit bounds to route:', err);
            }
            
            const tmp = await getAvgNumberOfCrimesForCoords(result.features[0].geometry.coordinates[0]);
            const avgNumberofCrimes = tmp[0]
            const crimeObjs = tmp[1]
           
            console.log("length of crimeObjs = " + crimeObjs.length)

            drawCrimeLocations(crimeObjs, safeCirclesLayer)

            updateRouteColor(avgNumberofCrimes, safeRouteLayer);

           
        })
        .catch(err => {
            console.error('Error fetching route:', err);
        });
}

function drawCrimeLocations(crimeObjs, layer){

    for (const crime of crimeObjs){
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

//Funciton to change the colour of the route based on crime data

function getRouteColor(avgNumberofCrimes) {
    if (avgNumberofCrimes === 0) {
        return 'rgba(17, 255, 0, 0.7)'; // Green
    } else if (avgNumberofCrimes < 3) {
        return 'rgba(238, 255, 0, 0.7)'; // Yellow
    } else if (avgNumberofCrimes < 6) {
        return 'rgba(255, 157, 0, 0.7)'; // Orange
    } else if (avgNumberofCrimes < 9) {
        return 'rgba(255, 100, 0, 0.7)'; // Dark Orange
    } else {
        return 'rgba(255, 55, 0, 0.7)'; // Red
    }
}
    

}





