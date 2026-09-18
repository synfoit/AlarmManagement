import React from 'react';

type TextAreaProps = {
  value: string;
  placeholder?: string;
  red?: boolean;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

const TextArea: React.FC<TextAreaProps> = ({
  value,
  placeholder,
  red,
  onChange,
  onKeyDown,
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
    className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none`}
  />
);

export default TextArea;
