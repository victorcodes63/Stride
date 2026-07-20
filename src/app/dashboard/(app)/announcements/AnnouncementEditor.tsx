'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote } from 'lucide-react';

export type AnnouncementEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

const EMPTY_HTML = '<p></p>';

/** Controlled TipTap rich-text editor for announcement bodies. */
export function AnnouncementEditor({
  value,
  onChange,
  placeholder = 'Write your announcement…',
  ariaLabel = 'Announcement body',
}: AnnouncementEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || EMPTY_HTML,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[180px] px-4 py-3 focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_p]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600',
        'aria-label': ariaLabel,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === EMPTY_HTML ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || EMPTY_HTML;
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className="min-h-[180px] w-full animate-pulse rounded-lg border border-neutral-300 bg-white"
        aria-hidden
      />
    );
  }

  const buttons = [
    { key: 'bold', icon: Bold, title: 'Bold', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { key: 'italic', icon: Italic, title: 'Italic', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { key: 'h2', icon: Heading2, title: 'Heading', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { key: 'h3', icon: Heading3, title: 'Subheading', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { key: 'bullet', icon: List, title: 'Bullet list', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { key: 'ordered', icon: ListOrdered, title: 'Numbered list', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { key: 'quote', icon: Quote, title: 'Quote', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary-500/30">
      <div className="flex flex-wrap gap-1 border-b border-neutral-100 bg-neutral-50 p-2">
        {buttons.map(({ key, icon: Icon, title, run, active }) => (
          <button
            key={key}
            type="button"
            onClick={run}
            title={title}
            aria-label={title}
            aria-pressed={active}
            className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors ${
              active ? 'bg-primary-100 text-primary-800' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
