'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const EMPTY = '<p></p>';

/** Compact rich-text editor for assessment question prompts. Emits HTML. */
export function RichPromptEditor({
  value,
  onChange,
  placeholder = 'Question prompt…',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
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
        class:
          'prose prose-sm max-w-none min-h-[52px] px-3 py-2 focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || EMPTY;
    if (current !== next && next !== EMPTY) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="min-h-[52px] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)]" aria-hidden />;

  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--dash-border)] p-1">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="B" bold />
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" italic />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="• List" />
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1. List" />
        <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="Code" />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, onClick, label, bold, italic }: { active: boolean; onClick: () => void; label: string; bold?: boolean; italic?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${active ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'} ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`}
    >
      {label}
    </button>
  );
}
