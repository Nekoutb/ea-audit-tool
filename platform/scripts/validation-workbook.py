"""The review workbook the firm or its jurist fills in (decision 2026-10-27, VALIDATION).

    npx tsx scripts/validation-items.ts items.json
    python scripts/validation-workbook.py items.json <output.xlsx>

One row per draft French tip and per legal article or deadline marked "(à valider)",
with a Valid? dropdown and a Correction column; Claude applies the answers afterwards.
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"
HEAD = PatternFill("solid", fgColor="D9D9D9")
YELLOW = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADERS = ["Paper", "Procedure/Item", "Text", "Article/Source", "Valid?", "Correction"]
WIDTHS = [30, 42, 80, 30, 9, 45]


def fill_sheet(ws, rows):
    for col, (title, width) in enumerate(zip(HEADERS, WIDTHS), start=1):
        cell = ws.cell(row=1, column=col, value=title)
        cell.font = Font(name=FONT, size=10, bold=True)
        cell.fill = HEAD
        cell.border = BOX
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[chr(64 + col)].width = width
    for r, item in enumerate(rows, start=2):
        values = [item["paper"], item["item"], item["text"], item["source"], None, None]
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=r, column=col, value=value)
            cell.font = Font(name=FONT, size=10)
            cell.border = BOX
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if col >= 5:
                cell.fill = YELLOW
    last = max(len(rows) + 1, 2)
    dv = DataValidation(type="list", formula1='"Oui,Non"', allow_blank=True, showErrorMessage=True)
    dv.error = "Oui ou Non"
    ws.add_data_validation(dv)
    dv.add(f"E2:E{last}")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:F{last}"


def main():
    items = json.load(open(sys.argv[1], encoding="utf8"))
    wb = Workbook()
    legend = wb.active
    legend.title = "Légende"
    tips = [i for i in items if i["kind"] == "tip"]
    articles = [i for i in items if i["kind"] == "article"]
    lines = [
        ("Validation AuditISA : conseils en projet et références légales", True),
        ("", False),
        ("Objet : ces textes sont des projets. Ils restent sur DEV tant que le cabinet ou son juriste ne les a pas validés.", False),
        (f"Feuille « Conseils Projet » : {len(tips)} conseils pratiques rédigés en français, marqués [Projet].", False),
        (f"Feuille « Articles à valider » : {len(articles)} articles et délais marqués « à valider ».", False),
        ("", False),
        ("Comment remplir :", True),
        ("Valid? (jaune) : choisir Oui si le texte est juste tel quel, Non sinon.", False),
        ("Correction (jaune) : si Non, écrire le texte ou la référence à retenir.", False),
        ("Ne pas modifier les autres colonnes : elles servent à retrouver le texte dans l'application.", False),
        ("", False),
        ("Colonnes :", True),
        ("Paper : la feuille de travail ou la partie de l'application concernée.", False),
        ("Procedure/Item : la procédure, la question ou l'emplacement du texte.", False),
        ("Text : le texte tel qu'il figure aujourd'hui dans l'application.", False),
        ("Article/Source : l'article ou la source cités par ce texte.", False),
        ("", False),
        ("Une fois rempli, renvoyer ce classeur : les réponses seront appliquées dans l'application.", False),
    ]
    legend.column_dimensions["A"].width = 110
    for r, (text, bold) in enumerate(lines, start=1):
        cell = legend.cell(row=r, column=1, value=text)
        cell.font = Font(name=FONT, size=12 if r == 1 else 10, bold=bold)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    fill_sheet(wb.create_sheet("Conseils Projet"), tips)
    fill_sheet(wb.create_sheet("Articles à valider"), articles)
    wb.save(sys.argv[2])
    print(f"{len(tips)} tips, {len(articles)} articles -> {sys.argv[2]}")


main()
