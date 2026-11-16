# COLOMBIA FORCE · Historial de Guerras

Archivo público de guerras de la alianza **COLOMBIA FORCE** con 800+ enfrentamientos registrados, métricas actualizadas, gráfica mensual/anual de victorias y derrotas, filtros por rival/resultado/tamaño y actualización automática diaria desde DomiStats.

## Publicar gratis en GitHub Pages (enlace público)

1. Crea un repositorio **público** en GitHub (por ejemplo `colombia-force-guerras`).
2. Sube todos los archivos del proyecto a la rama `main`.
3. En tu repositorio de GitHub ve a **Settings → Actions → General → Workflow permissions**, selecciona **Read and write permissions** y guarda (**Save**).
4. Ve a **Settings → Pages**, en **Source** elige **GitHub Actions**.
5. Ve a la pestaña **Actions**, abre **Refresh and Deploy Colombia Force Archive** y haz clic en **Run workflow** (o se ejecutará automáticamente al subir los archivos).
6. Al terminar el flujo, GitHub te mostrará tu enlace público con formato:
   `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`

## Actualización automática diaria

El flujo `.github/workflows/update-wars.yml` se ejecuta todos los días a las **08:00 a. m. y 06:00 p. m. hora Colombia** (`13:00 UTC` y `23:00 UTC`), consulta `https://domistats.com/alliance_wars/68105?page=1` y `https://domistats.com/alliance/68105` mediante `scripts/update_wars.py`, actualiza `data/wars.json`, vuelve a compilar el sitio y republica la página automáticamente.
