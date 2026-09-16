import { Player, TacticalFormation } from '../types';

export const INITIAL_PLAYERS: Omit<Player, 'status'>[] = [
  // Goleiros (GOL)
  { id: 'p-1', name: 'Thibaut Courtois', position: 'GOL', club: 'Real Madrid', nationality: 'Bélgica', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-2', name: 'Alisson Becker', position: 'GOL', club: 'Liverpool', nationality: 'Brasil', initialPrice: 34000000, currentPrice: 34000000 },
  { id: 'p-3', name: 'Ederson Moraes', position: 'GOL', club: 'Manchester City', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-4', name: 'Marc-André ter Stegen', position: 'GOL', club: 'Barcelona', nationality: 'Alemanha', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-5', name: 'Jan Oblak', position: 'GOL', club: 'Atlético de Madrid', nationality: 'Eslovênia', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-6', name: 'Gianluigi Donnarumma', position: 'GOL', club: 'Paris Saint-Germain', nationality: 'Itália', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-7', name: 'Mike Maignan', position: 'GOL', club: 'Milan', nationality: 'França', initialPrice: 24000000, currentPrice: 24000000 },
  { id: 'p-8', name: 'Emiliano Martínez', position: 'GOL', club: 'Aston Villa', nationality: 'Argentina', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-9', name: 'Gregor Kobel', position: 'GOL', club: 'Borussia Dortmund', nationality: 'Suíça', initialPrice: 18000000, currentPrice: 18000000 },
  { id: 'p-10', name: 'David Raya', position: 'GOL', club: 'Arsenal', nationality: 'Espanha', initialPrice: 20000000, currentPrice: 20000000 },

  // Zagueiros (ZAG)
  { id: 'p-11', name: 'Virgil van Dijk', position: 'ZAG', club: 'Liverpool', nationality: 'Holanda', initialPrice: 40000000, currentPrice: 40000000 },
  { id: 'p-12', name: 'William Saliba', position: 'ZAG', club: 'Arsenal', nationality: 'França', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-13', name: 'Rúben Dias', position: 'ZAG', club: 'Manchester City', nationality: 'Portugal', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-14', name: 'Antonio Rüdiger', position: 'ZAG', club: 'Real Madrid', nationality: 'Alemanha', initialPrice: 34000000, currentPrice: 34000000 },
  { id: 'p-15', name: 'Alessandro Bastoni', position: 'ZAG', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-16', name: 'Gabriel Magalhães', position: 'ZAG', club: 'Arsenal', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-17', name: 'Éder Militão', position: 'ZAG', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-18', name: 'Ronald Araújo', position: 'ZAG', club: 'Barcelona', nationality: 'Uruguai', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-19', name: 'Marquinhos', position: 'ZAG', club: 'Paris Saint-Germain', nationality: 'Brasil', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-20', name: 'Pau Cubarsí', position: 'ZAG', club: 'Barcelona', nationality: 'Espanha', initialPrice: 24000000, currentPrice: 24000000 },
  { id: 'p-21', name: 'Josko Gvardiol', position: 'ZAG', club: 'Manchester City', nationality: 'Croácia', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-22', name: 'Gleison Bremer', position: 'ZAG', club: 'Juventus', nationality: 'Brasil', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-23', name: 'Micky van de Ven', position: 'ZAG', club: 'Tottenham', nationality: 'Holanda', initialPrice: 22000000, currentPrice: 22000000 },

  // Laterais Esquerdos (LE)
  { id: 'p-24', name: 'Theo Hernández', position: 'LE', club: 'Milan', nationality: 'França', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-25', name: 'Alphonso Davies', position: 'LE', club: 'Bayern de Munique', nationality: 'Canadá', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-26', name: 'Federico Dimarco', position: 'LE', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-27', name: 'Nuno Mendes', position: 'LE', club: 'Paris Saint-Germain', nationality: 'Portugal', initialPrice: 27000000, currentPrice: 27000000 },
  { id: 'p-28', name: 'Alejandro Balde', position: 'LE', club: 'Barcelona', nationality: 'Espanha', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-29', name: 'Ferland Mendy', position: 'LE', club: 'Real Madrid', nationality: 'França', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-30', name: 'Destiny Udogie', position: 'LE', club: 'Tottenham', nationality: 'Itália', initialPrice: 18000000, currentPrice: 18000000 },

  // Laterais Direitos (LD)
  { id: 'p-31', name: 'Trent Alexander-Arnold', position: 'LD', club: 'Liverpool', nationality: 'Inglaterra', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-32', name: 'Dani Carvajal', position: 'LD', club: 'Real Madrid', nationality: 'Espanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-33', name: 'Achraf Hakimi', position: 'LD', club: 'Paris Saint-Germain', nationality: 'Marrocos', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-34', name: 'Jeremie Frimpong', position: 'LD', club: 'Bayer Leverkusen', nationality: 'Holanda', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-35', name: 'Ben White', position: 'LD', club: 'Arsenal', nationality: 'Inglaterra', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-36', name: 'Kyle Walker', position: 'LD', club: 'Manchester City', nationality: 'Inglaterra', initialPrice: 19000000, currentPrice: 19000000 },
  { id: 'p-37', name: 'Jules Koundé', position: 'LD', club: 'Barcelona', nationality: 'França', initialPrice: 28000000, currentPrice: 28000000 },

  // Volantes (VOL)
  { id: 'p-38', name: 'Rodri Hernández', position: 'VOL', club: 'Manchester City', nationality: 'Espanha', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-39', name: 'Declan Rice', position: 'VOL', club: 'Arsenal', nationality: 'Inglaterra', initialPrice: 42000000, currentPrice: 42000000 },
  { id: 'p-40', name: 'Aurélien Tchouaméni', position: 'VOL', club: 'Real Madrid', nationality: 'França', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-41', name: 'Eduardo Camavinga', position: 'VOL', club: 'Real Madrid', nationality: 'França', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-42', name: 'Hakan Çalhanoğlu', position: 'VOL', club: 'Inter de Milão', nationality: 'Turquia', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-43', name: 'Bruno Guimarães', position: 'VOL', club: 'Newcastle United', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-44', name: 'Granit Xhaka', position: 'VOL', club: 'Bayer Leverkusen', nationality: 'Suíça', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-45', name: 'Joshua Kimmich', position: 'VOL', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 34000000, currentPrice: 34000000 },
  { id: 'p-46', name: 'João Palhinha', position: 'VOL', club: 'Bayern de Munique', nationality: 'Portugal', initialPrice: 24000000, currentPrice: 24000000 },
  { id: 'p-47', name: 'Moisés Caicedo', position: 'VOL', club: 'Chelsea', nationality: 'Equador', initialPrice: 25000000, currentPrice: 25000000 },

  // Meio-Campistas Centrais / Ofensivos (MC, MEI)
  { id: 'p-48', name: 'Jude Bellingham', position: 'MEI', club: 'Real Madrid', nationality: 'Inglaterra', initialPrice: 55000000, currentPrice: 55000000 },
  { id: 'p-49', name: 'Kevin De Bruyne', position: 'MC', club: 'Manchester City', nationality: 'Bélgica', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-50', name: 'Federico Valverde', position: 'MC', club: 'Real Madrid', nationality: 'Uruguai', initialPrice: 48000000, currentPrice: 48000000 },
  { id: 'p-51', name: 'Martin Ødegaard', position: 'MEI', club: 'Arsenal', nationality: 'Noruega', initialPrice: 42000000, currentPrice: 42000000 },
  { id: 'p-52', name: 'Florian Wirtz', position: 'MEI', club: 'Bayer Leverkusen', nationality: 'Alemanha', initialPrice: 48000000, currentPrice: 48000000 },
  { id: 'p-53', name: 'Jamal Musiala', position: 'MEI', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 48000000, currentPrice: 48000000 },
  { id: 'p-54', name: 'Cole Palmer', position: 'MEI', club: 'Chelsea', nationality: 'Inglaterra', initialPrice: 44000000, currentPrice: 44000000 },
  { id: 'p-55', name: 'Nicolò Barella', position: 'MC', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-56', name: 'Pedri González', position: 'MC', club: 'Barcelona', nationality: 'Espanha', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-57', name: 'Gavi', position: 'MC', club: 'Barcelona', nationality: 'Espanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-58', name: 'Bernardo Silva', position: 'MC', club: 'Manchester City', nationality: 'Portugal', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-59', name: 'Luka Modric', position: 'MC', club: 'Real Madrid', nationality: 'Croácia', initialPrice: 18000000, currentPrice: 18000000 },
  { id: 'p-60', name: 'Alexis Mac Allister', position: 'MC', club: 'Liverpool', nationality: 'Argentina', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-61', name: 'Dominik Szoboszlai', position: 'MC', club: 'Liverpool', nationality: 'Hungria', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-62', name: 'Vitinha', position: 'MC', club: 'Paris Saint-Germain', nationality: 'Portugal', initialPrice: 29000000, currentPrice: 29000000 },
  { id: 'p-63', name: 'Dani Olmo', position: 'MEI', club: 'Barcelona', nationality: 'Espanha', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-64', name: 'Lucas Paquetá', position: 'MEI', club: 'West Ham', nationality: 'Brasil', initialPrice: 24000000, currentPrice: 24000000 },

  // Pontas Direitas (PD / MD)
  { id: 'p-65', name: 'Lamine Yamal', position: 'PD', club: 'Barcelona', nationality: 'Espanha', initialPrice: 55000000, currentPrice: 55000000 },
  { id: 'p-66', name: 'Bukayo Saka', position: 'PD', club: 'Arsenal', nationality: 'Inglaterra', initialPrice: 46000000, currentPrice: 46000000 },
  { id: 'p-67', name: 'Mohamed Salah', position: 'PD', club: 'Liverpool', nationality: 'Egito', initialPrice: 46000000, currentPrice: 46000000 },
  { id: 'p-68', name: 'Rodrygo Goes', position: 'PD', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 42000000, currentPrice: 42000000 },
  { id: 'p-69', name: 'Ousmane Dembélé', position: 'PD', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-70', name: 'Leroy Sané', position: 'PD', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-71', name: 'Raphinha', position: 'PD', club: 'Barcelona', nationality: 'Brasil', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-72', name: 'Michael Olise', position: 'PD', club: 'Bayern de Munique', nationality: 'França', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-73', name: 'Takefusa Kubo', position: 'PD', club: 'Real Sociedad', nationality: 'Japão', initialPrice: 24000000, currentPrice: 24000000 },

  // Pontas Esquerdas (PE / ME)
  { id: 'p-74', name: 'Vinícius Júnior', position: 'PE', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 60000000, currentPrice: 60000000 },
  { id: 'p-75', name: 'Kylian Mbappé', position: 'PE', club: 'Real Madrid', nationality: 'França', initialPrice: 62000000, currentPrice: 62000000 },
  { id: 'p-76', name: 'Rafael Leão', position: 'PE', club: 'Milan', nationality: 'Portugal', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-77', name: 'Khvicha Kvaratskhelia', position: 'PE', club: 'Napoli', nationality: 'Geórgia', initialPrice: 38000000, currentPrice: 38000000 },
  { id: 'p-78', name: 'Nico Williams', position: 'PE', club: 'Athletic Bilbao', nationality: 'Espanha', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-79', name: 'Luis Díaz', position: 'PE', club: 'Liverpool', nationality: 'Colômbia', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-80', name: 'Gabriel Martinelli', position: 'PE', club: 'Arsenal', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-81', name: 'Bradley Barcola', position: 'PE', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-82', name: 'Son Heung-min', position: 'PE', club: 'Tottenham', nationality: 'Coreia do Sul', initialPrice: 30000000, currentPrice: 30000000 },

  // Centroavantes / Atacantes (ATA)
  { id: 'p-83', name: 'Erling Haaland', position: 'ATA', club: 'Manchester City', nationality: 'Noruega', initialPrice: 62000000, currentPrice: 62000000 },
  { id: 'p-84', name: 'Harry Kane', position: 'ATA', club: 'Bayern de Munique', nationality: 'Inglaterra', initialPrice: 48000000, currentPrice: 48000000 },
  { id: 'p-85', name: 'Lautaro Martínez', position: 'ATA', club: 'Inter de Milão', nationality: 'Argentina', initialPrice: 44000000, currentPrice: 44000000 },
  { id: 'p-86', name: 'Robert Lewandowski', position: 'ATA', club: 'Barcelona', nationality: 'Polônia', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-87', name: 'Alexander Isak', position: 'ATA', club: 'Newcastle United', nationality: 'Suécia', initialPrice: 34000000, currentPrice: 34000000 },
  { id: 'p-88', name: 'Victor Osimhen', position: 'ATA', club: 'Galatasaray', nationality: 'Nigéria', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-89', name: 'Viktor Gyökeres', position: 'ATA', club: 'Sporting CP', nationality: 'Suécia', initialPrice: 32000000, currentPrice: 32000000 },
  { id: 'p-90', name: 'Kai Havertz', position: 'ATA', club: 'Arsenal', nationality: 'Alemanha', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-91', name: 'Julián Álvarez', position: 'ATA', club: 'Atlético de Madrid', nationality: 'Argentina', initialPrice: 36000000, currentPrice: 36000000 },
  { id: 'p-92', name: 'Ollie Watkins', position: 'ATA', club: 'Aston Villa', nationality: 'Inglaterra', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-93', name: 'Endrick Felipe', position: 'ATA', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-94', name: 'Antoine Griezmann', position: 'ATA', club: 'Atlético de Madrid', nationality: 'França', initialPrice: 28000000, currentPrice: 28000000 },
  { id: 'p-95', name: 'Marcus Rashford', position: 'ATA', club: 'Manchester United', nationality: 'Inglaterra', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-96', name: 'Dušan Vlahović', position: 'ATA', club: 'Juventus', nationality: 'Sérvia', initialPrice: 26000000, currentPrice: 26000000 },
  { id: 'p-97', name: 'Estêvão Willian', position: 'PD', club: 'Palmeiras', nationality: 'Brasil', initialPrice: 22000000, currentPrice: 22000000 },
  { id: 'p-98', name: 'Pedro Guilherme', position: 'ATA', club: 'Flamengo', nationality: 'Brasil', initialPrice: 18000000, currentPrice: 18000000 },
  { id: 'p-99', name: 'Giorgian de Arrascaeta', position: 'MEI', club: 'Flamengo', nationality: 'Uruguai', initialPrice: 17000000, currentPrice: 17000000 },
  { id: 'p-100', name: 'Raphael Veiga', position: 'MEI', club: 'Palmeiras', nationality: 'Brasil', initialPrice: 16000000, currentPrice: 16000000 }
];

export const INITIAL_FORMATIONS: TacticalFormation[] = [
  {
    id: '4-3-3',
    name: '4-3-3 Ofensivo (Padrão)',
    slots: [
      { slotId: 'gol', role: 'GOL', x: 50, y: 88 },
      { slotId: 'le', role: 'LE', x: 16, y: 70 },
      { slotId: 'zag-e', role: 'ZAG', x: 38, y: 72 },
      { slotId: 'zag-d', role: 'ZAG', x: 62, y: 72 },
      { slotId: 'ld', role: 'LD', x: 84, y: 70 },
      { slotId: 'vol', role: 'VOL', x: 50, y: 54 },
      { slotId: 'mc-e', role: 'MC', x: 32, y: 42 },
      { slotId: 'mc-d', role: 'MC', x: 68, y: 42 },
      { slotId: 'pe', role: 'PE', x: 20, y: 20 },
      { slotId: 'ata', role: 'ATA', x: 50, y: 16 },
      { slotId: 'pd', role: 'PD', x: 80, y: 20 }
    ]
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1 Moderno',
    slots: [
      { slotId: 'gol', role: 'GOL', x: 50, y: 88 },
      { slotId: 'le', role: 'LE', x: 16, y: 70 },
      { slotId: 'zag-e', role: 'ZAG', x: 38, y: 72 },
      { slotId: 'zag-d', role: 'ZAG', x: 62, y: 72 },
      { slotId: 'ld', role: 'LD', x: 84, y: 70 },
      { slotId: 'vol-e', role: 'VOL', x: 36, y: 55 },
      { slotId: 'vol-d', role: 'VOL', x: 64, y: 55 },
      { slotId: 'mei', role: 'MEI', x: 50, y: 35 },
      { slotId: 'pe', role: 'PE', x: 20, y: 32 },
      { slotId: 'pd', role: 'PD', x: 80, y: 32 },
      { slotId: 'ata', role: 'ATA', x: 50, y: 16 }
    ]
  },
  {
    id: '4-4-2',
    name: '4-4-2 Tradicional',
    slots: [
      { slotId: 'gol', role: 'GOL', x: 50, y: 88 },
      { slotId: 'le', role: 'LE', x: 16, y: 70 },
      { slotId: 'zag-e', role: 'ZAG', x: 38, y: 72 },
      { slotId: 'zag-d', role: 'ZAG', x: 62, y: 72 },
      { slotId: 'ld', role: 'LD', x: 84, y: 70 },
      { slotId: 'me', role: 'ME', x: 18, y: 46 },
      { slotId: 'mc-e', role: 'MC', x: 38, y: 48 },
      { slotId: 'mc-d', role: 'MC', x: 62, y: 48 },
      { slotId: 'md', role: 'MD', x: 82, y: 46 },
      { slotId: 'ata-e', role: 'ATA', x: 38, y: 18 },
      { slotId: 'ata-d', role: 'ATA', x: 62, y: 18 }
    ]
  },
  {
    id: '3-5-2',
    name: '3-5-2 Ala & Meio Povoado',
    slots: [
      { slotId: 'gol', role: 'GOL', x: 50, y: 88 },
      { slotId: 'zag-e', role: 'ZAG', x: 26, y: 72 },
      { slotId: 'zag-c', role: 'ZAG', x: 50, y: 74 },
      { slotId: 'zag-d', role: 'ZAG', x: 74, y: 72 },
      { slotId: 'ala-e', role: 'LE', x: 14, y: 46 },
      { slotId: 'vol-e', role: 'VOL', x: 36, y: 52 },
      { slotId: 'vol-d', role: 'VOL', x: 64, y: 52 },
      { slotId: 'ala-d', role: 'LD', x: 86, y: 46 },
      { slotId: 'mei', role: 'MEI', x: 50, y: 35 },
      { slotId: 'ata-e', role: 'ATA', x: 38, y: 18 },
      { slotId: 'ata-d', role: 'ATA', x: 62, y: 18 }
    ]
  },
  {
    id: '5-3-2',
    name: '5-3-2 Solidez Defensiva',
    slots: [
      { slotId: 'gol', role: 'GOL', x: 50, y: 88 },
      { slotId: 'le', role: 'LE', x: 14, y: 66 },
      { slotId: 'zag-1', role: 'ZAG', x: 32, y: 72 },
      { slotId: 'zag-2', role: 'ZAG', x: 50, y: 74 },
      { slotId: 'zag-3', role: 'ZAG', x: 68, y: 72 },
      { slotId: 'ld', role: 'LD', x: 86, y: 66 },
      { slotId: 'mc-1', role: 'MC', x: 30, y: 45 },
      { slotId: 'vol', role: 'VOL', x: 50, y: 50 },
      { slotId: 'mc-2', role: 'MC', x: 70, y: 45 },
      { slotId: 'ata-1', role: 'ATA', x: 38, y: 18 },
      { slotId: 'ata-2', role: 'ATA', x: 62, y: 18 }
    ]
  }
];
