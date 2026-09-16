import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { PlayerPosition, UserProfile } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AddExtraPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onAddExtraPlayer: (data: {
    name: string;
    position: PlayerPosition;
    club: string;
    nationality: string;
    initialPrice: number;
  }) => Promise<boolean>;
}

const POSITIONS: { value: PlayerPosition; label: string; group: string }[] = [
  { value: 'GOL', label: 'GOL - Goleiro', group: 'Defesa' },
  { value: 'ZAG', label: 'ZAG - Zagueiro', group: 'Defesa' },
  { value: 'LD', label: 'LD - Lateral Direito', group: 'Defesa' },
  { value: 'LE', label: 'LE - Lateral Esquerdo', group: 'Defesa' },
  { value: 'VOL', label: 'VOL - Volante', group: 'Meio' },
  { value: 'MC', label: 'MC - Meia Central', group: 'Meio' },
  { value: 'MEI', label: 'MEI - Meia Atacante / Armador', group: 'Meio' },
  { value: 'MD', label: 'MD - Meia Direito', group: 'Ataque' },
  { value: 'ME', label: 'ME - Meia Esquerdo', group: 'Ataque' },
  { value: 'PD', label: 'PD - Ponta Direita', group: 'Ataque' },
  { value: 'PE', label: 'PE - Ponta Esquerda', group: 'Ataque' },
  { value: 'SA', label: 'SA - Segundo Atacante', group: 'Ataque' },
  { value: 'ATA', label: 'ATA - Centroavante', group: 'Ataque' },
];

export const AddExtraPlayerModal: React.FC<AddExtraPlayerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAddExtraPlayer,
}) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('ATA');
  const [club, setClub] = useState('');
  const [nationality, setNationality] = useState('Brasil');
  const [initialPrice, setInitialPrice] = useState('10000000'); // default €10M
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do atleta.');
      return;
    }

    const price = Number(initialPrice);
    if (isNaN(price) || price < 10000000) {
      setErrorMsg('Conforme a Ata Oficial, o lance mínimo para jogadores extras deve ser de pelo menos € 10 Milhões (€ 10M).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await onAddExtraPlayer({
        name: name.trim(),
        position,
        club: club.trim() || 'Sem Clube (Livre)',
        nationality: nationality.trim() || 'Internacional',
        initialPrice: price,
      });

      if (ok) {
        setSuccessMsg(`Atleta ${name.trim()} incluído na lista oficial com lance inicial de ${formatCurrency(price, true)}!`);
        setTimeout(() => {
          setSuccessMsg(null);
          setName('');
          setClub('');
          onClose();
        }, 1500);
      } else {
        setErrorMsg('Erro ao cadastrar jogador extra.');
      }
    } catch {
      setErrorMsg('Falha de comunicação com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Adicionar Jogador Extra à Lista
              </h2>
              <p className="text-xs text-slate-500">
                Inclusão Sob Demanda • Khedira League
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rule Highlight Card */}
        <div className="p-4 bg-amber-50/80 border-b border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Regra Oficial (Seção 2 da Ata):</strong> Qualquer atleta não constante na lista inicial pode ser requisitado imediatamente por qualquer clube, tendo como regra estrita o <strong>lance mínimo obrigatório de € 10 Milhões de Euros (€ 10M)</strong>.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome Completo do Jogador *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Neymar Jr, Endrick, Estêvão..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Posição do Jogador *
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as PlayerPosition)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
              >
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clube Atual
              </label>
              <input
                type="text"
                placeholder="Ex: Al-Hilal, Real Madrid..."
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nacionalidade
              </label>
              <input
                type="text"
                placeholder="Ex: Brasil, França, Argentina..."
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lance Mínimo Inicial (€) * (Min. € 10M)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10000000"
                  step="1000000"
                  required
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-emerald-800"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Equivale a: <strong>{formatCurrency(Number(initialPrice) || 0, true)}</strong>
              </span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Cadastrando...' : 'Adicionar Jogador'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
