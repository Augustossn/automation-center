import factory
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from operations.models import Customer, Channel, Lead

class CustomerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Customer
    name = factory.Sequence(lambda n: f'Cliente {n}')
    email = factory.Sequence(lambda n: f'cliente{n}@example.com')

class ChannelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Channel
    name = factory.Sequence(lambda n: f'Canal {n}')
    slug = factory.Sequence(lambda n: f'channel-{n}')

class LeadFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Lead
    customer = factory.SubFactory(CustomerFactory)
    channel = factory.SubFactory(ChannelFactory)
    content = 'Quero orçamento para o plano empresarial'

@pytest.fixture
def lead(db):
    return LeadFactory()

@pytest.fixture
def client(db):
    user = get_user_model().objects.create_user('operator', password='test-only', is_staff=True)
    client = APIClient()
    client.force_authenticate(user)
    return client

@pytest.fixture
def reader(db):
    user = get_user_model().objects.create_user('reader', password='test-only')
    client = APIClient()
    client.force_authenticate(user)
    return client
