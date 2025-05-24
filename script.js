// Add an event listener to the form submission
document
  .getElementById('busForm')
  .addEventListener('submit', async function (e) {
    e.preventDefault(); // Prevent form from reloading the page

    // Get references to DOM elements
    const busStopId = document.getElementById('busStopId').value.trim(); // Get Bus Stop ID input
    const errorDiv = document.getElementById('error'); // Error display element
    const table = document.getElementById('arrivalTable'); // Bus arrival table
    const tbody = table.querySelector('tbody'); // Table body for inserting rows

    // Reset error message and hide table before new data
    errorDiv.textContent = '';
    table.style.display = 'none';
    tbody.innerHTML = '';

    // Show error if input is empty
    if (!busStopId) {
      errorDiv.textContent = 'Please enter a Bus Stop ID.';
      return;
    }

    try {
      // Fetch data from the public bus arrival API
      const response = await fetch(
        `https://sg-bus-arrivals.vercel.app/?id=${busStopId}`
      );
      const data = await response.json(); // Parse response as JSON

      // If no services are returned, display an error
      if (!data.services || data.services.length === 0) {
        errorDiv.textContent = 'No arrival data found for this Bus Stop ID.';
        return;
      }

      // ✅ Sort services by bus number (alphanumeric and numeric-aware)
      const sortedServices = data.services.sort((a, b) => {
        const aNum = a.bus_no || '';
        const bNum = b.bus_no || '';
        return aNum.localeCompare(bNum, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

      // Loop through sorted services and build table rows
      sortedServices.forEach((service) => {
        const row = document.createElement('tr'); // Create a new table row

        // Create and populate Bus Number cell
        const busNoCell = document.createElement('td');
        busNoCell.textContent = service.bus_no || 'N/A';

        // Create and populate Operator cell
        const operatorCell = document.createElement('td');
        operatorCell.textContent = service.operator || 'N/A';

        // Create and populate Next Arrival cell (in minutes)
        const nextArrivalCell = document.createElement('td');
        nextArrivalCell.textContent =
          service.next_bus_mins !== undefined
            ? `${service.next_bus_mins} min`
            : 'N/A';

        // Append all cells to the row
        row.appendChild(busNoCell);
        row.appendChild(operatorCell);
        row.appendChild(nextArrivalCell);

        // Append row to the table body
        tbody.appendChild(row);
      });

      // Show the table after populating it
      table.style.display = 'table';
    } catch (err) {
      // Log and show error if fetch fails
      console.error(err);
      errorDiv.textContent = 'Error fetching bus arrival data.';
    }
  });

// Initialize or clear the map
let map = L.map('map').setView([1.3521, 103.8198], 13); // Default to Singapore center
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Flag to check if at least one bus has a valid location
let busPlotted = false;

sortedServices.forEach((service) => {
  // Create table row (as already implemented)

  // Plot bus location on the map if coordinates are present
  if (
    service.next_bus_lat !== undefined &&
    service.next_bus_lon !== undefined
  ) {
    const lat = service.next_bus_lat;
    const lon = service.next_bus_lon;
    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(
      `<strong>Bus:</strong> ${service.bus_no}<br><strong>Operator:</strong> ${service.operator}`
    );
    busPlotted = true;
  }
});

// If any bus location was plotted, fit map to the markers
if (busPlotted) {
  const allMarkers = sortedServices
    .filter((s) => s.next_bus_lat !== undefined && s.next_bus_lon !== undefined)
    .map((s) => [s.next_bus_lat, s.next_bus_lon]);

  const bounds = L.latLngBounds(allMarkers);
  map.fitBounds(bounds);
} else {
  // If no location data, show a message or keep map centered
  console.warn('No bus locations available to plot.');
}
