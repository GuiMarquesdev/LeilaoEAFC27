import React from 'react';
import { X, FileText, ShieldCheck, CheckCircle2, DollarSign, Calendar, Lock, PlusCircle, AlertCircle, Clock, Sparkles, Users } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface OfficialRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfficialRulesModal: React.FC<OfficialRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Ata da Reunião de Alinhamento & Regulamento Oficial
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full">
                  Em Vigor
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Khedira League • Guilherme Pereira (Diretor) & Guilherme Tourinho (Presidente)
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 text-xs sm:text-sm">
          {/* Header Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span>📅 Data: Reunião Oficial</span>
              <span>📍 Plataforma Virtual Khedira League</span>
              <span className="text-emerald-700 font-bold">👑 Guilherme Pereira (Diretor) & Guilherme Tourinho (Presidente)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-200/60">
              Aos membros e dirigentes dos clubes da Khedira League, reuniram-se para definir as diretrizes fundamentais, os parâmetros orçamentários e as regras operacionais que regerão o próximo leilão de atletas do campeonato.
            </p>
          </div>

          {/* Seção 1: Estrutura e Formato do Leilão */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 text-emerald-800">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>1. Estrutura e Formato do Leilão</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Orçamento de € 300M
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cada clube tem orçamento inicial recorde de <strong className="text-emerald-800 font-bold">€ 300 Milhões</strong> (300.000.000 €).
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-blue-900 block flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  Sigilo de Lances
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lances confidenciais em tempo real, garantindo máxima competitividade e estratégia sigilosa.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-amber-900 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Propostas por 24 Horas
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Em cada rodada de leilão, as propostas pelo jogador ficam disponíveis pelo período ininterrupto de <strong className="text-amber-800 font-bold">24 horas</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-purple-900 block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Postagem pelos Usuários
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  São os próprios usuários que postam os jogadores de seu interesse da lista registrada, alimentando a fila de leilão automaticamente.
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5 sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-black text-emerald-950 block flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  Limite de Elenco: Exatamente 23 Jogadores por Time
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Cada equipe é estritamente limitada a um teto máximo de <strong className="text-emerald-900 font-bold">23 jogadores</strong> (11 titulares no campinho tático e até 12 reservas). Clubes que atingirem a marca de 23 atletas arrematados ficam automaticamente impedidos de enviar novos lances de compra ou postar novos atletas.
                </p>
              </div>
            </div>

            {/* Divisão dos 3 Dias */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span>Cronograma Oficial por Posições (3 Dias Consecutivos)</span>
              </span>
              <p className="text-xs text-slate-600">
                O leilão ocorrerá ao longo de três dias, segmentado estritamente por posições dos atletas:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 bg-white border border-blue-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                      DIA 1
                    </span>
                    <span className="text-xs font-bold text-slate-800">Defesa</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">Sistema Defensivo</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Exclusivo para <strong>Goleiros (GOL)</strong>, <strong>Zagueiros (ZAG)</strong> e <strong>Laterais (LD / LE)</strong>.
                  </p>
                </div>

                <div className="p-3 bg-white border border-amber-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                      DIA 2
                    </span>
                    <span className="text-xs font-bold text-slate-800">Meio</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">Meio-Campo</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Exclusivo para <strong>Volantes (VOL)</strong>, <strong>Meio-campistas (MC)</strong> e <strong>Meias-Armadores (MEI)</strong>.
                  </p>
                </div>

                <div className="p-3 bg-white border border-rose-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                      DIA 3
                    </span>
                    <span className="text-xs font-bold text-slate-800">Ataque</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">Setor Ofensivo</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    Exclusivo para <strong>Pontas (PE / PD / ME / MD)</strong>, <strong>Segundos Atacantes (SA)</strong> e <strong>Centroavantes (ATA)</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Jogadores Não Cadastrados e Lances Mínimos */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 text-emerald-800">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>2. Jogadores Não Cadastrados e Lances Mínimos</span>
            </h3>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-900">
                    Inclusão Sob Demanda com Lance Mínimo Obrigatório de € 10M
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Caso algum participante deseje adquirir um atleta que não conste na lista visível inicial do EAFC 27, ele poderá solicitar sua inclusão imediatamente.
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    ⚖️ <strong>Regra de Ouro:</strong> Qualquer jogador adicionado manualmente à lista terá um lance mínimo obrigatório de <span className="text-amber-950 font-black underline decoration-amber-400">10 Milhões de Euros (€ 10.000.000)</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Disposições Finais */}
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              3. Disposições Finais & Validade
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Todos os participantes declararam ciência e concordância com as regras estabelecidas nesta ata, comprometendo-se a manter a integridade, o equilíbrio esportivo e o respeito aos prazos e lances do torneio.
            </p>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Khedira League - Gestão Oficial</span>
              <span className="text-emerald-700">Guilherme Pereira (Diretor) & Guilherme Tourinho (Presidente)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Entendido & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
