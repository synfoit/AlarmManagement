import React from 'react';

type ToggleButtonProps = {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

const ToggleButton: React.FC<ToggleButtonProps> = ({
  options,
  selected,
  onSelect,
}) => {
  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center">
        {/* Button container */}
        <div className="flex overflow-hidden rounded-lg shadow-md">
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`w-40 px-6 py-2 text-white font-medium transition-colors duration-300 ${
                selected === option
                  ? index === 0
                    ? 'bg-sky-700'
                    : 'bg-sky-600'
                  : index === 0
                    ? 'bg-sky-500'
                    : 'bg-sky-400'
              }`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {/* OR circle */}
        {options.length === 2 && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white text-xs font-bold border-2 border-white shadow">
              OR
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToggleButton;
