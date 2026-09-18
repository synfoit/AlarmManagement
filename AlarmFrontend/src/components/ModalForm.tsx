import React from 'react';

// Type for each input field
type FieldConfig<T> = {
  name: keyof T;
  label: string;
  component: React.ComponentType<{
    value: any;
    onChange: (val: any) => void;
    className?: string;
  }>;
};

// Props for ModalForm
type ModalFormProps<T> = {
  isOpen: boolean;
  title: string;
  initialValues: Partial<T>;
  fields: FieldConfig<T>[];
  onClose: () => void;
  onSubmit: (values: T) => Promise<void> | void;
  submitLabel?: string;
};

// 🟦 Text Input
const TextInput = ({
  value,
  onChange,
  className = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none',
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) => (
  <input
    type="text"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    className={className}
  />
);

// 🟦 Date Input
const DateInput = ({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) => (
  <input
    type="date"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
  />
);

// 🟦 Radio Input
const RadioInput = ({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}) => (
  <div className="space-y-1">
    {options.map((opt) => (
      <label key={opt.value} className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          value={opt.value}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          className={className}
        />
        {opt.label}
      </label>
    ))}
  </div>
);

// 🟦 Checkbox Input
const CheckboxInput = ({
  value,
  onChange,
  className = '',
}: {
  value: boolean;
  onChange: (val: boolean) => void;
  className?: string;
}) => (
  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className={className}
    />
    Enabled
  </label>
);

// ✅ Main ModalForm component
export function ModalForm<T>({
  isOpen,
  title,
  initialValues,
  fields,
  onClose,
  onSubmit,
  submitLabel = 'Save',
}: ModalFormProps<T>) {
  const [values, setValues] = React.useState<Partial<T>>(initialValues);

  React.useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40 transition-opacity duration-300">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg relative animate-fade-in">
        <button
          className="absolute top-2 right-3 text-gray-600 hover:text-sky-700 text-2xl font-bold"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-lg font-semibold mb-4 text-gray-600">{title}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(values as T);
          }}
        >
          {fields.map(({ name, label, component: Input }) => (
            <div key={String(name)} className="mb-4">
              <label className="block text-sm text-gray-700 font-medium mb-1">
                {label}
              </label>
              <Input
                value={(values as any)[name] ?? ''}
                onChange={(val: any) =>
                  setValues((prev) => ({ ...prev, [name]: val }))
                }
              />
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-700 text-white rounded"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 🟨 Export Input Components for use
ModalForm.TextInput = TextInput;
ModalForm.DateInput = DateInput;
ModalForm.CheckboxInput = CheckboxInput;
ModalForm.RadioInput = RadioInput;
