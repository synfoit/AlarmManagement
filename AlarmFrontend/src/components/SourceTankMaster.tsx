// src/pages/SourceMaster.tsx
import React, { useState, useEffect, type FormEvent, JSX } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';
import TextInput from '../features/ui/TextInput';
import TextArea from '../features/ui/TextArea';
import type { SourceTank } from '../features/interfaces/sourceTank-types';

export default function SourceMaster(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const SourceApi = React.useMemo(() => createCrudApi('SourceTankDesc'), []);

  const [form, setForm] = useState<SourceTank>({
    id: 0,
    rowId: 0,
    tankNo: 0,
    tankDescription: '',
    createdAt: new Date().toISOString(),
    isActive: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        setLoading(true);
        try {
          const res = await SourceApi.get<SourceTank>(`getSourceTank/${id}`);
          const data = res.data;
          setForm({
            id: 0,
            rowId: data.rowId ?? Number(id),
            tankNo: data.tankNo ?? 0,
            tankDescription: data.tankDescription ?? '',
            createdAt: data.createdAt ?? new Date().toISOString(),
            isActive: data.isActive ?? true,
          });
        } catch (err) {
          console.error('Failed to load tank:', err);
          Swal.fire('Error', 'Failed to load tank', 'error');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id, isEdit, SourceApi]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (name === 'tankNo') {
      const numeric = value === '' ? 0 : Number(value.replace(/\D/g, ''));
      setForm((p) => ({ ...p, tankNo: numeric }));
      return;
    }
    if (type === 'checkbox') {
      setForm((p) => ({ ...p, [name]: checked }) as any);
      return;
    }
    setForm((p) => ({ ...p, [name]: value }) as any);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tankDescription || String(form.tankDescription).trim() === '') {
      Swal.fire('Validation', 'Tank Name / Description is required', 'warning');
      return;
    }

    setLoading(true);
    try {
      await SourceApi.post('saveSourceTank', {
        rowId: form.rowId ?? 0,
        tankNo: form.tankNo ?? 0,
        tankDescription: form.tankDescription ?? '',
        createdAt: form.createdAt ?? new Date().toISOString(),
        isActive: form.isActive ?? true,
      } as SourceTank);

      Swal.fire(
        'Success',
        `Source Tank ${isEdit ? 'updated' : 'created'} successfully`,
        'success'
      );
      navigate('/source-tank-list');
    } catch (err: any) {
      console.error('Save failed:', err);
      const apiMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === 'string' ? err.response.data : null);
      Swal.fire(
        'Error',
        apiMessage || 'Failed to save the source tank.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700 uppercase">
          {isEdit ? 'Edit Source Tank' : 'Add Source Tank'}
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
            Tank No
          </label>
          <TextInput
            name="tankNo"
            type="number"
            value={String(form.tankNo)}
            onChange={handleChange}
            placeholder="Enter tank number"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tank Description
          </label>

          <TextInput
            name="tankDescription"
            type="text"
            value={String(form.tankDescription)}
            onChange={handleChange}
            placeholder="Enter tank description"
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
