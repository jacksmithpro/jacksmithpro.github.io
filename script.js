function loadGame() {
    var iframe = document.getElementById('gameIframe');
    iframe.src = "./jacksmith/index.html"; 
    iframe.style.display = "block"; 
    document.getElementById('frameCover').style.display = 'none'; 
}

function checkDeviceOrientation() {
    var iframe = document.getElementById('gameIframe');
    if (window.innerWidth < window.innerHeight) {
        iframe.classList.add('rotate-iframe');
    } else {
        iframe.classList.remove('rotate-iframe');
    }
}

window.addEventListener('resize', checkDeviceOrientation);
window.addEventListener('load', checkDeviceOrientation);
