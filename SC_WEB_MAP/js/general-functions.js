function setBounds() {
    if (bounds_group.getLayers().length) {
        map.fitBounds(bounds_group.getBounds());
    }
    map.setMaxBounds([[-0.4, -0.7], [0.9, 2]]); // D L U R
}

function revealSpoiler() {
    var spoiler = document.getElementById('spoiler');
    spoiler.style.display = 'none';
    
    var ruler = document.getElementById('Ruler');
    ruler.innerHTML = ruler.getAttribute('data-original-content');
}

function removeEmptyRowsFromPopupContent(content, feature) {
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    var rows = tempDiv.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
        var td = rows[i].querySelector('td.visible-with-data');
        var key = td ? td.id : '';
        if (td && td.classList.contains('visible-with-data') && feature.properties[key] == null) {
            rows[i].parentNode.removeChild(rows[i]);
        }
    }
    return tempDiv.innerHTML;
}

function loadGeoRaster(tifPath, options) {
    return fetch(tifPath)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            return parseGeoraster(arrayBuffer).then(georaster => {
                console.log("georaster:", georaster);
                const layerOptions = {
                    opacity: 1,
                    resolution: 256,
                    mask_srs: 'EPSG:3395',
                    ...options
                };
                return new GeoRasterLayer({
                    georaster: georaster,
                    ...layerOptions
                });
            });
        })
        .catch(error => {
            console.error('Error loading or parsing the GeoTIFF file:', error);
            return null;
        });
}
// Function to create labels
function addLabelsToLayer(layer, labelLayer, attributeName, minZoom, maxZoom) {
    layer.eachLayer(function (marker) {
        var label = L.tooltip({
            permanent: true,
            direction: "bottom",
            offset: L.point(0, 0),
            className: "custom-label no-arrow",
        }).setContent(marker.feature.properties[attributeName]);

        marker.bindTooltip(label);
        labelLayer.addLayer(marker.getTooltip());
    });

    // Track if user manually enabled/disabled labels
    let userEnabled = map.hasLayer(labelLayer);

    // Function to toggle labels based on zoom level
    function toggleLabels() {
        if (map.getZoom() >= minZoom && map.getZoom() <= maxZoom) {
            if (userEnabled && !map.hasLayer(labelLayer)) {
                map.addLayer(labelLayer);
            }
        } else {
            if (map.hasLayer(labelLayer)) {
                map.removeLayer(labelLayer);
            }
        }
    }

    // Detect manual toggle
    map.on("overlayadd", function (eventLayer) {
        if (eventLayer.layer === labelLayer) {
            userEnabled = true;
            toggleLabels();
        }
    });

    map.on("overlayremove", function (eventLayer) {
        if (eventLayer.layer === labelLayer) {
            userEnabled = false;
        }
    });

    // Listen for zoom changes
    map.on("zoomend", toggleLabels);
    toggleLabels(); // Run initially to set correct visibility
}

