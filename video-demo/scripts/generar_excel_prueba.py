"""Genera archivos Excel de PRUEBA (datos ficticios) con el mismo formato que los
exportes de Dataverse que espera el importador (hojas y encabezados idénticos).

Uso:  python generar_excel_prueba.py <carpeta_salida>
"""
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl

random.seed(2026)
out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out.mkdir(parents=True, exist_ok=True)

HOY = datetime(2026, 10, 14)

PROJECT_HEADERS = [
    "(No modificar) Proyecto", "(No modificar) Suma de comprobación de fila", "(No modificar) Fecha de modificación",
    "Fecha de adjudicación", "Identificador", "Cliente contratante", "Razón para el estado",
    "Unidad de negocio propietaria", "Moneda", "Precio de venta estimado", "Avance a la fecha %",
    "Margen real (%)", "Categoria Margen Real", "Margen estimado (%)", "Categoria Margen Estimado",
    "% Desviación Horas Totales", "Existencias", "Existencias (%)", "Coordinador de Proyecto", "Tipos de Existencias",
]
MILESTONE_HEADERS = [
    "(No modificar) Hito de pago de proyecto", "(No modificar) Suma de comprobación de fila",
    "(No modificar) Fecha de modificación", "Proyecto", "Identificador", "Monto Valorizado",
    "Estado Alerta de Facturación", "Estatus", "Fecha Estimada de Facturación", "Fecha Real de Valorización",
    "Fecha Real de Facturación", "Fecha Estimada de Pago", "No. Factura", "Moneda", "Fecha Real de Cobro",
]

CLIENTES = [
    "Minera Demo Andina S.A.C.", "Energía Ficticia del Sur S.A.", "Puerto Ejemplo Callao S.A.",
    "Agroindustrias Prueba S.A.C.", "Cementos Muestra Perú S.A.", "Transportes Demo Lima S.A.C.",
    "Hidroeléctrica Ejemplo S.A.", "Municipalidad Ficticia de Prueba",
]
SERVICIOS = [
    "Estudio de Impacto Ambiental", "HAZOP de planta", "Caracterización de suelos", "Auditoría de seguridad",
    "Plan de contingencia", "Monitoreo ambiental trimestral", "Supervisión de obra", "Análisis de riesgos",
    "Línea base ambiental", "Ingeniería de detalle",
]
UNIDADES = [
    "PE-TL | Seguridad", "PE-TL | Suelos y Medio Ambiente | Suelos",
    "PE-TL | Suelos y Medio Ambiente | Medio Ambiente", "PE-TL | GGPI",
]
COORDINADORES = ["Ana Demo", "Carlos Ejemplo", "María Prueba", "Jorge Ficticio"]
SEMAFORO = ["🟢", "🟡", "🔴"]
MONEDAS = ["Dólar de EE. UU.", "Sol Peruano"]


def checksum():
    return uuid.uuid4().hex[:40]


wb = openpyxl.Workbook()
ws = wb.active
ws.title = "SP Proyectos Producción"
ws.append(PROJECT_HEADERS)
projects = []
for i in range(24):
    code = str(70100 + i)
    name = f"{random.choice(SERVICIOS)} - {random.choice(['Planta Norte', 'Sede Central', 'Mina Sur', 'Terminal', 'Fase II', 'Ampliación'])}"
    moneda = MONEDAS[i % 3 == 0]
    precio = random.choice([45000, 80000, 120000, 150000, 220000, 310000, 95000])
    estado = random.choices(["Ejecución", "Oferta", "Finalizado", "Plan"], [6, 2, 1, 1])[0]
    projects.append((code, name, moneda, precio, estado))
    ws.append([
        str(uuid.uuid4()), checksum(), HOY - timedelta(days=random.randint(1, 20)),
        HOY - timedelta(days=random.randint(60, 400)), f"{code}; {name}", CLIENTES[i % len(CLIENTES)], estado,
        UNIDADES[i % len(UNIDADES)], moneda, precio, random.randint(5, 95),
        random.randint(-10, 40), random.choice(SEMAFORO), random.randint(10, 40), random.choice(SEMAFORO),
        random.randint(-15, 25), random.randint(0, 20000), random.randint(0, 15),
        COORDINADORES[i % len(COORDINADORES)], None,
    ])
wb.create_sheet("hiddenSheet")
wb.save(out / "Proyectos_DEMO.xlsx")

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Hito de pago de proyectos"
ws.append(MILESTONE_HEADERS)
factura = 1000
for code, name, moneda, precio, estado in projects:
    if estado == "Oferta":
        continue
    n = random.choice([2, 3, 4])
    porcentajes = {2: [50, 50], 3: [30, 40, 30], 4: [25, 25, 25, 25]}[n]
    base = HOY + timedelta(days=random.randint(-120, 10))
    for h, pct in enumerate(porcentajes, start=1):
        est_fact = base + timedelta(days=30 * h + random.randint(-5, 5))
        est_pago = est_fact + timedelta(days=30)
        val = fact = cobro = None
        nro = None
        alerta = "N/A"
        if est_pago < HOY - timedelta(days=10):
            status = "Cobrado"
            val, fact, cobro = est_fact - timedelta(days=7), est_fact, est_pago + timedelta(days=random.randint(-3, 8))
        elif est_fact < HOY:
            status = "Facturado"
            val, fact = est_fact - timedelta(days=7), est_fact
        elif est_fact < HOY + timedelta(days=12):
            status = random.choice(["Valorizado", "En Curso"])
            if status == "Valorizado":
                val = HOY - timedelta(days=3)
            alerta = random.choice(["🔴 Urgente", "🟠 Atención", "N/A"])
        else:
            status = "No Iniciado"
        if fact:
            factura += 1
            nro = f"F001-{factura:06d}"
        ws.append([
            str(uuid.uuid4()), checksum(), HOY - timedelta(days=random.randint(1, 10)), f"{code}; {name}",
            f"H{h:02d}: {pct}% {random.choice(['A la aprobación del entregable', 'Al inicio del servicio', 'A la entrega del informe final', 'Avance mensual'])}",
            round(precio * pct / 100, 2), alerta, status, est_fact, val, fact, est_pago, nro, moneda, cobro,
        ])
wb.create_sheet("hiddenSheet")
wb.save(out / "Hitos_Pago_DEMO.xlsx")
print("OK", out)
