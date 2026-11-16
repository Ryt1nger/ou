"""Evidence-coverage regression tests for the organizers' 18 sample questions.

These checks verify that the necessary supporting material reaches the model.
They do not pretend to test an actual paid DeepSeek inference.
"""
import csv
import json
from pathlib import Path

import pytest
from engine import KnowledgeBase, LegalAssistant

ROOT = Path(__file__).resolve().parents[1]
KB = KnowledgeBase(ROOT / 'data/knowledge-base.zip')
with (ROOT/'data/demo_questions.csv').open(encoding='utf-8-sig',newline='') as f:
    DEMOS = list(csv.DictReader(f))

EXPECTED = {
 '1': ('А-08', 'п. 3.1'),
 '2': ('ТК_ст70', None),
 '4': ('А-08', 'п. 3.1'),
 '5': ('ред 2023', 'п. 2.4'),
 '6': ('П-17', 'п. 6.1'),
 '7': ('А-08', 'п. 4.3'),
 '8': ('П-17', 'п. 6.2'),
 '9': ('ПТ-05', 'п. 4.2'),
 '10': ('ред 2025', 'п. 1.3'),
 '11': ('архив', None),
 '12': ('ТК_ст70', None),
 '13': ('152ФЗ', None),
 '14': ('ТК_ст59', None),
 '15': ('А-08', 'п. 6.3'),
 '16': ('П-17', 'п. 2.1'),
 '17': ('ПТ-05', 'п. 6.1'),
 '18': ('ред 2025', 'п. 3.2'),
}

@pytest.mark.parametrize('case', DEMOS, ids=[f"demo-{q['id']}" for q in DEMOS])
def test_official_demo_supplies_expected_legal_evidence(case):
    if case['id'] == '3':
        result = LegalAssistant(KB, generator=lambda _messages: pytest.fail('No model call on absent topic')).answer(case['question'])
        assert result['status'] == 'insufficient'
        return
    captured = []
    def fake(messages):
        captured.append(messages[1]['content'])
        return json.dumps({'status':'insufficient','answer':'Проверка контекста','used_ids':[]})
    LegalAssistant(KB,generator=fake).answer(case['question'])
    assert captured, f"No LLM context for case {case['id']}"
    needle, clause = EXPECTED[case['id']]
    assert needle.lower() in captured[0].lower(), f"Missing document {needle} in case {case['id']}"
    if clause:
        assert clause in captured[0], f"Missing clause {clause} in case {case['id']}"


def test_corrected_counterparty_beats_earlier_wrong_assistant_message():
    captured=[]
    def fake(messages):
        captured.append(messages[1]['content'])
        return json.dumps({'status':'insufficient','answer':'no','used_ids':[]})
    bot = LegalAssistant(KB, generator=fake)
    bot.answer('На сколько гарантия по Альфа-Трейд?', history=[
        {'role':'user','content':'А по Альфа-Трейдинг какой срок?'},
        {'role':'assistant','content':'Ранее мы обсуждали ООО «Альфа-Трейдинг».'}
    ])
    assert captured
    assert 'П-17' in captured[0]


def test_recent_entity_selection_in_dialogue():
    captured=[]
    def fake(messages):
        captured.append(messages[1]['content'])
        return json.dumps({'status':'insufficient','answer':'no','used_ids':[]})
    bot = LegalAssistant(KB, generator=fake)
    bot.answer('Сколько гарантия?',history=[
        {'role':'user','content':'Какая гарантия в компании Альфа-Трейд?'},
        {'role':'assistant','content':'Альфа-Трейд или Альфа-Трейдинг? Можете уточнить?'},
        {'role':'user','content':'Альфа-Трейдинг, у них покупали компьютеры.'}
    ])
    assert captured
    assert 'ПТ-05' in captured[0]


def test_public_demo_access_code_blocks_unauthorized_chat(monkeypatch):
    from fastapi.testclient import TestClient
    import app
    monkeypatch.setenv('DEMO_ACCESS_CODE', 'sample-private-code')
    client = TestClient(app.app)
    r = client.post('/api/chat', json={'question':'Когда платить по договору?'})
    assert r.status_code == 403
    assert client.get('/api/health').json()['access_protected'] is True
    monkeypatch.delenv('DEMO_ACCESS_CODE')
    assert client.get('/api/health').json()['access_protected'] is False


@pytest.mark.parametrize('case', [q for q in DEMOS if q['id'] != '3'], ids=[f"pipeline-{q['id']}" for q in DEMOS if q['id']!='3'])
def test_official_demo_pipeline_produces_existing_sources(case):
    # Deterministic *transport/source* test. The model mock cites a real retrieved
    # fragment; legal correctness of the generated prose is evaluated separately.
    def mock_model(messages):
        import re
        ctx = messages[1]['content']
        m = re.search(r'\[(\d+)\] ДОКУМЕНТ:', ctx)
        assert m
        n = int(m[1])
        return json.dumps({'status':'answered','answer':f'По документу найдено положение [{n}].','used_ids':[n]})
    ans = LegalAssistant(KB, generator=mock_model).answer(case['question'])
    assert ans['status']=='answered', case['id']
    assert ans['sources'] and ans['sources'][0]['ref'] == 1
    source = ans['sources'][0]
    assert source['doc_id'] in KB.by_id
    assert source['excerpt'].strip()


def test_mocked_http_api_returns_citation_and_document(monkeypatch):
    from fastapi.testclient import TestClient
    import app
    monkeypatch.delenv('DEMO_ACCESS_CODE', raising=False)
    previous=app.assistant.generator
    app.assistant.generator = lambda _m: json.dumps({
        'status':'answered', 'answer':'Срок оплаты 45 дней [1].', 'used_ids':[1]
    })
    try:
        client=TestClient(app.app)
        r=client.post('/api/chat',json={'question':'Какой срок оплаты по ПТ-05/2023?'})
        assert r.status_code==200
        data=r.json()
        assert data['status']=='answered' and data['sources']
        id=data['sources'][0]['doc_id']
        doc=client.get('/api/documents/'+id)
        assert doc.status_code==200 and 'ПТ-05' in doc.json()['title']
        assert client.get('/assets/app.js').status_code == 200
        assert client.get('/').status_code == 200
    finally:
        app.assistant.generator = previous


def test_valid_access_code_allows_chat(monkeypatch):
    from fastapi.testclient import TestClient
    import app
    monkeypatch.setenv('DEMO_ACCESS_CODE','valid')
    previous=app.assistant.generator
    app.assistant.generator=lambda _m: json.dumps({'status':'answered','answer':'Основание [1]','used_ids':[1]})
    try:
        r=TestClient(app.app).post('/api/chat',headers={'X-Demo-Access-Code':'valid'},json={'question':'Срок оплаты по ПТ-05/2023?'})
        assert r.status_code == 200 and r.json()['status']=='answered'
    finally:
        app.assistant.generator=previous
