import logging
import requests
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import EventLog, IntegrationLog, Task, Status
from .events import publish, emit

logger = logging.getLogger(__name__)

@shared_task
def dispatch_integrations():
    for log_id in IntegrationLog.objects.filter(status='PENDING').values_list('id', flat=True)[:100]:
        retry_integration.delay(str(log_id))

@shared_task
def flush_outbox():
    for event_id in EventLog.objects.filter(published_at=None).values_list('id', flat=True)[:100]:
        with transaction.atomic():
            event = EventLog.objects.select_for_update(skip_locked=True).filter(id=event_id, published_at=None).first()
            if event is None:
                continue
            event.attempts += 1
            event.save(update_fields=['attempts'])
            try:
                publish(event)
            except Exception:
                logger.warning('outbox.delivery_failed', extra={'event_id': str(event.id), 'topic': event.topic})

@shared_task(bind=True, max_retries=4)
def retry_integration(self, log_id):
    with transaction.atomic():
        log = IntegrationLog.objects.select_for_update().select_related('lead').get(id=log_id)
        if log.status == 'SUCCESS':
            return
        log.attempt += 1
        log.status = 'RETRYING'
        log.save()
    try:
        if not settings.INTEGRATION_URL:
            raise requests.ConnectionError('Simulated CRM unavailable')
        response = requests.post(settings.INTEGRATION_URL, json={'leadId': str(log.lead_id), 'category': log.lead.category}, headers={'Idempotency-Key': str(log.id)}, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        log.error = 'CRM indisponível ou resposta inválida; conteúdo externo omitido'
        log.status = 'FAILED' if self.request.retries >= self.max_retries else 'RETRYING'
        log.save()
        if log.status == 'FAILED':
            emit(log.lead, 'integration.failed', {'logId': str(log.id), 'attempt': log.attempt})
            return
        raise self.retry(countdown=min(300, 2 ** log.attempt * 5))
    log.status = 'SUCCESS'
    log.error = ''
    log.save()

@shared_task
def check_sla():
    for task in Task.objects.filter(due_at__lt=timezone.now()).exclude(status__in=[Status.RESOLVED, Status.FAILED]):
        lead = task.lead
        if 'sla-breached' not in lead.tags:
            lead.tags = [*lead.tags, 'sla-breached']
            lead.save(update_fields=['tags', 'updated_at'])
