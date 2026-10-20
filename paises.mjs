// País de un teléfono según su prefijo internacional. Gana el prefijo más largo que coincida
// (por eso +1809 da Rep. Dominicana y no EE.UU./Canadá).
const PREFIJOS = {
  // +1 lo comparten Estados Unidos, Canadá y parte del Caribe: se separan por el código de área.
  1: 'Estados Unidos',
  1242: 'Bahamas', 1246: 'Barbados', 1264: 'Anguila', 1268: 'Antigua y Barbuda',
  1284: 'Islas Vírgenes Británicas', 1340: 'Islas Vírgenes de EE.UU.', 1345: 'Islas Caimán',
  1441: 'Bermudas', 1473: 'Granada', 1649: 'Turcas y Caicos', 1664: 'Montserrat',
  1721: 'Sint Maarten', 1758: 'Santa Lucía', 1767: 'Dominica', 1784: 'San Vicente y las Granadinas',
  1787: 'Puerto Rico', 1939: 'Puerto Rico', 1809: 'Rep. Dominicana', 1829: 'Rep. Dominicana',
  1849: 'Rep. Dominicana', 1868: 'Trinidad y Tobago', 1869: 'San Cristóbal y Nieves', 1876: 'Jamaica',

  7: 'Rusia/Kazajistán', 20: 'Egipto', 27: 'Sudáfrica', 30: 'Grecia', 31: 'Países Bajos',
  32: 'Bélgica', 33: 'Francia', 34: 'España', 36: 'Hungría', 39: 'Italia', 40: 'Rumania',
  41: 'Suiza', 43: 'Austria', 44: 'Reino Unido', 45: 'Dinamarca', 46: 'Suecia', 47: 'Noruega',
  48: 'Polonia', 49: 'Alemania', 51: 'Perú', 52: 'México', 53: 'Cuba', 54: 'Argentina',
  55: 'Brasil', 56: 'Chile', 57: 'Colombia', 58: 'Venezuela', 60: 'Malasia', 61: 'Australia',
  62: 'Indonesia', 63: 'Filipinas', 64: 'Nueva Zelanda', 65: 'Singapur', 66: 'Tailandia',
  81: 'Japón', 82: 'Corea del Sur', 84: 'Vietnam', 86: 'China', 90: 'Turquía', 91: 'India',
  92: 'Pakistán', 93: 'Afganistán', 94: 'Sri Lanka', 95: 'Myanmar', 98: 'Irán',

  211: 'Sudán del Sur', 212: 'Marruecos', 213: 'Argelia', 216: 'Túnez', 218: 'Libia',
  220: 'Gambia', 221: 'Senegal', 222: 'Mauritania', 223: 'Malí', 224: 'Guinea',
  225: 'Costa de Marfil', 226: 'Burkina Faso', 227: 'Níger', 228: 'Togo', 229: 'Benín',
  230: 'Mauricio', 231: 'Liberia', 232: 'Sierra Leona', 233: 'Ghana', 234: 'Nigeria', 235: 'Chad',
  236: 'Rep. Centroafricana', 237: 'Camerún', 238: 'Cabo Verde', 239: 'Santo Tomé y Príncipe',
  240: 'Guinea Ecuatorial', 241: 'Gabón', 242: 'Congo', 243: 'RD del Congo', 244: 'Angola',
  245: 'Guinea-Bisáu', 248: 'Seychelles', 249: 'Sudán', 250: 'Ruanda', 251: 'Etiopía',
  252: 'Somalia', 253: 'Yibuti', 254: 'Kenia', 255: 'Tanzania', 256: 'Uganda', 257: 'Burundi',
  258: 'Mozambique', 260: 'Zambia', 261: 'Madagascar', 262: 'Reunión', 263: 'Zimbabue',
  264: 'Namibia', 265: 'Malaui', 266: 'Lesoto', 267: 'Botsuana', 268: 'Esuatini', 269: 'Comoras',
  297: 'Aruba', 298: 'Islas Feroe', 299: 'Groenlandia',

  350: 'Gibraltar', 351: 'Portugal', 352: 'Luxemburgo', 353: 'Irlanda', 354: 'Islandia',
  355: 'Albania', 356: 'Malta', 357: 'Chipre', 358: 'Finlandia', 359: 'Bulgaria', 370: 'Lituania',
  371: 'Letonia', 372: 'Estonia', 373: 'Moldavia', 374: 'Armenia', 375: 'Bielorrusia',
  376: 'Andorra', 377: 'Mónaco', 378: 'San Marino', 380: 'Ucrania', 381: 'Serbia',
  382: 'Montenegro', 383: 'Kosovo', 385: 'Croacia', 386: 'Eslovenia', 387: 'Bosnia y Herzegovina',
  389: 'Macedonia del Norte', 420: 'Chequia', 421: 'Eslovaquia', 423: 'Liechtenstein',

  501: 'Belice', 502: 'Guatemala', 503: 'El Salvador', 504: 'Honduras', 505: 'Nicaragua',
  506: 'Costa Rica', 507: 'Panamá', 509: 'Haití', 590: 'Guadalupe', 591: 'Bolivia', 592: 'Guyana',
  593: 'Ecuador', 594: 'Guayana Francesa', 595: 'Paraguay', 596: 'Martinica', 597: 'Surinam',
  598: 'Uruguay', 599: 'Curazao',

  670: 'Timor Oriental', 673: 'Brunéi', 675: 'Papúa Nueva Guinea', 679: 'Fiyi', 852: 'Hong Kong',
  853: 'Macao', 855: 'Camboya', 856: 'Laos', 880: 'Bangladés', 886: 'Taiwán', 960: 'Maldivas',
  961: 'Líbano', 962: 'Jordania', 963: 'Siria', 964: 'Irak', 965: 'Kuwait', 966: 'Arabia Saudita',
  967: 'Yemen', 968: 'Omán', 970: 'Palestina', 971: 'Emiratos Árabes', 972: 'Israel',
  973: 'Baréin', 974: 'Catar', 975: 'Bután', 976: 'Mongolia', 977: 'Nepal', 992: 'Tayikistán',
  993: 'Turkmenistán', 994: 'Azerbaiyán', 995: 'Georgia', 996: 'Kirguistán', 998: 'Uzbekistán',
};

// Códigos de área de Canadá dentro del +1.
const AREAS_DE_CANADA = new Set([
  204, 226, 236, 249, 250, 257, 263, 289, 306, 343, 354, 365, 367, 368, 382, 403, 416, 418, 428,
  431, 437, 438, 450, 468, 474, 506, 514, 519, 548, 579, 581, 584, 587, 604, 613, 639, 647, 672,
  683, 705, 709, 742, 753, 778, 780, 782, 807, 819, 825, 867, 873, 879, 902, 905,
]);

// Un teléfono válido siempre tiene país; si el prefijo no está en la tabla queda como "Otro"
// para que la columna no tenga huecos. Sin teléfono no hay país.
export function paisDeTelefono(telefono) {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos[0] === '1' && AREAS_DE_CANADA.has(Number(digitos.slice(1, 4)))) return 'Canadá';
  for (let largo = 4; largo >= 1; largo--) {
    const pais = PREFIJOS[digitos.slice(0, largo)];
    if (pais) return pais;
  }
  return 'Otro';
}
