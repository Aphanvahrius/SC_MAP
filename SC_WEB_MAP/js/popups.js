var popup = L.popup();
function display_Coords(e) {
    popup
    .setLatLng(e.latlng)
    .setContent("Coordinates: " + e.latlng.toString())
    .openOn(map);
}

function pop_Regions_0(feature, layer) {
    var rulerText = feature.properties['Ruler'] !== null ? autolinker.link(feature.properties['Ruler'].toLocaleString()) : '';
    var spoilerTextList = ["Celestia Astraea Psi", "The Pirate King", "The Council", "God of the Drakar"]; // List of spoilered info
    
    var popupContent = '<table>\
        <tr>\
            <th scope="row">Region</th>\
            <td class="visible-with-data" id="Region">' + (feature.properties['Nation'] !== null ? autolinker.link(feature.properties['Nation'].toLocaleString()) : '') + '</td>\
        </tr>\
        <tr>\
            <th scope="row">Ruler</th>\
            <td class="visible-with-data" id="Ruler" data-original-content="' + rulerText + '">' +
                (rulerText === spoilerTextList[0] ? 
                    'Fleet Admiral Wilkes <span id="spoiler" class="spoiler" onclick="revealSpoiler()">SPOILER</span>' :
                    (spoilerTextList.includes(rulerText) ? '<span id="spoiler" class="spoiler" onclick="revealSpoiler()">SPOILER</span>' : rulerText))
            + '</td>\
        </tr>\
    </table>';
    
    layer.bindPopup(popupContent, {maxHeight: 400});
}

function pop_Lanes_1(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <th scope="row">Region</th>\
                <td class="visible-with-data" id="Nation">' + (feature.properties['Nation'] !== null ? autolinker.link(feature.properties['Nation'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Lane Status</th>\
                <td class="visible-with-data" id="Status">' + (feature.properties['Status'] !== null ? autolinker.link(feature.properties['Status'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Lane Type</th>\
                <td class="visible-with-data" id="Type">' + (feature.properties['Type'] !== null ? autolinker.link(feature.properties['Type'].toLocaleString()) : '') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 400});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}

function pop_Systems_2(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <td id="Regular_Sys" colspan="2">' + ((feature.properties['Capital'] !== null || feature.properties['Core_Sys'] !== null || feature.properties['Idustr_Sys'] !== null || feature.properties['Mining_Sys'] !== null || feature.properties['Fuel_Depot'] !== null || feature.properties['Mt_Base'] !== null) ? '' : 'Regular System') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Capital" colspan="2">' + (feature.properties['Capital'] !== null ? 'Capital System' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Core_Sys" colspan="2">' + (feature.properties['Core_Sys'] !== null ? 'Core System' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Idustr_Sys" colspan="2">' + (feature.properties['Idustr_Sys'] !== null ? 'Industrial System' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Mining_Sys" colspan="2">' + (feature.properties['Mining_Sys'] !== null ? 'Mining System' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Fuel_Depot" colspan="2">' + (feature.properties['Fuel_Depot'] !== null ? 'Fuel Depot' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Mt_Base" colspan="2">' + (feature.properties['Mt_Base'] !== null ? 'Maintenance Base' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Homeworld" colspan="2">' + (feature.properties['Homeworld'] !== null ? 'Homeworld of Humanity' : '') + '</td>\
            </tr>\
            <tr>\
                <td class="visible-with-data" id="Unsurv_bod" colspan="2">' + (feature.properties['Unsurv_bod'] !== null ? 'Unsurveyed Bodies' : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">System Name</th>\
                <td class="visible-with-data" id="System_Nam">' + (feature.properties['System_Nam'] !== null ? autolinker.link(feature.properties['System_Nam'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Star Presence</th>\
                <td class="visible-with-data" id="Star_Presc">' + (feature.properties['Star_Presc'] !== '0' ? 'Yes' : 'No') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Region</th>\
                <td class="visible-with-data" id="Nation">' + (feature.properties['Nation'] !== null ? autolinker.link(feature.properties['Nation'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Inhabitable Worlds: </th>\
                <td class="visible-with-data" id="Inhabitabl">' + (feature.properties['Inhabitabl'] !== null ? autolinker.link(feature.properties['Inhabitabl'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Orbital/Colony on</br>Unhabitable Bodies: </th>\
                <td class="visible-with-data" id="Orbtl_Clny">' + (feature.properties['Orbtl_Clny'] !== null ? autolinker.link(feature.properties['Orbtl_Clny'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Minable Bodies/</br>Rogue Planets: </th>\
                <td class="visible-with-data" id="Notbl_Minb">' + (feature.properties['Notbl_Minb'] !== null ? autolinker.link(feature.properties['Notbl_Minb'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Unexplored Jump</br>Lanes: </th>\
                <td class="visible-with-data" id="Unexplored">' + (feature.properties['Unexplored'] !== null ? autolinker.link(feature.properties['Unexplored'].toLocaleString()) : '') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 600});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}

function pop_Sectors_3(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <td class="visible-with-data" id="Sector" colspan="2">' + (feature.properties['Sector'] !== null ? autolinker.link(feature.properties['Sector'].toLocaleString()) : '') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 400});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}

function pop_Characters_4(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <th scope="row">Character</th>\
                <td class="visible-with-data" id="Character">' + (feature.properties['Character'] !== null ? autolinker.link(feature.properties['Character'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Book</th>\
                <td class="visible-with-data" id="Book">' + (feature.properties['Book'] !== null ? autolinker.link(feature.properties['Book'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Travel Date</th>\
                <td class="visible-with-data" id="Date">' + (feature.properties['Date'] !== null ? autolinker.link(feature.properties['Date'].toLocaleString()) : '') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 400});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}

function pop_Diplomacy_6(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <th scope="row">Nation</th>\
                <td class="visible-with-data" id="Neighbor">' + (feature.properties['Neighbor'] !== null ? autolinker.link(feature.properties['Neighbor'].toLocaleString()) : '') + '</td>\
            </tr>\
            <tr>\
                <th scope="row">Relation Status</th>\
                <td class="visible-with-data" id="Relation">' + (feature.properties['Relation'] !== 'Self' ? autolinker.link(feature.properties['Relation'].toLocaleString()) : 'Our Country') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 400});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}

function pop_Routes_5(feature, layer) {
    var popupContent = '<table>\
            <tr>\
                <th scope="row">Main products</th>\
                <td class="visible-with-data" id="Products">' + (feature.properties['Products'] !== null ? autolinker.link(feature.properties['Products'].toLocaleString()) : '') + '</td>\
            </tr>\
        </table>';
    layer.bindPopup(popupContent, {maxHeight: 400});
    var popup = layer.getPopup();
    var content = popup.getContent();
    var updatedContent = removeEmptyRowsFromPopupContent(content, feature);
    popup.setContent(updatedContent);
}