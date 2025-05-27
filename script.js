// Initialize Leaflet map
const map = L.map('map').setView([1.3521, 103.8198], 12); // Singapore center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Bus stop + bus markers
let stopMarker = null;
let busMarkers = [];

// Fetch and show map location of selected bus stop
async function updateBusStopMap(busStopId) {
  try {
    const response = await fetch(
      `https://sg-bus-arrivals.vercel.app/stop?id=${busStopId}`
    );
    const data = await response.json();

    console.log('Bus Stop Location Data:', data); // Debug

    // Clear previous stop marker
    if (stopMarker) {
      map.removeLayer(stopMarker);
    }

    const markerPoints = [];

    // Add bus stop marker if location is available
    if (data.lat && data.lon) {
      stopMarker = L.marker([data.lat, data.lon], {
        icon: L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        }),
      }).addTo(map);
      stopMarker
        .bindPopup(`<strong>Bus Stop ID:</strong> ${busStopId}`)
        .openPopup();
      markerPoints.push([data.lat, data.lon]);
    }

    return markerPoints; // For combining with bus positions
  } catch (err) {
    console.error('Error fetching bus stop location:', err);
    return [];
  }
}

// Handle form submission
document
  .getElementById('busForm')
  .addEventListener('submit', async function (e) {
    e.preventDefault();

    const busStopId = document.getElementById('busStopId').value.trim();
    const errorDiv = document.getElementById('error');
    const table = document.getElementById('arrivalTable');
    const tbody = table.querySelector('tbody');

    // Reset UI
    errorDiv.textContent = '';
    table.style.display = 'none';
    tbody.innerHTML = '';

    // Remove previous bus markers
    busMarkers.forEach((m) => map.removeLayer(m));
    busMarkers = [];

    // Validate input
    if (!busStopId) {
      errorDiv.textContent = 'Please enter a Bus Stop ID.';
      return;
    }

    if (!/^\d+$/.test(busStopId)) {
      errorDiv.textContent = 'Please enter a valid numeric Bus Stop ID.';
      return;
    }

    try {
      // Fetch bus stop location and store its coordinates
      const stopCoords = await updateBusStopMap(busStopId);

      // Fetch bus arrival data
      const response = await fetch(
        `https://sg-bus-arrivals.vercel.app/?id=${busStopId}`
      );
      const data = await response.json();

      if (!data.services || data.services.length === 0) {
        errorDiv.textContent = 'No arrival data found for this Bus Stop ID.';
        return;
      }

      // Sort bus services by next arrival
      const sortedServices = data.services.sort((a, b) => {
        const timeA =
          a.next_bus_mins !== undefined ? a.next_bus_mins : Infinity;
        const timeB =
          b.next_bus_mins !== undefined ? b.next_bus_mins : Infinity;
        return timeA - timeB;
      });

      const markerPoints = [...stopCoords];

      sortedServices.forEach((service) => {
        const row = document.createElement('tr');

        const busNoCell = document.createElement('td');
        busNoCell.textContent = service.bus_no || 'N/A';

        const operatorCell = document.createElement('td');
        operatorCell.textContent = service.operator || 'N/A';

        const nextArrivalCell = document.createElement('td');
        nextArrivalCell.textContent =
          service.next_bus_mins <= 0
            ? 'Arrived'
            : service.next_bus_mins !== undefined
            ? `${service.next_bus_mins} min`
            : 'N/A';

        row.appendChild(busNoCell);
        row.appendChild(operatorCell);
        row.appendChild(nextArrivalCell);
        tbody.appendChild(row);

        // Add live bus marker if available
        if (service.next_bus_lat && service.next_bus_lon) {
          const marker = L.marker([
            service.next_bus_lat,
            service.next_bus_lon,
          ]).addTo(map);
          marker.bindPopup(
            `<strong>Bus:</strong> ${service.bus_no}<br><strong>Operator:</strong> ${service.operator}`
          );
          busMarkers.push(marker);
          markerPoints.push([service.next_bus_lat, service.next_bus_lon]);
        }
      });

      // Show table
      table.style.display = 'table';

      // Adjust map to show all points
      if (markerPoints.length > 0) {
        map.fitBounds(markerPoints);
      } else {
        console.warn('No markers to fit bounds.');
      }
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Error fetching bus arrival data.';
    }
  });

// Handle popular bus stop button clicks
document.querySelectorAll('.popular-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.getAttribute('data-id');
    document.getElementById('busStopId').value = id;
    document.getElementById('busForm').dispatchEvent(new Event('submit'));
  });
});

/*
// Current issues i am facing is to link map to bus stop
// Initialize Leaflet map
const map = L.map('map').setView([1.3521, 103.8198], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Form submit event
document
  .getElementById('busForm')
  .addEventListener('submit', async function (e) {
    e.preventDefault();

    const busStopId = document.getElementById('busStopId').value.trim();
    const errorDiv = document.getElementById('error');
    const table = document.getElementById('arrivalTable');
    const tbody = table.querySelector('tbody');

    errorDiv.textContent = '';
    table.style.display = 'none';
    tbody.innerHTML = '';

    if (!busStopId) {
      errorDiv.textContent = 'Please enter a Bus Stop ID.';
      return;
    }

    try {
      const response = await fetch(
        `https://sg-bus-arrivals.vercel.app/?id=${busStopId}`
      );
      const data = await response.json();

      if (!data.services || data.services.length === 0) {
        errorDiv.textContent = 'No arrival data found for this Bus Stop ID.';
        return;
      }

      const sortedServices = data.services.sort((a, b) =>
        (a.bus_no || '').localeCompare(b.bus_no || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

      // Clear previous markers
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      let busPlotted = false;
      const allMarkers = [];

      sortedServices.forEach((service) => {
        const row = document.createElement('tr');

        const busNoCell = document.createElement('td');
        busNoCell.textContent = service.bus_no || 'N/A';

        const operatorCell = document.createElement('td');
        operatorCell.textContent = service.operator || 'N/A';

        const nextArrivalCell = document.createElement('td');
        const mins = Number(service.next_bus_mins);
        if (isNaN(mins)) {
          nextArrivalCell.textContent = 'N/A';
        } else if (mins <= 0) {
          nextArrivalCell.textContent = 'Arrived';
        } else {
          nextArrivalCell.textContent = `${mins} min`;
        }

        row.appendChild(busNoCell);
        row.appendChild(operatorCell);
        row.appendChild(nextArrivalCell);
        tbody.appendChild(row);

        if (service.next_bus_lat && service.next_bus_lon) {
          const lat = service.next_bus_lat;
          const lon = service.next_bus_lon;
          const marker = L.marker([lat, lon]).addTo(map);
          marker.bindPopup(
            `<strong>Bus:</strong> ${service.bus_no}<br><strong>Operator:</strong> ${service.operator}`
          );
          allMarkers.push([lat, lon]);
          busPlotted = true;
        }
      });

      table.style.display = 'table';

      if (busPlotted && allMarkers.length > 0) {
        map.fitBounds(L.latLngBounds(allMarkers));
      } else {
        map.setView([1.3521, 103.8198], 13);
      }
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Error fetching bus arrival data.';
    }
  });
*/
