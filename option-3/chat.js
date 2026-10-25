/* ==========================================================================
   Option 3 — scripted chat in the consultation drawer (dialog#consultation).
   No backend and no model: the steps, copy and FAQ come from chat-script.js
   (window.QRE_CHAT_SCRIPT). site.js opens and closes the drawer and fires
   `drawer:open` on the dialog; this file runs the conversation.

   The conversation lives while the page is open (closing the drawer keeps
   it); a reload or Start over begins again. At the end the lead is logged
   once with console.info; nothing is sent anywhere.

   Motion: before each assistant message a typing indicator shows for 500 to
   1200 ms (by length), then the words appear about 35 ms apart. Reduced
   motion: still dots, a fixed 300 ms pause, the whole message at once.
   ========================================================================== */

(() => {
  const SCRIPT = window.QRE_CHAT_SCRIPT;
  const root = document.querySelector('[data-chat]');
  if (!SCRIPT || !root) return;

  const drawer = root.closest('dialog');
  const log = root.querySelector('.chat__log');
  const form = root.querySelector('.chat__composer');
  const input = root.querySelector('.chat__input');
  const send = root.querySelector('.chat__send');
  const restartButton = root.querySelector('[data-chat-restart]');

  const TIMING = {
    typingMin: 500,
    typingMax: 1200,
    typingPerWord: 25,
    wordGap: 35,
    reducedPause: 300,
    maxLines: 4,
  };

  // The pattern browsers use for <input type="email"> (WHATWG), the check
  // the old consultation form relied on (email.validity.valid).
  const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const QUESTION = /\?|^\s*(what|what’s|what's|whats|how|who|are|is|do|does|can|could|when|will|would|which|why)\b/i;

  const steps = new Map(SCRIPT.steps.map((step) => [step.id, step]));
  const first = SCRIPT.steps[0];
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => reducedQuery.matches || document.documentElement.classList.contains('is-reduced');

  let state;
  // Bumped on Start over so timers from the old conversation do nothing.
  let generation = 0;

  function reset() {
    generation += 1;
    state = {
      step: first,
      answers: {},
      busy: false,
      started: false,
      logged: false,
      viaChip: false,
    };
    log.replaceChildren();
    restartButton.hidden = true;
    input.value = '';
    fitInput();
    updateSend();
  }

  /* ---- text helpers --------------------------------------------------- */

  const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normal = (text) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

  // Chip keywords match at the start of a word ("automat" finds "automation").
  function matchesPrefix(text, keyword) {
    return new RegExp(`(^|[^a-z0-9])${escapeRe(normal(keyword))}`, 'i').test(normal(text));
  }

  // FAQ keywords match whole words ("bot" is not "bots" or "chatbot").
  function matchesWord(text, keyword) {
    return new RegExp(`(^|[^a-z0-9])${escapeRe(normal(keyword))}($|[^a-z0-9])`, 'i').test(normal(text));
  }

  // "AI agent" stays, "Website" becomes "website".
  function lowerFirst(text) {
    if (/^[A-Z][A-Z]/.test(text)) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  // The name step asks for name and company; the greeting uses the name part.
  function shortName(text) {
    return text.split(/,|\s+(?:from|at|of)\s+|\s+[-–|/@]\s+/i)[0].trim();
  }

  function fill(template) {
    return template.replace(/\{([^a-z{}]*)([a-z]+)(\|lower)?\}/g, (_, prefix, key, lower) => {
      let value = state.answers[key] || '';
      if (key === 'name') value = shortName(value);
      if (!value) return '';
      if (lower) value = lowerFirst(value);
      return prefix + value;
    });
  }

  const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

  /* ---- rendering ------------------------------------------------------ */

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function wait(ms) {
    const id = generation;
    return new Promise((resolve, reject) => {
      setTimeout(() => (id === generation ? resolve() : reject(new Error('stale'))), ms);
    });
  }

  // Words of a text as spans, for the word-by-word reveal.
  function words(parent, text) {
    const units = [];
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        parent.append(document.createTextNode(part));
        return;
      }
      const span = document.createElement('span');
      span.className = 'chat__word';
      span.textContent = part;
      parent.append(span);
      units.push(span);
    });
    return units;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'chat__msg chat__msg--assistant chat__typing';
    row.setAttribute('aria-hidden', 'true');
    row.innerHTML = '<span></span><span></span><span></span>';
    log.append(row);
    scrollToEnd();
    return row;
  }

  // One assistant message: `parts` are strings or { rows } for a summary
  // list. The visible copy is aria-hidden; a visually hidden copy of the
  // whole message is what the live log announces, once.
  async function say(parts) {
    const reduced = isReduced();
    const plain = parts.map((part) => (typeof part === 'string' ? part : part.rows.map(([label, value]) => `${label}: ${value}`).join('. '))).join(' ');
    const total = wordCount(plain);
    const typing = showTyping();
    try {
      await wait(reduced ? TIMING.reducedPause
        : Math.min(TIMING.typingMax, Math.max(TIMING.typingMin, TIMING.typingMin + total * TIMING.typingPerWord)));
    } finally {
      typing.remove();
    }

    const msg = document.createElement('div');
    msg.className = 'chat__msg chat__msg--assistant';
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = plain;
    const shown = document.createElement('div');
    shown.className = 'chat__text';
    shown.setAttribute('aria-hidden', 'true');

    const units = [];
    parts.forEach((part) => {
      if (typeof part === 'string') {
        const p = document.createElement('p');
        units.push(...words(p, part));
        shown.append(p);
        return;
      }
      const list = document.createElement('dl');
      list.className = 'chat__summary';
      part.rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        list.append(row);
        units.push(row);
      });
      shown.append(list);
    });

    msg.append(spoken, shown);
    if (!reduced) units.forEach((unit) => unit.classList.add('is-pending'));
    log.append(msg);
    scrollToEnd();

    if (!reduced) {
      for (const unit of units) {
        unit.classList.remove('is-pending');
        await wait(TIMING.wordGap);
      }
    }
    return msg;
  }

  function addUser(text) {
    const msg = document.createElement('div');
    msg.className = 'chat__msg chat__msg--user';
    const p = document.createElement('p');
    p.textContent = text;
    msg.append(p);
    log.append(msg);
    scrollToEnd();
  }

  function removeChips() {
    log.querySelectorAll('.chat__chips').forEach((group) => group.remove());
  }

  function showChips(step) {
    if (!step.chips || !step.chips.length) return;
    const group = document.createElement('div');
    group.className = 'chat__chips';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Quick replies');
    step.chips.forEach((chip) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button--outline chat__chip';
      button.textContent = chip.label;
      button.addEventListener('click', () => {
        if (state.busy) return;
        state.viaChip = true;
        handle(chip.label, chip);
      });
      group.append(button);
    });
    log.append(group);
    scrollToEnd();
    // Keyboard users who answered with a chip land on the next chips.
    if (state.viaChip && drawer.open && (document.activeElement === log || !root.contains(document.activeElement))) {
      group.querySelector('button').focus({ preventScroll: true });
    }
  }

  /* ---- input ---------------------------------------------------------- */

  function fitInput() {
    input.style.height = 'auto';
    const styles = getComputedStyle(input);
    const line = parseFloat(styles.lineHeight) || 24;
    const pad = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const max = line * TIMING.maxLines + pad;
    input.style.height = `${Math.min(input.scrollHeight, max)}px`;
    input.style.overflowY = input.scrollHeight > max ? 'auto' : 'hidden';
  }

  function updateSend() {
    root.dataset.busy = state.busy ? 'true' : 'false';
    send.disabled = state.busy || !input.value.trim();
  }

  input.addEventListener('input', () => {
    fitInput();
    updateSend();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitTyped();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitTyped();
  });

  function submitTyped() {
    const text = input.value.trim();
    if (!text || state.busy) return;
    input.value = '';
    fitInput();
    state.viaChip = false;
    handle(text, null);
  }

  /* ---- conversation --------------------------------------------------- */

  // On free-text steps a chip keyword must be a whole word ("Skipper" is a
  // name, not Skip).
  function matchChip(step, text) {
    const matches = step.accepts === 'text' ? matchesWord : matchesPrefix;
    return (step.chips || []).find((chip) => chip.keywords.some((keyword) => matches(text, keyword)));
  }

  function matchFaq(step, text) {
    const asked = QUESTION.test(text);
    return SCRIPT.faq.find((faq) => {
      if ((faq.phrases || []).some((phrase) => matchesWord(text, phrase))) return true;
      if (!asked) return false;
      return faq.keywords.some((keyword) => matchesWord(text, keyword));
    });
  }

  async function ask(step) {
    state.step = step;
    if (step.summary) {
      const rows = step.summary.map(([label, key]) => [label, state.answers[key] || '']);
      await say([fill(step.say), { rows }, step.after]);
      logLead();
    } else {
      await say([fill(step.say)]);
    }
    showChips(step);
  }

  function logLead() {
    if (state.logged) return;
    state.logged = true;
    const a = state.answers;
    const lead = {
      service: a.service || '',
      details: a.details || '',
      stage: a.stage || '',
      timeline: a.timeline || '',
      budget: a.budget || '',
      name: a.name || '',
      email: a.email || '',
    };
    console.info('[QRE chat] lead', lead);
  }

  async function handle(text, chip) {
    const step = state.step;
    const id = generation;
    state.busy = true;
    updateSend();
    removeChips();
    addUser(text);
    if (!state.started) {
      state.started = true;
      restartButton.hidden = false;
    }
    // The chip is gone; keep focus in the drawer without raising a phone
    // keyboard. The next chips take it (showChips).
    if (state.viaChip) log.focus({ preventScroll: true });

    try {
      if (!chip) chip = matchChip(step, text);

      if (chip && chip.action === 'restart') {
        restart(state.viaChip);
        return;
      }

      if (!chip) {
        const faq = matchFaq(step, text);
        if (faq) {
          await say([faq.answer]);
          if (step.accepts !== 'none') await say([fill(step.say)]);
          showChips(step);
          return;
        }
      }

      if (step.accepts === 'none') {
        await say([step.after]);
        showChips(step);
        return;
      }

      let value;
      if (chip) {
        value = chip.value !== undefined ? chip.value : chip.label;
      } else if (step.accepts === 'email') {
        // "it's anna@acme.com" counts: take the one word with an @ in it.
        const candidates = text.split(/\s+/).filter((part) => part.includes('@'));
        const address = (candidates.length === 1 ? candidates[0] : text).replace(/^[<("']+|[>)"'.,;:!]+$/g, '');
        if (!EMAIL.test(address)) {
          await say([step.invalid]);
          showChips(step);
          return;
        }
        value = address;
      } else {
        value = text;
      }

      state.answers[step.saveAs] = value;
      await ask(steps.get(step.next));
    } catch (error) {
      if (error.message !== 'stale') throw error;
    } finally {
      // A Start over in the meantime owns the state now.
      if (id === generation) {
        state.busy = false;
        updateSend();
      }
    }
  }

  async function begin() {
    state.busy = true;
    updateSend();
    try {
      await ask(first);
    } catch (error) {
      if (error.message !== 'stale') throw error;
      return;
    }
    state.busy = false;
    updateSend();
  }

  function restart(viaChip = false) {
    reset();
    state.viaChip = viaChip;
    begin();
    if (!viaChip) input.focus({ preventScroll: true });
  }

  restartButton.addEventListener('click', () => restart());

  /* ---- drawer --------------------------------------------------------- */

  let begun = false;

  drawer.addEventListener('drawer:open', () => {
    if (!begun) {
      begun = true;
      begin();
    }
    const chip = log.querySelector('.chat__chips button');
    (chip || input).focus({ preventScroll: true });
    fitInput();
  });

  reset();
})();
