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
                activeInput.value = formatted;
                suggestions.innerHTML = "";
                // Optionally, you can store lat/lon for further use
                const lat = li.getAttribute('data-lat');
                const lon = li.getAttribute('data-lon');
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

