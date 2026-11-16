from fastapi.testclient import TestClient
import app as app_module

client=TestClient(app_module.app)

def test_health_and_documents():
    health=client.get('/api/health')
    assert health.status_code==200
    assert health.json()['documents']==21
    doclist=client.get('/api/documents')
    assert len(doclist.json()['items'])==21
    docid=doclist.json()['items'][0]['id']
    doc=client.get('/api/documents/'+docid)
    assert doc.status_code==200 and len(doc.json()['text'])>200


def test_search_and_404():
    res=client.get('/api/search',params={'q':'Альфа-Трейдинг оплата'})
    assert res.status_code==200 and res.json()['items']
    assert client.get('/api/documents/bad-id').status_code==404


def test_chat_without_key_returns_explicit_error(monkeypatch):
    monkeypatch.delenv('LLM_API_KEY',raising=False)
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    monkeypatch.delenv('DEEPSEEK_API_KEY',raising=False)
    r=client.post('/api/chat',json={'question':'Какой срок оплаты по ПТ-05/2023?'})
    assert r.status_code==503
    assert 'API_KEY' in r.json()['detail']
