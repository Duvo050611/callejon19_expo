export const WORDS = [
  'TIBURON','GORILA','CONEJO','CAMELLO','DELFIN',
  'CANGURO','PALOMA','AGUILA','CIERVO','ABEJA',
  'PULPO','IGUANA','FLAMENCO','CASTOR','ORUGA',
  'LOMBRIZ','MURCIELAGO','JIRAFA','CEBRA','LEOPARDO',
  'TIGRE','LINCE','HALCON','KOALA','NUTRIA',
];

export function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
