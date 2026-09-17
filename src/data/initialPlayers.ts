import { Player, TacticalFormation } from '../types';

export const INITIAL_PLAYERS: Omit<Player, 'status'>[] = [
  // GOLEIROS (GOL) - 14 atletas
  { id: 'p-1', name: 'Gianluigi Donnarumma', position: 'GOL', club: 'Paris Saint-Germain', nationality: 'Itália', initialPrice: 40000000, currentPrice: 40000000 },
  { id: 'p-2', name: 'Thibaut Courtois', position: 'GOL', club: 'Real Madrid', nationality: 'Bélgica', initialPrice: 40000000, currentPrice: 40000000 },
  { id: 'p-3', name: 'David Raya', position: 'GOL', club: 'Arsenal', nationality: 'Espanha', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-4', name: 'Jan Oblak', position: 'GOL', club: 'Atlético de Madrid', nationality: 'Eslovênia', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-5', name: 'Alisson', position: 'GOL', club: 'Liverpool', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-6', name: 'Diogo Costa', position: 'GOL', club: 'Porto', nationality: 'Portugal', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-7', name: 'Gregor Kobel', position: 'GOL', club: 'Borussia Dortmund', nationality: 'Suíça', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-8', name: 'Joan García', position: 'GOL', club: 'Espanyol', nationality: 'Espanha', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-9', name: 'Marco Carnesecchi', position: 'GOL', club: 'Atalanta', nationality: 'Itália', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-10', name: 'Mike Maignan', position: 'GOL', club: 'Milan', nationality: 'França', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-11', name: 'Manuel Neuer', position: 'GOL', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-12', name: 'Jordan Pickford', position: 'GOL', club: 'Everton', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-13', name: 'Emiliano Martínez', position: 'GOL', club: 'Aston Villa', nationality: 'Argentina', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-14', name: 'Unai Simón', position: 'GOL', club: 'Athletic Bilbao', nationality: 'Espanha', initialPrice: 25000000, currentPrice: 25000000 },

  // ZAGUEIROS (ZAG) - 22 atletas
  { id: 'p-15', name: 'Gabriel', position: 'ZAG', club: 'Arsenal', nationality: 'Brasil', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-16', name: 'Willian Pacho', position: 'ZAG', club: 'Paris Saint-Germain', nationality: 'Equador', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-17', name: 'Virgil van Dijk', position: 'ZAG', club: 'Liverpool', nationality: 'Holanda', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-18', name: 'William Saliba', position: 'ZAG', club: 'Arsenal', nationality: 'França', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-19', name: 'Dayot Upamecano', position: 'ZAG', club: 'Bayern de Munique', nationality: 'França', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-20', name: 'Jonathan Tah', position: 'ZAG', club: 'Bayer Leverkusen', nationality: 'Alemanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-21', name: 'Marquinhos', position: 'ZAG', club: 'Paris Saint-Germain', nationality: 'Brasil', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-22', name: 'Nico Schlotterbeck', position: 'ZAG', club: 'Borussia Dortmund', nationality: 'Alemanha', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-23', name: 'Rúben Dias', position: 'ZAG', club: 'Manchester City', nationality: 'Portugal', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-24', name: 'Alessandro Bastoni', position: 'ZAG', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-25', name: 'Bremer', position: 'ZAG', club: 'Juventus', nationality: 'Brasil', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-26', name: 'Pau Cubarsí', position: 'ZAG', club: 'Barcelona', nationality: 'Espanha', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-27', name: 'Ibrahima Konaté', position: 'ZAG', club: 'Liverpool', nationality: 'França', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-28', name: 'Antonio Rüdiger', position: 'ZAG', club: 'Real Madrid', nationality: 'Alemanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-29', name: 'Lucas Hernández', position: 'ZAG', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-30', name: 'Riccardo Calafiori', position: 'ZAG', club: 'Arsenal', nationality: 'Itália', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-31', name: 'Éder Militão', position: 'ZAG', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-32', name: 'Joško Gvardiol', position: 'ZAG', club: 'Manchester City', nationality: 'Croácia', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-33', name: 'Eric García', position: 'ZAG', club: 'Barcelona', nationality: 'Espanha', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-34', name: 'Marc Guéhi', position: 'ZAG', club: 'Crystal Palace', nationality: 'Inglaterra', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-35', name: 'Ousmane Diomandé', position: 'ZAG', club: 'Sporting CP', nationality: 'Costa do Marfim', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-36', name: 'Ezri Konsa', position: 'ZAG', club: 'Aston Villa', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },

  // LATERAIS-ESQUERDOS (LE) - 5 atletas
  { id: 'p-37', name: 'Nuno Mendes', position: 'LE', club: 'Paris Saint-Germain', nationality: 'Portugal', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-38', name: 'Federico Dimarco', position: 'LE', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-39', name: 'Marc Cucurella', position: 'LE', club: 'Chelsea', nationality: 'Espanha', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-40', name: 'Alphonso Davies', position: 'LE', club: 'Bayern de Munique', nationality: 'Canadá', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-41', name: 'Alejandro Grimaldo', position: 'LE', club: 'Bayer Leverkusen', nationality: 'Espanha', initialPrice: 25000000, currentPrice: 25000000 },

  // LATERAIS-DIREITOS (LD) - 6 atletas
  { id: 'p-42', name: 'Achraf Hakimi', position: 'LD', club: 'Paris Saint-Germain', nationality: 'Marrocos', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-43', name: 'Jules Koundé', position: 'LD', club: 'Barcelona', nationality: 'França', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-44', name: 'Reece James', position: 'LD', club: 'Chelsea', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-45', name: 'Trent Alexander-Arnold', position: 'LD', club: 'Liverpool', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-46', name: 'Rico Lewis', position: 'LD', club: 'Manchester City', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-47', name: 'Marcos Llorente', position: 'LD', club: 'Atlético de Madrid', nationality: 'Espanha', initialPrice: 25000000, currentPrice: 25000000 },

  // VOLANTES (VOL) - 12 atletas
  { id: 'p-48', name: 'Rodri', position: 'VOL', club: 'Manchester City', nationality: 'Espanha', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-49', name: 'Declan Rice', position: 'VOL', club: 'Arsenal', nationality: 'Inglaterra', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-50', name: 'Joshua Kimmich', position: 'VOL', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 55000000, currentPrice: 55000000 },
  { id: 'p-51', name: 'Moisés Caicedo', position: 'VOL', club: 'Chelsea', nationality: 'Equador', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-52', name: 'Aurélien Tchouaméni', position: 'VOL', club: 'Real Madrid', nationality: 'França', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-53', name: 'Youssouf Fofana', position: 'VOL', club: 'Milan', nationality: 'França', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-54', name: 'Ryan Gravenberch', position: 'VOL', club: 'Liverpool', nationality: 'Holanda', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-55', name: 'Konrad Laimer', position: 'VOL', club: 'Bayern de Munique', nationality: 'Áustria', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-56', name: 'Hakan Çalhanoğlu', position: 'VOL', club: 'Inter de Milão', nationality: 'Turquia', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-57', name: 'Rúben Neves', position: 'VOL', club: 'Al-Hilal', nationality: 'Portugal', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-58', name: 'Granit Xhaka', position: 'VOL', club: 'Bayer Leverkusen', nationality: 'Suíça', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-59', name: 'Martín Zubimendi', position: 'VOL', club: 'Real Sociedad', nationality: 'Espanha', initialPrice: 15000000, currentPrice: 15000000 },

  // MEIO-CAMPISTAS (MC) - 24 atletas
  { id: 'p-60', name: 'Pedri', position: 'MC', club: 'Barcelona', nationality: 'Espanha', initialPrice: 60000000, currentPrice: 60000000 },
  { id: 'p-61', name: 'Vitinha', position: 'MC', club: 'Paris Saint-Germain', nationality: 'Portugal', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-62', name: 'João Neves', position: 'MC', club: 'Paris Saint-Germain', nationality: 'Portugal', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-63', name: 'Federico Valverde', position: 'MC', club: 'Real Madrid', nationality: 'Uruguai', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-64', name: 'Nicolò Barella', position: 'MC', club: 'Inter de Milão', nationality: 'Itália', initialPrice: 40000000, currentPrice: 40000000 },
  { id: 'p-65', name: 'Bruno Guimarães', position: 'MC', club: 'Newcastle United', nationality: 'Brasil', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-66', name: 'Enzo Fernández', position: 'MC', club: 'Chelsea', nationality: 'Argentina', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-67', name: 'Fabián Ruiz', position: 'MC', club: 'Paris Saint-Germain', nationality: 'Espanha', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-68', name: 'Frenkie de Jong', position: 'MC', club: 'Barcelona', nationality: 'Holanda', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-69', name: 'Martin Ødegaard', position: 'MC', club: 'Arsenal', nationality: 'Noruega', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-70', name: 'Scott McTominay', position: 'MC', club: 'Napoli', nationality: 'Escócia', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-71', name: 'Alexis Mac Allister', position: 'MC', club: 'Liverpool', nationality: 'Argentina', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-72', name: 'Bernardo Silva', position: 'MC', club: 'Manchester City', nationality: 'Portugal', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-73', name: 'Warren Zaïre-Emery', position: 'MC', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-74', name: 'Eduardo Camavinga', position: 'MC', club: 'Real Madrid', nationality: 'França', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-75', name: 'Gavi', position: 'MC', club: 'Barcelona', nationality: 'Espanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-76', name: 'Fermín López', position: 'MC', club: 'Barcelona', nationality: 'Espanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-77', name: 'Kobbie Mainoo', position: 'MC', club: 'Manchester United', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-78', name: 'Mikel Merino', position: 'MC', club: 'Arsenal', nationality: 'Espanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-79', name: 'Youri Tielemans', position: 'MC', club: 'Aston Villa', nationality: 'Bélgica', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-80', name: 'Adrien Rabiot', position: 'MC', club: 'Marseille', nationality: 'França', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-81', name: 'Felix Nmecha', position: 'MC', club: 'Borussia Dortmund', nationality: 'Alemanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-82', name: 'Sandro Tonali', position: 'MC', club: 'Newcastle United', nationality: 'Itália', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-83', name: 'Luka Modrić', position: 'MC', club: 'Real Madrid', nationality: 'Croácia', initialPrice: 20000000, currentPrice: 20000000 },

  // MEIAS-ATACANTES (MEI) - 15 atletas
  { id: 'p-84', name: 'Jude Bellingham', position: 'MEI', club: 'Real Madrid', nationality: 'Inglaterra', initialPrice: 70000000, currentPrice: 70000000 },
  { id: 'p-85', name: 'Lionel Messi', position: 'MEI', club: 'Inter Miami', nationality: 'Argentina', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-86', name: 'Bruno Fernandes', position: 'MEI', club: 'Manchester United', nationality: 'Portugal', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-87', name: 'Jamal Musiala', position: 'MEI', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 60000000, currentPrice: 60000000 },
  { id: 'p-88', name: 'Dominik Szoboszlai', position: 'MEI', club: 'Liverpool', nationality: 'Hungria', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-89', name: 'Florian Wirtz', position: 'MEI', club: 'Bayer Leverkusen', nationality: 'Alemanha', initialPrice: 60000000, currentPrice: 60000000 },
  { id: 'p-90', name: 'Cole Palmer', position: 'MEI', club: 'Chelsea', nationality: 'Inglaterra', initialPrice: 60000000, currentPrice: 60000000 },
  { id: 'p-91', name: 'Kevin De Bruyne', position: 'MEI', club: 'Manchester City', nationality: 'Bélgica', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-92', name: 'Phil Foden', position: 'MEI', club: 'Manchester City', nationality: 'Inglaterra', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-93', name: 'Arda Güler', position: 'MEI', club: 'Real Madrid', nationality: 'Turquia', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-94', name: 'Julian Brandt', position: 'MEI', club: 'Borussia Dortmund', nationality: 'Alemanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-95', name: 'Paulo Dybala', position: 'MEI', club: 'Roma', nationality: 'Argentina', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-96', name: 'Morgan Rogers', position: 'MEI', club: 'Aston Villa', nationality: 'Inglaterra', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-97', name: 'Nico Paz', position: 'MEI', club: 'Como', nationality: 'Argentina', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-98', name: 'Eberechi Eze', position: 'MEI', club: 'Crystal Palace', nationality: 'Inglaterra', initialPrice: 20000000, currentPrice: 20000000 },

  // MEIAS-ESQUERDA (ME) - 2 atletas
  { id: 'p-99', name: 'Luis Díaz', position: 'ME', club: 'Liverpool', nationality: 'Colômbia', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-100', name: 'Jack Grealish', position: 'ME', club: 'Manchester City', nationality: 'Inglaterra', initialPrice: 15000000, currentPrice: 15000000 },

  // MEIAS-DIREITA (MD) - 2 atletas
  { id: 'p-101', name: 'Michael Olise', position: 'MD', club: 'Bayern de Munique', nationality: 'França', initialPrice: 70000000, currentPrice: 70000000 },
  { id: 'p-102', name: 'Mohamed Salah', position: 'MD', club: 'Liverpool', nationality: 'Egito', initialPrice: 40000000, currentPrice: 40000000 },

  // PONTAS-ESQUERDA (PE) - 8 atletas
  { id: 'p-103', name: 'Khvicha Kvaratskhelia', position: 'PE', club: 'Napoli', nationality: 'Geórgia', initialPrice: 70000000, currentPrice: 70000000 },
  { id: 'p-104', name: 'Vini Jr.', position: 'PE', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 80000000, currentPrice: 80000000 },
  { id: 'p-105', name: 'Bradley Barcola', position: 'PE', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 50000000, currentPrice: 50000000 },
  { id: 'p-106', name: 'Nico Williams', position: 'PE', club: 'Athletic Bilbao', nationality: 'Espanha', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-107', name: 'Gabriel Martinelli', position: 'PE', club: 'Arsenal', nationality: 'Brasil', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-108', name: 'Marcus Rashford', position: 'PE', club: 'Manchester United', nationality: 'Inglaterra', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-109', name: 'Raphinha', position: 'PE', club: 'Barcelona', nationality: 'Brasil', initialPrice: 80000000, currentPrice: 80000000 },
  { id: 'p-110', name: 'Jérémy Doku', position: 'PE', club: 'Manchester City', nationality: 'Bélgica', initialPrice: 25000000, currentPrice: 25000000 },

  // PONTAS-DIREITA (PD) - 9 atletas
  { id: 'p-111', name: 'Bukayo Saka', position: 'PD', club: 'Arsenal', nationality: 'Inglaterra', initialPrice: 55000000, currentPrice: 55000000 },
  { id: 'p-112', name: 'Désiré Doué', position: 'PD', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 40000000, currentPrice: 40000000 },
  { id: 'p-113', name: 'Rayan Cherki', position: 'PD', club: 'Lyon', nationality: 'França', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-114', name: 'Rodrygo', position: 'PD', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-115', name: 'Bryan Mbeumo', position: 'PD', club: 'Brentford', nationality: 'Camarões', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-116', name: 'Leroy Sané', position: 'PD', club: 'Bayern de Munique', nationality: 'Alemanha', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-117', name: 'Pedro Neto', position: 'PD', club: 'Chelsea', nationality: 'Portugal', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-118', name: 'Estêvão', position: 'PD', club: 'Palmeiras', nationality: 'Brasil', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-119', name: 'Lamine Yamal', position: 'PD', club: 'Barcelona', nationality: 'Espanha', initialPrice: 95000000, currentPrice: 95000000 },

  // ATACANTES (ATA) - 24 atletas
  { id: 'p-120', name: 'Erling Haaland', position: 'ATA', club: 'Manchester City', nationality: 'Noruega', initialPrice: 95000000, currentPrice: 95000000 },
  { id: 'p-121', name: 'Kylian Mbappé', position: 'ATA', club: 'Real Madrid', nationality: 'França', initialPrice: 95000000, currentPrice: 95000000 },
  { id: 'p-122', name: 'Harry Kane', position: 'ATA', club: 'Bayern de Munique', nationality: 'Inglaterra', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-123', name: 'Ousmane Dembélé', position: 'ATA', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 65000000, currentPrice: 65000000 },
  { id: 'p-124', name: 'Lautaro Martínez', position: 'ATA', club: 'Inter de Milão', nationality: 'Argentina', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-125', name: 'Alexander Isak', position: 'ATA', club: 'Newcastle United', nationality: 'Suécia', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-126', name: 'Julián Álvarez', position: 'ATA', club: 'Atlético de Madrid', nationality: 'Argentina', initialPrice: 45000000, currentPrice: 45000000 },
  { id: 'p-127', name: 'Viktor Gyökeres', position: 'ATA', club: 'Sporting CP', nationality: 'Suécia', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-128', name: 'Robert Lewandowski', position: 'ATA', club: 'Barcelona', nationality: 'Polônia', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-129', name: 'Victor Osimhen', position: 'ATA', club: 'Galatasaray', nationality: 'Nigéria', initialPrice: 35000000, currentPrice: 35000000 },
  { id: 'p-130', name: 'Ferran Torres', position: 'ATA', club: 'Barcelona', nationality: 'Espanha', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-131', name: 'Jonathan David', position: 'ATA', club: 'Lille', nationality: 'Canadá', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-132', name: 'Kai Havertz', position: 'ATA', club: 'Arsenal', nationality: 'Alemanha', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-133', name: 'Serhou Guirassy', position: 'ATA', club: 'Borussia Dortmund', nationality: 'Guiné', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-134', name: 'João Pedro', position: 'ATA', club: 'Brighton', nationality: 'Brasil', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-135', name: 'Endrick', position: 'ATA', club: 'Real Madrid', nationality: 'Brasil', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-136', name: 'Nicolas Jackson', position: 'ATA', club: 'Chelsea', nationality: 'Senegal', initialPrice: 12000000, currentPrice: 12000000 },
  { id: 'p-137', name: 'Randal Kolo Muani', position: 'ATA', club: 'Paris Saint-Germain', nationality: 'França', initialPrice: 12000000, currentPrice: 12000000 },
  { id: 'p-138', name: 'Marcus Thuram', position: 'ATA', club: 'Inter de Milão', nationality: 'França', initialPrice: 20000000, currentPrice: 20000000 },
  { id: 'p-139', name: 'Hugo Ekitike', position: 'ATA', club: 'Eintracht Frankfurt', nationality: 'França', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-140', name: 'Deniz Undav', position: 'ATA', club: 'Stuttgart', nationality: 'Alemanha', initialPrice: 30000000, currentPrice: 30000000 },
  { id: 'p-141', name: 'Quiñones', position: 'ATA', club: 'Al-Qadsiah', nationality: 'México', initialPrice: 15000000, currentPrice: 15000000 },
  { id: 'p-142', name: 'Cristiano Ronaldo', position: 'ATA', club: 'Al-Nassr', nationality: 'Portugal', initialPrice: 25000000, currentPrice: 25000000 },
  { id: 'p-143', name: 'Matheus Cunha', position: 'ATA', club: 'Wolverhampton', nationality: 'Brasil', initialPrice: 25000000, currentPrice: 25000000 }
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
