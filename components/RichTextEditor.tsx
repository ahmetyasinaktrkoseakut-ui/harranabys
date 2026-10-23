import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Type } from 'lucide-react';
import { useEffect, forwardRef, useImperativeHandle } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export interface RichTextEditorRef {
  insertContent: (content: string) => void;
  getHTML: () => string;
  insertContentAndGetHTML: (content: string) => string;
  setHTML: (html: string) => void;
}

const CustomLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-evidence-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-evidence-id'),
        renderHTML: attributes => {
          if (!attributes['data-evidence-id']) {
            return {};
          }
          return {
            'data-evidence-id': attributes['data-evidence-id'],
          };
        },
      },
    };
  },
});

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ content, onChange, readOnly = false, minHeight = '160px' }, ref) => {
    const editor = useEditor({
      editable: !readOnly,
      extensions: [
        StarterKit,
        CustomLink.configure({
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
      ],
      content: content,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      immediatelyRender: false,
    });

    useImperativeHandle(ref, () => ({
      insertContent: (html: string) => {
        if (editor) {
          editor.chain().focus().insertContent(html).run();
        }
      },
      getHTML: () => {
        return editor ? editor.getHTML() : '';
      },
      insertContentAndGetHTML: (html: string) => {
        if (editor) {
          editor.chain().focus().insertContent(html).run();
          return editor.getHTML();
        }
        return '';
      },
      setHTML: (html: string) => {
        if (editor) {
          editor.commands.setContent(html);
        }
      },
    }));

    useEffect(() => {
      if (editor) {
        editor.setEditable(!readOnly);
      }
    }, [readOnly, editor]);

    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }, [content, editor]);

    if (!editor) {
      return <div className="h-40 border border-slate-200 rounded-lg bg-slate-50 animate-pulse"></div>;
    }

    return (
      <div className={`border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm ${readOnly ? 'opacity-80 bg-slate-50' : ''}`}>
        {!readOnly && (
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          
          <button
            type="button"
            onClick={() => {
              const previousUrl = editor.getAttributes('link').href;
              const url = window.prompt('URL:', previousUrl);
              if (url === null) return;
              if (url === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }}
            className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('link') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
            title="Add Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="p-2 rounded hover:bg-slate-200 text-slate-600"
            title="Clear Format"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>
        )}

        <div 
          className={`p-4 prose prose-sm max-w-none text-slate-700 ${!readOnly ? 'cursor-text' : 'cursor-not-allowed'} focus-within:outline-none`} 
          style={{ minHeight }}
          onClick={() => { if(!readOnly) editor.commands.focus() }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

