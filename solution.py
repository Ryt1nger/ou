"""Hack&Change 2026 entrypoint: python solution.py.

Reads DATA_DIR/questions.csv and DATA_DIR/knowledge-base.zip; writes exactly
id,answer to ./submission.csv. All test IDs are independent.
"""
from __future__ import annotations
import csv
import os
from pathlib import Path
from engine import KnowledgeBase, LegalAssistant


def main():
    data = Path(os.getenv("DATA_DIR", "data"))
    input_path = data / "questions.csv"
    if not input_path.is_file():
        raise SystemExit(f"Не найден {input_path}")
    kb = KnowledgeBase(data / "knowledge-base.zip")
    bot = LegalAssistant(kb)
    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        questions = list(csv.DictReader(f))
    if not questions or any('id' not in q or 'question' not in q for q in questions):
        raise SystemExit("Ожидаются столбцы id,question")
    output_path = Path("submission.csv")
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "answer"])
        writer.writeheader()
        for i, item in enumerate(questions, 1):
            try:
                answer = bot.answer(item["question"])["answer"]
            except Exception as exc:
                # Platform requires a row for every ID even if one request fails.
                # Do not echo tokens, URLs or stack traces to submission.csv.
                print(f"case {i}/{len(questions)}: {type(exc).__name__}", flush=True)
                answer = "Не удалось сформировать достоверный ответ по базе знаний из-за временной технической ошибки."
            writer.writerow({"id":item["id"], "answer":(answer or "Недостаточно данных в базе знаний.")[:10000]})
            f.flush()
            print(f"completed {i}/{len(questions)}",flush=True)
    print(f"Сохранено {len(questions)} ответов в {output_path}")

if __name__ == "__main__": main()
