import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface TextInputProps {
    texto: string;
    setTexto: (value: string) => void;
}

const TextInput: React.FC<TextInputProps> = ({ texto, setTexto }) => {
    const editorRef = useRef<any>(null);
    
    return (
        <Editor
            apiKey="biovjne3ik61o21mw48l06ylvamdd8hecytfwz1frw55ztsy"
            onInit={(_evt, editor) => editorRef.current = editor}
            initialValue={texto}
            init={{
                height: 300,
                menubar: true,
                plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount',
                    'resize'
                ],
                toolbar:
                    'undo redo | blocks | '
                    + 'bold italic forecolor | alignleft aligncenter '
                    + 'alignright alignjustify | bullist numlist outdent indent | '
                    + 'removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                resize: 'both',
                setup: (editor) => {
                    editor.on('Change', () => {
                        setTexto(editor.getContent());
                    });
                }
            }}
        />
        /*
        <Textarea
            id="texto"
            name="texto"
            label="Texto:"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Insira seu texto aqui"
            rows={6}
            variant="bordered"
            labelPlacement="outside"
        />
        */
    );
};

export default TextInput;
  