import json
import re
from pathlib import Path
import pytest
from engine import KnowledgeBase, LegalAssistant, model_config, safe_text

KB = KnowledgeBase(Path(__file__).parents[1] / "data/knowledge-base.zip")


def docs(query, n=7):
    return KB.retrieve(query, top_k=n)


def test_knowledge_base_contains_21_files():
    assert len(KB.documents) == 21
    assert len(KB.chunks) >= 100
    assert sum(x.category == 'Законодательство РФ' for x in KB.documents) == 13


def test_contracts_are_not_confused():
    a = docs('Какой срок оплаты по договору ПТ-05/2023 с Альфа-Трейдинг?')[0]
    b = docs('Какой срок оплаты по договору П-17/2024 с Альфа-Трейд?')[0]
    assert 'ПТ-05' in a['title'] and 'п. 4.1' == a['clause']
    assert 'П-17' in b['title'] and 'п. 4.2' == b['clause']
    assert '45 (сорока пяти)' in a['text']
    assert '30 (тридцати)' in b['text']


def test_false_premise_find_correct_rent():
    chunks=docs('Почему аренда по договору с Северным Складом 500 000 рублей?')
    assert any('450 000' in c['text'] and c['clause']=='п. 3.1' for c in chunks)


def test_editorial_versioning_2024_and_2025():
    old=docs('Нужно ли одобрение генерального директора для договора на 12 млн в августе 2024 года?')
    assert old[0]['clause']=='п. 2.4'
    assert old[0]['version']=='10.01.2023'
    new=docs('Нужно ли одобрение генерального директора для договора на 12 млн в августе 2025 года?')
    assert new[0]['clause']=='п. 2.4'
    assert new[0]['version']=='01.03.2025'


def test_amendment_is_found_with_original_contract():
    chunks=docs('Где адрес доставки по П-17/2024 для спецификации 15 ноября 2024 года?')
    assert any(c['category']=='Доп. соглашения' for c in chunks)
    assert any(c['clause']=='п. 3.2' for c in chunks)


def test_compliance_multi_document():
    chunks=docs('Нужна ли санкционная проверка иностранного контрагента в мае 2025 года?')
    assert any('К-12' in c['title'] for c in chunks)
    assert any('ред 2025' in c['title'] and c['clause']=='п. 5.4' for c in chunks)


def test_injection_is_removed_before_model_context():
    memo = next(d for d in KB.documents if 'архив' in d.title)
    assert '90 календарных дней' in memo.text
    assert '90 календарных дней' not in safe_text(memo.text)
    for c in KB.chunks:
        assert '90 календарных дней' not in c['text']


def test_ambiguous_company_asks_clarification_without_llm():
    bot=LegalAssistant(KB, generator=lambda msgs: pytest.fail('LLM must not be called'))
    ans=bot.answer('Какая гарантия у Альфы?')
    assert ans['status']=='clarify'
    assert 'Альфа-Трейдинг' in ans['answer']


def test_valid_citations_are_attached_and_invalid_rejected():
    bot=LegalAssistant(KB, generator=lambda m: json.dumps({'status':'answered','answer':'Оплата — 45 календарных дней [1].','used_ids':[1]}))
    result=bot.answer('Какой срок оплаты по ПТ-05/2023?')
    assert result['status']=='answered'
    assert result['sources'] and result['sources'][0]['clause']=='п. 4.1'
    bad=LegalAssistant(KB, generator=lambda m: json.dumps({'status':'answered','answer':'Неверное утверждение [999].','used_ids':[999]}))
    result=bad.answer('Какой срок оплаты по ПТ-05/2023?')
    assert result['status']=='insufficient'
    assert not result['sources']


def test_dialogue_focuses_on_last_question():
    captured=[]
    def fake(messages):
        captured.append(messages[1]['content'])
        return json.dumps({'status':'answered','answer':'Приёмка по качеству — 5 рабочих дней [1].','used_ids':[1]})
    bot=LegalAssistant(KB,generator=fake)
    dialogue='''Пользователь: Какой гарантийный срок на товар по договору с ООО «Альфа-Трейд»?
Ассистент: По договору поставки № П-17/2024 срок — 24 месяца.
Пользователь: А за сколько дней после поставки нужно проверить качество?'''
    result=bot.answer(dialogue)
    assert result['status']=='answered'
    assert result['sources'][0]['clause']=='п. 6.1'
    assert 'п. 6.1' in captured[0]


def test_model_base_url(monkeypatch):
    monkeypatch.setenv('DEEPSEEK_API_KEY','test')
    monkeypatch.setenv('DEEPSEEK_BASE_URL','https://api.deepseek.com/v1')
    monkeypatch.setenv('DEEPSEEK_MODEL','deepseek-flash')
    key,url,model=model_config()
    assert url=='https://api.deepseek.com/v1/chat/completions'
    assert key=='test' and model=='deepseek-flash'
