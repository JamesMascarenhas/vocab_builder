(() => {
  if (!chrome?.runtime?.id) {
    return;
  }

  const WORD_PATTERN = /^[A-Za-z]+(?:['-][A-Za-z]+)*$/;
  let tooltip = null;
  let currentToken = 0;
  let currentWord = '';

  const closeTooltip = () => {
    if (tooltip?.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
    tooltip = null;
    currentWord = '';
  };

  const isValidWord = (text) => {
    if (!text) return false;
    if (text.trim() !== text) return false;
    if (/\s/.test(text)) return false;
    return WORD_PATTERN.test(text);
  };

  const extractDefinition = (payload) => {
    if (!Array.isArray(payload) || !payload.length) return null;
    const primary = payload[0];
    const meaning = primary?.meanings?.[0];
    const definition = meaning?.definitions?.[0]?.definition;
    return typeof definition === 'string' && definition.trim() ? definition.trim() : null;
  };

  const sendAddToAnki = (word, definition) =>
    new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'addToAnki', word, definition }, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(runtimeError);
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });

  const updateAddButtonState = (button, state) => {
    if (!button) return;
    button.classList.remove('is-added', 'is-duplicate', 'is-failed');
    if (state === 'added') {
      button.textContent = 'Added';
      button.classList.add('is-added');
    } else if (state === 'duplicate') {
      button.textContent = 'Duplicate';
      button.classList.add('is-duplicate');
    } else if (state === 'failed') {
      button.textContent = 'Failed';
      button.classList.add('is-failed');
    }
  };

  const attachTooltipEvents = (container, token) => {
    if (!container) return;

    const closeButton = container.querySelector('.vocab-tooltip__close');
    closeButton?.addEventListener('click', () => {
      if (token === currentToken) {
        closeTooltip();
      }
    });

    const addButton = container.querySelector('.vocab-tooltip__add');
    if (!addButton) return;

    addButton.addEventListener('click', async () => {
      if (!tooltip || token !== currentToken) return;
      addButton.disabled = true;
      addButton.textContent = 'Adding...';

      try {
        const response = await sendAddToAnki(container.dataset.word, container.dataset.definition);
        if (!tooltip || token !== currentToken) return;

        if (response?.status === 'ok') {
          updateAddButtonState(addButton, 'added');
          addButton.disabled = true;
        } else if (response?.status === 'duplicate') {
          updateAddButtonState(addButton, 'duplicate');
          addButton.disabled = true;
        } else {
          updateAddButtonState(addButton, 'failed');
          addButton.disabled = false;
        }
      } catch (error) {
        if (tooltip && token === currentToken) {
          updateAddButtonState(addButton, 'failed');
          addButton.disabled = false;
        }
      }
    });
  };

  const renderTooltip = (word, definition, token) => {
    if (token !== currentToken) return;

    closeTooltip();
    const container = document.createElement('div');
    container.className = 'vocab-tooltip';
    container.dataset.token = String(token);
    container.dataset.word = word;
    container.dataset.definition = definition;

    const header = document.createElement('div');
    header.className = 'vocab-tooltip__header';

    const wordEl = document.createElement('strong');
    wordEl.className = 'vocab-tooltip__word';
    wordEl.textContent = word;

    const closeEl = document.createElement('button');
    closeEl.type = 'button';
    closeEl.className = 'vocab-tooltip__close';
    closeEl.textContent = '×';

    header.append(wordEl, closeEl);

    const definitionEl = document.createElement('div');
    definitionEl.className = 'vocab-tooltip__definition';
    definitionEl.textContent = definition;

    const actions = document.createElement('div');
    actions.className = 'vocab-tooltip__actions';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'vocab-tooltip__add';
    addBtn.textContent = 'Add to Anki';

    actions.appendChild(addBtn);

    container.append(header, definitionEl, actions);

    (document.body || document.documentElement)?.appendChild(container);
    tooltip = container;

    attachTooltipEvents(container, token);
  };

  const fetchDefinition = async (word, token) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!response.ok) {
        throw new Error('Definition lookup failed');
      }
      const data = await response.json();
      const definition = extractDefinition(data);
      if (!definition) {
        throw new Error('No definition found');
      }
      if (token === currentToken) {
        renderTooltip(word, definition, token);
      }
    } catch (error) {
      if (token === currentToken) {
        closeTooltip();
      }
    }
  };

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      closeTooltip();
      return;
    }

    const text = selection.toString();
    if (!isValidWord(text)) {
      closeTooltip();
      return;
    }

    if (text === currentWord && tooltip) {
      return;
    }

    currentWord = text;
    const token = ++currentToken;
    closeTooltip();
    fetchDefinition(text, token);
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape' && tooltip) {
      closeTooltip();
    }
  };

  const handleScroll = () => {
    if (tooltip) {
      closeTooltip();
    }
  };

  const handleInput = () => {
    if (tooltip) {
      closeTooltip();
    }
  };

  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('input', handleInput, true);
  window.addEventListener('scroll', handleScroll, true);
})();
