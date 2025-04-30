import React from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Editor as TinyMCEEditor } from '@tinymce/tinymce-react';

// Remover imports e código relacionado a ReactQuill
// import dynamic from 'next/dynamic';
// import 'react-quill/dist/quill.snow.css'; 
// const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface TextInputProps {
    texto: string;
    setTexto: (value: string) => void;
}

const TextInput: React.FC<TextInputProps> = ({ texto, setTexto }) => {
    return (
        <Editor
            apiKey="biovjne3ik61o21mw48l06ylvamdd8hecytfwz1frw55ztsy" // Sua chave de API
            value={texto}
            init={{
                height: 300, // Altura inicial
                menubar: true, // Habilitar barra de menu
                plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount',
                    'resize' // Habilitar plugin de redimensionamento
                ],
                toolbar:
                    'undo redo | blocks | '
                    + 'bold italic forecolor | alignleft aligncenter '
                    + 'alignright alignjustify | bullist numlist outdent indent | '
                    + 'removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                resize: 'both' // Permitir redimensionamento vertical e horizontal
            }}
            onEditorChange={(content: string, editor: TinyMCEEditor) => {
                setTexto(content);
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
  