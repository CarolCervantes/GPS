// Copia la web (pages, assets, src) dentro de la app Android para que las dos sean iguales.
// Uso: npm run android:sync   (hay que correrlo cada vez que se cambie algo de la web)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'android-studio-app', 'app', 'src', 'main', 'assets');

// Lo que se copia a la app
const carpetas = ['pages', 'assets', 'src'];
const archivos = ['manifest.webmanifest'];

// El APK no va dentro de la misma app (seria copiarla dentro de si misma)
const excluir = new Set([path.join('assets', 'DiaMon-GPS.apk')]);

function copiar(origen, dest, relativo) {
  if (excluir.has(relativo)) return 0;
  const info = fs.statSync(origen);
  if (info.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    return fs.readdirSync(origen).reduce((total, nombre) =>
      total + copiar(path.join(origen, nombre), path.join(dest, nombre), path.join(relativo, nombre)), 0);
  }
  fs.copyFileSync(origen, dest);
  return 1;
}

// Se borra la copia vieja para que no queden archivos que ya no existen en la web
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

let total = 0;
for (const c of carpetas) total += copiar(path.join(raiz, c), path.join(destino, c), c);
for (const a of archivos) total += copiar(path.join(raiz, a), path.join(destino, a), a);

console.log(`Listo: ${total} archivos copiados a la app Android.`);
