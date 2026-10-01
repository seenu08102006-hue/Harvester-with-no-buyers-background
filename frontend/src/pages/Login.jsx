import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, ShoppingCart, Truck, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { loginUser } from '../services/api';

export default function Login() {
  const [role, setRole] = useState('farmer');
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      setError('');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await loginUser({
        username: username.trim(),
        password: password.trim(),
        role: role,
      });

      const { access_token, user } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      if (user.role === 'farmer') {
        navigate('/farmer-dashboard');
      } else if (user.role === 'buyer') {
        navigate('/buyer-dashboard');
      } else if (user.role === 'transporter') {
        navigate('/transporter-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail || 'Invalid username or password';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = () => {
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-surface-50 flex flex-col items-center justify-center p-4">
      {/* Background styling */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, rgba(74, 222, 128, 0.4) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(34, 197, 94, 0.3) 0%, transparent 50%)',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-stone-100/50 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary-400 to-primary-600" />

          {/* Logo & Title */}
          <div className="text-center mb-8 mt-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 mx-auto mb-4">
              <Sprout className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-stone-900 tracking-tight">
              Harvest<span className="text-primary-500">Flow</span>.ai
            </h1>
            <p className="text-stone-500 text-sm mt-1">Real-Time Agricultural Supply Chain</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {step === 1 ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider ml-1 mb-2">
                  Select Your Role
                </label>

                {/* Farmer Option */}
                <label
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    role === 'farmer'
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-stone-200 hover:border-primary-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="farmer"
                    checked={role === 'farmer'}
                    onChange={() => setRole('farmer')}
                    className="hidden"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                      role === 'farmer' ? 'bg-primary-100 text-primary-600' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${role === 'farmer' ? 'text-primary-900' : 'text-stone-700'}`}>
                      Farmer
                    </p>
                    <p className="text-xs text-stone-500">Add harvests, accept requests & optimize trucks</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      role === 'farmer' ? 'border-primary-500' : 'border-stone-300'
                    }`}
                  >
                    {role === 'farmer' && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                  </div>
                </label>

                {/* Buyer Option */}
                <label
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    role === 'buyer'
                      ? 'border-amber-500 bg-amber-50 shadow-sm'
                      : 'border-stone-200 hover:border-amber-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="buyer"
                    checked={role === 'buyer'}
                    onChange={() => setRole('buyer')}
                    className="hidden"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                      role === 'buyer' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${role === 'buyer' ? 'text-amber-900' : 'text-stone-700'}`}>
                      Buyer
                    </p>
                    <p className="text-xs text-stone-500">Live harvests, send requests & track transport</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      role === 'buyer' ? 'border-amber-500' : 'border-stone-300'
                    }`}
                  >
                    {role === 'buyer' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                  </div>
                </label>

                {/* Transporter Option */}
                <label
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    role === 'transporter'
                      ? 'border-violet-500 bg-violet-50 shadow-sm'
                      : 'border-stone-200 hover:border-violet-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="transporter"
                    checked={role === 'transporter'}
                    onChange={() => setRole('transporter')}
                    className="hidden"
                  />
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                      role === 'transporter' ? 'bg-violet-100 text-violet-600' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${role === 'transporter' ? 'text-violet-900' : 'text-stone-700'}`}>
                      Transporter
                    </p>
                    <p className="text-xs text-stone-500">Fleet management & real-time delivery status</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      role === 'transporter' ? 'border-violet-500' : 'border-stone-300'
                    }`}
                  >
                    {role === 'transporter' && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700 mb-2 inline-flex items-center gap-1"
                >
                  &larr; Change role ({role.toUpperCase()})
                </button>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1 ml-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all font-medium text-stone-800"
                    placeholder={
                      role === 'farmer'
                        ? 'Enter username (e.g. farmer1)'
                        : role === 'buyer'
                        ? 'Enter username (e.g. buyer1)'
                        : 'Enter username (e.g. transporter1)'
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1 ml-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all font-medium text-stone-800"
                    placeholder="Enter password"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-slide-up">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-stone-900 text-white font-semibold text-base hover:bg-stone-800 transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-2 group mt-6 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Authenticating...
                </>
              ) : step === 1 ? (
                'CONTINUE'
              ) : (
                'SIGN IN'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Admin Button (Top Right) */}
      <button
        onClick={handleAdminLogin}
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 hover:text-stone-900 shadow-md hover:shadow-lg transition-all z-20 text-sm"
      >
        <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
          <Shield className="w-3.5 h-3.5" />
        </div>
        Admin Portal
      </button>
    </div>
  );
}
