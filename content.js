let customStyleElement;

function applyCustomCSS(css) {
  if (!customStyleElement) {
    customStyleElement = document.createElement('style');
    customStyleElement.id = 'custom-css-override';
    document.head.appendChild(customStyleElement);
  }
  customStyleElement.textContent = css;
}

function loadInitialCSS() {
  const domain = window.location.hostname;
  chrome.storage.sync.get(domain, function (data) {
    if (data[domain]) {
      applyCustomCSS(data[domain]);
    }
  });
}

chrome.runtime.onMessage.addListener(function (request) {
  if (request.action === "updateCSS") {
    applyCustomCSS(request.css);
  }
});

loadInitialCSS();