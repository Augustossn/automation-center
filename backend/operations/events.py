import json
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import EventLog

TOPICS = ['lead.created', 'lead.classified', 'task.created', 'integration.failed', 'lead.reprocessed']

def emit(lead, topic, payload=None):
    return EventLog.objects.create(lead=lead, topic=topic, payload={'leadId': str(lead.id), **(payload or {})})

def publish(event):
    from confluent_kafka import Producer
    errors = []
    producer = Producer({'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS, 'enable.idempotence': True, 'message.timeout.ms': 30000})
    producer.produce(settings.KAFKA_TOPIC_PREFIX + event.topic, key=str(event.lead_id), value=json.dumps({'eventId': str(event.id), **event.payload}), on_delivery=lambda error, msg: errors.append(error) if error else None)
    remaining = producer.flush(32)
    if remaining or errors:
        raise RuntimeError('Kafka delivery failed')
    event.published_at = timezone.now()
    event.save(update_fields=['published_at'])

@transaction.atomic
def consume(topic, envelope):
    event = EventLog.objects.select_for_update().get(id=envelope['eventId'], topic=topic)
    if str(event.lead_id) != envelope['leadId']:
        raise ValueError('Event lead mismatch')
    if event.processed_at:
        return
    if topic in ['lead.created', 'lead.reprocessed']:
        from .services import classify
        classify(event.lead_id)
    event.processed_at = timezone.now()
    event.save(update_fields=['processed_at'])
