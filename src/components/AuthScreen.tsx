import React, { useState } from 'react';
import { 
  Trophy, 
  Mail, 
  User, 
  CheckCircle2, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  KeyRound, 
  UserPlus, 
  LogIn
} from 'lucide-react';
import { AuctionState } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AuthScreenProps {
  auction?: AuctionState;
  playersCount?: number;
  usersCount?: number;
  onLogin: (email: string, password?: string, authProvider?: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (email: string, name: string, teamName: string, password?: string, authProvider?: string) => Promise<{ success: boolean; error?: string }>;
  onGoogleAuth: (email: string, name?: string, teamName?: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string }>;
  onResetPassword?: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  onContinueAsGuest?: () => void;
}

type AuthMode = 'REGISTER' | 'LOGIN' | 'RECOVER';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  auction,
  playersCount = 125,
  usersCount = 2,
  onLogin,
  onRegister,
  onGoogleAuth,
  onResetPassword,
  onContinueAsGuest,
}) => {
  const [mode, setMode] = useState<AuthMode>('REGISTER');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTeamName, setRegTeamName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Password reset form
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // UI status
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Suggest club name automatically
  const handleRegNameChange = (val: string) => {
    setRegName(val);
    if (!regTeamName || regTeamName.endsWith('Galácticos FC') || regTeamName.endsWith('FC')) {
      const firstWord = val.trim().split(' ')[0] || '';
      if (firstWord.length > 1) {
        setRegTeamName(`${firstWord} Galácticos FC`);
      }
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!regEmail || !regEmail.includes('@')) {
      setError('Por favor informe um endereço de Gmail válido.');
      return;
    }

    if (!regName.trim()) {
      setError('Por favor informe o seu nome ou apelido de treinador.');
      return;
    }

    if (!regTeamName.trim()) {
      setError('Por favor informe o nome do seu clube / time.');
      return;
    }

    if (regPassword.length < 4) {
      setError('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('As senhas digitadas não coincidem. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    const res = await onRegister(regEmail.trim(), regName.trim(), regTeamName.trim(), regPassword);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro ao criar conta.');
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!loginEmail || !loginEmail.includes('@')) {
      setError('Por favor informe o seu email cadastrado.');
      return;
    }

    setLoading(true);
    const res = await onLogin(loginEmail.trim(), loginPassword);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Credenciais inválidas.');
    }
  };

  // Submit Password Reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Informe o email para redefinição.');
      return;
    }

    if (resetNewPassword.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!onResetPassword) return;

    setLoading(true);
    const res = await onResetPassword(resetEmail.trim(), resetNewPassword);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Senha atualizada com sucesso! Agora você pode fazer login.');
      setLoginEmail(resetEmail);
      setLoginPassword('');
      setTimeout(() => {
        setMode('LOGIN');
      }, 1500);
    } else {
      setError(res.error || 'Falha ao redefinir senha.');
    }
  };

  // Reset form inputs on tab change
  const handleTabChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setLoginPassword('');
    setRegPassword('');
    setRegConfirmPassword('');
    setResetNewPassword('');
    setResetConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-center sm:justify-start border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-wide font-['Outfit',sans-serif]">
                KHEDIRA LEAGUE
              </span>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                EAFC 27
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Sistema Oficial de Leilão Virtual e Montagem de Elencos
            </p>
          </div>
        </div>
      </header>

      {/* Main Content: Centered Authentication Card */}
      <main className="relative z-10 flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center justify-center">
        
        {/* Authentication Card */}
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
          
          {/* Card Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('REGISTER')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'REGISTER'
                  ? 'bg-white text-emerald-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Criar Nova Conta
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('LOGIN')}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'LOGIN'
                  ? 'bg-white text-emerald-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4 text-emerald-600" />
              Já Tenho Conta
            </button>
          </div>

          <div className="p-6 sm:p-7">
            
            {/* Security Guarantee Badge */}
            <div className="mb-4 px-3 py-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-900 font-medium leading-tight">
                <strong>Acesso Individual:</strong> Cada treinador acessa exclusivamente o seu clube com seu próprio email e senha.
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 animate-in fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                <p className="flex-1 font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="flex-1 font-semibold leading-relaxed">{successMessage}</p>
              </div>
            )}

            {/* TAB: REGISTER */}
            {mode === 'REGISTER' && (
              <div className="space-y-4">
                <form onSubmit={handleRegisterSubmit} className="space-y-3" autoComplete="off">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Treinador <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Carlos Silva"
                        value={regName}
                        onChange={(e) => handleRegNameChange(e.target.value)}
                        autoComplete="name"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Email de Acesso (Gmail ou outro) <span className="text-emerald-600">*</span></span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="seuemail@gmail.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        autoComplete="email"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do seu Clube / Time <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative">
                      <Trophy className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Galácticos FC, Samba FC..."
                        value={regTeamName}
                        onChange={(e) => setRegTeamName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Criar Senha <span className="text-emerald-600">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Mín. 4 dígitos"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          autoComplete="new-password"
                          className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirmar Senha <span className="text-emerald-600">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Repita a senha"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Cadastrando Clube...' : 'Cadastrar Meu Clube (€ 400M)'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    Já tem conta cadastrada?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('LOGIN')}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Fazer Login
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* TAB: LOGIN */}
            {mode === 'LOGIN' && (
              <div className="space-y-4">
                <form onSubmit={handleLoginSubmit} className="space-y-3" autoComplete="off">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Cadastrado
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="seuemail@exemplo.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        autoComplete="username"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Senha de Acesso
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabChange('RECOVER');
                          setResetEmail(loginEmail);
                        }}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Digite sua senha cadastrada"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Entrando...' : 'Entrar no Meu Clube'}
                    <LogIn className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    Ainda não tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('REGISTER')}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Criar nova conta grátis
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* TAB: RECOVER */}
            {mode === 'RECOVER' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Redefinir Senha de Acesso</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Informe o email da sua conta para cadastrar uma nova senha.
                </p>

                <form onSubmit={handleResetSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Cadastrado
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="seuemail@gmail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nova Senha (mín. 4 dígitos)
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Digite a nova senha"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Repita a nova senha"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setError(null);
                      }}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : 'Atualizar Senha'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Option to view as guest */}
            {onContinueAsGuest && (
              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Deseja apenas espiar o leilão? <span className="text-emerald-700 underline">Acessar como Visitante</span>
                </button>
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
};
