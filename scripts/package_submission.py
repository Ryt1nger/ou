"""Create the organizers' platform ZIP without secret keys or local knowledge data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
output=root/'lex_submission.zip'
files=['solution.py','engine.py','requirements.txt']
with ZipFile(output,'w',ZIP_DEFLATED) as archive:
    for filename in files:
        archive.write(root/filename, filename)
print(f'{output.name}: {output.stat().st_size:,} bytes, files at archive root')
