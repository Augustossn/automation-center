import uuid
from django.conf import settings
from django.db import models

class Status(models.TextChoices):
    NEW = 'NEW', 'Novo'
    CLASSIFIED = 'CLASSIFIED', 'Classificado'
    ASSIGNED = 'ASSIGNED', 'Atribuído'
    IN_PROGRESS = 'IN_PROGRESS', 'Em andamento'
    WAITING_CUSTOMER = 'WAITING_CUSTOMER', 'Aguardando cliente'
    RESOLVED = 'RESOLVED', 'Resolvido'
    FAILED = 'FAILED', 'Falha'

class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True
        ordering = ['-created_at']

class Customer(Record):
    name = models.CharField(max_length=160)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

class Channel(Record):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(unique=True)
    active = models.BooleanField(default=True)

class Lead(Record):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='leads')
    channel = models.ForeignKey(Channel, on_delete=models.PROTECT)
    content = models.TextField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.NEW)
    category = models.CharField(max_length=80, blank=True)
    priority = models.CharField(max_length=12, default='MEDIUM', choices=[(x, x) for x in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']])
    tags = models.JSONField(default=list)
    idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)

class AutomationRule(Record):
    name = models.CharField(max_length=160)
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, null=True, blank=True)
    category = models.CharField(max_length=80)
    keyword = models.CharField(max_length=120, blank=True)
    team = models.CharField(max_length=80)
    priority = models.CharField(max_length=12, choices=Lead._meta.get_field('priority').choices, default='MEDIUM')
    rank = models.PositiveIntegerField(default=100)
    active = models.BooleanField(default=True)
    class Meta:
        ordering = ['rank', 'id']

class Task(Record):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=180)
    team = models.CharField(max_length=80)
    priority = models.CharField(max_length=12, choices=Lead._meta.get_field('priority').choices, default='MEDIUM')
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ASSIGNED)
    version = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField()
    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['lead', 'team', 'title'], name='unique_operational_task')]

class Assignment(Record):
    task = models.OneToOneField(Task, on_delete=models.CASCADE, related_name='assignment')
    team = models.CharField(max_length=80)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

class IntegrationLog(Record):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='integration_logs')
    integration = models.CharField(max_length=80, default='crm')
    status = models.CharField(max_length=24, default='PENDING', choices=[(x, x) for x in ['PENDING', 'RETRYING', 'SUCCESS', 'FAILED']])
    attempt = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    payload = models.JSONField(default=dict)

class EventLog(Record):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='events')
    topic = models.CharField(max_length=80)
    payload = models.JSONField(default=dict)
    published_at = models.DateTimeField(null=True)
    processed_at = models.DateTimeField(null=True)
    attempts = models.PositiveIntegerField(default=0)

class AgentRecommendation(Record):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='recommendations')
    result = models.JSONField()
    decision = models.CharField(max_length=12, default='PENDING', choices=[(x,x) for x in ['PENDING', 'APPROVED', 'REJECTED']])
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    decided_at = models.DateTimeField(null=True)
    reason = models.TextField(blank=True)
