"""Graba el recorrido demostrativo de Flujo Caja (FC-HUB) por perfil, SOLO contra el
entorno local de demo (frontend http://localhost:5180 -> backend 8010 con SQLite).

Cada segmento (intro, perfiles, cierre) se graba como .webm con Playwright y con
subtítulos en español incrustados en pantalla. Luego ensamblar_video.py los une en MP4.

Uso: python -I grabar_demo.py <carpeta video-demo>
"""
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
APP = "http://localhost:5180"
DB = ROOT / "runtime" / "demo.sqlite"
SEG_DIR = ROOT / "runtime" / "segmentos"
SEG_DIR.mkdir(parents=True, exist_ok=True)
DATA = ROOT / "datos-prueba"
W, H = 1600, 900
STRIP = 6  # franja inferior (se recorta al montar) con el número de subtítulo codificado en 8 bits
PASSWORD = "DemoFlujo2026!"
ADMIN_EMAIL = "lmonroy@tema.com.pe"
ADMIN_PASSWORD = "12345678"

assert "localhost" in APP or "127.0.0.1" in APP, "Solo se permite grabar contra el entorno local"

OVERLAY_JS = r"""
(() => {
  const install = () => {
    if (document.getElementById('__demo_cap')) return;
    const st = document.createElement('style');
    st.textContent = `
      #__demo_cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;
        max-width:1250px;padding:14px 26px;border-radius:16px;background:rgba(8,12,20,.86);color:#fff;
        font:500 23px/1.4 'Segoe UI',Arial,sans-serif;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.15);transition:opacity .3s;pointer-events:none}
      #__demo_cap:empty{opacity:0}
      #__demo_tag{position:fixed;right:18px;bottom:104px;z-index:2147483647;padding:6px 14px;border-radius:999px;
        background:#a40f22;color:#fff;font:600 14px 'Segoe UI',Arial,sans-serif;letter-spacing:.06em;
        text-transform:uppercase;pointer-events:none;box-shadow:0 6px 18px rgba(164,15,34,.35)}
      #__demo_tag:empty{display:none}
      #__demo_code{position:fixed;left:0;bottom:0;height:6px;width:100%;background:#000;z-index:2147483647;
        display:flex;pointer-events:none}
      #__demo_code i{width:40px;height:6px;margin-right:40px;background:#000}
      #__demo_code i.on{background:#fff}
      #__demo_cur{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(255,200,0,.55);border:2px solid #fff;z-index:2147483647;pointer-events:none;
        transition:transform .12s;left:-50px;top:-50px;box-shadow:0 0 0 3px rgba(0,0,0,.25)}
      #__demo_cur.down{transform:scale(.7);background:rgba(255,120,0,.85)}`;
    document.head.appendChild(st);
    const cap = document.createElement('div'); cap.id = '__demo_cap';
    const tag = document.createElement('div'); tag.id = '__demo_tag';
    const cur = document.createElement('div'); cur.id = '__demo_cur';
    const code = document.createElement('div'); code.id = '__demo_code';
    for (let b = 0; b < 8; b++) code.appendChild(document.createElement('i'));
    document.body.append(cap, tag, cur, code);
    cap.textContent = ss.getItem('__cap') || '';
    tag.textContent = ss.getItem('__tag') || '';
    let ss; try { ss = window.sessionStorage; } catch (e) { ss = {getItem: () => null, setItem: () => {}}; }
    const p = JSON.parse(ss.getItem('__cur') || '[-50,-50]');
    cur.style.left = p[0] + 'px'; cur.style.top = p[1] + 'px';
    addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px';
      try { sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY])); } catch (_) {} }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  };
  window.__demo_code = (n) => {
    install();
    document.querySelectorAll('#__demo_code i').forEach((el, b) => el.classList.toggle('on', ((n >> b) & 1) === 1));
  };
  window.__demo = (cap, tag) => {
    install();
    if (cap !== null) { try { sessionStorage.setItem('__cap', cap); } catch (_) {} document.getElementById('__demo_cap').textContent = cap; }
    if (tag !== null) { try { sessionStorage.setItem('__tag', tag); } catch (_) {} document.getElementById('__demo_tag').textContent = tag; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
"""

CARD_CSS = """
body{margin:0;width:1600px;height:900px;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 20% 20%,#1b2b42,#081019 60%);font-family:'Segoe UI',Arial,sans-serif;color:#fff}
.box{width:1250px}
.k{color:#ff8a98;letter-spacing:.35em;text-transform:uppercase;font-size:20px;font-weight:600}
h1{font-size:68px;margin:18px 0 10px;font-family:Georgia,serif;font-weight:500}
.s{font-size:28px;color:rgba(255,255,255,.75);line-height:1.5}
ul{margin:34px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:16px}
li{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px 22px;font-size:22px;line-height:1.45}
li b{color:#7ff0c8;display:block;font-size:24px;margin-bottom:4px}
.bar{height:6px;width:140px;background:#a40f22;border-radius:6px;margin-top:26px}
"""

captions = []  # (segmento, t_inicio, texto, audio_mp3 | None)

AUDIO_DIR = ROOT / "runtime" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
VOICE = "es-PE-CamilaNeural"
FF = imageio_ffmpeg.get_ffmpeg_exe()
SPOKEN = [  # cómo debe leerse en voz alta lo que en pantalla va abreviado
    ("«", ""), ("»", ""), ("→", " a "), ("USD a PEN", "dólares a soles"), ("(2FA)", ""),
    ("2FA", "doble autenticación"), ("OTP", "O T P"), ("FC-HUB", "F C Hub"), ("·", ","),
    ("OC-26-1617", "O C 26 16 17"), ("API", "A P I"),
]


def spoken(text):
    for a, b in SPOKEN:
        text = text.replace(a, b)
    return re.sub(r"\s+", " ", text).strip()


def audio_duration(path):
    err = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    h, m, sec = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
    return int(h) * 3600 + int(m) * 60 + float(sec)


def tts(text):
    """Genera (con caché) la locución de un texto. Devuelve (ruta_mp3, duración_s)."""
    text = spoken(text)
    path = AUDIO_DIR / (hashlib.sha1(f"{VOICE}|{text}".encode()).hexdigest()[:16] + ".mp3")
    if not path.exists():
        # en subproceso: Playwright (API síncrona) ya ocupa el bucle asyncio de este proceso
        subprocess.run([sys.executable, "-I", "-m", "edge_tts", "--voice", VOICE, "--rate=+5%",
                        "--text", text, "--write-media", str(path)], check=True, capture_output=True)
    return path, audio_duration(path)


class Rec:
    def __init__(self, browser, name):
        self.name = name
        self.ctx = browser.new_context(
            viewport={"width": W, "height": H + STRIP},
            record_video_dir=str(SEG_DIR / name),
            record_video_size={"width": W, "height": H + STRIP},
            accept_downloads=True,
            locale="es-PE",
        )
        self.ctx.add_init_script(OVERLAY_JS)
        self.t0 = time.time()
        self.page = self.ctx.new_page()
        self.mouse = [W / 2, H / 2]
        self.audio_free_at = 0.0
        self.code = 0

    def mark(self):
        """Muestra en la franja el número del subtítulo actual (para sincronizar el audio al montar)."""
        self.code += 1
        self.page.evaluate("n => window.__demo_code && window.__demo_code(n)", self.code)
        return self.code

    def wait_audio(self):
        rest = self.audio_free_at - time.time()
        if rest > 0:
            self.page.wait_for_timeout(int(rest * 1000))

    def narrate(self, text):
        self.wait_audio()
        path, dur = tts(text)
        self.audio_free_at = time.time() + dur + 0.35
        return str(path), dur

    def say(self, text, wait=3.2, tag=None):
        path, _ = self.narrate(text)
        self.page.evaluate("([c,t]) => window.__demo && window.__demo(c,t)", [text, tag])
        captions.append((self.name, round(time.time() - self.t0, 2), text, path, self.mark()))
        self.page.wait_for_timeout(int(wait * 1000))

    def tag(self, text):
        self.page.evaluate("t => window.__demo && window.__demo(null,t)", text)

    def card(self, kicker, title, subtitle="", items=None, wait=6.0, voice=None):
        lis = "".join(f"<li><b>{a}</b>{b}</li>" for a, b in (items or []))
        html = f"""<html><head><meta charset='utf-8'><style>{CARD_CSS}</style></head><body><div class='box'>
          <div class='k'>{kicker}</div><h1>{title}</h1><div class='s'>{subtitle}</div>
          {'<ul>' + lis + '</ul>' if lis else ''}<div class='bar'></div></div></body></html>"""
        self.page.route(APP + "/__demo_card", lambda route: route.fulfill(content_type="text/html; charset=utf-8", body=html))
        self.page.goto(APP + "/__demo_card")
        self.page.evaluate("() => { try { sessionStorage.clear(); } catch (e) {} }")
        self.page.unroute(APP + "/__demo_card")
        if voice is None:
            voice = f"{kicker}. {title}. {subtitle}"
            if items:
                voice += " Veremos: " + ", ".join(a for a, _ in items[:-1]) + " y " + items[-1][0] + "."
        path, dur = self.narrate(voice)
        captions.append((self.name, round(time.time() - self.t0, 2), f"[Título] {title}", path, self.mark()))
        self.page.wait_for_timeout(int(max(wait, dur + 0.8) * 1000))

    def move_to(self, locator):
        locator.scroll_into_view_if_needed()
        box = locator.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        self.page.mouse.move(x, y, steps=18)
        self.mouse = [x, y]
        self.page.wait_for_timeout(250)

    def click(self, locator, wait=1.2):
        locator = locator.first
        self.move_to(locator)
        locator.click()
        self.page.wait_for_timeout(int(wait * 1000))

    def type(self, locator, text, wait=0.3):
        locator = locator.first
        self.move_to(locator)
        locator.click()
        locator.fill("")
        locator.press_sequentially(text, delay=45)
        self.page.wait_for_timeout(int(wait * 1000))

    def nav(self, label, wait=2.2):
        self.wait_audio()
        self.page.evaluate("() => window.__demo && window.__demo('', null)")
        self.click(self.page.locator("nav a", has_text=label), wait=wait)

    def scroll(self, y, wait=1.6):
        self.page.evaluate("y => window.scrollTo({top:y, behavior:'smooth'})", y)
        self.page.wait_for_timeout(int(wait * 1000))

    def close(self):
        video = self.page.video
        self.wait_audio()
        self.page.wait_for_timeout(600)
        self.ctx.close()
        dest = SEG_DIR / f"{self.name}.webm"
        video.save_as(str(dest))
        return dest


def db_code(email, column):
    with sqlite3.connect(DB) as con:
        return con.execute(f"select {column} from users where email=?", (email,)).fetchone()[0]


def db_exec(sql, params=()):
    with sqlite3.connect(DB) as con:
        con.execute(sql, params)


def login(r, email, *, two_factor=False, password=PASSWORD):
    p = r.page
    p.goto(APP + "/")
    p.wait_for_timeout(1500)
    r.say("Ingresa tu correo corporativo y tu contraseña en el panel «Acceso seguro».", 1.0)
    r.type(p.locator("#email"), email)
    r.type(p.locator("#password"), password)
    r.click(p.locator("button[type=submit]"), wait=1.8)
    if two_factor:
        r.say("Con doble autenticación activa, el sistema envía un código de 6 caracteres a tu correo.", 3.0)
        code = db_code(email, "two_factor_code")
        r.type(p.locator("#two-factor-code"), code)
        r.say("Escribe el código recibido y pulsa «Verificar y continuar».", 1.5)
        r.click(p.get_by_role("button", name="Verificar y continuar"), wait=1.5)
    p.wait_for_url("**/dashboard", timeout=15000)
    p.wait_for_timeout(1800)


def logout(r):
    r.say("Para terminar, usa siempre el botón «Salir» de la esquina superior derecha.", 1.2)
    r.scroll(0, 0.8)
    r.click(r.page.get_by_role("button", name="Salir"), wait=2.0)


def show_menu(r, text):
    r.scroll(0, 0.6)
    r.move_to(r.page.locator("nav").first)
    r.say(text, 4.5)


# ---------------------------------------------------------------- segmentos

def intro(browser):
    r = Rec(browser, "00_intro")
    r.card("Guía de capacitación", "Flujo Caja · FC-HUB",
           "Recorrido por las funciones de la aplicación según el perfil de cada usuario.", wait=5,
           voice="Bienvenido a la guía de capacitación de Flujo Caja. En este video recorremos las funciones de la aplicación según el perfil de cada usuario.")
    r.card("Perfiles del sistema", "Cuatro perfiles de acceso", "Cada usuario tiene un perfil asignado por el administrador.", [
        ("Administrador", "Todo el sistema + gestión de usuarios y configuración de la API de Compras."),
        ("Directivo", "Vista gerencial: dashboard, flujo de caja, tendencias y gastos."),
        ("Finanzas", "Importaciones, flujo de caja, tipos de cambio y finanzas de órdenes de compra."),
        ("Operaciones", "Validación de proyectos, coordinadores, hitos y estados operativos."),
    ], wait=9, voice="El sistema tiene cuatro perfiles de acceso, asignados por el administrador. "
       "El administrador tiene acceso total, además de la gestión de usuarios y la configuración de la API de Compras. "
       "El directivo tiene una vista gerencial del flujo de caja. Finanzas gestiona importaciones, flujo de caja, "
       "tipos de cambio y órdenes de compra. Y Operaciones valida proyectos, coordinadores, hitos y estados.")
    p = r.page
    p.goto(APP + "/")
    p.wait_for_timeout(1500)
    r.tag("Pantalla de ingreso")
    r.say("Esta es la pantalla de ingreso. Aquí se presentan los perfiles de acceso de la plataforma.", 3.5)
    for name in ["Directivo", "Finanzas", "Operaciones"]:
        r.click(p.locator("button", has_text=name), wait=1.4)
    r.say("A la derecha está el formulario «Acceso seguro» y el enlace «Olvidé mi contraseña».", 3.5)
    r.move_to(p.get_by_role("button", name="Olvidé mi contraseña"))
    r.say("Si olvidas tu contraseña, el sistema te envía un código de restablecimiento al correo.", 3.5)
    return r.close()


def admin(browser):
    email = ADMIN_EMAIL
    db_exec("delete from users where email=?", ("valeria.demo@flujocaja.test",))
    r = Rec(browser, "01_admin")
    r.card("Perfil 1 de 4", "Administrador", "Acceso total y tareas exclusivas: usuarios, seguridad y API de Compras.", [
        ("Inicio de sesión", "Con doble autenticación (código OTP por correo)."),
        ("Usuarios", "Crear usuarios, asignar perfiles, activar 2FA y forzar restablecimiento."),
        ("API compras", "Configurar y probar la conexión con Gestión de Compras."),
        ("Resto de módulos", "Los mismos que Finanzas, Directivo y Operaciones."),
    ], wait=8)
    p = r.page
    r.tag("Administrador · Inicio de sesión")
    login(r, email, two_factor=True, password=ADMIN_PASSWORD)
    r.tag("Administrador · Dashboard")
    show_menu(r, "El administrador ve dos opciones exclusivas en el menú: «API compras» y «Usuarios».")

    r.tag("Administrador · Usuarios")
    r.nav("Usuarios")
    r.say("En «Usuarios» se listan las cuentas del sistema con su perfil y estado de seguridad.", 3.5)
    r.type(p.get_by_placeholder("Nombre completo"), "Valeria Demo Finanzas")
    r.type(p.get_by_placeholder("correo@tema.com.pe").first, "valeria.demo@flujocaja.test")
    sel = p.locator("main select").first
    r.move_to(sel)
    sel.select_option("finanzas")
    r.say("Para crear un usuario: nombre, correo y perfil (admin, directivo, finanzas u operaciones).", 3.5)
    r.click(p.get_by_role("button", name="Crear usuario"), wait=2.0)
    r.say("El usuario nuevo deberá restablecer su contraseña con un código en su primer ingreso.", 3.5)
    r.scroll(600, 1.5)
    r.say("Desde la lista puedes cambiar el perfil, activar o desactivar la doble autenticación (2FA) y usar «Restablecer».", 5)
    r.scroll(0, 1.0)

    r.tag("Administrador · API compras")
    r.nav("API compras")
    r.say("En «API compras» se registra la conexión con el sistema de Gestión de Compras.", 3.2)
    r.type(p.get_by_placeholder("https://gcs.temalitoclean.com/api"), "http://127.0.0.1:8020")
    r.type(p.locator("main input[type=password]"), "token-demo-local")
    r.say("Indica la Base URL y el Public Token (aquí usamos una API simulada de pruebas).", 2.5)
    r.click(p.get_by_role("button", name="Probar conexión"), wait=2.5)
    r.say("«Probar conexión» valida el acceso con los datos escritos antes de guardarlos.", 3.5)
    r.click(p.get_by_role("button", name="Guardar configuración"), wait=2.0)
    r.say("«Guardar configuración» almacena la URL y el token de forma segura (el token no se vuelve a mostrar).", 4)

    r.tag("Administrador · Mi seguridad")
    r.nav("Mi seguridad")
    r.say("En «Mi seguridad» cualquier usuario puede cambiar su contraseña y activar o desactivar su 2FA.", 4.5)
    logout(r)
    return r.close()


def finanzas(browser):
    email = "finanzas.demo@flujocaja.test"
    r = Rec(browser, "02_finanzas")
    r.card("Perfil 2 de 4", "Finanzas", "Control de ingresos, hitos cobrados, tipos de cambio y conciliación.", [
        ("Importaciones", "Carga de proyectos e hitos de pago desde Excel (Project Hub)."),
        ("Flujo de caja", "Ingresos por semana y mes, con detalle de hitos y exportación."),
        ("Tipos de cambio", "Tipo de cambio semanal USD → PEN."),
        ("Compras", "Gastos semanales y registro de facturas/pagos por orden."),
    ], wait=8)
    p = r.page
    r.tag("Finanzas · Inicio de sesión")
    login(r, email)
    r.tag("Finanzas · Dashboard")
    r.say("El Dashboard resume los ingresos del mes, proyectos activos, hitos urgentes y cobrados.", 4)
    r.scroll(700, 2)
    r.say("Más abajo aparecen los próximos cobros y alertas de facturación.", 3)
    r.scroll(0, 1)

    r.tag("Finanzas · Importaciones")
    r.nav("Importaciones")
    r.say("En «Importaciones» se cargan los Excel exportados de Project Hub: primero proyectos y luego hitos.", 4)
    inputs = p.locator("main input[type=file]")
    r.move_to(p.locator("main label", has_text="Seleccionar archivo Excel").first)
    inputs.nth(0).set_input_files(str(DATA / "Proyectos_DEMO.xlsx"))
    p.wait_for_timeout(3500)
    r.say("Al seleccionar el archivo se procesa y se muestra el resultado: filas insertadas, actualizadas u omitidas.", 4)
    r.move_to(p.locator("main label", has_text="Seleccionar archivo Excel").nth(1))
    inputs.nth(1).set_input_files(str(DATA / "Hitos_Pago_DEMO.xlsx"))
    p.wait_for_timeout(3500)
    r.say("La importación de hitos reemplaza la anterior y vincula cada hito con su proyecto.", 3.5)
    r.scroll(800, 2)
    r.say("El historial registra cada carga con fecha, archivo y resumen.", 3)
    r.scroll(0, 1)

    r.tag("Finanzas · Flujo de caja")
    r.nav("Flujo de caja", wait=3)
    r.say("«Flujo de caja» muestra una fila por proyecto con sus hitos ubicados por semana y agrupados por mes.", 4.5)
    r.click(p.get_by_role("button", name="Próximos 3 meses"), wait=2.5)
    r.say("Usa los períodos rápidos (mes actual, 3, 6 o 12 meses) o un rango personalizado.", 3.5)
    r.scroll(620, 2)
    r.say("Los indicadores muestran el total del período por moneda y los montos sin fecha de caja.", 3.5)
    cell = p.locator("main tbody td button", has_text="US$").first
    if cell.count():
        r.click(cell, wait=2.5)
        r.say("Haz clic en una celda para ver el detalle de los hitos y sus fechas en esa semana.", 4.5)
        p.keyboard.press("Escape")
        p.wait_for_timeout(800)
    r.scroll(0, 1)
    r.move_to(p.get_by_role("button", name="Exportar Excel"))
    r.say("«Exportar Excel» descarga el flujo con los filtros aplicados.", 3)

    r.tag("Finanzas · Tipos de cambio")
    r.nav("Tipos de cambio")
    r.say("En «Tipos de cambio» se registra el tipo de cambio USD → PEN de cada semana; se guarda al salir del campo.", 5)

    r.tag("Finanzas · Gastos de compras")
    r.nav("Gastos compras")
    r.say("«Gastos compras» consulta la API de Gestión de Compras: compromisos, facturado y pagado por semana.", 4)
    r.click(p.get_by_role("button", name="Aplicar filtros"), wait=3)
    r.say("Puedes filtrar por fechas, proyecto, categoría y etapa.", 3)
    r.scroll(500, 2.5)
    r.scroll(0, 1)

    r.tag("Finanzas · Finanzas de órdenes")
    r.nav("Finanzas órdenes")
    r.say("En «Finanzas órdenes» se consulta una orden de compra o servicio por su número.", 3)
    r.type(p.get_by_placeholder("OC-26-1617 / OS-26-0450"), "OC-26-1617")
    r.click(p.get_by_role("button", name="Consultar orden"), wait=2.5)
    r.say("Se muestran el monto comprometido, facturado, pagado y los saldos pendientes.", 3.5)
    r.scroll(450, 1.5)
    dates = p.locator("main input[type=date]")
    r.type(dates.nth(0), "14102026")
    r.type(p.get_by_placeholder("Importe").nth(0), "4000")
    r.type(p.get_by_placeholder("Número de factura").nth(0), "F002-004702")
    r.say("Para registrar una factura: fecha, importe y número de factura; luego «Agregar facturación».", 2.5)
    r.click(p.get_by_role("button", name="Agregar facturación"), wait=2.5)
    r.say("Del mismo modo se registran los pagos; cada registro puede editarse o eliminarse.", 4)
    r.scroll(0, 1)
    logout(r)
    return r.close()


def directivo(browser):
    email = "directivo.demo@flujocaja.test"
    r = Rec(browser, "03_directivo")
    r.card("Perfil 3 de 4", "Directivo", "Vista gerencial: seguimiento ejecutivo del flujo, cortes mensuales y alertas.", [
        ("Dashboard", "Indicadores clave y próximos cobros."),
        ("Flujo de caja", "Visión mensual / trimestral y exportación a Excel."),
        ("Proyectos", "Cartera con margen, avance y coordinador."),
        ("Gastos compras", "Egresos semanales por proyecto y categoría."),
    ], wait=8)
    p = r.page
    r.tag("Directivo · Inicio de sesión")
    login(r, email)
    r.tag("Directivo · Dashboard")
    show_menu(r, "El perfil Directivo ve el mismo menú operativo, sin «Usuarios» ni «API compras».")
    r.say("El Dashboard ofrece la lectura ejecutiva: ingresos del mes, proyectos con ingreso y alertas.", 3.5)
    r.scroll(700, 2.5)
    r.scroll(0, 1)

    r.tag("Directivo · Flujo de caja")
    r.nav("Flujo de caja", wait=3)
    r.click(p.get_by_role("button", name="Próximos 12 meses"), wait=3)
    r.say("Con «Próximos 12 meses» la vista adaptativa agrupa por mes o trimestre para verlo todo en pantalla.", 4.5)
    r.scroll(700, 2.5)
    r.say("Haz clic en el encabezado de un período para ver el detalle de sus semanas.", 3.5)
    r.scroll(0, 1)

    r.tag("Directivo · Proyectos")
    r.nav("Proyectos")
    r.say("«Proyectos» lista la cartera importada con cliente, unidad, moneda, avance y margen.", 4)
    r.scroll(500, 2.5)
    r.scroll(0, 1)

    r.tag("Directivo · Gastos de compras")
    r.nav("Gastos compras")
    r.click(p.get_by_role("button", name="Aplicar filtros"), wait=3)
    r.say("En «Gastos compras» el directivo revisa los egresos semanales por proyecto y categoría.", 4)
    logout(r)
    return r.close()


def operaciones(browser):
    email = "operaciones.demo@flujocaja.test"
    db_exec("update users set must_reset_password=1, two_factor_enabled=0 where email=?", (email,))
    r = Rec(browser, "04_operaciones")
    r.card("Perfil 4 de 4", "Operaciones", "Validación de proyectos, clientes, coordinadores y estados operativos.", [
        ("Primer ingreso", "Restablecimiento obligatorio de contraseña con código."),
        ("Proyectos", "Filtros por cliente, unidad y coordinador."),
        ("Flujo de caja", "Estados de hitos y discrepancias."),
        ("Mi seguridad", "Cambio de contraseña y doble autenticación."),
    ], wait=8)
    p = r.page
    r.tag("Operaciones · Primer ingreso")
    p.goto(APP + "/")
    p.wait_for_timeout(1500)
    r.say("En el primer ingreso, el sistema pide restablecer la contraseña antes de entrar.", 1.0)
    r.type(p.locator("#email"), email)
    r.type(p.locator("#password"), PASSWORD)
    r.click(p.locator("button[type=submit]"), wait=2.0)
    r.say("Se abre esta ventana y llega un código de restablecimiento al correo.", 3.0)
    r.type(p.locator("#reset-code"), db_code(email, "password_reset_code"))
    r.type(p.locator("#reset-password"), PASSWORD)
    r.type(p.locator("#reset-password-confirmation"), PASSWORD)
    r.say("Escribe el código y tu nueva contraseña dos veces; luego pulsa «Continuar».", 2.0)
    r.click(p.get_by_role("button", name="Continuar"), wait=2.5)
    r.say("Listo: con la contraseña actualizada ya puedes conectarte normalmente.", 2.5)
    if "/dashboard" not in p.url:
        r.type(p.locator("#password"), PASSWORD)
        r.click(p.locator("button[type=submit]"), wait=2.0)
    p.wait_for_url("**/dashboard", timeout=15000)
    p.wait_for_timeout(1500)

    r.tag("Operaciones · Proyectos")
    r.nav("Proyectos")
    r.say("Operaciones valida la cartera en «Proyectos»: cliente, unidad de negocio, coordinador y estado.", 4)
    r.type(p.get_by_placeholder("Coordinador"), "Ana Demo")
    p.wait_for_timeout(1500)
    r.say("Con los filtros se acota la lista, por ejemplo por coordinador de proyecto.", 3.5)
    r.click(p.get_by_role("button", name="Limpiar filtros"), wait=1.5)

    r.tag("Operaciones · Flujo de caja")
    r.nav("Flujo de caja", wait=3)
    r.say("En «Flujo de caja», la leyenda de colores indica el estado de cada hito: de «No iniciado» a «Cobrado».", 4.5)
    r.scroll(560, 2.5)
    chk = p.get_by_text("Solo proyectos con discrepancias de estado")
    r.click(chk, wait=2.5)
    r.say("«Solo proyectos con discrepancias» ayuda a revisar hitos cuyo estado no coincide con sus fechas.", 4.5)
    r.click(chk, wait=1.5)
    r.scroll(0, 1)

    r.tag("Operaciones · Mi seguridad")
    r.nav("Mi seguridad")
    r.say("En «Mi seguridad» puedes cambiar tu contraseña o activar la doble autenticación.", 3.5)
    r.click(p.get_by_role("button", name="Activar"), wait=2.5)
    r.say("Con 2FA activa, cada ingreso pedirá además un código enviado a tu correo.", 3.5)
    logout(r)
    return r.close()


def cierre(browser):
    r = Rec(browser, "05_cierre")
    r.card("Resumen", "¿Qué ve cada perfil?", "Menú disponible según el perfil asignado.", [
        ("Todos los perfiles", "Dashboard, Importaciones, Proyectos, Flujo de caja, Tipos de cambio, Gastos compras, Finanzas órdenes y Mi seguridad."),
        ("Solo Administrador", "Usuarios (alta, perfil, 2FA, restablecer) y API compras (configuración y prueba)."),
        ("Seguridad", "Primer ingreso con código de restablecimiento; 2FA opcional por usuario."),
        ("Soporte", "Ante dudas de acceso, contacta al administrador del sistema."),
    ], wait=10, voice="En resumen: todos los perfiles tienen acceso a los módulos operativos y a Mi seguridad. "
       "Solo el administrador ve Usuarios y la configuración de la A P I de Compras. En el primer ingreso se pide "
       "restablecer la contraseña con un código, y la doble autenticación es opcional para cada usuario. "
       "Ante cualquier duda de acceso, contacta al administrador del sistema.")
    r.card("Flujo Caja · FC-HUB", "¡Gracias!", "Video de capacitación generado con datos de prueba en un entorno local.", wait=4,
           voice="¡Gracias por tu atención!")
    return r.close()


if __name__ == "__main__":
    only = sys.argv[2:] or ["intro", "admin", "finanzas", "directivo", "operaciones", "cierre"]
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name in only:
            print("Grabando", name, flush=True)
            globals()[name](browser)
        browser.close()
    log = ROOT / "runtime" / "captions.json"
    old = json.loads(log.read_text(encoding="utf-8")) if log.exists() and sys.argv[2:] else []
    names = {c[0] for c in captions}
    merged = [c for c in old if c[0] not in names] + captions
    log.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    print("OK")
