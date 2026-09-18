import React, { useState, useRef, useEffect } from 'react';
import Select, {
  type Props as SelectProps,
  components,
  type OptionProps,
  type ValueContainerProps,
} from 'react-select';

export interface Option {
  value: string | number;
  label: string;
}

interface SelectDropdownProps<IsMulti extends boolean = false> extends Omit<
  SelectProps<Option, IsMulti>,
  'options'
> {
  label: string;
  options: Option[];
}

const CheckboxOption = (props: OptionProps<Option, boolean>) => {
  const { isSelected, isFocused, label } = props;
  return (
    <components.Option {...props}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        <span className={isFocused ? 'text-sky-800' : 'text-gray-700'}>
          {label}
        </span>
      </div>
    </components.Option>
  );
};

const CompactValueContainer = (props: ValueContainerProps<Option, boolean>) => {
  const { children, getValue, hasValue } = props;
  const selectedCount = getValue().length;
  const [inputChild, ...restChildren] = React.Children.toArray(children);

  if (!hasValue) {
    return (
      <components.ValueContainer {...props}>
        {children}
      </components.ValueContainer>
    );
  }

  return (
    <components.ValueContainer {...props}>
      <span className="text-sm text-gray-700 me-2">
        {selectedCount} selected{' '}
      </span>
      {inputChild}
    </components.ValueContainer>
  );
};

const SelectDropdown = <IsMulti extends boolean = false>({
  label,
  options,
  value,
  onChange,
  ...rest
}: SelectDropdownProps<IsMulti>) => {
  const isMulti = (rest as any).isMulti;
  const [menuIsOpen, setMenuIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // out side click close for multi-select dropdown
  useEffect(() => {
    if (!isMulti) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setMenuIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMulti]);

  return (
    <div className="w-full" ref={wrapperRef}>
      <label className="block font-medium text-sm mb-1 text-gray-500">
        {label}
      </label>
      <Select<Option, IsMulti>
        options={options}
        value={value}
        onChange={onChange}
        isClearable
        unstyled
        closeMenuOnSelect={!isMulti}
        hideSelectedOptions={false}
        className="text-sm"
        components={
          isMulti
            ? { Option: CheckboxOption, ValueContainer: CompactValueContainer }
            : undefined
        }
        {...(isMulti
          ? {
              menuIsOpen,
              onMenuOpen: () => setMenuIsOpen(true),
              onMenuClose: () => setMenuIsOpen(false),
            }
          : {})}
        classNames={{
          control: ({ isFocused }) =>
            `min-h-[36px] w-full border rounded ${
              isFocused ? 'border-sky-600 ring-1 ' : 'border-gray-300'
            } hover:border-sky-600`,
          valueContainer: () => 'px-2 py-1',
          placeholder: () => 'text-gray-400',
          singleValue: () => 'text-gray-800',
          menu: () =>
            'mt-1 border border-gray-200 rounded-md shadow-lg bg-white z-50',
          option: ({ isFocused, isSelected }) =>
            `px-3 py-2 cursor-pointer text-sm ${
              isSelected
                ? 'bg-sky-100 text-sky-900 font-medium'
                : isFocused
                  ? 'bg-sky-50 text-gray-800'
                  : 'text-gray-700'
            }`,
          indicatorSeparator: () => 'hidden',
          dropdownIndicator: () => 'text-gray-500 hover:text-sky-600 me-2',
          clearIndicator: () => 'text-gray-500 hover:text-red-500',
        }}
        // theme={(theme) => ({
        //   ...theme,
        //   colors: {
        //     ...theme.colors,
        //     primary: 'bg-sky-700',
        //     primary25: 'bg-sky-600',
        //   },
        // })}
        {...rest}
      />
    </div>
  );
};

export default SelectDropdown;
