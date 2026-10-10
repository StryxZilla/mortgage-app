"""Download the public Freddie Mac PMMS workbook; no API key required."""
import datetime
import io
import json
import math
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

URL = 'https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def parse_workbook(raw, today=None):
    today = today or datetime.date.today()
    series = {15: {}, 30: {}}
    with zipfile.ZipFile(io.BytesIO(raw)) as workbook:
        strings = []
        if 'xl/sharedStrings.xml' in workbook.namelist():
            strings = [''.join(node.itertext()) for node in ET.fromstring(workbook.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        epoch = datetime.date(1899, 12, 30)
        metadata = ET.fromstring(workbook.read('xl/workbook.xml'))
        properties = metadata.find('s:workbookPr', NS)
        if properties is not None and properties.attrib.get('date1904') in ('1', 'true'):
            epoch = datetime.date(1904, 1, 1)
        for name in workbook.namelist():
            if not name.startswith('xl/worksheets/sheet') or not name.endswith('.xml'):
                continue
            for row in ET.fromstring(workbook.read(name)).findall('.//s:sheetData/s:row', NS):
                cells = {}
                for cell in row.findall('s:c', NS):
                    value = cell.find('s:v', NS)
                    if value is None:
                        continue
                    text = value.text
                    if cell.attrib.get('t') == 's':
                        text = strings[int(text)]
                    cells[''.join(c for c in cell.attrib['r'] if c.isalpha())] = text
                try:
                    date = epoch + datetime.timedelta(days=math.floor(float(cells['A'])))
                except (ValueError, KeyError, OverflowError):
                    continue
                if date < datetime.date(2021, 1, 1) or date > today:
                    continue
                for term, column in ((30, 'B'), (15, 'D')):
                    try:
                        value = float(cells[column])
                    except (ValueError, KeyError):
                        continue
                    if not math.isfinite(value) or not 0 < value < 30:
                        raise ValueError('Invalid PMMS mortgage-rate value')
                    key = date.isoformat()
                    if key in series[term] and series[term][key] != value:
                        raise ValueError('Conflicting PMMS observations')
                    series[term][key] = value
    result = {str(term): [[date, value] for date, value in sorted(points.items())] for term, points in series.items()}
    if any(len(points) < 100 for points in result.values()):
        raise ValueError('PMMS workbook did not contain the expected history')
    if result['15'][-1][0] != result['30'][-1][0]:
        raise ValueError('PMMS rate publication dates differ')
    return result


if __name__ == '__main__':
    request = urllib.request.Request(URL, headers={'User-Agent': 'Haven mortgage calculator data refresh'})
    with urllib.request.urlopen(request, timeout=60) as response:
        series = parse_workbook(response.read())
    with open('src/mortgage-rates.json', encoding='utf-8') as file:
        previous = json.load(file)
    if series['30'][-1][0] < previous['series']['30'][-1][0]:
        raise ValueError('Refusing older mortgage-rate data')
    if series == previous['series']:
        print('Mortgage-rate data is already up to date.')
    else:
        previous['series'] = series
        previous['source']['downloadUrl'] = URL
        with open('src/mortgage-rates.json', 'w', encoding='utf-8') as file:
            json.dump(previous, file, separators=(',', ':'))
            file.write('\n')
        print('Updated mortgage rates through ' + series['30'][-1][0])
