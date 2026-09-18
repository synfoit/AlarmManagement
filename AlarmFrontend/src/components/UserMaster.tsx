// src/pages/UserMaster.tsx
import React, { useState, useEffect, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';
import type { User } from '../features/interfaces/user-types';
import SelectDropdown from '../features/ui/SelectDropdown';

type FieldErrors = Partial<Record<keyof User, string>>;

const UserMaster: React.FC = () => {
  const userApi = React.useMemo(() => createCrudApi('Users'), []);
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const currentRole = (localStorage.getItem('role') || '').toLowerCase();
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const isSuperAdmin = currentRole === 'superadmin';
  const isEngineer = currentRole === 'engineer';

  const allRoleOptions = [
    { value: 'engineer', label: 'Engineer' },
    { value: 'manager', label: 'Manager' },
    { value: 'superadmin', label: 'Super Admin' },
  ];
  const availableRoleOptions = isSuperAdmin
    ? allRoleOptions
    : allRoleOptions.filter((o) => o.value !== 'superadmin');

  const [formData, setFormData] = useState<User>({
    id: 0,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: availableRoleOptions[0]?.value || 'engineer',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && isEngineer) {
      Swal.fire('Access Denied', 'Engineer cannot add new users.', 'warning');
      navigate('/user-list');
      return;
    }
    if (isEdit && id) {
      (async () => {
        try {
          const res = await userApi.get<User>(`GetUserDetailsForUpdate/${id}`);
          setFormData({ ...res.data, password: '' });
        } catch (err) {
          console.error('Failed to load user:', err);
          Swal.fire('Error', 'Failed to load user', 'error');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const editingUserId = isEdit ? Number(id) : null;
  const isOwnAccount = isEdit && editingUserId === currentUserId;
  const editingExistingSuperAdmin =
    (formData.role || '').toLowerCase() === 'superadmin' && !isSuperAdmin;
  const disableRoleSelect =
    editingExistingSuperAdmin || (currentRole === 'engineer' && isOwnAccount);

  // ---- Field-level validation ----
  const validatePhone = (phone: string) => /^[6-9]\d{9}$/.test(phone.trim());
  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const validateField = (name: keyof User, value: string): string => {
    const val = (value || '').trim();

    switch (name) {
      case 'firstName':
        return val ? '' : 'First Name cannot be blank';
      case 'lastName':
        return val ? '' : 'Last Name cannot be blank';
      case 'username':
        return val ? '' : 'Username cannot be blank';
      case 'email':
        if (!val) return 'Email cannot be blank';
        if (!validateEmail(val)) return 'Enter a valid email address';
        return '';
      case 'phone':
        if (!val) return 'Phone cannot be blank';
        if (!validatePhone(val)) return 'Enter a valid 10-digit phone number';
        return '';
      case 'role':
        return val ? '' : 'Role cannot be blank';
      case 'password':
        if (!isEdit && !val) return 'Password cannot be blank';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name as keyof User, value),
    }));
  };

  const handleRoleChange = (selected: any) => {
    if (disableRoleSelect) return;
    if (!isSuperAdmin && selected?.value === 'superadmin') {
      Swal.fire('Permission', 'You cannot assign SuperAdmin role', 'error');
      return;
    }
    const value = selected?.value || '';
    setFormData((p) => ({ ...p, role: value }));
    setErrors((prev) => ({ ...prev, role: validateField('role', value) }));
  };

  const validateAll = (): boolean => {
    const fieldsToCheck: (keyof User)[] = [
      'firstName',
      'lastName',
      'username',
      'email',
      'phone',
      'role',
      'password',
    ];
    const newErrors: FieldErrors = {};
    let isValid = true;

    fieldsToCheck.forEach((key) => {
      const msg = validateField(key, (formData[key] as string) || '');
      if (msg) {
        newErrors[key] = msg;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateAll()) {
      return;
    }

    setLoading(true);
    try {
      if (isEdit && id) {
        const payload = { ...formData } as Partial<User>;
        if (!payload.password?.trim()) delete (payload as any).password;
        await userApi.post('Update', formData);
        Swal.fire('User Updated!', '', 'success');
      } else {
        if (!isSuperAdmin && formData.role?.toLowerCase() === 'superadmin') {
          Swal.fire('Permission', 'You cannot assign SuperAdmin role', 'error');
          setLoading(false);
          return;
        }
        await userApi.post('Register', formData);
        Swal.fire('User Created!', '', 'success');
      }
      navigate('/user-list');
    } catch (err: any) {
      console.error('API error:', err);
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        'Failed to save user';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const focusNext = (idx: number) => {
    document.querySelector<HTMLElement>(`[tabindex="${idx + 1}"]`)?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusNext(idx);
    }
  };

  useEffect(() => {
    document.querySelector<HTMLElement>(`[tabindex="0"]`)?.focus();
  }, []);

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 mb-1 uppercase">
        {isEdit ? 'Edit User' : 'Add User'}
      </h1>
      <div className="mt-3">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-lg shadow-lg gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              First Name *
            </label>
            <input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 0)}
              tabIndex={0}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.firstName && (
              <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              Last Name *
            </label>
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 1)}
              tabIndex={1}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.lastName && (
              <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              Username *
            </label>
            <input
              name="username"
              value={formData.username}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 2)}
              tabIndex={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.username && (
              <p className="text-red-600 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              {isEdit
                ? 'New Password (leave blank to keep current)'
                : 'Password *'}
            </label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 3)}
              tabIndex={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              Email *
            </label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 4)}
              tabIndex={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.email && (
              <p className="text-red-600 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-sm mb-1 text-gray-500">
              Phone *
            </label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              onKeyDown={(e) => handleKeyDown(e, 5)}
              tabIndex={5}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
            {errors.phone && (
              <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <SelectDropdown
              label="Role *"
              options={availableRoleOptions}
              defaultValue={availableRoleOptions[0]}
              value={
                availableRoleOptions.find(
                  (opt) => opt.value === formData.role
                ) || null
              }
              onChange={handleRoleChange}
              onKeyDown={(e) => handleKeyDown(e, 6)}
              tabIndex={6}
              isDisabled={disableRoleSelect}
              aria-disabled={disableRoleSelect}
            />
            {errors.role && (
              <p className="text-red-600 text-xs mt-1">{errors.role}</p>
            )}
          </div>

          <div className="col-span-full">
            <button
              type="submit"
              disabled={loading}
              onKeyDown={(e) => handleKeyDown(e, 8)}
              tabIndex={8}
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

          {error && (
            <div className="px-6 py-3 font-semibold rounded bg-red-100 text-red-600 col-span-full">
              {error}
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default UserMaster;
