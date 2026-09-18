import React from 'react';

type TextInputProps = {
  name?: string;
  id?: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  tabIndex?: number;
  required?: boolean;
  disabled?: boolean;
  red?: boolean;
  autoComplete?: string;
};

const TextInput: React.FC<TextInputProps> = ({
  name,
  id,
  value,
  type = 'text',
  placeholder,
  onChange,
  onKeyDown,
  className,
  tabIndex = 0,
  required,
  disabled,
  red,
  autoComplete,
}) => {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      className={`${className ?? 'w-full'} border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none ${
        red ? 'text-red-600' : ''
      } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      aria-invalid={red ? 'true' : undefined}
    />
  );
};

export default TextInput;
