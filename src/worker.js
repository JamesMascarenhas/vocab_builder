const ANKI_ENDPOINT = 'http://127.0.0.1:8765';
const DECK_NAME = 'Vocabulary';
const MODEL_NAME = 'Basic';

const normalizeWord = (word) => {
  if (typeof word !== 'string') return '';
  return word.trim().toLowerCase();
};

const normalizeDefinition = (definition) => {
  if (typeof definition !== 'string') return '';
  return definition.trim();
};

const callAnki = async (action, params = {}) => {
  const response = await fetch(ANKI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect responded with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
};

const ensureDeck = async () => {
  await callAnki('createDeck', { deck: DECK_NAME });
};

const addNote = async (word, definition) => {
  const normalizedWord = normalizeWord(word);
  const normalizedDefinition = normalizeDefinition(definition);

  if (!normalizedWord || !normalizedDefinition) {
    return { status: 'error', message: 'Missing fields' };
  }

  await ensureDeck();

  try {
    await callAnki('addNote', {
      note: {
        deckName: DECK_NAME,
        modelName: MODEL_NAME,
        fields: {
          // Store normalized word so casing never creates a "new" card
          Front: normalizedWord,
          Back: normalizedDefinition
        },
        options: { allowDuplicate: false },
        tags: ['vocab-builder']
      }
    });

    return { status: 'ok' };
  } catch (error) {
    const message = error?.message || 'Failed to add note';
    if (/duplicate/i.test(message)) {
      return { status: 'duplicate' };
    }
    return { status: 'error', message };
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'addToAnki') {
    return undefined;
  }

  (async () => {
    try {
      const result = await addNote(message.word, message.definition);
      sendResponse(result);
    } catch (error) {
      sendResponse({ status: 'error', message: error?.message || 'Unexpected error' });
    }
  })();

  return true;
});
