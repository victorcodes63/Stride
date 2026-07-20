'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const EMPTY = '<p></p>';

/** Compact TipTap editor for project task descriptions and comments. */
export function ProjectRichText({
  value,
  onChange,
  onBlur,
  placeholder = 'Add details…',
  minHeight = 72,
  compact = false,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, horizontalRule: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || EMPTY,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none px-3 py-2 focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6`,
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    onBlur: () => onBlur?.(),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || EMPTY;
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]"
        style={{ minHeight }}
        aria-hidden
      />
    );
  }

  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)]">
      {!compact ? (
        <div className="flex flex-wrap gap-1 border-b border-[var(--dash-border)] p-1">
          <ToolbarBtn
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="B"
            className="font-bold"
          />
          <ToolbarBtn
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="I"
            className="italic"
          />
          <ToolbarBtn
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="• List"
          />
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
          : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
      } ${className}`}
    >
      {label}
    </button>
  );
}
