import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type ReadingState = 'idle' | 'speaking' | 'paused';

const MAX_UTTERANCE_LENGTH = 1000;

function getPageText(): string {
  const content = document.querySelector<HTMLElement>(
    'main, [role="main"], .auth-card, .auth-loading',
  );
  if (!content) return '';

  const readableContent = content.cloneNode(true) as HTMLElement;
  readableContent.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove());
  return (readableContent.innerText ?? readableContent.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
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
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(
    (message = 'Reading stopped.') => {
      generation.current += 1;
      if (canSpeak) window.speechSynthesis.cancel();
      setReadingState('idle');
      setStatus(message);
    },
    [canSpeak],
  );

  useEffect(
    () => () => {
      generation.current += 1;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function readPage() {
    if (!canSpeak) {
      setStatus('Text-to-speech is not supported in this browser.');
      return;
    }

    const text = getPageText();
    if (!text) {
      setStatus('There is no page content to read.');
      return;
    }

    const chunks = splitIntoChunks(text);
    const currentGeneration = ++generation.current;
    window.speechSynthesis.cancel();
    setReadingState('speaking');
    setStatus('Reading page content.');

    function speakNext(index: number) {
      if (currentGeneration !== generation.current) return;
      if (index >= chunks.length) {
        setReadingState('idle');
        setStatus('Finished reading page content.');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = rate;
      utterance.lang = document.documentElement.lang || navigator.language || 'en-US';
      utterance.onend = () => speakNext(index + 1);
      utterance.onerror = (event) => {
        if (currentGeneration !== generation.current || event.error === 'canceled') return;
        generation.current += 1;
        setReadingState('idle');
        setStatus('Text-to-speech could not read this page.');
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        generation.current += 1;
        setReadingState('idle');
        setStatus('Text-to-speech could not read this page.');
      }
    }

    speakNext(0);
  }

  function togglePause() {
    if (!canSpeak) return;
    if (readingState === 'speaking') {
      window.speechSynthesis.pause();
      setReadingState('paused');
      setStatus('Reading paused.');
    } else if (readingState === 'paused') {
      window.speechSynthesis.resume();
      setReadingState('speaking');
      setStatus('Reading page content.');
    }
  }

  return (
    <section className="speech-reader" aria-label="Text-to-speech controls">
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
