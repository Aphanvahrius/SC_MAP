function style_Regions_0_0(feature) {
    switch(String(feature.properties['Nation'])) {
        case 'Corporate Systems':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientCS)',
                interactive: true,
            }
            break;
        
        case 'Holy Ertan Republic':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientHER)',
                interactive: true,
            }
            break;

        case 'Solarian Federation':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientSF)',
                interactive: true,
            }
            break;
        
        case 'Solar Imperium':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientSI)',
                interactive: true,
            }
            break;

        case 'Duchy of Meltisar':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientDoM)',
                interactive: true,
            }
            break;

        case 'Duchy of Drakar':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientDoD)',
                interactive: true,
            }
            break;

        case 'Free Planets Alliance':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientFPA)',
                interactive: true,
            }
            break;

        case 'Ghost Sector':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientGS)',
                interactive: true,
            }
            break;

        case 'The Western Frontier Systems':
            return {
                pane: 'pane_Regions_0',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0, 
                fill: true,
                fillOpacity: 1,
                fillColor: 'url(#gradientWFS)',
                interactive: true,
            }
            break;
    }
}

function style_Lanes_1_0(feature) {
    switch(String(feature.properties['Status'])) {
        case 'In Developement':
            return {
                pane: 'pane_Lanes_1',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'square',
                lineJoin: 'bevel',
                weight: 3.0,
                fillOpacity: 0,
                interactive: true,
            }
            break;

        case 'Operational':
            return {
                pane: 'pane_Lanes_1',
                opacity: 1,
                color: 'rgba(229,229,229,1.0)',
                dashArray: '',
                lineCap: 'square',
                lineJoin: 'bevel',
                weight: 3.0,
                fillOpacity: 0,
                interactive: true,
            }
            break;
    }
}

function style_Lanes_1_1(feature) {
    switch(String(feature.properties['Status'])) {
        case 'In Developement':
            return {
                pane: 'pane_Lanes_1',
                opacity: 1,
                color: 'rgba(238,238,238,1.0)',
                dashArray: '',
                lineCap: 'square',
                lineJoin: 'bevel',
                weight: 2.0,
                fillOpacity: 0,
                interactive: true,
            }
            break;

        case 'Operational':
            return {
                pane: 'pane_Lanes_1',
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'square',
                lineJoin: 'bevel',
                weight: 2.0,
                fillOpacity: 0,
                interactive: true,
            }
            break;
    }
}

function style_Systems_2_0(feature) {
    switch(String(feature.properties['Star_Presc'])) {
        case '0':
            return {
                pane: 'pane_Systems_2',
                radius: 8.0,
                opacity: 1,
                color: 'rgba(231,200,47,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0,
                fill: true,
                fillOpacity: 1,
                fillColor: 'rgba(0,0,0,1.0)',
                interactive: true,
            }
            break;

        case '1':
            return {
                pane: 'pane_Systems_2',
                radius: 8.0,
                opacity: 1,
                color: 'rgba(35,35,35,1.0)',
                dashArray: '',
                lineCap: 'butt',
                lineJoin: 'miter',
                weight: 2.0,
                fill: true,
                fillOpacity: 1,
                fillColor: 'rgba(255,251,1,1.0)',
                interactive: true,
            }
            break;
    }
}

function style_Sectors_3_0(feature) {
    switch(String(feature.properties['Sector'])) {
        case 'Agrarian Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(51,160,44,1.0)',
        interactive: true,
    }
            break;
        case 'Consumer Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(226,110,133,1.0)',
        interactive: true,
    }
            break;
        case 'Autarkic Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(194,79,30,1.0)',
        interactive: true,
    }
            break;
        case 'Free Planets Alliance':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(133,158,95,1.0)',
        interactive: true,
    }
            break;
        case 'Frontier Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(168,211,37,1.0)',
        interactive: true,
    }
            break;
        case 'Industrial Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(210,43,48,1.0)',
        interactive: true,
    }
            break;
        case 'Research Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(1,175,255,1.0)',
        interactive: true,
    }
            break;
        case 'Trade Sector':
            return {
        pane: 'pane_Sectors_3',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(225,190,3,1.0)',
        interactive: true,
    }
            break;
    }
}

function style_Characters_4_0(feature) {
    switch(String(feature.properties['Character'])) {
        case 'Abbey':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Alex':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Elis':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Thea':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Tia':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(0,0,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
    }
}
function style_Characters_4_1(feature) {
    switch(String(feature.properties['Character'])) {
        case 'Abbey':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(1,175,255,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 6.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Alex':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(31,120,180,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 6.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Elis':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(210,43,48,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 6.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Thea':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(251,255,0,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 6.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
        case 'Tia':
            return {
        pane: 'pane_Characters_4',
        opacity: 1,
        color: 'rgba(238,238,238,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 6.0,
        fillOpacity: 0,
        interactive: true,
    }
            break;
    }
}

function style_Diplomacy_6_0(feature) {
    switch(String(feature.properties['Relation'])) {
        case 'Self':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(19,101,201,1.0)',
        interactive: true,
    }
            break;
        case 'Friendly':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(51,160,44,1.0)',
        interactive: true,
    }
            break;
        case 'Amicable':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(168,211,37,1.0)',
        interactive: true,
    }
            break;
        case 'Neutral':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(157,157,157,1.0)',
        interactive: true,
    }
            break;
        case 'Reserved':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(255,127,0,1.0)',
        interactive: true,
    }
            break;
        case 'Hostile':
            return {
        pane: 'pane_Diplomacy_6',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 1.0, 
        fill: true,
        fillOpacity: 1,
        fillColor: 'rgba(210,43,48,1.0)',
        interactive: true,
    }
            break;
    }
}

function style_Routes_5_0() {
    return {
        pane: 'pane_Routes_5',
        opacity: 1,
        color: 'rgba(35,35,35,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 8.0,
        fillOpacity: 0,
        interactive: true,
    }
}
function style_Routes_5_1() {
    return {
        pane: 'pane_Routes_5',
        opacity: 1,
        color: 'rgba(255,158,23,1.0)',
        dashArray: '',
        lineCap: 'square',
        lineJoin: 'bevel',
        weight: 4.0,
        fillOpacity: 0,
        interactive: true,
    }
}