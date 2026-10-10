import datetime
import importlib.util
import io
import pathlib
import unittest
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('download_rates', root / 'scripts/download-rates.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def workbook(truncated=False, conflict=False):
    start = datetime.date(2021, 1, 7)
    rows = []
    for index in range(110 if not truncated else 10):
        date = start + datetime.timedelta(days=7 * index)
        serial = (date - datetime.date(1899, 12, 30)).days
        row = index + 8
        rows.append(f'<row r="{row}"><c r="A{row}"><v>{serial}</v></c><c r="B{row}"><v>7.4</v></c><c r="C{row}"><v>0.5</v></c><c r="D{row}"><v>6.73</v></c></row>')
    if conflict:
        rows.append(f'<row><c r="A120"><v>{serial}</v></c><c r="B120"><v>9</v></c></row>')
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><workbookPr/></workbook>')
        archive.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>')
    return data.getvalue()


class WorkbookTests(unittest.TestCase):
    def test_excel_dates_and_loan_columns(self):
        series = module.parse_workbook(workbook())
        self.assertEqual(series['30'][0], ['2021-01-07', 7.4])
        self.assertEqual(series['15'][0], ['2021-01-07', 6.73])
        self.assertEqual(len(series['30']),110)
        self.assertEqual(series['30'][-1][0],series['15'][-1][0])

    def test_partial_and_conflicting_history_rejected(self):
        with self.assertRaises(ValueError):
            module.parse_workbook(workbook(truncated=True))
        with self.assertRaises(ValueError):
            module.parse_workbook(workbook(conflict=True))


if __name__ == '__main__':
    unittest.main()
