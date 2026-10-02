from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from .models import Lead, Task, Assignment, Status, AutomationRule, IntegrationLog
from .events import emit

def sync_lead_status(lead):
    states = set(lead.tasks.values_list('status', flat=True))
    if states and states == {Status.RESOLVED}:
        lead.status = Status.RESOLVED
    else:
        lead.status = next((s for s in [Status.FAILED, Status.IN_PROGRESS, Status.WAITING_CUSTOMER, Status.ASSIGNED, Status.CLASSIFIED, Status.NEW] if s in states), Status.NEW)
    lead.save(update_fields=['status', 'updated_at'])
    return lead

def create_task(lead, team, priority, title=None):
    task, created = Task.objects.get_or_create(lead=lead, team=team, title=title or f'Atender {lead.category or "solicitação"}', defaults={'priority': priority, 'due_at': timezone.now() + timedelta(hours=4 if priority in ['HIGH','URGENT'] else 24)})
    if created:
        from django.contrib.auth import get_user_model
        assignee = get_user_model().objects.filter(is_active=True, groups__name=team).order_by('id').first()
        Assignment.objects.create(task=task, team=team, assignee=assignee)
        emit(lead, 'task.created', {'taskId': str(task.id), 'team': team})
    return task

@transaction.atomic
def classify(lead_id):
    from .agent import OperationsAgent
    lead = Lead.objects.select_for_update().select_related('channel').get(id=lead_id)
    recommendation = OperationsAgent().run(lead.id)
    result = recommendation.result
    rules = AutomationRule.objects.filter(Q(channel=lead.channel) | Q(channel__isnull=True), active=True, category=result['category'])
    rule = next((r for r in rules if not r.keyword or r.keyword.casefold() in lead.content.casefold()), None)
    lead.category = result['category']
    lead.priority = rule.priority if rule else result['priority']
    lead.status = Status.CLASSIFIED
    lead.save()
    emit(lead, 'lead.classified', {'category': lead.category, 'confidence': result['confidence']})
    create_task(lead, rule.team if rule else result['suggestedTeam'], lead.priority)
    lead.status = Status.ASSIGNED
    lead.save(update_fields=['status', 'updated_at'])
    IntegrationLog.objects.get_or_create(lead=lead, integration='crm', defaults={'payload': {'leadId': str(lead.id), 'category': lead.category}})
    return lead
