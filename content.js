function applyCustomCSS() {
  const domain = window.location.hostname;
  chrome.storage.sync.get(domain, function (data) {
    if (data[domain]) {
      const style = document.createElement('style');
      style.textContent = data[domain];
      document.head.appendChild(style);
    }
  });
}

applyCustomCSS();