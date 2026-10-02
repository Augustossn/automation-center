import pytest
from unittest.mock import patch, Mock
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from celery.exceptions import Retry
from operations.models import Lead, EventLog, AutomationRule, Task, AgentRecommendation, IntegrationLog
from operations.agent import OperationsAgent, RecommendationSchema
from operations.services import classify
from operations.events import emit, consume
from operations.privacy import mask
from operations.tasks import retry_integration, check_sla, flush_outbox

pytestmark = pytest.mark.django_db

def payload(channel):
    return {'customer': {'name':'  Ana   Silva  ', 'email':'ANA@EXAMPLE.COM','phone':'(11) 99999-0000'},'channel':channel.slug,'content':'  Quero orçamento empresarial  '}

def test_create_normalizes_and_commits_outbox(client, lead):
    response = client.post('/api/leads', payload(lead.channel), format='json')
    assert response.status_code == 201
    created = Lead.objects.get(id=response.data['id'])
    assert created.customer.name == 'Ana Silva'
    assert created.customer.email == 'ana@example.com'
    assert created.customer.phone == '11999990000'
    assert created.content == 'Quero orçamento empresarial'
    assert created.events.get().topic == 'lead.created'
    assert created.events.get().published_at is None

@pytest.mark.parametrize('field,value',[('content','x'),('content','x'*10001),('channel','missing')])
def test_input_validation(client,lead,field,value):
    data=payload(lead.channel); data[field]=value
    assert client.post('/api/leads',data,format='json').status_code==400

def test_permissions(reader,lead):
    assert APIClient().get('/api/leads').status_code==401
    assert reader.get('/api/leads').status_code==200
    assert reader.post(f'/api/leads/{lead.id}/classify').status_code==403
    assert reader.post('/api/automation-rules',{},format='json').status_code==403

def test_rule_routing_and_assignment(lead):
    AutomationRule.objects.create(name='Enterprise',category='sales',team='Enterprise',priority='HIGH',keyword='empresarial',rank=1)
    classify(lead.id)
    lead.refresh_from_db()
    task=lead.tasks.get()
    assert task.team=='Enterprise' and task.priority=='HIGH'
    assert task.assignment.team=='Enterprise'
    assert lead.status=='ASSIGNED'
    assert set(lead.events.values_list('topic',flat=True))=={'task.created','lead.classified'}
    assert lead.integration_logs.get().status=='PENDING'

def test_consumer_is_idempotent(lead):
    event=emit(lead,'lead.created')
    envelope={'eventId':str(event.id),'leadId':str(lead.id)}
    consume('lead.created',envelope);consume('lead.created',envelope)
    assert lead.tasks.count()==1
    assert lead.recommendations.count()==1
    event.refresh_from_db();assert event.processed_at

def test_consumer_rejects_invalid_envelope(lead):
    event=emit(lead,'lead.created')
    with pytest.raises(ValueError):
        consume('lead.created',{'eventId':str(event.id),'leadId':'wrong'})
    assert lead.tasks.count()==0

def test_low_confidence_requires_review(lead):
    lead.content='Um assunto ainda desconhecido';lead.save()
    rec=OperationsAgent().run(lead.id)
    assert rec.result['confidence']<0.80
    assert rec.result['requiresHumanApproval'] is True
    assert lead.tasks.get().team=='Revisão humana'

def test_sensitive_content_never_has_draft(lead):
    lead.content='Quero orçamento, meu CPF é 123.456.789-00';lead.save()
    rec=OperationsAgent().run(lead.id)
    assert rec.result['draftResponse'] is None
    assert rec.result['requiresHumanApproval']

def test_parsing_rejects_invalid_ai_json():
    assert not RecommendationSchema(data={'category':'sales','confidence':1.7}).is_valid()

def test_mask_recursive():
    assert mask({'email':'a@example.com','nested':[{'token':'abc','message':'a@example.com'}]})=={'email':'[REDACTED]','nested':[{'token':'[REDACTED]','message':'[EMAIL]'}]}

def test_task_move_and_conflict(client,lead):
    classify(lead.id);task=lead.tasks.get()
    response=client.patch(f'/api/tasks/{task.id}/status',{'status':'IN_PROGRESS','version':0},format='json')
    assert response.status_code==200 and response.data['version']==1
    task.refresh_from_db();assert task.status=='IN_PROGRESS'
    lead.refresh_from_db();assert lead.status=='IN_PROGRESS'
    assert lead.events.filter(topic='task.status_changed').count()==1
    assert client.patch(f'/api/tasks/{task.id}/status',{'status':'RESOLVED','version':0},format='json').status_code==409
    assert client.patch(f'/api/tasks/{task.id}/status',{'status':'BOGUS','version':1},format='json').status_code==400

def test_reader_cannot_move(reader,lead):
    classify(lead.id);task=lead.tasks.get()
    assert reader.patch(f'/api/tasks/{task.id}/status',{'status':'RESOLVED','version':0},format='json').status_code==403

def test_decisions_audited(client,lead):
    rec=OperationsAgent().run(lead.id)
    response=client.post(f'/api/recommendations/{rec.id}/decide',{'decision':'APPROVED','reason':'Validado por operador'},format='json')
    assert response.status_code==200
    rec.refresh_from_db();assert rec.decided_by and rec.decided_at
    assert client.post(f'/api/recommendations/{rec.id}/decide',{'decision':'REJECTED','reason':'again'},format='json').status_code==409

def test_reprocess_queues_event(client,lead):
    assert client.post(f'/api/leads/{lead.id}/reprocess').status_code==202
    assert lead.events.get().topic=='lead.reprocessed'

def test_webhook_auth_idempotency(lead,settings):
    client=APIClient();data=payload(lead.channel)
    assert client.post('/api/webhooks/leads',data,format='json').status_code==403
    args={'HTTP_X_WEBHOOK_SECRET':settings.WEBHOOK_SECRET,'HTTP_IDEMPOTENCY_KEY':'webhook-1'}
    assert client.post('/api/webhooks/leads',data,format='json',**args).status_code==201
    assert client.post('/api/webhooks/leads',data,format='json',**args).status_code==200
    assert Lead.objects.filter(idempotency_key='webhook-1').count()==1

def test_integration_retry_backoff(lead):
    log=IntegrationLog.objects.create(lead=lead)
    with patch.object(retry_integration,'retry',side_effect=Retry()) as retry:
        with pytest.raises(Retry):retry_integration.run(str(log.id))
    log.refresh_from_db();assert log.attempt==1 and log.status=='RETRYING'
    retry.assert_called_once_with(countdown=10)

def test_integration_exhaustion(lead):
    log=IntegrationLog.objects.create(lead=lead)
    retry_integration.push_request(retries=4)
    try:
        retry_integration.run(str(log.id))
    finally:
        retry_integration.pop_request()
    log.refresh_from_db();assert log.status=='FAILED'
    assert lead.events.get().topic=='integration.failed'

def test_integration_success_and_no_duplicate(lead,settings):
    settings.INTEGRATION_URL='https://crm.example.test'
    log=IntegrationLog.objects.create(lead=lead)
    with patch('operations.tasks.requests.post') as post:
        retry_integration.run(str(log.id));retry_integration.run(str(log.id))
        assert post.call_count==1
    log.refresh_from_db();assert log.status=='SUCCESS'

def test_outbox_failure_remains_pending(lead):
    event=emit(lead,'lead.created')
    with patch('operations.tasks.publish',side_effect=RuntimeError('offline')):flush_outbox()
    event.refresh_from_db();assert event.published_at is None and event.attempts==1

def test_sla_and_dashboard(client,lead):
    classify(lead.id)
    lead.tasks.update(due_at=timezone.now()-timedelta(hours=1))
    check_sla();lead.refresh_from_db();assert 'sla-breached' in lead.tags
    response=client.get('/api/dashboard/metrics')
    assert response.status_code==200 and response.data['slaBreached']==1

def test_logs_payload_is_masked(client,lead):
    IntegrationLog.objects.create(lead=lead,payload={'email':'private@example.com','secret':'key'})
    payload=client.get('/api/integration-logs').data['results'][0]['payload']
    assert payload=={'email':'[REDACTED]','secret':'[REDACTED]'}

def test_remote_adapter_validation(lead,settings):
    settings.AGENT_ADAPTER='real'
    settings.AGENT_API_URL=''
    with pytest.raises(ValueError): OperationsAgent().run(lead.id)
