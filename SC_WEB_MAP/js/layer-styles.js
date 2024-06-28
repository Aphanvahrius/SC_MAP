function commonStyle(pane, color, weight, fillColor, fillOpacity = 1.0, interactive = true) {
    return {
        pane: pane,
        opacity: 1,
        color: color,
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: weight,
        fill: true,
        fillOpacity: fillOpacity,
        fillColor: fillColor,
        interactive: interactive
    };
}

function style_Regions_0_0(feature) {
    const nationStyles = {
        'Corporate Systems': 'url(#gradientCS)',
        'Holy Ertan Republic': 'url(#gradientHER)',
        'Solarian Federation': 'url(#gradientSF)',
        'Solar Imperium': 'url(#gradientSI)',
        'Duchy of Meltisar': 'url(#gradientDoM)',
        'Duchy of Drakar': 'url(#gradientDoD)',
        'Free Planets Alliance': 'url(#gradientFPA)',
        'Ghost Sector': 'url(#gradientGS)',
        'The Western Frontier Systems': 'url(#gradientWFS)',
        'Starlight Revolution': 'url(#gradientSR)'
    };
    
    return commonStyle('pane_Regions_0', 'rgba(35,35,35,1.0)', 2.0, nationStyles[feature.properties['Nation']]);
}

function style_Lanes_1_0(feature) {
    const statusStyles = {
        'In Developement': 'rgba(35,35,35,1.0)',
        'Operational': 'rgba(229,229,229,1.0)'
    };
    
    return commonStyle('pane_Lanes_1', statusStyles[feature.properties['Status']], 3.0, null, 0, true);
}

function style_Lanes_1_1(feature) {
    const statusStyles = {
        'In Developement': 'rgba(238,238,238,1.0)',
        'Operational': 'rgba(35,35,35,1.0)'
    };
    
    return commonStyle('pane_Lanes_1', statusStyles[feature.properties['Status']], 2.0, null, 0, true);
}

function style_Systems_2_0(feature) {
    const starStyles = {
        '0': {color: 'rgba(231,200,47,1.0)', fillColor: 'rgba(0,0,0,1.0)'},
        '1': {color: 'rgba(35,35,35,1.0)', fillColor: 'rgba(255,251,1,1.0)'}
    };
    
    const style = starStyles[feature.properties['Star_Presc']];
    return {
        pane: 'pane_Systems_2',
        radius: 8.0,
        opacity: 1,
        color: style.color,
        dashArray: '',
        lineCap: 'butt',
        lineJoin: 'miter',
        weight: 2.0,
        fill: true,
        fillOpacity: 1,
        fillColor: style.fillColor,
        interactive: true
    };
}

function style_Characters_3_0(feature) {
    const color = 'rgba(0,0,0,1.0)';
    return commonStyle('pane_Characters_3', color, 8.0, null, 0, true);
}

function style_Characters_3_1(feature) {
    const characterStyles = {
        'Abbey': 'rgba(1,175,255,1.0)',
        'Alex': 'rgba(10,70,130,1.0)',
        'Elis': 'rgba(210,43,48,1.0)',
        'Thea': 'rgba(251,255,0,1.0)',
        'Tia': 'rgba(238,238,238,1.0)'
    };
    
    return commonStyle('pane_Characters_3', characterStyles[feature.properties['Character']], 6.0, null, 0, true);
}

function style_Diplomacy_4_0(feature) {
    const relationStyles = {
        'Self': 'rgba(19,101,201,1.0)',
        'Friendly': 'rgba(51,160,44,1.0)',
        'Amicable': 'rgba(168,211,37,1.0)',
        'Neutral': 'rgba(157,157,157,1.0)',
        'Reserved': 'rgba(255,127,0,1.0)',
        'Hostile': 'rgba(210,43,48,1.0)',
        'At War': 'rgba(128,0,0,1.0)',
        'Nonexistent': 'rgba(0,0,0,0)'
    };
    
    return commonStyle('pane_Diplomacy_4', 'rgba(35,35,35,1.0)', 1.0, relationStyles[feature.properties['Relation']]);
}

function style_Subregions_5_0() {
    return commonStyle('pane_Subregions_5', 'rgba(20,20,20,0.6)', 1.0, 'rgba(0,0,0,0)', 1.0, false);
}

function style_Mining_6() {
    return {
        ...commonStyle('pane_Mining_6', 'rgba(35,35,35,1.0)', 2.0, 'rgba(174,9,0,1.0)', 1.0, false),
        shape: 'diamond',
        radius: 8.0,
    };
}

function style_Industrial_7() {
    return {
        ...commonStyle('pane_Industrial_7', 'rgba(35,35,35,1.0)', 2.0, 'rgba(174,9,0,1.0)', 1.0, false),
        shape: 'triangle',
        radius: 8,
    };
}

function style_Core_8() {
    return {
        ...commonStyle('pane_Core_8', 'rgba(35,35,35,1.0)', 2.0, 'rgba(218,165,32,1.0)', 1.0, false),
        shape: 'square',
        radius: 8.0,
    };
}

function style_Capital_9() {
    return {
        ...commonStyle('pane_Capital_9', 'rgba(35,35,35,1.0)', 2.0, 'rgba(218,165,32,1.0)', 1.0, false),
        shape: 'star-5',
        radius: 16,
    };
}
