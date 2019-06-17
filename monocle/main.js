import './style.css';
import { Map, View, Overlay } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

// Coordinates for 900 Glenda Dr, Bedford, TX
const centerCoords = fromLonLat([-97.1427, 32.8452]);

// Service and product values
const service = "nexrad";
const product = "n0q";

// Create overlay for timestamp
const timestampOverlay = document.createElement('div');
timestampOverlay.style.position = 'absolute';
timestampOverlay.style.bottom = '10px';
timestampOverlay.style.right = '10px';
timestampOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
timestampOverlay.style.color = 'white';
timestampOverlay.style.padding = '5px';
timestampOverlay.style.borderRadius = '5px';
timestampOverlay.style.fontSize = '12px';
timestampOverlay.innerHTML = 'Loading...';
document.body.appendChild(timestampOverlay);

// Create overlay for legend
const legendOverlay = document.createElement('img');
legendOverlay.src = `https://mesonet.agron.iastate.edu/GIS/legends/${product.toUpperCase()}.gif`;
legendOverlay.style.position = 'absolute';
legendOverlay.style.bottom = '10px';
legendOverlay.style.left = '10px';
legendOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
legendOverlay.style.padding = '5px';
legendOverlay.style.borderRadius = '5px';
document.body.appendChild(legendOverlay);

const baseLayer = new TileLayer({
  source: new OSM(),
  title: 'OpenStreetMap',
  visible: true
});

const map = new Map({
  target: 'map',
  layers: [baseLayer],
  view: new View({
    projection: 'EPSG:3857',
    center: centerCoords,
    zoom: 9 // Adjust zoom level as needed to cover 200 miles
  })
});

// Function to format date to 12-hour time with AM/PM in CST
function formatDateToCST(date) {
  const options = {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Generate URLs for radar images for the last hour with 5-minute intervals
function generateRadarUrls(service, product) {
  const baseUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${service}-${product}-{time}/{z}/{x}/{y}.png`;
  const urls = [];
  const now = new Date();
  now.setSeconds(0, 0); // Round down to the nearest minute
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5); // Round down to the nearest 5 minutes
  for (let i = 5; i <= 55; i += 5) {
    const timestamp = new Date(now.getTime() - i * 60000);
    const minutesAgo = String(i).padStart(2, '0');
    const formattedTimestamp = formatDateToCST(timestamp);
    const url = {
      url: baseUrl.replace('{time}', `m${minutesAgo}m`),
      timestamp: formattedTimestamp
    };
    urls.push(url);
  }
  let result = urls.reverse(); // Reverse the order to animate in the correct chronological order

  const latestTimestamp = new Date();
  latestTimestamp.setSeconds(0, 0); // Round down to the nearest minute
  latestTimestamp.setMinutes(Math.floor(latestTimestamp.getMinutes() / 5) * 5); // Round down to the nearest 5 minutes
  result.push({
    url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${service}-${product}/{z}/{x}/{y}.png`,
    timestamp: formatDateToCST(latestTimestamp)
  }); // Add the latest image at the end

  return result;
}

// Function to animate radar layers
function animateRadar(radarLayers, loadedUrls) {
  let currentIndex = 0;
  const totalLayers = radarLayers.length;
  let animationTimeout;

  function showNextLayer() {
    radarLayers.forEach((layer, index) => {
      layer.setVisible(index === currentIndex);
    });

    timestampOverlay.innerHTML = loadedUrls[currentIndex].timestamp;

    const interval = currentIndex === totalLayers - 1 ? 3000 : 1000; // 3 seconds for the latest image, 1 second for others
    currentIndex = (currentIndex + 1) % totalLayers;
    animationTimeout = setTimeout(showNextLayer, interval);
  }

  showNextLayer();

  return () => clearTimeout(animationTimeout);
}

let stopAnimation = null;

function reloadRadarImages() {
  const loadedUrls = generateRadarUrls(service, product);

  const radarLayers = loadedUrls.map(urlObj => new TileLayer({
    source: new XYZ({ url: urlObj.url }),
    opacity: 0.5, // Set the opacity to 50%
    visible: false // Initially set to invisible
  }));

  map.getLayers().clear();
  map.addLayer(baseLayer);
  radarLayers.forEach(layer => map.addLayer(layer));

  if (stopAnimation) {
    stopAnimation();
  }
  stopAnimation = animateRadar(radarLayers, loadedUrls);
  console.log(`radar loaded ${formatDateToCST(new Date())}`);
  console.log(loadedUrls);
}

reloadRadarImages();
// Check every minute if we need to reload the radar images
setInterval(() => {
  const now = new Date();
  if (now.getMinutes() % 2 === 0) {
    reloadRadarImages();
  }
}, 60000); // Check every 10 seconds
