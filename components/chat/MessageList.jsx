import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollShadow } from '@nextui-org/react';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import {
  CustomTable,
  CustomTableHead,
  CustomTableRow,
  CustomTableCell,
  CustomList,
  CustomHeading,
  CustomLink,
} from './CustomMarkdownComponents';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const MessageList = ({ messages, isLoadingMessages }) => {
  const filteredMessages = messages.filter(m => m.content.trim() !== '');

  // Define variants for the animation
  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <ScrollShadow className="flex-1 overflow-y-auto p-4 md:px-20 scrollbar-hide">
      {isLoadingMessages ? (
        <div className="text-center p-4">Carregando mensagens...</div>
      ) : (
        <ul className="space-y-4 flex flex-col">
          {filteredMessages.map((m, index) => (
            <motion.li
              key={index}
              className={`p-3 rounded-xl max-w-full md:max-w-[80%] ${
                m.role === 'user'
                  ? 'bg-gray-50 self-end flex flex-col w-full md:w-fit shadow-md'
                  : 'self-start w-full'
              }`}
              initial="hidden"
              animate="visible"
              variants={messageVariants}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {m.role === 'user' ? (
                <p className="font-bold text-black">Você</p>
              ) : (
                <p className="font-bold w-fit bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 text-transparent bg-clip-text">
                  Sophia:
                </p>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  table: CustomTable,
                  thead: CustomTableHead,
                  tr: CustomTableRow,
                  th: (props) => <CustomTableCell {...props} isHeader={true} />,
                  td: (props) => <CustomTableCell {...props} isHeader={false} />,
                  ul: (props) => <CustomList {...props} ordered={false} />,
                  ol: (props) => <CustomList {...props} ordered={true} />,
                  h1: (props) => <CustomHeading {...props} level={1} />,
                  h2: (props) => <CustomHeading {...props} level={2} />,
                  h3: (props) => <CustomHeading {...props} level={3} />,
                  h4: (props) => <CustomHeading {...props} level={4} />,
                  h5: (props) => <CustomHeading {...props} level={5} />,
                  h6: (props) => <CustomHeading {...props} level={6} />,
                  a: CustomLink,
                }}
                className="text-sm p-2 break-words"
              >
                {m.content}
              </ReactMarkdown>
            </motion.li>
          ))}
        </ul>
      )}
    </ScrollShadow>
  );
};

export default MessageList;
