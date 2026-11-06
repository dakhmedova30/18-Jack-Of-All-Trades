import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type ReadingState = 'idle' | 'speaking' | 'paused';

interface Passage {
  text: string;
  element: Element;
}

const MAX_UTTERANCE_LENGTH = 1000;
/** Silence between passages at normal speed, so one item is clearly over before the next starts. */
const PASSAGE_PAUSE_MS = 600;
const HIGHLIGHT_CLASS = 'speech-reader-highlight';
/** The CSS variable pages use to keep their end clear of the fixed bar (see styles.css). */
const SPACE_VARIABLE = '--speech-reader-space';
/** Gap kept between the end of a page and the top of the bar. */
const SPACE_GAP_PX = 16;

/**
 * Splits the page into passages at block boundaries (headings, paragraphs, list items,
 * table rows, cards), so each one is read, outlined and followed by a pause on its own.
 */
function getPagePassages(): Passage[] {
  const content = document.querySelector<HTMLElement>(
    'main, [role="main"], .auth-card, .auth-loading',
  );
  if (!content) return [];

  const passages: Passage[] = [];
  let text = '';
  let owner: Element = content;

  function add(value: string, block: Element) {
    if (!text.trim()) owner = block;
    text += value;
  }

  function flush() {
    const passage = text.replace(/\s+/g, ' ').trim();
    if (passage) passages.push({ text: passage, element: owner });
    text = '';
  }

  function visit(node: Node, block: Element) {
    if (node.nodeType === Node.TEXT_NODE) {
      add(node.textContent ?? '', block);
      return;
    }
    if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true') return;

    // Charts are SVGs labelled as images: read the label, not every axis tick.
    if (node.getAttribute('role') === 'img') {
      flush();
      add(node.getAttribute('aria-label') ?? '', node);
      flush();
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node instanceof HTMLBRElement) {
      add(' ', block);
      return;
    }
    if (node instanceof HTMLSelectElement) {
      add(` ${node.selectedOptions[0]?.text ?? ''} `, block);
      return;
    }

    const { display } = getComputedStyle(node);
    if (display === 'none') return;

    if (display === 'table-cell') {
      if (text.trim()) add(', ', block);
      node.childNodes.forEach((child) => visit(child, block));
      return;
    }
    if (display.startsWith('inline') || display === 'contents') {
      // Keeps neighbouring buttons and chips apart ("Edit Delete", not "EditDelete").
      const gap = display === 'inline' || display === 'contents' ? '' : ' ';
      add(gap, block);
      node.childNodes.forEach((child) => visit(child, block));
      add(gap, block);
      return;
    }

    flush();
    node.childNodes.forEach((child) => visit(child, node));
    flush();
  }

  visit(content, content);
  return passages;
}

/** A collapsed answer can't be seen, so the closed card it belongs to is outlined instead. */
function visibleTarget(element: Element): Element {
  const collapsed = element.closest('details:not([open])');
  return collapsed && !element.closest('summary') ? collapsed : element;
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_UTTERANCE_LENGTH) {
    const window = remaining.slice(0, MAX_UTTERANCE_LENGTH);
    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; '),
    );
    const splitAt = sentenceEnd > 0 ? sentenceEnd + 1 : window.lastIndexOf(' ');
    const boundary = splitAt > 0 ? splitAt : MAX_UTTERANCE_LENGTH;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function SpeechReader() {
  const { pathname, search } = useLocation();
  return <SpeechReaderControls key={`${pathname}${search}`} />;
}

function SpeechReaderControls() {
  const [readingState, setReadingState] = useState<ReadingState>('idle');
  const [rate, setRate] = useState(1);
  const [status, setStatus] = useState('');
  const generation = useRef(0);
  const bar = useRef<HTMLElement>(null);
  const highlighted = useRef<Element | null>(null);
  const paused = useRef(false);
  // Set when Pause lands in the silence between passages: Resume calls it to carry on.
  const resumeReading = useRef<(() => void) | null>(null);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const highlight = useCallback((element: Element | null) => {
    highlighted.current?.classList.remove(HIGHLIGHT_CLASS);
    highlighted.current = element;
    if (!element) return;
    element.classList.add(HIGHLIGHT_CLASS);
    element.scrollIntoView({ block: 'nearest' });
  }, []);

  const stop = useCallback(
    (message = 'Reading stopped.') => {
      generation.current += 1;
      paused.current = false;
      resumeReading.current = null;
      if (canSpeak) window.speechSynthesis.cancel();
      highlight(null);
      setReadingState('idle');
      setStatus(message);
    },
    [canSpeak, highlight],
  );

  // Publish how much of the window the bar covers, so every page can leave that much room at its
  // end. Measured rather than fixed: the bar wraps onto more lines on phones, and grows when the
  // Pause button appears.
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => {
      const covered = window.innerHeight - element.getBoundingClientRect().top;
      root.style.setProperty(SPACE_VARIABLE, `${Math.ceil(covered) + SPACE_GAP_PX}px`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      root.style.removeProperty(SPACE_VARIABLE);
    };
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      highlight(null);
    },
    [highlight],
  );

  function readPage() {
    if (!canSpeak) {
      setStatus('Text-to-speech is not supported in this browser.');
      return;
    }

    const passages = getPagePassages();
    if (passages.length === 0) {
      setStatus('There is no page content to read.');
      return;
    }

    const queue = passages.flatMap(({ text, element }) =>
      splitIntoChunks(text).map((chunk, index, chunks) => ({
        text: chunk,
        element,
        endsPassage: index === chunks.length - 1,
      })),
    );
    const pause = Math.round(PASSAGE_PAUSE_MS / rate);
    const currentGeneration = ++generation.current;
    paused.current = false;
    resumeReading.current = null;
    window.speechSynthesis.cancel();
    setReadingState('speaking');
    setStatus('Reading page content.');

    function fail() {
      generation.current += 1;
      highlight(null);
      setReadingState('idle');
      setStatus('Text-to-speech could not read this page.');
    }

    function continueAfterPause(index: number) {
      if (currentGeneration !== generation.current) return;
      if (paused.current) resumeReading.current = () => speakNext(index);
      else speakNext(index);
    }

    function speakNext(index: number) {
      if (currentGeneration !== generation.current) return;
      if (index >= queue.length) {
        highlight(null);
        setReadingState('idle');
        setStatus('Finished reading page content.');
        return;
      }

      const { text, element, endsPassage } = queue[index];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = document.documentElement.lang || navigator.language || 'en-US';
      utterance.onend = () => {
        if (!endsPassage || index + 1 === queue.length) speakNext(index + 1);
        else window.setTimeout(() => continueAfterPause(index + 1), pause);
      };
      utterance.onerror = (event) => {
        if (currentGeneration !== generation.current || event.error === 'canceled') return;
        fail();
      };

      highlight(visibleTarget(element));
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        fail();
      }
    }

    speakNext(0);
  }

  function togglePause() {
    if (!canSpeak) return;
    if (readingState === 'speaking') {
      paused.current = true;
      window.speechSynthesis.pause();
      setReadingState('paused');
      setStatus('Reading paused.');
    } else if (readingState === 'paused') {
      paused.current = false;
      window.speechSynthesis.resume();
      setReadingState('speaking');
      setStatus('Reading page content.');
      const pending = resumeReading.current;
      resumeReading.current = null;
      pending?.();
    }
  }

  return (
    <section ref={bar} className="speech-reader" aria-label="Text-to-speech controls">
      <button type="button" className="button" onClick={readPage} disabled={!canSpeak}>
        Read page aloud
      </button>
      <label className="speech-reader__rate">
        Speed
        <select
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
          aria-label="Speech speed"
        >
          <option value={0.75}>Slow</option>
          <option value={1}>Normal</option>
          <option value={1.25}>Fast</option>
          <option value={1.5}>Faster</option>
        </select>
      </label>
      {readingState !== 'idle' && (
        <button type="button" className="button button--ghost" onClick={togglePause}>
          {readingState === 'paused' ? 'Resume reading' : 'Pause reading'}
        </button>
      )}
      <button
        type="button"
        className="button button--ghost"
        onClick={() => stop()}
        disabled={readingState === 'idle'}
      >
        Stop reading
      </button>
      <span className="speech-reader__status" role="status" aria-live="polite">
        {status || (!canSpeak ? 'Text-to-speech is not supported in this browser.' : '')}
      </span>
    </section>
  );
}
