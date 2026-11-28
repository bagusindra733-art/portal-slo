import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Indent,
  Italic,
  List,
  ListOrdered,
  Outdent,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { htmlToText, sanitizeHtml } from '../utils/sanitizeHtml';

interface Props {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}

const SIZES: [string, string][] = [
  ['1', '8pt'],
  ['2', '10pt'],
  ['3', '12pt'],
  ['4', '14pt'],
  ['5', '18pt'],
  ['6', '24pt'],
  ['7', '36pt'],
];

function Btn({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // mouseDown dicegah agar seleksi teks di editor tidak hilang
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 rounded-md flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer ${
        active ? 'bg-violet-100 text-violet-700' : ''
      }`}
    >
      {children}
    </button>
  );
}

/** Editor teks kaya ringan (tebal, miring, garis bawah, rata, daftar, indent, kode HTML). */
export function RichTextEditor({ value, onChange, minHeight = 160 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const savedRange = useRef<Range | null>(null);
  const [code, setCode] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [words, setWords] = useState(0);

  const countWords = (html: string) => {
    const t = htmlToText(html).trim();
    setWords(t ? t.split(/\s+/).length : 0);
  };

  useLayoutEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(value);
    countWords(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nilai berubah dari luar (mis. ganti data) — bukan dari ketikan di editor ini
  useEffect(() => {
    if (value !== lastEmitted.current && ref.current) {
      ref.current.innerHTML = sanitizeHtml(value);
      lastEmitted.current = value;
      countWords(value);
    }
  }, [value]);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const emit = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastEmitted.current = html;
    countWords(html);
    onChange(html);
  };

  const exec = (cmd: string, arg?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && !el.contains(sel.anchorNode)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(cmd, false, arg);
    emit();
  };

  const toggleCode = () => {
    if (!code) {
      setCodeText(ref.current?.innerHTML ?? '');
      setCode(true);
    } else {
      if (ref.current) ref.current.innerHTML = sanitizeHtml(codeText);
      emit();
      setCode(false);
    }
  };

  const selCls = 'h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700';

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-white">
        <Btn title="Undo" onClick={() => exec('undo')}>
          <Undo2 className="w-4 h-4" />
        </Btn>
        <Btn title="Redo" onClick={() => exec('redo')}>
          <Redo2 className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <select
          aria-label="Format paragraf"
          className={selCls}
          defaultValue="p"
          onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}
        >
          <option value="p">Paragraph</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <select
          aria-label="Ukuran huruf"
          className={`${selCls} ml-1`}
          defaultValue="3"
          onChange={(e) => exec('fontSize', e.target.value)}
        >
          {SIZES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Tebal" onClick={() => exec('bold')}>
          <Bold className="w-4 h-4" />
        </Btn>
        <Btn title="Miring" onClick={() => exec('italic')}>
          <Italic className="w-4 h-4" />
        </Btn>
        <Btn title="Garis bawah" onClick={() => exec('underline')}>
          <Underline className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Rata kiri" onClick={() => exec('justifyLeft')}>
          <AlignLeft className="w-4 h-4" />
        </Btn>
        <Btn title="Rata tengah" onClick={() => exec('justifyCenter')}>
          <AlignCenter className="w-4 h-4" />
        </Btn>
        <Btn title="Rata kanan" onClick={() => exec('justifyRight')}>
          <AlignRight className="w-4 h-4" />
        </Btn>
        <Btn title="Rata kanan-kiri" onClick={() => exec('justifyFull')}>
          <AlignJustify className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Daftar poin" onClick={() => exec('insertUnorderedList')}>
          <List className="w-4 h-4" />
        </Btn>
        <Btn title="Daftar nomor" onClick={() => exec('insertOrderedList')}>
          <ListOrdered className="w-4 h-4" />
        </Btn>
        <Btn title="Kurangi indent" onClick={() => exec('outdent')}>
          <Outdent className="w-4 h-4" />
        </Btn>
        <Btn title="Tambah indent" onClick={() => exec('indent')}>
          <Indent className="w-4 h-4" />
        </Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Kode HTML" onClick={toggleCode} active={code}>
          <Code2 className="w-4 h-4" />
        </Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={emit}
        onBlur={emit}
        className={`rte-content px-3 py-2.5 outline-none overflow-auto ${code ? 'hidden' : ''}`}
        style={{ minHeight, maxHeight: 420 }}
      />
      {code && (
        <textarea
          value={codeText}
          onChange={(e) => setCodeText(e.target.value)}
          spellCheck={false}
          className="w-full px-3 py-2.5 font-mono text-xs outline-none resize-y"
          style={{ minHeight, maxHeight: 420 }}
        />
      )}

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 text-[11px] text-slate-400">
        <span>{code ? 'Mode kode HTML — klik ikon <> lagi untuk kembali' : ''}</span>
        <span>{words} words</span>
      </div>
    </div>
  );
}
