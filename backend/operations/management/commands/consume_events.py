import json
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from confluent_kafka import Consumer
from operations.events import TOPICS, consume

class Command(BaseCommand):
    help = 'Consume business events; commit offsets only after database commit'
    def handle(self, *args, **options):
        consumer = Consumer({'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS, 'group.id': 'operations-v1', 'auto.offset.reset': 'earliest', 'enable.auto.commit': False})
        prefix = settings.KAFKA_TOPIC_PREFIX
        consumer.subscribe([prefix + topic for topic in TOPICS])
        try:
            while True:
                message = consumer.poll(1)
                if message is None:
                    continue
                if message.error():
                    logging.warning('kafka.poll_error')
                    continue
                try:
                    consume(message.topic()[len(prefix):], json.loads(message.value()))
                    consumer.commit(message=message, asynchronous=False)
                except Exception:
                    logging.error('kafka.processing_failed', extra={'topic': message.topic(), 'offset': message.offset()})
                    # Seek back so a transient failure is retried without committing a later offset.
                    from confluent_kafka import TopicPartition
                    consumer.seek(TopicPartition(message.topic(), message.partition(), message.offset()))
                    import time
                    time.sleep(2)
        finally:
            consumer.close()
