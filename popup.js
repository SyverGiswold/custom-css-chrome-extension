document.addEventListener('DOMContentLoaded', function () {
  const domain = document.getElementById('domain');
  const cssEditor = document.getElementById('cssEditor');
  const lineNumbers = document.getElementById('lineNumbers');
  const saveButton = document.getElementById('save');
  const domainList = document.getElementById('domainList');

  let lastLineCount = 0;
  let measureDiv;
  let updateTimeout;

  function updateLineNumbers() {
    const lines = cssEditor.value.split('\n');
    const lineCount = lines.length;

    if (lineCount > lastLineCount) {
      for (let i = lastLineCount + 1; i <= lineCount; i++) {
        const lineNumberDiv = document.createElement('div');
        lineNumberDiv.className = 'line-number';
        lineNumberDiv.textContent = i;
        lineNumbers.appendChild(lineNumberDiv);
      }
    } else if (lineCount < lastLineCount) {
      while (lineNumbers.childElementCount > lineCount) {
        lineNumbers.removeChild(lineNumbers.lastChild);
      }
    }

    lastLineCount = lineCount;
  }

  function createMeasureDiv() {
    measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.whiteSpace = 'pre-wrap';
    measureDiv.style.wordWrap = 'break-word';
    measureDiv.style.width = `${cssEditor.clientWidth}px`;
    measureDiv.style.font = window.getComputedStyle(cssEditor).font;
    document.body.appendChild(measureDiv);
  }

  function adjustCurrentLineHeight() {
    const cursorPosition = cssEditor.selectionStart;
    const textBeforeCursor = cssEditor.value.substring(0, cursorPosition);
    const currentLineNumber = textBeforeCursor.split('\n').length - 1;
    const currentLine = cssEditor.value.split('\n')[currentLineNumber];

    measureDiv.textContent = currentLine || '\n';
    const height = measureDiv.offsetHeight;

    const lineNumberDiv = lineNumbers.children[currentLineNumber];
    if (lineNumberDiv && lineNumberDiv.offsetHeight !== height) {
      lineNumberDiv.style.height = `${height}px`;
    }
  }

  // New function to save to localStorage
  function saveToLocalStorage(domain, css) {
    localStorage.setItem(`tempCSS_${domain}`, css);
  }

  // New function to load from localStorage
  function loadFromLocalStorage(domain) {
    return localStorage.getItem(`tempCSS_${domain}`);
  }

  // New function to clear localStorage for a domain
  function clearLocalStorage(domain) {
    localStorage.removeItem(`tempCSS_${domain}`);
  }

  function handleInput() {
    updateLineNumbers();
    adjustCurrentLineHeight();
    
    // Clear the previous timeout
    clearTimeout(updateTimeout);
    
    // Save to localStorage immediately
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const url = new URL(tabs[0].url);
      const currentDomain = url.hostname;
      saveToLocalStorage(currentDomain, cssEditor.value);
    });
    
    // Set a new timeout to update the CSS
    updateTimeout = setTimeout(updateCSS, 1000);
  }

  function updateCSS() {
    const css = cssEditor.value;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "updateCSS", css: css });
    });
  }

  cssEditor.addEventListener('input', handleInput);

  cssEditor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
      handleInput();
    } else if (e.key === 'Enter') {
      const start = this.selectionStart;
      const end = this.selectionEnd;
      const beforeCursor = this.value.substring(0, start);
      const afterCursor = this.value.substring(end);
      
      if (beforeCursor.endsWith('{') && afterCursor.startsWith('}')) {
        e.preventDefault();
        const indent = '  ';
        this.value = beforeCursor + '\n' + indent + '\n' + afterCursor;
        this.selectionStart = this.selectionEnd = start + indent.length + 1;
        handleInput();
      }
    } else if ('{(['.includes(e.key)) {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      const pairs = {'{': '}', '[': ']', '(': ')'};
      this.value = this.value.substring(0, start) + e.key + pairs[e.key] + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 1;
      handleInput();
    }
  });

  cssEditor.addEventListener('paste', function () {
    setTimeout(handleInput, 0);
  });

  cssEditor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = cssEditor.scrollTop;
  });

  // Modified to check localStorage first when loading
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const url = new URL(tabs[0].url);
    const currentDomain = url.hostname;
    domain.textContent = currentDomain;

    // Check localStorage first
    const tempCSS = loadFromLocalStorage(currentDomain);
    
    if (tempCSS !== null) {
      // Use temporary CSS if available
      cssEditor.value = tempCSS;
      updateLineNumbers();
      createMeasureDiv();
      Array.from(lineNumbers.children).forEach(adjustLineHeight);
      updateCSS();
    } else {
      // Fall back to chrome.storage.sync
      chrome.storage.sync.get(currentDomain, function (data) {
        cssEditor.value = data[currentDomain] || '';
        updateLineNumbers();
        createMeasureDiv();
        Array.from(lineNumbers.children).forEach(adjustLineHeight);
        updateCSS();
      });
    }
  });

  // Modified save button to clear localStorage after saving
  saveButton.addEventListener('click', function () {
    const css = cssEditor.value;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const url = new URL(tabs[0].url);
      const currentDomain = url.hostname;

      let saveData = {};
      saveData[currentDomain] = css;

      chrome.storage.sync.set(saveData, function () {
        console.log('CSS saved for', currentDomain);
        // Clear localStorage after successful save
        clearLocalStorage(currentDomain);
        updateDomainList();
      });
    });
  });

  function updateDomainList() {
    chrome.storage.sync.get(null, function (items) {
      domainList.innerHTML = '';
      for (let key in items) {
        let li = document.createElement('li');
        li.innerHTML = `
          <span>${key}</span>
          <button class="delete-btn" data-domain="${key}">Delete</button>
        `;
        domainList.appendChild(li);
      }
      addDeleteListeners();
    });
  }

  function addDeleteListeners() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', function () {
        const domainToDelete = this.getAttribute('data-domain');
        chrome.storage.sync.remove(domainToDelete, function () {
          console.log('CSS deleted for', domainToDelete);
          // Clear localStorage when deleting
          clearLocalStorage(domainToDelete);
          updateDomainList();
        });
      });
    });
  }

  function adjustLineHeight(lineNumberDiv, index) {
    const line = cssEditor.value.split('\n')[index];
    measureDiv.textContent = line || '\n';
    const height = measureDiv.offsetHeight;
    lineNumberDiv.style.height = `${height}px`;
  }

  updateDomainList();
  
  window.addEventListener('resize', () => {
    if (measureDiv) {
      measureDiv.style.width = `${cssEditor.clientWidth}px`;
    }
    Array.from(lineNumbers.children).forEach(adjustLineHeight);
  });
});