function setBounds() {
    if (bounds_group.getLayers().length) {
        map.fitBounds(bounds_group.getBounds());
    }
    map.setMaxBounds([[-0.4, -0.7], [0.9, 1.5]]); // D L U R
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

