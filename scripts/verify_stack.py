"""Local smoke test using fictional data; never sends external messages."""
import json
import time
import uuid
from pathlib import Path
import requests

root = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
session = requests.Session()
session.auth = ('demo', env['DEMO_PASSWORD'])
base = 'http://127.0.0.1:18018/api'
def api(method, path, **kwargs):
    response = session.request(method, base + path, timeout=10, **kwargs)
    response.raise_for_status()
    return response.json()

lead = api('POST', '/leads', json={'customer': {'name': 'Validação Docker', 'email': 'docker@example.test', 'phone': '11999998888'}, 'channel': 'website', 'content': 'Quero orçamento para contratar o serviço para minha empresa.', 'idempotency_key': str(uuid.uuid4())})
for _ in range(25):
    timeline = api('GET', f"/leads/{lead['id']}/timeline")
    if timeline['recommendations'] and any(e['topic'] == 'lead.created' and e['processed'] for e in timeline['events']):
        break
    time.sleep(2)
else:
    raise AssertionError('Kafka did not classify lead within 50 seconds')
tasks = api('GET', '/tasks?page_size=100')['results']
task = next(t for t in tasks if t['lead'] == lead['id'])
moved = api('PATCH', f"/tasks/{task['id']}/status", json={'status': 'IN_PROGRESS', 'version': task['version']})
assert moved['status'] == 'IN_PROGRESS'
assert api('GET', f"/leads/{lead['id']}")['status'] == 'IN_PROGRESS'
api('GET', '/dashboard/metrics')
requests.get('http://127.0.0.1:18088', timeout=10).raise_for_status()
targets = requests.get('http://127.0.0.1:19090/api/v1/targets', timeout=10).json()['data']['activeTargets']
assert any(t['health'] == 'up' for t in targets)
assert requests.get('http://127.0.0.1:13000/api/health', timeout=10).json()['database'] == 'ok'
result = {'lead_created': True, 'kafka_consumed': True, 'agent_recommendation_saved': True, 'task_move_persisted': True, 'lead_status_synchronized': True, 'frontend_served': True, 'prometheus_target_up': True, 'grafana_database_ok': True}
(root / 'docs/stack-smoke.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
