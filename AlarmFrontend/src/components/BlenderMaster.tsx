// src/pages/BlenderMaster.tsx
import React, { JSX, useEffect, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';
import TextInput from '../features/ui/TextInput';
import SelectDropdown from '../features/ui/SelectDropdown';
import type { Option } from '../features/ui/SelectDropdown';
import type { SingleValue, ActionMeta } from 'react-select';
import { Blender } from '../features/interfaces/blender-types';

export default function BlenderMaster(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const Api = React.useMemo(() => createCrudApi('BlenderConfiguration'), []);

  const [form, setForm] = useState<Blender>({
    id: 0,
    rowId: 0,
    blenderName: '',
    viewName: '',
    equipmentNumber: 0,
    isActive: true,
    createdAt: '',
  });

  const [viewOptions, setViewOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);

  // load view names for dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await Api.get<any>('GetViewName');
        const data = res?.data;
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.views)
            ? data.views
            : [];
        if (cancelled) return;
        setViewOptions(
          arr.filter(Boolean).map((v: any) => {
            const s = String(v ?? '').trim();
            return { label: s, value: s };
          })
        );
      } catch (err) {
        console.error('Failed to load view names:', err);
        Swal.fire('Error', 'Failed to load view names', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // if edit -> load blender by id
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // call BlenderConfigurationById?rowId=<id>
        const res = await Api.get<any>(
          `BlenderConfigurationById?rowId=${encodeURIComponent(id)}`
        );
        const data = res?.data ?? {};
        if (cancelled) return;
        const rowIdNum = Number(data.rowId ?? data.id ?? id);
        const blenderName = String(
          data.blenderName ?? data.blendername ?? ''
        ).trim();
        const viewName = String(data.viewName ?? data.viewname ?? '').trim();
        const equipmentNumber = Number(
          data.equipmentNumber ?? data.equipment_number ?? data.equipment ?? 0
        );
        const isActive =
          typeof data.isActive === 'boolean'
            ? data.isActive
            : Boolean(data.isActive ?? true);
        setForm({
          id: 0,
          rowId: Number.isFinite(rowIdNum) ? rowIdNum : 0,
          blenderName,
          viewName,
          equipmentNumber: Number.isFinite(equipmentNumber)
            ? equipmentNumber
            : 0,
          isActive,
          createdAt: data.createdAt ?? '',
        });
      } catch (err) {
        console.error('Failed to load blender for edit:', err);
        Swal.fire('Error', 'Failed to load blender configuration', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, Api]);

  const handleSelectChange =
    (field: 'viewName') =>
    (newValue: SingleValue<Option>, _meta: ActionMeta<Option>) => {
      const value = newValue?.value ?? '';
      setForm((p) => ({ ...p, [field]: String(value).trim() }));
    };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(
      (p) =>
        ({
          ...p,
          [name]:
            type === 'checkbox'
              ? checked
              : name === 'equipmentNumber'
                ? Number(value === '' ? 0 : Number(value))
                : value,
        }) as unknown as Blender
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.blenderName || !form.viewName) {
      Swal.fire(
        'Validation',
        'Blender Name and View Name are required',
        'warning'
      );
      return;
    }
    setLoading(true);
    try {
      const payload = {
        rowId: Number(form.rowId ?? 0),
        blenderName: String(form.blenderName).trim(),
        viewName: String(form.viewName).trim(),
        equipmentNumber: Number(form.equipmentNumber ?? 0) || 0,
        isActive: Boolean(form.isActive),
        // createdAt: form.createdAt (backend can set)
      };

      // SaveBlenderConfiguration is the endpoint you mentioned
      await Api.post('SaveBlenderConfiguration', payload);
      Swal.fire(
        'Success',
        isEdit ? 'Configuration updated' : 'Configuration saved',
        'success'
      );
      navigate('/blender-list');
    } catch (err) {
      console.error('Save failed:', err);
      Swal.fire('Error', 'Failed to save blender configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  // compute select value
  const viewValue: Option | null =
    viewOptions.find(
      (o) => String(o.value).trim() === String(form.viewName ?? '').trim()
    ) ?? null;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700 uppercase">
          {isEdit ? 'Edit Blender Configuration' : 'Add Blender Configuration'}
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← Back
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-lg shadow-lg gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            {' '}
            Blender Name{' '}
          </label>
          <TextInput
            name="blenderName"
            value={String(form.blenderName ?? '')}
            onChange={handleInputChange}
            placeholder="Enter blender name"
          />
        </div>

        <div>
          <SelectDropdown
            label="Table Mapping:"
            options={viewOptions}
            defaultValue={viewOptions[0] ?? null}
            value={viewValue}
            onChange={handleSelectChange('viewName')}
            onKeyDown={() => {}}
            tabIndex={2}
            isDisabled={false}
            aria-disabled={false}
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 focus:outline-none transition duration-150"
          >
            {loading
              ? isEdit
                ? 'Updating...'
                : 'Saving...'
              : isEdit
                ? 'Update'
                : 'Save'}
          </button>
        </div>
      </form>
    </>
  );
}
