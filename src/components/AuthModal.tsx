import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  User, 
  DollarSign, 
  CheckCircle2, 
  Trophy, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  KeyRound, 
  Sparkles,
  ShieldCheck,
  RefreshCw,
  LogOut,
  UserPlus,
  LogIn
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatCurrency, getUserRoleBadge } from '../utils/formatters';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (email: string, password?: string, authProvider?: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (email: string, name: string, teamName: string, password?: string, authProvider?: string) => Promise<{ success: boolean; error?: string }>;
  onGoogleAuth: (email: string, name?: string, teamName?: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string }>;
  onResetPassword?: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  onUpdateProfile?: (name: string, teamName: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RECOVER' | 'PROFILE';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onRegister,
  onGoogleAuth,
  onResetPassword,
  onUpdateProfile,
  onLogout,
}) => {
  const [mode, setMode] = useState<AuthMode>(currentUser ? 'PROFILE' : 'REGISTER');
  
  // Registration form
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

  // Profile edit
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editTeamName, setEditTeamName] = useState(currentUser?.teamName || '');
  const [editPassword, setEditPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state when currentUser changes or modal opens
  useEffect(() => {
    if (currentUser) {
      setMode('PROFILE');
      setEditName(currentUser.name);
      setEditTeamName(currentUser.teamName);
    } else {
      if (mode === 'PROFILE') {
        setMode('REGISTER');
      }
    }
    setError(null);
    setSuccessMessage(null);
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  // Auto-suggest team name as user types their name
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

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Erro ao criar conta. Tente novamente.');
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

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Credenciais inválidas. Tente novamente.');
    }
  };

  // Submit Password Reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Por favor informe o email cadastrado para redefinição.');
      return;
    }

    if (resetNewPassword.length < 4) {
      setError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!onResetPassword) {
      setError('Recuperação de senha não disponível no momento.');
      return;
    }

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
      setError(res.error || 'Falha ao atualizar senha.');
    }
  };

  // Submit Profile Edit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!editName.trim() || !editTeamName.trim()) {
      setError('Nome e Nome do Clube não podem ficar vazios.');
      return;
    }

    if (!onUpdateProfile) return;

    setLoading(true);
    const res = await onUpdateProfile(editName.trim(), editTeamName.trim(), editPassword || undefined);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Dados atualizados com sucesso!');
      setEditPassword('');
    } else {
      setError(res.error || 'Erro ao atualizar dados.');
    }
  };

  // Tab change handler clearing inputs
  const handleTabChange = (newMode: 'REGISTER' | 'LOGIN' | 'RECOVER' | 'PROFILE') => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-['Outfit',sans-serif]">
                KHEDIRA LEAGUE
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {mode === 'PROFILE' 
                  ? 'Gestão de Conta & Clube' 
                  : mode === 'REGISTER' 
                  ? 'Cadastro Oficial de Novos Treinadores' 
                  : mode === 'RECOVER'
                  ? 'Recuperação de Senha'
                  : 'Acesso à Conta do Clube'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (when not logged in) */}
        {!currentUser && mode !== 'RECOVER' && (
          <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('REGISTER')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'REGISTER'
                  ? 'bg-white text-emerald-700 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Criar Nova Conta
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('LOGIN')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'LOGIN'
                  ? 'bg-white text-emerald-700 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Já Tenho Conta
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="p-6">
          
          {/* Security Banner */}
          {!currentUser && (
            <div className="mb-4 px-3 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[11px] text-emerald-900 font-medium">
                <strong>Acesso Individual:</strong> Cada treinador acessa exclusivamente sua própria conta com seu email e senha cadastrados.
              </p>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 animate-in fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
              <p className="flex-1 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="flex-1 font-medium leading-relaxed">{successMessage}</p>
            </div>
          )}

          {/* VIEW: LOGGED IN PROFILE */}
          {currentUser && mode === 'PROFILE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{currentUser.name}</span>
                    {currentUser.role === 'ADMIN' ? (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getUserRoleBadge(currentUser).badgeClass}`}>
                        {getUserRoleBadge(currentUser).badgeLabel}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                        Participante
                      </span>
                    )}
                  </div>
                  {currentUser.authProvider === 'gmail' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                      Gmail Conectado
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 font-semibold mb-1 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                  {currentUser.teamName}
                </p>
                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {currentUser.email}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Orçamento Disponível</span>
                    <span className="font-extrabold text-emerald-600 text-sm">
                      {formatCurrency(currentUser.budget)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Investido no Leilão</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      {formatCurrency(currentUser.spent)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit Profile Form */}
              <form onSubmit={handleProfileSubmit} className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  Atualizar Dados do Perfil
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Seu Nome / Apelido
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do seu Clube / Time
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nova Senha (opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="Deixe em branco para manter a atual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setMode('REGISTER');
                    }}
                    className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW: REGISTER NEW ACCOUNT */}
          {!currentUser && mode === 'REGISTER' && (
            <div className="space-y-4">
              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-3" autoComplete="off">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Seu Nome Completo ou Apelido <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Ex: Gabriel Santos"
                      value={regName}
                      onChange={(e) => handleRegNameChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Endereço de Gmail / Email <span className="text-emerald-600">*</span></span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Preferência Gmail</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="seuemail@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do seu Time / Clube <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <Trophy className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="Ex: Santos Galácticos FC"
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
                        autoComplete="new-password"
                        placeholder="Mín. 4 dígitos"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
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
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Budget Credit Note */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-950">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-emerald-800 block">Orçamento Inicial Garantido:</span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Cada novo clube recebe <strong>€ 400.000.000 (€ 400M)</strong> automaticamente no cadastro para o leilão!
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Cadastrando Clube...' : 'Criar Minha Conta & Acessar a Liga'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Já possui uma conta registrada?{' '}
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

          {/* VIEW: LOGIN */}
          {!currentUser && mode === 'LOGIN' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3" autoComplete="off">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Seu Gmail / Email de Acesso
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="seuemail@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
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
                      autoComplete="current-password"
                      placeholder="Sua senha de acesso"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
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
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Autenticando...' : 'Entrar no Meu Clube'}
                  <LogIn className="w-3.5 h-3.5" />
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

          {/* VIEW: PASSWORD RECOVERY */}
          {mode === 'RECOVER' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Redefinição de Senha</h3>
              </div>
              <p className="text-xs text-slate-500">
                Informe o seu email cadastrado para definir uma nova senha para a sua conta.
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
                    Nova Senha (mínimo 4 caracteres)
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
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Atualizando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
