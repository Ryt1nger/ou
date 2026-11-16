import csv
import json
from pathlib import Path

import engine
import solution


def test_deepseek_openai_compatible_request(monkeypatch):
    captured={}
    class FakeResponse:
        status_code=200
        def raise_for_status(self): pass
        def json(self):
            return {'choices':[{'message':{'content':'{"status":"answered","answer":"Проверено [1]","used_ids":[1]}'}}]}
    class FakeClient:
        def __init__(self,timeout):self.timeout=timeout
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def post(self,url,headers,json):
            captured.update({'url':url,'headers':headers,'payload':json})
            return FakeResponse()
    monkeypatch.setenv('DEEPSEEK_API_KEY','never-publish-this-test-key')
    monkeypatch.setenv('DEEPSEEK_BASE_URL','https://api.deepseek.com')
    monkeypatch.setenv('DEEPSEEK_MODEL','deepseek-flash')
    monkeypatch.setattr(engine.httpx,'Client',FakeClient)
    response=engine.ask_deepseek([{'role':'system','content':'system'},{'role':'user','content':'demo'}])
    assert 'Проверено' in response
    assert captured['url']=='https://api.deepseek.com/chat/completions'
    assert captured['headers']['Authorization']=='Bearer never-publish-this-test-key'
    assert captured['payload']['model']=='deepseek-flash'
    assert captured['payload']['messages'][0]['role']=='system'


def test_solution_generates_exact_csv_in_mock_mode(monkeypatch,tmp_path):
    data=tmp_path/'inputs';data.mkdir()
    source=Path(__file__).parents[1]/'data/knowledge-base.zip'
    (data/'knowledge-base.zip').write_bytes(source.read_bytes())
    with (data/'questions.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['id','question']);w.writeheader()
        w.writerow({'id':'001','question':'Первый вопрос'})
        w.writerow({'id':'002','question':'Второй вопрос'})
    class FakeAssistant:
        def __init__(self,kb):pass
        def answer(self,question):return {'answer':'Демо: '+question}
    monkeypatch.setattr(solution,'LegalAssistant',FakeAssistant)
    monkeypatch.setenv('DATA_DIR',str(data))
    monkeypatch.chdir(tmp_path)
    solution.main()
    with (tmp_path/'submission.csv').open('r',encoding='utf-8',newline='') as f:
        reader=csv.DictReader(f)
        assert reader.fieldnames==['id','answer']
        rows=list(reader)
    assert [row['id'] for row in rows]==['001','002']
    assert rows[0]['answer']=='Демо: Первый вопрос'
    assert rows[1]['answer']=='Демо: Второй вопрос'
