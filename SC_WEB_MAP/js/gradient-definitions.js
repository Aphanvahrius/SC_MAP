function createGradient(id, cx, cy, r, stops) {
    var radialGradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    radialGradient.setAttribute("id", id);
    radialGradient.setAttribute("cx", cx);
    radialGradient.setAttribute("cy", cy);
    radialGradient.setAttribute("r", r);
    radialGradient.innerHTML = stops;
    return radialGradient;
}

function gradientStyleCS() {
    return createGradient("gradientCS", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#ffff0a"/>' +
        '<stop offset="40%" stop-color="#fff200"/>' +
        '<stop offset="70%" stop-color="#f4db01"/>' +
        '<stop offset="100%" stop-color="#e0b406"/>');
}

function gradientStyleHER() {
    return createGradient("gradientHER", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#00b339"/>' +
        '<stop offset="40%" stop-color="#0aa33d"/>' +
        '<stop offset="70%" stop-color="#0f8a3c"/>' +
        '<stop offset="100%" stop-color="#126d38"/>');
}

function gradientStyleSF() {
    return createGradient("gradientSF", "70%", "50%", "50%", 
        '<stop offset="0%" stop-color="#a600ff"/>' +
        '<stop offset="40%" stop-color="#a001e4"/>' +
        '<stop offset="70%" stop-color="#8902bb"/>' +
        '<stop offset="100%" stop-color="#790396"/>');
}

function gradientStyleSI() {
    return createGradient("gradientSI", "60%", "50%", "50%", 
        '<stop offset="0%" stop-color="#ff0000"/>' +
        '<stop offset="40%" stop-color="#e30202"/>' +
        '<stop offset="70%" stop-color="#c90303"/>' +
        '<stop offset="100%" stop-color="#910303"/>');
}

function gradientStyleSR() {
    return createGradient("gradientSR", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#005eff"/>' +
        '<stop offset="40%" stop-color="#0253fb"/>' +
        '<stop offset="70%" stop-color="#0348f8"/>' +
        '<stop offset="100%" stop-color="#0627f9"/>');
}

function gradientStyleDoM() {
    return createGradient("gradientDoM", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#00b3a1"/>' +
        '<stop offset="40%" stop-color="#00998a"/>' +
        '<stop offset="70%" stop-color="#008073"/>' +
        '<stop offset="100%" stop-color="#006b5e"/>');
}

function gradientStyleDoD() {
    return createGradient("gradientDoD", "35%", "50%", "60%", 
        '<stop offset="0%" stop-color="#7e0202"/>' +
        '<stop offset="40%" stop-color="#640202"/>' +
        '<stop offset="70%" stop-color="#4a0303"/>' +
        '<stop offset="100%" stop-color="#300303"/>');
}

function gradientStyleFPA() {
    return createGradient("gradientFPA", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#7bf906"/>' +
        '<stop offset="40%" stop-color="#6cc705"/>' +
        '<stop offset="70%" stop-color="#68b003"/>' +
        '<stop offset="100%" stop-color="#547c03"/>');
}

function gradientStyleWFS() {
    return createGradient("gradientWFS", "50%", "50%", "60%", 
        '<stop offset="0%" stop-color="#737d8c"/>' +
        '<stop offset="40%" stop-color="#676e7e"/>' +
        '<stop offset="70%" stop-color="#5b6071"/>' +
        '<stop offset="100%" stop-color="#4f4f64"/>');
}

function gradientStyleGS() {
    return createGradient("gradientGS", "60%", "50%", "40%", 
        '<stop offset="0%" stop-color="#999999"/>' +
        '<stop offset="40%" stop-color="#8c8c8c"/>' +
        '<stop offset="70%" stop-color="#808080"/>' +
        '<stop offset="100%" stop-color="#737373"/>');
}
