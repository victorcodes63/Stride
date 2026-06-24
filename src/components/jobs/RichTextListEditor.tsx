'use client';

import { useEffect, useId } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { toHtmlString } from '@/lib/job-list-html';

export interface RichTextListEditorProps {
  /** Raw HTML from editor - preserves full structure (ordered/bullet lists, nested content). */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
}

const EMPTY_HTML = '<p></p>';

export function RichTextListEditor({
  value,
  onChange,
  placeholder = 'Add items… Use the toolbar for formatting.',
  'aria-label': ariaLabel,
  id,
}: RichTextListEditorProps) {
  const fallbackId = useId();
  const editorKey = id ?? fallbackId;
  const html = toHtmlString(value);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: html || EMPTY_HTML,
      editorProps: {
        attributes: {
          class:
            'prose prose-sm max-w-none min-h-[140px] px-4 py-3 focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_p]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold',
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(id ? { id } : {}),
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    },
    [editorKey],
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = html || EMPTY_HTML;
    if (current !== next && next !== EMPTY_HTML) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, html]);

  if (!editor) {
    return (
      <div
        className="min-h-[140px] w-full rounded-lg border border-neutral-300 bg-white animate-pulse"
        aria-hidden
      />
    );
  }

  return (
    <div className="rounded-lg border border-neutral-300 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 border-b border-neutral-100 bg-neutral-50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('bold') ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('italic') ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('bulletList') ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Bullet list"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('orderedList') ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          title="Numbered list"
        >
          1. List
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
