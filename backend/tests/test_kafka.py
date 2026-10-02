import os,json,uuid
import pytest
from confluent_kafka import Consumer
from operations.events import emit,publish,consume

@pytest.mark.kafka
@pytest.mark.django_db(transaction=True)
def test_real_kafka_roundtrip(lead,settings):
    if os.getenv('KAFKA_INTEGRATION')!='1':
        pytest.skip('Run KAFKA_INTEGRATION=1 with Kafka broker')
    settings.KAFKA_BOOTSTRAP_SERVERS=os.getenv('KAFKA_BOOTSTRAP_SERVERS','localhost:9094')
    settings.KAFKA_TOPIC_PREFIX=f'test-{uuid.uuid4()}.'
    consumer=Consumer({'bootstrap.servers':settings.KAFKA_BOOTSTRAP_SERVERS,'group.id':f'test-{uuid.uuid4()}','auto.offset.reset':'earliest','enable.auto.commit':False})
    consumer.subscribe([settings.KAFKA_TOPIC_PREFIX + 'lead.created'])
    event=emit(lead,'lead.created');publish(event)
    import time
    deadline=time.monotonic()+30
    try:
        while time.monotonic()<deadline:
            message=consumer.poll(1)
            if message and not message.error():
                envelope=json.loads(message.value())
                if envelope['eventId']==str(event.id):
                    consume('lead.created',envelope)
                    consume('lead.created',envelope)
                    assert lead.tasks.count()==1
                    consumer.commit(message,asynchronous=False)
                    return
        pytest.fail('Kafka did not deliver event in 30 seconds')
    finally:
        consumer.close()
