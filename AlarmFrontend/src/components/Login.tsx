import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../features/auth/authSlice';

import logoLight from '../assets/images/logo.png';
import userImg from '../assets/images/user.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Email and password are required.');
      return;
    }
    try {
      const res = await axios.post(
        `${window.APP_CONFIG.API_BASE_URL}Users/Login`,
        { username, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const user = res.data.user;

      localStorage.setItem('authToken', user.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
      localStorage.setItem('name', user.username);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userId', user.id);

      dispatch(loginSuccess(user.token));
      navigate('/home');
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-sky-200 px-6 py-8 flex items-center justify-between">
          <div>
            <h2 className="text-sky-700 font-bold text-lg">Welcome Back !</h2>
            <p className="text-sm text-sky-700">
              Sign in to continue to Alarm Management System.
            </p>
          </div>
          <img
            src={logoLight}
            alt="Logo"
            className="h-12 object-contain -mb-12"
          />
        </div>

        <img
          src={userImg}
          alt="User"
          className="h-16 w-16 rounded-full border-2 bg-sky-50 ms-2 p-1 -my-6 mb-1 shadow-sm"
        />

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="bg-red-100 text-red-700 p-2 mb-4 text-sm rounded text-center">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="username"
                className="block text-sm text-gray-700 font-medium mb-1 "
              >
                Email
              </label>
              <input
                type="text"
                id="username"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter email"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm text-gray-700  font-medium mb-1"
              >
                Password
              </label>
              <div className="relative mb-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 rounded font-semibold transition duration-150"
            >
              Log In
            </button>

            <p className="text-center text-sm mt-2 text-gray-700 ">
              Don't have an account?{' '}
              <Link to="/" className="text-sky-700 hover:underline font-medium">
                Signup now
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
