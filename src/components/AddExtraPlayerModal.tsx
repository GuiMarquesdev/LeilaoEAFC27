import React, { useState } from 'react';
import { X, Plus, AlertCircle, Shield, UserPlus, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface AddExtraPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    position: string;
    club?: string;
    nationality?: string;
    initialPrice: number;
  }) => Promise<boolean>;
  isAuctionActive: boolean;
}

const POSITIONS = [
  { group: 'Goleiros', list: ['GOL'] },
  { group: 'Defensores', list: ['ZAG', 'LE', 'LD'] },
  { group: 'Meio-Campistas', list: ['VOL', 'MC', 'MEI'] },
  { group: 'Atacantes', list: ['ATA', 'PD', 'PE'] }
];

export const AddExtraPlayerModal: React.FC<AddExtraPlayerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isAuctionActive,
}) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('ATA');
  const [club, setClub] = useState('');
  const [nationality, setNationality] = useState('');
  const [initialPrice, setInitialPrice] = useState<number>(10000000); // Mínimo € 10.000.000
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isAuctionActive) {
      setErrorMessage(
        'Regra Oficial: A inclusão de jogadores extras fora da base é permitida apenas quando o leilão estiver pausado ou fechado. Quando o leilão estiver ativo, novos atletas não podem ser inseridos.'
      );
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Informe o nome completo ou de jogo do atleta.');
      return;
    }

    if (initialPrice < 10000000) {
      setErrorMessage(
        'Conforme a Ata Oficial, o lance mínimo obrigatório para qualquer jogador extra fora da base é de € 10.000.000 (€ 10M).'
      );
      return;
    }

    try {
      setSubmitting(true);
      const success = await onSubmit({
        name: name.trim(),
        position,
        club: club.trim() || 'Livre no Mercado',
        nationality: nationality.trim() || 'Internacional',
        initialPrice,
      });

      if (success) {
        setName('');
        setClub('');
        setNationality('');
        setInitialPrice(10000000);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao cadastrar jogador extra.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Adicionar Jogador Fora da Base
              </h3>
              <p className="text-[11px] text-slate-500">
                Lista pública de craques adicionados manualmente pelos participantes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Rules Banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              <span>Regulamento Oficial da Liga (Seção 2 da Ata)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 leading-relaxed">
              <li>
                <strong>Momento Permitido:</strong> Apenas com o leilão <em>fechado ou pausado</em>. Bloqueado durante disputa ativa.
              </li>
              <li>
                <strong>Lance Mínimo Obrigatório:</strong> € 10.000.000 (€ 10M) para qualquer jogador extra.
              </li>
              <li>
                <strong>Visibilidade Pública:</strong> O jogador entra na lista pública de todos os participantes.
              </li>
            </ul>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nome do Atleta */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Jogador <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Endrick, Lamine Yamal, Vitor Roque..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
            />
          </div>

          {/* Posição */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Posição em Campo <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'ATA', 'PD', 'PE'].map((pos) => (
                <button
                  type="button"
                  key={pos}
                  onClick={() => setPosition(pos)}
                  className={`py-1.5 text-xs font-extrabold rounded-lg border transition-all cursor-pointer ${
                    position === pos
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Clube e Nacionalidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clube Atual <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Real Madrid"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nacionalidade <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Brasil"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Lance Mínimo Obrigatório */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Lance Mínimo Obrigatório
              </label>
              <span className="text-xs font-extrabold text-emerald-700">
                {formatCurrency(initialPrice)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-slate-800">
                  € 10.000.000 (Mínimo Fixado)
                </span>
                <p className="text-[10px] text-slate-500">
                  Todo jogador fora da base inicia obrigatoriamente com o teto mínimo de €10M.
                </p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md uppercase">
                Obrigatório
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || isAuctionActive}
              className={`flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl text-white shadow-xs transition-all cursor-pointer ${
                submitting || isAuctionActive
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {submitting ? (
                <span>Cadastrando...</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Atleta na Lista Pública</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
