import pytest
from operations.services import classify, sync_lead_status
from operations.models import Status

pytestmark = pytest.mark.django_db

def test_lead_resolves_only_after_all_tasks_are_resolved(lead):
    lead.content='Solicitação sem categoria conhecida'
    lead.save()
    classify(lead.id)
    lead.tasks.exclude(team='Revisão humana').update(status=Status.RESOLVED)
    assert sync_lead_status(lead).status==Status.ASSIGNED
    lead.tasks.update(status=Status.RESOLVED)
    assert sync_lead_status(lead).status==Status.RESOLVED
